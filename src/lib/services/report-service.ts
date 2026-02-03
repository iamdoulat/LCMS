
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export interface ReportOptions {
    type: 'attendance' | 'payslip';
    monthYear: string;
    targetEmail?: string;
}

export async function sendMonthlyReports({ type, monthYear, targetEmail }: ReportOptions) {
    const date = new Date(monthYear + '-01'); // First day of month
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    // Fetch Employees
    let employeesQuery = admin.firestore().collection('employees').where('status', 'in', ['Active', 'On Leave']);
    if (targetEmail) {
        employeesQuery = employeesQuery.where('email', '==', targetEmail);
    }
    const employeesSnap = await employeesQuery.get();
    const employees = employeesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    if (employees.length === 0) {
        return { success: false, message: 'No matching employees found' };
    }

    let sentCount = 0;

    if (type === 'attendance') {
        const days = eachDayOfInterval({ start, end });

        // Fetch ALL attendance records for the month up front
        const attendanceSnap = await admin.firestore().collection('attendance_records')
            .where('date', '>=', format(start, 'yyyy-MM-dd'))
            .where('date', '<=', format(end, 'yyyy-MM-dd'))
            .get();

        const allAttendance = attendanceSnap.docs.map(d => d.data());

        // Pre-import PDF libraries to save time inside the loop
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        // Process in batches (parallel) to avoid timeouts
        const BATCH_SIZE = 5;
        for (let i = 0; i < employees.length; i += BATCH_SIZE) {
            const batch = employees.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (emp) => {
                if (!emp.email) return;

                try {
                    let stats = { present: 0, absent: 0, delayed: 0, leave: 0, visit: 0 };
                    const doc = new jsPDF();

                    doc.setFontSize(18);
                    doc.text("Monthly Attendance Report", 14, 22);
                    doc.setFontSize(11);
                    doc.text(`Employee: ${emp.fullName || emp.name}`, 14, 30);
                    doc.text(`Month: ${format(date, 'MMMM yyyy')}`, 14, 36);

                    const tableData: any[] = [];
                    days.forEach(day => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const record = allAttendance.find(r => r.employeeId === emp.id && r.date === dayStr);

                        let status = '-';
                        let inTime = '-';
                        let outTime = '-';
                        let remarks = '';

                        if (record) {
                            status = record.flag || 'Present';
                            remarks = record.remarks || '';
                            if (record.inTime) try { inTime = format(new Date(record.inTime), 'hh:mm a'); } catch (e) { }
                            if (record.outTime) try { outTime = format(new Date(record.outTime), 'hh:mm a'); } catch (e) { }

                            const f = (record.flag || '').toUpperCase();
                            if (f === 'P') { stats.present++; }
                            else if (f === 'A') { stats.absent++; }
                            else if (f === 'D') { stats.delayed++; stats.present++; }
                            else if (f === 'L') { stats.leave++; }
                            else if (f === 'V') { stats.visit++; stats.present++; }
                            else if (status === 'Present') stats.present++;
                        }

                        tableData.push([format(day, 'dd MMM'), status, inTime, outTime, remarks]);
                    });

                    (autoTable as any)(doc, {
                        head: [['Date', 'Status', 'In Time', 'Out Time', 'Remarks']],
                        body: tableData,
                        startY: 45,
                        theme: 'grid',
                        styles: { fontSize: 8 },
                        headStyles: { fillColor: [66, 66, 66] }
                    });

                    const finalY = (doc as any).lastAutoTable.finalY || 150;
                    doc.text("Summary:", 14, finalY + 10);
                    doc.setFontSize(10);
                    doc.text(`Present: ${stats.present}   Absent: ${stats.absent}   Delayed: ${stats.delayed}`, 14, finalY + 16);
                    doc.text(`Leave: ${stats.leave}   Visit: ${stats.visit}`, 14, finalY + 22);

                    const pdfBase64 = doc.output('datauristring').split(',')[1];

                    const shortHtml = `
                        <p>Dear ${emp.fullName || emp.name},</p>
                        <p>Please find attached your attendance report for <strong>${format(date, 'MMMM yyyy')}</strong>.</p>
                        <p>Regards,<br/>HR Team</p>
                    `;

                    // Send Email
                    const emailPromise = sendEmail({
                        to: emp.email,
                        templateSlug: 'employee_monthly_attendance_report',
                        subject: `Attendance Report - ${format(date, 'MMMM yyyy')}`,
                        body: shortHtml,
                        data: {
                            employee_name: emp.fullName || emp.name || 'Employee',
                            month_year: format(date, 'MMMM yyyy'),
                            attendance_chart: "See attached PDF"
                        },
                        attachments: [
                            {
                                filename: `Attendance_${format(date, 'MMM_yyyy')}.pdf`,
                                content: pdfBase64,
                                encoding: 'base64'
                            }
                        ]
                    });

                    // Send WhatsApp in parallel if phone exists
                    let waPromise: Promise<any> = Promise.resolve();
                    if (emp.phone) {
                        const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                        const waSummary = `Present: ${stats.present} | Absent: ${stats.absent} | Delayed: ${stats.delayed} | Leave: ${stats.leave} | Visit: ${stats.visit}`;
                        waPromise = sendWhatsApp({
                            to: emp.phone,
                            templateSlug: 'employee_monthly_attendance_report',
                            data: {
                                employee_name: emp.fullName || emp.name || 'Employee',
                                month_year: format(date, 'MMMM yyyy'),
                                attendance_chart: waSummary
                            }
                        }).catch(e => console.error("WA Report Error", e));
                    }

                    await Promise.all([emailPromise, waPromise]);
                    sentCount++;
                } catch (reportErr) {
                    console.error(`Error generating/sending report for employee ${emp.id}:`, reportErr);
                }
            }));
        }

    } else if (type === 'payslip') {
        const payrollSnap = await admin.firestore().collection('payroll_records')
            .where('month', '==', monthYear)
            .get();
        const allPayroll = payrollSnap.docs.map(d => d.data());

        const BATCH_SIZE = 10;
        for (let i = 0; i < employees.length; i += BATCH_SIZE) {
            const batch = employees.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (emp) => {
                const record = allPayroll.find(r => r.employeeId === emp.id);
                if (!record || (!emp.email && !emp.phone)) return;

                try {
                    const summaryHtml = `
                        <p><strong>Basic Salary:</strong> ${record.basicSalary || 0}</p>
                        <p><strong>Net Salary:</strong> <h3>${record.netSalary || 0}</h3></p>
                    `;

                    if (emp.email) {
                        await sendEmail({
                            to: emp.email,
                            templateSlug: 'employee_monthly_payslip_summary',
                            data: {
                                employee_name: emp.fullName || emp.name,
                                month_year: format(date, 'MMMM yyyy'),
                                payslip_summary: summaryHtml
                            }
                        });
                    }

                    if (emp.phone) {
                        const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                        const waSummary = `Basic: ${record.basicSalary || 0}\nNet Salary: ${record.netSalary || 0}`;
                        await sendWhatsApp({
                            to: emp.phone,
                            templateSlug: 'employee_monthly_payslip_summary',
                            data: {
                                employee_name: emp.fullName || emp.name,
                                month_year: format(date, 'MMMM yyyy'),
                                payslip_summary: waSummary
                            }
                        }).catch(e => console.error("WA Payslip Error", e));
                    }
                    sentCount++;
                } catch (payslipErr) {
                    console.error(`Error processing payslip for ${emp.id}:`, payslipErr);
                }
            }));
        }
    }

    return { success: true, count: sentCount };
}

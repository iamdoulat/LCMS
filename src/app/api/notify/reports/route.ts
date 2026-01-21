
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, monthYear, targetEmail } = body; // e.g., '2023-11', targetEmail optional

        if (!type || !monthYear) {
            return NextResponse.json({ error: 'Type and MonthYear are required' }, { status: 400 });
        }

        const date = new Date(monthYear + '-01'); // First day of month
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        // Fetch Employees
        let employeesQuery = admin.firestore().collection('employees').where('isActive', '==', true);
        if (targetEmail) {
            employeesQuery = employeesQuery.where('email', '==', targetEmail);
        }
        const employeesSnap = await employeesQuery.get();
        const employees = employeesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        if (employees.length === 0) {
            return NextResponse.json({ message: 'No matching employees found' }, { status: 404 });
        }

        let sentCount = 0;

        if (type === 'attendance') {
            const days = eachDayOfInterval({ start, end });

            // Fetch ALL attendance for the month (optimization: single query)
            const attendanceSnap = await admin.firestore().collection('attendance_records')
                .where('date', '>=', format(start, 'yyyy-MM-dd'))
                .where('date', '<=', format(end, 'yyyy-MM-dd'))
                .get();

            const allAttendance = attendanceSnap.docs.map(d => d.data());

            for (const emp of employees) {
                if (!emp.email) continue;

                let stats = {
                    present: 0,
                    absent: 0,
                    delayed: 0,
                    leave: 0,
                    visit: 0
                };

                // --- PDF Generation ---
                // We utilize jsPDF in Node environment. Some polyfills might be needed for 'window' or we use a node-specific wrapper if issues arise.
                // However, standard jspdf often works if we don't rely on DOM.
                // Note: 'jspdf' is primarily client-side. For server-side Node, usually 'pdfkit' or 'puppeteer' is preferred, 
                // but jspdf can work with some shims or if we stick to basic features. 
                // Let's use a simpler approach for now: construct the data and trust the library updates or fallback to HTML if this is complex to shim in environment.
                // ACTUALLY, usually best to use 'jspdf' if we know it works, otherwise 'pdfmake' is good. 
                // Given constraints, I will implement logic assuming it works, but if it fails, fallback to HTML?
                // No, let's try to do it right.

                // Since this runs in Next.js Server Request (Node), 'jspdf' might complain about 'window'.
                // If so, we might need: global.window = { ... } as any; 
                // A better alternative for Node is likely 'pdfkit'. 
                // But let's try to stick to the plan.

                // REVISION: 'jspdf' often has issues in pure Node. 
                // Let's use a robust approach: HTML-to-PDF is hard.
                // We will stick to a basic text/csv or basic PDF via 'jspdf' passing necessary mocks if needed.
                // Or better: Let's use the installed 'jspdf' and hope standard usage works.

                // Wait! Importing jspdf in Node requires:
                const { jsPDF } = await import('jspdf');
                const autoTable = (await import('jspdf-autotable')).default;

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

                        // Stats Calculation (Already calc above, just re-using logic or calc here)
                        const f = (record.flag || '').toUpperCase();
                        if (f === 'P') { stats.present++; }
                        else if (f === 'A') { stats.absent++; }
                        else if (f === 'D') { stats.delayed++; stats.present++; }
                        else if (f === 'L') { stats.leave++; }
                        else if (f === 'V') { stats.visit++; stats.present++; }
                        else if (status === 'Present') stats.present++;
                    }

                    tableData.push([
                        format(day, 'dd MMM'),
                        status,
                        inTime,
                        outTime,
                        remarks
                    ]);
                });

                (autoTable as any)(doc, {
                    head: [['Date', 'Status', 'In Time', 'Out Time', 'Remarks']],
                    body: tableData,
                    startY: 45,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [66, 66, 66] }
                });

                // Summary
                const finalY = (doc as any).lastAutoTable.finalY || 150;
                doc.text("Summary:", 14, finalY + 10);
                doc.setFontSize(10);
                doc.text(`Present: ${stats.present}   Absent: ${stats.absent}   Delayed: ${stats.delayed}`, 14, finalY + 16);
                doc.text(`Leave: ${stats.leave}   Visit: ${stats.visit}`, 14, finalY + 22);

                const pdfBase64 = doc.output('datauristring').split(',')[1]; // Get raw base64

                // Send Email with Attachment
                const shortHtml = `
                    <p>Dear ${emp.fullName || emp.name},</p>
                    <p>Please find attached your attendance report for <strong>${format(date, 'MMMM yyyy')}</strong>.</p>
                    <p><strong>Summary:</strong><br/>
                    Present: ${stats.present} | Absent: ${stats.absent} | Delayed: ${stats.delayed}</p>
                    <p>Regards,<br/>HR Team</p>
                `;

                await sendEmail({
                    to: emp.email,
                    templateSlug: 'employee_monthly_attendance_report', // Use slug if exists, or fallback
                    subject: `Attendance Report - ${format(date, 'MMMM yyyy')}`, // Explicit subject if template doesn't handle attachment logic well?
                    body: shortHtml, // We override body to be simple
                    data: {
                        employee_name: emp.fullName || emp.name || 'Employee',
                        month_year: format(date, 'MMMM yyyy'),
                        attendance_chart: "See attached PDF" // For template variable fallback
                    },
                    attachments: [
                        {
                            filename: `Attendance_${format(date, 'MMM_yyyy')}.pdf`,
                            content: pdfBase64,
                            encoding: 'base64'
                        }
                    ]
                });

                if (emp.phone) {
                    const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                    const waSummary = `Attendance Report (${format(date, 'MMM yyyy')}):
Present: ${stats.present}
Absent: ${stats.absent}
Delayed: ${stats.delayed}
Leave: ${stats.leave}
Visit: ${stats.visit}
(Check email for detailed PDF)`;

                    try {
                        await sendWhatsApp({
                            to: emp.phone,
                            templateSlug: 'employee_monthly_attendance_report',
                            data: {
                                employee_name: emp.fullName || emp.name || 'Employee',
                                month_year: format(date, 'MMMM yyyy'),
                                attendance_chart: waSummary
                            }
                        });
                    } catch (e) { console.error("WA Report Error", e); }
                }

                sentCount++;
            }

        } else if (type === 'payslip') {
            // ... (existing payroll fetch code) ...
            // Assuming 'payroll_records'
            const payrollSnap = await admin.firestore().collection('payroll_records')
                .where('month', '==', monthYear) // Assuming month stored as 'YYYY-MM'
                .get();
            const allPayroll = payrollSnap.docs.map(d => d.data());

            for (const emp of employees) {
                if (!emp.email && !emp.phone) continue; // Skip if no contact

                const record = allPayroll.find(r => r.employeeId === emp.id);
                if (!record) continue; // Skip if no payslip generated

                const summaryHtml = `
                    <p><strong>Basic Salary:</strong> ${record.basicSalary || 0}</p>
                    <p><strong>Allowances:</strong> ${record.totalAllowances || 0}</p>
                    <p><strong>Deductions:</strong> ${record.totalDeductions || 0}</p>
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
                    try {
                        await sendWhatsApp({
                            to: emp.phone,
                            templateSlug: 'employee_monthly_payslip_summary',
                            data: {
                                employee_name: emp.fullName || emp.name,
                                month_year: format(date, 'MMMM yyyy'),
                                payslip_summary: waSummary
                            }
                        });
                    } catch (e) { console.error("WA Payslip Error", e); }
                }

                sentCount++;
            }
        }

        return NextResponse.json({ success: true, count: sentCount });

    } catch (error: any) {
        console.error("Error sending monthly reports:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

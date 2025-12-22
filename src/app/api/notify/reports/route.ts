
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

                // Build Table HTML
                let tableHtml = `<table border="1" cellpadding="5" cellspacing="0" style="width:100%; border-collapse:collapse; font-size: 14px;">
                    <thead>
                        <tr style="background:#f3f4f6;">
                            <th style="text-align:left;">Date</th>
                            <th style="text-align:left;">Status</th>
                            <th style="text-align:left;">In Time</th>
                            <th style="text-align:left;">Out Time</th>
                        </tr>
                    </thead>
                    <tbody>`;

                days.forEach(day => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const record = allAttendance.find(r => r.employeeId === emp.id && r.date === dayStr);

                    let status = '-';
                    let inTime = '-';
                    let outTime = '-';
                    let rowColor = 'inherit';

                    if (record) {
                        status = record.remarks || record.flag || 'Present';

                        if (record.inTime) {
                            try { inTime = format(new Date(record.inTime), 'hh:mm a'); } catch (e) { }
                        }
                        if (record.outTime) {
                            try { outTime = format(new Date(record.outTime), 'hh:mm a'); } catch (e) { }
                        }

                        // Stats Calculation
                        const f = (record.flag || '').toUpperCase();
                        if (f === 'P') { stats.present++; }
                        else if (f === 'A') { stats.absent++; rowColor = '#fee2e2'; }
                        else if (f === 'D') { stats.delayed++; stats.present++; rowColor = '#ffedd5'; } // Delayed counts as present usually
                        else if (f === 'L') { stats.leave++; rowColor = '#e0e7ff'; }
                        else if (f === 'V') { stats.visit++; stats.present++; rowColor = '#dcfce7'; } // Visit counts as present usually
                        else if (status === 'Present') stats.present++;
                    }

                    tableHtml += `<tr style="background-color: ${rowColor}">
                        <td>${format(day, 'dd MMM, yyyy')}</td>
                        <td>${status}</td>
                        <td>${inTime}</td>
                        <td>${outTime}</td>
                   </tr>`;
                });
                tableHtml += `</tbody></table>`;

                // Add Summary Footer
                tableHtml += `
                <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
                    <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 16px;">Attendance Summary</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 5px;"><strong>Total Present:</strong> ${stats.present}</td>
                            <td style="padding: 5px;"><strong>Absent:</strong> ${stats.absent}</td>
                            <td style="padding: 5px;"><strong>Delayed:</strong> ${stats.delayed}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px;"><strong>Leave:</strong> ${stats.leave}</td>
                            <td style="padding: 5px;"><strong>Visit:</strong> ${stats.visit}</td>
                            <td style="padding: 5px;"></td>
                        </tr>
                    </table>
                </div>`;

                await sendEmail({
                    to: emp.email,
                    templateSlug: 'employee_monthly_attendance_report',
                    data: {
                        employee_name: emp.fullName || emp.name || 'Employee',
                        month_year: format(date, 'MMMM yyyy'),
                        attendance_chart: tableHtml
                    }
                });

                if (emp.phone) {
                    const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                    // WhatsApp cannot render HTML table. We send summary text.
                    const waSummary = `Present: ${stats.present}, Absent: ${stats.absent}, Delayed: ${stats.delayed}, Leave: ${stats.leave}, Visit: ${stats.visit}`;
                    try {
                        await sendWhatsApp({
                            to: emp.phone,
                            templateSlug: 'employee_monthly_attendance_report',
                            data: {
                                employee_name: emp.fullName || emp.name || 'Employee',
                                month_year: format(date, 'MMMM yyyy'),
                                attendance_chart: waSummary // Override HTML with text summary for WA
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

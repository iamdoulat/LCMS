import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isValid, parseISO } from 'date-fns';
import moment from 'moment-timezone';

export interface ReportOptions {
    type: 'attendance' | 'payslip';
    monthYear: string;
    targetEmail?: string;
}

export async function sendMonthlyReports({ type, monthYear, targetEmail }: ReportOptions) {
    // Parse year and month manually to avoid UTC timezone issues.
    // new Date('2026-02-01') parses as UTC midnight, which in UTC+6 is Jan 31 — wrong month!
    const [yearStr, monthStr] = monthYear.split('-');
    const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1); // local midnight, always correct
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
        const fromDateStr = format(start, "yyyy-MM-dd'T'00:00:00.000xxx");
        const toDateStr = format(end, "yyyy-MM-dd'T'23:59:59.999xxx");
        const fromDateSimple = format(start, 'yyyy-MM-dd');
        const toDateSimple = format(end, 'yyyy-MM-dd');

        // Fetch attendance, holidays, leaves, policies, breaks and company profile in parallel
        const [attendanceSnap, holidaysSnap, leavesSnap, companySnap, policiesSnap, breaksSnap] = await Promise.all([
            admin.firestore().collection('attendance')
                .where('date', '>=', fromDateStr)
                .where('date', '<=', toDateStr)
                .get(),
            admin.firestore().collection('holidays').get(),
            admin.firestore().collection('leave_applications')
                .where('status', '==', 'Approved')
                .where('toDate', '>=', fromDateSimple)
                .get(),
            admin.firestore().collection('financial_settings').doc('main_settings').get(),
            admin.firestore().collection('hrm_settings/attendance_policies/items').get(),
            admin.firestore().collection('break_time')
                .where('date', '>=', fromDateSimple)
                .where('date', '<=', toDateSimple)
                .get(),
        ]);

        const allHolidays = holidaysSnap.docs.map(d => d.data() as any);
        const allLeaves = leavesSnap.docs.map(d => d.data() as any);
        const allPolicies = policiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const allBreaks = breaksSnap.docs.map(d => d.data() as any);
        const companyProfile = companySnap.exists ? companySnap.data() as any : null;

        // Normalise date keys for attendance records
        const allAttendance = attendanceSnap.docs.map(d => {
            const data = d.data();
            if (data.date && typeof data.date === 'string') {
                data.dateKey = data.date.substring(0, 10);
            } else if (data.date && typeof data.date.toDate === 'function') {
                data.dateKey = format(data.date.toDate(), 'yyyy-MM-dd');
            } else {
                data.dateKey = data.date;
            }
            return data;
        });

        // Helper – format minutes as HH:MM
        const fmtDur = (mins: number) => {
            if (isNaN(mins) || mins === 0) return '00:00';
            const neg = mins < 0;
            const abs = Math.abs(mins);
            return `${neg ? '-' : ''}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
        };

        // Helper – parse "hh:mm AM/PM" into a Date on a given day (using moment for timezone safety)
        const parse12 = (t: string, dayStr: string): moment.Moment | null => {
            if (!t) return null;
            const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (!m) return null;
            let h = parseInt(m[1]); const min = parseInt(m[2]); const p = m[3].toUpperCase();
            if (p === 'PM' && h !== 12) h += 12; else if (p === 'AM' && h === 12) h = 0;
            // Use moment-timezone for Dhaka
            return moment.tz(`${dayStr} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Dhaka');
        };

        // Helper - get active policy (ported from src/lib/attendance.ts)
        const getActivePolicy = (emp: any, day: Date) => {
            const history = emp.policyHistory || [];
            const targetStr = format(day, 'yyyy-MM-dd');
            if (history.length === 0) {
                return allPolicies.find((p: any) => p.id === emp.attendancePolicyId) || null;
            }
            const sorted = [...history].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
            const found = sorted.find(h => h.effectiveFrom <= targetStr);
            if (found) return allPolicies.find((p: any) => p.id === found.policyId) || null;
            const oldest = sorted[sorted.length - 1];
            return allPolicies.find((p: any) => p.id === (oldest?.policyId || emp.attendancePolicyId)) || null;
        };

        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        const BATCH_SIZE = 5;
        for (let i = 0; i < employees.length; i += BATCH_SIZE) {
            const batch = employees.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (emp) => {
                if (!emp.email) return;
                try {
                    const empAttendance = allAttendance.filter(r => r.employeeId === emp.id);
                    const empLeaves = allLeaves.filter(l => l.employeeId === emp.id);

                    let presentCount = 0, absentCount = 0, delayCount = 0;
                    let leaveCount = 0, weekendCount = 0, holidayCount = 0, visitCount = 0;
                    let totalActualMins = 0;
                    const expectedDutyHour = 9;

                    // ── Build per-day rows ────────────────────────────────────────
                    const attRows: any[][] = days.map(day => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const dow = day.getDay(); // 0=Sun … 5=Fri
                        let flag = 'A', inTime = '', outTime = '', remarks = '';
                        let actualDutyMins = 0;

                        const rec = empAttendance.find(r => r.dateKey === dayStr);
                        const empBreaks = allBreaks.filter(b => b.employeeId === emp.id && b.date === dayStr);
                        
                        const holiday = allHolidays.find(h => {
                            const hs = moment(h.fromDate).format('YYYY-MM-DD');
                            const he = moment(h.toDate || h.fromDate).format('YYYY-MM-DD');
                            return dayStr >= hs && dayStr <= he;
                        });
                        const leave = empLeaves.find(l => {
                            const ls = moment(l.fromDate).format('YYYY-MM-DD');
                            const le = moment(l.toDate).format('YYYY-MM-DD');
                            return dayStr >= ls && dayStr <= le;
                        });

                        // Dynamic Status Logic
                        if (rec && rec.approvalStatus === 'Approved') {
                            flag = 'P';
                        } else if (rec && rec.flag && rec.flag !== 'A') {
                            flag = rec.flag.toUpperCase();
                        } else if (dow === 5) { // Friday weekend (Strict priority)
                            flag = 'W';
                        } else if (holiday) {
                            flag = 'H';
                            remarks = [holiday.name, holiday.message].filter(Boolean).join(' - ');
                        } else if (leave) {
                            flag = 'L';
                        } else if (rec) {
                            flag = (rec.flag || 'A').toUpperCase();
                        }

                        if (rec) {
                            inTime = rec.inTime || '';
                            outTime = rec.outTime || '';
                            remarks = remarks || [rec.inTimeRemarks, rec.outTimeRemarks].filter(Boolean).join('; ');
                        }

                        if (flag === 'P' || flag === 'D') {
                            presentCount++;
                            const activePolicy = getActivePolicy(emp, day);
                            const dayName = format(day, 'EEEE');
                            const dailyPolicy = activePolicy?.dailyPolicies?.find((dp: any) => dp.day === dayName);
                            
                            if (inTime) {
                                const inMt = parse12(inTime, dayStr);
                                const policyStartTime = dailyPolicy?.startTime || activePolicy?.startTime || '09:00 AM';
                                const threshold = parse12(policyStartTime, dayStr);
                                if (inMt && threshold && inMt.isAfter(threshold)) {
                                    flag = 'D';
                                    delayCount++;
                                }
                            }

                            if (inTime && outTime) {
                                const inMt = parse12(inTime, dayStr);
                                const outMt = parse12(outTime, dayStr);
                                if (inMt && outMt && outMt.isAfter(inMt)) {
                                    const total = Math.round(outMt.diff(inMt, 'minutes'));
                                    const policyBreak = dailyPolicy?.breakTime ?? activePolicy?.breakTime ?? 60;
                                    const actualBreak = empBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
                                    const excessBreak = Math.max(0, actualBreak - policyBreak);
                                    
                                    actualDutyMins = Math.max(0, total - excessBreak);
                                    totalActualMins += actualDutyMins;
                                }
                            }
                        } else if (flag === 'V') {
                            visitCount++;
                        } else if (flag === 'A') {
                            absentCount++;
                        } else if (flag === 'W') {
                            weekendCount++;
                        } else if (flag === 'H') {
                            holidayCount++;
                        } else if (flag === 'L') {
                            leaveCount++;
                        }

                        const extraLess = actualDutyMins > 0 ? actualDutyMins - expectedDutyHour * 60 : 0;

                        return [
                            format(day, 'dd-MM-yyyy\n(EEE)'),          // Attendance Date
                            flag,                                         // Flag
                            (flag === 'P' || flag === 'D') ? fmtDur(expectedDutyHour * 60) : '-', // Expected Duty
                            inTime || '',                                // In Time
                            outTime || '',                                // Out Time
                            fmtDur(empBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0)), // Break Time
                            actualDutyMins > 0 ? fmtDur(actualDutyMins) : '-', // Actual Duty
                            actualDutyMins > 0 ? fmtDur(extraLess) : '-', // Extra/Less
                            remarks,                                      // Remarks
                        ];
                    });

                    // ── Build PDF ─────────────────────────────────────────────────
                    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                    const pageW = doc.internal.pageSize.getWidth();
                    const companyName = companyProfile?.companyName || 'SMART SOLUTION';
                    const companyAddr = companyProfile?.address || '';
                    const fromLabel = format(start, 'dd-MM-yyyy');
                    const toLabel = format(end, 'dd-MM-yyyy');

                    // Company name (top-right)
                    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
                    doc.text(companyName, pageW - 14, 12, { align: 'right' });
                    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
                    doc.text(companyAddr, pageW - 14, 17, { align: 'right' });

                    // Report title
                    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
                    const title = `General Employee Job Card Report (${fromLabel} To ${toLabel})`;
                    doc.text(title, pageW / 2, 26, { align: 'center' });
                    doc.setLineWidth(0.4);
                    doc.line(14, 27.5, pageW - 14, 27.5);

                    // Employee info table (4-column grid)
                    const joinDate = emp.joinedDate ? (() => {
                        try { const d = new Date(emp.joinedDate); return isNaN(d.getTime()) ? emp.joinedDate : format(d, 'dd-MM-yyyy'); } catch { return emp.joinedDate; }
                    })() : 'N/A';

                    (autoTable as any)(doc, {
                        startY: 30,
                        body: [
                            [{ content: 'Employee Code', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, emp.employeeCode || '',
                            { content: 'Designation', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, emp.designation || ''],
                            [{ content: 'Employee Name', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, emp.fullName || emp.name || '',
                            { content: 'Branch', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, emp.branch || 'Not Defined'],
                            [{ content: 'Join Date', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, joinDate,
                            { content: 'Division', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, emp.division || 'Not Defined'],
                            [{ content: 'Job Status', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, emp.status || '',
                            { content: 'Department', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, emp.department || 'Not Defined'],
                        ],
                        theme: 'grid',
                        styles: { fontSize: 8, cellPadding: 2 },
                        columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 55 }, 2: { cellWidth: 32 }, 3: { cellWidth: 55 } },
                        margin: { left: 14, right: 14 },
                    });

                    const afterInfoY = (doc as any).lastAutoTable.finalY + 2;

                    // Attendance table
                    (autoTable as any)(doc, {
                        startY: afterInfoY,
                        head: [[
                            'Attendance Date', 'Flag', 'Expected Duty\n(Hour)',
                            'In Time', 'Out Time', 'Break Time\n(Hour)',
                            'Actual Duty\n(Hour)', 'Extra/Less Duty\n(Hour)', 'Remarks'
                        ]],
                        body: attRows,
                        theme: 'grid',
                        styles: { fontSize: 7, cellPadding: 2, valign: 'middle' },
                        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold', fontSize: 7 },
                        columnStyles: {
                            0: { cellWidth: 24 }, 1: { cellWidth: 10 }, 2: { cellWidth: 20 },
                            3: { cellWidth: 20 }, 4: { cellWidth: 20 }, 5: { cellWidth: 18 },
                            6: { cellWidth: 18 }, 7: { cellWidth: 20 }, 8: { cellWidth: 'auto' }
                        },
                        margin: { left: 14, right: 14 },
                    });

                    const afterAttY = (doc as any).lastAutoTable.finalY + 4;
                    const expectedTotalMins = presentCount * expectedDutyHour * 60;

                    // Summary table — 4-column layout matching the print page
                    (autoTable as any)(doc, {
                        startY: afterAttY,
                        body: [
                            [{ content: 'Present', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, String(presentCount),
                            { content: 'Absent', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, String(absentCount)],
                            [{ content: 'Delay', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, String(delayCount),
                            { content: 'Extra Delay', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, '0'],
                            [{ content: 'Leave', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, String(leaveCount),
                            { content: 'Visit', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, String(visitCount)],
                            [{ content: 'Weekend', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, String(weekendCount),
                            { content: 'Holiday', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, String(holidayCount)],
                            [{ content: 'Expected Duty Hour', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, fmtDur(expectedTotalMins),
                            { content: 'Actual Duty Hour', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, fmtDur(totalActualMins)],
                            [{ content: 'Total Days (Available in office)', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, `${days.length} (${presentCount})`,
                            { content: 'Extra/Less Duty Hours', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, fmtDur(totalActualMins - expectedTotalMins)],
                        ],
                        theme: 'grid',
                        styles: { fontSize: 8, cellPadding: 2 },
                        columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30 }, 2: { cellWidth: 60 }, 3: { cellWidth: 30 } },
                        margin: { left: 14, right: 14 },
                    });

                    // Footer
                    const footY = (doc as any).lastAutoTable.finalY + 6;
                    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
                    doc.text(`Printed On: ${format(new Date(), 'dd-MM-yyyy hh:mm a')}`, 14, footY);
                    doc.text('Page 1 of 1', pageW - 14, footY, { align: 'right' });

                    const pdfBase64 = doc.output('datauristring').split(',')[1];

                    // Build email template variable data (HTML table for email body)
                    const buildHtmlRow = (r: any[]) =>
                        `<tr>${r.map(c => `<td style="border:1px solid #ddd;padding:5px 8px;font-size:12px;">${c}</td>`).join('')}</tr>`;

                    const attendanceTableHtml = `
                        <table style="width:100%;border-collapse:collapse;margin-top:16px;font-family:Arial,sans-serif;">
                            <thead><tr style="background:#374151;color:#fff;">
                                ${['Date', 'Flag', 'Exp.Duty', 'In Time', 'Out Time', 'Break', 'Act.Duty', 'Ext/Less', 'Remarks']
                            .map(h => `<th style="padding:7px 8px;text-align:left;font-size:12px;">${h}</th>`).join('')}
                            </tr></thead>
                            <tbody>${attRows.map(buildHtmlRow).join('')}</tbody>
                        </table>`;

                    const attendanceSummaryHtml = `
                        <table style="width:100%;border-collapse:collapse;margin-top:12px;font-family:Arial,sans-serif;">
                            <tr><td style="padding:5px 10px;background:#f3f4f6;font-weight:bold;">Present</td><td style="padding:5px 10px;">${presentCount}</td>
                                <td style="padding:5px 10px;background:#f3f4f6;font-weight:bold;">Absent</td><td style="padding:5px 10px;">${absentCount}</td></tr>
                            <tr><td style="padding:5px 10px;background:#f3f4f6;font-weight:bold;">Delay</td><td style="padding:5px 10px;">${delayCount}</td>
                                <td style="padding:5px 10px;background:#f3f4f6;font-weight:bold;">Leave</td><td style="padding:5px 10px;">${leaveCount}</td></tr>
                            <tr><td style="padding:5px 10px;background:#f3f4f6;font-weight:bold;">Weekend</td><td style="padding:5px 10px;">${weekendCount}</td>
                                <td style="padding:5px 10px;background:#f3f4f6;font-weight:bold;">Holiday</td><td style="padding:5px 10px;">${holidayCount}</td></tr>
                            <tr><td style="padding:5px 10px;background:#f3f4f6;font-weight:bold;">Exp.Duty Hrs</td><td style="padding:5px 10px;">${fmtDur(expectedTotalMins)}</td>
                                <td style="padding:5px 10px;background:#f3f4f6;font-weight:bold;">Act.Duty Hrs</td><td style="padding:5px 10px;">${fmtDur(totalActualMins)}</td></tr>
                            <tr><td style="padding:5px 10px;background:#f3f4f6;font-weight:bold;">Total Days</td><td style="padding:5px 10px;">${days.length} (${presentCount})</td>
                                <td style="padding:5px 10px;background:#f3f4f6;font-weight:bold;">Extra/Less Hrs</td><td style="padding:5px 10px;">${fmtDur(totalActualMins - expectedTotalMins)}</td></tr>
                        </table>`;

                    const emailPromise = sendEmail({
                        to: emp.email,
                        templateSlug: 'employee_monthly_attendance_report',
                        data: {
                            employee_name: emp.fullName || emp.name || 'Employee',
                            month_year: format(date, 'MMMM yyyy'),
                            attendance_table_html: attendanceTableHtml,
                            attendance_summary_html: attendanceSummaryHtml,
                            attendance_chart: attendanceTableHtml, // legacy alias
                        },
                        attachments: [{
                            filename: `JobCard_${emp.employeeCode || emp.id}_${format(date, 'MMM_yyyy')}.pdf`,
                            content: pdfBase64,
                            encoding: 'base64'
                        }]
                    });

                    let waPromise: Promise<any> = Promise.resolve();
                    if (emp.phone) {
                        const { sendWhatsApp } = await import('@/lib/whatsapp/sender');
                        const pad = (n: number) => String(n).padStart(2, '0');
                        const waSummary = `Present:${pad(presentCount)} | Absent:${pad(absentCount)} | Delay:${pad(delayCount)} | Leave:${pad(leaveCount)} | Visit:${pad(visitCount)} | Weekend:${pad(weekendCount)} | Holiday:${pad(holidayCount)}`;
                        waPromise = sendWhatsApp({
                            to: emp.phone,
                            templateSlug: 'employee_monthly_attendance_report',
                            data: { employee_name: emp.fullName || emp.name || 'Employee', month_year: format(date, 'MMMM yyyy'), attendance_chart: waSummary }
                        }).catch(e => console.error('WA Report Error', e));
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

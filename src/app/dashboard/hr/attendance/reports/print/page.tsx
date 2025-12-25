"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Printer, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttendanceDocument, HolidayDocument, LeaveApplicationDocument, CompanyProfile } from '@/types';
import { format, parseISO, isValid, eachDayOfInterval, differenceInMinutes, getDay, isWithinInterval } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';

const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'dd-MM-yyyy') : 'Invalid Date';
    } catch (e) {
        return 'N/A';
    }
};

const formatTime = (timeString?: string) => {
    // Time is already formatted as "hh:mm AM/PM" in the database
    // No need to parse or reformat, just return as-is
    return timeString || '';
};

const parse12HourTime = (timeString: string, dateString: string): Date | null => {
    if (!timeString) return null;

    try {
        // Parse time in format "hh:mm AM/PM"
        const timeMatch = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!timeMatch) return null;

        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const period = timeMatch[3].toUpperCase();

        // Convert to 24-hour format
        if (period === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period === 'AM' && hours === 12) {
            hours = 0;
        }

        // Create date object
        const date = parseISO(dateString);
        date.setHours(hours, minutes, 0, 0);

        return date;
    } catch {
        return null;
    }
};

const formatDuration = (minutes: number) => {
    if (isNaN(minutes)) return '00:00';
    const isNegative = minutes < 0;
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    return `${isNegative ? '-' : ''}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export default function PrintJobCardPage() {
    const router = useRouter();
    const printContainerRef = React.useRef<HTMLDivElement>(null);
    const [reportData, setReportData] = React.useState<any>(null);
    const [companyProfile, setCompanyProfile] = React.useState<CompanyProfile | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const dataString = localStorage.getItem('jobCardReportData');
                if (!dataString) {
                    throw new Error("Report data not found. Please generate the report again.");
                }
                const parsedData = JSON.parse(dataString);

                const profileDocRef = doc(firestore, 'financial_settings', 'main_settings');
                const profileDocSnap = await getDoc(profileDocRef);
                if (profileDocSnap.exists()) {
                    setCompanyProfile(profileDocSnap.data() as CompanyProfile);
                }

                setReportData(parsedData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const handleDownloadPdf = async () => {
        const input = printContainerRef.current;
        if (!input) {
            Swal.fire("Error", "Could not find the content to download.", "error");
            return;
        }

        const utilityButtons = input.querySelector('.noprint') as HTMLElement;
        if (utilityButtons) utilityButtons.style.display = 'none';

        try {
            const canvas = await html2canvas(input, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgRatio = canvas.height / canvas.width;
            const imgHeight = pdfWidth * imgRatio;
            let heightLeft = imgHeight;

            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            pdf.save(`Job_Card_${reportData?.employee?.employeeCode}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            Swal.fire("Error", "An error occurred while generating the PDF.", "error");
        } finally {
            if (utilityButtons) utilityButtons.style.display = 'flex';
        }
    };


    if (isLoading) {
        return <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="mt-4">Loading Report...</p></div>;
    }
    if (error) {
        return <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white"><AlertTriangle className="h-12 w-12 text-destructive mb-4" /><p className="font-semibold text-destructive">{error}</p><Button onClick={() => router.back()} className="mt-4">Go Back</Button></div>;
    }
    if (!reportData) {
        return <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white"><p>No data found.</p></div>;
    }

    const { employee, dateRange, attendance, leaves, holidays, breaks } = reportData;
    const days = eachDayOfInterval({ start: parseISO(dateRange.from), end: parseISO(dateRange.to) });

    let presentCount = 0;
    let absentCount = 0;
    let delayCount = 0;
    let leaveCount = 0;
    let weekendCount = 0;
    let holidayCount = 0;
    let totalActualDutyMinutes = 0;
    const expectedDutyHour = 9;

    const tableRows = days.map(day => {
        const dayOfWeek = getDay(day);
        const formattedDate = format(day, 'yyyy-MM-dd');
        let status = 'A';
        let inTime = '';
        let outTime = '';
        let remarks = '';
        let actualDutyMinutes = 0;


        const attendanceRecord = attendance.find((a: AttendanceDocument) => format(parseISO(a.date), 'yyyy-MM-dd') === formattedDate);
        const leaveRecord = leaves.find((l: LeaveApplicationDocument) => isWithinInterval(day, { start: parseISO(l.fromDate), end: parseISO(l.toDate) }));
        const holidayRecord = holidays.find((h: HolidayDocument) => isWithinInterval(day, { start: parseISO(h.fromDate), end: parseISO(h.toDate || h.fromDate) }));

        if (dayOfWeek === 5) {
            status = 'W';
            weekendCount++;
        } else if (holidayRecord) {
            status = 'H';
            holidayCount++;
            remarks = holidayRecord.name;
        } else if (leaveRecord) {
            status = 'L';
            leaveCount++;
        } else if (attendanceRecord) {
            status = attendanceRecord.flag;
            inTime = attendanceRecord.inTime || '';
            outTime = attendanceRecord.outTime || '';
            remarks = [attendanceRecord.inTimeRemarks, attendanceRecord.outTimeRemarks].filter(Boolean).join('; ');
        }

        if (status === 'P' || status === 'D') {
            presentCount++;
            // Count delays for statistics (but don't override the flag from Firestore)
            if (inTime) {
                const inTimeDate = parse12HourTime(inTime, formattedDate);
                const expectedInTimeDate = parseISO(`${formattedDate}T09:10:00`); // 09:10 is the threshold
                if (inTimeDate && inTimeDate > expectedInTimeDate) {
                    delayCount++;
                }
            }
            if (inTime && outTime) {
                const inTimeDate = parse12HourTime(inTime, formattedDate);
                const outTimeDate = parse12HourTime(outTime, formattedDate);
                if (inTimeDate && outTimeDate && outTimeDate > inTimeDate) {
                    const totalMins = differenceInMinutes(outTimeDate, inTimeDate);

                    // Fetch actual break for this day
                    const dayBreaks = breaks?.filter((b: any) => b.date === formattedDate) || [];
                    const actualBreakMins = dayBreaks.reduce((sum: number, b: any) => sum + (b.durationMinutes || 0), 0);
                    // Deduct only break time exceeding 60 minutes from total duration
                    const excessBreakMins = Math.max(0, actualBreakMins - 60);
                    actualDutyMinutes = Math.max(0, totalMins - excessBreakMins);
                    totalActualDutyMinutes += actualDutyMinutes;
                }
            }
        } else if (status === 'A') {
            absentCount++;
        }

        const extraLessMinutes = actualDutyMinutes > 0 ? actualDutyMinutes - (expectedDutyHour * 60) : 0;

        return {
            date: format(day, 'dd-MM-yyyy (EEE)'),
            status,
            expectedDuty: (status === 'P' || status === 'D') ? formatDuration(expectedDutyHour * 60) : '-',
            inTime: formatTime(inTime),
            outTime: formatTime(outTime),
            breakTime: (() => {
                if (status !== 'P' && status !== 'D') return '00:00';
                const dayBreaks = breaks?.filter((b: any) => b.date === formattedDate) || [];
                const actualBreakMins = dayBreaks.reduce((sum: number, b: any) => sum + (b.durationMinutes || 0), 0);
                return formatDuration(actualBreakMins);
            })(),
            actualDuty: actualDutyMinutes > 0 ? formatDuration(actualDutyMinutes) : '-',
            extraLess: actualDutyMinutes > 0 ? formatDuration(extraLessMinutes) : '-',
            remarks
        };
    });

    const expectedTotalHours = presentCount * expectedDutyHour;

    return (
        <div ref={printContainerRef} className="bg-white font-sans text-gray-800 p-8" style={{ width: '210mm', minHeight: '297mm', margin: 'auto' }}>
            <header className="flex justify-between items-center mb-4">
                <div>
                    {companyProfile?.companyLogoUrl && <Image src={companyProfile.invoiceLogoUrl || ''} alt="Company Logo" width={199} height={52} className="object-contain" data-ai-hint="company logo" />}
                </div>
                <div className="text-right">
                    <h1 className="text-xl font-bold">{companyProfile?.companyName || 'SMART SOLUTION'}</h1>
                    <p className="text-xs whitespace-pre-line">{companyProfile?.address || 'LIVING CRYSTAL, HOUSE#50/A, 1ST FLOOR (B-1), ROAD#10, SECTOR#10, UTTARA, DHAKA-1230'}</p>
                </div>
            </header>
            <h2 className="text-center text-lg font-bold mb-4 underline">General Employee Job Card Report ({formatDisplayDate(dateRange.from)} To {formatDisplayDate(dateRange.to)})</h2>

            <Table className="mb-4 text-xs border">
                <TableBody>
                    <TableRow><TableCell className="font-semibold border p-1">Employee Code</TableCell><TableCell className="border p-1">{employee?.employeeCode}</TableCell><TableCell className="font-semibold border p-1">Designation</TableCell><TableCell className="border p-1">{employee?.designation}</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold border p-1">Employee Name</TableCell><TableCell className="border p-1">{employee?.fullName}</TableCell><TableCell className="font-semibold border p-1">Branch</TableCell><TableCell className="border p-1">{employee?.branch || 'Not Defined'}</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold border p-1">Join Date</TableCell><TableCell className="border p-1">{formatDisplayDate(employee?.joinedDate)}</TableCell><TableCell className="font-semibold border p-1">Division</TableCell><TableCell className="border p-1">{employee?.division || 'Not Defined'}</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold border p-1">Job Status</TableCell><TableCell className="border p-1">{employee?.status}</TableCell><TableCell className="font-semibold border p-1">Department</TableCell><TableCell className="border p-1">{employee?.department || 'Not Defined'}</TableCell></TableRow>
                </TableBody>
            </Table>

            <Table className="text-xs border">
                <TableHeader><TableRow>
                    <TableHead className="p-1 border">Attendance Date</TableHead><TableHead className="p-1 border">Flag</TableHead><TableHead className="p-1 border">Expected Duty (Hour)</TableHead><TableHead className="p-1 border">In Time</TableHead><TableHead className="p-1 border">Out Time</TableHead><TableHead className="p-1 border">Break Time (Hour)</TableHead><TableHead className="p-1 border">Actual Duty (Hour)</TableHead><TableHead className="p-1 border">Extra/Less Duty (Hour)</TableHead><TableHead className="p-1 border">Remarks</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {tableRows.map(row => (
                        <TableRow key={row.date}><TableCell className="p-1 border">{row.date}</TableCell><TableCell className="p-1 border">{row.status}</TableCell><TableCell className="p-1 border">{row.expectedDuty}</TableCell><TableCell className="p-1 border">{row.inTime}</TableCell><TableCell className="p-1 border">{row.outTime}</TableCell><TableCell className="p-1 border">{row.breakTime}</TableCell><TableCell className="p-1 border">{row.actualDuty}</TableCell><TableCell className="p-1 border">{row.extraLess}</TableCell><TableCell className="p-1 border">{row.remarks}</TableCell></TableRow>
                    ))}
                </TableBody>
            </Table>

            <Table className="mt-4 text-xs border">
                <TableBody>
                    <TableRow><TableCell className="font-semibold p-1 border">Present</TableCell><TableCell className="p-1 border">{presentCount}</TableCell><TableCell className="font-semibold p-1 border">Absent</TableCell><TableCell className="p-1 border">{absentCount}</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold p-1 border">Delay</TableCell><TableCell className="p-1 border">{delayCount}</TableCell><TableCell className="font-semibold p-1 border">Extra Delay</TableCell><TableCell className="p-1 border">0</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold p-1 border">Leave</TableCell><TableCell className="p-1 border">{leaveCount}</TableCell><TableCell className="font-semibold p-1 border">Visit</TableCell><TableCell className="p-1 border">0</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold p-1 border">Weekend</TableCell><TableCell className="p-1 border">{weekendCount}</TableCell><TableCell className="font-semibold p-1 border">Holiday</TableCell><TableCell className="p-1 border">{holidayCount}</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold p-1 border">Expected Duty Hour</TableCell><TableCell className="p-1 border">{formatDuration(expectedTotalHours * 60)}</TableCell><TableCell className="font-semibold p-1 border">Actual Duty Hour</TableCell><TableCell className="p-1 border">{formatDuration(totalActualDutyMinutes)}</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold p-1 border">Total Days (Available in office)</TableCell><TableCell className="p-1 border">{days.length} ({presentCount})</TableCell><TableCell className="font-semibold p-1 border">Extra/Less Duty Hours</TableCell><TableCell className="p-1 border">{formatDuration(totalActualDutyMinutes - (expectedTotalHours * 60))}</TableCell></TableRow>
                </TableBody>
            </Table>

            <footer className="mt-8 pt-2 text-xs text-gray-500">
                <p>Printed On: {format(new Date(), 'dd-MM-yyyy hh:mm a')}</p>
                <div className="flex justify-end mt-2">Page 1 of 1</div>
            </footer>
            <div className="text-center mt-6 noprint flex justify-center gap-4">
                <Button onClick={handleDownloadPdf}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
                <Button onClick={() => window.print()} variant="outline"><Printer className="mr-2 h-4 w-4" />Print</Button>
            </div>
        </div>
    );
}

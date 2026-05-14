"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Printer, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { CompanyProfile, EmployeeDocument } from '@/types';
import type { MultipleCheckInOutRecord } from '@/types/checkInOut';
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

const formatTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'hh:mm a') : 'Invalid Time';
    } catch (e) {
        return 'N/A';
    }
};

interface ReportData {
    employees: EmployeeDocument[];
    records: MultipleCheckInOutRecord[];
    dateRange: {
        from: string;
        to: string;
    };
    isAllEmployees: boolean;
}

const ReportContent = ({ data, companyProfile }: { data: ReportData, companyProfile: CompanyProfile | null }) => {
    const { employees, records, dateRange } = data;

    const getEmployeeRecords = (employeeId: string) => {
        const empRecords = records.filter(r => r.employeeId === employeeId);
        const checkIns = empRecords.filter(r => r.type === 'Check In').sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const checkOuts = empRecords.filter(r => r.type === 'Check Out');
        
        return checkIns.map(checkIn => {
            const matchingCheckOut = checkOuts.find(checkOut => 
                checkOut.companyName === checkIn.companyName &&
                new Date(checkOut.timestamp).getTime() > new Date(checkIn.timestamp).getTime()
            );

            let duration = '-';
            if (matchingCheckOut) {
                const diffMs = new Date(matchingCheckOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                if (diffHours > 0) {
                    duration = `${diffHours}h ${diffMinutes}m`;
                } else {
                    duration = `${diffMinutes}m`;
                }
            }

            return {
                date: formatDisplayDate(checkIn.timestamp),
                companyName: checkIn.companyName,
                checkInTime: formatTime(checkIn.timestamp),
                checkInLocation: checkIn.location.address || `${checkIn.location.latitude.toFixed(4)}, ${checkIn.location.longitude.toFixed(4)}`,
                checkOutTime: matchingCheckOut ? formatTime(matchingCheckOut.timestamp) : '-',
                checkOutLocation: matchingCheckOut ? (matchingCheckOut.location.address || `${matchingCheckOut.location.latitude.toFixed(4)}, ${matchingCheckOut.location.longitude.toFixed(4)}`) : '-',
                duration: duration
            };
        });
    };

    const pairedRecordsMap = new Map<string, ReturnType<typeof getEmployeeRecords>>();
    
    employees.forEach(employee => {
        const empRecords = getEmployeeRecords(employee.id);
        if (empRecords.length > 0 || data.isAllEmployees) {
            pairedRecordsMap.set(employee.id, empRecords);
        }
    });

    if (pairedRecordsMap.size === 0) {
        return <div className="text-center p-8 bg-white w-[210mm] mx-auto min-h-[297mm]">No data found.</div>;
    }

    return (
        <div className="flex justify-center bg-gray-100 print:bg-transparent py-8 print:p-0">
            <div id="pdf-content-wrapper" className="bg-white font-sans text-gray-800 px-8 pt-8 w-[210mm] shadow-2xl print:shadow-none box-border" style={{ paddingBottom: '20px' }}>
                <header className="flex justify-between items-center mb-6 pb-4 border-b-2 border-gray-200" id="report-header">
                    <div>
                        {companyProfile?.companyLogoUrl && <Image src={companyProfile.invoiceLogoUrl || companyProfile.companyLogoUrl} alt="Company Logo" width={199} height={52} className="object-contain" data-ai-hint="company logo" />}
                    </div>
                    <div className="text-right">
                        <h1 className="text-xl font-bold text-gray-800">{companyProfile?.companyName || 'SMART SOLUTION'}</h1>
                        <p className="text-xs text-gray-600 whitespace-pre-line mt-1">{companyProfile?.address || 'LIVING CRYSTAL, HOUSE#50/A, 1ST FLOOR (B-1), ROAD#10, SECTOR#10, UTTARA, DHAKA-1230'}</p>
                    </div>
                </header>

                <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-1">Multiple Check In/Out Report</h2>
                    <p className="text-sm text-gray-600 font-medium">Date Period: {formatDisplayDate(dateRange?.from)} to {formatDisplayDate(dateRange?.to)}</p>
                </div>

                <div className="flex flex-col gap-8">
                    {Array.from(pairedRecordsMap.entries()).map(([employeeId, records]) => {
                        const employee = employees.find(e => e.id === employeeId)!;
                        return (
                            <div key={employeeId} className="flex flex-col gap-3 avoid-page-break-inside">
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <h3 className="font-bold text-gray-800 text-lg mb-2 border-b border-gray-200 pb-2">{employee.fullName}</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                        <p className="leading-none"><span className="font-semibold text-gray-700">Staff ID:</span> {employee.employeeCode}</p>
                                        <p className="leading-none"><span className="font-semibold text-gray-700">Designation:</span> {employee.designation}</p>
                                        <p className="leading-none"><span className="font-semibold text-gray-700">Department:</span> {employee.department || 'N/A'}</p>
                                        <p className="leading-none"><span className="font-semibold text-gray-700">Branch:</span> {employee.branch || 'N/A'}</p>
                                    </div>
                                </div>

                                {records.length > 0 ? (
                                    <div className="rounded-lg border border-gray-200 shadow-sm">
                                        <Table className="text-xs w-full">
                                            <TableHeader className="bg-gray-100">
                                                <TableRow>
                                                    <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2 align-middle">Date</TableHead>
                                                    <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2 align-middle">Company Visit</TableHead>
                                                    <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2 align-middle">Check In</TableHead>
                                                    <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2 w-[20%] align-middle">In Location</TableHead>
                                                    <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2 align-middle">Check Out</TableHead>
                                                    <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2 w-[20%] align-middle">Out Location</TableHead>
                                                    <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2 align-middle">Duration</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {records.map((row, idx) => (
                                                    <TableRow key={idx} className="hover:bg-gray-50 transition-colors align-top avoid-page-break-inside">
                                                        <TableCell className="p-2 border-b border-gray-100 align-top">{row.date}</TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 font-medium align-top">{row.companyName}</TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 text-green-600 font-medium align-top">{row.checkInTime}</TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 align-top whitespace-normal break-words" title={row.checkInLocation}>{row.checkInLocation}</TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 text-red-600 font-medium align-top">{row.checkOutTime}</TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 align-top whitespace-normal break-words" title={row.checkOutLocation}>{row.checkOutLocation}</TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 font-semibold align-top">{row.duration}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200 border-dashed text-gray-500 italic avoid-page-break-inside">
                                        No check in/out records found for this period.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default function PrintMultipleCheckInOutReportPage() {
    const router = useRouter();
    const printContainerRef = React.useRef<HTMLDivElement>(null);
    const [reportData, setReportData] = React.useState<ReportData | null>(null);
    const [companyProfile, setCompanyProfile] = React.useState<CompanyProfile | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const dataString = localStorage.getItem('multiCheckInOutReportData');
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
        const input = document.getElementById('pdf-content-wrapper');
        if (!input) {
            Swal.fire("Error", "Could not find the content to download.", "error");
            return;
        }

        const utilityButtons = document.querySelector('.noprint') as HTMLElement;
        if (utilityButtons) utilityButtons.style.display = 'none';

        try {
            // @ts-ignore - html2pdf doesn't have good TS definitions by default when loaded dynamically
            const html2pdf = (await import('html2pdf.js')).default;

            const opt = {
                margin: [0, 0, 15, 0] as [number, number, number, number], // top, left, bottom, right in mm (15mm bottom margin for footer)
                filename: `Multiple_Check_In_Out_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
                image: { type: 'jpeg' as const, quality: 1.0 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } as const,
                pagebreak: { mode: ['css', 'legacy'], avoid: '.avoid-page-break-inside' }
            };

            const worker = html2pdf().set(opt).from(input);

            worker.toPdf().get('pdf').then((pdf: any) => {
                const totalPages = pdf.internal.getNumberOfPages();
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                
                for (let i = 1; i <= totalPages; i++) {
                    pdf.setPage(i);
                    
                    // Add Footer Line
                    pdf.setDrawColor(229, 231, 235); // gray-200
                    pdf.setLineWidth(0.5);
                    pdf.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
                    
                    // Add Footer Text
                    pdf.setFontSize(8);
                    pdf.setTextColor(107, 114, 128); // gray-500
                    pdf.text(`Generated by HR System on ${format(new Date(), 'dd-MM-yyyy hh:mm a')}`, 10, pageHeight - 8);
                    
                    const pageText = `Page ${i} of ${totalPages} ${i === totalPages ? ' *** End of Report ***' : ''}`;
                    const textWidth = pdf.getStringUnitWidth(pageText) * pdf.internal.getFontSize() / pdf.internal.scaleFactor;
                    pdf.text(pageText, pageWidth - 10 - textWidth, pageHeight - 8);
                }
            }).save().then(() => {
                if (utilityButtons) utilityButtons.style.display = 'flex';
                Swal.fire({
                    icon: 'success',
                    title: 'Downloaded!',
                    text: 'The PDF has been successfully generated.',
                    timer: 1500,
                    showConfirmButton: false
                });
            });

        } catch (err) {
            console.error('PDF Generation Error:', err);
            Swal.fire("Error", "Failed to generate PDF. Please try again.", "error");
            if (utilityButtons) utilityButtons.style.display = 'flex';
        }
    };


    if (isLoading) {
        return <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="mt-4 font-medium text-gray-600">Loading Report Data...</p></div>;
    }
    if (error) {
        return <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50"><AlertTriangle className="h-16 w-16 text-red-500 mb-4" /><p className="font-semibold text-lg text-red-600 mb-6">{error}</p><Button onClick={() => window.close()} className="shadow-md">Close Tab</Button></div>;
    }
    if (!reportData) {
        return <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50"><p className="text-lg text-gray-600">No data found.</p></div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
            <style jsx global>{`
                @media print {
                    @page { margin: 0.5cm; }
                    body { margin: 0; background-color: white; }
                    .noprint { display: none !important; }
                    .print-container { width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
                    .page-break-inside-avoid { page-break-inside: avoid; }
                }
            `}</style>

            <div ref={printContainerRef} className="print-container shadow-2xl bg-white w-[210mm] mx-auto print:shadow-none">
                <ReportContent data={reportData} companyProfile={companyProfile} />
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200 p-4 text-center noprint flex justify-center gap-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <Button onClick={handleDownloadPdf} className="bg-primary hover:bg-primary/90 text-white shadow-md"><Download className="mr-2 h-4 w-4" />Download PDF</Button>
                <Button onClick={() => window.print()} variant="outline" className="shadow-md border-primary text-primary hover:bg-primary/10"><Printer className="mr-2 h-4 w-4" />Print Report</Button>
            </div>
        </div>
    );
}

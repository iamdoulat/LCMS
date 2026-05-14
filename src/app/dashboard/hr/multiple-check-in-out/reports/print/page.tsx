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

    // Group records by employee and company to find Check In and Check Out pairs
    const getEmployeeRecords = (employeeId: string) => {
        const empRecords = records.filter(r => r.employeeId === employeeId);
        
        const checkIns = empRecords.filter(r => r.type === 'Check In').sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const checkOuts = empRecords.filter(r => r.type === 'Check Out');
        
        const pairedRecords = checkIns.map(checkIn => {
            const matchingCheckOut = checkOuts.find(checkOut => 
                checkOut.companyName === checkIn.companyName &&
                new Date(checkOut.timestamp) > new Date(checkIn.timestamp) &&
                new Date(checkOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime() < 24 * 60 * 60 * 1000
            );

            let duration = '-';
            if (matchingCheckOut) {
                const diffMs = new Date(matchingCheckOut.timestamp).getTime() - new Date(checkIn.timestamp).getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            }

            return {
                companyName: checkIn.companyName,
                date: formatDisplayDate(checkIn.timestamp),
                checkInTime: formatTime(checkIn.timestamp),
                checkInLocation: checkIn.location.address || `${checkIn.location.latitude.toFixed(4)}, ${checkIn.location.longitude.toFixed(4)}`,
                checkOutTime: matchingCheckOut ? formatTime(matchingCheckOut.timestamp) : 'Not Checked Out',
                checkOutLocation: matchingCheckOut ? (matchingCheckOut.location.address || `${matchingCheckOut.location.latitude.toFixed(4)}, ${matchingCheckOut.location.longitude.toFixed(4)}`) : '-',
                duration: duration
            };
        });

        return pairedRecords;
    };

    // Pagination Logic
    const ROWS_PER_FIRST_PAGE = 12;
    const ROWS_PER_SUBSEQUENT_PAGE = 20;
    const EMPLOYEE_HEADER_COST = 4;

    type PairedRecord = ReturnType<typeof getEmployeeRecords>[0];
    type PageContent = { employee: EmployeeDocument; records: PairedRecord[] };
    type PageData = { isFirstPage: boolean; content: PageContent[] };

    const pages: PageData[] = [];
    let currentPage: PageData = { isFirstPage: true, content: [] };
    let currentRemainingCapacity = ROWS_PER_FIRST_PAGE;

    employees.forEach((employee) => {
        const empRecords = getEmployeeRecords(employee.id);
        if (empRecords.length === 0 && data.isAllEmployees) return;

        let remainingRecords = [...empRecords];

        while (remainingRecords.length > 0 || (empRecords.length === 0 && !data.isAllEmployees)) {
            if (empRecords.length === 0) {
                if (currentRemainingCapacity < EMPLOYEE_HEADER_COST + 2) {
                    pages.push(currentPage);
                    currentPage = { isFirstPage: false, content: [] };
                    currentRemainingCapacity = ROWS_PER_SUBSEQUENT_PAGE;
                }
                currentPage.content.push({ employee, records: [] });
                currentRemainingCapacity -= (EMPLOYEE_HEADER_COST + 2);
                break;
            }

            if (currentRemainingCapacity <= EMPLOYEE_HEADER_COST) {
                pages.push(currentPage);
                currentPage = { isFirstPage: false, content: [] };
                currentRemainingCapacity = ROWS_PER_SUBSEQUENT_PAGE;
            }

            currentPage.content.push({ employee, records: [] });
            currentRemainingCapacity -= EMPLOYEE_HEADER_COST;

            const currentEmployeeContent = currentPage.content[currentPage.content.length - 1];
            const chunk = remainingRecords.splice(0, currentRemainingCapacity);
            currentEmployeeContent.records.push(...chunk);
            currentRemainingCapacity -= chunk.length;

            if (remainingRecords.length > 0) {
                pages.push(currentPage);
                currentPage = { isFirstPage: false, content: [] };
                currentRemainingCapacity = ROWS_PER_SUBSEQUENT_PAGE;
            }
        }
    });

    if (currentPage.content.length > 0) {
        pages.push(currentPage);
    }

    if (pages.length === 0) {
        return <div className="text-center p-8 bg-white w-[210mm] mx-auto min-h-[297mm]">No data found.</div>;
    }

    return (
        <div className="flex flex-col items-center gap-8 bg-gray-100 print:bg-transparent print:gap-0">
            {pages.map((page, pageIndex) => (
                <div key={pageIndex} className="a4-page-wrapper bg-white font-sans text-gray-800 p-8 w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none mx-auto relative box-border" style={{ pageBreakAfter: pageIndex < pages.length - 1 ? 'always' : 'auto' }}>
                    {page.isFirstPage && (
                        <>
                            <header className="flex justify-between items-center mb-4 pb-2 border-b-2 border-gray-200">
                                <div>
                                    {companyProfile?.companyLogoUrl && <Image src={companyProfile.invoiceLogoUrl || companyProfile.companyLogoUrl} alt="Company Logo" width={199} height={52} className="object-contain" data-ai-hint="company logo" />}
                                </div>
                                <div className="text-right">
                                    <h1 className="text-xl font-bold text-gray-800">{companyProfile?.companyName || 'SMART SOLUTION'}</h1>
                                    <p className="text-xs text-gray-600 whitespace-pre-line mt-1">{companyProfile?.address || 'LIVING CRYSTAL, HOUSE#50/A, 1ST FLOOR (B-1), ROAD#10, SECTOR#10, UTTARA, DHAKA-1230'}</p>
                                </div>
                            </header>
                            
                            <div className="text-center mb-4">
                                <h2 className="text-2xl font-bold uppercase tracking-wider text-gray-800">Multiple Check In/Out Report</h2>
                                <p className="text-sm font-medium text-gray-600 mt-2 bg-gray-100 inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-gray-200 leading-none h-8">
                                    Period: {formatDisplayDate(dateRange.from)} To {formatDisplayDate(dateRange.to)}
                                </p>
                            </div>
                        </>
                    )}

                    {page.content.map((empContent, index) => {
                        const { employee, records: employeePairedRecords } = empContent;

                        return (
                            <div key={`${employee.id}-${index}`} className="mb-6">
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 shadow-sm flex flex-col justify-center">
                                    <h3 className="font-bold text-lg text-primary mb-1 flex items-center gap-2 leading-none">
                                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                                        {employee.fullName} <span className="text-gray-500 font-normal text-sm">({employee.employeeCode})</span>
                                        {pageIndex > 0 && index === 0 && <span className="text-xs italic font-normal text-gray-400 ml-2">(Continued)</span>}
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 items-center mt-1">
                                        <p className="leading-none"><span className="font-semibold text-gray-700">Designation:</span> {employee.designation}</p>
                                        <p className="leading-none"><span className="font-semibold text-gray-700">Department:</span> {employee.department || 'N/A'}</p>
                                        <p className="leading-none"><span className="font-semibold text-gray-700">Branch:</span> {employee.branch || 'N/A'}</p>
                                    </div>
                                </div>

                                {employeePairedRecords.length > 0 ? (
                                    <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
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
                                                {employeePairedRecords.map((row, idx) => (
                                                    <TableRow key={idx} className="hover:bg-gray-50 transition-colors align-top">
                                                        <TableCell className="p-2 border-b border-gray-100 align-top pt-2">{row.date}</TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 font-medium align-top pt-2">{row.companyName}</TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 text-green-600 font-medium align-top pt-2">{row.checkInTime}</TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 align-top pt-2"><div className="whitespace-normal break-words leading-relaxed" title={row.checkInLocation}>{row.checkInLocation}</div></TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 text-red-600 font-medium align-top pt-2">{row.checkOutTime}</TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 align-top pt-2"><div className="whitespace-normal break-words leading-relaxed" title={row.checkOutLocation}>{row.checkOutLocation}</div></TableCell>
                                                        <TableCell className="p-2 border-b border-gray-100 font-semibold align-top pt-2">{row.duration}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200 border-dashed text-gray-500 italic">
                                        No check in/out records found for this period.
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <footer className="absolute bottom-8 left-8 right-8 pt-4 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center bg-white">
                        <p>Generated by HR System on {format(new Date(), 'dd-MM-yyyy hh:mm a')}</p>
                        <p className="font-medium">Page {pageIndex + 1} of {pages.length} {pageIndex === pages.length - 1 ? ' *** End of Report ***' : ''}</p>
                    </footer>
                </div>
            ))}
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
        const input = printContainerRef.current;
        if (!input) {
            Swal.fire("Error", "Could not find the content to download.", "error");
            return;
        }

        const utilityButtons = input.querySelector('.noprint') as HTMLElement;
        if (utilityButtons) utilityButtons.style.display = 'none';

        try {
            const pages = input.querySelectorAll('.a4-page-wrapper');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            for (let i = 0; i < pages.length; i++) {
                const pageElement = pages[i] as HTMLElement;
                const canvas = await html2canvas(pageElement, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                
                if (i > 0) {
                    pdf.addPage();
                }
                
                // Scale image to fit the width of A4
                const imgRatio = canvas.height / canvas.width;
                const imgHeight = pdfWidth * imgRatio;
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            }

            const fileName = `Multiple_Check_In_Out_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error("Error generating PDF:", error);
            Swal.fire("Error", "An error occurred while generating the PDF.", "error");
        } finally {
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

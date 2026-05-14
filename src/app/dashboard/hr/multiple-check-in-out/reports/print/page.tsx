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

    return (
        <div className="bg-white font-sans text-gray-800 p-8 w-[210mm] min-h-[297mm] mx-auto">
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
                <p className="text-sm font-medium text-gray-600 mt-2 bg-gray-100 inline-block px-4 py-1 rounded-full border border-gray-200">
                    Period: {formatDisplayDate(dateRange.from)} To {formatDisplayDate(dateRange.to)}
                </p>
            </div>

            {employees.map((employee, index) => {
                const employeePairedRecords = getEmployeeRecords(employee.id);
                
                // Only render if there are records for this employee or if a single employee was explicitly selected
                if (employeePairedRecords.length === 0 && data.isAllEmployees) return null;

                return (
                    <div key={employee.id} className="mb-10 page-break-inside-avoid">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
                            <h3 className="font-bold text-lg text-primary mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-primary rounded-full"></span>
                                {employee.fullName} <span className="text-gray-500 font-normal text-sm">({employee.employeeCode})</span>
                            </h3>
                            <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                                <p><span className="font-semibold text-gray-700">Designation:</span> {employee.designation}</p>
                                <p><span className="font-semibold text-gray-700">Department:</span> {employee.department || 'N/A'}</p>
                                <p><span className="font-semibold text-gray-700">Branch:</span> {employee.branch || 'N/A'}</p>
                            </div>
                        </div>

                        {employeePairedRecords.length > 0 ? (
                            <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                                <Table className="text-xs w-full">
                                    <TableHeader className="bg-gray-100">
                                        <TableRow>
                                            <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2">Date</TableHead>
                                            <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2">Company Visit</TableHead>
                                            <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2">Check In</TableHead>
                                            <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2 w-[20%]">In Location</TableHead>
                                            <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2">Check Out</TableHead>
                                            <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2 w-[20%]">Out Location</TableHead>
                                            <TableHead className="font-bold text-gray-700 border-b border-gray-200 p-2">Duration</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {employeePairedRecords.map((row, idx) => (
                                            <TableRow key={idx} className="hover:bg-gray-50 transition-colors align-top">
                                                <TableCell className="p-2 border-b border-gray-100 pt-3">{row.date}</TableCell>
                                                <TableCell className="p-2 border-b border-gray-100 font-medium pt-3">{row.companyName}</TableCell>
                                                <TableCell className="p-2 border-b border-gray-100 text-green-600 font-medium pt-3">{row.checkInTime}</TableCell>
                                                <TableCell className="p-2 border-b border-gray-100 pt-3"><div className="whitespace-normal break-words leading-relaxed" title={row.checkInLocation}>{row.checkInLocation}</div></TableCell>
                                                <TableCell className="p-2 border-b border-gray-100 text-red-600 font-medium pt-3">{row.checkOutTime}</TableCell>
                                                <TableCell className="p-2 border-b border-gray-100 pt-3"><div className="whitespace-normal break-words leading-relaxed" title={row.checkOutLocation}>{row.checkOutLocation}</div></TableCell>
                                                <TableCell className="p-2 border-b border-gray-100 font-semibold pt-3">{row.duration}</TableCell>
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
                        {index < employees.length - 1 && data.isAllEmployees && employeePairedRecords.length > 0 && <div className="mt-8 border-b-2 border-dashed border-gray-300"></div>}
                    </div>
                );
            })}

            <footer className="mt-12 pt-4 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
                <p>Generated by HR System on {format(new Date(), 'dd-MM-yyyy hh:mm a')}</p>
                <p className="font-medium">*** End of Report ***</p>
            </footer>
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

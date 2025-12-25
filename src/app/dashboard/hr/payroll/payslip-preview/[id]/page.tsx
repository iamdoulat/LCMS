"use client";

import * as React from 'react';

import { Loader2, Printer, AlertTriangle, Download } from 'lucide-react';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { Payslip, EmployeeDocument, SalaryBreakup } from '@/types';
import { Button } from '@/components/ui/button';

import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { format, parseISO } from 'date-fns';
import { useParams } from 'next/navigation';


const formatCurrency = (value?: number, showSign: boolean = false) => {
    if (typeof value !== 'number' || isNaN(value)) return '-';
    const formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (showSign && value > 0) return `+${formatted}`;
    return formatted;
};

const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), 'dd-MM-yyyy');
    } catch {
        return 'N/A';
    }
};

export default function PayslipPreviewPage() {
    const authContext = useAuth();
    const companyName = authContext?.companyName || 'Company Name';
    const address = (authContext as any)?.address || 'Company Address';
    const companyLogoUrl = authContext?.companyLogoUrl || '';

    const printContainerRef = React.useRef<HTMLDivElement>(null);
    const params = useParams();
    const id = params.id as string;

    const [payslip, setPayslip] = React.useState<Payslip | null>(null);
    const [employee, setEmployee] = React.useState<EmployeeDocument | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);


    React.useEffect(() => {
        if (!id) {
            setError("No Payslip ID provided.");
            setIsLoading(false);
            return;
        }

        const fetchPayslipAndEmployee = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const payslipDocRef = doc(firestore, 'payslips', id);
                const payslipSnap = await getDoc(payslipDocRef);

                if (!payslipSnap.exists()) {
                    throw new Error("Payslip not found.");
                }

                const payslipData = { id: payslipSnap.id, ...payslipSnap.data() } as Payslip;
                setPayslip(payslipData);

                if (payslipData.employeeId) {
                    const employeeDocRef = doc(firestore, 'employees', payslipData.employeeId);
                    const employeeSnap = await getDoc(employeeDocRef);
                    if (employeeSnap.exists()) {
                        setEmployee({ id: employeeSnap.id, ...employeeSnap.data() } as EmployeeDocument);
                    } else {
                        console.warn(`Employee not found for ID: ${payslipData.employeeId}`);
                    }
                }
            } catch (err: any) {
                setError(err.message);
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPayslipAndEmployee();
    }, [id]);


    const handleDownloadPdf = async () => {
        const input = printContainerRef.current;
        if (!input) {
            Swal.fire("Error", "Could not find the content to download.", "error");
            return;
        }

        const utilityButtons = input.querySelector('.noprint') as HTMLElement;
        if (utilityButtons) utilityButtons.style.display = 'none';

        try {
            const canvas = await html2canvas(input, { scale: 3, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 0;

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save(`Payslip_${payslip?.employeeName}_${payslip?.payPeriod}.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            Swal.fire("Error", "An error occurred while generating the PDF.", "error");
        } finally {
            if (utilityButtons) utilityButtons.style.display = 'flex';
        }
    };

    if (isLoading) {
        return <div className="container mx-auto py-8 flex justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
    }

    if (error || !payslip) {
        return (
            <div className="container mx-auto py-8">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error Loading Payslip</AlertTitle>
                    <AlertDescription>{error || "The requested payslip could not be found."}</AlertDescription>
                </Alert>
            </div>
        )
    }

    const deductions = [
        { name: 'Absent Deduction', value: payslip.absentDeduction },
        { name: 'Break Deduction', value: payslip.breakDeduction },
        { name: 'Advance Deduction', value: payslip.advanceDeduction },
        { name: 'Tax Deduction', value: payslip.taxDeduction },
        { name: 'Provident Fund', value: payslip.providentFund },
    ].filter(d => typeof d.value === 'number' && d.value > 0);

    const earnings: SalaryBreakup[] = payslip.salaryBreakup || [
        { breakupName: 'Basic', amount: (payslip as any).basicSalary || 0 },
        { breakupName: 'House Rent', amount: (payslip as any).houseRent || 0 },
        { breakupName: 'Medical Allowance', amount: (payslip as any).medicalAllowance || 0 },
    ].filter(e => typeof e.amount === 'number' && e.amount > 0);

    const totalEarnings = payslip.grossSalary || 0;
    const totalDeductions = payslip.totalDeductions || 0;
    const netSalary = payslip.netSalary || 0;

    return (
        <div className="a4-page">
            <div ref={printContainerRef} className="bg-white font-sans text-gray-800 p-8 shadow-lg print:shadow-none print:border-none print:p-0">
                <header className="flex justify-between items-center pb-4 border-b-2">
                    <div className="flex items-center gap-4">
                        {companyLogoUrl && <Image src={companyLogoUrl} alt="Company Logo" width={100} height={100} className="object-contain h-16 w-auto" data-ai-hint="company logo" />}
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">{companyName}</h1>
                            <p className="text-xs text-gray-500 max-w-xs whitespace-pre-line">{address}</p>
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-700">Payslip for the month of {payslip.payPeriod}</h2>
                </header>

                <section className="mt-6 border-b pb-4">
                    <div className="grid grid-cols-4 gap-x-8 gap-y-2 text-sm">
                        <div className="font-semibold text-gray-600">Employee Name</div>
                        <div className="col-span-1">{employee?.fullName || payslip.employeeName}</div>
                        <div className="font-semibold text-gray-600">Employee Code</div>
                        <div>{employee?.employeeCode || payslip.employeeCode}</div>

                        <div className="font-semibold text-gray-600">Designation</div>
                        <div className="col-span-1">{employee?.designation || payslip.designation}</div>
                        <div className="font-semibold text-gray-600">Join Date</div>
                        <div>{formatDisplayDate(employee?.joinedDate)}</div>

                        <div className="font-semibold text-gray-600">Branch</div>
                        <div className="col-span-1">{employee?.branch}</div>
                        <div className="font-semibold text-gray-600">Department</div>
                        <div>{employee?.department}</div>

                        <div className="font-semibold text-gray-600">Func Designation</div>
                        <div className="col-span-1">{employee?.designation}</div>
                        <div className="font-semibold text-gray-600">Salary Group</div>
                        <div>{employee?.jobBase || 'N/A'}</div>
                    </div>
                </section>

                <section className="mt-6">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b-2">
                                <th className="text-left py-2 font-semibold">Particulars</th>
                                <th className="text-right py-2 font-semibold pr-4">Amount(+)</th>
                                <th className="text-right py-2 font-semibold">Amount(-)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="py-2 font-semibold text-gray-700" colSpan={3}>Salary Breakups</td>
                            </tr>
                            {earnings.map((item, index) => (
                                <tr key={index} className="border-b">
                                    <td className="py-1 pl-4">{item.breakupName}</td>
                                    <td className="text-right pr-4">{formatCurrency(item.amount)}</td>
                                    <td>-</td>
                                </tr>
                            ))}
                            <tr>
                                <td className="py-2 font-semibold text-gray-700" colSpan={3}>Deductions</td>
                            </tr>
                            {deductions.map((item, index) => (
                                <tr key={index} className="border-b">
                                    <td className="py-1 pl-4">{item.name}</td>
                                    <td className="text-right pr-4">-</td>
                                    <td className="text-right">{formatCurrency(item.value)}</td>
                                </tr>
                            ))}
                            <tr className="font-semibold border-t-2">
                                <td className="text-right py-2">Sub Total</td>
                                <td className="text-right pr-4 py-2">{formatCurrency(totalEarnings)}</td>
                                <td className="text-right py-2">{formatCurrency(totalDeductions)}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section className="mt-8">
                    <h3 className="font-bold text-center text-lg mb-2">Salary Summary</h3>
                    <table className="w-full text-sm border-2">
                        <thead>
                            <tr className="border-b-2 bg-gray-100">
                                <th className="text-center py-2 font-semibold">Total</th>
                                <th className="text-center py-2 font-semibold">Earnings (b)</th>
                                <th className="text-center py-2 font-semibold">Deductions (b)</th>
                                <th className="text-center py-2 font-semibold">Net Salary (b)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="font-bold">
                                <td className="text-center py-2"></td>
                                <td className="text-center py-2">{formatCurrency(totalEarnings)}</td>
                                <td className="text-center py-2">{formatCurrency(totalDeductions)}</td>
                                <td className="text-center py-2">{formatCurrency(netSalary)}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <footer className="mt-32 pt-4 text-xs text-gray-500">
                    <p className="text-center">N.B: This is a system generated document</p>
                    <div className="flex justify-between mt-2">
                        <p>Printed on {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
                        <p>Page 1 of 1</p>
                    </div>
                </footer>
            </div>
            <div className="text-center mt-6 noprint flex justify-center gap-4">
                <Button onClick={handleDownloadPdf}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
                <Button onClick={() => window.print()} variant="outline"><Printer className="mr-2 h-4 w-4" />Print</Button>
            </div>
        </div>
    );
}
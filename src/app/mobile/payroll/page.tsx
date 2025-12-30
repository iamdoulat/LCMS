"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { ArrowLeft, ArrowRight, Banknote, Calendar, Loader2, Download, Eye, Wallet, TrendingUp, TrendingDown, Clock, Printer, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import Image from 'next/image';

export default function MobilePayrollPage() {
    const router = useRouter();
    const { user, companyName, companyLogoUrl, address } = useAuth();
    const { currentEmployeeId } = useSupervisorCheck(user?.email);
    const [selectedSlip, setSelectedSlip] = useState<any>(null);
    const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
    const pdfRef = useRef<HTMLDivElement>(null);

    const { data: payslips, isLoading } = useFirestoreQuery<any[]>(
        currentEmployeeId ? query(
            collection(firestore, 'payslips'),
            where('employeeId', '==', currentEmployeeId),
            orderBy('createdAt', 'desc')
        ) : null,
        undefined, // transformer
        ['mobile_payslips', currentEmployeeId || ''], // queryKey
        !!currentEmployeeId // enabled
    );

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(val);
    };

    const handleDownloadPdf = async () => {
        if (!pdfRef.current || !selectedSlip) return;

        try {
            Swal.fire({
                title: 'Generating PDF...',
                didOpen: () => {
                    Swal.showLoading();
                },
                allowOutsideClick: false,
                showConfirmButton: false,
            });

            // Temporarily style for PDF generation to ensure it looks like a paper payslip
            const element = pdfRef.current;
            const originalStyle = element.style.cssText;
            // element.style.width = '210mm'; // A4 width
            // element.style.padding = '20mm';

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Payslip_${selectedSlip.employeeName}_${selectedSlip.payPeriod}.pdf`);

            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Payslip downloaded successfully.',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('PDF generation error:', error);
            Swal.fire('Error', 'Failed to generate PDF. Please try again.', 'error');
        }
    };

    if (!user) return null;

    const QuickViewContent = ({ slip }: { slip: any }) => {
        if (!slip) return null;
        const earnings = slip.salaryBreakup || [];
        const deductions = [
            { name: 'Absent', value: slip.absentDeduction },
            { name: 'Advance', value: slip.advanceDeduction },
            { name: 'Provident Fund', value: slip.providentFund },
            { name: 'Tax', value: slip.taxDeduction },
        ].filter(d => d.value > 0);

        return (
            <div className="flex flex-col h-full bg-slate-50">
                <div className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10">
                    <Button variant="ghost" size="icon" onClick={() => setIsQuickViewOpen(false)} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                    <h2 className="font-bold text-slate-800">Payslip Quick View</h2>
                    <Button variant="ghost" size="icon" onClick={handleDownloadPdf} className="rounded-full text-blue-600">
                        <Download className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
                    {/* PDF Wrapper (Hidden visually but used for capture) */}
                    <div className="hidden">
                        <div ref={pdfRef} className="bg-white p-8 text-slate-900" style={{ width: '800px' }}>
                            <div className="flex justify-between items-start mb-8 border-b-2 pb-4">
                                <div>
                                    {companyLogoUrl && <img src={companyLogoUrl} alt="Logo" className="h-16 mb-2" />}
                                    <h1 className="text-2xl font-bold">{companyName}</h1>
                                    <p className="text-sm text-slate-500 max-w-xs">{address}</p>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-xl font-bold text-slate-700">PAYSLIP</h2>
                                    <p className="text-sm font-medium">{slip.payPeriod}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Employee Details</p>
                                    <p className="font-bold text-lg">{slip.employeeName}</p>
                                    <p className="text-sm">ID: {slip.employeeCode}</p>
                                    <p className="text-sm">{slip.designation}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-12">
                                <div>
                                    <h3 className="font-bold border-b-2 mb-2 pb-1">Earnings</h3>
                                    {earnings.map((e: any, i: number) => (
                                        <div key={i} className="flex justify-between text-sm py-1">
                                            <span>{e.breakupName}</span>
                                            <span>{formatCurrency(e.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-bold border-t mt-2 pt-2">
                                        <span>Total Earnings</span>
                                        <span>{formatCurrency(slip.grossSalary)}</span>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold border-b-2 mb-2 pb-1">Deductions</h3>
                                    {deductions.map((d: any, i: number) => (
                                        <div key={i} className="flex justify-between text-sm py-1 text-red-600">
                                            <span>{d.name}</span>
                                            <span>-{formatCurrency(d.value)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-bold border-t mt-2 pt-2">
                                        <span>Total Deductions</span>
                                        <span>-{formatCurrency(slip.totalDeductions)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 bg-slate-100 p-4 rounded-lg flex justify-between items-center">
                                <span className="text-xl font-bold">Net Salary Payable</span>
                                <span className="text-2xl font-bold text-blue-700">{formatCurrency(slip.netSalary)}</span>
                            </div>

                            <div className="mt-20 flex justify-between text-center">
                                <div className="border-t w-48 pt-2 text-xs">Employee Signature</div>
                                <div className="border-t w-48 pt-2 text-xs">Authorized Signature</div>
                            </div>
                        </div>
                    </div>

                    {/* Visual UI */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                        <p className="text-blue-100 text-sm font-medium mb-1">Net Salary Payable</p>
                        <h2 className="text-3xl font-bold mb-4">{formatCurrency(slip.netSalary)}</h2>
                        <div className="flex items-center gap-3 text-sm bg-white/10 p-2 rounded-xl backdrop-blur-sm w-fit">
                            <Clock className="h-4 w-4 text-blue-200" />
                            <span>{slip.payPeriod}</span>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                            Earnings
                        </h3>
                        <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-white">
                            <div className="divide-y divide-slate-50">
                                {earnings.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center p-4">
                                        <span className="text-slate-600 font-medium">{item.breakupName}</span>
                                        <span className="text-emerald-600 font-bold">{formatCurrency(item.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center p-4 bg-emerald-50/50">
                                    <span className="font-bold text-slate-800">Total Earnings</span>
                                    <span className="font-bold text-emerald-700">{formatCurrency(slip.grossSalary)}</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-rose-500" />
                            Deductions
                        </h3>
                        <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-white">
                            {deductions.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm italic">No deductions applied</div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {deductions.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center p-4">
                                            <span className="text-slate-600 font-medium">{item.name}</span>
                                            <span className="text-rose-600 font-bold">-{formatCurrency(item.value)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center p-4 bg-rose-50/50">
                                        <span className="font-bold text-slate-800">Total Deductions</span>
                                        <span className="font-bold text-rose-700">-{formatCurrency(slip.totalDeductions)}</span>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={handleDownloadPdf} className="rounded-2xl h-12 bg-white text-slate-800 border-none shadow-sm hover:bg-slate-50">
                            <Download className="h-5 w-5 mr-2" />
                            Download
                        </Button>
                        <Button onClick={() => window.print()} variant="outline" className="rounded-2xl h-12">
                            <Printer className="h-5 w-5 mr-2" />
                            Print
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-1 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors text-white"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">My Payslips</h1>
                </div>
            </div>

            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain px-4 py-6 pb-24 shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center pt-20">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
                        <p className="text-slate-500 font-medium">Loading your payslips...</p>
                    </div>
                ) : !payslips || payslips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-32 text-slate-400">
                        <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                            <Banknote className="h-10 w-10 opacity-30" />
                        </div>
                        <p className="font-bold text-lg mb-1">No Payslips Yet</p>
                        <p className="text-sm">Your generated payslips will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {payslips.map((slip: any) => (
                            <Card
                                key={slip.id}
                                onClick={() => {
                                    setSelectedSlip(slip);
                                    setIsQuickViewOpen(true);
                                }}
                                className="p-4 rounded-3xl border-none shadow-[0_4px_12px_rgb(0,0,0,0.03)] active:scale-[0.98] transition-all bg-white flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-active:scale-90 transition-transform">
                                        <Wallet className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{slip.payPeriod}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Net Payout</span>
                                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                                            <span className="text-sm font-bold text-emerald-600">{formatCurrency(slip.netSalary)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-xl">
                                    <Eye className="h-5 w-5 text-slate-400" />
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Sheet open={isQuickViewOpen} onOpenChange={setIsQuickViewOpen}>
                <SheetContent side="bottom" className="p-0 h-[92vh] rounded-t-[2.5rem] border-none outline-none overflow-hidden">
                    <QuickViewContent slip={selectedSlip} />
                </SheetContent>
            </Sheet>
        </div>
    );
}

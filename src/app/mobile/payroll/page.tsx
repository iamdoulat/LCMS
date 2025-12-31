"use client";

import { AnimatePresence, motion, PanInfo } from 'framer-motion';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, where, orderBy, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { ArrowLeft, Banknote, Calendar, Loader2, Download, Eye, Wallet, TrendingUp, TrendingDown, Clock, Printer, X, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

export default function MobilePayrollPage() {
    const router = useRouter();
    const { user, companyName, companyLogoUrl, address } = useAuth();
    const { currentEmployeeId } = useSupervisorCheck(user?.email);

    // UI State
    const [activeTab, setActiveTab] = useState<'salary' | 'advance'>('salary');
    const [selectedSlip, setSelectedSlip] = useState<any>(null);
    const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
    const [isAdvanceRequestOpen, setIsAdvanceRequestOpen] = useState(false);
    const pdfRef = useRef<HTMLDivElement>(null);

    // Form State for Advance Salary
    const [amount, setAmount] = useState('');
    const [paymentStartsFrom, setPaymentStartsFrom] = useState('');
    const [duration, setDuration] = useState('');
    const [reason, setReason] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Queries ---

    // 1. Payslips Query
    const { data: payslips, isLoading: isLoadingPayslips, error: errorPayslips } = useFirestoreQuery<any[]>(
        currentEmployeeId ? query(
            collection(firestore, 'payslips'),
            where('employeeId', '==', currentEmployeeId),
            orderBy('createdAt', 'desc')
        ) : null,
        undefined,
        ['mobile_payslips', currentEmployeeId || 'none'],
        !!currentEmployeeId
    );

    // 2. Advance Salary Query
    const { data: advanceRequests, isLoading: isLoadingAdvances, error: errorAdvances, refetch: refetchAdvances } = useFirestoreQuery<any[]>(
        user?.uid ? query(
            collection(firestore, 'advance_salary'),
            where('employeeId', '==', user.uid),
            orderBy('applyDate', 'desc')
        ) : null,
        undefined,
        ['mobile_advance_salary', user?.uid || 'none'],
        !!user?.uid
    );

    // 3. Employee Profile Query (to get readable ID)
    const { data: employeeProfile } = useFirestoreQuery<any[]>(
        user?.uid ? query(
            collection(firestore, 'employees'),
            where('uid', '==', user.uid),
            limit(1)
        ) : null,
        undefined,
        ['mobile_employee_profile', user?.uid || 'none'],
        !!user?.uid
    );

    const formatMoney = (val: number) => {
        return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(val);
    };

    const handleDownloadPdf = async () => {
        if (!pdfRef.current || !selectedSlip) return;

        try {
            Swal.fire({
                title: 'Generating PDF...',
                didOpen: () => { Swal.showLoading(); },
                allowOutsideClick: false,
                showConfirmButton: false,
                heightAuto: false
            });

            const element = pdfRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 800,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 10;

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save(`Payslip_${selectedSlip.employeeName}_${selectedSlip.payPeriod}.pdf`);

            Swal.close();
            setTimeout(() => {
                Swal.fire({ icon: 'success', title: 'Success!', text: 'Payslip downloaded successfully.', timer: 2000, showConfirmButton: false, heightAuto: false });
            }, 100);

        } catch (error: any) {
            console.error('PDF generation error:', error);
            Swal.close();
            setTimeout(() => {
                Swal.fire({ icon: 'error', title: 'Error', text: `Failed to generate PDF: ${error.message}.`, heightAuto: false });
            }, 100);
        }
    };

    const handleAdvanceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !amount || !paymentStartsFrom || !duration || !paymentMethod) {
            Swal.fire('Error', 'Please fill in all required fields including Payment Method.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const numericAmount = parseFloat(amount);
            const numericDuration = parseInt(duration);
            const dueAmount = numericAmount; // Initially due amount is full amount

            // Get the readable employee code from the fetched profile, fallback to N/A
            const fetchedEmployeeCode = employeeProfile && employeeProfile.length > 0 ? employeeProfile[0].employeeCode : 'N/A';

            await addDoc(collection(firestore, 'advance_salary'), {
                employeeId: user.uid,
                employeeName: user.displayName || 'Unknown',
                employeeCode: fetchedEmployeeCode, // Using the correct readable ID
                email: user.email,
                advanceAmount: numericAmount,
                paymentStartsFrom: paymentStartsFrom, // string YYYY-MM-DD
                paymentDuration: numericDuration,
                paymentMethod: paymentMethod, // 'salary_deduction' | 'cash'
                reason: reason,
                status: 'Pending',
                dueAmount: dueAmount,
                paidAmount: 0,
                applyDate: new Date().toISOString(),
                createdAt: serverTimestamp(),
                month: new Date().toLocaleString('default', { month: 'long' }),
                year: new Date().getFullYear(),
                approverComment: ''
            });

            setIsAdvanceRequestOpen(false);
            setAmount('');
            setPaymentStartsFrom('');
            setDuration('');
            setReason('');
            setPaymentMethod('');
            refetchAdvances();

            Swal.fire({
                icon: 'success',
                title: 'Request Submitted',
                text: 'Your advance salary request has been submitted for approval.',
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error: any) {
            console.error("Error submitting advance request:", error);
            Swal.fire('Error', 'Failed to submit request: ' + error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) return null;

    // --- Sub-components for Cleaner Render ---

    const PayslipList = () => {
        if (isLoadingPayslips) {
            return (
                <div className="flex flex-col items-center justify-center pt-20">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
                    <p className="text-slate-500 font-medium">Loading payslips...</p>
                </div>
            );
        }
        if (errorPayslips) return <div className="p-8 text-center text-rose-500">Failed to load payslips.</div>;
        if (!payslips || payslips.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center pt-32 text-slate-400">
                    <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                        <Banknote className="h-10 w-10 opacity-30" />
                    </div>
                    <p className="font-bold text-lg mb-1">No Payslips Yet</p>
                    <p className="text-sm">generated payslips will appear here.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {payslips.map((slip: any) => (
                    <Card
                        key={slip.id}
                        onClick={() => { setSelectedSlip(slip); setIsQuickViewOpen(true); }}
                        className="p-4 rounded-3xl border-none shadow-[0_4px_12px_rgb(0,0,0,0.03)] active:scale-[0.98] transition-all bg-white flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                                <Wallet className="h-7 w-7" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{slip.payPeriod}</h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Net Payout</span>
                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                    <span className="text-sm font-bold text-emerald-600">{formatMoney(slip.netSalary)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl">
                            <Eye className="h-5 w-5 text-slate-400" />
                        </div>
                    </Card>
                ))}
            </div>
        );
    };

    const AdvanceList = () => {
        if (isLoadingAdvances) {
            return (
                <div className="flex flex-col items-center justify-center pt-20">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
                    <p className="text-slate-500 font-medium">Loading requests...</p>
                </div>
            );
        }
        if (errorAdvances) return <div className="p-8 text-center text-rose-500">Failed to load payload.</div>;

        if (!advanceRequests || advanceRequests.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center pt-32 text-slate-400">
                    <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                        <Banknote className="h-10 w-10 opacity-30" />
                    </div>
                    <p className="font-bold text-lg mb-1">No Advance Requests</p>
                    <p className="text-sm">Apply for advance salary using the + button.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4 pb-20">
                {advanceRequests.map((req: any) => (
                    <Card key={req.id} className="p-4 rounded-3xl border-none shadow-[0_4px_12px_rgb(0,0,0,0.03)] bg-white relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Applied On</p>
                                <p className="text-sm font-bold text-slate-700">{req.applyDate ? format(new Date(req.applyDate), 'dd MMM, yyyy') : 'N/A'}</p>
                            </div>
                            <Badge className={cn("rounded-full px-3 py-1 text-xs",
                                req.status === 'Approved' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                                    req.status === 'Rejected' ? "bg-rose-100 text-rose-700 hover:bg-rose-100" :
                                        "bg-amber-100 text-amber-700 hover:bg-amber-100"
                            )}>
                                {req.status}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Banknote className="h-5 w-5" />
                            </div>
                            <div>
                                <span className="text-2xl font-bold text-slate-800">{formatMoney(req.advanceAmount)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                            <div>
                                <span className="block text-slate-400 mb-0.5">Start Month</span>
                                <span className="font-medium text-slate-700">{req.paymentStartsFrom}</span>
                            </div>
                            <div>
                                <span className="block text-slate-400 mb-0.5">Duration</span>
                                <span className="font-medium text-slate-700">{req.paymentDuration} Months</span>
                            </div>
                        </div>

                        <div className="mt-2 text-xs text-slate-500 flex gap-2">
                            <span className="font-semibold text-slate-600">Method:</span>
                            {req.paymentMethod === 'salary_deduction' ? 'Salary Deduction' : 'Cash'}
                        </div>

                        {req.approverComment && (
                            <div className="mt-2 text-xs text-slate-500 bg-orange-50/50 p-2 rounded-lg border border-orange-100">
                                <span className="font-bold text-orange-700">Note: </span>{req.approverComment}
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        );
    };

    // --- Quick View Content (Same as before but moved internal variable scope) ---
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
                <div className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10 w-full">
                    <div className="w-10">
                        <Button variant="ghost" size="icon" onClick={() => setIsQuickViewOpen(false)} className="rounded-full">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                    <h2 className="font-bold text-slate-800 text-center flex-1">Payslip Details</h2>
                    <div className="w-10 flex justify-end">
                        <Button variant="ghost" size="icon" onClick={handleDownloadPdf} className="rounded-full text-blue-600">
                            <Download className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 w-full">
                    {/* PDF Offscreen Render */}
                    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
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
                            {/* ...Rest of PDF template (same as previous)... */}
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
                                            <span>{formatMoney(e.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-bold border-t mt-2 pt-2">
                                        <span>Total Earnings</span>
                                        <span>{formatMoney(slip.grossSalary)}</span>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold border-b-2 mb-2 pb-1">Deductions</h3>
                                    {deductions.map((d: any, i: number) => (
                                        <div key={i} className="flex justify-between text-sm py-1 text-red-600">
                                            <span>{d.name}</span>
                                            <span>-{formatMoney(d.value)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-bold border-t mt-2 pt-2">
                                        <span>Total Deductions</span>
                                        <span>-{formatMoney(slip.totalDeductions)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-12 bg-slate-100 p-4 rounded-lg flex justify-between items-center">
                                <span className="text-xl font-bold">Net Salary Payable</span>
                                <span className="text-2xl font-bold text-blue-700">{formatMoney(slip.netSalary)}</span>
                            </div>
                            <div className="mt-20 flex justify-between text-center">
                                <div className="border-t w-48 pt-2 text-xs">Employee Signature</div>
                                <div className="border-t w-48 pt-2 text-xs">Authorized Signature</div>
                            </div>
                        </div>
                    </div>

                    {/* Visual UI for Mobile */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                        <p className="text-blue-100 text-sm font-medium mb-1">Net Salary Payable</p>
                        <h2 className="text-3xl font-bold mb-4">{formatMoney(slip.netSalary)}</h2>
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
                                        <span className="text-emerald-600 font-bold">{formatMoney(item.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center p-4 bg-emerald-50/50">
                                    <span className="font-bold text-slate-800">Total Earnings</span>
                                    <span className="font-bold text-emerald-700">{formatMoney(slip.grossSalary)}</span>
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
                                            <span className="text-rose-600 font-bold">-{formatMoney(item.value)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center p-4 bg-rose-50/50">
                                        <span className="font-bold text-slate-800">Total Deductions</span>
                                        <span className="font-bold text-rose-700">-{formatMoney(slip.totalDeductions)}</span>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        );
    };

    // Helper for swipe logic
    const swipeConfidenceThreshold = 2000; // Reduced from 10000 for easier trigger
    const swipePower = (offset: number, velocity: number) => {
        return Math.abs(offset) * velocity;
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center px-4 pt-4 pb-2">
                    <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors text-white">
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white ml-2">Payroll & Advance</h1>
                </div>

                {/* Tabs Switcher */}
                <div className="flex items-center px-4 pb-0 mt-2">
                    <button
                        onClick={() => setActiveTab('salary')}
                        className={cn("flex-1 pb-3 text-sm font-medium transition-all relative",
                            activeTab === 'salary' ? "text-white" : "text-slate-400 hover:text-slate-200"
                        )}
                    >
                        Salary
                        {activeTab === 'salary' && <motion.span layoutId="activeTab" className="absolute bottom-0 left-0 w-full h-[3px] bg-white rounded-t-full" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('advance')}
                        className={cn("flex-1 pb-3 text-sm font-medium transition-all relative",
                            activeTab === 'advance' ? "text-white" : "text-slate-400 hover:text-slate-200"
                        )}
                    >
                        Advance Salary
                        {activeTab === 'advance' && <motion.span layoutId="activeTab" className="absolute bottom-0 left-0 w-full h-[3px] bg-white rounded-t-full" />}
                    </button>
                </div>
            </div>

            {/* Content Area with Swipe */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-hidden relative shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={activeTab}
                        initial={{ x: activeTab === 'advance' ? 300 : -300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: activeTab === 'advance' ? -300 : 300, opacity: 0 }}
                        transition={{ ease: "easeInOut", duration: 0.25 }}
                        className="h-full w-full overflow-y-auto overscroll-contain px-4 py-6 pb-24"
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.5}
                        onDragEnd={(e: any, { offset, velocity }: PanInfo) => {
                            const swipe = swipePower(offset.x, velocity.x);

                            if (swipe < -swipeConfidenceThreshold) {
                                // Swipe left -> Go to Advance
                                if (activeTab === 'salary') setActiveTab('advance');
                            } else if (swipe > swipeConfidenceThreshold) {
                                // Swipe right -> Go to Salary
                                if (activeTab === 'advance') setActiveTab('salary');
                            }
                        }}
                    >
                        {activeTab === 'salary' ? (
                            <PayslipList />
                        ) : (
                            <AdvanceList />
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* FAB for Advance Request */}
                <AnimatePresence>
                    {activeTab === 'advance' && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="fixed bottom-24 right-5 z-40"
                        >
                            <Button
                                onClick={() => setIsAdvanceRequestOpen(true)}
                                className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center p-0"
                            >
                                <Plus className="h-6 w-6" />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Quick View Sheet (Payslip) */}
            <Sheet open={isQuickViewOpen} onOpenChange={setIsQuickViewOpen}>
                <SheetContent side="bottom" className="p-0 h-[92vh] rounded-t-[2.5rem] border-none outline-none overflow-hidden max-w-md mx-auto">
                    <QuickViewContent slip={selectedSlip} />
                </SheetContent>
            </Sheet>

            {/* Advance Request Sheet */}
            <Sheet open={isAdvanceRequestOpen} onOpenChange={setIsAdvanceRequestOpen}>
                <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-10 max-h-[90vh] overflow-y-auto">
                    <SheetHeader className="mb-6 text-left">
                        <SheetTitle className="text-xl font-bold">Request Advance Salary</SheetTitle>
                    </SheetHeader>

                    <form onSubmit={handleAdvanceSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label>Advance Amount (BDT) <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-8 text-lg font-bold"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Payment Method <span className="text-red-500">*</span></Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="salary_deduction">Salary Deduction</SelectItem>
                                    <SelectItem value="cash">Cash</SelectItem>
                                </SelectContent>
                            </Select>
                            {paymentMethod === 'salary_deduction' && (
                                <p className="text-xs text-blue-600 mt-1">
                                    Deductions will begin from the selected start date below.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Deduction Start Month <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={paymentStartsFrom}
                                    onChange={(e) => setPaymentStartsFrom(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Duration (Months) <span className="text-red-500">*</span></Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="24"
                                    placeholder="e.g. 6"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Reason (Optional)</Label>
                            <Textarea
                                placeholder="Why do you need this advance?"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="resize-none"
                            />
                        </div>

                        <Button type="submit" size="lg" className="w-full text-base py-6 rounded-xl mt-4" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                            Submit Request
                        </Button>
                    </form>
                </SheetContent>
            </Sheet>
        </div>
    );
}

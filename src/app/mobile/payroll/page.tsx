"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, where, orderBy, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { ArrowLeft, Banknote, Calendar, Loader2, Download, Eye, Wallet, TrendingUp, TrendingDown, Clock, Printer, X, Plus, Filter as FilterIcon, Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { format, getYear, parseISO, startOfDay, endOfDay } from 'date-fns';
import { MobileFilterSheet, hasActiveFilters, type FilterState } from '@/components/mobile/MobileFilterSheet';
import { DateRange } from 'react-day-picker';
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
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

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

    // Filter State
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>({});
    const [logoBase64, setLogoBase64] = useState<string | null>(null);

    // Pre-fetch logo as Base64 to avoid CORS issues in PDF generation
    React.useEffect(() => {
        if (companyLogoUrl) {
            const fetchLogo = async () => {
                try {
                    const response = await fetch(companyLogoUrl); // Try simple fetch first
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => setLogoBase64(reader.result as string);
                    reader.readAsDataURL(blob);
                } catch (error) {
                    console.error("Error pre-loading logo for PDF:", error);
                }
            };
            fetchLogo();
        }
    }, [companyLogoUrl]);

    // --- Queries ---

    // 1. Payslips Query
    const { data: payslips, isLoading: isLoadingPayslips, error: errorPayslips, refetch: refetchPayslips } = useFirestoreQuery<any[]>(
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

    // Filtered Lists Logic (after queries)
    const filteredPayslips = React.useMemo(() => {
        if (!payslips) return [];
        return payslips.filter(slip => {
            if (filters.year) {
                let slipYear: number | undefined;
                if (slip.createdAt?.toDate) {
                    slipYear = getYear(slip.createdAt.toDate());
                } else if (slip.payPeriod) {
                    const parts = slip.payPeriod.split(' ');
                    if (parts.length > 1) slipYear = parseInt(parts[1]);
                }
                if (slipYear && slipYear.toString() !== filters.year) return false;
            }
            return true;
        });
    }, [payslips, filters.year]);

    const filteredAdvanceRequests = React.useMemo(() => {
        if (!advanceRequests) return [];
        return advanceRequests.filter(req => {
            if (filters.status && filters.status !== 'All') {
                if (Array.isArray(filters.status)) {
                    if (!filters.status.includes(req.status)) return false;
                } else {
                    if (req.status !== filters.status) return false;
                }
            }
            if (filters.dateRange?.from) {
                const reqDate = req.applyDate ? parseISO(req.applyDate) : null;
                if (!reqDate) return false;
                if (reqDate < startOfDay(filters.dateRange.from)) return false;
                if (filters.dateRange.to && reqDate > endOfDay(filters.dateRange.to)) return false;
            }
            return true;
        });
    }, [advanceRequests, filters.status, filters.dateRange]);

    const formatMoney = (val: number) => {
        return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(val);
    };

    const refreshData = async () => {
        await Promise.all([refetchPayslips(), refetchAdvances()]);
    };

    // Swipe Handling
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe && activeTab === 'salary') {
            setActiveTab('advance');
        }
        if (isRightSwipe && activeTab === 'advance') {
            setActiveTab('salary');
        }
    };

    const containerRef = usePullToRefresh(refreshData);

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
                scale: 1.5,
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
                Swal.fire({ icon: 'error', title: 'Error', text: `Failed to generate PDF: ${error.message}.`, heightAuto: false, timer: 3000, showConfirmButton: false });
            }, 100);
        }
    };

    const handleEmailPdf = async () => {
        if (!pdfRef.current || !selectedSlip || !user?.email) {
            if (!user?.email) Swal.fire('Error', 'No email address found for user.', 'error');
            return;
        }

        try {
            Swal.fire({
                title: 'Sending Email...',
                didOpen: () => { Swal.showLoading(); },
                allowOutsideClick: false,
                showConfirmButton: false,
                heightAuto: false
            });

            const element = pdfRef.current;
            const canvas = await html2canvas(element, {
                scale: 1.5,
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

            // Use arraybuffer approach to avoid "The string did not match the expected pattern" DOMException on mobile
            const pdfOutput = pdf.output('arraybuffer');
            const pdfBlob = new Blob([pdfOutput], { type: 'application/pdf' });

            const pdfDataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(pdfBlob);
            });

            const response = await fetch('/api/email/send-payslip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pdfBase64: pdfDataUri,
                    employeeEmail: user.email,
                    employeeName: selectedSlip.employeeName,
                    payPeriod: selectedSlip.payPeriod
                })
            });

            const result = await response.json();

            Swal.close();

            if (result.success) {
                setTimeout(() => {
                    Swal.fire({ icon: 'success', title: 'Sent!', text: 'Payslip emailed successfully.', timer: 2000, showConfirmButton: false, heightAuto: false });
                }, 100);
            } else {
                throw new Error(result.error || 'Failed to send');
            }

        } catch (error: any) {
            console.error('Email sending error:', error);
            Swal.close();
            setTimeout(() => {
                Swal.fire({ icon: 'error', title: 'Error', text: `Failed to email payslip: ${error.message}.`, heightAuto: false, timer: 3000, showConfirmButton: false });
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
        if (!filteredPayslips || filteredPayslips.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center pt-32 text-slate-400">
                    <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                        <Banknote className="h-10 w-10 opacity-30" />
                    </div>
                    <p className="font-bold text-lg mb-1">No Payslips Found</p>
                    <p className="text-sm">Try changing filters or check later.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {filteredPayslips.map((slip: any) => (
                    <Card
                        key={slip.id}
                        onClick={() => { setSelectedSlip(slip); setIsQuickViewOpen(true); }}
                        className="p-4 rounded-3xl border-none shadow-md active:bg-slate-50 transition-all bg-white flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center text-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.2)] border border-blue-100">
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
                        <div className="bg-white p-2 rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)] border border-blue-100">
                            <Eye className="h-5 w-5 text-blue-600" />
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

        if (!filteredAdvanceRequests || filteredAdvanceRequests.length === 0) {
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
                {filteredAdvanceRequests.map((req: any) => (
                    <Card key={req.id} className="p-4 rounded-3xl border-none shadow-md bg-white relative overflow-hidden">
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
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="icon" onClick={handleEmailPdf} className="rounded-full text-indigo-600" title="Email PDF">
                            <Mail className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleDownloadPdf} className="rounded-full text-blue-600" title="Download PDF">
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
                                    <div className="flex items-center gap-3 mb-2">
                                        {(logoBase64 || companyLogoUrl) && (
                                            <img
                                                src={logoBase64 || companyLogoUrl}
                                                alt="Logo"
                                                className="h-8 w-8 object-contain"
                                                crossOrigin="anonymous"
                                            />
                                        )}
                                        <h1 className="text-2xl font-bold">{companyName}</h1>
                                    </div>
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
                        <Card className="rounded-2xl border-none shadow-md overflow-hidden bg-white">
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
                        <Card className="rounded-2xl border-none shadow-md overflow-hidden bg-white">
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

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-6">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-white bg-white/10 rounded-full transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2">Payroll & Advance</h1>
                    </div>
                    <button
                        onClick={() => setIsFilterOpen(true)}
                        className={cn(
                            "p-2 rounded-full transition-all relative shadow-[0_4px_12px_rgba(37,99,235,0.2)] bg-white/10",
                            hasActiveFilters(filters) ? "text-white" : "text-white/70 hover:text-white"
                        )}
                    >
                        <FilterIcon className="h-5 w-5" />
                        {hasActiveFilters(filters) && (
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 border-2 border-[#0a1e60]"></span>
                        )}
                    </button>
                </div>
            </div>

            {/* Main White Container - Non-scrollable wrapper */}
            <div className="flex-1 bg-slate-50 rounded-t-[2rem] flex flex-col overflow-hidden relative">

                {/* Tabs - Sticky/Fixed at top of white area */}
                <div className="bg-white px-6 pt-6 pb-2 shrink-0 z-20">
                    <div className="flex items-center justify-between p-1 bg-slate-50 rounded-full mb-2 shadow-inner">
                        <button
                            onClick={() => setActiveTab('salary')}
                            className={`flex-1 py-3 text-sm font-bold rounded-full transition-all duration-200 ${activeTab === 'salary'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${activeTab === 'salary' ? 'bg-yellow-400' : 'bg-transparent'}`}></span>
                                Salary
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('advance')}
                            className={`flex-1 py-3 text-sm font-bold rounded-full transition-all duration-200 ${activeTab === 'advance'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${activeTab === 'advance' ? 'bg-yellow-400' : 'bg-transparent'}`}></span>
                                Advance Salary
                            </span>
                        </button>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div
                    ref={containerRef}
                    className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-4 pb-[120px]" // Increased padding-bottom for navigation bar clearance
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    {activeTab === 'salary' ? <PayslipList /> : <AdvanceList />}
                </div>

                {/* FAB for Advance Request - Only shows when activeTab is advance */}
                {activeTab === 'advance' && (
                    <div className="absolute bottom-32 right-6 z-40">
                        <div className="h-14 w-14">
                            <Button
                                onClick={() => setIsAdvanceRequestOpen(true)}
                                className="h-full w-full rounded-full shadow-[0_4px_12px_rgba(37,99,235,0.2)] border border-blue-100 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center p-0"
                            >
                                <Plus className="h-6 w-6" />
                            </Button>
                        </div>
                    </div>
                )}
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

            {/* Filter Sheet */}
            <MobileFilterSheet
                open={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                onApply={setFilters}
                onReset={() => setFilters({})}
                showDateRange={activeTab === 'advance'}
                showStatus={activeTab === 'advance'}
                statusOptions={['Pending', 'Approved', 'Rejected']}
                currentFilters={filters}
                title={activeTab === 'salary' ? "Filter Payslips" : "Filter Requests"}
            >
                {activeTab === 'salary' && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Year</h4>
                        <Select
                            value={filters.year}
                            onValueChange={(val) => setFilters(prev => ({ ...prev, year: val }))}
                        >
                            <SelectTrigger className="w-full h-12 rounded-xl border-slate-200">
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {[0, 1, 2, 3].map(i => {
                                    const y = new Date().getFullYear() - i;
                                    return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </MobileFilterSheet>
        </div>
    );
}

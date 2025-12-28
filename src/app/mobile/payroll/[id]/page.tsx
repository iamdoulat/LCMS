"use client";

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { ArrowLeft, Download, Share2, Wallet, TrendingUp, TrendingDown, Clock, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function PayslipDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [payslip, setPayslip] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!id) return;
        const fetchPayslip = async () => {
            try {
                const ref = doc(firestore, 'payslips', id);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    setPayslip({ id: snap.id, ...snap.data() });
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchPayslip();
    }, [id]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(val);
    };

    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
                <div className="flex-1 bg-slate-50 mt-20 rounded-t-[2.5rem] flex justify-center items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            </div>
        );
    }

    if (!payslip) return null;

    const earnings = payslip.salaryBreakup || [];
    const deductions = [
        { name: 'Absent', value: payslip.absentDeduction },
        { name: 'Advance', value: payslip.advanceDeduction },
        { name: 'Provident Fund', value: payslip.providentFund },
        { name: 'Tax', value: payslip.taxDeduction },
    ].filter(d => d.value > 0);

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-1 pb-6">
                    <div className="flex items-center">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors text-white"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white ml-2">Payslip Details</h1>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain px-4 py-6 pb-24">

                {/* Main Summary Card */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-10 -mb-10 blur-xl" />

                    <div className="relative z-10">
                        <p className="text-blue-100 text-sm font-medium mb-1">Net Salary Payable</p>
                        <h2 className="text-3xl font-bold mb-4">{formatCurrency(payslip.netSalary)}</h2>

                        <div className="flex items-center gap-3 text-sm bg-white/10 p-2 rounded-xl backdrop-blur-sm w-fit">
                            <Clock className="h-4 w-4 text-blue-200" />
                            <span>{payslip.payPeriod}</span>
                        </div>
                    </div>
                </div>

                {/* Earnings Section */}
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
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
                                <span className="font-bold text-emerald-700">{formatCurrency(payslip.grossSalary)}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Deductions Section */}
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-rose-500" />
                        Deductions
                    </h3>
                    <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-white">
                        {deductions.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-sm">No deductions</div>
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
                                    <span className="font-bold text-rose-700">-{formatCurrency(payslip.totalDeductions)}</span>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}

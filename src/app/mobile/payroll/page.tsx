"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { ArrowLeft, ArrowRight, Banknote, Calendar, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { MobileHeader } from '@/components/mobile/MobileHeader'; // Or standard header if tailored

export default function MobilePayrollPage() {
    const router = useRouter();
    const { user } = useAuth();

    // We need to resolve the employee ID first if it's different from user.uid, 
    // but usually user.uid is the document ID for employees collection or linked via email.
    // The previous dashboard logic fetched employee ID by email. 
    // Use the same logic or simpler if we assume auth user is employee.

    // Let's assume we can query by email filtering on payslips or we need to look up employee ID first.
    // Checking `Payslip` type: it has `employeeId`.

    const [employeeId, setEmployeeId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!user?.email) return;

        // Simple fetch to get employee ID by email
        import('firebase/firestore').then(async ({ getDocs, collection, query, where }) => {
            const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
            const snap = await getDocs(q);
            if (!snap.empty) {
                setEmployeeId(snap.docs[0].id);
            } else {
                // Fallback if user.uid is the employee ID
                setEmployeeId(user.uid);
            }
        });
    }, [user]);

    const { data: payslips, isLoading } = useFirestoreQuery(
        employeeId ? query(
            collection(firestore, 'payslips'),
            where('employeeId', '==', employeeId),
            orderBy('createdAt', 'desc')
        ) : null,
        { initialData: [] },
        ['mobile_payslips', employeeId || '']
    );

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(val);
    };

    if (!user) return null;

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

            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto overscroll-contain px-4 py-6 pb-24">
                {isLoading ? (
                    <div className="flex justify-center pt-10">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : !payslips || payslips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-20 text-slate-400">
                        <Banknote className="h-16 w-16 mb-4 opacity-50" />
                        <p>No payslips found.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {payslips.map((slip: any) => (
                            <Card
                                key={slip.id}
                                onClick={() => router.push(`/mobile/payroll/${slip.id}`)}
                                className="p-4 rounded-2xl border-none shadow-sm active:scale-95 transition-transform bg-white flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                        <Banknote className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{slip.payPeriod}</h3>
                                        <p className="text-xs text-slate-500 font-medium">Net Salary</p>
                                        <p className="text-sm font-bold text-green-600">{formatCurrency(slip.netSalary)}</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-5 w-5 text-slate-300" />
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, ChevronDown, HandCoins, RotateCcw, Plus, Trash2, Loader2, Edit2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ClaimDetailsSheet } from '@/components/mobile/ClaimDetailsSheet';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import type { ClaimDetail, HRClaim, Employee } from '@/types';
import Swal from 'sweetalert2';

function CreateClaimContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editingId = searchParams.get('id');
    const { user } = useAuth();

    // Form State
    const [advanceDate, setAdvanceDate] = useState('');
    const [advanceAmount, setAdvanceAmount] = useState<number>(0);
    const [claimDate, setClaimDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [details, setDetails] = useState<ClaimDetail[]>([]);

    // Meta State
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<{ id: string, name: string } | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employeeData, setEmployeeData] = useState<Employee | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(!!editingId);

    // Fetch Initial Data
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.uid) return;

            try {
                // 1. Fetch Categories
                const catsRef = collection(firestore, 'claim_categories');
                const catsSnap = await getDocs(query(catsRef, orderBy('name')));
                setCategories(catsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));

                // 2. Fetch Employee Data for Code and Branch
                let finalEmpData: any = null;
                const empRef = doc(firestore, 'employees', user.uid);
                const empSnap = await getDoc(empRef);

                if (empSnap.exists()) {
                    finalEmpData = { ...empSnap.data() };
                } else {
                    const empQuery = query(collection(firestore, 'employees'), where('email', '==', user.email));
                    const empSnap2 = await getDocs(empQuery);
                    if (!empSnap2.empty) {
                        finalEmpData = { ...empSnap2.docs[0].data() };
                    }
                }

                // Always check users collection for supplemental data like branch if missing
                const userRef = doc(firestore, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    finalEmpData = {
                        ...userData,
                        ...finalEmpData,
                        // Ensure we take branch from users if missing in employees
                        branch: finalEmpData?.branch || userData.branch || '',
                        employeeCode: finalEmpData?.employeeCode || userData.employeeCode || ''
                    };
                }

                if (finalEmpData) {
                    setEmployeeData(finalEmpData as Employee);
                }

                // 3. Fetch Claim if Editing
                if (editingId) {
                    const claimSnap = await getDoc(doc(firestore, 'hr_claims', editingId));
                    if (claimSnap.exists()) {
                        const data = claimSnap.data() as HRClaim;
                        // Only allow editing if status is 'Claimed'
                        if (data.status !== 'Claimed') {
                            Swal.fire('Access Denied', 'Only claims with status "Claimed" can be edited.', 'error');
                            router.push('/mobile/claim');
                            return;
                        }
                        setAdvanceDate(data.advancedDate || '');
                        setAdvanceAmount(data.advancedAmount || 0);
                        setClaimDate(data.claimDate);
                        setDescription(data.description || '');
                        setDetails(data.details || []);
                    }
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsInitialLoading(false);
            }
        };
        fetchData();
    }, [user?.uid, editingId, user?.email]);

    const calculateTotal = () => details.reduce((sum, item) => sum + item.amount, 0);

    const handleSubmit = async () => {
        if (!user?.uid || details.length === 0 || !claimDate) {
            Swal.fire('Required', 'Please fill all required fields and add at least one item.', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const empCode = employeeData?.employeeCode || '0000';

            const claimData: any = {
                userId: user.uid,
                employeeId: user.uid,
                employeeName: employeeData?.fullName || user.displayName || 'Unknown',
                employeeCode: empCode,
                branch: employeeData?.branch || '',
                claimDate,
                advancedDate: advanceDate || null,
                advancedAmount: Number(advanceAmount) || 0,
                description: description || '',
                status: 'Claimed',
                claimAmount: calculateTotal() - (Number(advanceAmount) || 0),
                approvedAmount: 0,
                remainingAmount: calculateTotal() - (Number(advanceAmount) || 0),
                claimCategories: Array.from(new Set(details.map(d => d.categoryName))),
                categoryName: details[0]?.categoryName || '',
                details: details,
                updatedAt: serverTimestamp(),
            };

            // Clean data of undefined values
            const finalData = Object.fromEntries(
                Object.entries(claimData).filter(([_, v]) => v !== undefined)
            );

            if (editingId) {
                const claimRef = doc(firestore, 'hr_claims', editingId);
                await updateDoc(claimRef, finalData);
            } else {
                // Generate Claim No only for new claims
                const randomNum = Math.floor(1000 + Math.random() * 9000);
                finalData.claimNo = `CLM-${empCode}/${randomNum}`;
                finalData.createdAt = serverTimestamp();
                await addDoc(collection(firestore, 'hr_claims'), finalData);
            }

            Swal.fire({
                title: editingId ? 'Updated!' : 'Success!',
                text: editingId ? 'Claim updated successfully.' : 'Claim submitted successfully.',
                icon: 'success',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });

            router.push('/mobile/claim');
        } catch (error: any) {
            console.error("Error submitting claim:", error);
            Swal.fire({
                title: 'Error',
                text: `Failed to process claim: ${error.message || 'Unknown error'}`,
                icon: 'error',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 5000
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isInitialLoading) {
        return (
            <div className="flex flex-col h-screen bg-[#0a1e60] items-center justify-center">
                <Loader2 className="animate-spin text-white w-10 h-10" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-4 pb-6 relative">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors z-10"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-4 pb-6">
                        {editingId ? 'Edit Claim' : 'Create Claim'}
                    </h1>
                    <div className="w-10" />
                </div>
            </div>

            <div className="flex-1 bg-[#f8fafc] rounded-t-[2rem] overflow-hidden flex flex-col relative w-full">
                <div className="flex-1 overflow-y-auto px-5 py-6 pb-60 overscroll-contain">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <Card className="p-4 rounded-xl border-none shadow-sm bg-blue-100/50">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm">
                                        <HandCoins className="h-5 w-5" />
                                    </div>
                                    <span className="text-xl font-bold text-blue-800">৳{calculateTotal().toLocaleString()}</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">Total Claim Amount</span>
                            </div>
                        </Card>
                        <Card className="p-4 rounded-xl border-none shadow-sm bg-purple-100/50">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-purple-600 shadow-sm">
                                        <RotateCcw className="h-5 w-5" />
                                    </div>
                                    <span className="text-xl font-bold text-purple-800">৳0</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">Approved Amount</span>
                            </div>
                        </Card>
                    </div>

                    {/* Form */}
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-500">Advance Date</Label>
                                <Input
                                    type="date"
                                    value={advanceDate}
                                    onChange={(e) => setAdvanceDate(e.target.value)}
                                    className="h-12 bg-white rounded-xl border-slate-200 text-sm font-semibold text-slate-700"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-500">Advance Amount</Label>
                                <Input
                                    type="number"
                                    value={advanceAmount}
                                    onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                                    className="h-12 bg-white rounded-xl border-slate-200 text-sm font-semibold text-slate-700"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">Claim Date <span className="text-red-500">*</span></Label>
                            <Input
                                type="date"
                                value={claimDate}
                                onChange={(e) => setClaimDate(e.target.value)}
                                className="h-12 bg-white rounded-xl border-slate-200 text-sm font-semibold text-slate-700"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">Description</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Write general description..."
                                className="min-h-[80px] bg-white rounded-xl border-slate-200 p-4 text-sm font-semibold text-slate-700 placeholder:text-slate-400 resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">Add Items by Category <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <select
                                    className="h-12 w-full bg-white rounded-xl border border-slate-200 px-4 pr-10 text-sm font-semibold text-slate-700 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    onChange={(e) => {
                                        const cat = categories.find(c => c.id === e.target.value);
                                        if (cat) {
                                            setSelectedCategory(cat);
                                            setIsDetailsOpen(true);
                                            e.target.value = ""; // Reset select
                                        }
                                    }}
                                    value=""
                                >
                                    <option value="" disabled>Select category to add item...</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="h-4 w-4 text-slate-400 absolute right-4 top-4 pointer-events-none" />
                            </div>
                        </div>

                        {/* Details List */}
                        {details.length > 0 && (
                            <div className="space-y-3 pt-2">
                                <Label className="text-xs font-semibold text-slate-700">Items ({details.length})</Label>
                                {details.map((detail, idx) => (
                                    <div key={detail.id} className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group animate-in slide-in-from-right-4 duration-300">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-800">{detail.categoryName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">৳{detail.amount.toLocaleString()}</span>
                                                <span className="text-[10px] text-slate-400">{new Date(detail.fromDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDetails(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-full"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit Bar */}
                <div className="absolute bottom-[94px] left-0 right-0 p-5 bg-white/80 backdrop-blur-md border-t border-slate-100 flex flex-col gap-3 z-50">
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || details.length === 0}
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-xl font-bold rounded-2xl shadow-xl shadow-blue-200 text-white"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : `${editingId ? 'Update Claim' : 'Submit Claim'} (৳${calculateTotal().toLocaleString()})`}
                    </Button>
                </div>

                <ClaimDetailsSheet
                    isOpen={isDetailsOpen}
                    onClose={() => setIsDetailsOpen(false)}
                    onSave={(detail) => setDetails(prev => [...prev, detail])}
                    category={selectedCategory}
                />
            </div>
        </div>
    );
}

export default function CreateClaimPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col h-screen bg-[#0a1e60] items-center justify-center">
                <Loader2 className="animate-spin text-white w-10 h-10" />
            </div>
        }>
            <CreateClaimContent />
        </Suspense>
    );
}

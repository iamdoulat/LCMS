"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, ChevronDown, HandCoins, RotateCcw, Plus, Trash2, Loader2, Edit2, Check, X, MessageSquare, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { cn } from "@/lib/utils";
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
    const source = searchParams.get('source');
    const { user, userRole } = useAuth();

    // Form State
    const [advanceDate, setAdvanceDate] = useState('');
    const [advanceAmount, setAdvanceAmount] = useState<number>(0);
    const [claimDate, setClaimDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [supervisorComments, setSupervisorComments] = useState('');
    const [details, setDetails] = useState<ClaimDetail[]>([]);

    // Meta State
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<{ id: string, name: string } | null>(null);
    const [editingDetail, setEditingDetail] = useState<ClaimDetail | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employeeData, setEmployeeData] = useState<Employee | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(!!editingId);

    // Fetch Initial Data
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.uid) return;

            // Load categories from cache first for instant UI
            const cacheKey = 'claim_categories_cache';
            const cachedCats = localStorage.getItem(cacheKey);
            if (cachedCats) {
                try {
                    setCategories(JSON.parse(cachedCats));
                } catch (e) { }
            }

            try {
                // Parallelize categories and employee data fetches
                const [catsSnap, empSnap, userSnap] = await Promise.all([
                    getDocs(collection(firestore, 'claim_categories')),
                    getDoc(doc(firestore, 'employees', user.uid)),
                    getDoc(doc(firestore, 'users', user.uid))
                ]);

                // 1. Process Categories
                const catList = catsSnap.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name || 'Unnamed Category'
                })).sort((a, b) => a.name.localeCompare(b.name));
                
                setCategories(catList);
                localStorage.setItem(cacheKey, JSON.stringify(catList));

                // 2. Process Employee/User Data
                let finalEmpData: any = null;
                if (empSnap.exists()) {
                    finalEmpData = { ...empSnap.data() };
                } else {
                    const empQuery = query(collection(firestore, 'employees'), where('email', '==', user.email));
                    const empSnap2 = await getDocs(empQuery);
                    if (!empSnap2.empty) {
                        finalEmpData = { ...empSnap2.docs[0].data() };
                    }
                }

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    finalEmpData = {
                        ...userData,
                        ...finalEmpData,
                        branch: finalEmpData?.branch || userData.branch || '',
                        employeeCode: finalEmpData?.employeeCode || userData.employeeCode || ''
                    };
                }

                if (finalEmpData) {
                    setEmployeeData(finalEmpData as Employee);
                }

                // 3. Fetch Claim if Editing (This stays somewhat sequential if it depends on data above, but here it doesn't)
                if (editingId) {
                    const claimSnap = await getDoc(doc(firestore, 'hr_claims', editingId));
                    if (claimSnap.exists()) {
                        const data = claimSnap.data() as HRClaim;
                        const canEditAsEmployee = data.status === 'Claimed' && !source;
                        const canEditAsSupervisor = source === 'requests' && ['Claimed', 'Approval by Supervisor'].includes(data.status);

                        if (!canEditAsEmployee && !canEditAsSupervisor) {
                            Swal.fire('Access Denied', 'You do not have permission to edit this claim in its current status.', 'error');
                            router.push('/mobile/claim');
                            return;
                        }

                        setAdvanceDate(data.advancedDate || '');
                        setAdvanceAmount(data.advancedAmount || 0);
                        setClaimDate(data.claimDate);
                        setDescription(data.description || '');
                        setSupervisorComments(data.supervisorComments || '');
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
    }, [user?.uid, editingId, user?.email, source]);

    const calculateRequestedTotal = () => details.reduce((sum, item) => sum + item.amount, 0);
    const calculateApprovedTotal = () => details.reduce((sum, item) => sum + (item.status === 'Approved' ? item.amount : 0), 0);

    const handleSubmit = async () => {
        if (!user?.uid || details.length === 0 || !claimDate) {
            Swal.fire('Required', 'Please fill all required fields and add at least one item.', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const claimData: any = {
                claimDate,
                advancedDate: advanceDate || null,
                advancedAmount: Number(advanceAmount) || 0,
                description: description || '',
                supervisorComments: supervisorComments || '',
                claimAmount: calculateRequestedTotal() - (Number(advanceAmount) || 0),
                approvedAmount: calculateApprovedTotal(),
                remainingAmount: calculateRequestedTotal() - (Number(advanceAmount) || 0),
                claimCategories: Array.from(new Set(details.map(d => d.categoryName))),
                categoryName: details[0]?.categoryName || '',
                details: details,
                updatedAt: serverTimestamp(),
            };

            // Save supervisor name if there are approved items
            if (calculateApprovedTotal() > 0 && source === 'requests') {
                claimData.approvedByName = user?.displayName || user?.email || 'Supervisor';
            }

            if (!editingId) {
                // New Claim: Use current user's (employee) data
                const empCode = employeeData?.employeeCode || '0000';
                claimData.userId = user.uid;
                claimData.employeeId = user.uid;
                claimData.employeeName = employeeData?.fullName || user.displayName || user?.email || 'Unknown';
                claimData.employeeCode = empCode;
                claimData.branch = employeeData?.branch || '';
                claimData.status = 'Claimed';
                claimData.createdAt = serverTimestamp();
                
                // Generate Claim No only for new claims
                const randomNum = Math.floor(1000 + Math.random() * 9000);
                claimData.claimNo = `CLM-${empCode}/${randomNum}`;
            } else if (source !== 'requests') {
                // If an employee updates their own claim, reset status to Claimed for re-approval
                claimData.status = 'Claimed';
            }

            // Clean data of undefined values
            const finalData: any = Object.fromEntries(
                Object.entries(claimData).filter(([_, v]) => v !== undefined)
            );

            if (editingId) {
                const claimRef = doc(firestore, 'hr_claims', editingId);
                await updateDoc(claimRef, finalData);
            } else {
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
                <div className="flex items-center justify-between px-4 pt-[5px] pb-6 relative">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors z-10 shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-[5px] pb-6">
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
                                    <span className="text-xl font-bold text-blue-800">৳{calculateRequestedTotal().toLocaleString()}</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">Requested Total</span>
                            </div>
                        </Card>
                        <Card className="p-4 rounded-xl border-none shadow-sm bg-emerald-100/50 transition-all duration-300">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-emerald-600 shadow-sm animate-in fade-in zoom-in duration-500">
                                        <Check className="h-5 w-5" />
                                    </div>
                                    <span className="text-xl font-bold text-emerald-800">৳{calculateApprovedTotal().toLocaleString()}</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">Approved Amount</span>
                            </div>
                        </Card>
                    </div>

                    {/* Form */}
                    <div className="space-y-5">
                        <div className="grid grid-cols-12 gap-4">
                            <div className="space-y-2 col-span-5">
                                <Label className="text-xs font-semibold text-slate-500">Advance Date</Label>
                                <Input
                                    type="date"
                                    value={advanceDate}
                                    onChange={(e) => setAdvanceDate(e.target.value)}
                                    className="h-12 bg-white rounded-xl border-slate-200 text-xs font-semibold text-slate-700"
                                />
                            </div>
                            <div className="space-y-2 col-span-5 col-start-8">
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

                        {(source === 'requests' || supervisorComments) && (
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-amber-700">Supervisor Comments</Label>
                                <Textarea
                                    value={supervisorComments}
                                    onChange={(e) => setSupervisorComments(e.target.value)}
                                    placeholder={source === 'requests' ? "Add supervisor comments..." : "No supervisor comments yet."}
                                    readOnly={source !== 'requests'}
                                    className={cn(
                                        "min-h-[80px] bg-amber-50/30 rounded-xl border-amber-100 p-4 text-sm font-semibold text-slate-700 placeholder:text-slate-400 resize-none focus:ring-amber-500",
                                        source !== 'requests' && "bg-slate-50/50 border-slate-100"
                                    )}
                                />
                            </div>
                        )}

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

                        {details.length > 0 && (
                            <div className="space-y-4 pt-2">
                                <Label className="text-xs font-semibold text-slate-700">Items ({details.length})</Label>
                                {details.map((detail, idx) => (
                                    <React.Fragment key={detail.id}>
                                        <div className={cn(
                                            "p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group animate-in slide-in-from-right-4 duration-300 relative overflow-hidden",
                                            source === 'requests' && "rounded-b-none border-b-0",
                                            detail.status === 'Approved' && "border-l-4 border-l-emerald-500",
                                            detail.status === 'Rejected' && "border-l-4 border-l-red-500"
                                        )}>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-slate-800">{detail.categoryName}</p>
                                                    {detail.status === 'Approved' && (
                                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Supervisor Approved</span>
                                                    )}
                                                    {detail.status === 'Rejected' && (
                                                        <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">Supervisor Rejected</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">৳{detail.amount.toLocaleString()}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(detail.fromDate).toLocaleDateString()}</span>
                                                </div>
                                                {detail.description && (
                                                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed border-t border-slate-50 pt-2 italic">
                                                        {detail.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {detail.attachmentUrl && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => window.open(detail.attachmentUrl, '_blank')}
                                                        className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 h-8 w-8 rounded-full"
                                                        title="View Attachment"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setEditingDetail(detail);
                                                        setSelectedCategory({ id: detail.categoryId, name: detail.categoryName });
                                                        setIsDetailsOpen(true);
                                                    }}
                                                    className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 h-8 w-8 rounded-full"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                {source !== 'requests' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setDetails(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-full"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {source !== 'requests' && detail.supervisorComment && (
                                            <div className="px-4 pb-3 border-x border-b border-slate-100 rounded-b-xl -mt-1 pt-2 flex flex-col gap-1.5 bg-amber-50/50">
                                                <div className="flex items-center gap-1.5">
                                                    <MessageSquare className="h-3 w-3 text-amber-600" />
                                                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Supervisor Comments</span>
                                                </div>
                                                <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
                                                    {detail.supervisorComment}
                                                </p>
                                            </div>
                                        )}

                                        {source === 'requests' && (
                                            <div className="px-4 pb-4 border-x border-b border-slate-100 rounded-b-xl -mt-1 pt-4 flex flex-col gap-3 bg-white/50 backdrop-blur-sm">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Internal Comments</Label>
                                                    <Input
                                                        placeholder="Add per-item comment..."
                                                        value={detail.supervisorComment || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setDetails(prev => prev.map((d, i) => i === idx ? { ...d, supervisorComment: val } : d));
                                                        }}
                                                        className="h-9 bg-white/50 border-slate-200 rounded-lg text-xs font-semibold focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant={detail.status === 'Approved' ? 'default' : 'outline'}
                                                        onClick={() => {
                                                            setDetails(prev => prev.map((d, i) => i === idx ? { ...d, status: 'Approved' } : d));
                                                        }}
                                                        className={cn(
                                                            "h-9 rounded-lg text-xs font-bold gap-1.5 transition-all",
                                                            detail.status === 'Approved' 
                                                                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-100" 
                                                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                        )}
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant={detail.status === 'Rejected' ? 'destructive' : 'outline'}
                                                        onClick={() => {
                                                            setDetails(prev => prev.map((d, i) => i === idx ? { ...d, status: 'Rejected' } : d));
                                                        }}
                                                        className={cn(
                                                            "h-9 rounded-lg text-xs font-bold gap-1.5 transition-all",
                                                            detail.status === 'Rejected' 
                                                                ? "bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-100" 
                                                                : "border-red-200 text-red-600 hover:bg-red-50"
                                                        )}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </React.Fragment>
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
                        {isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : `${editingId ? 'Updated Claim for Approval' : 'Submit Claim for Approval'} (৳${(details.some(d => d.status) ? calculateApprovedTotal() : calculateRequestedTotal()).toLocaleString()})`}
                    </Button>
                </div>

                <ClaimDetailsSheet
                    isOpen={isDetailsOpen}
                    onClose={() => {
                        setIsDetailsOpen(false);
                        setEditingDetail(null);
                    }}
                    onSave={(detail) => {
                        if (editingDetail) {
                            setDetails(prev => prev.map(d => d.id === detail.id ? detail : d));
                        } else {
                            setDetails(prev => [...prev, detail]);
                        }
                    }}
                    category={selectedCategory}
                    initialData={editingDetail}
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

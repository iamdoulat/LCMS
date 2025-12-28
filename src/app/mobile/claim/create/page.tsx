"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, ChevronDown, HandCoins, RotateCcw } from 'lucide-react'; // Using approximate icons
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ClaimDetailsSheet } from '@/components/mobile/ClaimDetailsSheet';

export default function CreateClaimPage() {
    const router = useRouter();
    const [advanceDate, setAdvanceDate] = useState('');
    const [claimDate, setClaimDate] = useState('');
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
                    <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-4 pb-6">Create Claim</h1>
                    <div className="w-10" />
                </div>
            </div>

            <div className="flex-1 bg-[#f8fafc] rounded-t-[2rem] overflow-hidden flex flex-col relative w-full">

                <div className="flex-1 overflow-y-auto px-5 py-6 pb-24 overscroll-contain">

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <Card className="p-4 rounded-xl border-none shadow-sm bg-blue-100">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm">
                                        <HandCoins className="h-5 w-5" />
                                    </div>
                                    <span className="text-xl font-bold text-blue-800">0.0</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">Total Claim Amount</span>
                            </div>
                        </Card>
                        <Card className="p-4 rounded-xl border-none shadow-sm bg-purple-100">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-purple-600 shadow-sm">
                                        <RotateCcw className="h-5 w-5" />
                                    </div>
                                    <span className="text-xl font-bold text-purple-800">0.0</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">Sanctioned Amount</span>
                            </div>
                        </Card>
                    </div>

                    {/* Form */}
                    <div className="space-y-5">
                        {/* Row 1: Advance Date & Amount */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-500">Advance Date</Label>
                                <div className="relative">
                                    <div className={`h-12 w-full bg-white rounded-xl border border-slate-200 flex items-center px-4 justify-between text-sm font-semibold ${advanceDate ? 'text-slate-700' : 'text-slate-400'}`}>
                                        {advanceDate || "N/A"}
                                        <div className="h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                            <Calendar className="h-4 w-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-500">Advance Amount</Label>
                                <div className="h-12 w-full bg-white rounded-xl border border-slate-200 flex items-center px-4 text-sm font-semibold text-slate-700">
                                    0.0
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Claim Date */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">Claim Date <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <div className={`h-12 w-full bg-white rounded-xl border border-slate-200 flex items-center px-4 justify-between text-sm font-semibold ${claimDate ? 'text-slate-700' : 'text-slate-400'}`}>
                                    {claimDate || "N/A"}
                                    <div className="h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Description */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">Description</Label>
                            <div className="relative">
                                <Textarea
                                    placeholder="Enter description"
                                    className="min-h-[100px] w-full bg-white rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 placeholder:text-slate-400 resize-none focus-visible:ring-0 focus-visible:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Row 4: Claim Category */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">Claim Category <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <div className="h-12 w-full bg-white rounded-xl border border-slate-200 flex items-center px-4 justify-between text-sm font-semibold text-slate-400">
                                    Select category
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {/* Row 5: Details Placeholder */}
                        <div className="space-y-1 pt-2">
                            <Label className="text-xs font-semibold text-slate-700">Claim Details <span className="text-red-500">*</span></Label>
                            <p className="text-[10px] text-slate-400">(Select claim category to add claim details)</p>
                            <Button
                                onClick={() => setIsDetailsOpen(true)}
                                className="w-full h-[50px] text-xl font-bold bg-blue-600 hover:bg-blue-700 mt-2 rounded-lg"
                            >
                                Submit
                            </Button>
                        </div>
                    </div>
                </div>

                <ClaimDetailsSheet
                    isOpen={isDetailsOpen}
                    onClose={() => setIsDetailsOpen(false)}
                    category="Transportation"
                />
            </div>
        </div>
    );
}

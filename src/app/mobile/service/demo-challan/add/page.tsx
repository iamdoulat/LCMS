"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Truck, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function MobileAddDemoChallanPage() {
    const router = useRouter();

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 px-4 pt-4 pb-6 bg-[#0a1e60]">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-950/50 to-transparent pointer-events-none" />
                <div className="relative flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-3 bg-white/10 text-white rounded-2xl active:scale-95 transition-all backdrop-blur-md border border-white/10"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">Add Demo Challan</h1>
                        <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">New Challan</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] mt-2 pb-[80px] shadow-inner overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-4 bg-blue-50 rounded-3xl border border-blue-100/50 shadow-sm">
                            <Truck className="h-8 w-8 text-[#0a1e60]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 leading-tight">Challan Form</h2>
                            <p className="text-sm text-slate-500 font-medium">Fill in the details below</p>
                        </div>
                    </div>

                    <Card className="border-slate-200">
                        <CardContent className="pt-6">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                                <p className="text-sm text-amber-900 font-medium">
                                    <strong>Note:</strong> This mobile form interface is under development.
                                    You are currently viewing the desktop form. For the best experience, please use a desktop browser to add demo challans.
                                </p>
                            </div>

                            <div className="text-center py-12">
                                <p className="text-slate-600 mb-4">Mobile-optimized form coming soon!</p>
                                <button
                                    onClick={() => {
                                        if (typeof window !== 'undefined') {
                                            window.location.href = '/dashboard/demo/demo-machine-challan/create';
                                        }
                                    }}
                                    className="px-6 py-3 bg-[#0a1e60] text-white rounded-xl font-bold hover:bg-blue-900 transition-colors"
                                >
                                    Open Desktop Form
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

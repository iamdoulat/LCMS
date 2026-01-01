"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Clock } from 'lucide-react';

export default function UnderWarrantyPage() {
    const router = useRouter();

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
                    <h1 className="text-xl font-bold text-white ml-2">Under Warranty</h1>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] flex flex-col items-center justify-center px-8 text-center">
                <div className="p-6 bg-emerald-100/50 rounded-[2.5rem] mb-6 relative">
                    <ShieldCheck className="h-16 w-16 text-emerald-600" />
                    <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-lg">
                        <Clock className="h-6 w-6 text-amber-500 animate-pulse" />
                    </div>
                </div>

                <h2 className="text-2xl font-black text-[#0a1e60] mb-3 uppercase tracking-tight">
                    Coming Soon
                </h2>
                <p className="text-slate-500 font-medium leading-relaxed max-w-[280px]">
                    Easily track your machines under warranty. This module is arriving soon!
                </p>

                <div className="mt-12 w-full max-w-[200px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 w-1/3 rounded-full animate-[progress_2s_ease-in-out_infinite]" />
                </div>
            </div>

            <style jsx>{`
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
            `}</style>
        </div>
    );
}

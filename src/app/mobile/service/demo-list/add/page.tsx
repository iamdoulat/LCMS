"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AddDemoMachineForm } from '@/components/forms/demo';

const SewingMachine = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M3 21h18" />
        <path d="M6 21V7c0-1.1.9-2 2-2h11a2 2 0 0 1 2 2v5" />
        <path d="M10 5v4" />
        <path d="M15 5v4" />
        <path d="M12 12h5a2 2 0 0 1 2 2v3" />
        <circle cx="9" cy="12" r="1" />
    </svg>
);

export default function MobileAddDemoMachinePage() {
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
                        <h1 className="text-xl font-black text-white tracking-tight">Add Machine</h1>
                        <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">New Demo Entry</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] mt-2 pb-[80px] shadow-inner overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-100/50 shadow-sm">
                            <SewingMachine className="h-8 w-8 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 leading-tight">Demo Machine Details</h2>
                            <p className="text-sm text-slate-500 font-medium">Fill in the specifications below.</p>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-[2rem] p-4 border border-slate-100">
                        <AddDemoMachineForm />
                    </div>
                </div>
            </div>
        </div>
    );
}

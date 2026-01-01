"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { EditDemoMachineForm } from '@/components/forms/demo';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { DemoMachineDocument } from '@/types';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';

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

export default function MobileEditDemoMachinePage() {
    const params = useParams();
    const router = useRouter();
    const machineId = params.id as string; // The URL param in the folder structure [id]

    const [machineData, setMachineData] = useState<DemoMachineDocument | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMachineData = useCallback(async () => {
        if (!machineId) {
            setError("No Machine ID provided.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const machineDocRef = doc(firestore, "demo_machines", machineId);
            const machineDocSnap = await getDoc(machineDocRef);

            if (machineDocSnap.exists()) {
                setMachineData({ id: machineDocSnap.id, ...machineDocSnap.data() } as DemoMachineDocument);
            } else {
                setError("Machine not found.");
                Swal.fire("Error", "Demo Machine not found.", "error");
            }
        } catch (err: any) {
            console.error("Error fetching machine data:", err);
            setError(`Failed to fetch data: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [machineId]);

    useEffect(() => {
        fetchMachineData();
    }, [fetchMachineData]);

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
                        <h1 className="text-xl font-black text-white tracking-tight">Edit Machine</h1>
                        <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">Update Demo Entry</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] mt-2 pb-[80px] shadow-inner overflow-y-auto">
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="relative">
                                <div className="h-16 w-16 border-4 border-blue-100 border-t-[#0a1e60] rounded-full animate-spin" />
                                <SewingMachine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-[#0a1e60]" />
                            </div>
                            <p className="text-slate-500 font-black animate-pulse">Loading machine details...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                            <div className="h-20 w-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
                                <AlertTriangle className="h-10 w-10 text-rose-500" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">Error Occurred</h3>
                            <p className="text-slate-500 font-medium mb-8">{error}</p>
                            <Button
                                onClick={() => router.back()}
                                className="h-14 px-8 rounded-2xl bg-[#0a1e60] text-white font-black shadow-xl"
                            >
                                Go Back
                            </Button>
                        </div>
                    ) : machineData ? (
                        <>
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-4 bg-blue-50 rounded-3xl border border-blue-100/50 shadow-sm">
                                    <SewingMachine className="h-8 w-8 text-[#0a1e60]" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 leading-tight">
                                        {machineData.machineModel || 'Edit Machine'}
                                    </h2>
                                    <p className="text-sm text-slate-500 font-medium">Update specification or status.</p>
                                </div>
                            </div>

                            <div className="bg-slate-50/50 rounded-[2rem] p-4 border border-slate-100">
                                <EditDemoMachineForm initialData={machineData} machineId={machineData.id} />
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

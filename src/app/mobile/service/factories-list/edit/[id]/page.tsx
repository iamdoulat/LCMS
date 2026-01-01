"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Factory as FactoryIcon, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { EditDemoMachineFactoryForm } from '@/components/forms/demo';
import type { DemoMachineFactoryDocument } from '@/types';
import Swal from 'sweetalert2';

export default function MobileEditDemoMachineFactoryPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [factoryData, setFactoryData] = useState<DemoMachineFactoryDocument | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchFactory = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const docRef = doc(firestore, "demo_machine_factories", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setFactoryData({ id: docSnap.id, ...docSnap.data() } as DemoMachineFactoryDocument);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Not Found',
                        text: 'Factory not found',
                        confirmButtonColor: '#0a1e60'
                    }).then(() => router.back());
                }
            } catch (error) {
                console.error("Error fetching factory:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to load factory details',
                    confirmButtonColor: '#0a1e60'
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchFactory();
    }, [id, router]);

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
                        <h1 className="text-xl font-black text-white tracking-tight">Edit Factory</h1>
                        <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">Update Details</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] mt-2 pb-[80px] shadow-inner overflow-y-auto">
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-[#0a1e60]" />
                            <p className="text-slate-500 font-bold text-sm">Loading details...</p>
                        </div>
                    ) : factoryData ? (
                        <>
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-4 bg-blue-50 rounded-3xl border border-blue-100/50 shadow-sm">
                                    <FactoryIcon className="h-8 w-8 text-[#0a1e60]" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h2 className="text-xl font-black text-slate-900 leading-tight truncate">{factoryData.factoryName}</h2>
                                    <p className="text-sm text-slate-500 font-medium truncate">{factoryData.groupName || 'No Group'}</p>
                                </div>
                            </div>

                            <div className="bg-slate-50/50 rounded-[2rem] p-4 border border-slate-100">
                                <EditDemoMachineFactoryForm initialData={factoryData} factoryId={id} />
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

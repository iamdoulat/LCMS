"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Truck, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { DemoChallanDocument } from '@/types';
import Swal from 'sweetalert2';

export default function MobileEditDemoChallanPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [challanData, setChallanData] = useState<DemoChallanDocument | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchChallan = async () => {
            if (!id) return;
            setIsLoading(true);
            setError(null);

            try {
                const docRef = doc(firestore, "demo_machine_challans", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setChallanData({
                        id: docSnap.id,
                        ...data
                    } as DemoChallanDocument);
                } else {
                    setError("Challan not found");
                    Swal.fire({
                        icon: 'error',
                        title: 'Not Found',
                        text: 'Demo challan not found',
                        confirmButtonColor: '#0a1e60'
                    }).then(() => router.back());
                }
            } catch (err: any) {
                console.error("Error fetching challan:", err);
                setError(`Failed to load: ${err.message}`);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to load challan details',
                    confirmButtonColor: '#0a1e60'
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchChallan();
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
                    <div className="flex-1 overflow-hidden">
                        <h1 className="text-xl font-black text-white tracking-tight truncate">Edit Challan</h1>
                        <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">ID: {id}</p>
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
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <AlertTriangle className="h-10 w-10 text-red-500" />
                            <p className="text-slate-700 font-bold text-sm text-center">{error}</p>
                        </div>
                    ) : challanData ? (
                        <>
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-4 bg-blue-50 rounded-3xl border border-blue-100/50 shadow-sm">
                                    <Truck className="h-8 w-8 text-[#0a1e60]" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h2 className="text-xl font-black text-slate-900 leading-tight truncate">{challanData.factoryName || 'N/A'}</h2>
                                    <p className="text-sm text-slate-500 font-medium">Challan: {challanData.id}</p>
                                </div>
                            </div>

                            <Card className="border-slate-200">
                                <CardContent className="pt-6">
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                                        <p className="text-sm text-amber-900 font-medium">
                                            <strong>Note:</strong> This mobile form interface is under development.
                                            You are currently viewing a redirect page. For the best experience, please use a desktop browser to edit demo challans.
                                        </p>
                                    </div>

                                    <div className="text-center py-12">
                                        <p className="text-slate-600 mb-4">Mobile-optimized edit form coming soon!</p>
                                        <button
                                            onClick={() => {
                                                if (typeof window !== 'undefined') {
                                                    window.location.href = `/dashboard/demo/demo-machine-challan/edit/${id}`;
                                                }
                                            }}
                                            className="px-6 py-3 bg-[#0a1e60] text-white rounded-xl font-bold hover:bg-blue-900 transition-colors"
                                        >
                                            Open Desktop Edit Form
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

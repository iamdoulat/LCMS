
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit3, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ErrorCodeForm } from '@/components/warranty/ErrorCodeForm';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { ErrorCodeRecord } from '@/types/warranty';
import Swal from 'sweetalert2';

export default function MobileEditErrorCodePage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const { userRole } = useAuth();
    const [record, setRecord] = useState<ErrorCodeRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userRole && !userRole.includes('Admin') && !userRole.includes('Service') && !userRole.includes('Super Admin')) {
            Swal.fire("Access Denied", "You do not have permission to edit error codes.", "error");
            router.push('/mobile/service/error-codes');
            return;
        }

        const fetchRecord = async () => {
            try {
                const docSnap = await getDoc(doc(firestore, 'error_codes', id));
                if (docSnap.exists()) {
                    setRecord({ id: docSnap.id, ...docSnap.data() } as ErrorCodeRecord);
                } else {
                    Swal.fire("Error", "Record not found", "error");
                    router.push('/mobile/service/error-codes');
                }
            } catch (error) {
                console.error("Error fetching record:", error);
                Swal.fire("Error", "Failed to load record data", "error");
            } finally {
                setIsLoading(false);
            }
        };

        if (id) fetchRecord();
    }, [userRole, router, id]);

    return (
        <div className="flex flex-col h-full bg-[#0a1e60] overflow-hidden">
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
                        <h1 className="text-2xl font-black text-white tracking-tight">Edit Error Code</h1>
                        <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">Update Guide</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] shadow-inner p-6 pb-32 overflow-y-auto">
                <div className="max-w-md mx-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                            <Loader2 className="h-10 w-10 animate-spin text-[#0a1e60]" />
                            <p className="font-bold text-sm text-slate-500">Retrieving record...</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-8 flex items-center gap-4 p-4 bg-amber-50 rounded-3xl border border-amber-100/50">
                                <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center text-amber-600 shadow-sm">
                                    <Edit3 className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-amber-600/60 uppercase tracking-wider">Editing Mode</p>
                                    <p className="text-[11px] font-medium text-slate-500 leading-tight">Updating: <span className="text-slate-800 font-bold">{record?.errorCode}</span></p>
                                </div>
                            </div>
                            {record && <ErrorCodeForm initialData={record} isEdit={true} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

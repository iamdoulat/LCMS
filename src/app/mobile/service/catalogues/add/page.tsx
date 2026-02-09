
"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CatalogueForm } from '@/components/warranty/CatalogueForm';
import Swal from 'sweetalert2';

export default function MobileAddCataloguePage() {
    const router = useRouter();
    const { userRole } = useAuth();

    useEffect(() => {
        if (userRole && !userRole.includes('Admin') && !userRole.includes('Service') && !userRole.includes('Super Admin') && !userRole.includes('Supervisor')) {
            Swal.fire("Access Denied", "You do not have permission to add catalogues.", "error");
            router.push('/mobile/service/catalogues');
        }
    }, [userRole, router]);

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
                        <h1 className="text-2xl font-black text-white tracking-tight">Add Catalogue</h1>
                        <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">New Technical Resource</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] shadow-inner p-6 pb-32 overflow-y-auto">
                <div className="max-w-md mx-auto">
                    <div className="mb-8 flex items-center gap-4 p-4 bg-blue-50 rounded-3xl border border-blue-100/50">
                        <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center text-blue-600 shadow-sm">
                            <BookOpen className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-blue-600/60 uppercase tracking-wider">Instructions</p>
                            <p className="text-[11px] font-medium text-slate-500 leading-tight">Fill in the details below to add a new machinery catalogue.</p>
                        </div>
                    </div>

                    <CatalogueForm />
                </div>
            </div>
        </div>
    );
}

"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { AddItemForm } from '@/components/forms/inventory/AddItemForm';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MobileAddItemPage() {
    const router = useRouter();
    const { user, userRole } = useAuth();

    // Permission Check
    const isAllowed = React.useMemo(() => {
        if (!userRole) return false;
        return userRole.some(role => ['Super Admin', 'Admin', 'Accountant'].includes(role));
    }, [userRole]);

    if (!user) {
        return (
            <div className="flex flex-col h-screen bg-slate-50 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                <p className="text-slate-500">Checking authentication...</p>
            </div>
        );
    }

    if (!isAllowed) {
        return (
            <div className="flex flex-col h-screen bg-slate-50">
                <div className="sticky top-0 z-50 bg-[#0a1e60]">
                    <div className="flex items-center justify-between px-4 pt-[5px] pb-6 relative">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors z-10 shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-4 pb-6">Error</h1>
                        <div className="w-10"></div>
                    </div>
                </div>
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                    <div className="bg-red-100 p-4 rounded-full text-red-600 mb-4">
                        <AlertTriangle className="h-8 w-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
                    <p className="text-slate-500 mb-6">You don't have permission to add new items. Only Admins and Accountants can perform this action.</p>
                    <Button onClick={() => router.back()} className="rounded-full px-8">
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-[5px] pb-6 relative">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors z-10 shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-4 pb-6">Add New Item</h1>
                    <div className="w-10"></div>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col relative">
                <div className="flex-1 overflow-y-auto px-5 py-6 pb-[100px]">
                    <div className="mobile-add-form-wrapper">
                        <AddItemForm />
                    </div>
                </div>
            </div>

            {/* Styles to override some desktop-specific UI if needed */}
            <style jsx global>{`
                .mobile-add-form-wrapper .card {
                    box-shadow: none !important;
                    border: none !important;
                    background: transparent !important;
                }
                .mobile-add-form-wrapper .card-content {
                    padding: 0 !important;
                }
            `}</style>
        </div>
    );
}

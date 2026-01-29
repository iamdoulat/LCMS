"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { EditItemForm } from '@/components/forms/inventory/EditItemForm';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { ItemDocument } from '@/types';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function MobileEditItemPage() {
    const params = useParams();
    const router = useRouter();
    const { user, userRole } = useAuth();
    const itemId = params.id as string; // Note: folder is [id], so param is id

    const [itemData, setItemData] = useState<ItemDocument | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Permission Check
    const isAllowed = React.useMemo(() => {
        if (!userRole) return false;
        return userRole.some(role => ['Super Admin', 'Admin', 'Accountant'].includes(role));
    }, [userRole]);

    useEffect(() => {
        const fetchItemData = async () => {
            if (!user) return; // Wait for auth

            if (!isAllowed) {
                setError("You do not have permission to edit items.");
                setIsLoading(false);
                return;
            }

            if (!itemId) {
                setError("No Item ID provided.");
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const itemDocRef = doc(firestore, "items", itemId);
                const itemDocSnap = await getDoc(itemDocRef);

                if (itemDocSnap.exists()) {
                    setItemData({ id: itemDocSnap.id, ...itemDocSnap.data() } as ItemDocument);
                } else {
                    setError("Item not found.");
                }
            } catch (err: any) {
                console.error("Error fetching item data: ", err);
                setError(`Failed to fetch item data: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchItemData();
    }, [itemId, user, isAllowed]);


    if (isLoading) {
        return (
            <div className="flex flex-col h-screen bg-slate-50">
                <div className="sticky top-0 z-50 bg-[#0a1e60]">
                    <div className="flex items-center justify-between px-4 pt-4 pb-6 relative">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors z-10 shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-4 pb-6">Edit Item</h1>
                        <div className="w-10"></div>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>Loading item details...</p>
                </div>
            </div>
        );
    }

    if (error || !isAllowed) {
        return (
            <div className="flex flex-col h-screen bg-slate-50">
                <div className="sticky top-0 z-50 bg-[#0a1e60]">
                    <div className="flex items-center justify-between px-4 pt-4 pb-6 relative">
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
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied / Error</h2>
                    <p className="text-slate-500 mb-6">{error || "You don't have permission to access this page."}</p>
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
                <div className="flex items-center justify-between px-4 pt-4 pb-6 relative">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors z-10 shadow-[0_4px_12px_rgba(0,0,0,0.4)] bg-[#1a2b6d]"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-4 pb-6">Edit Item</h1>
                    <div className="w-10"></div>
                </div>
            </div>

            {/* Content Container */}
            <div className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col relative">
                <div className="flex-1 overflow-y-auto px-5 py-6 pb-[100px]">
                    {itemData && (
                        <div className="mobile-edit-form-wrapper">
                            <EditItemForm initialData={itemData} itemId={itemId} />
                        </div>
                    )}
                </div>
            </div>

            {/* Styles to override some desktop-specific padding in the form if needed, though form looks mostly fluid */}
            <style jsx global>{`
                .mobile-edit-form-wrapper .card {
                    box-shadow: none !important;
                    border: none !important;
                }
            `}</style>
        </div>
    );
}

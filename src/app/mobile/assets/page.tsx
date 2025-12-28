"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AssetRequestSheet } from '@/components/mobile/AssetRequestSheet';

export default function AssetsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'assigned' | 'requested' | 'requisition'>('assigned');
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);
    const [isRequestSheetOpen, setIsRequestSheetOpen] = useState(false);

    // Swipe logic
    const handleTouchStart = (e: React.TouchEvent) => {
        setStartX(e.touches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setCurrentX(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
        const diff = startX - currentX;
        const threshold = 50;

        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // Swipe Left -> Next Tab
                if (activeTab === 'assigned') setActiveTab('requested');
                else if (activeTab === 'requested') setActiveTab('requisition');
            } else {
                // Swipe Right -> Prev Tab
                if (activeTab === 'requisition') setActiveTab('requested');
                else if (activeTab === 'requested') setActiveTab('assigned');
            }
        }
        setStartX(0);
        setCurrentX(0);
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0a1e60]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-6 sticky top-0 z-50 bg-[#0a1e60]">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors z-10"
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-4 pb-5">Assets</h1>
                <div className="w-10"></div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-[#f8fafc] rounded-t-[2rem] overflow-hidden flex flex-col relative w-full">
                {/* Tabs */}
                <div className="flex items-center justify-evenly pt-6 pb-2 border-b border-slate-100 bg-white rounded-t-[2rem]">
                    {(['assigned', 'requested', 'requisition'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "pb-3 relative text-sm font-semibold transition-colors capitalize px-4 border-b-2",
                                activeTab === tab ? "text-blue-600 border-blue-600" : "text-blue-200 border-transparent"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div
                    className="flex-1 p-5 overflow-y-auto"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {activeTab === 'assigned' && (
                        <Card className="relative p-0 rounded-2xl border-none shadow-[0_2px_8px_rgba(0,0,0,0.08)] bg-white overflow-hidden">
                            <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#6C5DD3] rounded-r-full" />
                            <div className="p-4 pl-5 space-y-3">
                                <div className="inline-flex px-2.5 py-1 bg-[#F3F0FF] text-[#6C5DD3] text-[10px] font-bold rounded-lg border border-[#E5DEFF]">
                                    Occupied
                                </div>
                                <div>
                                    <h3 className="text-slate-700 font-bold text-base">Sim Card 01777798986</h3>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                                    <span className="text-[#6C5DD3]">1 Oct - N/A</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span>0 (Days)</span>
                                </div>
                                <div className="pt-2">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg text-xs font-bold text-slate-600">
                                        <CreditCard className="h-3.5 w-3.5 text-yellow-600" />
                                        Sim Card
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'requested' && (
                        <div className="h-full flex items-center justify-center">
                            <p className="text-slate-500 text-sm">No data to show</p>

                            {/* FAB */}
                            <Button
                                onClick={() => setIsRequestSheetOpen(true)}
                                className="h-12 w-12 rounded-full bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-200 absolute right-5 bottom-[108px] z-50 p-0 flex items-center justify-center"
                            >
                                <Plus className="h-6 w-6 text-white" />
                            </Button>
                        </div>
                    )}

                    {activeTab === 'requisition' && (
                        <div className="h-full flex items-center justify-center">
                            <p className="text-slate-500 text-sm">No data to show</p>
                        </div>
                    )}
                </div>

                <AssetRequestSheet
                    isOpen={isRequestSheetOpen}
                    onClose={() => setIsRequestSheetOpen(false)}
                />
            </div>
        </div>
    );
}

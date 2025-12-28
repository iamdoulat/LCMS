"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MobileClaimPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'My Claims' | 'Claim Requests'>('My Claims');

    // Swipe Handling
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe && activeTab === 'My Claims') {
            setActiveTab('Claim Requests');
        }
        if (isRightSwipe && activeTab === 'Claim Requests') {
            setActiveTab('My Claims');
        }
    };


    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="flex items-center justify-between px-4 pt-4 pb-6 relative">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors z-10"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-bold text-white absolute inset-0 flex items-center justify-center pointer-events-none pt-4 pb-6">Claim</h1>
                    <div className="w-10" /> {/* Spacer for centering */}
                </div>
            </div>

            <div
                className="flex-1 bg-slate-50 rounded-t-[2rem] overflow-hidden flex flex-col relative"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >

                {/* Tabs Section */}
                <div className="bg-white px-6 pt-6 pb-2 rounded-t-[2rem] shadow-sm z-10 shrink-0">
                    <div className="flex items-center justify-between p-1 bg-white rounded-full mb-4">
                        {['My Claims', 'Claim Requests'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`flex-1 py-3 text-sm font-bold transition-all duration-200 ${activeTab === tab
                                    ? 'text-blue-600'
                                    : 'text-blue-300 hover:text-blue-400'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    {activeTab === tab && (
                                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                    )}
                                    {tab}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 pb-24 overscroll-contain flex flex-col items-center justify-center">
                    <p className="text-slate-500">No data to show</p>
                </div>

                {/* Floating Action Button - Positioned 20px above Navbar (approx 99px from bottom) */}
                <Button
                    className="absolute bottom-[99px] right-6 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl flex items-center justify-center z-50 transition-transform active:scale-95 text-white"
                    onClick={() => {
                        router.push('/mobile/claim/create');
                    }}
                >
                    <Plus className="h-8 w-8" />
                </Button>
            </div>
        </div>
    );
}

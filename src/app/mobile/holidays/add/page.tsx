"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { AddHolidayForm } from '@/components/forms/hr/AddHolidayForm';

export default function MobileAddHolidayPage() {
    const router = useRouter();

    const handleBack = () => {
        router.push('/mobile/holidays');
    };

    const handleSuccess = () => {
        router.push('/mobile/holidays');
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#0a1e60]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0a1e60] flex items-center px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-6 text-white">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    className="rounded-full bg-white/10 hover:bg-white/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] h-10 w-10 p-0 flex items-center justify-center -ml-1"
                >
                    <ArrowLeft className="h-9 w-9" />
                </Button>
                <h1 className="text-xl font-bold ml-3">Add Holiday</h1>
            </header>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-hidden p-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <AddHolidayForm onFormSubmit={handleSuccess} />
                </div>
            </div>
        </div>
    );
}

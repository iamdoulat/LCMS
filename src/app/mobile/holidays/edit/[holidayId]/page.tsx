"use client";

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { EditHolidayForm } from '@/components/forms/hr/EditHolidayForm';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { HolidayDocument } from '@/types';

export default function MobileEditHolidayPage() {
    const router = useRouter();
    const params = useParams();
    const holidayId = params.holidayId as string;

    const [holiday, setHoliday] = React.useState<HolidayDocument | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        async function fetchHoliday() {
            if (!holidayId) return;
            try {
                const docRef = doc(firestore, 'holidays', holidayId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setHoliday({ id: docSnap.id, ...docSnap.data() } as HolidayDocument);
                } else {
                    console.error("No such holiday!");
                }
            } catch (err) {
                console.error("Error fetching holiday:", err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchHoliday();
    }, [holidayId]);

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
                <h1 className="text-xl font-bold ml-3">Edit Holiday</h1>
            </header>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-hidden p-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center pt-20">
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-4" />
                        <p className="text-slate-500 font-medium">Loading holiday details...</p>
                    </div>
                ) : holiday ? (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <EditHolidayForm initialData={holiday} onFormSubmit={handleSuccess} />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center pt-20 text-slate-400 font-medium">
                        Holiday not found.
                    </div>
                )}
            </div>
        </div>
    );
}

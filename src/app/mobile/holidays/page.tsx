"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { firestore } from '@/lib/firebase/config';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import {
    ArrowLeft,
    Calendar,
    Palmtree,
    Loader2,
    Plus,
    Edit2
} from 'lucide-react';
import type { HolidayDocument } from '@/types';
import { format, parseISO } from 'date-fns';

export default function MobileHolidaysPage() {
    const router = useRouter();

    const { data: holidays, isLoading } = useFirestoreQuery<HolidayDocument[]>(
        query(collection(firestore, 'holidays'), orderBy('fromDate', 'asc')),
        undefined,
        ['mobile_holidays_page']
    );

    const handleBack = () => {
        router.back();
    };

    const handleAdd = () => {
        router.push('/mobile/holidays/add');
    };

    const handleEdit = (id: string) => {
        router.push(`/mobile/holidays/edit/${id}`);
    };

    // Group holidays by Year/Month
    const groupedHolidays = React.useMemo(() => {
        if (!holidays) return [];

        const groups: { [key: string]: HolidayDocument[] } = {};
        holidays.forEach(h => {
            const date = parseISO(h.fromDate);
            const key = format(date, 'MMMM yyyy');
            if (!groups[key]) groups[key] = [];
            groups[key].push(h);
        });

        return Object.entries(groups).map(([month, list]) => ({ month, list }));
    }, [holidays]);

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#0a1e60] flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-6 text-white">
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBack}
                        className="rounded-full bg-white/10 hover:bg-white/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] h-10 w-10 p-0 flex items-center justify-center -ml-1"
                    >
                        <ArrowLeft className="h-9 w-9" />
                    </Button>
                    <h1 className="text-xl font-bold ml-3">Company Holidays</h1>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleAdd}
                    className="rounded-full bg-white/10 hover:bg-white/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] h-10 w-10 p-0 flex items-center justify-center"
                >
                    <Plus className="h-9 w-9" />
                </Button>
            </header>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-hidden relative">
                <div className="h-full overflow-y-auto px-6 pt-10 pb-[120px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center pt-20">
                            <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Loading holidays...</p>
                        </div>
                    ) : groupedHolidays.length > 0 ? (
                        <div className="space-y-8">
                            {groupedHolidays.map((group) => (
                                <div key={group.month}>
                                    <h2 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider px-1">
                                        {group.month}
                                    </h2>
                                    <div className="space-y-3">
                                        {group.list.map((holiday) => {
                                            const fromDate = parseISO(holiday.fromDate);
                                            const toDate = holiday.toDate ? parseISO(holiday.toDate) : null;

                                            return (
                                                <div
                                                    key={holiday.id}
                                                    className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 flex items-center gap-4 active:scale-95 transition-transform"
                                                >
                                                    <div className="bg-rose-50 h-14 w-14 rounded-xl flex flex-col items-center justify-center text-rose-600 border border-rose-100 flex-shrink-0">
                                                        <span className="text-[10px] font-bold uppercase leading-none mb-1">{format(fromDate, 'MMM')}</span>
                                                        <span className="text-xl font-bold leading-none">{format(fromDate, 'dd')}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="font-bold text-slate-800 text-sm leading-tight">{holiday.name}</h3>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(holiday.id)}
                                                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1 capitalize">
                                                            {holiday.type} • {format(fromDate, 'MMM dd, yyyy')}{toDate ? ` - ${format(toDate, 'MMM dd, yyyy')}` : ''}
                                                        </p>
                                                        {holiday.announcementDate && (
                                                            <p className="text-[10px] text-emerald-600 font-medium mt-1 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                                                                Announcement: {format(parseISO(holiday.announcementDate), 'MMM dd, yyyy hh:mm a')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center pt-20 text-slate-400">
                            <div className="bg-slate-100 p-6 rounded-full mb-4">
                                <Calendar className="h-10 w-10 text-slate-300" />
                            </div>
                            <p className="font-medium">No holidays scheduled yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

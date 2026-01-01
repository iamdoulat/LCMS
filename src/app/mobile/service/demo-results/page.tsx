"use client";

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Info, Laptop, Calendar, User, Tag, Hash, Search, ChevronRight, Settings2, FileEdit } from 'lucide-react';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { DemoMachineDocument } from '@/types';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function DemoResultsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const q = searchParams.get('q') || '';

    const [isLoading, setIsLoading] = useState(true);
    const [results, setResults] = useState<any[]>([]);

    const fetchDemoResults = useCallback(async (searchTerm: string) => {
        const lowerQ = searchTerm.toLowerCase();
        const machinesRef = collection(firestore, "demo_machines");
        const qSnap = await getDocs(query(machinesRef, orderBy("createdAt", "desc")));

        const allMachines = qSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Fix date parsing by ensuring it's a string or handled correctly
                createdAt: (data.createdAt as any) instanceof Timestamp ? (data.createdAt as any).toDate().toISOString() : data.createdAt
            } as DemoMachineDocument;
        });

        return allMachines.filter(m =>
            m.machineModel?.toLowerCase().includes(lowerQ) ||
            m.machineSerial?.toLowerCase().includes(lowerQ) ||
            m.machineBrand?.toLowerCase().includes(lowerQ) ||
            m.machineOwner?.toLowerCase().includes(lowerQ) ||
            m.currentStatus?.toLowerCase().includes(lowerQ)
        ).map(m => ({
            id: m.id,
            model: m.machineModel || 'N/A',
            serial: m.machineSerial || 'N/A',
            brand: m.machineBrand || 'N/A',
            owner: m.machineOwner || 'N/A',
            status: m.currentStatus || 'Unknown',
            ctlBoxModel: m.motorOrControlBoxModel || 'N/A',
            ctlBoxSerial: m.controlBoxSerialNo || 'N/A',
            statusColor: m.currentStatus === 'Available' ? 'success' : m.currentStatus === 'Allocated' ? 'warning' : 'destructive',
            date: m.createdAt
        }));
    }, []);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const res = await fetchDemoResults(q);
                setResults(res);
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [q, fetchDemoResults]);

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-[#0a1e60] text-white pt-1 pb-6 px-4 shrink-0">
                <div className="flex items-center mb-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold ml-2 text-white">Demo M/C Results</h1>
                </div>
                <div className="flex items-center gap-2 text-white/70 text-sm bg-white/10 px-4 py-2 rounded-xl">
                    <Search className="h-4 w-4" />
                    <span>Results for &quot;{q}&quot;</span>
                </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 pb-[150px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        <p className="text-slate-500 font-medium">Fetching details...</p>
                    </div>
                ) : results.length > 0 ? (
                    <div className="space-y-4">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">
                            Showing {results.length} matching entries
                        </p>
                        {results.map((item) => (
                            <Card key={item.id} className="border-none shadow-sm rounded-3xl overflow-hidden active:scale-[0.98] transition-all bg-white">
                                <CardContent className="p-0">
                                    <div className="p-5 flex flex-col gap-5">
                                        {/* Top Row: Model & Status */}
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                                                    <Laptop className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-extrabold text-slate-900 text-lg leading-tight">{item.model}</h3>
                                                    <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                                                        <Tag className="h-3.5 w-3.5" />
                                                        <span className="text-xs font-semibold">{item.brand}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge className={cn(
                                                "rounded-xl px-3 py-1.5 text-[10px] uppercase tracking-wider font-black shadow-sm shrink-0",
                                                item.statusColor === 'success' && "bg-emerald-500 text-white hover:bg-emerald-600",
                                                item.statusColor === 'warning' && "bg-amber-500 text-white hover:bg-amber-600",
                                                item.statusColor === 'destructive' && "bg-rose-500 text-white hover:bg-rose-600"
                                            )}>
                                                {item.status}
                                            </Badge>
                                        </div>

                                        {/* Grid Data */}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-5 bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100">
                                            <div className="space-y-1">
                                                <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Machine S/N</span>
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Hash className="h-3.5 w-3.5 text-blue-500" />
                                                    <span className="text-sm font-bold truncate">{item.serial}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Owner</span>
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <User className="h-3.5 w-3.5 text-blue-500" />
                                                    <span className="text-sm font-bold truncate">{item.owner}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Ctl. Box Model</span>
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Settings2 className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="text-sm font-bold truncate">{item.ctlBoxModel}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Ctl. Box S/N</span>
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Hash className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="text-sm font-bold truncate">{item.ctlBoxSerial}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Action Row */}
                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex items-center gap-2 px-2">
                                                <Calendar className="h-4 w-4 text-slate-400" />
                                                <span className="text-xs font-medium text-slate-500">
                                                    {item.date ? (isValid(parseISO(item.date)) ? format(parseISO(item.date), 'dd MMM yyyy') : 'N/A') : 'N/A'}
                                                </span>
                                            </div>
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs h-10 px-5 flex items-center gap-2 shadow-lg shadow-slate-200"
                                                onClick={() => router.push(`/dashboard/demo/edit-demo-machine/${item.id}`)}
                                            >
                                                <FileEdit className="h-3.5 w-3.5" />
                                                Edit Detail
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center px-10">
                        <div className="bg-white p-6 rounded-full border border-slate-100 shadow-sm mb-6">
                            <Info className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-800 mb-2">No matching records</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">We couldn&apos;t find any demo machine records matching &quot;{q}&quot;.</p>
                        <Button
                            variant="outline"
                            className="mt-8 rounded-2xl px-8 py-6 h-auto border-slate-200 text-slate-600 font-bold"
                            onClick={() => router.back()}
                        >
                            Try Another Search
                        </Button>
                    </div>
                )}

                {/* Bottom Spacer */}
                <div className="h-[120px]" />
            </div>
        </div>
    );
}

export default function DemoResultsPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <p className="text-slate-400 font-medium">Loading search engine...</p>
            </div>
        }>
            <DemoResultsContent />
        </Suspense>
    );
}

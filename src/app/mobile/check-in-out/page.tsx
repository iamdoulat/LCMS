"use client";

import React, { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft, Filter } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { MobileCheckInOutModal } from '@/components/mobile/MobileCheckInOutModal';
import { type MultipleCheckInOutRecord } from '@/types/checkInOut';
import { useRouter } from 'next/navigation';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, X, Search, MapPin, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { startOfDay, endOfDay } from 'date-fns';

interface GroupedRecords {
    date: string;
    records: MultipleCheckInOutRecord[];
}


export default function MobileCheckInOutPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'Check Ins' | 'Completed' | 'Supervision'>('Check Ins');
    const [records, setRecords] = useState<MultipleCheckInOutRecord[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [checkInOutType, setCheckInOutType] = useState<'Check In' | 'Check Out'>('Check In');
    const [lastRecord, setLastRecord] = useState<MultipleCheckInOutRecord | null>(null);

    // Supervision & Filtering
    const { isSupervisor, supervisedEmployeeIds } = useSupervisorCheck(user?.email);
    const [supervisionRecords, setSupervisionRecords] = useState<MultipleCheckInOutRecord[]>([]);
    const [filteredSupervisionRecords, setFilteredSupervisionRecords] = useState<MultipleCheckInOutRecord[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterEmployeeName, setFilterEmployeeName] = useState('');
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [selectedRecordForAction, setSelectedRecordForAction] = useState<MultipleCheckInOutRecord | null>(null);


    // Fetch Records
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(firestore, 'multiple_check_inout'),
            where('employeeId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MultipleCheckInOutRecord));
            // Sort client-side by timestamp desc
            data.sort((a, b) => {
                const tA = new Date(a.timestamp).getTime();
                const tB = new Date(b.timestamp).getTime();
                return tB - tA;
            });
            setRecords(data);
            if (data.length > 0) {
                setLastRecord(data[0]);
            } else {
                setLastRecord(null);
            }
        });

        return () => unsubscribe();
    }, [user]);

    // Fetch Supervision Records
    useEffect(() => {
        const fetchSupervisionData = async () => {
            if (!isSupervisor || supervisedEmployeeIds.length === 0 || activeTab !== 'Supervision') return;

            try {
                const chunks = [];
                for (let i = 0; i < supervisedEmployeeIds.length; i += 10) {
                    chunks.push(supervisedEmployeeIds.slice(i, i + 10));
                }

                let allSupRecords: MultipleCheckInOutRecord[] = [];
                for (const chunk of chunks) {
                    const q = query(
                        collection(firestore, 'multiple_check_inout'),
                        where('employeeId', 'in', chunk)
                    );
                    const snap = await getDocs(q);
                    snap.docs.forEach(doc => allSupRecords.push({ id: doc.id, ...doc.data() } as MultipleCheckInOutRecord));
                }

                allSupRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setSupervisionRecords(allSupRecords);
                setFilteredSupervisionRecords(allSupRecords);
            } catch (err) {
                console.error("Error fetching supervision records:", err);
            }
        };

        fetchSupervisionData();
    }, [isSupervisor, supervisedEmployeeIds, activeTab]);

    const applyFilters = () => {
        let filtered = [...supervisionRecords];

        if (filterEmployeeName) {
            const lowerName = filterEmployeeName.toLowerCase();
            filtered = filtered.filter(r =>
                (r.employeeName?.toLowerCase().includes(lowerName))
            );
        }


        if (filterFromDate) {
            const from = startOfDay(new Date(filterFromDate)).getTime();
            filtered = filtered.filter(r => new Date(r.timestamp).getTime() >= from);
        }

        if (filterToDate) {
            const to = endOfDay(new Date(filterToDate)).getTime();
            filtered = filtered.filter(r => new Date(r.timestamp).getTime() <= to);
        }

        setFilteredSupervisionRecords(filtered);
        setIsFilterOpen(false);
    };


    const handleAddClick = () => {
        setCheckInOutType('Check In');
        setSelectedRecordForAction(null);
        setIsModalOpen(true);
    };

    const handleCheckOutClick = (record: MultipleCheckInOutRecord) => {
        setCheckInOutType('Check Out');
        setSelectedRecordForAction(record);
        setIsModalOpen(true);
    };


    const groupRecordsByDate = (records: MultipleCheckInOutRecord[]): GroupedRecords[] => {
        const groups: { [key: string]: MultipleCheckInOutRecord[] } = {};
        records.forEach(record => {
            const dateStr = format(new Date(record.timestamp), 'dd-MM-yyyy');
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(record);
        });
        return Object.keys(groups).sort((a, b) => {
            const [d1, m1, y1] = a.split('-');
            const [d2, m2, y2] = b.split('-');
            return new Date(`${y2}-${m2}-${d2}`).getTime() - new Date(`${y1}-${m1}-${d1}`).getTime();
        }).map(date => ({
            date,
            records: groups[date]
        }));
    };

    const renderContent = () => {
        // Logics for different tabs
        let recordsToDisplay: MultipleCheckInOutRecord[] = [];

        if (activeTab === 'Check Ins') {
            const latestByCompany: Record<string, MultipleCheckInOutRecord> = {};
            [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).forEach(r => {
                latestByCompany[r.companyName] = r;
            });
            recordsToDisplay = Object.values(latestByCompany).filter(r => r.type === 'Check In');
            // Sort desc
            recordsToDisplay.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } else if (activeTab === 'Completed') {
            recordsToDisplay = records;
        } else {
            recordsToDisplay = filteredSupervisionRecords;
        }

        if (recordsToDisplay.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
                    <p>No data to show</p>
                </div>
            );
        }

        const grouped = groupRecordsByDate(recordsToDisplay);

        return (
            <div className="px-5 py-4 space-y-8 pb-24">
                {grouped.map((group) => (
                    <div key={group.date}>
                        <h3 className="text-[#0a1e60] font-bold text-base mb-6">{group.date}</h3>
                        <div className="relative">
                            {group.records.map((record, idx) => {
                                const timeStr = format(new Date(record.timestamp), 'hh:mm a');
                                const isCheckIn = record.type === 'Check In';

                                return (
                                    <div key={record.id} className="flex gap-4 mb-6 last:mb-0 relative">
                                        <div className="w-20 pt-1 flex flex-col items-center shrink-0">
                                            <span className="text-xs font-semibold text-slate-500">{timeStr}</span>
                                            <div className="flex-1 flex flex-col items-center justify-start gap-1.5 mt-2 opacity-30">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                            </div>
                                        </div>

                                        <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-3 relative overflow-hidden">
                                            <div className="h-12 w-12 rounded-xl bg-slate-100 shrink-0 overflow-hidden relative">
                                                {record.imageURL ? (
                                                    <Image src={record.imageURL} alt="Visit" fill className="object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-slate-400">
                                                        <MapPin className="h-5 w-5" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0 py-0.5">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold text-[#0a1e60] text-sm truncate pr-2">{record.companyName}</h4>
                                                    {!isCheckIn && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border text-green-600 border-green-100 bg-green-50">
                                                            DONE
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mb-2 truncate">{record.remarks || 'No remarks'}</p>

                                                <div className="text-[10px] text-slate-500 leading-tight flex items-start gap-1">
                                                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2">{record.location?.address || 'Address not captured'}</span>
                                                </div>

                                                {activeTab === 'Supervision' && (
                                                    <div className="mt-3 pt-2 border-t border-slate-50 flex items-center gap-2">
                                                        <div className="h-5 w-5 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[8px] font-bold text-slate-500">
                                                            {record.employeeName?.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="text-[11px] font-semibold text-slate-700 truncate">{record.employeeName}</span>
                                                        <span className={`ml-auto text-[9px] font-bold px-1.5 rounded border ${isCheckIn ? 'text-blue-600 border-blue-100 bg-blue-50' : 'text-green-600 border-green-100 bg-green-50'}`}>
                                                            {record.type}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {activeTab === 'Check Ins' && (
                                                <div className="flex flex-col justify-center pl-1 border-l border-dashed border-slate-100">
                                                    <button
                                                        onClick={() => handleCheckOutClick(record)}
                                                        className="h-10 w-10 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 transition-colors"
                                                    >
                                                        <ArrowRight className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };


    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Custom Header matching image */}
            <div className="bg-[#0a1e60] text-white pt-safe-top pb-4 px-4 sticky top-0 z-20">
                <div className="flex items-center justify-between h-14">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 -ml-2">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-lg font-bold">Check In/Out</h1>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsFilterOpen(true)}
                        className={`text-white hover:bg-white/10 -mr-2 ${activeTab !== 'Supervision' ? 'opacity-0 pointer-events-none' : ''}`}
                    >
                        <Filter className="h-5 w-5" />
                    </Button>
                </div>
            </div>


            {/* Correct Tab Layout based on image */}
            <div className="bg-white shadow-sm z-10 absolute top-[88px] left-0 right-0 hidden">
                {/* Just hiding previous attempt */}
            </div>
            <div className="bg-white px-2 py-3 shadow-sm sticky top-[72px] z-10 flex justify-around">
                {['Check Ins', 'Completed', 'Supervision'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`text-sm font-medium transition-all relative px-4 py-1.5 rounded-full ${activeTab === tab ? 'text-blue-600 bg-blue-50' : 'text-slate-500'}`}
                    >
                        {activeTab === tab && <span className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-amber-400 mr-2" />}
                        <span className={activeTab === tab ? 'ml-2' : ''}>{tab}</span>
                    </button>
                ))}
            </div>


            <div className="flex-1 overflow-y-auto">
                {renderContent()}
            </div>

            {/* Floating Action Button */}
            <Button
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl flex items-center justify-center z-50 transition-transform active:scale-95"
                onClick={handleAddClick}
            >
                <Plus className="h-8 w-8 text-white" />
            </Button>

            <MobileCheckInOutModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => { }}
                checkInOutType={checkInOutType}
                initialCompanyName={checkInOutType === 'Check Out' ? (selectedRecordForAction?.companyName || lastRecord?.companyName) : ''}
            />

            {/* Filter Popup */}
            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogContent className="sm:max-w-md p-6 rounded-3xl w-[90%] mx-auto bg-white border-none shadow-2xl">
                    <div className="flex items-center gap-2 mb-6 text-blue-600">
                        <Filter className="h-5 w-5" />
                        <h2 className="text-lg font-bold">Filter</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Find Employee</Label>
                            <Input
                                placeholder="Search by name or Code"
                                className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-blue-500"
                                value={filterEmployeeName}
                                onChange={(e) => setFilterEmployeeName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">From Date*</Label>
                            <Input
                                type="date"
                                className="h-12 rounded-xl bg-slate-50 border-slate-200"
                                value={filterFromDate}
                                onChange={(e) => setFilterFromDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">To Date*</Label>
                            <Input
                                type="date"
                                className="h-12 rounded-xl bg-slate-50 border-slate-200"
                                value={filterToDate}
                                onChange={(e) => setFilterToDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <Button
                            variant="outline"
                            className="flex-1 h-12 rounded-xl border-blue-600 text-blue-600 hover:bg-blue-50"
                            onClick={() => setIsFilterOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 h-12 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                            onClick={applyFilters}
                        >
                            Apply
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}

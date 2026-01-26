"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    Truck,
    Factory as FactoryIcon,
    FileText,
    Hash,
    CalendarDays,
    Loader2,
    ChevronDown,
    User,
    Plus,
    Edit2,
    Filter,
    Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, getDocs, orderBy, limit, startAfter, Timestamp, QueryDocumentSnapshot } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import type { DemoChallanDocument, CompanyProfile, DemoMachineApplicationDocument } from '@/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { DemoChallanPrintTemplate } from '@/components/print/DemoChallanPrintTemplate';
import { useAuth } from '@/context/AuthContext';

export default function MobileDemoChallanPage() {
    const router = useRouter();
    const { companyName } = useAuth();
    const [challans, setChallans] = useState<DemoChallanDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Filter states
    const [filterChallanNo, setFilterChallanNo] = useState('');
    const [filterApplicationId, setFilterApplicationId] = useState('');
    const [filterFactory, setFilterFactory] = useState('');

    // Download state
    const [downloadData, setDownloadData] = useState<{
        challan: DemoChallanDocument;
        application: DemoMachineApplicationDocument | null;
        settings: CompanyProfile | null;
        piSettings: { logoWidth: number; logoHeight: number; piName: string };
    } | null>(null);
    const printContainerRef = React.useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const fetchChallans = useCallback(async (isNextPage = false) => {
        if (isNextPage) setIsPaginating(true);
        else setIsLoading(true);

        try {
            const challansCollection = collection(firestore, "demo_machine_challans");
            let q = query(challansCollection, orderBy("createdAt", "desc"), limit(10));

            if (isNextPage && lastVisible) {
                q = query(challansCollection, orderBy("createdAt", "desc"), startAfter(lastVisible), limit(10));
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                if (!isNextPage) setChallans([]);
                setHasMore(false);
                setLastVisible(null);
                return;
            }

            const newChallans = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    challanDate: data.challanDate instanceof Timestamp ? data.challanDate.toDate().toISOString() : data.challanDate,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                } as DemoChallanDocument;
            });

            if (isNextPage) {
                setChallans(prev => [...prev, ...newChallans]);
            } else {
                setChallans(newChallans);
            }

            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === 10);

        } catch (error) {
            console.error("Error fetching demo challans:", error);
        } finally {
            setIsLoading(false);
            setIsPaginating(false);
        }
    }, [lastVisible]);

    useEffect(() => {
        fetchChallans();
    }, []);

    const filteredChallans = challans.filter(challan => {
        const matchesSearch = !searchQuery ||
            challan.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            challan.factoryName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            challan.linkedApplicationId?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesChallanNo = !filterChallanNo || challan.id?.toLowerCase().includes(filterChallanNo.toLowerCase());
        const matchesAppId = !filterApplicationId || challan.linkedApplicationId?.toLowerCase().includes(filterApplicationId.toLowerCase());
        const matchesFactory = !filterFactory || challan.factoryName?.toLowerCase().includes(filterFactory.toLowerCase());

        return matchesSearch && matchesChallanNo && matchesAppId && matchesFactory;
    });

    const clearFilters = () => {
        setFilterChallanNo('');
        setFilterApplicationId('');
        setFilterFactory('');
    };

    const handleDownload = async (challan: DemoChallanDocument) => {
        setIsDownloading(true);
        try {
            // 1. Fetch missing data
            const settingsDocRef = doc(firestore, 'financial_settings', 'main_settings');
            const piSettingsDocRef = doc(firestore, 'pi_layout_settings', 'main_settings');

            const promises: Promise<any>[] = [
                getDocs(query(collection(firestore, 'financial_settings'), limit(1))), // Dummy to keep types simpler if needed, but actually we use direct doc access
                getDoc(settingsDocRef),
                getDoc(piSettingsDocRef)
            ];

            if (challan.linkedApplicationId) {
                promises.push(getDoc(doc(firestore, "demo_machine_applications", challan.linkedApplicationId)));
            }

            const results = await Promise.all(promises);
            const settingsSnap = results[1];
            const piSettingsSnap = results[2];
            const appSnap = challan.linkedApplicationId ? results[3] : null;

            let companySettings: CompanyProfile | null = null;
            if (settingsSnap.exists()) {
                companySettings = settingsSnap.data() as CompanyProfile;
            }

            let piSettings = { logoWidth: 328.9, logoHeight: 48.3, piName: '' };
            if (piSettingsSnap.exists()) {
                const data = piSettingsSnap.data();
                piSettings = {
                    logoWidth: data.logoWidth || 328.9,
                    logoHeight: data.logoHeight || 48.3,
                    piName: data.name || ''
                };
            }

            let applicationData: DemoMachineApplicationDocument | null = null;
            if (appSnap && appSnap.exists()) {
                applicationData = appSnap.data() as DemoMachineApplicationDocument;
            }

            // 2. Set data to state to trigger render of hidden template
            setDownloadData({
                challan,
                application: applicationData,
                settings: companySettings,
                piSettings
            });

            // 3. Wait for render (small timeout)
            setTimeout(async () => {
                const input = printContainerRef.current;
                if (!input) {
                    Swal.fire("Error", "Could not render PDF template.", "error");
                    setIsDownloading(false);
                    setDownloadData(null);
                    return;
                }

                try {
                    const canvas = await html2canvas(input, { scale: 2, useCORS: true });
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    const ratio = imgHeight / imgWidth;
                    const height = pdfWidth * ratio;

                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, height);
                    pdf.save(`Demo_Challan_${challan.id}.pdf`);

                    Swal.fire({
                        icon: 'success',
                        title: 'Downloaded!',
                        text: 'Your PDF has been downloaded successfully.',
                        timer: 1500,
                        showConfirmButton: false
                    });

                } catch (err: any) {
                    console.error("PDF gen error", err);
                    Swal.fire("Error", "Failed to generate PDF.", "error");
                } finally {
                    setIsDownloading(false);
                    setDownloadData(null);
                }
            }, 1000);

        } catch (error) {
            console.error("Download preparation error:", error);
            Swal.fire("Error", "Failed to prepare download data.", "error");
            setIsDownloading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
            {/* Hidden Print Template */}
            {downloadData && (
                <div style={{ position: 'absolute', top: -10000, left: -10000, zIndex: -50 }}>
                    <DemoChallanPrintTemplate
                        challanData={downloadData.challan}
                        applicationData={downloadData.application}
                        companySettings={downloadData.settings}
                        piSettings={downloadData.piSettings}
                        containerRef={printContainerRef}
                    />
                </div>
            )}

            {/* Header */}
            <div className="sticky top-0 z-50 px-4 pt-4 pb-6 bg-[#0a1e60]">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-950/50 to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-3 bg-white/10 text-white rounded-2xl active:scale-95 transition-all backdrop-blur-md border border-white/10"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">Demo Challans</h1>
                            <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">Delivery Documents</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-3 rounded-2xl active:scale-95 transition-all backdrop-blur-md border ${showFilters ? 'bg-white text-[#0a1e60] border-white' : 'bg-white/10 text-white border-white/10'
                                }`}
                        >
                            <Filter className="h-6 w-6" />
                        </button>
                        <button
                            onClick={() => router.push('/mobile/service/demo-challan/add')}
                            className="p-3 bg-white/10 text-white rounded-2xl active:scale-95 transition-all backdrop-blur-md border border-white/10"
                        >
                            <Plus className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-blue-400/50" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search challan, factory or app ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 bg-white/10 border border-white/10 rounded-[1.25rem] pl-12 pr-4 text-white placeholder:text-blue-400/30 focus:ring-2 focus:ring-blue-500/50 transition-all outline-none backdrop-blur-md text-sm font-medium"
                    />
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="mt-4 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 space-y-3">
                        <div>
                            <label className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1 block">Challan No.</label>
                            <input
                                type="text"
                                placeholder="Filter by challan number..."
                                value={filterChallanNo}
                                onChange={(e) => setFilterChallanNo(e.target.value)}
                                className="w-full h-10 bg-white/10 border border-white/10 rounded-xl px-3 text-white placeholder:text-blue-400/30 text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1 block">Application ID</label>
                            <input
                                type="text"
                                placeholder="Filter by application ID..."
                                value={filterApplicationId}
                                onChange={(e) => setFilterApplicationId(e.target.value)}
                                className="w-full h-10 bg-white/10 border border-white/10 rounded-xl px-3 text-white placeholder:text-blue-400/30 text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1 block">Factory</label>
                            <input
                                type="text"
                                placeholder="Filter by factory name..."
                                value={filterFactory}
                                onChange={(e) => setFilterFactory(e.target.value)}
                                className="w-full h-10 bg-white/10 border border-white/10 rounded-xl px-3 text-white placeholder:text-blue-400/30 text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                        <button
                            onClick={clearFilters}
                            className="w-full py-2.5 bg-white/20 text-white rounded-xl font-bold text-sm hover:bg-white/30 transition-colors"
                        >
                            Clear All Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto pb-24 shadow-inner mt-2">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="relative">
                            <div className="h-16 w-16 border-4 border-blue-100 border-t-[#0a1e60] rounded-full animate-spin" />
                            <Truck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-[#0a1e60]" />
                        </div>
                        <p className="text-slate-500 font-black animate-pulse">Fetching challans...</p>
                    </div>
                ) : filteredChallans.length === 0 ? (
                    <div className="mx-6 mt-12 flex flex-col items-center justify-center p-12 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm text-center">
                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <Truck className="h-10 w-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No Challans Found</h3>
                        <p className="text-slate-500 font-medium">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {filteredChallans.map((challan) => (
                            <div
                                key={challan.id}
                                className="bg-white p-5 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 hover:border-[#0a1e60]/20 active:scale-[0.98] transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Truck size={80} className="text-[#0a1e60]" />
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100/50 shadow-sm group-hover:scale-110 transition-transform">
                                            <Truck className="h-6 w-6 text-[#0a1e60]" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-black text-[#0a1e60] text-base leading-tight">
                                                {challan.id || 'N/A'}
                                            </h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                Challan Number
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownload(challan);
                                            }}
                                            disabled={isDownloading}
                                            className={cn(
                                                "relative z-10 bg-red-50 text-red-600 p-2.5 rounded-xl active:scale-90 transition-all shadow-sm border border-red-100",
                                                isDownloading && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            {isDownloading && downloadData?.challan.id === challan.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Download className="h-4 w-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/mobile/service/demo-challan/edit/${challan.id}`);
                                            }}
                                            className="relative z-10 bg-blue-50 text-[#0a1e60] p-2.5 rounded-xl active:scale-90 transition-all shadow-sm border border-blue-100"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Primary Info Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center gap-2">
                                            <FactoryIcon className="h-3.5 w-3.5 text-slate-400" />
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Factory</p>
                                                <p className="text-xs font-black text-slate-700">{challan.factoryName || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Hash className="h-3.5 w-3.5 text-slate-400" />
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">App ID</p>
                                                <p className="text-xs font-black text-slate-700">{challan.linkedApplicationId || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Challan Date</p>
                                                <p className="text-xs font-black text-slate-700">
                                                    {challan.challanDate ? format(parseISO(challan.challanDate), 'MMM d, yyyy') : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <User className="h-3.5 w-3.5 text-slate-400" />
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Delivery Person</p>
                                                <p className="text-xs font-black text-slate-700">{challan.deliveryPerson || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Secondary Info (Vehicle, Description, Qty, Brand) */}
                                    <div className="pt-3 border-t border-dashed border-slate-200 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            {challan.vehicleNo ? (
                                                <div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Vehicle No</p>
                                                    <p className="text-xs font-black text-slate-700">{challan.vehicleNo}</p>
                                                </div>
                                            ) : (
                                                <div />
                                            )}
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Delivery Date</p>
                                                <p className="text-xs font-black text-slate-700">
                                                    {challan.challanDate ? format(parseISO(challan.challanDate), 'MMM d, yyyy') : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        {challan.lineItems?.map((item, idx) => (
                                            <div key={idx} className="bg-slate-50 p-3 rounded-xl space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Description</p>
                                                        <p className="text-xs font-black text-slate-700">{item.description || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">QTY</p>
                                                        <p className="text-xs font-black text-slate-700">{item.qty || 0}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Brand</p>
                                                    <p className="text-xs font-black text-slate-700">{companyName || 'LCMS'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Load More Button */}
                        {hasMore && (
                            <div className="mt-8 mb-12 flex justify-center">
                                <Button
                                    onClick={() => fetchChallans(true)}
                                    disabled={isPaginating}
                                    className="h-14 px-8 rounded-2xl bg-[#0a1e60] text-white font-black shadow-xl hover:bg-blue-900 active:scale-95 transition-all gap-3"
                                >
                                    {isPaginating ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Loading More...
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="h-5 w-5" />
                                            Load More Challans
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {!hasMore && filteredChallans.length > 0 && (
                            <p className="text-center text-slate-400 text-xs mt-8 mb-12 font-bold uppercase tracking-widest">
                                End of List
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

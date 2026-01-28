"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ArrowLeft,
    Save,
    Loader2,
    AlertCircle,
    Calendar,
    Link as LinkIcon,
    FileText,
    Banknote,
    CheckCircle2,
    Ship
} from 'lucide-react';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { LCEntryDocument, LCStatus } from '@/types';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { format } from 'date-fns';

export default function MobileEditLCPage() {
    const params = useParams();
    const router = useRouter();
    const { userRole } = useAuth();
    const lcId = params.lcId as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lcDetail, setLcDetail] = useState<LCEntryDocument | null>(null);

    useEffect(() => {
        // Access control
        const canEdit = userRole?.some(role => ['Super Admin', 'Admin', 'Commercial'].includes(role));
        if (!isLoading && !canEdit && userRole !== null) {
            router.push('/mobile/total-lc');
            return;
        }

        const fetchLC = async () => {
            try {
                const docRef = doc(firestore, "lc_entries", lcId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as LCEntryDocument;
                    // Format dates for input type="date"
                    const formattedData = {
                        ...data,
                        lcIssueDate: data.lcIssueDate ? data.lcIssueDate.split('T')[0] : '',
                        expireDate: data.expireDate ? data.expireDate.split('T')[0] : '',
                        latestShipmentDate: data.latestShipmentDate ? data.latestShipmentDate.split('T')[0] : '',
                        etd: data.etd ? data.etd.split('T')[0] : '',
                        eta: data.eta ? data.eta.split('T')[0] : '',
                    };
                    setLcDetail({ ...formattedData, id: docSnap.id } as LCEntryDocument);
                } else {
                    Swal.fire("Error", "LC record not found!", "error");
                    router.push('/mobile/total-lc');
                }
            } catch (error) {
                console.error("Error fetching LC:", error);
                Swal.fire("Error", "Failed to load LC details", "error");
            } finally {
                setIsLoading(false);
            }
        };

        if (lcId) fetchLC();
    }, [lcId, userRole, router]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lcDetail) return;

        setIsSaving(true);
        try {
            const docRef = doc(firestore, "lc_entries", lcId);
            const { id, ...updateData } = lcDetail; // Exclude ID from update

            // Format dates back to ISO string for Firestore consistency
            if (updateData.lcIssueDate) updateData.lcIssueDate = format(new Date(updateData.lcIssueDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
            if (updateData.expireDate) updateData.expireDate = format(new Date(updateData.expireDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
            if (updateData.latestShipmentDate) updateData.latestShipmentDate = format(new Date(updateData.latestShipmentDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
            if (updateData.etd) updateData.etd = format(new Date(updateData.etd), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
            if (updateData.eta) updateData.eta = format(new Date(updateData.eta), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

            await updateDoc(docRef, updateData);

            await Swal.fire({
                icon: 'success',
                title: 'Record Updated',
                text: 'The LC entry has been successfully updated.',
                timer: 2000,
                showConfirmButton: false
            });

            router.push('/mobile/total-lc');
        } catch (error) {
            console.error("Error updating LC:", error);
            Swal.fire("Error", "Failed to update LC", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field: keyof LCEntryDocument, value: any) => {
        setLcDetail(prev => prev ? { ...prev, [field]: value } : null);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Loading Record...</p>
            </div>
        );
    }

    if (!lcDetail) return null;

    return (
        <div className="h-screen bg-[#0a1e60] flex flex-col overflow-hidden">
            {/* Header Area */}
            <div className="sticky top-0 z-50 bg-[#0a1e60]">
                <div className="px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="p-2 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-all active:scale-95"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-white">Edit LC Entry</h1>
                    <div className="w-10" /> {/* Spacer */}
                </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto z-10">
                <form onSubmit={handleSave} className="px-5 py-8 space-y-4 pb-32">
                    <Card className="rounded-[2rem] border-none shadow-2xl shadow-blue-900/10 overflow-hidden">
                        <div className="p-6 bg-white border-b border-slate-50">
                            <div className="flex items-center gap-2 mb-6">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">General Information</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">LC Number</Label>
                                    <Input
                                        value={lcDetail.documentaryCreditNumber || ''}
                                        onChange={(e) => handleChange('documentaryCreditNumber', e.target.value)}
                                        className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Applicant Name</Label>
                                    <Input
                                        value={lcDetail.applicantName || ''}
                                        onChange={(e) => handleChange('applicantName', e.target.value)}
                                        className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Beneficiary Name</Label>
                                    <Input
                                        value={lcDetail.beneficiaryName || ''}
                                        onChange={(e) => handleChange('beneficiaryName', e.target.value)}
                                        className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Amount (USD)</Label>
                                    <div className="relative">
                                        <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                        <Input
                                            type="number"
                                            value={lcDetail.amount || ''}
                                            onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                                            className="rounded-xl pl-10 border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50/30">
                            <div className="flex items-center gap-2 mb-6">
                                <Calendar className="h-4 w-4 text-blue-600" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">Critical Dates</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Issue Date</Label>
                                    <Input
                                        type="date"
                                        value={lcDetail.lcIssueDate || ''}
                                        onChange={(e) => handleChange('lcIssueDate', e.target.value)}
                                        className="rounded-xl border-slate-100 bg-white transition-all font-bold text-slate-700 text-[10px]"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Expiry Date</Label>
                                        <Input
                                            type="date"
                                            value={lcDetail.expireDate || ''}
                                            onChange={(e) => handleChange('expireDate', e.target.value)}
                                            className="rounded-xl border-slate-100 bg-white transition-all font-bold text-slate-700 text-[10px]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Latest Shipment</Label>
                                        <Input
                                            type="date"
                                            value={lcDetail.latestShipmentDate || ''}
                                            onChange={(e) => handleChange('latestShipmentDate', e.target.value)}
                                            className="rounded-xl border-slate-100 bg-white transition-all font-bold text-slate-700 text-[10px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-white border-t border-slate-50">
                            <div className="flex items-center gap-2 mb-6">
                                <Ship className="h-4 w-4 text-blue-600" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">Shipping & Tracking</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Shipment Mode*</Label>
                                    <select
                                        value={lcDetail.shipmentMode || ''}
                                        onChange={(e) => handleChange('shipmentMode', e.target.value)}
                                        className="w-full rounded-xl border-slate-100 bg-slate-50/50 p-3 font-bold text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="">Select Mode</option>
                                        <option value="Sea">Sea</option>
                                        <option value="Air">Air</option>
                                        <option value="By Courier">By Courier</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Vessel / Flight Name</Label>
                                        <Input
                                            value={lcDetail.vesselOrFlightName || ''}
                                            onChange={(e) => handleChange('vesselOrFlightName', e.target.value)}
                                            placeholder="e.g. MSC ORION"
                                            className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Vessel IMO / Flight #</Label>
                                        <Input
                                            value={lcDetail.vesselImoNumber || lcDetail.flightNumber || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (lcDetail.shipmentMode === 'Air') {
                                                    handleChange('flightNumber', val);
                                                } else {
                                                    handleChange('vesselImoNumber', val);
                                                }
                                            }}
                                            placeholder="IMO or Flight #"
                                            className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">ETD (Shipment)</Label>
                                        <Input
                                            type="date"
                                            value={lcDetail.etd || ''}
                                            onChange={(e) => handleChange('etd', e.target.value)}
                                            className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700 text-[10px]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">ETA (Arrival)</Label>
                                        <Input
                                            type="date"
                                            value={lcDetail.eta || ''}
                                            onChange={(e) => handleChange('eta', e.target.value)}
                                            className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700 text-[10px]"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-2 border-t border-slate-50">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Original Doc Courier</Label>
                                    <select
                                        value={lcDetail.trackingCourier || ''}
                                        onChange={(e) => handleChange('trackingCourier', e.target.value)}
                                        className="w-full rounded-xl border-slate-100 bg-slate-50/50 p-3 font-bold text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="">Select Courier</option>
                                        <option value="DHL">DHL</option>
                                        <option value="FedEx">FedEx</option>
                                        <option value="UPS">UPS</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">AWB / Tracking Number</Label>
                                    <div className="relative">
                                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                        <Input
                                            value={lcDetail.trackingNumber || ''}
                                            onChange={(e) => handleChange('trackingNumber', e.target.value)}
                                            placeholder="Enter tracking #"
                                            className="rounded-xl pl-10 border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50/30 border-t border-slate-50">
                            <div className="flex items-center gap-2 mb-6">
                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">Operational Status</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Current Status</Label>
                                    <select
                                        value={Array.isArray(lcDetail.status) ? lcDetail.status[0] : lcDetail.status}
                                        onChange={(e) => handleChange('status', [e.target.value])}
                                        className="w-full rounded-xl border-slate-100 bg-white p-3 font-bold text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Shipment Pending">Shipment Pending</option>
                                        <option value="Payment Pending">Payment Pending</option>
                                        <option value="Payment Done">Payment Done</option>
                                        <option value="Shipment Done">Shipment Done</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <div className="pt-4 px-2">
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="w-full bg-[#0a1e60] hover:bg-[#0c2575] text-white rounded-2xl py-7 text-sm font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating Record...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

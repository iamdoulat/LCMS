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
    Ship,
    Plane,
    Plus,
    Trash2,
    CalendarClock,
    Search,
    Layers,
    Box
} from 'lucide-react';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import type { LCEntryDocument, LCStatus, ShipmentMode, ShipmentTerms, PartialShipmentShippingInfo, TrackingCourier } from '@/types';
import { lcStatusOptions, shipmentModeOptions, shipmentTermsOptions, trackingCourierOptions } from '@/types';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { format, isValid, parseISO } from 'date-fns';
import { MultiSelect } from '@/components/ui/multi-select';

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
                    const formattedData: any = {
                        ...data,
                        lcIssueDate: data.lcIssueDate ? data.lcIssueDate.split('T')[0] : '',
                        expireDate: data.expireDate ? data.expireDate.split('T')[0] : '',
                        latestShipmentDate: data.latestShipmentDate ? data.latestShipmentDate.split('T')[0] : '',
                        etd: data.etd ? data.etd.split('T')[0] : '',
                        eta: data.eta ? data.eta.split('T')[0] : '',
                        shipmentMode: Array.isArray(data.shipmentMode) ? data.shipmentMode : (data.shipmentMode ? [data.shipmentMode] : []),
                        shipmentTerms: Array.isArray(data.shipmentTerms) ? data.shipmentTerms : (data.shipmentTerms ? [data.shipmentTerms] : []),
                        partialShippingInfo: (data.partialShippingInfo || []).map(item => ({
                            ...item,
                            etd: item.etd ? item.etd.split('T')[0] : '',
                            eta: item.eta ? item.eta.split('T')[0] : '',
                            shipmentMode: Array.isArray(item.shipmentMode) ? item.shipmentMode : (item.shipmentMode ? [item.shipmentMode] : []),
                        }))
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
            const { id, ...rawUpdateData } = lcDetail; // Exclude ID from update

            const updateData: any = { ...rawUpdateData };

            // Format dates back to ISO string for Firestore consistency
            if (updateData.lcIssueDate && updateData.lcIssueDate !== "") updateData.lcIssueDate = format(new Date(updateData.lcIssueDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
            if (updateData.expireDate && updateData.expireDate !== "") updateData.expireDate = format(new Date(updateData.expireDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
            if (updateData.latestShipmentDate && updateData.latestShipmentDate !== "") updateData.latestShipmentDate = format(new Date(updateData.latestShipmentDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
            if (updateData.etd && updateData.etd !== "") updateData.etd = format(new Date(updateData.etd), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
            if (updateData.eta && updateData.eta !== "") updateData.eta = format(new Date(updateData.eta), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

            // Handle partialShippingInfo dates
            if (updateData.partialShippingInfo) {
                updateData.partialShippingInfo = updateData.partialShippingInfo.map((info: any) => ({
                    ...info,
                    etd: info.etd && info.etd !== "" ? format(new Date(info.etd), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
                    eta: info.eta && info.eta !== "" ? format(new Date(info.eta), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
                }));
            }

            // Clean data (replace empty strings/arrays with deleteField())
            const finalObjectForFirestore: Record<string, any> = {};
            for (const key in updateData) {
                const value = updateData[key];
                if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
                    finalObjectForFirestore[key] = deleteField();
                } else if (value !== undefined) {
                    finalObjectForFirestore[key] = value;
                }
            }

            await updateDoc(docRef, finalObjectForFirestore);

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

    const handlePartialChange = (index: number, field: keyof PartialShipmentShippingInfo, value: any) => {
        setLcDetail(prev => {
            if (!prev || !prev.partialShippingInfo) return prev;
            const newPartialInfo = [...prev.partialShippingInfo];
            newPartialInfo[index] = { ...newPartialInfo[index], [field]: value };
            return { ...prev, partialShippingInfo: newPartialInfo };
        });
    };

    const addPartialShipment = () => {
        setLcDetail(prev => {
            if (!prev) return prev;
            const currentPartials = prev.partialShippingInfo || [];
            if (currentPartials.length >= 3) {
                Swal.fire("Limit Reached", "Maximum 3 partial shipments allowed.", "info");
                return prev;
            }
            const newIndex = (currentPartials.length + 1) as 1 | 2 | 3;
            const newPartial: PartialShipmentShippingInfo = {
                shipmentIndex: newIndex,
                shipmentMode: [],
                vesselOrFlightName: '',
                vesselImoNumber: '',
                flightNumber: '',
                trackingCourier: '',
                trackingNumber: '',
                etd: '',
                eta: ''
            };
            return { ...prev, partialShippingInfo: [...currentPartials, newPartial] };
        });
    };

    const removePartialShipment = (index: number) => {
        setLcDetail(prev => {
            if (!prev || !prev.partialShippingInfo) return prev;
            const newPartialInfo = prev.partialShippingInfo.filter((_, i) => i !== index);
            // Re-index remaining shipments
            const reindexedInfo = newPartialInfo.map((item, i) => ({
                ...item,
                shipmentIndex: (i + 1) as 1 | 2 | 3
            }));
            return { ...prev, partialShippingInfo: reindexedInfo };
        });
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
                    <div className="text-center">
                        <h1 className="text-lg font-bold text-white leading-tight">Edit L/C</h1>
                        <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest">{lcDetail.documentaryCreditNumber}</p>
                    </div>
                    <div className="w-10" /> {/* Spacer */}
                </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] overflow-y-auto z-10">
                <form onSubmit={handleSave} className="px-5 py-8 space-y-6 pb-32">
                    {/* General Information */}
                    <Card className="rounded-[2rem] border-none shadow-2xl shadow-blue-900/10 overflow-hidden">
                        <div className="p-6 bg-white border-b border-slate-50">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                </div>
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">General Information</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">L/C Number*</Label>
                                    <Input
                                        value={lcDetail.documentaryCreditNumber || ''}
                                        onChange={(e) => handleChange('documentaryCreditNumber', e.target.value)}
                                        className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700 h-11"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Applicant Name</Label>
                                    <Input
                                        value={lcDetail.applicantName || ''}
                                        readOnly
                                        className="rounded-xl border-slate-100 bg-slate-50 text-slate-400 font-bold h-11 pointer-events-none"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Beneficiary Name</Label>
                                    <Input
                                        value={lcDetail.beneficiaryName || ''}
                                        readOnly
                                        className="rounded-xl border-slate-100 bg-slate-50 text-slate-400 font-bold h-11 pointer-events-none"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Amount ({String(lcDetail.currency)})</Label>
                                    <div className="relative">
                                        <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                        <Input
                                            type="number"
                                            value={lcDetail.amount || ''}
                                            onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                                            className="rounded-xl pl-10 border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700 h-11"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Critical Dates */}
                        <div className="p-6 bg-slate-50/30">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <Calendar className="h-4 w-4 text-blue-600" />
                                </div>
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">Critical Dates</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Issue Date</Label>
                                    <Input
                                        type="date"
                                        value={lcDetail.lcIssueDate || ''}
                                        onChange={(e) => handleChange('lcIssueDate', e.target.value)}
                                        className="rounded-xl border-slate-100 bg-white transition-all font-bold text-slate-700 h-11 text-[11px]"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Expiry Date</Label>
                                        <Input
                                            type="date"
                                            value={lcDetail.expireDate || ''}
                                            onChange={(e) => handleChange('expireDate', e.target.value)}
                                            className="rounded-xl border-slate-100 bg-white transition-all font-bold text-slate-700 h-11 text-[11px]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Latest Shipment</Label>
                                        <Input
                                            type="date"
                                            value={lcDetail.latestShipmentDate || ''}
                                            onChange={(e) => handleChange('latestShipmentDate', e.target.value)}
                                            className="rounded-xl border-slate-100 bg-white transition-all font-bold text-slate-700 h-11 text-[11px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Global Shipping (If no partials) */}
                        {(!lcDetail.partialShippingInfo || lcDetail.partialShippingInfo.length === 0) && (
                            <div className="p-6 bg-white border-t border-slate-50">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <Ship className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">Global Shipping</h2>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Shipment Mode(s)</Label>
                                        <MultiSelect
                                            options={shipmentModeOptions.map(m => ({ label: m, value: m }))}
                                            selected={lcDetail.shipmentMode || []}
                                            onChange={(val) => handleChange('shipmentMode', val)}
                                            placeholder="Select modes..."
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Shipment Term(s)</Label>
                                        <MultiSelect
                                            options={shipmentTermsOptions.map(m => ({ label: m, value: m }))}
                                            selected={lcDetail.shipmentTerms || []}
                                            onChange={(val) => handleChange('shipmentTerms', val)}
                                            placeholder="Select terms..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Vessel / Flight Name</Label>
                                            <Input
                                                value={lcDetail.vesselOrFlightName || ''}
                                                onChange={(e) => handleChange('vesselOrFlightName', e.target.value)}
                                                placeholder="e.g. MSC ORION"
                                                className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700 h-11"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">IMO Number</Label>
                                                <Input
                                                    value={lcDetail.vesselImoNumber || ''}
                                                    onChange={(e) => handleChange('vesselImoNumber', e.target.value)}
                                                    placeholder="IMO #"
                                                    className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700 h-11"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Flight Number</Label>
                                                <Input
                                                    value={lcDetail.flightNumber || ''}
                                                    onChange={(e) => handleChange('flightNumber', e.target.value)}
                                                    placeholder="Flight #"
                                                    className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700 h-11"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">ETD</Label>
                                            <Input
                                                type="date"
                                                value={lcDetail.etd || ''}
                                                onChange={(e) => handleChange('etd', e.target.value)}
                                                className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700 h-11 text-[11px]"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">ETA</Label>
                                            <Input
                                                type="date"
                                                value={lcDetail.eta || ''}
                                                onChange={(e) => handleChange('eta', e.target.value)}
                                                className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700 h-11 text-[11px]"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Doc Courier</Label>
                                            <select
                                                value={lcDetail.trackingCourier || ''}
                                                onChange={(e) => handleChange('trackingCourier', e.target.value)}
                                                className="w-full h-11 rounded-xl border-slate-100 bg-slate-50/50 px-3 font-bold text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <option value="">Select Courier</option>
                                                {trackingCourierOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Tracking #</Label>
                                            <Input
                                                value={lcDetail.trackingNumber || ''}
                                                onChange={(e) => handleChange('trackingNumber', e.target.value)}
                                                placeholder="Track #"
                                                className="rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold text-slate-700 h-11"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-6 bg-slate-50/30 border-t border-slate-50">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                </div>
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">Operational Status</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Status Badge(s)</Label>
                                    <MultiSelect
                                        options={lcStatusOptions.map(status => ({ value: status, label: status }))}
                                        selected={Array.isArray(lcDetail.status) ? lcDetail.status : (lcDetail.status ? [lcDetail.status as LCStatus] : [])}
                                        onChange={(value) => handleChange('status', value)}
                                        placeholder="Select statuses..."
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Partial Shipments Section */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
                                    <Layers className="h-4 w-4 text-white" />
                                </div>
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">Partial Shipments</h2>
                            </div>
                            <Button
                                type="button"
                                onClick={addPartialShipment}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 px-3 text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all shadow-md"
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add Shipment
                            </Button>
                        </div>

                        {lcDetail.partialShippingInfo && lcDetail.partialShippingInfo.length > 0 ? (
                            <div className="space-y-4">
                                {lcDetail.partialShippingInfo.map((ship, index) => (
                                    <Card key={index} className="rounded-[2rem] border-none shadow-xl shadow-blue-900/5 overflow-hidden">
                                        <div className="p-5 bg-white border-b border-slate-50 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-blue-600 text-white w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black">
                                                    S{ship.shipmentIndex}
                                                </div>
                                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Shipment Details</h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removePartialShipment(index)}
                                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="p-6 space-y-4 bg-slate-50/20">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Mode(s)</Label>
                                                <MultiSelect
                                                    options={shipmentModeOptions.map(m => ({ label: m, value: m }))}
                                                    selected={ship.shipmentMode || []}
                                                    onChange={(val) => handlePartialChange(index, 'shipmentMode', val)}
                                                    placeholder="Modes..."
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Vessel / Flight Name</Label>
                                                    <Input
                                                        value={ship.vesselOrFlightName || ''}
                                                        onChange={(e) => handlePartialChange(index, 'vesselOrFlightName', e.target.value)}
                                                        className="rounded-xl border-slate-100 bg-white font-bold text-slate-700 h-10 text-xs"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">IMO #</Label>
                                                        <Input
                                                            value={ship.vesselImoNumber || ''}
                                                            onChange={(e) => handlePartialChange(index, 'vesselImoNumber', e.target.value)}
                                                            className="rounded-xl border-slate-100 bg-white font-bold text-slate-700 h-10 text-xs"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Flight #</Label>
                                                        <Input
                                                            value={ship.flightNumber || ''}
                                                            onChange={(e) => handlePartialChange(index, 'flightNumber', e.target.value)}
                                                            className="rounded-xl border-slate-100 bg-white font-bold text-slate-700 h-10 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">ETD</Label>
                                                    <Input
                                                        type="date"
                                                        value={ship.etd || ''}
                                                        onChange={(e) => handlePartialChange(index, 'etd', e.target.value)}
                                                        className="rounded-xl border-slate-100 bg-white font-bold text-slate-700 h-10 text-[10px]"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">ETA</Label>
                                                    <Input
                                                        type="date"
                                                        value={ship.eta || ''}
                                                        onChange={(e) => handlePartialChange(index, 'eta', e.target.value)}
                                                        className="rounded-xl border-slate-100 bg-white font-bold text-slate-700 h-10 text-[10px]"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px) font-bold uppercase text-slate-400 tracking-wider">Courier</Label>
                                                    <select
                                                        value={ship.trackingCourier || ''}
                                                        onChange={(e) => handlePartialChange(index, 'trackingCourier', e.target.value)}
                                                        className="w-full h-10 rounded-xl border-slate-100 bg-white px-2 font-bold text-slate-700 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    >
                                                        <option value="">Select</option>
                                                        {trackingCourierOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Tracking #</Label>
                                                    <Input
                                                        value={ship.trackingNumber || ''}
                                                        onChange={(e) => handlePartialChange(index, 'trackingNumber', e.target.value)}
                                                        className="rounded-xl border-slate-100 bg-white font-bold text-slate-700 h-10 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="p-10 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-center bg-white/50">
                                <Box className="h-10 w-10 text-slate-200 mb-2" />
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">No Partial Shipments Added</p>
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <div className="pt-4 px-2 pb-10">
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="w-full bg-[#0a1e60] hover:bg-[#0c2575] text-white rounded-[1.5rem] py-8 text-sm font-black uppercase tracking-widest shadow-2xl shadow-blue-900/30 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Synchronizing...
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    Update Record
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

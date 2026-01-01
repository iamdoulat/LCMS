"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, isValid, differenceInDays } from 'date-fns';
import {
    ArrowLeft,
    AppWindow,
    Loader2,
    CalendarDays,
    Factory,
    User,
    Phone,
    FileText,
    Hash,
    Save,
    Plus,
    Trash2,
    Search,
    X,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from '@/components/ui/checkbox';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { DemoMachineApplicationFormValues, DemoMachineFactoryDocument, DemoMachineDocument, DemoMachineStatusOption as AppDemoMachineStatus } from '@/types';
import { demoMachineApplicationSchema } from '@/types';

interface FactoryOption {
    id: string;
    value: string;
    label: string;
    location: string;
    contactPerson?: string;
    cellNumber?: string;
}

interface AvailableMachineOption {
    id: string;
    value: string;
    label: string;
    serial: string;
    brand: string;
    model: string;
}

export default function MobileAddDemoApplicationPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingFactories, setIsLoadingFactories] = useState(true);
    const [isLoadingMachines, setIsLoadingMachines] = useState(true);

    const [factoryOptions, setFactoryOptions] = useState<FactoryOption[]>([]);
    const [allFetchedMachines, setAllFetchedMachines] = useState<DemoMachineDocument[]>([]);
    const [availableMachineOptions, setAvailableMachineOptions] = useState<AvailableMachineOption[]>([]);

    // Search states for sheets
    const [factorySearch, setFactorySearch] = useState('');
    const [isFactorySheetOpen, setIsFactorySheetOpen] = useState(false);
    const [isMachineSheetOpen, setIsMachineSheetOpen] = useState(false);
    const [machineSearch, setMachineSearch] = useState('');

    const [factoryLocationDisplay, setFactoryLocationDisplay] = useState('');
    const [demoPeriodDisplay, setDemoPeriodDisplay] = useState('0 Days');

    const form = useForm<DemoMachineApplicationFormValues>({
        resolver: zodResolver(demoMachineApplicationSchema),
        defaultValues: {
            factoryId: '',
            challanNo: '',
            deliveryPersonName: '',
            deliveryDate: undefined,
            estReturnDate: undefined,
            factoryInchargeName: '',
            inchargeCell: '',
            notes: '',
            machineReturned: false,
            appliedMachines: [{ demoMachineId: '' }],
        },
    });

    const { control, setValue, watch, handleSubmit, getValues, formState: { errors } } = form;
    const { fields, append, remove, update } = useFieldArray({
        control,
        name: "appliedMachines",
    });

    const watchedFactoryId = watch("factoryId");
    const watchedAppliedMachines = watch("appliedMachines");
    const watchedDeliveryDate = watch("deliveryDate");
    const watchedEstReturnDate = watch("estReturnDate");

    // Fetch Factories
    useEffect(() => {
        const fetchFactories = async () => {
            setIsLoadingFactories(true);
            try {
                const q = query(collection(firestore, "demo_machine_factories"), orderBy("factoryName"));
                const snapshot = await getDocs(q);
                const options = snapshot.docs.map(doc => {
                    const data = doc.data() as DemoMachineFactoryDocument;
                    return {
                        id: doc.id,
                        value: doc.id,
                        label: data.factoryName || 'Unnamed Factory',
                        location: data.factoryLocation || 'N/A',
                        contactPerson: data.contactPerson,
                        cellNumber: data.cellNumber,
                    };
                });
                setFactoryOptions(options);
            } catch (error) {
                console.error("Error fetching factories:", error);
                Swal.fire("Error", "Could not load factories.", "error");
            } finally {
                setIsLoadingFactories(false);
            }
        };
        fetchFactories();
    }, []);

    // Fetch Machines
    useEffect(() => {
        const fetchMachines = async () => {
            setIsLoadingMachines(true);
            try {
                const q = query(collection(firestore, "demo_machines"), orderBy("machineModel"));
                const snapshot = await getDocs(q);
                const machines = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as DemoMachineDocument));
                setAllFetchedMachines(machines);
            } catch (error) {
                console.error("Error fetching machines:", error);
                Swal.fire("Error", "Could not load machines.", "error");
            } finally {
                setIsLoadingMachines(false);
            }
        };
        fetchMachines();
    }, []);

    // Update Available Machines
    useEffect(() => {
        const selectedIds = watchedAppliedMachines.map(m => m.demoMachineId).filter(Boolean);
        const available = allFetchedMachines
            .filter(m => m.currentStatus === "Available" && !selectedIds.includes(m.id))
            .map(m => ({
                id: m.id,
                value: m.id,
                label: `${m.machineModel} (S/N: ${m.machineSerial})`,
                serial: m.machineSerial || 'N/A',
                brand: m.machineBrand || 'N/A',
                model: m.machineModel || 'N/A',
            }));
        setAvailableMachineOptions(available);
    }, [watchedAppliedMachines, allFetchedMachines]);

    // Update Factory Details
    useEffect(() => {
        if (watchedFactoryId) {
            const factory = factoryOptions.find(f => f.id === watchedFactoryId);
            if (factory) {
                setFactoryLocationDisplay(factory.location);
                setValue("factoryInchargeName", factory.contactPerson || '');
                setValue("inchargeCell", factory.cellNumber || '');
            }
        } else {
            setFactoryLocationDisplay('');
        }
    }, [watchedFactoryId, factoryOptions, setValue]);

    // Update Demo Period
    useEffect(() => {
        if (watchedDeliveryDate && watchedEstReturnDate) {
            const start = new Date(watchedDeliveryDate);
            const end = new Date(watchedEstReturnDate);
            if (isValid(start) && isValid(end) && end >= start) {
                const days = differenceInDays(end, start);
                setDemoPeriodDisplay(`${days} Day(s)`);
            } else {
                setDemoPeriodDisplay('0 Days');
            }
        }
    }, [watchedDeliveryDate, watchedEstReturnDate]);


    const onSubmit = async (data: DemoMachineApplicationFormValues) => {
        setIsSubmitting(true);
        const selectedFactory = factoryOptions.find(f => f.value === data.factoryId);

        if (!selectedFactory) {
            Swal.fire("Error", "Selected factory not found.", "error");
            setIsSubmitting(false);
            return;
        }

        try {
            await runTransaction(firestore, async (transaction) => {
                // 1. Generate ID
                const counterRef = doc(firestore, "counters", "demoApplicationNumberGenerator");
                const counterSnap = await transaction.get(counterRef);
                const currentYear = new Date().getFullYear();
                const prefix = selectedFactory.label.substring(0, 3).toUpperCase();

                let newCount = 1;
                if (counterSnap.exists()) {
                    const yearlyCounts = counterSnap.data().yearlyCounts || {};
                    newCount = (yearlyCounts[currentYear] || 0) + 1;
                }
                const newId = `${prefix}${currentYear}${String(newCount).padStart(3, '0')}`;

                transaction.set(counterRef, {
                    yearlyCounts: { [currentYear]: newCount }
                }, { merge: true });

                // 2. Prepare Data
                const machinesToSave = data.appliedMachines
                    .filter(m => m.demoMachineId)
                    .map(m => {
                        const details = allFetchedMachines.find(am => am.id === m.demoMachineId);
                        return {
                            demoMachineId: m.demoMachineId,
                            machineModel: details?.machineModel || 'N/A',
                            machineSerial: details?.machineSerial || 'N/A',
                            machineBrand: details?.machineBrand || 'N/A',
                        };
                    });

                const appData: any = {
                    factoryId: data.factoryId,
                    factoryName: selectedFactory.label,
                    factoryLocation: selectedFactory.location,
                    appliedMachines: machinesToSave,
                    challanNo: data.challanNo,
                    deliveryPersonName: data.deliveryPersonName,
                    deliveryDate: data.deliveryDate ? format(new Date(data.deliveryDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : '',
                    estReturnDate: data.estReturnDate ? format(new Date(data.estReturnDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : '',
                    demoPeriodDays: parseInt(demoPeriodDisplay),
                    factoryInchargeName: data.factoryInchargeName,
                    inchargeCell: data.inchargeCell,
                    notes: data.notes,
                    machineReturned: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };

                // Remove undefined
                Object.keys(appData).forEach(key => appData[key] === undefined && delete appData[key]);

                // 3. Create Application
                transaction.set(doc(firestore, "demo_machine_applications", newId), appData);

                // 4. Update Machines
                machinesToSave.forEach(m => {
                    transaction.update(doc(firestore, "demo_machines", m.demoMachineId), {
                        currentStatus: "Allocated",
                        updatedAt: serverTimestamp()
                    });
                });

                return newId;
            });

            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Application submitted successfully.',
                confirmButtonColor: '#0a1e60'
            }).then(() => {
                router.push('/mobile/service/machine-program');
            });

        } catch (error: any) {
            console.error("Submission error:", error);
            Swal.fire("Error", error.message || "Failed to submit application", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredFactories = factoryOptions.filter(f =>
        f.label.toLowerCase().includes(factorySearch.toLowerCase()) ||
        f.location.toLowerCase().includes(factorySearch.toLowerCase())
    );

    // Get machines available to add (exclude already selected ones in the current row context logic, 
    // but here globally for the add sheet)
    // Actually the sheet adds to the array. 
    const filteredMachines = availableMachineOptions.filter(m =>
        m.label.toLowerCase().includes(machineSearch.toLowerCase()) ||
        m.brand.toLowerCase().includes(machineSearch.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-[#0a1e60] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-50 px-4 pt-4 pb-6 bg-[#0a1e60]">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-950/50 to-transparent pointer-events-none" />
                <div className="relative flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="p-3 bg-white/10 text-white rounded-2xl active:scale-95 transition-all backdrop-blur-md border border-white/10"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">Add Application</h1>
                        <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em]">New Request</p>
                    </div>
                </div>
            </div>

            {/* Scrollable Form Area */}
            <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] mt-2 overflow-y-auto pb-[180px]">
                <Form {...form}>
                    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">

                        {/* Factory Section */}
                        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                            <div className="flex items-center gap-3 pb-2 border-b border-slate-50">
                                <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                                    <Factory className="h-5 w-5" />
                                </div>
                                <h3 className="font-bold text-slate-800">Factory Details</h3>
                            </div>

                            <FormField
                                control={control}
                                name="factoryId"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Select Factory</FormLabel>
                                        <Sheet open={isFactorySheetOpen} onOpenChange={setIsFactorySheetOpen}>
                                            <SheetTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        type="button"
                                                        className={cn(
                                                            "w-full justify-between h-14 rounded-2xl border-slate-200 bg-slate-50/50 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value
                                                            ? factoryOptions.find((f) => f.value === field.value)?.label
                                                            : "Search factory..."}
                                                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </SheetTrigger>
                                            <SheetContent side="bottom" className="h-[80vh] rounded-t-[2.5rem]">
                                                <SheetHeader>
                                                    <SheetTitle>Select Factory</SheetTitle>
                                                    <div className="relative mt-2">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                        <Input
                                                            placeholder="Search factory name..."
                                                            className="pl-9 h-12 rounded-xl bg-slate-50"
                                                            value={factorySearch}
                                                            onChange={(e) => setFactorySearch(e.target.value)}
                                                        />
                                                    </div>
                                                </SheetHeader>
                                                <div className="mt-4 space-y-2 overflow-y-auto max-h-[60vh] pb-10">
                                                    {isLoadingFactories ? (
                                                        <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></div>
                                                    ) : filteredFactories.length === 0 ? (
                                                        <div className="py-10 text-center text-slate-400">No factory found</div>
                                                    ) : (
                                                        filteredFactories.map((factory) => (
                                                            <button
                                                                key={factory.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    form.setValue("factoryId", factory.value);
                                                                    setIsFactorySheetOpen(false);
                                                                }}
                                                                className={cn(
                                                                    "w-full text-left p-4 rounded-xl transition-all border",
                                                                    field.value === factory.value
                                                                        ? "bg-blue-50 border-blue-200"
                                                                        : "bg-white border-slate-100 hover:bg-slate-50"
                                                                )}
                                                            >
                                                                <div className="font-bold text-slate-800">{factory.label}</div>
                                                                <div className="text-xs text-slate-500 mt-1">{factory.location}</div>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </SheetContent>
                                        </Sheet>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {watchedFactoryId && (
                                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                                    <p className="text-xs font-semibold text-blue-800">Location:</p>
                                    <p className="text-sm text-slate-600">{factoryLocationDisplay || 'N/A'}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={control}
                                    name="factoryInchargeName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Incharge Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="John Doe" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name="inchargeCell"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cell No</FormLabel>
                                            <FormControl>
                                                <Input {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="017..." />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Delivery & Logistics */}
                        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                            <div className="flex items-center gap-3 pb-2 border-b border-slate-50">
                                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <h3 className="font-bold text-slate-800">Logistics</h3>
                            </div>

                            <FormField
                                control={control}
                                name="challanNo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Challan No</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="CH-1234" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name="deliveryPersonName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Delivery Person</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="Full Name" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={control}
                                    name="deliveryDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Delivery Date</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="date"
                                                    className="h-12 rounded-xl bg-slate-50 border-slate-200"
                                                    value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                                                    onChange={(e) => field.onChange(new Date(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name="estReturnDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Return Date</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="date"
                                                    className="h-12 rounded-xl bg-slate-50 border-slate-200"
                                                    value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                                                    onChange={(e) => field.onChange(new Date(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center px-4">
                                <span className="text-sm font-medium text-amber-800">Demo Period</span>
                                <span className="text-lg font-bold text-amber-700">{demoPeriodDisplay}</span>
                            </div>
                        </div>

                        {/* Machines Section */}
                        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                                        <AppWindow className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-bold text-slate-800">Machines</h3>
                                </div>
                                <Sheet open={isMachineSheetOpen} onOpenChange={setIsMachineSheetOpen}>
                                    <SheetTrigger asChild>
                                        <Button size="sm" className="rounded-xl h-9 bg-[#0a1e60] hover:bg-blue-900" type="button">
                                            <Plus className="h-4 w-4 mr-1" /> Add
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="bottom" className="h-[80vh] rounded-t-[2.5rem]">
                                        <SheetHeader>
                                            <SheetTitle>Select Machine</SheetTitle>
                                            <div className="relative mt-2">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <Input
                                                    placeholder="Search brand or model..."
                                                    className="pl-9 h-12 rounded-xl bg-slate-50"
                                                    value={machineSearch}
                                                    onChange={(e) => setMachineSearch(e.target.value)}
                                                />
                                            </div>
                                        </SheetHeader>
                                        <div className="mt-4 space-y-2 overflow-y-auto max-h-[60vh] pb-10">
                                            {isLoadingMachines ? (
                                                <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-600" /></div>
                                            ) : filteredMachines.length === 0 ? (
                                                <div className="py-10 text-center text-slate-400">No available matches</div>
                                            ) : (
                                                filteredMachines.map((m) => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => {
                                                            // Add to array if not first empty Placeholder
                                                            const currentFields = getValues("appliedMachines");
                                                            if (currentFields.length === 1 && !currentFields[0].demoMachineId) {
                                                                update(0, { demoMachineId: m.value });
                                                            } else {
                                                                append({ demoMachineId: m.value });
                                                            }
                                                            setIsMachineSheetOpen(false);
                                                        }}
                                                        className="w-full text-left p-4 rounded-xl transition-all border bg-white border-slate-100 hover:bg-slate-50 group"
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="font-bold text-slate-800">{m.model}</div>
                                                                <div className="text-xs text-slate-500 mt-1">{m.brand} • S/N: {m.serial}</div>
                                                            </div>
                                                            <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center group-active:bg-blue-600 group-active:text-white transition-colors">
                                                                <Plus className="h-4 w-4" />
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </div>

                            {/* Applied Machines List */}
                            <div className="space-y-3">
                                {fields.map((field, index) => {
                                    const machine = allFetchedMachines.find(m => m.id === watchedAppliedMachines[index]?.demoMachineId);
                                    if (!machine && watchedAppliedMachines[index]?.demoMachineId) return null;

                                    if (!machine) { // Empty placeholder
                                        if (fields.length === 1) return <p key={field.id} className="text-sm text-slate-400 italic text-center py-4">No machines selected yet.</p>;
                                        return null;
                                    }

                                    return (
                                        <div key={field.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                                            <div className="pr-8">
                                                <h4 className="font-bold text-slate-700">{machine.machineModel}</h4>
                                                <p className="text-xs text-slate-500 mt-1">Brand: {machine.machineBrand}</p>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">S/N: {machine.machineSerial}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="absolute top-4 right-4 p-2 text-rose-500 bg-rose-50 rounded-lg active:scale-95 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            {errors.appliedMachines && <p className="text-xs text-rose-500 font-medium px-1">{errors.appliedMachines.message}</p>}
                        </div>

                        {/* Note & Footer Padding */}
                        <FormField
                            control={control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                                        <FormLabel className="mb-2 block font-bold text-slate-700">Notes</FormLabel>
                                        <Textarea {...field} className="min-h-[100px] rounded-xl bg-slate-50 border-slate-200" placeholder="Additional comments..." />
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                    </form>
                </Form>
            </div>

            {/* Floating Submit Button */}
            <div className="fixed bottom-[96px] left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50">
                <Button
                    onClick={handleSubmit(onSubmit)}
                    className="w-full h-14 bg-[#0a1e60] hover:bg-blue-900 text-white rounded-2xl text-lg font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        "Submit Application"
                    )}
                </Button>
            </div>
        </div>
    );
}

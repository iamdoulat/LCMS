"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { format, differenceInCalendarDays } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { useAuth } from '@/context/AuthContext';
import { VisitApplicationSchema, type VisitApplicationFormValues, type VisitApplicationDocument } from '@/types';
import { Loader2, Calendar, FileText, ArrowLeft } from 'lucide-react';
import Swal from 'sweetalert2';

interface MobileVisitFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function MobileVisitForm({ isOpen, onClose, onSuccess }: MobileVisitFormProps) {
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employeeData, setEmployeeData] = useState<{ id: string; fullName: string; employeeCode: string } | null>(null);

    const form = useForm<VisitApplicationFormValues>({
        resolver: zodResolver(VisitApplicationSchema),
        defaultValues: {
            employeeId: '',
            fromDate: new Date(),
            toDate: new Date(),
            customerName: 'N/A',
            location: 'N/A',
            remarks: '',
        },
    });

    // Fetch employee data and update form
    useEffect(() => {
        if (!user?.email) return;

        const fetchEmp = async () => {
            try {
                const { getDocs, query, collection, where } = await import('firebase/firestore');
                const q = query(collection(firestore, 'employees'), where('email', '==', user.email));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    const emp = {
                        id: snap.docs[0].id,
                        fullName: data.fullName || user.displayName || 'Unknown',
                        employeeCode: data.employeeCode || 'N/A'
                    };
                    setEmployeeData(emp);
                    form.setValue('employeeId', emp.id);
                } else {
                    // Fallback to user.uid
                    form.setValue('employeeId', user.uid);
                }
            } catch (err) {
                console.error("Error fetching employee:", err);
            }
        };
        fetchEmp();
    }, [user, form]);

    const onSubmit = async (data: VisitApplicationFormValues) => {
        if (!user || !data.employeeId) return;
        setIsSubmitting(true);

        try {
            const diff = differenceInCalendarDays(data.toDate, data.fromDate) + 1;

            const dataToSave: Omit<VisitApplicationDocument, 'id'> = {
                employeeId: data.employeeId,
                employeeName: employeeData?.fullName || user.displayName || 'Unknown Employee',
                employeeCode: employeeData?.employeeCode || 'N/A',
                applyDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                fromDate: format(data.fromDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                toDate: format(data.toDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                customerName: data.customerName || 'N/A',
                location: data.location || 'N/A',
                day: diff,
                remarks: data.remarks,
                status: 'Pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            await addDoc(collection(firestore, "visit_applications"), dataToSave);

            Swal.fire({
                title: "Success!",
                text: "Visit application submitted successfully.",
                icon: "success",
                timer: 1500,
                showConfirmButton: false,
            });

            form.reset();
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Submission Error:", error);
            Swal.fire("Error", "Failed to submit application: " + error.message, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden rounded-[2rem] border-none bg-slate-50 h-[90vh] sm:h-auto flex flex-col">
                <div className="bg-[#0a1e60] p-6 flex items-center">
                    <button onClick={onClose} className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors mr-2">
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <DialogTitle className="text-xl font-bold text-white">Apply for Visit</DialogTitle>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <Form {...form}>
                        <form id="visit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="fromDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col space-y-2">
                                        <FormLabel className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            Select date and time <span className="text-red-500">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <DatePickerInput
                                                    field={field}
                                                    placeholder="Select date and time"
                                                    showTimeSelect
                                                    className="w-full h-14 bg-white border-slate-100 rounded-2xl px-6 text-slate-800 font-medium shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="toDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col space-y-2">
                                        <FormLabel className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            End date and time <span className="text-red-500">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <DatePickerInput
                                                    field={field}
                                                    placeholder="Select date and time"
                                                    showTimeSelect
                                                    className="w-full h-14 bg-white border-slate-100 rounded-2xl px-6 text-slate-800 font-medium shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="customerName"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col space-y-2">
                                        <FormLabel className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            Customer Name <span className="text-red-500">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    placeholder="Enter Customer Name"
                                                    className="w-full h-14 bg-white border-slate-100 rounded-2xl px-6 text-slate-800 font-medium shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col space-y-2">
                                        <FormLabel className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            Address <span className="text-red-500">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    placeholder="Enter Address/Location"
                                                    className="w-full h-14 bg-white border-slate-100 rounded-2xl px-6 text-slate-800 font-medium shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="remarks"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col space-y-2">
                                        <FormLabel className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            Purpose <span className="text-red-500">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Purpose"
                                                className="min-h-[150px] bg-white border-slate-100 rounded-2xl px-6 py-4 text-slate-800 font-medium shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </form>
                    </Form>
                </div>

                <div className="p-6 bg-white border-t border-slate-100">
                    <Button
                        form="visit-form"
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Applying...
                            </>
                        ) : (
                            'Apply for Visit'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

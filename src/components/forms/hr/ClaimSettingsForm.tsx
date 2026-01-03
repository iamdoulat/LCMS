"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import Swal from 'sweetalert2';
import { Loader2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const formSchema = z.object({
    limitDays: z.coerce.number().min(0, "Days limit must be positive"),
    requireApproval: z.boolean().default(false),
    sanctionApprovedAmount: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

export function ClaimSettingsForm() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            limitDays: 30,
            requireApproval: true,
            sanctionApprovedAmount: true,
        },
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(firestore, 'claim_settings', 'general');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    form.reset({
                        limitDays: data.limitDays || 30,
                        requireApproval: data.requireApproval ?? true,
                        sanctionApprovedAmount: data.sanctionApprovedAmount ?? true,
                    });
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, [form]);

    const onSubmit = async (data: FormValues) => {
        setIsSaving(true);
        try {
            const docRef = doc(firestore, 'claim_settings', 'general');
            await setDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            Swal.fire({
                icon: 'success',
                title: 'Saved',
                text: 'Claim settings updated successfully',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error saving settings:", error);
            Swal.fire("Error", "Failed to update settings", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-4 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-blue-500" /></div>;
    }

    return (
        <div className="mt-8">
            <div className="bg-[#5C5CFF] p-4 rounded-t-lg">
                <h2 className="text-white font-semibold text-lg">Claim Setting</h2>
            </div>
            <Card className="rounded-t-none border-t-0 shadow-sm bg-white">
                <CardContent className="p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            <FormField
                                control={form.control}
                                name="limitDays"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2">
                                            <FormLabel className="text-base font-semibold text-slate-700">Day(s) limit for earlier day's application</FormLabel>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-4 w-4 text-slate-400 cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Maximum number of days in the past users can apply for claims.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <FormControl>
                                            <Input type="number" {...field} className="max-w-xs" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="requireApproval"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className="text-sm font-medium text-slate-600 cursor-pointer">
                                                Require Approval Workflow Steps
                                            </FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="sanctionApprovedAmount"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none flex items-center gap-2">
                                            <FormLabel className="text-sm font-medium text-slate-600 cursor-pointer">
                                                Sanction supervisor approved amount
                                            </FormLabel>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-4 w-4 text-slate-400 cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-[#0F172A] text-white p-3 max-w-xs text-sm rounded-md shadow-lg border-none">
                                                        <p className="font-semibold mb-1">On supervisor approval,</p>
                                                        <p>approved amount will also become sanctioned amount</p>
                                                        <p className="text-xs opacity-80 mt-1">(option applicable if supervisor can disburse instead of admin)</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end pt-4">
                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="bg-[#5C5CFF] hover:bg-[#4B4BEE] text-white min-w-[100px]"
                                >
                                    {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

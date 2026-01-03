"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Loader2 } from 'lucide-react';
import type { ClaimCategory } from '@/types';

interface ClaimCategoryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: ClaimCategory | null;
    onSuccess: () => void;
}

const formSchema = z.object({
    name: z.string().min(1, "Category Name is required"),
    maxLimit: z.preprocess(
        (val) => (val === "" ? undefined : Number(val)),
        z.number().optional()
    ),
});

type FormValues = z.infer<typeof formSchema>;

export function ClaimCategoryModal({ open, onOpenChange, initialData, onSuccess }: ClaimCategoryModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            maxLimit: 0,
        }
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    name: initialData.name,
                    maxLimit: initialData.maxLimit,
                });
            } else {
                form.reset({
                    name: '',
                    maxLimit: 0,
                });
            }
        }
    }, [open, initialData, form]);

    const onSubmit = async (data: FormValues) => {
        setIsSubmitting(true);
        try {
            const categoryData = {
                name: data.name,
                maxLimit: data.maxLimit || null,
                updatedAt: serverTimestamp(),
            };

            if (initialData) {
                // Update
                await updateDoc(doc(firestore, 'claim_categories', initialData.id), categoryData);
                Swal.fire("Success", "Category updated successfully", "success");
            } else {
                // Create
                await addDoc(collection(firestore, 'claim_categories'), {
                    ...categoryData,
                    createdAt: serverTimestamp(),
                });
                Swal.fire("Success", "Category added successfully", "success");
            }

            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error("Error saving category", error);
            Swal.fire("Error", "Failed to save category", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Update Claim Category' : 'Add Claim Category'}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category Name <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Enter Category Name" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="maxLimit"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Max. Claim Limit</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} placeholder="Enter Max. Claim Limit" value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground mt-1">Set 0 for Unlimited</p>
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

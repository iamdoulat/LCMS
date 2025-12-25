"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { CurrencyFormValues } from '@/types';
import { currencySchema } from '@/types';
import Swal from 'sweetalert2';

interface AddCurrencyFormProps {
    onFormSubmit: () => void;
}

export function AddCurrencyForm({ onFormSubmit }: AddCurrencyFormProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<CurrencyFormValues>({
        resolver: zodResolver(currencySchema),
        defaultValues: {
            name: '',
            code: '',
            symbol: '',
        },
    });

    async function onSubmit(data: CurrencyFormValues) {
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'currencies'), {
                ...data,
                createdAt: serverTimestamp(),
            });

            Swal.fire({
                title: "Currency Added!",
                text: `${data.name} has been successfully added.`,
                icon: "success",
                timer: 1500,
                showConfirmButton: false,
            });
            form.reset();
            onFormSubmit();
        } catch (error: any) {
            console.error("Error adding currency: ", error);
            Swal.fire("Error", `Failed to add currency: ${error.message}`, "error");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Currency Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. US Dollar" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Currency Code</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. USD" {...field} />
                                </FormControl>
                                <FormDescription>ISO Code (e.g. USD, BDT)</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="symbol"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Symbol</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. $" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Currency
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}

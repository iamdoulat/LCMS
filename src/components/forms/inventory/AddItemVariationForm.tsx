"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ItemVariationFormValues, ItemVariation } from '@/types';
import { ItemVariationSchema } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

interface AddItemVariationFormProps {
    onFormSubmit?: () => void;
}

export function AddItemVariationForm({ onFormSubmit }: AddItemVariationFormProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<ItemVariationFormValues>({
        resolver: zodResolver(ItemVariationSchema),
        defaultValues: {
            name: '',
        },
    });

    async function onSubmit(data: ItemVariationFormValues) {
        setIsSubmitting(true);

        const dataToSave: Omit<ItemVariation, 'id'> & { createdAt: any, updatedAt: any } = {
            name: data.name,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        try {
            await addDoc(collection(firestore, "item_variations"), dataToSave);
            form.reset();
            onFormSubmit?.();
            setTimeout(() => {
                Swal.fire({
                    title: "Variation Added!",
                    text: `"${data.name}" has been created successfully.`,
                    icon: "success",
                    timer: 1000,
                    showConfirmButton: false,
                });
            }, 300);
        } catch (error) {
            console.error("Error adding item variation: ", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred.";
            Swal.fire({
                title: "Save Failed",
                text: `Failed to save variation: ${errorMessage}`,
                icon: "error",
            });
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
                            <FormLabel>Variation Name*</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter variation name" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        "Save Variation"
                    )}
                </Button>
            </form>
        </Form>
    );
}

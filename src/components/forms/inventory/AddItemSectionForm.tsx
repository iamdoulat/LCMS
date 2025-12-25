"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ItemSectionFormValues, ItemSection } from '@/types';
import { ItemSectionSchema } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

interface AddItemSectionFormProps {
    onFormSubmit?: () => void;
}

export function AddItemSectionForm({ onFormSubmit }: AddItemSectionFormProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<ItemSectionFormValues>({
        resolver: zodResolver(ItemSectionSchema),
        defaultValues: {
            name: '',
        },
    });

    async function onSubmit(data: ItemSectionFormValues) {
        setIsSubmitting(true);

        const dataToSave: Omit<ItemSection, 'id'> & { createdAt: any, updatedAt: any } = {
            name: data.name,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        try {
            await addDoc(collection(firestore, "item_sections"), dataToSave);
            form.reset();
            onFormSubmit?.();
            setTimeout(() => {
                Swal.fire({
                    title: "Section Added!",
                    text: `"${data.name}" has been created successfully.`,
                    icon: "success",
                    timer: 1000,
                    showConfirmButton: false,
                });
            }, 300);
        } catch (error) {
            console.error("Error adding item section: ", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred.";
            Swal.fire({
                title: "Save Failed",
                text: `Failed to save section: ${errorMessage}`,
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
                            <FormLabel>Section Name*</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter section name" {...field} />
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
                        "Save Section"
                    )}
                </Button>
            </form>
        </Form>
    );
}

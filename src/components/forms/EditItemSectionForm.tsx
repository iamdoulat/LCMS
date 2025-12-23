"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { ItemSectionFormValues, ItemSectionDocument } from '@/types';
import { ItemSectionSchema } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

interface EditItemSectionFormProps {
    initialData: ItemSectionDocument;
    onFormSubmit?: () => void;
}

export function EditItemSectionForm({ initialData, onFormSubmit }: EditItemSectionFormProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<ItemSectionFormValues>({
        resolver: zodResolver(ItemSectionSchema),
        defaultValues: {
            name: initialData.name || '',
        },
    });

    async function onSubmit(data: ItemSectionFormValues) {
        setIsSubmitting(true);

        try {
            const docRef = doc(firestore, "item_sections", initialData.id);
            await updateDoc(docRef, {
                name: data.name,
                updatedAt: serverTimestamp(),
            });
            Swal.fire({
                title: "Section Updated!",
                text: `"${data.name}" has been updated successfully.`,
                icon: "success",
                timer: 1000,
                showConfirmButton: false,
            });
            onFormSubmit?.();
        } catch (error) {
            console.error("Error updating item section: ", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred.";
            Swal.fire({
                title: "Update Failed",
                text: `Failed to update section: ${errorMessage}`,
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
                            Updating...
                        </>
                    ) : (
                        "Update Section"
                    )}
                </Button>
            </form>
        </Form>
    );
}

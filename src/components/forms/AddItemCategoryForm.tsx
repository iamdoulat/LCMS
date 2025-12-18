"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ItemCategoryFormValues, ItemCategory } from '@/types';
import { ItemCategorySchema } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

interface AddItemCategoryFormProps {
    onFormSubmit?: () => void;
}

export function AddItemCategoryForm({ onFormSubmit }: AddItemCategoryFormProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<ItemCategoryFormValues>({
        resolver: zodResolver(ItemCategorySchema),
        defaultValues: {
            name: '',
        },
    });

    async function onSubmit(data: ItemCategoryFormValues) {
        setIsSubmitting(true);

        const dataToSave: Omit<ItemCategory, 'id'> & { createdAt: any, updatedAt: any } = {
            name: data.name,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        try {
            await addDoc(collection(firestore, "item_categories"), dataToSave);
            Swal.fire({
                title: "Category Added!",
                text: `"${data.name}" has been created successfully.`,
                icon: "success",
                timer: 2000,
                showConfirmButton: false,
            });
            form.reset();
            onFormSubmit?.();
        } catch (error) {
            console.error("Error adding item category: ", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred.";
            Swal.fire({
                title: "Save Failed",
                text: `Failed to save category: ${errorMessage}`,
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
                            <FormLabel>Category Name*</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter category name" {...field} />
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
                        "Save Category"
                    )}
                </Button>
            </form>
        </Form>
    );
}

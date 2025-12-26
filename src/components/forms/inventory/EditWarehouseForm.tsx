"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { WarehouseFormValues, WarehouseDocument } from '@/types';
import { WarehouseSchema } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

interface EditWarehouseFormProps {
    initialData: WarehouseDocument;
    onFormSubmit?: () => void;
}

export function EditWarehouseForm({ initialData, onFormSubmit }: EditWarehouseFormProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<WarehouseFormValues>({
        resolver: zodResolver(WarehouseSchema),
        defaultValues: {
            name: initialData.name,
        },
    });

    async function onSubmit(data: WarehouseFormValues) {
        setIsSubmitting(true);

        const dataToUpdate = {
            name: data.name,
            updatedAt: serverTimestamp(),
        };

        try {
            await updateDoc(doc(firestore, "warehouses", initialData.id), dataToUpdate);
            onFormSubmit?.();
            setTimeout(() => {
                Swal.fire({
                    title: "Warehouse Updated!",
                    text: `"${data.name}" has been updated successfully.`,
                    icon: "success",
                    timer: 1000,
                    showConfirmButton: false,
                });
            }, 300);
        } catch (error) {
            console.error("Error updating warehouse: ", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred.";
            Swal.fire({
                title: "Update Failed",
                text: `Failed to update warehouse: ${errorMessage}`,
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
                            <FormLabel>Warehouse Name*</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter warehouse name" {...field} />
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
                        "Update Warehouse"
                    )}
                </Button>
            </form>
        </Form>
    );
}

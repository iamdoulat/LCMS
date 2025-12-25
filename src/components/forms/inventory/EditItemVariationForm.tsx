"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { ItemVariationFormValues, ItemVariationDocument } from '@/types';
import { ItemVariationSchema } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface EditItemVariationFormProps {
    initialData: ItemVariationDocument;
    onFormSubmit?: () => void;
}

export function EditItemVariationForm({ initialData, onFormSubmit }: EditItemVariationFormProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [subVariations, setSubVariations] = React.useState<string[]>(initialData.subVariations || []);
    const [newSubVariation, setNewSubVariation] = React.useState('');

    const form = useForm<ItemVariationFormValues>({
        resolver: zodResolver(ItemVariationSchema),
        defaultValues: {
            name: initialData.name || '',
            subVariations: initialData.subVariations || [],
        },
    });

    const handleAddSubVariation = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        const trimmed = newSubVariation.trim();
        if (trimmed) {
            if (subVariations.includes(trimmed)) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'warning',
                    title: 'This option already exists.',
                    showConfirmButton: false,
                    timer: 2000
                });
                return;
            }
            const updated = [...subVariations, trimmed];
            setSubVariations(updated);
            form.setValue('subVariations', updated); // Sync with form
            setNewSubVariation('');
        }
    };

    const handleRemoveSubVariation = (optionToRemove: string) => {
        const updated = subVariations.filter(sv => sv !== optionToRemove);
        setSubVariations(updated);
        form.setValue('subVariations', updated); // Sync with form
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddSubVariation(e);
        }
    };

    async function onSubmit(data: ItemVariationFormValues) {
        setIsSubmitting(true);

        try {
            const docRef = doc(firestore, "item_variations", initialData.id);
            await updateDoc(docRef, {
                name: data.name,
                subVariations: subVariations, // Explicitly use state or form data
                updatedAt: serverTimestamp(),
            });
            onFormSubmit?.();
            setTimeout(() => {
                Swal.fire({
                    title: "Variation Updated!",
                    text: `"${data.name}" has been updated successfully.`,
                    icon: "success",
                    timer: 1000,
                    showConfirmButton: false,
                });
            }, 300);
        } catch (error) {
            console.error("Error updating item variation: ", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred.";
            Swal.fire({
                title: "Update Failed",
                text: `Failed to update variation: ${errorMessage}`,
                icon: "error",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Variation Name*</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Size, Color, Material" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Separator />

                <div className="space-y-3">
                    <FormLabel>Sub-Variations (Options)</FormLabel>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Add option (e.g. Small, Medium, Red)"
                            value={newSubVariation}
                            onChange={(e) => setNewSubVariation(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <Button type="button" size="icon" onClick={handleAddSubVariation} variant="secondary">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="min-h-[60px] p-3 rounded-md border bg-muted/20 flex flex-wrap gap-2">
                        {subVariations.length === 0 && (
                            <span className="text-sm text-muted-foreground italic w-full text-center py-2">No options added yet.</span>
                        )}
                        {subVariations.map((sub, index) => (
                            <Badge key={index} variant="secondary" className="pl-3 pr-1 py-1 h-8 text-sm flex items-center gap-1 group">
                                {sub}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSubVariation(sub)}
                                    className="ml-1 rounded-full p-0.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">These options will appear when adding a product with this variation type.</p>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                        </>
                    ) : (
                        "Update Variation"
                    )}
                </Button>
            </form>
        </Form>
    );
}

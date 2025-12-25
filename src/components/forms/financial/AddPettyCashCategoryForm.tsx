
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { PettyCashCategoryFormValues } from '@/types';
import { PettyCashCategorySchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';

interface AddPettyCashCategoryFormProps {
  onFormSubmit: () => void;
}

export function AddPettyCashCategoryForm({ onFormSubmit }: AddPettyCashCategoryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<PettyCashCategoryFormValues>({
    resolver: zodResolver(PettyCashCategorySchema),
    defaultValues: {
      name: '',
    },
  });

  async function onSubmit(data: PettyCashCategoryFormValues) {
    setIsSubmitting(true);
    const dataToSave = {
      ...data,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, "petty_cash_categories"), dataToSave);
      Swal.fire({
        title: "Category Created!",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });
      form.reset();
      onFormSubmit(); // Close the dialog
    } catch (error: any) {
      Swal.fire("Save Failed", `Failed to create category: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Office Supplies, Transportation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
                <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
                </>
            ) : (
                <>
                <Save className="mr-2 h-4 w-4" />
                Save Category
                </>
            )}
            </Button>
        </div>
      </form>
    </Form>
  );
}


"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { PettyCashCategoryFormValues, PettyCashCategoryDocument } from '@/types';
import { PettyCashCategorySchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';

interface EditPettyCashCategoryFormProps {
  initialData: PettyCashCategoryDocument;
  onFormSubmit: () => void;
}

export function EditPettyCashCategoryForm({ initialData, onFormSubmit }: EditPettyCashCategoryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<PettyCashCategoryFormValues>({
    resolver: zodResolver(PettyCashCategorySchema),
    defaultValues: {
      name: initialData.name,
    },
  });

  async function onSubmit(data: PettyCashCategoryFormValues) {
    setIsSubmitting(true);
    const dataToUpdate = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    try {
      const categoryDocRef = doc(firestore, "petty_cash_categories", initialData.id);
      await updateDoc(categoryDocRef, dataToUpdate);
      Swal.fire({
        title: "Category Updated!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      onFormSubmit(); // Close the dialog
    } catch (error: any) {
      Swal.fire("Update Failed", `Failed to update category: ${error.message}`, "error");
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
                Save Changes
                </>
            )}
            </Button>
        </div>
      </form>
    </Form>
  );
}

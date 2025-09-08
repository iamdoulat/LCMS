
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { BranchFormValues } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';

const BranchSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters long."),
});

interface AddBranchFormProps {
  onFormSubmit: () => void;
}

export function AddBranchForm({ onFormSubmit }: AddBranchFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<BranchFormValues>({
    resolver: zodResolver(BranchSchema),
    defaultValues: {
      name: '',
    },
  });

  async function onSubmit(data: BranchFormValues) {
    setIsSubmitting(true);
    const dataToSave = {
      ...data,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, "branches"), dataToSave);
      Swal.fire({
        title: "Branch Created!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      form.reset();
      onFormSubmit(); // Close the dialog
    } catch (error: any) {
      Swal.fire("Save Failed", `Failed to create branch: ${error.message}`, "error");
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
              <FormLabel>Branch Name*</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Head Office" {...field} />
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
                Save Branch
                </>
            )}
            </Button>
        </div>
      </form>
    </Form>
  );
}

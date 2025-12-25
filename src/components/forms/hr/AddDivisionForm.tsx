
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { DivisionFormValues } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';

const DivisionSchema = z.object({
  name: z.string().min(2, "Division name must be at least 2 characters long."),
});

interface AddDivisionFormProps {
  onFormSubmit: () => void;
}

export function AddDivisionForm({ onFormSubmit }: AddDivisionFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<DivisionFormValues>({
    resolver: zodResolver(DivisionSchema),
    defaultValues: {
      name: '',
    },
  });

  async function onSubmit(data: DivisionFormValues) {
    setIsSubmitting(true);
    const dataToSave = {
      ...data,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, "divisions"), dataToSave);
      Swal.fire({
        title: "Division Created!",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });
      form.reset();
      onFormSubmit(); // Close the dialog
    } catch (error: any) {
      Swal.fire("Save Failed", `Failed to create division: ${error.message}`, "error");
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
              <FormLabel>Division Name*</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Technical, Sales" {...field} />
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
                Save Division
                </>
            )}
            </Button>
        </div>
      </form>
    </Form>
  );
}

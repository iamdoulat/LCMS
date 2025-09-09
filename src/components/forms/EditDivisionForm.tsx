
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { DivisionFormValues, DivisionDocument } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

const DivisionSchema = z.object({
  name: z.string().min(2, "Division name must be at least 2 characters long."),
});

interface EditDivisionFormProps {
  initialData: DivisionDocument;
  onFormSubmit: () => void;
}

export function EditDivisionForm({ initialData, onFormSubmit }: EditDivisionFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();
  const form = useForm<DivisionFormValues>({
    resolver: zodResolver(DivisionSchema),
    defaultValues: {
      name: initialData.name,
    },
  });

  async function onSubmit(data: DivisionFormValues) {
    setIsSubmitting(true);
    const dataToUpdate = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    try {
      const divisionDocRef = doc(firestore, "divisions", initialData.id);
      await updateDoc(divisionDocRef, dataToUpdate);
      Swal.fire({
        title: "Division Updated!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      onFormSubmit();
    } catch (error: any) {
      Swal.fire("Update Failed", `Failed to update division: ${error.message}`, "error");
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
              <FormLabel>Division Name</FormLabel>
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
                Save Changes
                </>
            )}
            </Button>
        </div>
      </form>
    </Form>
  );
}

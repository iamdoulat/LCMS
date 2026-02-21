
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from "@/hooks/use-toast";
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { DepartmentFormValues, DepartmentDocument } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

const DepartmentSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters long."),
});

interface EditDepartmentFormProps {
  initialData: DepartmentDocument;
  onFormSubmit: () => void;
}

export function EditDepartmentForm({ initialData, onFormSubmit }: EditDepartmentFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(DepartmentSchema),
    defaultValues: {
      name: initialData.name,
    },
  });

  async function onSubmit(data: DepartmentFormValues) {
    setIsSubmitting(true);
    const dataToUpdate = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    try {
      const departmentDocRef = doc(firestore, "departments", initialData.id);
      await updateDoc(departmentDocRef, dataToUpdate);
      toast({
        title: "Department Updated!",
      });
      onFormSubmit();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: `Failed to update department: ${error.message}`,
        variant: 'destructive',
      });
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
              <FormLabel>Department Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Sales & Marketing" {...field} />
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


"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from "@/hooks/use-toast";
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { UnitFormValues, UnitDocument } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

const UnitSchema = z.object({
  name: z.string().min(2, "Unit name must be at least 2 characters long."),
});

interface EditUnitFormProps {
  initialData: UnitDocument;
  onFormSubmit: () => void;
}

export function EditUnitForm({ initialData, onFormSubmit }: EditUnitFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(UnitSchema),
    defaultValues: {
      name: initialData.name,
    },
  });

  async function onSubmit(data: UnitFormValues) {
    setIsSubmitting(true);
    const dataToUpdate = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    try {
      const unitDocRef = doc(firestore, "units", initialData.id);
      await updateDoc(unitDocRef, dataToUpdate);
      toast({
        title: "Unit Updated!",
      });
      onFormSubmit();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: `Failed to update unit: ${error.message}`,
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
              <FormLabel>Unit Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Unit-A" {...field} />
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

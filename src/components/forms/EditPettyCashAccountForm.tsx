
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { PettyCashAccountFormValues, PettyCashAccountDocument } from '@/types';
import { PettyCashAccountSchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save } from 'lucide-react';

interface EditPettyCashAccountFormProps {
  initialData: PettyCashAccountDocument;
  onFormSubmit: () => void;
}

export function EditPettyCashAccountForm({ initialData, onFormSubmit }: EditPettyCashAccountFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<PettyCashAccountFormValues>({
    resolver: zodResolver(PettyCashAccountSchema),
    defaultValues: {
      name: initialData.name,
      balance: initialData.balance,
    },
  });

  async function onSubmit(data: PettyCashAccountFormValues) {
    setIsSubmitting(true);
    const dataToUpdate = {
      ...data,
      balance: Number(data.balance),
      updatedAt: serverTimestamp(),
    };

    try {
      const accountDocRef = doc(firestore, "petty_cash_accounts", initialData.id);
      await updateDoc(accountDocRef, dataToUpdate);
      Swal.fire({
        title: "Account Updated!",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });
      onFormSubmit(); // Close the dialog
    } catch (error: any) {
      Swal.fire("Update Failed", `Failed to update account: ${error.message}`, "error");
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
              <FormLabel>Account Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Office Cash, Manager's Fund" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="balance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current Balance</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} />
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

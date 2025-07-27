
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import type { PettyCashTransactionFormValues, PettyCashAccountDocument, PettyCashTransactionDocument, ChequeType } from '@/types';
import { PettyCashTransactionSchema, transactionTypes, chequeTypeOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, Save, DollarSign, User, List, HelpCircle } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';


interface AddPettyCashTransactionFormProps {
  onFormSubmit: () => void;
}

export function AddPettyCashTransactionForm({ onFormSubmit }: AddPettyCashTransactionFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PettyCashTransactionFormValues>({
    resolver: zodResolver(PettyCashTransactionSchema),
    defaultValues: {
      transactionDate: new Date(),
      type: 'Debit',
      payeeName: '',
      purpose: '',
      description: '',
      amount: undefined,
      chequeType: undefined,
      chequeNumber: undefined,
    },
  });

  async function onSubmit(data: PettyCashTransactionFormValues) {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in to create a transaction.", "error");
      return;
    }
    setIsSubmitting(true);
    
    const defaultAccountId = 'main_petty_cash'; 
    const defaultAccountName = 'Petty Cash';

    const dataToSave = {
      ...data,
      accountId: defaultAccountId,
      accountName: defaultAccountName,
      transactionDate: format(data.transactionDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      amount: Number(data.amount),
      chequeType: undefined, // Fields removed, ensure they are not saved
      chequeNumber: undefined,
      createdBy: user.displayName || user.email || "Unknown User",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    Object.keys(dataToSave).forEach(key => {
        const typedKey = key as keyof typeof dataToSave;
        if (dataToSave[typedKey] === undefined || dataToSave[typedKey] === '') {
            delete (dataToSave as any)[typedKey];
        }
    });

    try {
      await addDoc(collection(firestore, "petty_cash_transactions"), dataToSave);
      Swal.fire({
        title: "Transaction Saved!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      form.reset();
      onFormSubmit(); // Close the dialog
    } catch (error: any) {
      Swal.fire("Save Failed", `Failed to save transaction: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="transactionDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Date*</FormLabel><DatePickerField field={field} /><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Type*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{transactionTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
                control={form.control} name="payeeName" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><User className="mr-1.5 h-4 w-4 text-muted-foreground"/>Payee/Payer*</FormLabel>
                    <FormControl><Input placeholder="e.g., Office Supplies Inc." {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>
            <FormField
                control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4 text-muted-foreground"/>Amount*</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>
        </div>
         <FormField
            control={form.control} name="purpose" render={({ field }) => (
            <FormItem>
                <FormLabel className="flex items-center"><HelpCircle className="mr-1.5 h-4 w-4 text-muted-foreground"/>Purpose</FormLabel>
                <FormControl><Input placeholder="e.g., Monthly utility bill" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
            </FormItem>
        )}/>
        <FormField
            control={form.control} name="description" render={({ field }) => (
            <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl><Textarea placeholder="Add any relevant notes..." {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
            </FormItem>
        )}/>
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
                Save Transaction
                </>
            )}
            </Button>
        </div>
      </form>
    </Form>
  );
}

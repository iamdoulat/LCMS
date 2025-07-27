
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import type { PettyCashTransactionFormValues, PettyCashAccountDocument, PettyCashCategoryDocument, ChequeType } from '@/types';
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

const PLACEHOLDER_CATEGORY_VALUE = "__PETTY_CASH_CATEGORY_PLACEHOLDER__";

interface AddPettyCashTransactionFormProps {
  onFormSubmit: () => void;
}

export function AddPettyCashTransactionForm({ onFormSubmit }: AddPettyCashTransactionFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [categoryOptions, setCategoryOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const form = useForm<PettyCashTransactionFormValues>({
    resolver: zodResolver(PettyCashTransactionSchema),
    defaultValues: {
      transactionDate: new Date(),
      accountId: 'default_petty_cash', // Default value, will be handled in submit
      type: 'Debit',
      payeeName: '',
      categoryId: '',
      purpose: '',
      description: '',
      amount: undefined,
      chequeType: undefined,
      chequeNumber: undefined,
    },
  });

  const watchedCategoryId = form.watch("categoryId");
  const selectedCategoryName = React.useMemo(() => {
    return categoryOptions.find(opt => opt.value === watchedCategoryId)?.label;
  }, [watchedCategoryId, categoryOptions]);
  const showChequeFields = selectedCategoryName === "Cheque Received" || selectedCategoryName === "Cheque Payment";


  React.useEffect(() => {
    const fetchOptions = async () => {
        setIsLoadingDropdowns(true);
        try {
            const categoriesQuery = query(collection(firestore, "petty_cash_categories"), orderBy("name"));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            const fetchedCategories = categoriesSnapshot.docs.map(docSnap => ({
              value: docSnap.id,
              label: (docSnap.data() as PettyCashCategoryDocument).name || 'Unnamed Category'
            }));
            setCategoryOptions(fetchedCategories);

            const defaultCategory = fetchedCategories.find(cat => cat.label === "General Expense");
            if (defaultCategory) {
                form.setValue("categoryId", defaultCategory.value);
            }
        } catch (error) {
            console.error("Error fetching dropdown options:", error);
            Swal.fire("Error", "Could not load categories.", "error");
        } finally {
            setIsLoadingDropdowns(false);
        }
    };
    fetchOptions();
  }, [form]);
  
  React.useEffect(() => {
    if (selectedCategoryName === "Cheque Received") {
      form.setValue('type', 'Credit');
    } else if (selectedCategoryName === "Cheque Payment") {
      form.setValue('type', 'Debit');
    }
  }, [selectedCategoryName, form]);

  async function onSubmit(data: PettyCashTransactionFormValues) {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in to create a transaction.", "error");
      return;
    }
    setIsSubmitting(true);
    
    // Assuming a default account for simplicity since the field is removed
    const defaultAccountId = 'main_petty_cash'; 
    const defaultAccountName = 'Petty Cash';

    const selectedCategory = categoryOptions.find(opt => opt.value === data.categoryId);

    const dataToSave = {
      ...data,
      accountId: defaultAccountId,
      accountName: defaultAccountName,
      transactionDate: format(data.transactionDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      categoryName: selectedCategory?.label || 'Unknown Category',
      amount: Number(data.amount),
      chequeType: showChequeFields ? data.chequeType : undefined,
      chequeNumber: showChequeFields ? data.chequeNumber : undefined,
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
                control={form.control} name="categoryId" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><List className="mr-1.5 h-4 w-4 text-muted-foreground"/>Category*</FormLabel>
                    <Combobox
                        options={categoryOptions}
                        value={field.value || PLACEHOLDER_CATEGORY_VALUE}
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_CATEGORY_VALUE ? '' : value)}
                        placeholder="Search Category..." selectPlaceholder={isLoadingDropdowns ? "Loading..." : "Select a Category"}
                        emptyStateMessage="No category found." disabled={isLoadingDropdowns}/>
                    <FormMessage />
                </FormItem>
            )}/>
            <FormField
                control={form.control} name="payeeName" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><User className="mr-1.5 h-4 w-4 text-muted-foreground"/>Payee/Payer*</FormLabel>
                    <FormControl><Input placeholder="e.g., Office Supplies Inc." {...field} value={field.value ?? ''} /></FormControl>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
                control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4 text-muted-foreground"/>Amount*</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}/>
            {showChequeFields && (
                <>
                    <FormField
                        control={form.control} name="chequeType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cheque Type</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex items-center space-x-4 pt-2">
                                    {chequeTypeOptions.map(type => (
                                        <FormItem key={type} className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value={type} /></FormControl>
                                            <FormLabel className="font-normal">{type}</FormLabel>
                                        </FormItem>
                                    ))}
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField
                        control={form.control} name="chequeNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cheque Number</FormLabel>
                            <FormControl><Input placeholder="Enter cheque number" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </>
            )}
        </div>
        <FormField
            control={form.control} name="description" render={({ field }) => (
            <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl><Textarea placeholder="Add any relevant notes..." {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
            </FormItem>
        )}/>
        <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting || isLoadingDropdowns}>
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

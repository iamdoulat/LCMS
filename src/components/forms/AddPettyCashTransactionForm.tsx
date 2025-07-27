
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
import { Loader2, Save, DollarSign, User, List, HelpCircle, Wallet } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select'; // Import MultiSelect

const PLACEHOLDER_ACCOUNT_VALUE = "__PETTY_CASH_ACCOUNT_PLACEHOLDER__";

interface AddPettyCashTransactionFormProps {
  onFormSubmit: () => void;
}

export function AddPettyCashTransactionForm({ onFormSubmit }: AddPettyCashTransactionFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [accountOptions, setAccountOptions] = React.useState<ComboboxOption[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<MultiSelectOption[]>([]); // Changed to MultiSelectOption
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const form = useForm<PettyCashTransactionFormValues>({
    resolver: zodResolver(PettyCashTransactionSchema),
    defaultValues: {
      transactionDate: new Date(),
      accountId: '',
      type: 'Debit',
      payeeName: '',
      categoryIds: [], // Changed from categoryId
      purpose: '',
      description: '',
      amount: undefined,
      chequeType: undefined,
      chequeNumber: undefined,
    },
  });

  const watchedCategoryIds = form.watch("categoryIds");
  const selectedCategoryNames = React.useMemo(() => {
    return categoryOptions
      .filter(opt => watchedCategoryIds?.includes(opt.value))
      .map(opt => opt.label);
  }, [watchedCategoryIds, categoryOptions]);
  const showChequeFields = selectedCategoryNames.includes("Cheque Received") || selectedCategoryNames.includes("Cheque Payment");
  
  React.useEffect(() => {
    const fetchDropdowns = async () => {
        setIsLoadingDropdowns(true);
        try {
            const accountsQuery = query(collection(firestore, "petty_cash_accounts"), orderBy("name"));
            const categoriesQuery = query(collection(firestore, "petty_cash_categories"), orderBy("name"));

            const [accountsSnapshot, categoriesSnapshot] = await Promise.all([
                getDocs(accountsQuery),
                getDocs(categoriesQuery)
            ]);

            setAccountOptions(accountsSnapshot.docs.map(docSnap => ({
                value: docSnap.id,
                label: (docSnap.data() as PettyCashAccountDocument).name || 'Unnamed Account'
            })));
            setCategoryOptions(categoriesSnapshot.docs.map(docSnap => ({
              value: docSnap.id,
              label: (docSnap.data() as PettyCashCategoryDocument).name || 'Unnamed Category'
            })));

        } catch (error) {
            console.error("Error fetching dropdown options:", error);
            Swal.fire("Error", "Could not load accounts or categories.", "error");
        } finally {
            setIsLoadingDropdowns(false);
        }
    };
    fetchDropdowns();
  }, []);

  React.useEffect(() => {
    if (!isLoadingDropdowns && accountOptions.length > 0) {
      if (!form.getValues('accountId')) {
         form.setValue('accountId', accountOptions[0].value, { shouldValidate: true });
      }
    }
  }, [isLoadingDropdowns, accountOptions, form]);
  
  React.useEffect(() => {
    if (selectedCategoryNames.includes("Cheque Received")) {
      form.setValue('type', 'Credit');
    } else if (selectedCategoryNames.includes("Cheque Payment")) {
      form.setValue('type', 'Debit');
    }
  }, [selectedCategoryNames, form]);

  async function onSubmit(data: PettyCashTransactionFormValues) {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in to create a transaction.", "error");
      return;
    }
    setIsSubmitting(true);
    
    const selectedAccount = accountOptions.find(opt => opt.value === data.accountId);
    const selectedCategories = categoryOptions.filter(opt => data.categoryIds?.includes(opt.value));

    const dataToSave = {
      ...data,
      accountName: selectedAccount?.label || 'N/A',
      categoryIds: data.categoryIds, // Ensure it's an array
      categoryNames: selectedCategories.map(c => c.label), // Save array of names
      transactionDate: format(data.transactionDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      amount: Number(data.amount),
      chequeType: showChequeFields ? data.chequeType : undefined,
      chequeNumber: showChequeFields ? data.chequeNumber : undefined,
      createdBy: user.displayName || user.email || "Unknown User",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    Object.keys(dataToSave).forEach(key => {
        const typedKey = key as keyof typeof dataToSave;
        if (dataToSave[typedKey] === undefined || dataToSave[typedKey] === '' || (Array.isArray(dataToSave[typedKey]) && (dataToSave[typedKey] as any[]).length === 0)) {
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
      onFormSubmit();
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
            <FormField
                control={form.control} name="accountId" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Wallet className="mr-1.5 h-4 w-4 text-muted-foreground"/>Source Account*</FormLabel>
                    <Combobox
                        options={accountOptions}
                        value={field.value || PLACEHOLDER_ACCOUNT_VALUE}
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_ACCOUNT_VALUE ? '' : value)}
                        placeholder="Search Account..." selectPlaceholder={isLoadingDropdowns ? "Loading..." : "Select an Account"}
                        emptyStateMessage="No account found." disabled={isLoadingDropdowns}/>
                    <FormMessage />
                </FormItem>
            )}/>
             <FormField
                control={form.control} name="categoryIds" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><List className="mr-1.5 h-4 w-4 text-muted-foreground"/>Category*</FormLabel>
                    <MultiSelect
                      options={categoryOptions}
                      selected={field.value || []}
                      onChange={field.onChange}
                      placeholder="Select categories..."
                      disabled={isLoadingDropdowns}
                    />
                    <FormMessage />
                </FormItem>
            )}/>
        </div>
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
        
        {showChequeFields && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>
        )}

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


"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, query, orderBy, updateDoc } from 'firebase/firestore';
import { format, parseISO, isValid } from 'date-fns';
import type { PettyCashTransactionFormValues, PettyCashAccountDocument, PettyCashCategoryDocument, PettyCashTransactionDocument, ChequeType } from '@/types';
import { PettyCashTransactionSchema, transactionTypes, chequeTypeOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, Save, DollarSign, User, List, HelpCircle, Wallet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';

interface EditPettyCashTransactionFormProps {
  initialData: PettyCashTransactionDocument;
  onFormSubmit: () => void;
}

export function EditPettyCashTransactionForm({ initialData, onFormSubmit }: EditPettyCashTransactionFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [accountOptions, setAccountOptions] = React.useState<MultiSelectOption[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<MultiSelectOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const form = useForm<PettyCashTransactionFormValues>({
    resolver: zodResolver(PettyCashTransactionSchema),
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
    if (initialData && !isLoadingDropdowns) {
        form.reset({
            transactionDate: initialData.transactionDate ? parseISO(initialData.transactionDate) : new Date(),
            accountId: initialData.accountId,
            type: initialData.type,
            payeeName: initialData.payeeName,
            categoryIds: Array.isArray(initialData.categoryIds) ? initialData.categoryIds : [],
            purpose: initialData.purpose,
            description: initialData.description,
            amount: initialData.amount,
            chequeType: initialData.chequeType,
            chequeNumber: initialData.chequeNumber,
        });
    }
  }, [initialData, form, isLoadingDropdowns]);
  
  React.useEffect(() => {
    if (selectedCategoryNames.includes("Cheque Received")) {
      form.setValue('type', 'Credit');
    } else if (selectedCategoryNames.includes("Cheque Payment")) {
      form.setValue('type', 'Debit');
    }
  }, [selectedCategoryNames, form]);

  async function onSubmit(data: PettyCashTransactionFormValues) {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in to update a transaction.", "error");
      return;
    }
    setIsSubmitting(true);

    const selectedAccount = accountOptions.find(opt => opt.value === data.accountId);
    const selectedCategories = categoryOptions.filter(opt => data.categoryIds?.includes(opt.value));

    const dataToUpdate: Record<string, any> = {
      ...data,
      transactionDate: format(data.transactionDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      accountId: data.accountId,
      accountName: selectedAccount?.label || 'N/A',
      categoryIds: data.categoryIds,
      categoryNames: selectedCategories.map(c => c.label),
      amount: Number(data.amount),
      chequeType: showChequeFields ? data.chequeType : undefined,
      chequeNumber: showChequeFields ? data.chequeNumber : undefined,
      updatedAt: serverTimestamp(),
      updatedBy: user.displayName || user.email || "Unknown User",
    };
    
    Object.keys(dataToUpdate).forEach(key => {
        const typedKey = key as keyof typeof dataToUpdate;
        if (dataToUpdate[typedKey] === undefined || dataToUpdate[typedKey] === '' || (Array.isArray(dataToUpdate[typedKey]) && (dataToUpdate[typedKey] as any[]).length === 0)) {
            dataToUpdate[key] = null; // Use null to remove field in Firestore update
        }
    });

    try {
      const transactionDocRef = doc(firestore, "petty_cash_transactions", initialData.id);
      await updateDoc(transactionDocRef, dataToUpdate);
      Swal.fire({
        title: "Transaction Updated!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      onFormSubmit();
    } catch (error: any) {
      Swal.fire("Update Failed", `Failed to update transaction: ${error.message}`, "error");
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
                control={form.control} name="accountId" render={({ field }) => (
                <FormItem className="space-y-3">
                    <FormLabel className="flex items-center"><Wallet className="mr-1.5 h-4 w-4 text-muted-foreground"/>Source Account*</FormLabel>
                    <FormControl>
                        <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-1"
                            disabled={isLoadingDropdowns}
                        >
                            {(accountOptions as ComboboxOption[]).map((account) => (
                                <FormItem key={account.value} className="flex items-center space-x-3 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value={account.value} />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                        {account.label}
                                    </FormLabel>
                                </FormItem>
                            ))}
                        </RadioGroup>
                    </FormControl>
                    {isLoadingDropdowns && <p className="text-sm text-muted-foreground">Loading accounts...</p>}
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
            <Button type="submit" disabled={isSubmitting || isLoadingDropdowns}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
        </div>
      </form>
    </Form>
  );
}

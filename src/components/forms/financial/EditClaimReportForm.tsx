
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, updateDoc, query } from 'firebase/firestore';
import type { ClaimReportFormValues, CustomerDocument, SupplierDocument, InstallationReportDocument, ClaimReportDocument } from '@/types';
import { ClaimReportSchema, claimStatusOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/common';
import { Loader2, Save, Users, Building, FileText, CalendarDays, Hash, Link as LinkIcon, ExternalLink, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-4 flex items-center";

const PLACEHOLDER_CUSTOMER_VALUE = "__CLAIM_EDIT_CUSTOMER__";
const PLACEHOLDER_SUPPLIER_VALUE = "__CLAIM_EDIT_SUPPLIER__";
const PLACEHOLDER_INVOICE_VALUE = "__CLAIM_EDIT_INVOICE__";

interface ReportInvoiceOption extends ComboboxOption {
    reportData?: InstallationReportDocument;
}

interface EditClaimReportFormProps {
  initialData: ClaimReportDocument;
  reportId: string;
}

export function EditClaimReportForm({ initialData, reportId }: EditClaimReportFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<ComboboxOption[]>([]);
  const [supplierOptions, setSupplierOptions] = React.useState<ComboboxOption[]>([]);
  const [reportInvoiceOptions, setReportInvoiceOptions] = React.useState<ReportInvoiceOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [selectedInvoiceDate, setSelectedInvoiceDate] = React.useState<string | null>(null);

  const form = useForm<ClaimReportFormValues>({
    resolver: zodResolver(ClaimReportSchema),
    defaultValues: {
      ...initialData,
      claimDate: initialData.claimDate ? parseISO(initialData.claimDate) : new Date(),
      claimQty: initialData.claimQty,
      partialReceivedQty: initialData.partialReceivedQty,
    },
  });

  const { control, setValue, watch, reset } = form;

  const watchedInvoiceId = watch("invoiceId");
  const watchedClaimQty = watch("claimQty");
  const watchedPartialReceivedQty = watch("partialReceivedQty");

  React.useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, suppliersSnap, reportsSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "suppliers")),
          getDocs(query(collection(firestore, "installation_reports")))
        ]);
        setCustomerOptions(customersSnap.docs.map(doc => ({ value: doc.id, label: (doc.data() as CustomerDocument).applicantName || 'Unnamed Customer' })));
        setSupplierOptions(suppliersSnap.docs.map(doc => ({ value: doc.id, label: (doc.data() as SupplierDocument).beneficiaryName || 'Unnamed Supplier' })));
        setReportInvoiceOptions(
          reportsSnap.docs.map(doc => {
            const data = doc.data() as InstallationReportDocument;
            return {
              value: doc.id, // Use report ID as a unique value
              label: `${data.commercialInvoiceNumber || 'No C.I.'} - ${data.applicantName}`,
              reportData: { ...data, id: doc.id },
            };
          })
        );
      } catch (error) {
        Swal.fire("Error", "Could not load required data. Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, []);

  React.useEffect(() => {
    if (watchedInvoiceId) {
      const selectedReport = reportInvoiceOptions.find(opt => opt.value === watchedInvoiceId)?.reportData;
      if (selectedReport) {
        const date = selectedReport.commercialInvoiceDate ? parseISO(selectedReport.commercialInvoiceDate) : null;
        setSelectedInvoiceDate(date && isValid(date) ? format(date, 'PPP') : 'Invalid Date');
        setValue("customerId", selectedReport.applicantId, { shouldValidate: true });
        setValue("supplierId", selectedReport.beneficiaryId, { shouldValidate: true });
      } else {
        setSelectedInvoiceDate(null);
      }
    } else {
        setSelectedInvoiceDate(null);
    }
  }, [watchedInvoiceId, reportInvoiceOptions, setValue]);

  const pendingQty = React.useMemo(() => {
    const claim = Number(watchedClaimQty || 0);
    const received = Number(watchedPartialReceivedQty || 0);
    return claim - received;
  }, [watchedClaimQty, watchedPartialReceivedQty]);

  async function onSubmit(data: ClaimReportFormValues) {
    setIsSubmitting(true);
    
    const customer = customerOptions.find(c => c.value === data.customerId);
    const supplier = supplierOptions.find(s => s.value === data.supplierId);

    const dataToUpdate: Partial<Omit<ClaimReportDocument, 'id' | 'createdAt'>> & { updatedAt: any } = {
      customerName: customer?.label || initialData.customerName,
      supplierName: supplier?.label || initialData.supplierName,
      claimNumber: data.claimNumber,
      claimDate: format(data.claimDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      invoiceId: data.invoiceId,
      claimQty: Number(data.claimQty),
      partialReceivedQty: Number(data.partialReceivedQty || 0),
      pendingQty: pendingQty,
      emailsViewUrl: data.emailsViewUrl || '',
      claimReportUrl: data.claimReportUrl || '',
      preparedBy: data.preparedBy,
      emailResentCount: Number(data.emailResentCount || 0),
      status: data.status,
      claimDescription: data.claimDescription || '',
      supplierComments: data.supplierComments || '',
      updatedAt: serverTimestamp(),
    };
    
    Object.keys(dataToUpdate).forEach(key => {
        const typedKey = key as keyof typeof dataToUpdate;
        if (dataToUpdate[typedKey] === undefined) {
            delete dataToUpdate[typedKey];
        }
    });

    try {
      const reportDocRef = doc(firestore, "claim_reports", reportId);
      await updateDoc(reportDocRef, dataToUpdate);
      Swal.fire("Success", "Claim report updated successfully!", "success").then(() => {
        router.push('/dashboard/warranty-management/claim-report-list');
      });
    } catch (error: any) {
      Swal.fire("Error", `Failed to update report: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleViewUrl = (url: string | undefined | null) => {
    if (url && url.trim() !== "") {
      try {
        new URL(url); window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) { Swal.fire("Invalid URL", "The provided URL is not valid.", "error"); }
    } else { Swal.fire("No URL", "No URL provided to view.", "info"); }
  };

  if (isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <h3 className={cn(sectionHeadingClass)}><FileText className="mr-2 h-5 w-5" />Claim &amp; Invoice Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={control}
              name="invoiceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Against Claim*</FormLabel>
                    <Combobox
                      options={reportInvoiceOptions}
                      value={field.value || PLACEHOLDER_INVOICE_VALUE}
                      onValueChange={(value) => field.onChange(value === PLACEHOLDER_INVOICE_VALUE ? '' : value)}
                      placeholder="Select Invoice from Installation Report..."
                      selectPlaceholder="Select from Installation Reports..."
                      emptyStateMessage="No Installation Report Found"
                    />
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormItem>
                <FormLabel>Invoice Date</FormLabel>
                <Input value={selectedInvoiceDate || 'N/A'} readOnly disabled className="bg-muted/50 cursor-not-allowed"/>
            </FormItem>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FormField control={control} name="customerId" render={({ field }) => (
                <FormItem><FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Customer Name*</FormLabel>
                    <Combobox 
                      options={customerOptions} 
                      value={field.value || PLACEHOLDER_CUSTOMER_VALUE} 
                      onValueChange={val => field.onChange(val === PLACEHOLDER_CUSTOMER_VALUE ? '' : val)} 
                      placeholder="Select Customer..."
                      disabled={!!watchedInvoiceId} // Disable if invoice is selected
                    />
                <FormMessage />
                </FormItem>
            )}/>
            <FormField control={control} name="supplierId" render={({ field }) => (
                <FormItem><FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Supplier Name*</FormLabel>
                    <Combobox 
                      options={supplierOptions} 
                      value={field.value || PLACEHOLDER_SUPPLIER_VALUE} 
                      onValueChange={val => field.onChange(val === PLACEHOLDER_SUPPLIER_VALUE ? '' : val)} 
                      placeholder="Select Supplier..."
                      disabled={!!watchedInvoiceId} // Disable if invoice is selected
                    />
                <FormMessage />
                </FormItem>
            )}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField control={control} name="claimNumber" render={({ field }) => (<FormItem><FormLabel>Claim Number*</FormLabel><FormControl><Input placeholder="Claim No." {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="claimDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Claim Date*</FormLabel><DatePickerField field={field} /><FormMessage /></FormItem>)}/>
            <FormItem>
              <FormLabel>Last Date of Update</FormLabel>
              <Input
                value={initialData.updatedAt && isValid(new Date(initialData.updatedAt as any)) ? format(new Date(initialData.updatedAt as any), 'PPP p') : 'N/A'}
                disabled readOnly className="bg-muted/50" />
            </FormItem>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField control={control} name="claimQty" render={({ field }) => (<FormItem><FormLabel>Claim Qty*</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="partialReceivedQty" render={({ field }) => (<FormItem><FormLabel>Partial Received Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormItem><FormLabel>Pending Qty</FormLabel><Input value={pendingQty} readOnly disabled className="bg-muted/50"/></FormItem>
        </div>
        
        <div className="space-y-4">
            <FormField control={control} name="emailsViewUrl" render={({ field }) => (
                <FormItem><FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Emails View URL</FormLabel>
                    <div className="flex items-center gap-2">
                        <FormControl><Input type="url" placeholder="https://mail.google.com/..." {...field} /></FormControl>
                        <Button type="button" variant="outline" size="icon" onClick={() => handleViewUrl(field.value)} disabled={!field.value}><ExternalLink className="h-4 w-4" /></Button>
                        <Button type="button" variant="secondary" onClick={() => window.open('https://drive.google.com/drive/folders/1HWlTkjdz5DPWDHgmFPK8uspdK2kOj2cy?usp=sharing', '_blank')}><Upload className="mr-2 h-4 w-4"/> Upload</Button>
                        <Button type="button" variant="secondary" onClick={() => window.open('https://www.coolutils.com/online/EML-to-PDF', '_blank')}>EML to PDF</Button>
                    </div>
                    <FormMessage />
                </FormItem>
            )}/>
             <FormField control={control} name="claimReportUrl" render={({ field }) => (
                <FormItem><FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Claim Report (.xls) URL</FormLabel>
                    <div className="flex items-center gap-2">
                        <FormControl><Input type="url" placeholder="https://docs.google.com/spreadsheets/..." {...field} /></FormControl>
                        <Button type="button" variant="outline" size="icon" onClick={() => handleViewUrl(field.value)} disabled={!field.value}><ExternalLink className="h-4 w-4" /></Button>
                    </div>
                    <FormMessage />
                </FormItem>
            )}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField control={control} name="preparedBy" render={({ field }) => (<FormItem><FormLabel>Claim Prepared by*</FormLabel><FormControl><Input placeholder="Prepared by name" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="emailResentCount" render={({ field }) => (<FormItem><FormLabel>No. of Email Resent</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="status" render={({ field }) => (<FormItem><FormLabel>Current Claim Status*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger></FormControl>
                <SelectContent>{claimStatusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
            )}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={control} name="claimDescription" render={({ field }) => (<FormItem><FormLabel>Claim Description</FormLabel><FormControl><Textarea placeholder="Describe the claim details..." rows={4} {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="supplierComments" render={({ field }) => (<FormItem><FormLabel>Supplier Comments on Email</FormLabel><FormControl><Textarea placeholder="Record supplier's comments..." rows={4} {...field} /></FormControl><FormMessage /></FormItem>)}/>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
          {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Changes...</>) : (<><Save className="mr-2 h-4 w-4"/>Save Changes</>)}
        </Button>
      </form>
    </Form>
  );
}

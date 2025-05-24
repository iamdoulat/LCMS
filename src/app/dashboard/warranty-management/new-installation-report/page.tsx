
"use client";

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid, addDays, differenceInDays } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { CustomerDocument, SupplierDocument, LCEntryDocument, PartialShipmentAllowed, Currency, InstallationDetailItem as InstallationDetailItemType, LcForInvoiceDropdownOption } from '@/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Loader2, Wrench, Users, Building, FileText, CalendarDays, DollarSign, Hash, Link as LinkIcon, ExternalLink, Package, Plus, Minus, UserCheck, Edit, ClipboardList, PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_APPLICANT_VALUE = "__INSTALL_REPORT_APPLICANT__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__INSTALL_REPORT_BENEFICIARY__";
const PLACEHOLDER_COMMERCIAL_INVOICE_VALUE = "__INSTALL_REPORT_COMM_INV__";


const installationDetailItemSchema = z.object({
  slNo: z.string().optional(),
  machineModel: z.string().min(1, "Machine Model is required."),
  serialNo: z.string().min(1, "Serial No. is required."),
  ctlBoxModel: z.string().optional(),
  ctlBoxSerial: z.string().optional(),
  installDate: z.date({ required_error: "Install Date is required." }),
});

const installationReportSchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required"),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required"),
  selectedCommercialInvoiceLcId: z.string().optional(),
  documentaryCreditNumber: z.string().optional(),
  totalMachineQty: z.preprocess(
    (val) => (String(val).trim() === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Qty must be a number" }).int().positive("Qty must be positive").optional()
  ),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional().nullable(),
  etdDate: z.date().optional().nullable(),
  etaDate: z.date().optional().nullable(),
  packingListUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format for Packing List" }).optional()
  ),
  technicianName: z.string().min(1, "Technician Name is required."),
  reportingEngineerName: z.string().min(1, "Reporting Engineer Name is required."),
  installationDetails: z.array(installationDetailItemSchema).min(1, "At least one installation detail is required."),
  missingItemInfo: z.string().optional(),
  extraFoundInfo: z.string().optional(),
  installationNotes: z.string().optional(),
});

type InstallationReportFormValues = z.infer<typeof installationReportSchema>;

const formatDisplayDate = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyDisplay = (currency?: Currency | string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const renderPartialDetailReadOnly = (label: string, value?: number | string | null, currency?: Currency) => {
  let displayValue = (typeof value === 'number' && !isNaN(value)) ? value.toString() : (value || "0");
  if (currency && (label.toLowerCase().includes("amount") || label.toLowerCase().includes("amt"))) {
      displayValue = formatCurrencyDisplay(currency, parseFloat(displayValue));
  }
  return (
    <FormItem className="mb-2">
        <FormLabel className="text-xs text-muted-foreground">{label}</FormLabel>
        <Input type="text" value={displayValue} readOnly disabled className="h-8 text-xs bg-muted/50 cursor-not-allowed" />
    </FormItem>
  );
};


export default function NewInstallationReportPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [lcOptionsForCommercialInvoice, setLcOptionsForCommercialInvoice] = React.useState<LcForInvoiceDropdownOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [isLoadingLcOptions, setIsLoadingLcOptions] = React.useState(true);
  const [selectedLcDetails, setSelectedLcDetails] = React.useState<{
    isFirstShipment?: boolean;
    isSecondShipment?: boolean;
    isThirdShipment?: boolean;
    lcIdForLink: string | null;
    partialShipmentAllowed?: PartialShipmentAllowed;
    firstPartialQty?: number; firstPartialAmount?: number; firstPartialPkgs?: number; firstPartialNetWeight?: number; firstPartialGrossWeight?: number; firstPartialCbm?: number;
    secondPartialQty?: number; secondPartialAmount?: number; secondPartialPkgs?: number; secondPartialNetWeight?: number; secondPartialGrossWeight?: number; secondPartialCbm?: number;
    thirdPartialQty?: number; thirdPartialAmount?: number; thirdPartialPkgs?: number; thirdPartialNetWeight?: number; thirdPartialGrossWeight?: number; thirdPartialCbm?: number;
    currency?: Currency;
  }>({
    lcIdForLink: null,
    partialShipmentAllowed: "No",
    firstPartialQty: 0, firstPartialAmount: 0, firstPartialPkgs: 0, firstPartialNetWeight: 0, firstPartialGrossWeight: 0, firstPartialCbm: 0,
    secondPartialQty: 0, secondPartialAmount: 0, secondPartialPkgs: 0, secondPartialNetWeight: 0, secondPartialGrossWeight: 0, secondPartialCbm: 0,
    thirdPartialQty: 0, thirdPartialAmount: 0, thirdPartialPkgs: 0, thirdPartialNetWeight: 0, thirdPartialGrossWeight: 0, thirdPartialCbm: 0,
    currency: 'USD',
  });
  const [activePartialShipmentAccordion, setActivePartialShipmentAccordion] = React.useState<string | undefined>(undefined);
  const [selectedCommercialInvoiceDateDisplay, setSelectedCommercialInvoiceDateDisplay] = React.useState<string | null>(null);
  const [pendingQty, setPendingQty] = React.useState<number | string>('N/A');

  const form = useForm<InstallationReportFormValues>({
    resolver: zodResolver(installationReportSchema),
    defaultValues: {
      applicantId: '',
      beneficiaryId: '',
      selectedCommercialInvoiceLcId: undefined,
      documentaryCreditNumber: '',
      totalMachineQty: undefined,
      proformaInvoiceNumber: '',
      invoiceDate: undefined,
      etdDate: undefined,
      etaDate: undefined,
      packingListUrl: '',
      technicianName: '',
      reportingEngineerName: '',
      installationDetails: [{ slNo: '1', machineModel: '', serialNo: '', ctlBoxModel: '', ctlBoxSerial: '', installDate: undefined as any }],
      missingItemInfo: '',
      extraFoundInfo: '',
      installationNotes: '',
    },
  });

  const { control, setValue, watch, reset, formState } = form;
  const watchedSelectedCommercialInvoiceLcId = watch("selectedCommercialInvoiceLcId");
  const watchedTotalLcMachineQty = watch("totalMachineQty");

  const { fields: installationDetailsFields, append: appendInstallationDetail, remove: removeInstallationDetail } = useFieldArray({
    control,
    name: "installationDetails",
  });

  React.useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingDropdowns(true);
      setIsLoadingLcOptions(true);
      try {
        const [customersSnap, suppliersSnap, lcsSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "suppliers")),
          getDocs(query(collection(firestore, "lc_entries"), where("commercialInvoiceNumber", "!=", "")))
        ]);

        setApplicantOptions(
          customersSnap.docs.map(doc => ({ value: doc.id, label: (doc.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
        );
        setBeneficiaryOptions(
          suppliersSnap.docs.map(doc => ({ value: doc.id, label: (doc.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );

        const fetchedLcOptions: LcForInvoiceDropdownOption[] = [];
        lcsSnap.forEach(doc => {
          const data = doc.data() as LCEntryDocument;
          if (data.commercialInvoiceNumber) {
            fetchedLcOptions.push({
              value: doc.id,
              label: data.commercialInvoiceNumber,
              lcData: { id: doc.id, ...data } as LcForInvoiceDropdownOption['lcData'],
            });
          }
        });
        setLcOptionsForCommercialInvoice(fetchedLcOptions);

      } catch (error: any) {
        console.error("Error fetching dropdown options for Installation Report form: ", error);
        Swal.fire("Error", `Could not load supporting data. Error: ${error.message}`, "error");
      } finally {
        setIsLoadingDropdowns(false);
        setIsLoadingLcOptions(false);
      }
    };
    fetchOptions();
  }, []);

  React.useEffect(() => {
    if (watchedSelectedCommercialInvoiceLcId && lcOptionsForCommercialInvoice.length > 0) {
      const selectedOption = lcOptionsForCommercialInvoice.find(opt => opt.value === watchedSelectedCommercialInvoiceLcId);
      if (selectedOption) {
        const lc = selectedOption.lcData;
        setValue("applicantId", lc.applicantId || '', { shouldValidate: true });
        setValue("beneficiaryId", lc.beneficiaryId || '', { shouldValidate: true });
        setValue("documentaryCreditNumber", lc.documentaryCreditNumber || '', { shouldValidate: true });
        setValue("totalMachineQty", lc.totalMachineQty || undefined, { shouldValidate: true });
        setValue("proformaInvoiceNumber", lc.proformaInvoiceNumber || '', { shouldValidate: true });
        setValue("invoiceDate", lc.invoiceDate && isValid(parseISO(lc.invoiceDate)) ? parseISO(lc.invoiceDate) : undefined, { shouldValidate: true });
        setValue("etdDate", lc.etd && isValid(parseISO(lc.etd)) ? parseISO(lc.etd) : undefined, { shouldValidate: true });
        setValue("etaDate", lc.eta && isValid(parseISO(lc.eta)) ? parseISO(lc.eta) : undefined, { shouldValidate: true });
        setValue("packingListUrl", lc.packingListUrl || '', { shouldValidate: true });
        
        setSelectedLcDetails({
            isFirstShipment: lc.isFirstShipment,
            isSecondShipment: lc.isSecondShipment,
            isThirdShipment: lc.isThirdShipment,
            lcIdForLink: lc.id,
            partialShipmentAllowed: lc.partialShipmentAllowed,
            firstPartialQty: lc.firstPartialQty || 0, firstPartialAmount: lc.firstPartialAmount || 0, firstPartialPkgs: lc.firstPartialPkgs || 0, firstPartialNetWeight: lc.firstPartialNetWeight || 0, firstPartialGrossWeight: lc.firstPartialGrossWeight || 0, firstPartialCbm: lc.firstPartialCbm || 0,
            secondPartialQty: lc.secondPartialQty || 0, secondPartialAmount: lc.secondPartialAmount || 0, secondPartialPkgs: lc.secondPartialPkgs || 0, secondPartialNetWeight: lc.secondPartialNetWeight || 0, secondPartialGrossWeight: lc.secondPartialGrossWeight || 0, secondPartialCbm: lc.secondPartialCbm || 0,
            thirdPartialQty: lc.thirdPartialQty || 0, thirdPartialAmount: lc.thirdPartialAmount || 0, thirdPartialPkgs: lc.thirdPartialPkgs || 0, thirdPartialNetWeight: lc.thirdPartialNetWeight || 0, thirdPartialGrossWeight: lc.thirdPartialGrossWeight || 0, thirdPartialCbm: lc.thirdPartialCbm || 0,
            currency: lc.currency || 'USD',
        });
        setSelectedCommercialInvoiceDateDisplay(lc.commercialInvoiceDate ? formatDisplayDate(lc.commercialInvoiceDate) : null);

      }
    } else if (!watchedSelectedCommercialInvoiceLcId) {
      // Clear fields if no Commercial Invoice is selected
      setValue("applicantId", '', { shouldValidate: true });
      setValue("beneficiaryId", '', { shouldValidate: true });
      setValue("documentaryCreditNumber", '', { shouldValidate: true });
      setValue("totalMachineQty", undefined, { shouldValidate: true });
      setValue("proformaInvoiceNumber", '', { shouldValidate: true });
      setValue("invoiceDate", undefined, { shouldValidate: true });
      setValue("etdDate", undefined, { shouldValidate: true });
      setValue("etaDate", undefined, { shouldValidate: true });
      setValue("packingListUrl", '', { shouldValidate: true });
      setSelectedLcDetails({
        lcIdForLink: null,
        partialShipmentAllowed: "No",
        firstPartialQty: 0, firstPartialAmount: 0, firstPartialPkgs: 0, firstPartialNetWeight: 0, firstPartialGrossWeight: 0, firstPartialCbm: 0,
        secondPartialQty: 0, secondPartialAmount: 0, secondPartialPkgs: 0, secondPartialNetWeight: 0, secondPartialGrossWeight: 0, secondPartialCbm: 0,
        thirdPartialQty: 0, thirdPartialAmount: 0, thirdPartialPkgs: 0, thirdPartialNetWeight: 0, thirdPartialGrossWeight: 0, thirdPartialCbm: 0,
        currency: 'USD',
      });
      setSelectedCommercialInvoiceDateDisplay(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedSelectedCommercialInvoiceLcId, lcOptionsForCommercialInvoice, setValue]);

  React.useEffect(() => {
    const totalLcQty = Number(watchedTotalLcMachineQty || 0);
    const installedQty = installationDetailsFields.length;
    if (watchedTotalLcMachineQty !== undefined) {
      setPendingQty(totalLcQty - installedQty);
    } else {
      setPendingQty('N/A');
    }
  }, [watchedTotalLcMachineQty, installationDetailsFields.length]);


  async function onSubmit(data: InstallationReportFormValues) {
    setIsSubmitting(true);
    const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);

    const dataToLog = {
      ...data,
      applicantName: selectedApplicant?.label,
      beneficiaryName: selectedBeneficiary?.label,
      installationDetails: data.installationDetails.map(item => ({
        ...item,
        installDate: item.installDate ? format(item.installDate, 'PPP') : 'N/A',
      })),
    };
    console.log("Installation Report Data (Simulated Save):", dataToLog);

    Swal.fire({
      title: "Form Submitted (Simulated)",
      html: `Installation Report data has been logged to the console.
             <br/><br/>Selected L/C ID (via C.I. No.): <strong>${data.selectedCommercialInvoiceLcId || "None"}</strong>
             <br/>Applicant: <strong>${selectedApplicant?.label || "N/A"}</strong>
             <br/>Beneficiary: <strong>${selectedBeneficiary?.label || "N/A"}</strong>
             <br/>Technician: <strong>${data.technicianName}</strong>
             <br/>Reporting Engineer: <strong>${data.reportingEngineerName}</strong>
             <br/><br/>Actual saving to a database (e.g., 'installation_reports' collection in Firestore) is not yet implemented for this form.`,
      icon: "info",
    });
    setIsSubmitting(false);
    // reset(); // Consider if form should reset after simulated submission
  }

  const handleViewUrl = (url: string | undefined | null) => {
    if (url && url.trim() !== "") {
      try {
        new URL(url);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        Swal.fire("Invalid URL", "The provided URL is not valid.", "error");
      }
    } else {
      Swal.fire("No URL", "No URL provided to view.", "info");
    }
  };

  const isLcSelected = !!watchedSelectedCommercialInvoiceLcId;

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", sectionHeadingClass.replace('border-b pb-2 mb-6', '').replace('font-bold text-xl lg:text-2xl', 'font-bold text-2xl lg:text-3xl'))}>
            <Wrench className="h-7 w-7 text-primary" />
            New Installation Report
          </CardTitle>
          <CardDescription>
            Fill in the details below. Select a Commercial Invoice Number to auto-fill L/C details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

              <h3 className={cn(sectionHeadingClass)}>
                <FileText className="mr-2 h-5 w-5 text-primary" />
                L/C & Invoice Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={control}
                  name="applicantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Applicant Name*</FormLabel>
                      <Combobox
                        options={applicantOptions}
                        value={field.value || PLACEHOLDER_APPLICANT_VALUE}
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_APPLICANT_VALUE ? '' : value)}
                        placeholder="Search Applicant..."
                        selectPlaceholder={isLoadingDropdowns ? "Loading Applicants..." : "Select Applicant"}
                        emptyStateMessage="No applicant found."
                        disabled={isLoadingDropdowns || isLcSelected}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="beneficiaryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Beneficiary Name*</FormLabel>
                      <Combobox
                        options={beneficiaryOptions}
                        value={field.value || PLACEHOLDER_BENEFICIARY_VALUE}
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_BENEFICIARY_VALUE ? '' : value)}
                        placeholder="Search Beneficiary..."
                        selectPlaceholder={isLoadingDropdowns ? "Loading Beneficiaries..." : "Select Beneficiary"}
                        emptyStateMessage="No beneficiary found."
                        disabled={isLoadingDropdowns || isLcSelected}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                 <FormField
                    control={control}
                    name="selectedCommercialInvoiceLcId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Commercial Invoice Number (to auto-fill)</FormLabel>
                        <Combobox
                          options={lcOptionsForCommercialInvoice}
                          value={field.value || PLACEHOLDER_COMMERCIAL_INVOICE_VALUE}
                          onValueChange={(value) => field.onChange(value === PLACEHOLDER_COMMERCIAL_INVOICE_VALUE ? undefined : value)}
                          placeholder="Search by C.I. No..."
                          selectPlaceholder={isLoadingLcOptions ? "Loading C.I. Numbers..." : "Select C.I. Number"}
                          emptyStateMessage="No L/C found with that C.I. No."
                          disabled={isLoadingLcOptions}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {selectedCommercialInvoiceDateDisplay && (
                     <FormItem>
                        <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />Commercial Invoice Date</FormLabel>
                        <Input value={selectedCommercialInvoiceDateDisplay} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" />
                    </FormItem>
                  )}
               </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <FormField
                  control={control}
                  name="documentaryCreditNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Documentary Credit No.</FormLabel>
                      <FormControl><Input placeholder="L/C Number" {...field} value={field.value ?? ""} readOnly={isLcSelected} className={cn(isLcSelected && "bg-muted/50 cursor-not-allowed")} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="totalMachineQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground" />Total L/C Machine Qty</FormLabel>
                      <FormControl><Input type="number" placeholder="Qty" {...field} value={field.value ?? ""} readOnly={isLcSelected} className={cn(isLcSelected && "bg-muted/50 cursor-not-allowed")} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="proformaInvoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Proforma Invoice Number</FormLabel>
                      <FormControl><Input placeholder="PI Number" {...field} value={field.value ?? ""} readOnly={isLcSelected} className={cn(isLcSelected && "bg-muted/50 cursor-not-allowed")} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={control}
                    name="invoiceDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />Invoice Date</FormLabel>
                        <DatePickerField field={{...field, value: field.value ?? undefined}} placeholder="Select Invoice Date" disabled={isLcSelected} />
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                <FormField
                    control={control}
                    name="etdDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />ETD Date</FormLabel>
                        <DatePickerField field={{...field, value: field.value ?? undefined}} placeholder="Select ETD Date" disabled={isLcSelected} />
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="etaDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />ETA Date</FormLabel>
                        <DatePickerField field={{...field, value: field.value ?? undefined}} placeholder="Select ETA Date" disabled={isLcSelected} />
                        <FormMessage />
                        </FormItem>
                    )}
                 />
              </div>
              <Separator className="my-2" />
              
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {isLcSelected && selectedLcDetails.lcIdForLink ? (
                    <div className="p-3 border rounded-md bg-muted/30">
                        <FormLabel className="text-sm font-medium text-muted-foreground mb-2 block">Shipment Status (from L/C)</FormLabel>
                        <div className="flex items-center gap-3">
                            {[
                                { flag: selectedLcDetails.isFirstShipment, label: "1st" },
                                { flag: selectedLcDetails.isSecondShipment, label: "2nd" },
                                { flag: selectedLcDetails.isThirdShipment, label: "3rd" }
                            ].map((shipment, index) => (
                                <Link key={index} href={`/dashboard/total-lc/${selectedLcDetails.lcIdForLink}/edit`} passHref legacyBehavior>
                                <Button
                                    asChild
                                    type="button"
                                    variant={shipment.flag ? "default" : "outline"}
                                    size="icon"
                                    className={cn(
                                    "h-8 w-8 rounded-full p-0 text-xs font-bold",
                                    shipment.flag
                                        ? "bg-green-500 hover:bg-green-600 text-white"
                                        : "border-destructive text-destructive hover:bg-destructive/10"
                                    )}
                                    title={`${shipment.label} Shipment Status`}
                                >
                                    <a>{shipment.label}</a>
                                </Button>
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : <div className="min-h-[76px]"></div> }

                <FormField
                  control={control}
                  name="packingListUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Packing List URL</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl className="flex-grow">
                          <Input type="url" placeholder="https://example.com/packing-list.pdf" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="default"
                          size="icon"
                          onClick={() => handleViewUrl(field.value)}
                          disabled={!field.value}
                          title="View Packing List"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Separator className="my-2" />

              {isLcSelected && selectedLcDetails.partialShipmentAllowed === "Yes" && (
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  value={activePartialShipmentAccordion}
                  onValueChange={setActivePartialShipmentAccordion}
                >
                  <AccordionItem value="partialShipmentDetails" className="border rounded-md shadow-sm bg-muted/20">
                    <AccordionTrigger
                      className={cn(
                        "flex w-full items-center justify-between px-4 py-3 text-foreground hover:no-underline",
                        sectionHeadingClass.replace('font-bold text-xl lg:text-2xl', 'text-md font-semibold').replace('border-b pb-2 mb-6', '')
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="mr-2 h-5 w-5 text-muted-foreground" />
                        Partial Shipment Breakdown (from L/C)
                      </div>
                      {activePartialShipmentAccordion === "partialShipmentDetails" ? (
                        <Minus className="h-5 w-5 text-primary" />
                      ) : (
                        <Plus className="h-5 w-5 text-primary" />
                      )}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pt-2 pb-4">
                      <div className="text-xs text-muted-foreground mb-3">(Read-only values from selected L/C)</div>
                      <div className="space-y-3">
                        {[
                            { labelPrefix: "1st", qty: selectedLcDetails.firstPartialQty, pkgs: selectedLcDetails.firstPartialPkgs, netW: selectedLcDetails.firstPartialNetWeight, grossW: selectedLcDetails.firstPartialGrossWeight, cbm: selectedLcDetails.firstPartialCbm },
                            { labelPrefix: "2nd", qty: selectedLcDetails.secondPartialQty, pkgs: selectedLcDetails.secondPartialPkgs, netW: selectedLcDetails.secondPartialNetWeight, grossW: selectedLcDetails.secondPartialGrossWeight, cbm: selectedLcDetails.secondPartialCbm },
                            { labelPrefix: "3rd", qty: selectedLcDetails.thirdPartialQty, pkgs: selectedLcDetails.thirdPartialPkgs, netW: selectedLcDetails.thirdPartialNetWeight, grossW: selectedLcDetails.thirdPartialGrossWeight, cbm: selectedLcDetails.thirdPartialCbm },
                        ].map((partial, index) => (
                            (partial.qty || 0) > 0 || (partial.pkgs || 0) > 0 || (partial.netW || 0) > 0 || (partial.grossW || 0) > 0 || (partial.cbm || 0) > 0 ? (
                                <React.Fragment key={index}>
                                {index > 0 && <Separator className="my-2" />}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2 items-start">
                                    {renderPartialDetailReadOnly(`${partial.labelPrefix} P. Qty`, partial.qty)}
                                    {/* Amount fields are hidden as per user request */}
                                    {/* {renderPartialDetailReadOnly(`${partial.labelPrefix} P. Amt`, partial.amount, selectedLcDetails.currency)} */}
                                    {renderPartialDetailReadOnly(`${partial.labelPrefix} P. Pkgs`, partial.pkgs)}
                                    {renderPartialDetailReadOnly(`${partial.labelPrefix} P. Net W. (KGS)`, partial.netW)}
                                    {renderPartialDetailReadOnly(`${partial.labelPrefix} P. Gross W. (KGS)`, partial.grossW)}
                                    {renderPartialDetailReadOnly(`${partial.labelPrefix} P. CBM`, partial.cbm)}
                                </div>
                                </React.Fragment>
                            ) : null
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              <Separator className="my-6" />
              <h3 className={cn(sectionHeadingClass)}>
                 <ClipboardList className="mr-2 h-5 w-5 text-primary" />
                 Installation Details
              </h3>

              <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">SL</TableHead>
                            <TableHead>Machine Model*</TableHead>
                            <TableHead>Serial No.*</TableHead>
                            <TableHead>Ctl. BOX Model</TableHead>
                            <TableHead>Ctl. Box Serial</TableHead>
                            <TableHead>Install Date*</TableHead>
                            <TableHead>Warranty Remaining</TableHead>
                            <TableHead className="w-[80px] text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {installationDetailsFields.map((field, index) => {
                            const installDateValue = watch(`installationDetails.${index}.installDate`);
                            let warrantyDisplay = "N/A";
                            if (installDateValue && isValid(installDateValue)) {
                                const expiryDate = addDays(installDateValue, 365);
                                const remainingDays = differenceInDays(new Date(), expiryDate); // Corrected calculation
                                warrantyDisplay = remainingDays < 0 ? `${Math.abs(remainingDays)} days remaining` : "Expired";
                            }
                            return (
                                <TableRow key={field.id}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <FormField
                                            control={control}
                                            name={`installationDetails.${index}.machineModel`}
                                            render={({ field: itemField }) => (
                                                <FormItem>
                                                    <FormControl><Input placeholder="Enter model" {...itemField} className="h-9" /></FormControl>
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={control}
                                            name={`installationDetails.${index}.serialNo`}
                                            render={({ field: itemField }) => (
                                                <FormItem>
                                                    <FormControl><Input placeholder="Enter serial no." {...itemField} className="h-9" /></FormControl>
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={control}
                                            name={`installationDetails.${index}.ctlBoxModel`}
                                            render={({ field: itemField }) => (
                                                <FormItem>
                                                    <FormControl><Input placeholder="Ctl. Box Model" {...itemField} className="h-9" /></FormControl>
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={control}
                                            name={`installationDetails.${index}.ctlBoxSerial`}
                                            render={({ field: itemField }) => (
                                                <FormItem>
                                                    <FormControl><Input placeholder="Ctl. Box Serial" {...itemField} className="h-9" /></FormControl>
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormField
                                            control={control}
                                            name={`installationDetails.${index}.installDate`}
                                            render={({ field: itemField }) => (
                                                <FormItem>
                                                    <DatePickerField field={itemField} placeholder="Select date" />
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{warrantyDisplay}</TableCell>
                                    <TableCell className="text-right">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeInstallationDetail(index)} disabled={installationDetailsFields.length <= 1} title="Remove Installation Item">
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
              </div>
              {formState.errors.installationDetails && !formState.errors.installationDetails.message && typeof formState.errors.installationDetails === 'object' && (formState.errors.installationDetails as any).root && (
                <p className="text-sm font-medium text-destructive">{(formState.errors.installationDetails as any).root?.message || "Please ensure all installation details are valid."}</p>
              )}
              <Button type="button" variant="outline" onClick={() => appendInstallationDetail({ slNo: (installationDetailsFields.length + 1).toString(), machineModel: '', serialNo: '', ctlBoxModel: '', ctlBoxSerial: '', installDate: undefined as any })} className="mt-2">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Installation Item
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <FormItem>
                    <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground" />Total Installed QTY:</FormLabel>
                    <Input type="text" value={installationDetailsFields.length} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" />
                </FormItem>
                 <FormItem>
                    <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground" />Pending QTY:</FormLabel>
                    <Input type="text" value={pendingQty} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" />
                </FormItem>
              </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <FormField
                    control={control} 
                    name="missingItemInfo"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Missing and Short Shipment Item Information</FormLabel>
                        <FormControl><Textarea placeholder="Describe any missing items..." rows={3} {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={control} 
                    name="extraFoundInfo"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Extra Found Information</FormLabel>
                        <FormControl><Textarea placeholder="Describe any extra items found..." rows={3} {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <Separator className="my-6" />

              <h3 className={cn(sectionHeadingClass)}>
                 <UserCheck className="mr-2 h-5 w-5 text-primary" />
                 Technician and Reporting Engineer Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={control}
                    name="technicianName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><Wrench className="mr-2 h-4 w-4 text-muted-foreground" />Technician Name*</FormLabel>
                        <FormControl><Input placeholder="Enter technician's name" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="reportingEngineerName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><Edit className="mr-2 h-4 w-4 text-muted-foreground" />Reporting Engineer Name*</FormLabel>
                        <FormControl><Input placeholder="Enter reporting engineer's name" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <FormField
                control={control} 
                name="installationNotes"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Installation Notes</FormLabel>
                    <FormControl><Textarea placeholder="Enter any notes regarding the installation" rows={4} {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                </FormItem>
                )}
              />

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingDropdowns || isLoadingLcOptions}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Report...
                  </>
                ) : (
                  <>
                    <Wrench className="mr-2 h-4 w-4" />
                    Submit Installation Report
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}


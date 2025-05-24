
"use client";

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid, addDays, differenceInDays } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import type { CustomerDocument, SupplierDocument, LCEntryDocument, InstallationDetailItem as PageInstallationDetailItemType, InstallationReportFormValues as PageInstallationReportFormValues, LcForInvoiceDropdownOption } from '@/types';
import { InstallationDetailItemSchema, InstallationReportSchema } from '@/types'; // Import schemas

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
import { Checkbox } from '@/components/ui/checkbox';


const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_APPLICANT_VALUE = "__INSTALL_REPORT_APPLICANT__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__INSTALL_REPORT_BENEFICIARY__";
const PLACEHOLDER_COMMERCIAL_INVOICE_VALUE = "__INSTALL_REPORT_COMM_INV__";


// Use the imported type
type InstallationReportFormValues = PageInstallationReportFormValues;
type InstallationDetailItemType = PageInstallationDetailItemType;


const formatDisplayDate = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const renderPartialDetailReadOnly = (label: string, value?: number | string | null, unit?: string) => {
  let displayValue = (typeof value === 'number' && !isNaN(value)) ? value.toString() : (String(value || "0"));
  if (value === null || value === undefined) displayValue = "0"; 
  return (
    <FormItem className="mb-2">
        <FormLabel className="text-xs text-muted-foreground">{label}</FormLabel>
        <Input type="text" value={`${displayValue} ${unit || ''}`.trim()} readOnly disabled className="h-8 text-xs bg-muted/50 cursor-not-allowed" />
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
    partialShipmentAllowed?: LCEntryDocument['partialShipmentAllowed'];
    firstPartialQty?: number; firstPartialPkgs?: number; firstPartialNetWeight?: number; firstPartialGrossWeight?: number; firstPartialCbm?: number;
    secondPartialQty?: number; secondPartialPkgs?: number; secondPartialNetWeight?: number; secondPartialGrossWeight?: number; secondPartialCbm?: number;
    thirdPartialQty?: number; thirdPartialPkgs?: number; thirdPartialNetWeight?: number; thirdPartialGrossWeight?: number; thirdPartialCbm?: number;
  }>({
    lcIdForLink: null,
    isFirstShipment: false, isSecondShipment: false, isThirdShipment: false,
    partialShipmentAllowed: "No",
    firstPartialQty: 0, firstPartialPkgs: 0, firstPartialNetWeight: 0, firstPartialGrossWeight: 0, firstPartialCbm: 0,
    secondPartialQty: 0, secondPartialPkgs: 0, secondPartialNetWeight: 0, secondPartialGrossWeight: 0, secondPartialCbm: 0,
    thirdPartialQty: 0, thirdPartialPkgs: 0, thirdPartialNetWeight: 0, thirdPartialGrossWeight: 0, thirdPartialCbm: 0,
  });

  const [activePartialShipmentAccordion, setActivePartialShipmentAccordion] = React.useState<string | undefined>(undefined);
  const [selectedCommercialInvoiceDateDisplay, setSelectedCommercialInvoiceDateDisplay] = React.useState<string | null>(null);
  const [pendingQty, setPendingQty] = React.useState<number | string>('N/A');


  const form = useForm<InstallationReportFormValues>({
    resolver: zodResolver(InstallationReportSchema),
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
      missingItemsIssueResolved: false,
      extraItemsIssueResolved: false,
    },
  });

  const { control, setValue, watch, reset, formState } = form;
  const watchedSelectedCommercialInvoiceLcId = watch("selectedCommercialInvoiceLcId");
  const watchedTotalLcMachineQty = watch("totalMachineQty");
  const watchedMissingItemsIssueResolved = watch("missingItemsIssueResolved");
  const watchedExtraItemsIssueResolved = watch("extraItemsIssueResolved");


  const installationDetailsFieldArray = useFieldArray({
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
              lcData: { ...data, id: doc.id } , // Ensure ID is included
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
            firstPartialQty: lc.firstPartialQty, firstPartialPkgs: lc.firstPartialPkgs, firstPartialNetWeight: lc.firstPartialNetWeight, firstPartialGrossWeight: lc.firstPartialGrossWeight, firstPartialCbm: lc.firstPartialCbm,
            secondPartialQty: lc.secondPartialQty, secondPartialPkgs: lc.secondPartialPkgs, secondPartialNetWeight: lc.secondPartialNetWeight, secondPartialGrossWeight: lc.secondPartialGrossWeight, secondPartialCbm: lc.secondPartialCbm,
            thirdPartialQty: lc.thirdPartialQty, thirdPartialPkgs: lc.thirdPartialPkgs, thirdPartialNetWeight: lc.thirdPartialNetWeight, thirdPartialGrossWeight: lc.thirdPartialGrossWeight, thirdPartialCbm: lc.thirdPartialCbm,
        });
        setSelectedCommercialInvoiceDateDisplay(lc.commercialInvoiceDate ? formatDisplayDate(lc.commercialInvoiceDate) : null);
      }
    } else if (!watchedSelectedCommercialInvoiceLcId) {
      // Optionally reset fields if Commercial Invoice is deselected
      // For now, we'll leave them as they are unless explicitly cleared by user or new selection
    }
  }, [watchedSelectedCommercialInvoiceLcId, lcOptionsForCommercialInvoice, setValue]);

  React.useEffect(() => {
    const totalLcQty = Number(watchedTotalLcMachineQty || 0);
    const installedQty = installationDetailsFieldArray.fields.length;
    if (watchedTotalLcMachineQty !== undefined) {
      setPendingQty(totalLcQty - installedQty);
    } else {
      setPendingQty('N/A');
    }
  }, [watchedTotalLcMachineQty, installationDetailsFieldArray.fields.length]);


  async function onSubmit(data: InstallationReportFormValues) {
    setIsSubmitting(true);
    const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);
    const selectedLcOption = lcOptionsForCommercialInvoice.find(opt => opt.value === data.selectedCommercialInvoiceLcId);

    const dataToSave = {
      applicantId: data.applicantId,
      applicantName: selectedApplicant?.label || 'N/A',
      beneficiaryId: data.beneficiaryId,
      beneficiaryName: selectedBeneficiary?.label || 'N/A',
      selectedCommercialInvoiceLcId: data.selectedCommercialInvoiceLcId || undefined,
      commercialInvoiceNumber: selectedLcOption?.label || undefined, // Store the C.I. number for display
      documentaryCreditNumber: data.documentaryCreditNumber || undefined,
      totalMachineQtyFromLC: data.totalMachineQty || undefined,
      proformaInvoiceNumber: data.proformaInvoiceNumber || undefined,
      invoiceDate: data.invoiceDate ? format(data.invoiceDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      etdDate: data.etdDate ? format(data.etdDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      etaDate: data.etaDate ? format(data.etaDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      packingListUrl: data.packingListUrl || undefined,
      technicianName: data.technicianName,
      reportingEngineerName: data.reportingEngineerName,
      installationDetails: data.installationDetails.map(item => ({
        ...item,
        slNo: item.slNo || undefined,
        installDate: item.installDate ? format(item.installDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
        // warrantyRemaining is calculated on display, not stored
      })),
      totalInstalledQty: installationDetailsFieldArray.fields.length,
      pendingQty: pendingQty,
      missingItemInfo: data.missingItemInfo || undefined,
      extraFoundInfo: data.extraFoundInfo || undefined,
      missingItemsIssueResolved: data.missingItemsIssueResolved ?? false,
      extraItemsIssueResolved: data.extraItemsIssueResolved ?? false,
      installationNotes: data.installationNotes || undefined,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Clean undefined fields
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key as keyof typeof dataToSave] === undefined) {
        delete dataToSave[key as keyof typeof dataToSave];
      }
    });
    
    console.log("Installation Report Data to be saved to Firestore:", dataToSave);

    try {
      // Firestore security rules for 'installation_reports' collection:
      // match /installation_reports/{reportId} {
      //   allow read, write: if request.auth != null;
      // }
      const docRef = await addDoc(collection(firestore, "installation_reports"), dataToSave);
      Swal.fire({
        title: "Installation Report Saved!",
        text: `Report successfully saved to Firestore with ID: ${docRef.id}`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
      form.reset({ // Reset to default values, not clearing everything
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
        missingItemsIssueResolved: false,
        extraItemsIssueResolved: false,
      });
      setSelectedCommercialInvoiceDateDisplay(null);
      setSelectedLcDetails({ lcIdForLink: null, isFirstShipment: false, isSecondShipment: false, isThirdShipment: false, partialShipmentAllowed: "No" });
      setActivePartialShipmentAccordion(undefined);

    } catch (error: any) {
      console.error("Error saving installation report: ", error);
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save installation report: ${error.message}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
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
      <Card className="max-w-6xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2 text-primary", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
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
                      <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Documentary Credit No.*</FormLabel>
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
                      <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground" />Total L/C Machine Qty*</FormLabel>
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
                  {selectedLcDetails.lcIdForLink ? (
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

              {isLcSelected && selectedLcDetails.partialShipmentAllowed === "Yes" && (
                 <Accordion
                    type="single"
                    collapsible
                    className="w-full mt-2"
                    value={activePartialShipmentAccordion}
                    onValueChange={setActivePartialShipmentAccordion}
                >
                    <AccordionItem value="partialShipmentDetailsAccordionInstallReport" className="border rounded-md shadow-sm bg-muted/20">
                        <AccordionTrigger
                        className={cn(
                            "flex w-full items-center justify-between px-4 py-3 text-foreground hover:no-underline",
                             "text-md font-semibold"
                        )}
                        >
                        <div className="flex items-center gap-2">
                            <Package className="mr-2 h-5 w-5 text-muted-foreground" />
                            Partial Shipment Breakdown (from L/C)
                        </div>
                        {activePartialShipmentAccordion === "partialShipmentDetailsAccordionInstallReport" ? (
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
                                        {renderPartialDetailReadOnly(`${partial.labelPrefix} P. Pkgs`, partial.pkgs)}
                                        {renderPartialDetailReadOnly(`${partial.labelPrefix} P. Net W.`, partial.netW, "KGS")}
                                        {renderPartialDetailReadOnly(`${partial.labelPrefix} P. Gross W.`, partial.grossW, "KGS")}
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
                              <TableHead className="w-[50px] text-foreground">SL</TableHead>
                              <TableHead className="text-foreground">Machine Model*</TableHead>
                              <TableHead className="text-foreground">Machine Serial No.*</TableHead>
                              <TableHead className="text-foreground">Ctl. Box Model*</TableHead>
                              <TableHead className="text-foreground">Ctl. Box Serial*</TableHead>
                              <TableHead className="text-foreground">Install Date*</TableHead>
                              <TableHead className="text-foreground w-[50px]">Warranty</TableHead>
                              <TableHead className="w-[80px] text-right text-foreground">Action</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {installationDetailsFieldArray.fields.map((field, index) => {
                              const installDateValue = watch(`installationDetails.${index}.installDate`);
                              let warrantyDisplay = "N/A";
                              if (installDateValue && isValid(installDateValue)) {
                                  const expiryDate = addDays(installDateValue, 365);
                                  const remainingDays = differenceInDays(expiryDate, new Date());
                                  warrantyDisplay = remainingDays >= 0 ? `${remainingDays} days remaining` : "Expired";
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
                                                      <FormControl><Input placeholder="Ctl. Box Model" {...itemField} value={itemField.value ?? ''} className="h-9" /></FormControl>
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
                                                      <FormControl><Input placeholder="Ctl. Box Serial" {...itemField} value={itemField.value ?? ''} className="h-9" /></FormControl>
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
                                                      <DatePickerField field={{...itemField, value: itemField.value ?? undefined }} placeholder="Select date" />
                                                      <FormMessage className="text-xs" />
                                                  </FormItem>
                                              )}
                                          />
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground w-[50px]">{warrantyDisplay}</TableCell>
                                      <TableCell className="text-right">
                                          <Button type="button" variant="ghost" size="icon" onClick={() => installationDetailsFieldArray.remove(index)} disabled={installationDetailsFieldArray.fields.length <= 1} title="Remove Installation Item">
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
             <Button type="button" variant="outline" onClick={() => installationDetailsFieldArray.append({ slNo: (installationDetailsFieldArray.fields.length + 1).toString(), machineModel: '', serialNo: '', ctlBoxModel: '', ctlBoxSerial: '', installDate: undefined as any })} className="mt-2">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Installation Item
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <FormItem>
                  <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground" />Total Installed QTY:</FormLabel>
                  <Input type="text" value={installationDetailsFieldArray.fields.length} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" />
              </FormItem>
               <FormItem>
                  <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground" />Pending QTY:</FormLabel>
                  <Input type="text" value={pendingQty} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" />
              </FormItem>
            </div>

            <Separator className="my-6" />

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <FormItem>
                    <FormField
                        control={control}
                        name="missingItemInfo"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Missing And Short Shipment Item Information</FormLabel>
                                <FormControl><Textarea placeholder="Describe any missing items..." rows={3} {...field} value={field.value ?? ""} disabled={!!watchedMissingItemsIssueResolved} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="missingItemsIssueResolved"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm mt-2 bg-card">
                            <FormControl>
                                <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="hover:cursor-pointer">
                                Issues Resolved for Missing/Short Items
                                </FormLabel>
                            </div>
                            </FormItem>
                        )}
                     />
                </FormItem>
                <FormItem>
                    <FormField
                        control={control}
                        name="extraFoundInfo"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Extra Found and Return Information</FormLabel>
                                <FormControl><Textarea placeholder="Describe any extra items found..." rows={3} {...field} value={field.value ?? ""} disabled={!!watchedExtraItemsIssueResolved} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="extraItemsIssueResolved"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm mt-2 bg-card">
                            <FormControl>
                                <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="hover:cursor-pointer">
                                Issues Resolved for Extra/Found Items
                                </FormLabel>
                            </div>
                            </FormItem>
                        )}
                    />
                </FormItem>
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
              <Separator className="my-6" />
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

    
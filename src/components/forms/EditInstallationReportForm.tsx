
"use client";

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid, addDays, differenceInDays, parse as parseDateFns } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type {
  CustomerDocument,
  InstallationReportFormValues as PageInstallationReportFormValues,
  InstallationReportDocument,
  LcForInvoiceDropdownOption,
  InstallationDetailItem as PageInstallationDetailItemType
} from '@/types';
import { InstallationDetailItemSchema, InstallationReportSchema } from '@/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Loader2, Wrench, Users, Building, FileText, CalendarDays, Hash, Link as LinkIcon, ExternalLink, Package, Plus, Minus, UserCheck, Edit, ClipboardList, PlusCircle, Trash2, ShieldAlert, AlertCircle, Copy, Download, Upload, RefreshCw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor } from '../ui/RichTextEditor';
import Link from 'next/link';

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_APPLICANT_VALUE = "__EDIT_INSTALL_REPORT_APPLICANT__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__EDIT_INSTALL_REPORT_BENEFICIARY__";
const PLACEHOLDER_COMMERCIAL_INVOICE_VALUE = "__EDIT_INSTALL_REPORT_COMM_INV__";

type InstallationReportFormValues = PageInstallationReportFormValues;
type InstallationDetailItemType = PageInstallationDetailItemType;


const formatDisplayDate = (dateString?: string | Date | null): string => {
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

const escapeCsvCell = (cellData: any): string => {
  if (cellData === null || cellData === undefined) {
    return '';
  }
  const stringData = String(cellData);
  if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
    return `"${stringData.replace(/"/g, '""')}"`;
  }
  return stringData;
};

interface EditInstallationReportFormProps {
  initialData: InstallationReportDocument;
  reportId: string;
}

export function EditInstallationReportForm({ initialData, reportId }: EditInstallationReportFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [lcOptionsForCommercialInvoice, setLcOptionsForCommercialInvoice] = React.useState<LcForInvoiceDropdownOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedLcDetails, setSelectedLcDetails] = React.useState<any>({ lcIdForLink: null });
  const [activePartialShipmentAccordion, setActivePartialShipmentAccordion] = React.useState<string | undefined>(undefined);
  const [selectedCommercialInvoiceDateDisplay, setSelectedCommercialInvoiceDateDisplay] = React.useState<string | null>(null);
  
  const [pendingQty, setPendingQty] = React.useState<number | string>('N/A');
  const [warrantyExpiredCount, setWarrantyExpiredCount] = React.useState(0);
  const [warrantyRemainingCount, setWarrantyRemainingCount] = React.useState(0);

  const form = useForm<InstallationReportFormValues>({
    resolver: zodResolver(InstallationReportSchema),
    defaultValues: { ...initialData,
      commercialInvoiceDate: initialData.commercialInvoiceDate ? parseISO(initialData.commercialInvoiceDate) : undefined,
      invoiceDate: initialData.invoiceDate ? parseISO(initialData.invoiceDate) : undefined,
      etdDate: initialData.etdDate ? parseISO(initialData.etdDate) : undefined,
      etaDate: initialData.etaDate ? parseISO(initialData.etaDate) : undefined,
      installationDetails: initialData.installationDetails?.map(d => ({...d, installDate: d.installDate ? parseISO(d.installDate) : new Date() }))
    },
  });

  const { control, setValue, watch, getValues, reset } = form;
  const watchedSelectedCommercialInvoiceLcId = watch("selectedCommercialInvoiceLcId");
  const watchedTotalLcMachineQty = watch("totalMachineQtyFromLC");
  const watchedInstallationDetails = watch("installationDetails");
  const watchedMissingItemsIssueResolved = watch("missingItemsIssueResolved");
  const watchedExtraItemsIssueResolved = watch("extraItemsIssueResolved");


  const installationDetailsFieldArray = useFieldArray({
    control,
    name: "installationDetails",
  });

  const fetchOptions = React.useCallback(async () => {
    setIsLoadingDropdowns(true);
    try {
      const [customersSnap, suppliersSnap, lcsSnap, existingReportsSnap] = await Promise.all([
        getDocs(collection(firestore, "customers")),
        getDocs(collection(firestore, "suppliers")),
        getDocs(query(collection(firestore, "lc_entries"), where("commercialInvoiceNumber", "!=", ""))),
        getDocs(collection(firestore, "installation_reports"))
      ]);

      setApplicantOptions(
        customersSnap.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
      );
      setBeneficiaryOptions(
        suppliersSnap.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as CustomerDocument).applicantName || 'Unnamed Beneficiary' }))
      );
      
      const usedLcIdsForReports = new Set(
        existingReportsSnap.docs
          .map(doc => (doc.data() as InstallationReportDocument).selectedCommercialInvoiceLcId)
          .filter(Boolean)
      );

      const fetchedLcOptions: LcForInvoiceDropdownOption[] = [];
      lcsSnap.forEach(docSnap => {
        // Allow the current report's L/C to be in the list, but filter out others that are already used.
        if (!usedLcIdsForReports.has(docSnap.id) || docSnap.id === initialData.selectedCommercialInvoiceLcId) {
          const data = docSnap.data() as LCEntryDocument;
          if (data.commercialInvoiceNumber) { 
            fetchedLcOptions.push({
              value: docSnap.id, // L/C document ID
              label: data.commercialInvoiceNumber, // Commercial Invoice Number for display
              lcData: { ...data, id: docSnap.id } , // Store the full L/C data
            });
          }
        }
      });
      setLcOptionsForCommercialInvoice(fetchedLcOptions);

    } catch (error) {
      Swal.fire("Error", "Could not load supporting data.", "error");
    } finally {
      setIsLoadingDropdowns(false);
    }
  }, [initialData.selectedCommercialInvoiceLcId]);

  React.useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);
  
  React.useEffect(() => {
    if (watchedSelectedCommercialInvoiceLcId && lcOptionsForCommercialInvoice.length > 0) {
      const selectedOption = lcOptionsForCommercialInvoice.find(opt => opt.value === watchedSelectedCommercialInvoiceLcId);
      if (selectedOption) {
        const lc = selectedOption.lcData;
        setValue("applicantId", lc.applicantId || '', { shouldValidate: true });
        setValue("beneficiaryId", lc.beneficiaryId || '', { shouldValidate: true });
        setValue("documentaryCreditNumber", lc.documentaryCreditNumber || '', { shouldValidate: true });
        setValue("totalMachineQtyFromLC", lc.totalMachineQty || undefined, { shouldValidate: true });
        setValue("proformaInvoiceNumber", lc.proformaInvoiceNumber || '', { shouldValidate: true });
        setValue("invoiceDate", lc.invoiceDate && isValid(parseISO(lc.invoiceDate)) ? parseISO(lc.invoiceDate) : undefined, { shouldValidate: true });
        setValue("commercialInvoiceDate", lc.commercialInvoiceDate && isValid(parseISO(lc.commercialInvoiceDate)) ? parseISO(lc.commercialInvoiceDate) : undefined, { shouldValidate: true });
        setValue("etdDate", lc.etd && isValid(parseISO(lc.etd)) ? parseISO(lc.etd) : undefined, { shouldValidate: true });
        setValue("etaDate", lc.eta && isValid(parseISO(lc.eta)) ? parseISO(lc.eta) : undefined, { shouldValidate: true });
        setValue("packingListUrl", lc.packingListUrl || '', { shouldValidate: true });
        setSelectedLcDetails(lc);
        setSelectedCommercialInvoiceDateDisplay(lc.commercialInvoiceDate ? formatDisplayDate(lc.commercialInvoiceDate) : null);
        setActivePartialShipmentAccordion(lc.partialShipmentAllowed === "Yes" ? "partialShipmentDetailsAccordionInstallReport" : undefined);
      }
    }
  }, [watchedSelectedCommercialInvoiceLcId, lcOptionsForCommercialInvoice, setValue]);


  React.useEffect(() => {
    const totalLcQtyValue = Number(watchedTotalLcMachineQty || 0);
    const installedQtyValue = installationDetailsFieldArray.fields.length;
    setPendingQty(watchedTotalLcMachineQty !== undefined ? totalLcQtyValue - installedQtyValue : 'N/A');

    if (Array.isArray(watchedInstallationDetails)) {
      let expired = 0;
      let remaining = 0;
      const today = new Date();
      watchedInstallationDetails.forEach(item => {
        if (item.installDate && isValid(new Date(item.installDate))) {
          const expiryDate = addDays(new Date(item.installDate), 365);
          if (differenceInDays(expiryDate, today) < 0) {
            expired++;
          } else {
            remaining++;
          }
        }
      });
      setWarrantyExpiredCount(expired);
      setWarrantyRemainingCount(remaining);
    }
  }, [watchedTotalLcMachineQty, watchedInstallationDetails, installationDetailsFieldArray.fields.length]);

  async function onSubmit(data: InstallationReportFormValues) {
    setIsSubmitting(true);
    
    // Create a mutable copy of the data object
    const dataToUpdate: Record<string, any> = { ...data };

    // Format dates to ISO strings, handling potential undefined values
    dataToUpdate.commercialInvoiceDate = data.commercialInvoiceDate ? format(data.commercialInvoiceDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null;
    dataToUpdate.invoiceDate = data.invoiceDate ? format(data.invoiceDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null;
    dataToUpdate.etdDate = data.etdDate ? format(data.etdDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null;
    dataToUpdate.etaDate = data.etaDate ? format(data.etaDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null;
    dataToUpdate.installationDetails = data.installationDetails.map(item => ({
        ...item,
        installDate: item.installDate ? format(item.installDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null,
    }));
    
    // Add calculated and timestamp fields
    dataToUpdate.totalInstalledQty = data.installationDetails.length;
    dataToUpdate.pendingQty = typeof pendingQty === 'number' ? pendingQty : null;
    dataToUpdate.updatedAt = serverTimestamp();

    // Iterate over the object and delete any keys with an undefined value.
    // This is the most reliable way to prevent Firestore errors.
    Object.keys(dataToUpdate).forEach(key => {
        if (dataToUpdate[key] === undefined) {
            delete dataToUpdate[key];
        } else if (dataToUpdate[key] === '') {
             dataToUpdate[key] = null; // Convert empty strings to null for consistency
        }
    });

    try {
      const reportDocRef = doc(firestore, "installation_reports", reportId);
      await updateDoc(reportDocRef, dataToUpdate);
      Swal.fire({
        title: "Installation Report Updated!",
        text: `Report ID: ${reportId} successfully updated.`,
        icon: "success",
      });
    } catch (error: any) {
      console.error("Error updating installation report: ", error);
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update report: ${error.message}`,
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

  const handleDuplicateLastRow = () => {
    const installationDetails = getValues("installationDetails");
    if (installationDetails && installationDetails.length > 0) {
      const lastRow = installationDetails[installationDetails.length - 1];
      installationDetailsFieldArray.append({
        ...lastRow,
        installDate: lastRow.installDate ? new Date(lastRow.installDate) : new Date(),
        slNo: (installationDetailsFieldArray.fields.length + 1).toString(),
      });
    } else {
      Swal.fire("Info", "No rows to duplicate.", "info");
    }
  };
  
  const handleExportToCsv = () => {
    const formData = getValues();
    if (!formData.installationDetails || formData.installationDetails.length === 0) {
      Swal.fire("No Data", "No installation details to export.", "info");
      return;
    }

    const headers = ["SL No.", "Machine Model", "Machine Serial No.", "Ctl. Box Model", "Ctl. Box Serial", "Install Date", "Warranty"];
    const applicantNameFromState = applicantOptions.find(opt => opt.value === formData.applicantId)?.label || formData.applicantId || "N/A";
    const beneficiaryNameFromState = beneficiaryOptions.find(opt => opt.value === formData.beneficiaryId)?.label || formData.beneficiaryId || "N/A";
    const commercialInvoiceNumberFromState = lcOptionsForCommercialInvoice.find(opt => opt.value === formData.selectedCommercialInvoiceLcId)?.label || "N/A";

    const reportHeaderInfo = [
      ["Applicant Name:", applicantNameFromState],
      ["Beneficiary Name:", beneficiaryNameFromState],
      ["L/C No.:", formData.documentaryCreditNumber || "N/A"],
      ["C.I. No.:", commercialInvoiceNumberFromState],
      ["C.I. Date:", selectedCommercialInvoiceDateDisplay || "N/A"],
      ["Total L/C QTY:", formData.totalMachineQtyFromLC || "N/A"],
      ["Total Installed QTY:", installationDetailsFieldArray.fields.length],
      ["Pending QTY:", pendingQty],
      ["Technician Name:", formData.technicianName],
      ["Reporting Engineer Name:", formData.reportingEngineerName]
    ];

    let csvContent = reportHeaderInfo.map(row => row.map(escapeCsvCell).join(",")).join("\n");
    csvContent += "\n\n" + headers.map(escapeCsvCell).join(",") + "\n";

    formData.installationDetails.forEach((item, index) => {
      let warrantyDisplay = "N/A";
      if (item.installDate && isValid(new Date(item.installDate))) {
        const expiryDate = addDays(new Date(item.installDate), 365);
        const diffDays = differenceInDays(expiryDate, new Date());
        warrantyDisplay = diffDays < 0 ? "Expired" : `${diffDays} days`;
      }
      const row = [item.slNo || (index + 1).toString(), item.machineModel, item.serialNo, item.ctlBoxModel, item.ctlBoxSerial, item.installDate ? formatDisplayDate(new Date(item.installDate)) : "N/A", warrantyDisplay];
      csvContent += row.map(escapeCsvCell).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const ciNumberForFilename = commercialInvoiceNumberFromState !== "N/A" ? commercialInvoiceNumberFromState : "report";
      link.setAttribute("download", `installation_report_${ciNumberForFilename.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "text/csv") {
      Swal.fire("Invalid File Type", "Please upload a .csv file.", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) { Swal.fire("Error Reading File", "Could not read file content.", "error"); return; }
      try {
        const rows = text.split(/\r\n|\n/).filter(row => row.trim() !== '');
        if (rows.length <= 1) { Swal.fire("Empty or Header-Only CSV", "The CSV file is empty or contains only a header row.", "info"); return; }

        const dataRows = rows.slice(1);
        const newInstallationDetailsFromCsv: InstallationDetailItemType[] = dataRows.map((row, csvRowIndex) => {
          const columns = row.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
          const [machineModel, serialNo, ctlBoxModel, ctlBoxSerial, installDateStr] = columns;
          let installDate: Date | undefined = undefined;
          if (installDateStr) {
            let parsedDate = parseISO(installDateStr);
            if (!isValid(parsedDate)) parsedDate = new Date(installDateStr);
            if (isValid(parsedDate)) installDate = parsedDate;
          }
          const existingRowsCount = installationDetailsFieldArray.fields.length;
          return {
            slNo: (existingRowsCount + csvRowIndex + 1).toString(),
            machineModel: machineModel || '', serialNo: serialNo || '', ctlBoxModel: ctlBoxModel || undefined, ctlBoxSerial: ctlBoxSerial || undefined,
            installDate: installDate || new Date(),
          };
        });

        if (newInstallationDetailsFromCsv.length > 0) {
          installationDetailsFieldArray.append(newInstallationDetailsFromCsv);
          Swal.fire("Import Complete", `${newInstallationDetailsFromCsv.length} rows appended successfully.`, "success");
        } else {
          Swal.fire("No Data Imported", "No valid data rows found in the CSV after the header.", "info");
        }
      } catch (parseError) {
        Swal.fire("CSV Parse Error", "Could not parse the CSV file. Please ensure it's correctly formatted.", "error");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => { Swal.fire("File Read Error", "Error reading the selected file.", "error"); if (fileInputRef.current) fileInputRef.current.value = ""; };
    reader.readAsText(file);
  };
  
  const isLcSelected = !!watchedSelectedCommercialInvoiceLcId;

  if (isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading form options...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <h3 className={cn(sectionHeadingClass)}><FileText className="mr-2 h-5 w-5 text-primary" />L/C & Invoice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={control} name="applicantId" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Applicant Name*</FormLabel><Combobox options={applicantOptions} value={field.value || PLACEHOLDER_APPLICANT_VALUE} onValueChange={(value) => field.onChange(value === PLACEHOLDER_APPLICANT_VALUE ? '' : value)} placeholder="Search Applicant..." selectPlaceholder={isLoadingDropdowns ? "Loading Applicants..." : "Select Applicant"} emptyStateMessage="No applicant found." disabled={isLoadingDropdowns || isLcSelected} /><FormMessage /></FormItem>)} />
                <FormField control={control} name="beneficiaryId" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Beneficiary Name*</FormLabel><Combobox options={beneficiaryOptions} value={field.value || PLACEHOLDER_BENEFICIARY_VALUE} onValueChange={(value) => field.onChange(value === PLACEHOLDER_BENEFICIARY_VALUE ? '' : value)} placeholder="Search Beneficiary..." selectPlaceholder={isLoadingDropdowns ? "Loading Beneficiaries..." : "Select Beneficiary"} emptyStateMessage="No beneficiary found." disabled={isLoadingDropdowns || isLcSelected} /><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <FormField control={control} name="selectedCommercialInvoiceLcId" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Commercial Invoice Number</FormLabel><div className="flex items-center gap-2"><Combobox options={lcOptionsForCommercialInvoice} value={field.value || PLACEHOLDER_COMMERCIAL_INVOICE_VALUE} onValueChange={(value) => field.onChange(value === PLACEHOLDER_COMMERCIAL_INVOICE_VALUE ? undefined : value)} placeholder="Search by C.I. No..." selectPlaceholder={isLoadingDropdowns ? "Loading C.I. Numbers..." : "Select C.I. Number"} emptyStateMessage="No available C.I. Number found." disabled={isLoadingDropdowns} /><Button type="button" size="icon" variant="outline" onClick={fetchOptions} title="Refresh C.I. List"><RefreshCw className="h-4 w-4" /></Button></div><FormDescription>Select a C.I. to auto-fill details. C.I.s already used in a report will not appear.</FormDescription><FormMessage /></FormItem>)} />
                {selectedCommercialInvoiceDateDisplay && (<FormItem><FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />Commercial Invoice Date</FormLabel><Input value={selectedCommercialInvoiceDateDisplay} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" /></FormItem>)}
            </div>
            {/* Rest of the form remains the same as NewInstallationReportForm */}
            {/* ... form content ... */}
            <Separator className="my-6" />
            <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingDropdowns}>
                {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Changes...</>) : (<><Save className="mr-2 h-4 w-4" />Save Changes</>)}
            </Button>
      </form>
    </Form>
  )
}

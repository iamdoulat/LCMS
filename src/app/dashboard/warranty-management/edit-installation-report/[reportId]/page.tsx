
"use client";

import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid, addDays, differenceInDays, parse as parseDateFns } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type {
  CustomerDocument,
  SupplierDocument,
  LCEntryDocument,
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
import { Loader2, Wrench, Users, Building, FileText, CalendarDays, Hash, Link as LinkIcon, ExternalLink, Package, Plus, Minus, UserCheck, Edit, ClipboardList, PlusCircle, Trash2, AlertTriangle, ArrowLeft, Save, ShieldAlert, ShieldCheck, AlertCircle, Copy, Download, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useParams, useRouter } from 'next/navigation';

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


export default function EditInstallationReportPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.reportId as string;

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingReportData, setIsLoadingReportData] = React.useState(true);
  const [reportDataError, setReportDataError] = React.useState<string | null>(null);

  const [applicantOptions, setApplicantOptions] = React.useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [lcOptionsForCommercialInvoice, setLcOptionsForCommercialInvoice] = React.useState<LcForInvoiceDropdownOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedLcDetails, setSelectedLcDetails] = React.useState<{
    isFirstShipment?: boolean;
    isSecondShipment?: boolean;
    isThirdShipment?: boolean;
    lcIdForLink: string | null;
    partialShipmentAllowed?: LCEntryDocument['partialShipmentAllowed'];
    firstPartialQty?: number; firstPartialPkgs?: number; firstPartialNetWeight?: number; firstPartialGrossWeight?: number; firstPartialCbm?: number;
    secondPartialQty?: number; secondPartialPkgs?: number; secondPartialNetWeight?: number; secondPartialGrossWeight?: number; secondPartialCbm?: number;
    thirdPartialQty?: number; thirdPartialPkgs?: number; thirdPartialNetWeight?: number; thirdPartialGrossWeight?: number; thirdPartialCbm?: number;
    packingListUrl?: string;
  }>({
    lcIdForLink: null,
    isFirstShipment: false, isSecondShipment: false, isThirdShipment: false,
    partialShipmentAllowed: "No",
    packingListUrl: '',
  });

  const [activePartialShipmentAccordion, setActivePartialShipmentAccordion] = React.useState<string | undefined>(undefined);
  const [selectedCommercialInvoiceDateDisplay, setSelectedCommercialInvoiceDateDisplay] = React.useState<string | null>(null);
  
  const [pendingQty, setPendingQty] = React.useState<number | string>('N/A');
  const [warrantyExpiredCount, setWarrantyExpiredCount] = React.useState(0);
  const [warrantyRemainingCount, setWarrantyRemainingCount] = React.useState(0);

  const form = useForm<InstallationReportFormValues>({
    resolver: zodResolver(InstallationReportSchema),
    defaultValues: {
      applicantId: '',
      beneficiaryId: '',
      selectedCommercialInvoiceLcId: undefined,
      documentaryCreditNumber: '',
      totalMachineQtyFromLC: undefined,
      proformaInvoiceNumber: '',
      invoiceDate: undefined,
      commercialInvoiceDate: undefined,
      etdDate: undefined,
      etaDate: undefined,
      packingListUrl: '',
      technicianName: '',
      reportingEngineerName: '',
      installationDetails: [{ slNo: '1', machineModel: '', serialNo: '', ctlBoxModel: '', ctlBoxSerial: '', installDate: undefined as any }],
      missingItemInfo: '',
      extraFoundInfo: '',
      missingItemsIssueResolved: false,
      extraItemsIssueResolved: false,
      installationNotes: '',
    },
  });

  const { control, setValue, watch, reset, formState, getValues } = form;
  const watchedSelectedCommercialInvoiceLcId = watch("selectedCommercialInvoiceLcId");
  const watchedTotalLcMachineQty = watch("totalMachineQtyFromLC");
  const watchedInstallationDetails = watch("installationDetails");
  const watchedMissingItemsIssueResolved = watch("missingItemsIssueResolved");
  const watchedExtraItemsIssueResolved = watch("extraItemsIssueResolved");


  const installationDetailsFieldArray = useFieldArray({
    control,
    name: "installationDetails",
  });

  React.useEffect(() => {
    const fetchInitialReportData = async () => {
      if (!reportId) {
        setReportDataError("No Report ID provided.");
        setIsLoadingReportData(false);
        return;
      }
      setIsLoadingReportData(true);
      try {
        const reportDocRef = doc(firestore, "installation_reports", reportId);
        const reportDocSnap = await getDoc(reportDocRef);

        if (reportDocSnap.exists()) {
          const initialData = reportDocSnap.data() as InstallationReportDocument;
          const formValuesToSet: InstallationReportFormValues = {
            applicantId: initialData.applicantId || '',
            beneficiaryId: initialData.beneficiaryId || '',
            selectedCommercialInvoiceLcId: initialData.selectedCommercialInvoiceLcId || undefined,
            documentaryCreditNumber: initialData.documentaryCreditNumber || '',
            totalMachineQtyFromLC: initialData.totalMachineQtyFromLC || undefined,
            proformaInvoiceNumber: initialData.proformaInvoiceNumber || '',
            invoiceDate: initialData.invoiceDate && isValid(parseISO(initialData.invoiceDate)) ? parseISO(initialData.invoiceDate) : undefined,
            commercialInvoiceDate: initialData.commercialInvoiceDate && isValid(parseISO(initialData.commercialInvoiceDate)) ? parseISO(initialData.commercialInvoiceDate) : undefined,
            etdDate: initialData.etdDate && isValid(parseISO(initialData.etdDate)) ? parseISO(initialData.etdDate) : undefined,
            etaDate: initialData.etaDate && isValid(parseISO(initialData.etaDate)) ? parseISO(initialData.etaDate) : undefined,
            packingListUrl: initialData.packingListUrl || '',
            technicianName: initialData.technicianName || '',
            reportingEngineerName: initialData.reportingEngineerName || '',
            installationDetails: initialData.installationDetails?.map((item, index) => ({
              slNo: item.slNo || (index + 1).toString(),
              machineModel: item.machineModel || '',
              serialNo: item.serialNo || '',
              ctlBoxModel: item.ctlBoxModel || '',
              ctlBoxSerial: item.ctlBoxSerial || '',
              installDate: item.installDate && isValid(parseISO(item.installDate)) ? parseISO(item.installDate) : undefined as any,
            })) || [{ slNo: '1', machineModel: '', serialNo: '', ctlBoxModel: '', ctlBoxSerial: '', installDate: undefined as any }],
            missingItemInfo: initialData.missingItemInfo || '',
            extraFoundInfo: initialData.extraFoundInfo || '',
            missingItemsIssueResolved: initialData.missingItemsIssueResolved ?? false,
            extraItemsIssueResolved: initialData.extraItemsIssueResolved ?? false,
            installationNotes: initialData.installationNotes || '',
          };
          reset(formValuesToSet);

          if (initialData.selectedCommercialInvoiceLcId && lcOptionsForCommercialInvoice.length > 0) { 
             const selectedLcOption = lcOptionsForCommercialInvoice.find(opt => opt.value === initialData.selectedCommercialInvoiceLcId);
             if (selectedLcOption) {
                const lc = selectedLcOption.lcData;
                setSelectedLcDetails({
                    isFirstShipment: lc.isFirstShipment,
                    isSecondShipment: lc.isSecondShipment,
                    isThirdShipment: lc.isThirdShipment,
                    lcIdForLink: lc.id,
                    partialShipmentAllowed: lc.partialShipmentAllowed,
                    firstPartialQty: lc.firstPartialQty, firstPartialPkgs: lc.firstPartialPkgs, firstPartialNetWeight: lc.firstPartialNetWeight, firstPartialGrossWeight: lc.firstPartialGrossWeight, firstPartialCbm: lc.firstPartialCbm,
                    secondPartialQty: lc.secondPartialQty, secondPartialPkgs: lc.secondPartialPkgs, secondPartialNetWeight: lc.secondPartialNetWeight, secondPartialGrossWeight: lc.secondPartialGrossWeight, secondPartialCbm: lc.secondPartialCbm,
                    thirdPartialQty: lc.thirdPartialQty, thirdPartialPkgs: lc.thirdPartialPkgs, thirdPartialNetWeight: lc.thirdPartialNetWeight, thirdPartialGrossWeight: lc.thirdPartialGrossWeight, thirdPartialCbm: lc.thirdPartialCbm,
                    packingListUrl: lc.packingListUrl,
                });
                setSelectedCommercialInvoiceDateDisplay(lc.commercialInvoiceDate ? formatDisplayDate(lc.commercialInvoiceDate) : null);
                if(lc.partialShipmentAllowed === "Yes") {
                    setActivePartialShipmentAccordion("partialShipmentDetailsAccordionInstallReport");
                }
             }
          }
        } else {
          setReportDataError("Installation Report not found.");
          Swal.fire("Error", `Report with ID ${reportId} not found.`, "error");
        }
      } catch (err: any) {
        console.error("Error fetching installation report data: ", err);
        setReportDataError(`Failed to fetch report data: ${err.message}`);
        Swal.fire("Error", `Failed to fetch report data: ${err.message}`, "error");
      } finally {
        setIsLoadingReportData(false);
      }
    };

    const fetchDropdownOptions = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, suppliersSnap, lcsSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "suppliers")),
          getDocs(query(collection(firestore, "lc_entries"), where("commercialInvoiceNumber", "!=", "")))
        ]);

        setApplicantOptions(
          customersSnap.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
        );
        setBeneficiaryOptions(
          suppliersSnap.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );

        const fetchedLcOptions: LcForInvoiceDropdownOption[] = [];
        lcsSnap.forEach(docSnap => {
          const data = docSnap.data() as LCEntryDocument;
          if (data.commercialInvoiceNumber) {
            fetchedLcOptions.push({
              value: docSnap.id,
              label: data.commercialInvoiceNumber,
              lcData: { ...data, id: docSnap.id } ,
            });
          }
        });
        setLcOptionsForCommercialInvoice(fetchedLcOptions);

      } catch (error: any) {
        console.error("Error fetching dropdown options for Edit Installation Report form: ", error);
        Swal.fire("Error", `Could not load supporting data for dropdowns. Error: ${error.message}`, "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };

    fetchDropdownOptions().then(() => {
      if (reportId) {
        fetchInitialReportData();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, reset]); 

  React.useEffect(() => {
    if (watchedSelectedCommercialInvoiceLcId && lcOptionsForCommercialInvoice.length > 0) {
      const selectedOption = lcOptionsForCommercialInvoice.find(opt => opt.value === watchedSelectedCommercialInvoiceLcId);
      if (selectedOption) {
        const lc = selectedOption.lcData;
        const currentFormValues = getValues();

        if (currentFormValues.applicantId !== lc.applicantId || !currentFormValues.applicantId) {
            setValue("applicantId", lc.applicantId || '', { shouldValidate: true, shouldDirty: true });
        }
        if (currentFormValues.beneficiaryId !== lc.beneficiaryId || !currentFormValues.beneficiaryId) {
            setValue("beneficiaryId", lc.beneficiaryId || '', { shouldValidate: true, shouldDirty: true });
        }
        if (currentFormValues.documentaryCreditNumber !== lc.documentaryCreditNumber || !currentFormValues.documentaryCreditNumber) {
            setValue("documentaryCreditNumber", lc.documentaryCreditNumber || '', { shouldValidate: true, shouldDirty: true });
        }
        if (currentFormValues.totalMachineQtyFromLC !== lc.totalMachineQty || currentFormValues.totalMachineQtyFromLC === undefined) {
            setValue("totalMachineQtyFromLC", lc.totalMachineQty || undefined, { shouldValidate: true, shouldDirty: true });
        }
        if (currentFormValues.proformaInvoiceNumber !== lc.proformaInvoiceNumber || !currentFormValues.proformaInvoiceNumber) {
            setValue("proformaInvoiceNumber", lc.proformaInvoiceNumber || '', { shouldValidate: true, shouldDirty: true });
        }

        const newInvoiceDate = lc.invoiceDate && isValid(parseISO(lc.invoiceDate)) ? parseISO(lc.invoiceDate) : undefined;
        const currentInvoiceDateMs = currentFormValues.invoiceDate ? new Date(currentFormValues.invoiceDate).getTime() : null;
        const newInvoiceDateMs = newInvoiceDate ? newInvoiceDate.getTime() : null;
        if (currentInvoiceDateMs !== newInvoiceDateMs) {
             setValue("invoiceDate", newInvoiceDate, { shouldValidate: true, shouldDirty: true });
        }

        const newCommercialInvoiceDate = lc.commercialInvoiceDate && isValid(parseISO(lc.commercialInvoiceDate)) ? parseISO(lc.commercialInvoiceDate) : undefined;
        const currentCommercialInvoiceDateMs = currentFormValues.commercialInvoiceDate ? new Date(currentFormValues.commercialInvoiceDate).getTime() : null;
        const newCommercialInvoiceDateMs = newCommercialInvoiceDate ? newCommercialInvoiceDate.getTime() : null;
        if (currentCommercialInvoiceDateMs !== newCommercialInvoiceDateMs) {
            setValue("commercialInvoiceDate", newCommercialInvoiceDate, { shouldValidate: true, shouldDirty: true });
        }
        
        const newEtdDate = lc.etd && isValid(parseISO(lc.etd)) ? parseISO(lc.etd) : undefined;
        const currentEtdDateMs = currentFormValues.etdDate ? new Date(currentFormValues.etdDate).getTime() : null;
        const newEtdDateMs = newEtdDate ? newEtdDate.getTime() : null;
        if (currentEtdDateMs !== newEtdDateMs) {
            setValue("etdDate", newEtdDate, { shouldValidate: true, shouldDirty: true });
        }

        const newEtaDate = lc.eta && isValid(parseISO(lc.eta)) ? parseISO(lc.eta) : undefined;
        const currentEtaDateMs = currentFormValues.etaDate ? new Date(currentFormValues.etaDate).getTime() : null;
        const newEtaDateMs = newEtaDate ? newEtaDate.getTime() : null;
        if (currentEtaDateMs !== newEtaDateMs) {
            setValue("etaDate", newEtaDate, { shouldValidate: true, shouldDirty: true });
        }

        if (currentFormValues.packingListUrl !== lc.packingListUrl || !currentFormValues.packingListUrl) {
           setValue("packingListUrl", lc.packingListUrl || '', { shouldValidate: true, shouldDirty: true });
        }

        setSelectedLcDetails({
            isFirstShipment: lc.isFirstShipment,
            isSecondShipment: lc.isSecondShipment,
            isThirdShipment: lc.isThirdShipment,
            lcIdForLink: lc.id,
            partialShipmentAllowed: lc.partialShipmentAllowed,
            firstPartialQty: lc.firstPartialQty, firstPartialPkgs: lc.firstPartialPkgs, firstPartialNetWeight: lc.firstPartialNetWeight, firstPartialGrossWeight: lc.firstPartialGrossWeight, firstPartialCbm: lc.firstPartialCbm,
            secondPartialQty: lc.secondPartialQty, secondPartialPkgs: lc.secondPartialPkgs, secondPartialNetWeight: lc.secondPartialNetWeight, secondPartialGrossWeight: lc.secondPartialGrossWeight, secondPartialCbm: lc.secondPartialCbm,
            thirdPartialQty: lc.thirdPartialQty, thirdPartialPkgs: lc.thirdPartialPkgs, thirdPartialNetWeight: lc.thirdPartialNetWeight, thirdPartialGrossWeight: lc.thirdPartialGrossWeight, thirdPartialCbm: lc.thirdPartialCbm,
            packingListUrl: lc.packingListUrl,
        });
        setSelectedCommercialInvoiceDateDisplay(lc.commercialInvoiceDate ? formatDisplayDate(lc.commercialInvoiceDate) : null);
         if(lc.partialShipmentAllowed === "Yes") {
            setActivePartialShipmentAccordion("partialShipmentDetailsAccordionInstallReport");
        } else {
            setActivePartialShipmentAccordion(undefined);
        }
      }
    } else if (!watchedSelectedCommercialInvoiceLcId && !isLoadingReportData) { 
      const defaultValuesForReset = form.formState.defaultValues || getValues(); 
      setValue("applicantId", defaultValuesForReset.applicantId || '', { shouldValidate: true, shouldDirty: true });
      setValue("beneficiaryId", defaultValuesForReset.beneficiaryId || '', { shouldValidate: true, shouldDirty: true });
      setValue("documentaryCreditNumber", defaultValuesForReset.documentaryCreditNumber || '', { shouldValidate: true, shouldDirty: true });
      setValue("totalMachineQtyFromLC", defaultValuesForReset.totalMachineQtyFromLC || undefined, { shouldValidate: true, shouldDirty: true });
      setValue("proformaInvoiceNumber", defaultValuesForReset.proformaInvoiceNumber || '', { shouldValidate: true, shouldDirty: true });
      setValue("invoiceDate", defaultValuesForReset.invoiceDate || undefined, { shouldValidate: true, shouldDirty: true });
      setValue("commercialInvoiceDate", defaultValuesForReset.commercialInvoiceDate || undefined, { shouldValidate: true, shouldDirty: true });
      setValue("etdDate", defaultValuesForReset.etdDate || undefined, { shouldValidate: true, shouldDirty: true });
      setValue("etaDate", defaultValuesForReset.etaDate || undefined, { shouldValidate: true, shouldDirty: true });
      setValue("packingListUrl", defaultValuesForReset.packingListUrl || '', { shouldValidate: true, shouldDirty: true });
      setSelectedLcDetails({ lcIdForLink: null, isFirstShipment: false, isSecondShipment: false, isThirdShipment: false, partialShipmentAllowed: "No", packingListUrl: '' });
      setSelectedCommercialInvoiceDateDisplay(null);
      setActivePartialShipmentAccordion(undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedSelectedCommercialInvoiceLcId, lcOptionsForCommercialInvoice, setValue, isLoadingReportData, getValues]);


  React.useEffect(() => {
    const totalLcQtyValue = Number(watchedTotalLcMachineQty || 0);
    const installedQtyValue = installationDetailsFieldArray.fields.length;
    if (watchedTotalLcMachineQty !== undefined) {
      setPendingQty(totalLcQtyValue - installedQtyValue);
    } else {
      setPendingQty('N/A');
    }

    if (watchedInstallationDetails && Array.isArray(watchedInstallationDetails)) {
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
    if (!reportId) {
      Swal.fire("Error", "Report ID is missing. Cannot update.", "error");
      return;
    }
    setIsSubmitting(true);
    const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);
    const selectedLcOption = lcOptionsForCommercialInvoice.find(opt => opt.value === data.selectedCommercialInvoiceLcId);

    const dataToUpdate: Partial<Omit<InstallationReportDocument, 'id' | 'createdAt'>> & {updatedAt: any} = {
      applicantId: data.applicantId,
      applicantName: selectedApplicant?.label || getValues("applicantId"), // Fallback to current form value if not found
      beneficiaryId: data.beneficiaryId,
      beneficiaryName: selectedBeneficiary?.label || getValues("beneficiaryId"), // Fallback
      selectedCommercialInvoiceLcId: data.selectedCommercialInvoiceLcId || undefined,
      commercialInvoiceNumber: selectedLcOption?.label || undefined,
      commercialInvoiceDate: data.commercialInvoiceDate && isValid(new Date(data.commercialInvoiceDate)) ? format(new Date(data.commercialInvoiceDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      documentaryCreditNumber: data.documentaryCreditNumber || undefined,
      totalMachineQtyFromLC: data.totalMachineQtyFromLC || undefined,
      proformaInvoiceNumber: data.proformaInvoiceNumber || undefined,
      invoiceDate: data.invoiceDate && isValid(new Date(data.invoiceDate)) ? format(new Date(data.invoiceDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      etdDate: data.etdDate && isValid(new Date(data.etdDate)) ? format(new Date(data.etdDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      etaDate: data.etaDate && isValid(new Date(data.etaDate)) ? format(new Date(data.etaDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      packingListUrl: data.packingListUrl || undefined,
      technicianName: data.technicianName,
      reportingEngineerName: data.reportingEngineerName,
      installationDetails: data.installationDetails.map(item => ({
        slNo: item.slNo || undefined,
        machineModel: item.machineModel,
        serialNo: item.serialNo,
        ctlBoxModel: item.ctlBoxModel || undefined,
        ctlBoxSerial: item.ctlBoxSerial || undefined,
        installDate: item.installDate && isValid(new Date(item.installDate)) ? format(new Date(item.installDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined as any,
      })),
      totalInstalledQty: installationDetailsFieldArray.fields.length,
      pendingQty: typeof pendingQty === 'number' ? pendingQty : undefined,
      missingItemInfo: data.missingItemInfo || undefined,
      extraFoundInfo: data.extraFoundInfo || undefined,
      missingItemsIssueResolved: data.missingItemsIssueResolved ?? false,
      extraItemsIssueResolved: data.extraItemsIssueResolved ?? false,
      installationNotes: data.installationNotes || undefined,
      updatedAt: serverTimestamp(),
    };

    const cleanedDataToUpdate = Object.entries(dataToUpdate).reduce((acc, [key, value]) => {
        if (value !== undefined) {
             if (typeof value === 'string' && value.trim() === '' &&
                ['documentaryCreditNumber', 'proformaInvoiceNumber', 'packingListUrl', 'missingItemInfo', 'extraFoundInfo', 'installationNotes', 'selectedCommercialInvoiceLcId', 'commercialInvoiceNumber'].includes(key)
               ) {
                 // Keep empty strings for these specific fields if that's the intent, or make them undefined
                 acc[key as keyof typeof acc] = value; 
            } else {
                acc[key as keyof typeof acc] = value;
            }
        }
        return acc;
    }, {} as typeof dataToUpdate);

    console.log("Installation Report Data to be updated in Firestore:", cleanedDataToUpdate);

    try {
      const reportDocRef = doc(firestore, "installation_reports", reportId);
      await updateDoc(reportDocRef, cleanedDataToUpdate);
      Swal.fire({
        title: "Installation Report Updated!",
        text: `Report ID: ${reportId} successfully updated.`,
        icon: "success",
      });
    } catch (error: any) {
      console.error("Error updating installation report: ", error);
      let errorMessage = `Failed to update report: ${error.message}`;
      if (error.code === 'permission-denied' || (error.message && error.message.toLowerCase().includes("permission"))) {
        errorMessage = `Failed to update report: Missing or insufficient permissions. Please check Firestore security rules for 'installation_reports'. Original Firebase Error: ${error.message}`;
      }
      Swal.fire({
        title: "Update Failed",
        text: errorMessage,
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
        installDate: lastRow.installDate ? new Date(lastRow.installDate) : undefined,
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

    const headers = [
      "SL No.", "Machine Model", "Machine Serial No.", "Ctl. Box Model", "Ctl. Box Serial", "Install Date", "Warranty"
    ];
    
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
    csvContent += "\n\n"; 
    csvContent += headers.map(escapeCsvCell).join(",") + "\n";

    formData.installationDetails.forEach((item, index) => {
      let warrantyDisplay = "N/A";
      if (item.installDate && isValid(new Date(item.installDate))) {
        const expiryDate = addDays(new Date(item.installDate), 365);
        const diffDays = differenceInDays(expiryDate, new Date());
        warrantyDisplay = diffDays < 0 ? "Expired" : `${diffDays} days`;
      }
      const row = [
        item.slNo || (index + 1).toString(),
        item.machineModel,
        item.serialNo,
        item.ctlBoxModel,
        item.ctlBoxSerial,
        item.installDate ? formatDisplayDate(new Date(item.installDate)) : "N/A",
        warrantyDisplay,
      ];
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
    } else {
        Swal.fire("Export Failed", "Your browser doesn't support direct CSV download.", "error");
    }
  };

  const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.type !== "text/csv") {
      Swal.fire("Invalid File Type", "Please upload a .csv file.", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        Swal.fire("Error Reading File", "Could not read file content.", "error");
        return;
      }
      try {
        const rows = text.split(/\r\n|\n/).filter(row => row.trim() !== '');
        if (rows.length <= 1) {
          Swal.fire("Empty or Header-Only CSV", "The CSV file is empty or contains only a header row.", "info");
          return;
        }

        const dataRows = rows.slice(1);
        const newInstallationDetailsFromCsv: InstallationDetailItemType[] = dataRows.map((row, csvRowIndex) => {
          const columns = row.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
          
          const machineModel = columns[0] || '';
          const serialNo = columns[1] || '';
          const ctlBoxModel = columns[2] || '';
          const ctlBoxSerial = columns[3] || '';
          const installDateStr = columns[4];
          
          let installDate: Date | undefined = undefined;
          if (installDateStr) {
            let parsedDate = parseISO(installDateStr); 
            if (!isValid(parsedDate)) {
                parsedDate = parseDateFns(installDateStr, 'PPP', new Date());
                if (!isValid(parsedDate)) {
                    parsedDate = new Date(installDateStr); 
                }
            }
            if (isValid(parsedDate)) {
                installDate = parsedDate;
            } else {
                console.warn(`Could not parse date "${installDateStr}" for CSV row ${csvRowIndex + 1}.`);
            }
          }
          const existingRowsCount = installationDetailsFieldArray.fields.length;
          return {
            slNo: (existingRowsCount + csvRowIndex + 1).toString(),
            machineModel,
            serialNo,
            ctlBoxModel: ctlBoxModel || undefined,
            ctlBoxSerial: ctlBoxSerial || undefined,
            installDate,
          };
        });

        if (newInstallationDetailsFromCsv.length > 0) {
          newInstallationDetailsFromCsv.forEach(item => {
            installationDetailsFieldArray.append(item);
          });
          Swal.fire("Import Complete", `${newInstallationDetailsFromCsv.length} rows appended successfully.`, "success");
        } else {
          Swal.fire("No Data Imported", "No valid data rows found in the CSV after the header.", "info");
        }
      } catch (parseError) {
        console.error("Error parsing CSV: ", parseError);
        Swal.fire("CSV Parse Error", "Could not parse the CSV file. Please ensure it's correctly formatted.", "error");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      Swal.fire("File Read Error", "Error reading the selected file.", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };


  const isLcSelected = !!watchedSelectedCommercialInvoiceLcId;

  if (isLoadingReportData || isLoadingDropdowns) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading report details and options...</p>
      </div>
    );
  }

  if (reportDataError) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-6xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{reportDataError}</p>
             <Button variant="outline" asChild className="mt-4">
                <Link href="/dashboard/warranty-management/installation-reports-view">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Reports List
                </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
          <Link href="/dashboard/warranty-management/installation-reports-view" passHref>
              <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Installation Reports List
              </Button>
          </Link>
      </div>
      <Card className="max-w-6xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", sectionHeadingClass)}>
            <Edit className="mr-2 h-7 w-7 text-primary" />
            Edit Installation Report
          </CardTitle>
          <CardDescription>
            Modify the details for Report ID: <span className="font-semibold text-foreground">{reportId}</span>.
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
                          selectPlaceholder={isLoadingDropdowns ? "Loading C.I. Numbers..." : "Select C.I. Number"}
                          emptyStateMessage="No L/C found with that C.I. No."
                          disabled={isLoadingDropdowns}
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
                  name="totalMachineQtyFromLC"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground" />Total L/C Machine Qty*</FormLabel>
                      <FormControl><Input type="number" placeholder="Qty" {...field} value={field.value ?? ""} readOnly={isLcSelected} className={cn(isLcSelected && "bg-muted/50 cursor-not-allowed")} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></FormControl>
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
                <div className="p-3 border rounded-md bg-muted/30">
                    <FormLabel className="text-sm font-medium text-muted-foreground mb-2 block">Shipment Status (from L/C)</FormLabel>
                    {selectedLcDetails.lcIdForLink ? (
                        <div className="flex items-center gap-3">
                            {[
                                { flag: selectedLcDetails.isFirstShipment, label: "1st" },
                                { flag: selectedLcDetails.isSecondShipment, label: "2nd" },
                                { flag: selectedLcDetails.isThirdShipment, label: "3rd" }
                            ].map((shipment, index) => (
                                <Button
                                    key={index}
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
                                    onClick={() => selectedLcDetails.lcIdForLink && window.open(`/dashboard/total-lc/${selectedLcDetails.lcIdForLink}/edit`, '_blank')}
                                >
                                    {shipment.label}
                                </Button>
                            ))}
                        </div>
                    ) : <p className="text-xs text-muted-foreground">Select a C.I. Number to view status.</p>}
                </div>
                <FormField
                control={control}
                name="packingListUrl"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Packing List URL</FormLabel>
                    <div className="flex items-center gap-2">
                        <FormControl className="flex-grow">
                        <Input type="url" placeholder="https://example.com/packing-list.pdf" {...field} value={field.value ?? ""} readOnly={isLcSelected && !!selectedLcDetails.packingListUrl} className={cn((isLcSelected && !!selectedLcDetails.packingListUrl) && "bg-muted/50 cursor-not-allowed")}/>
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
                    className="w-full"
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
                              <TableHead className="w-[50px] text-foreground">SL No.</TableHead>
                              <TableHead className="text-foreground">Machine Model*</TableHead>
                              <TableHead className="text-foreground">Machine Serial No.*</TableHead>
                              <TableHead className="text-foreground">Ctl. Box Model</TableHead>
                              <TableHead className="text-foreground">Ctl. Box Serial</TableHead>
                              <TableHead className="text-foreground">Install Date*</TableHead>
                              <TableHead className="text-foreground w-[150px]">Warranty</TableHead>
                              <TableHead className="w-[80px] text-right text-foreground">Action</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {installationDetailsFieldArray.fields.map((field, index) => {
                              const installDateValue = watch(`installationDetails.${index}.installDate`);
                              let warrantyDisplay = "N/A";
                              if (installDateValue && isValid(new Date(installDateValue))) {
                                  const expiryDate = addDays(new Date(installDateValue), 365);
                                  const diffDays = differenceInDays(expiryDate, new Date());
                                  warrantyDisplay = diffDays < 0 ? "Expired" : `${diffDays} days remaining`;
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
                                                      <FormControl><Input placeholder="Enter model" {...itemField} value={itemField.value ?? ''} className="h-9" /></FormControl>
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
                                                      <FormControl><Input placeholder="Enter serial no." {...itemField} value={itemField.value ?? ''} className="h-9" /></FormControl>
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
                                      <TableCell className="text-xs text-foreground w-[150px]">{warrantyDisplay}</TableCell>
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
            {formState.errors.installationDetails && (
                <FormMessage>
                {formState.errors.installationDetails.message ||
                 (typeof formState.errors.installationDetails === 'object' && (formState.errors.installationDetails as any).root?.message) ||
                 "Please ensure Machine Serial No. are unique."}
                </FormMessage>
            )}
             <div className="flex flex-wrap gap-2 mt-2">
                 <Button type="button" variant="outline" onClick={() => installationDetailsFieldArray.append({ slNo: (installationDetailsFieldArray.fields.length + 1).toString(), machineModel: '', serialNo: '', ctlBoxModel: '', ctlBoxSerial: '', installDate: undefined as any })}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Installation Item
                </Button>
                <Button type="button" variant="outline" onClick={handleDuplicateLastRow} disabled={installationDetailsFieldArray.fields.length === 0}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicate Last Row
                </Button>
                <Button type="button" variant="outline" onClick={handleExportToCsv} disabled={installationDetailsFieldArray.fields.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Export to CSV
                </Button>
                <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleImportCsv}
                    className="hidden"
                    id="csv-import-input"
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="mr-2 h-4 w-4" /> Import from CSV
                </Button>
            </div>


             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-4">
              <FormItem>
                  <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground" />Total Installed QTY:</FormLabel>
                  <Input type="text" value={installationDetailsFieldArray.fields.length} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" />
              </FormItem>
               <FormItem>
                  <FormLabel className="flex items-center"><Package className="mr-2 h-4 w-4 text-muted-foreground" />Pending QTY:</FormLabel>
                  <Input type="text" value={pendingQty} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" />
              </FormItem>
              <FormItem>
                <FormLabel className="flex items-center"><AlertCircle className="mr-2 h-4 w-4 text-destructive" />Warranty Expired:</FormLabel>
                <Input type="text" value={`${warrantyExpiredCount} sets`} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold text-destructive" />
              </FormItem>
              <FormItem>
                <FormLabel className="flex items-center"><ShieldCheck className="mr-2 h-4 w-4 text-green-600" />Warranty Remaining:</FormLabel>
                <Input type="text" value={`${warrantyRemainingCount} sets`} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold text-green-600" />
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
                                <FormLabel className="hover:cursor-pointer text-sm font-normal">
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
                                <FormLabel className="hover:cursor-pointer text-sm font-normal">
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
                        <FormLabel className="flex items-center"><UserCheck className="mr-2 h-4 w-4 text-muted-foreground" />Reporting Engineer Name*</FormLabel>
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

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingDropdowns || isLoadingReportData }>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Report...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Installation Report
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


    
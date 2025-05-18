
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntryDocument, Currency, TrackingCourier, LCStatus, ShipmentMode, CustomerDocument, SupplierDocument, PartialShipmentAllowed, CertificateOfOriginCountry, TermsOfPay, ApplicantOption } from '@/types';
import { termsOfPayOptions, shipmentModeOptions, currencyOptions, trackingCourierOptions, lcStatusOptions, partialShipmentAllowedOptions, certificateOfOriginCountries } from '@/types';
import Swal from 'sweetalert2';
import { isValid, parseISO, format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, Landmark, FileText, CalendarDays, Ship, Plane, Workflow, Layers, FileSignature, Edit3, BellRing, Users, Building, Hash, ExternalLink, PackageCheck, Search, Save, Info, CheckSquare, UploadCloud, DollarSign, Package, FileIcon, Box, Weight, Scale, Link as LinkIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const toNumberOrUndefined = (val: unknown): number | undefined => {
  if (val === "" || val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
    return undefined;
  }
  const num = Number(String(val).trim());
  return isNaN(num) ? undefined : num;
};

const NONE_COURIER_VALUE = "__NONE_LC_EDIT__";
const PLACEHOLDER_APPLICANT_VALUE = "__LC_EDIT_APPLICANT_PLACEHOLDER__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__LC_EDIT_BENEFICIARY_PLACEHOLDER__";

const lcEntrySchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required"),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required"),
  currency: z.enum(currencyOptions, { required_error: "Currency is required" }),
  termsOfPay: z.enum(termsOfPayOptions, { required_error: "Terms of pay are required" }),
  status: z.enum(lcStatusOptions, { required_error: "L/C Status is required" }),
  shipmentMode: z.enum(shipmentModeOptions, { required_error: "Shipment mode is required" }),
  trackingCourier: z.enum(["", ...trackingCourierOptions]).optional(),
  amount: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive")
  ),
  documentaryCreditNumber: z.string().min(1, "Documentary Credit Number is required"),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional().nullable(),
  totalMachineQty: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Quantity must be a number" }).int().positive("Quantity must be positive")
  ),
  lcIssueDate: z.date({ required_error: "L/C issue date is required" }),
  expireDate: z.date({ required_error: "Expire date is required" }),
  latestShipmentDate: z.date({ required_error: "Latest shipment date is required" }),
  trackingNumber: z.string().optional(),
  etd: z.date().optional().nullable(),
  eta: z.date().optional().nullable(),
  itemDescriptions: z.string().optional(),
  consigneeBankNameAddress: z.string().optional(),
  bankBin: z.string().optional(),
  vesselOrFlightName: z.string().optional(),
  vesselImoNumber: z.string().optional(),
  totalPackageQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Package quantity cannot be negative").optional()),
  totalNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net weight cannot be negative").optional()),
  totalGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross weight cannot be negative").optional()),
  totalCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional()),
  partialShipments: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  shippingMarks: z.string().optional(),
  certificateOfOrigin: z.array(z.enum(certificateOfOriginCountries)).optional(),
  notifyPartyNameAndAddress: z.string().optional(),
  notifyPartyName: z.string().optional(), // This field maps to "Notify Party Contact Person:"
  notifyPartyCell: z.string().optional(),
  notifyPartyEmail: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')),
  numberOfAmendments: z.preprocess(
    toNumberOrUndefined,
    z.number({ invalid_type_error: "Number of amendments must be a number" }).int().nonnegative("Number of amendments cannot be negative").optional()
  ),
  finalPIUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format" }).optional()
  ),
  shippingDocumentsUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format" }).optional()
  ),
  finalLcUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format" }).optional()
  ),
  purchaseOrderUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format" }).optional()
  ),
  partialShipmentAllowed: z.enum(partialShipmentAllowedOptions, { required_error: "Please specify if partial shipment is allowed" }),
  firstPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  secondPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  thirdPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  firstPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional()),
  secondPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional()),
  thirdPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional()),
  originalBlQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  copyBlQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  originalCooQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  copyCooQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  invoiceQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  packingListQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  beneficiaryCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  brandNewCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  beneficiaryWarrantyCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  beneficiaryComplianceCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  shipmentAdviceQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
});

type LCEditFormValues = z.infer<typeof lcEntrySchema>;

interface EditLCEntryFormProps {
  initialData: LCEntryDocument;
  lcId: string;
}

const sectionHeadingClass = "font-bold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-4 flex items-center";

export function EditLCEntryForm({ initialData, lcId }: EditLCEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ApplicantOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = React.useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = React.useState(true);

  const [totalCalculatedPartialQty, setTotalCalculatedPartialQty] = React.useState<number | string>(0);
  const [totalCalculatedPartialAmount, setTotalCalculatedPartialAmount] = React.useState<number | string>(0);

  const form = useForm<LCEditFormValues>({
    resolver: zodResolver(lcEntrySchema),
    defaultValues: {
      applicantId: '',
      beneficiaryId: '',
      currency: 'USD' as Currency,
      termsOfPay: "" as TermsOfPay,
      status: 'Draft' as LCStatus,
      shipmentMode: "" as ShipmentMode,
      trackingCourier: '',
      amount: undefined,
      documentaryCreditNumber: '',
      proformaInvoiceNumber: '',
      invoiceDate: undefined,
      totalMachineQty: undefined,
      lcIssueDate: new Date(),
      expireDate: new Date(),
      latestShipmentDate: new Date(),
      trackingNumber: '',
      etd: undefined,
      eta: undefined,
      itemDescriptions: '',
      consigneeBankNameAddress: '',
      bankBin: '',
      vesselOrFlightName: '',
      vesselImoNumber: '',
      totalPackageQty: undefined,
      totalNetWeight: undefined,
      totalGrossWeight: undefined,
      totalCbm: undefined,
      partialShipments: '',
      portOfLoading: '',
      portOfDischarge: '',
      shippingMarks: '',
      certificateOfOrigin: [],
      notifyPartyNameAndAddress: '',
      notifyPartyName: '',
      notifyPartyCell: '',
      notifyPartyEmail: '',
      numberOfAmendments: undefined,
      finalPIUrl: '',
      shippingDocumentsUrl: '',
      finalLcUrl: '',
      purchaseOrderUrl: '',
      partialShipmentAllowed: 'No',
      firstPartialQty: 0,
      secondPartialQty: 0,
      thirdPartialQty: 0,
      firstPartialAmount: 0,
      secondPartialAmount: 0,
      thirdPartialAmount: 0,
      originalBlQty: 0,
      copyBlQty: 0,
      originalCooQty: 0,
      copyCooQty: 0,
      invoiceQty: 0,
      packingListQty: 0,
      beneficiaryCertificateQty: 0,
      brandNewCertificateQty: 0,
      beneficiaryWarrantyCertificateQty: 0,
      beneficiaryComplianceCertificateQty: 0,
      shipmentAdviceQty: 0,
    },
  });
  
  const { setValue, watch } = form;

  React.useEffect(() => {
    const fetchDropdownData = async () => {
      setIsLoadingApplicants(true);
      setIsLoadingBeneficiaries(true);
      try {
        const customersSnapshot = await getDocs(collection(firestore, "customers"));
        const fetchedApplicants = customersSnapshot.docs.map(doc => {
          const data = doc.data() as CustomerDocument;
          return { 
            value: doc.id, 
            label: data.applicantName || 'Unnamed Applicant',
            address: data.address,
            contactPersonName: data.contactPerson,
            email: data.email,
            phone: data.phone,
           } as ApplicantOption;
        });
        setApplicantOptions(fetchedApplicants);
        console.log("EditLCEntryForm: Fetched Applicant Options:", fetchedApplicants);

        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        const fetchedBeneficiaries = suppliersSnapshot.docs.map(doc => {
          const data = doc.data() as SupplierDocument;
          return { value: doc.id, label: data.beneficiaryName || 'Unnamed Beneficiary' };
        });
        setBeneficiaryOptions(fetchedBeneficiaries);
        console.log("EditLCEntryForm: Fetched Beneficiary Options:", fetchedBeneficiaries);

      } catch (error) {
        console.error("Error fetching dropdown data for Edit L/C Form: ", error);
        Swal.fire("Error", "Could not fetch applicant/beneficiary data. See console.", "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };
    fetchDropdownData();
  }, []);

  React.useEffect(() => {
    if (initialData && applicantOptions.length > 0 && beneficiaryOptions.length > 0) {
      console.log("EditLCEntryForm: Initial L/C Data for Form:", initialData);
      console.log("EditLCEntryForm: Setting Applicant ID in form to:", initialData.applicantId);
      console.log("EditLCEntryForm: Setting Beneficiary ID in form to:", initialData.beneficiaryId);
      form.reset({
        applicantId: initialData.applicantId || '',
        beneficiaryId: initialData.beneficiaryId || '',
        currency: initialData.currency || 'USD',
        termsOfPay: initialData.termsOfPay || ('' as TermsOfPay),
        status: initialData.status || 'Draft',
        shipmentMode: initialData.shipmentMode || ('' as ShipmentMode),
        trackingCourier: initialData.trackingCourier || '',
        amount: initialData.amount !== undefined ? initialData.amount : undefined,
        documentaryCreditNumber: initialData.documentaryCreditNumber || '',
        proformaInvoiceNumber: initialData.proformaInvoiceNumber || '',
        invoiceDate: initialData.invoiceDate && isValid(parseISO(initialData.invoiceDate)) ? parseISO(initialData.invoiceDate) : undefined,
        totalMachineQty: initialData.totalMachineQty !== undefined ? initialData.totalMachineQty : undefined,
        lcIssueDate: initialData.lcIssueDate && isValid(parseISO(initialData.lcIssueDate)) ? parseISO(initialData.lcIssueDate) : new Date(),
        expireDate: initialData.expireDate && isValid(parseISO(initialData.expireDate)) ? parseISO(initialData.expireDate) : new Date(),
        latestShipmentDate: initialData.latestShipmentDate && isValid(parseISO(initialData.latestShipmentDate)) ? parseISO(initialData.latestShipmentDate) : new Date(),
        trackingNumber: initialData.trackingNumber || '',
        etd: initialData.etd && isValid(parseISO(initialData.etd)) ? parseISO(initialData.etd) : undefined,
        eta: initialData.eta && isValid(parseISO(initialData.eta)) ? parseISO(initialData.eta) : undefined,
        itemDescriptions: initialData.itemDescriptions || '',
        consigneeBankNameAddress: initialData.consigneeBankNameAddress || '',
        bankBin: initialData.bankBin || '',
        vesselOrFlightName: initialData.vesselOrFlightName || '',
        vesselImoNumber: initialData.vesselImoNumber || '',
        totalPackageQty: initialData.totalPackageQty ?? 0,
        totalNetWeight: initialData.totalNetWeight ?? 0,
        totalGrossWeight: initialData.totalGrossWeight ?? 0,
        totalCbm: initialData.totalCbm ?? 0,
        partialShipments: initialData.partialShipments || '',
        portOfLoading: initialData.portOfLoading || '',
        portOfDischarge: initialData.portOfDischarge || '',
        shippingMarks: initialData.shippingMarks || '',
        certificateOfOrigin: initialData.certificateOfOrigin || [],
        notifyPartyNameAndAddress: initialData.notifyPartyNameAndAddress || '',
        notifyPartyName: initialData.notifyPartyName || '',
        notifyPartyCell: initialData.notifyPartyCell || '',
        notifyPartyEmail: initialData.notifyPartyEmail || '',
        numberOfAmendments: initialData.numberOfAmendments !== undefined ? initialData.numberOfAmendments : undefined,
        finalPIUrl: initialData.finalPIUrl || '',
        shippingDocumentsUrl: initialData.shippingDocumentsUrl || '',
        finalLcUrl: initialData.finalLcUrl || '',
        purchaseOrderUrl: initialData.purchaseOrderUrl || '',
        partialShipmentAllowed: initialData.partialShipmentAllowed || 'No',
        firstPartialQty: initialData.firstPartialQty ?? 0,
        secondPartialQty: initialData.secondPartialQty ?? 0,
        thirdPartialQty: initialData.thirdPartialQty ?? 0,
        firstPartialAmount: initialData.firstPartialAmount ?? 0,
        secondPartialAmount: initialData.secondPartialAmount ?? 0,
        thirdPartialAmount: initialData.thirdPartialAmount ?? 0,
        originalBlQty: initialData.originalBlQty ?? 0,
        copyBlQty: initialData.copyBlQty ?? 0,
        originalCooQty: initialData.originalCooQty ?? 0,
        copyCooQty: initialData.copyCooQty ?? 0,
        invoiceQty: initialData.invoiceQty ?? 0,
        packingListQty: initialData.packingListQty ?? 0,
        beneficiaryCertificateQty: initialData.beneficiaryCertificateQty ?? 0,
        brandNewCertificateQty: initialData.brandNewCertificateQty ?? 0,
        beneficiaryWarrantyCertificateQty: initialData.beneficiaryWarrantyCertificateQty ?? 0,
        beneficiaryComplianceCertificateQty: initialData.beneficiaryComplianceCertificateQty ?? 0,
        shipmentAdviceQty: initialData.shipmentAdviceQty ?? 0,
      });
    }
  }, [initialData, form, applicantOptions, beneficiaryOptions]);

  const watchedApplicantId = watch("applicantId");
  React.useEffect(() => {
    console.log("EditLCEntryForm: Auto-populate effect triggered. Watched Applicant ID:", watchedApplicantId);
    if (watchedApplicantId && applicantOptions.length > 0) {
      const selectedApplicant = applicantOptions.find(opt => opt.value === watchedApplicantId);
      console.log("EditLCEntryForm: Selected Applicant for auto-populate:", selectedApplicant);
      if (selectedApplicant) {
        setValue("notifyPartyNameAndAddress", selectedApplicant.address || '', { shouldDirty: true, shouldValidate: true });
        setValue("notifyPartyName", selectedApplicant.contactPersonName || '', { shouldDirty: true, shouldValidate: true });
        setValue("notifyPartyCell", selectedApplicant.phone || '', { shouldDirty: true, shouldValidate: true });
        setValue("notifyPartyEmail", selectedApplicant.email || '', { shouldDirty: true, shouldValidate: true });
      }
    }
  }, [watchedApplicantId, applicantOptions, setValue]);

  const watchedPartialShipmentAllowed = watch("partialShipmentAllowed");
  const watchedPartialQtys = [watch("firstPartialQty"), watch("secondPartialQty"), watch("thirdPartialQty")];
  const watchedPartialAmounts = [watch("firstPartialAmount"), watch("secondPartialAmount"), watch("thirdPartialAmount")];

  React.useEffect(() => {
    if (watchedPartialShipmentAllowed === "Yes") {
        const currentFirstQty = form.getValues("firstPartialQty");
        const currentSecondQty = form.getValues("secondPartialQty");
        const currentThirdQty = form.getValues("thirdPartialQty");
        const currentFirstAmount = form.getValues("firstPartialAmount");
        const currentSecondAmount = form.getValues("secondPartialAmount");
        const currentThirdAmount = form.getValues("thirdPartialAmount");

        // Only set to 0 if the field is currently undefined or null (not just empty string, as that's handled by toNumberOrUndefined)
        // This check is important for edit form to not override existing 0s if they were intentionally set
        if (currentFirstQty === undefined || currentFirstQty === null) setValue("firstPartialQty", 0, { shouldValidate: true, shouldDirty: true });
        if (currentSecondQty === undefined || currentSecondQty === null) setValue("secondPartialQty", 0, { shouldValidate: true, shouldDirty: true });
        if (currentThirdQty === undefined || currentThirdQty === null) setValue("thirdPartialQty", 0, { shouldValidate: true, shouldDirty: true });
        if (currentFirstAmount === undefined || currentFirstAmount === null) setValue("firstPartialAmount", 0, { shouldValidate: true, shouldDirty: true });
        if (currentSecondAmount === undefined || currentSecondAmount === null) setValue("secondPartialAmount", 0, { shouldValidate: true, shouldDirty: true });
        if (currentThirdAmount === undefined || currentThirdAmount === null) setValue("thirdPartialAmount", 0, { shouldValidate: true, shouldDirty: true });
    }
  }, [watchedPartialShipmentAllowed, setValue, form]);


  React.useEffect(() => {
    const qtys = watchedPartialQtys.map(q => Number(q) || 0);
    setTotalCalculatedPartialQty(qtys.reduce((sum, val) => sum + val, 0));
  }, [watchedPartialQtys]);

  React.useEffect(() => {
    const amounts = watchedPartialAmounts.map(a => Number(a) || 0);
    setTotalCalculatedPartialAmount(amounts.reduce((sum, val) => sum + val, 0).toFixed(2));
  }, [watchedPartialAmounts]);

  async function onSubmit(data: LCEditFormValues) {
    setIsSubmitting(true);

    const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);

    const dataToUpdate: Partial<Omit<LCEntryDocument, 'id' | 'createdAt'>> = {
      applicantId: data.applicantId,
      applicantName: selectedApplicant ? selectedApplicant.label : initialData.applicantName,
      beneficiaryId: data.beneficiaryId,
      beneficiaryName: selectedBeneficiary ? selectedBeneficiary.label : initialData.beneficiaryName,
      currency: data.currency,
      termsOfPay: data.termsOfPay,
      status: data.status,
      shipmentMode: data.shipmentMode,
      trackingCourier: data.trackingCourier === NONE_COURIER_VALUE ? "" : data.trackingCourier || undefined,
      amount: data.amount,
      documentaryCreditNumber: data.documentaryCreditNumber,
      proformaInvoiceNumber: data.proformaInvoiceNumber || undefined,
      invoiceDate: data.invoiceDate ? format(data.invoiceDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      totalMachineQty: data.totalMachineQty,
      lcIssueDate: data.lcIssueDate ? format(data.lcIssueDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      expireDate: data.expireDate ? format(data.expireDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      latestShipmentDate: data.latestShipmentDate ? format(data.latestShipmentDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      trackingNumber: data.trackingNumber || undefined,
      etd: data.etd ? format(data.etd, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      eta: data.eta ? format(data.eta, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      itemDescriptions: data.itemDescriptions || undefined,
      consigneeBankNameAddress: data.consigneeBankNameAddress || undefined,
      bankBin: data.bankBin || undefined,
      vesselOrFlightName: data.vesselOrFlightName || undefined,
      vesselImoNumber: data.vesselImoNumber || undefined,
      totalPackageQty: data.totalPackageQty,
      totalNetWeight: data.totalNetWeight,
      totalGrossWeight: data.totalGrossWeight,
      totalCbm: data.totalCbm,
      partialShipments: data.partialShipments || undefined,
      portOfLoading: data.portOfLoading || undefined,
      portOfDischarge: data.portOfDischarge || undefined,
      shippingMarks: data.shippingMarks || undefined,
      certificateOfOrigin: data.certificateOfOrigin && data.certificateOfOrigin.length > 0 ? data.certificateOfOrigin : undefined,
      notifyPartyNameAndAddress: data.notifyPartyNameAndAddress || undefined,
      notifyPartyName: data.notifyPartyName || undefined, // This field maps to "Notify Party Contact Person:"
      notifyPartyCell: data.notifyPartyCell || undefined,
      notifyPartyEmail: data.notifyPartyEmail || undefined,
      numberOfAmendments: data.numberOfAmendments,
      finalPIUrl: data.finalPIUrl || undefined,
      shippingDocumentsUrl: data.shippingDocumentsUrl || undefined,
      finalLcUrl: data.finalLcUrl || undefined,
      purchaseOrderUrl: data.purchaseOrderUrl || undefined,
      partialShipmentAllowed: data.partialShipmentAllowed,
      firstPartialQty: data.firstPartialQty,
      secondPartialQty: data.secondPartialQty,
      thirdPartialQty: data.thirdPartialQty,
      firstPartialAmount: data.firstPartialAmount,
      secondPartialAmount: data.secondPartialAmount,
      thirdPartialAmount: data.thirdPartialAmount,
      originalBlQty: data.originalBlQty,
      copyBlQty: data.copyBlQty,
      originalCooQty: data.originalCooQty,
      copyCooQty: data.copyCooQty,
      invoiceQty: data.invoiceQty,
      packingListQty: data.packingListQty,
      beneficiaryCertificateQty: data.beneficiaryCertificateQty,
      brandNewCertificateQty: data.brandNewCertificateQty,
      beneficiaryWarrantyCertificateQty: data.beneficiaryWarrantyCertificateQty,
      beneficiaryComplianceCertificateQty: data.beneficiaryComplianceCertificateQty,
      shipmentAdviceQty: data.shipmentAdviceQty,
      updatedAt: serverTimestamp() as any,
      year: data.lcIssueDate ? new Date(data.lcIssueDate).getFullYear() : initialData.year,
    };

    // Remove undefined fields before sending to Firestore to avoid errors
    // and to ensure only modified fields are updated (if using merge:true for update)
    // However, for 'updateDoc', it's better to explicitly send empty strings for fields you want to clear
    // and omit fields that weren't changed from initialData if you don't want to overwrite them.
    // For simplicity here, we send all fields and let Firestore handle it.
    // But to avoid "Unsupported field value: undefined" errors for fields that are not numbers or dates:
    Object.keys(dataToUpdate).forEach(key => {
      if (dataToUpdate[key as keyof typeof dataToUpdate] === undefined && 
          !(key.toLowerCase().includes('date') || 
            key.toLowerCase().includes('amount') || 
            key.toLowerCase().includes('qty') ||
            key.toLowerCase().includes('weight') ||
            key.toLowerCase().includes('cbm') ||
            key.toLowerCase().includes('amendments')
            )
         ) {
        // For optional string fields, an empty string is fine if it's truly meant to be empty.
        // If the intention is to remove the field, use deleteField() from Firebase.
        // For now, we'll let empty strings be passed for non-numeric/non-date optional fields.
        // The Zod schema should ensure that required fields are not undefined.
      }
    });


    try {
      const lcDocRef = doc(firestore, "lc_entries", lcId);
      await updateDoc(lcDocRef, dataToUpdate);
      Swal.fire({
        title: "L/C Entry Updated!",
        text: `L/C entry (ID: ${lcId}) has been successfully updated.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (error: any) {
      console.error("Error updating L/C document: ", error);
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update L/C entry: ${error.message}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const watchedShipmentMode = watch("shipmentMode");
  let viaLabel = "Vessel/Flight Name";
  if (watchedShipmentMode === "Sea") {
    viaLabel = "Vessel Name";
  } else if (watchedShipmentMode === "Air") {
    viaLabel = "Flight Name";
  }

  const watchedCurrency = watch("currency");
  const amountLabel = watchedCurrency ? `${watchedCurrency} Amount*` : "Amount*";

  const handleTrackDocument = () => {
    const courier = form.getValues("trackingCourier");
    const number = form.getValues("trackingNumber");

    if (!courier || courier.trim() === "" || courier === NONE_COURIER_VALUE || !number || number.trim() === "") {
      Swal.fire({
        title: "Information Missing",
        text: "Please select a courier and enter a tracking number.",
        icon: "info",
      });
      return;
    }

    let url = "";
    if (courier === "DHL") {
      url = `https://www.dhl.com/bd-en/home/tracking.html?tracking-id=${encodeURIComponent(number.trim())}&submit=1`;
    } else if (courier === "FedEx") {
      url = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number.trim())}&trkqual=2460395000~${encodeURIComponent(number.trim())}~FX`;
    }

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Swal.fire({
        title: "Courier Not Supported",
        text: "Tracking for the selected courier is not implemented.",
        icon: "warning",
      });
    }
  };

  const handleTrackVessel = () => {
    const imoNumber = form.getValues("vesselImoNumber");
    if (!imoNumber || imoNumber.trim() === "") {
       Swal.fire({
        title: "IMO Number Missing",
        text: "Please enter a Vessel IMO number to track.",
        icon: "info",
      });
      return;
    }
    const url = `https://www.vesselfinder.com/vessels/details/${encodeURIComponent(imoNumber.trim())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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

  if (isLoadingApplicants || isLoadingBeneficiaries) {
    return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading L/C options...</span></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <FileText className="mr-2 h-5 w-5 text-primary" />
          L/C & Invoice Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="applicantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Applicant Name*</FormLabel>
                 <Combobox
                  options={applicantOptions}
                  value={field.value || PLACEHOLDER_APPLICANT_VALUE}
                  onValueChange={(value) => field.onChange(value === PLACEHOLDER_APPLICANT_VALUE ? '' : value)}
                  placeholder="Search Applicant..."
                  selectPlaceholder={isLoadingApplicants ? "Loading applicants..." : "Select applicant"}
                  emptyStateMessage="No applicant found."
                  disabled={isLoadingApplicants}
                />
                <FormDescription>Select from your list of customers/applicants.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="beneficiaryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Beneficiary Name*</FormLabel>
                 <Combobox
                  options={beneficiaryOptions}
                  value={field.value || PLACEHOLDER_BENEFICIARY_VALUE}
                  onValueChange={(value) => field.onChange(value === PLACEHOLDER_BENEFICIARY_VALUE ? '' : value)}
                  placeholder="Search Beneficiary..."
                  selectPlaceholder={isLoadingBeneficiaries ? "Loading beneficiaries..." : "Select beneficiary"}
                  emptyStateMessage="No beneficiary found."
                  disabled={isLoadingBeneficiaries}
                />
                <FormDescription>Select from your list of suppliers/beneficiaries.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {currencyOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{amountLabel}</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g., 50000" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="termsOfPay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Terms of Pay*</FormLabel>
                 <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select terms of payment" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {termsOfPayOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="documentaryCreditNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Documentary Credit Number*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Documentary Credit Number" {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="proformaInvoiceNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proforma Invoice Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter PI number" {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="invoiceDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Invoice Date</FormLabel>
                <DatePickerField field={field} placeholder="Select invoice date" />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalMachineQty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total L/C Machine Qty*</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g., 5" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="numberOfAmendments"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Number of Amendments</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g., 0" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />L/C Status*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "Draft"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select L/C status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {lcStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
            control={form.control}
            name="itemDescriptions"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Item Descriptions</FormLabel>
                <FormControl>
                <Textarea placeholder="Describe the items being shipped." {...field} rows={4} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="partialShipments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>43P: Partial Shipments Rule</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Allowed / Not Allowed" {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormDescription>As per L/C document clause 43P.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="portOfLoading"
            render={({ field }) => (
              <FormItem>
                <FormLabel>44E: Port of Loading</FormLabel>
                <FormControl>
                  <Input placeholder="Enter port name" {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="portOfDischarge"
            render={({ field }) => (
              <FormItem>
                <FormLabel>44F: Port of Discharge</FormLabel>
                <FormControl>
                  <Input placeholder="Enter port name" {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <Landmark className="mr-2 h-5 w-5 text-primary" />
          Consignee Bank Details
        </h3>
        <FormField
            control={form.control}
            name="consigneeBankNameAddress"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Consignee Bank Name and Address</FormLabel>
                <FormControl>
                <Textarea placeholder="Enter bank name and full address" {...field} rows={3} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="bankBin"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Bank BIN</FormLabel>
                <FormControl>
                <Input placeholder="Enter Bank Identification Number" {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />

        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <BellRing className="mr-2 h-5 w-5 text-primary" />
            Notify Details
        </h3>
        <FormField
            control={form.control}
            name="notifyPartyNameAndAddress"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Notify Party Name and Address</FormLabel>
                <FormControl>
                <Textarea placeholder="Enter notify party's full name and address" {...field} rows={3} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
         <FormField
            control={form.control}
            name="notifyPartyName" // This field maps to "Notify Party Contact Person:"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Notify Party Contact Person:</FormLabel>
                <FormControl>
                  <Input placeholder="Enter notify party's contact person name" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
              control={form.control}
              name="notifyPartyCell"
              render={({ field }) => (
              <FormItem>
                  <FormLabel>Notify Party Cell</FormLabel>
                  <FormControl>
                  <Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} value={field.value ?? ''}/>
                  </FormControl>
                  <FormMessage />
              </FormItem>
              )}
          />
          <FormField
              control={form.control}
              name="notifyPartyEmail"
              render={({ field }) => (
              <FormItem>
                  <FormLabel>Notify Party Email</FormLabel>
                  <FormControl>
                  <Input type="email" placeholder="notify@example.com" {...field} value={field.value ?? ''}/>
                  </FormControl>
                  <FormMessage />
              </FormItem>
              )}
          />
        </div>

        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <CalendarDays className="mr-2 h-5 w-5 text-primary" />
            Important Dates & Partial Shipment Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
                control={form.control}
                name="lcIssueDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>L/C Issue Date*</FormLabel>
                    <DatePickerField field={field} placeholder="Select L/C issue date" />
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="expireDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Expire Date*</FormLabel>
                    <DatePickerField field={field} placeholder="Select expire date" />
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="latestShipmentDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Latest Shipment Date*</FormLabel>
                    <DatePickerField field={field} placeholder="Select latest shipment date" />
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        <Separator className="my-6" />

        <FormField
          control={form.control}
          name="partialShipmentAllowed"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Partial Shipment Allowed*</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "No"}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {partialShipmentAllowedOptions.map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {watchedPartialShipmentAllowed === "Yes" && (
          <div className="space-y-6 rounded-md border p-4 mt-4">
            <h4 className="text-md font-medium text-foreground flex items-center mb-4">
              <Package className="mr-2 h-5 w-5 text-muted-foreground" />
              Partial Shipment Breakdown
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              <FormField
                control={form.control}
                name="firstPartialQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>1st Partial Qty</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 10" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondPartialQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>2nd Partial Qty</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 15" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="thirdPartialQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>3rd Partial Qty</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 5" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="firstPartialAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>1st Partial Amount ({form.getValues("currency") || 'Currency'})</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 10000.00" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondPartialAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>2nd Partial Amount ({form.getValues("currency") || 'Currency'})</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 15000.00" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="thirdPartialAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>3rd Partial Amount ({form.getValues("currency") || 'Currency'})</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 5000.00" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <FormItem>
                <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4 text-muted-foreground"/>Total Calculated Partial Qty</FormLabel>
                <FormControl>
                  <Input type="text" value={totalCalculatedPartialQty} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                </FormControl>
              </FormItem>
              <FormItem>
                <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground"/>Total Calculated Partial Amount ({form.getValues("currency") || 'Currency'})</FormLabel>
                <FormControl>
                  <Input type="text" value={totalCalculatedPartialAmount} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                </FormControl>
              </FormItem>
            </div>
             <FormDescription>
                Note: The 'Total L/C Machine Qty' and L/C 'Amount' fields above represent the overall L/C values. The totals here are sums of the partials entered.
            </FormDescription>
          </div>
        )}

        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <Workflow className="mr-2 h-5 w-5 text-primary" />
            Shipping Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <FormField
                control={form.control}
                name="shipmentMode"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Shipment Mode*</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select shipment mode" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {shipmentModeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option === 'Sea' && <Ship className="mr-2 h-4 w-4 inline-block" />}
                                {option === 'Air' && <Plane className="mr-2 h-4 w-4 inline-block" />}
                                {option}
                            </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="vesselOrFlightName"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>{viaLabel}</FormLabel>
                    <FormControl>
                    <Input
                        placeholder={watchedShipmentMode ? `Enter ${watchedShipmentMode === "Sea" ? "Vessel" : "Flight"} name` : "Enter name"}
                        {...field}
                        disabled={!watchedShipmentMode}
                        value={field.value ?? ''}
                    />
                    </FormControl>
                    {!watchedShipmentMode && <FormDescription>Select shipment mode first.</FormDescription>}
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        {watchedShipmentMode === 'Sea' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end mt-4">
                <FormField
                    control={form.control}
                    name="vesselImoNumber"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Vessel IMO Number</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter Vessel IMO Number" {...field} value={field.value ?? ''}/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="button"
                    variant="default"
                    onClick={handleTrackVessel}
                    disabled={!form.watch("vesselImoNumber") || isSubmitting}
                    className="md:col-span-1"
                    title="Track Vessel via IMO Number"
                >
                    <Search className="mr-2 h-4 w-4" />
                    Track Vessel
                </Button>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
          <FormField
            control={form.control}
            name="totalPackageQty"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Box className="mr-2 h-4 w-4 text-muted-foreground" />Total Package Qty</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g., 100" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalNetWeight"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Weight className="mr-2 h-4 w-4 text-muted-foreground" />Total Net Weight (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="e.g., 1200.50" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalGrossWeight"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Scale className="mr-2 h-4 w-4 text-muted-foreground" />Total Gross Weight (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="e.g., 1250.75" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalCbm"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Box className="mr-2 h-4 w-4 text-muted-foreground" />Total CBM</FormLabel>
                <FormControl>
                  <Input type="number" step="0.001" placeholder="e.g., 15.345" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

         <div className="mt-6">
            <FormLabel className="text-base font-bold text-foreground flex items-center mb-2">
                <PackageCheck className="mr-2 h-5 w-5 text-muted-foreground" /> Original Document Tracking
            </FormLabel>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end">
                <FormField
                    control={form.control}
                    name="trackingCourier"
                    render={({ field }) => (
                    <FormItem className="md:col-span-1">
                        <FormLabel>Courier</FormLabel>
                        <Select
                            onValueChange={(value) => field.onChange(value === NONE_COURIER_VALUE ? "" : value)}
                            value={field.value === "" || field.value === undefined || field.value === null ? NONE_COURIER_VALUE : field.value}
                        >
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select Courier" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                             <SelectItem value={NONE_COURIER_VALUE}>None</SelectItem>
                            {trackingCourierOptions.map(courier => (
                                <SelectItem key={courier} value={courier}>{courier}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="trackingNumber"
                    render={({ field }) => (
                    <FormItem className="md:col-span-1">
                        <FormLabel>Tracking Number</FormLabel>
                        <FormControl>
                        <Input placeholder="Enter tracking number" {...field} disabled={!form.watch("trackingCourier")} value={field.value ?? ''}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button
                    type="button"
                    variant="default"
                    onClick={handleTrackDocument}
                    disabled={!form.watch("trackingNumber") || !form.watch("trackingCourier") || isSubmitting}
                    className="md:col-span-1 mt-4 md:mt-0"
                    title="Track Original Document"
                >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Track
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
             <FormField
                control={form.control}
                name="etd"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>ETD (Estimated Time of Departure)</FormLabel>
                     <DatePickerField field={field} placeholder="Select ETD" />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eta"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>ETA (Estimated Time of Arrival)</FormLabel>
                    <DatePickerField field={field} placeholder="Select ETA" />
                    <FormMessage />
                  </FormItem>
                )}
              />
        </div>

        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <FileSignature className="mr-2 h-5 w-5 text-primary" />
            46A: Documents Required
        </h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="originalBlQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Original BL Qty</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 3" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="copyBlQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Copy BL Qty</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 3" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="originalCooQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Original COO Qty</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 1" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="copyCooQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Copy COO Qty</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 2" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoiceQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Invoice Qty</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 3" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="packingListQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Packing List Qty</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 2" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="beneficiaryCertificateQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Beneficiary Certificate Qty</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 1" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brandNewCertificateQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Brand New Certificate Qty</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 1" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="beneficiaryWarrantyCertificateQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Beneficiary's Warranty Certificate Qty</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 1" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="beneficiaryComplianceCertificateQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Beneficiary's Compliance Certificate Qty</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 1" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          <FormField
            control={form.control}
            name="shipmentAdviceQty"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Shipment Advice Qty</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g., 1" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="certificateOfOrigin"
          render={() => (
            <FormItem>
              <FormLabel className="text-base font-bold text-foreground flex items-center mb-2">
                 <PackageCheck className="mr-2 h-5 w-5 text-muted-foreground" /> Certificate of Origin (Country)
              </FormLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-3 p-4 border rounded-md shadow-sm">
                {certificateOfOriginCountries.map((country) => (
                  <FormField
                    key={country}
                    control={form.control}
                    name="certificateOfOrigin"
                    render={({ field }) => {
                      return (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(country)}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                return checked
                                  ? field.onChange([...currentValue, country])
                                  : field.onChange(
                                      currentValue.filter(
                                        (value) => value !== country
                                      )
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal text-foreground hover:cursor-pointer">
                            {country}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <Edit3 className="mr-2 h-5 w-5 text-primary" />
            47A: Additional Conditions
        </h3>
        <FormField
            control={form.control}
            name="shippingMarks"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Shipping Marks</FormLabel>
                <FormControl>
                <Textarea placeholder="Enter shipping marks as specified in additional conditions" {...field} rows={3} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />


        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <UploadCloud className="mr-2 h-5 w-5 text-primary" /> Document URLs
        </h3>
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="purchaseOrderUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Purchase Order URL</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl className="flex-grow">
                    <Input type="url" placeholder="https://example.com/purchase-order.pdf" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    onClick={() => handleViewUrl(field.value)}
                    disabled={!field.value}
                    title="View Purchase Order"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="finalPIUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Final PI URL</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl className="flex-grow">
                    <Input type="url" placeholder="https://example.com/pi.pdf" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    onClick={() => handleViewUrl(field.value)}
                    disabled={!field.value}
                    title="View Final PI"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shippingDocumentsUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Shipping Documents URL</FormLabel>
                 <div className="flex items-center gap-2">
                    <FormControl className="flex-grow">
                        <Input type="url" placeholder="https://example.com/shipping-docs.pdf" {...field} value={field.value ?? ""} />
                    </FormControl>
                     <Button
                        type="button"
                        variant="default"
                        size="icon"
                        onClick={() => handleViewUrl(field.value)}
                        disabled={!field.value}
                        title="View Shipping Documents"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="finalLcUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Final LC URL</FormLabel>
                 <div className="flex items-center gap-2">
                    <FormControl className="flex-grow">
                        <Input type="url" placeholder="https://example.com/final-lc.pdf" {...field} value={field.value ?? ""} />
                    </FormControl>
                     <Button
                        type="button"
                        variant="default"
                        size="icon"
                        onClick={() => handleViewUrl(field.value)}
                        disabled={!field.value}
                        title="View Final LC"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingApplicants || isLoadingBeneficiaries}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Submit L/C Entry
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

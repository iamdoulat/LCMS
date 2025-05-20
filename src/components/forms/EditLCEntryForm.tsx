
"use client";

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntryDocument, Currency, TrackingCourier, LCStatus, ShipmentMode, PartialShipmentAllowed, CertificateOfOriginCountry, TermsOfPay, ApplicantOption, LcOption } from '@/types';
import { termsOfPayOptions, shipmentModeOptions, currencyOptions, trackingCourierOptions, lcStatusOptions, partialShipmentAllowedOptions, certificateOfOriginCountries } from '@/types';
import Swal from 'sweetalert2';
import { isValid, parseISO, format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, collection, getDocs, deleteField } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, Landmark, FileText, CalendarDays, Ship, Plane, Workflow, Layers, FileSignature, Edit3, BellRing, Users, Building, Hash, ExternalLink, PackageCheck, Search, Save, CheckSquare, UploadCloud, DollarSign, Package, FileIcon, Box, Weight, Scale, Link as LinkIcon, Plus, Minus } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
const NONE_LC_VALUE = "__NONE_LC_PI_EDIT__"; // Not used in this form, but kept for consistency if PI forms were merged


const lcEntrySchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required"),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required"),
  currency: z.enum(currencyOptions, { required_error: "Currency is required" }),
  amount: z.preprocess(
    toNumberOrUndefined,
    z.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive").optional()
  ),
  termsOfPay: z.enum(termsOfPayOptions, { required_error: "Terms of pay are required" }),
  status: z.enum(lcStatusOptions, { required_error: "L/C Status is required" }),
  shipmentMode: z.enum(shipmentModeOptions, { required_error: "Shipment mode is required" }),
  trackingCourier: z.enum(["", ...trackingCourierOptions]).optional(),
  partialShipmentAllowed: z.enum(partialShipmentAllowedOptions, { required_error: "Please specify if partial shipment is allowed" }),
  documentaryCreditNumber: z.string().min(1, "Documentary Credit Number is required"),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional().nullable(),
  totalMachineQty: z.preprocess(
    toNumberOrUndefined,
    z.number({ invalid_type_error: "Quantity must be a number" }).int().positive("Quantity must be positive").optional()
  ),
  numberOfAmendments: z.preprocess(
    toNumberOrUndefined,
    z.number({ invalid_type_error: "Number of amendments must be a number" }).int().nonnegative("Number of amendments cannot be negative").optional()
  ),
  itemDescriptions: z.string().optional(),
  consigneeBankNameAddress: z.string().optional(),
  vesselOrFlightName: z.string().optional(),
  vesselImoNumber: z.string().optional(),
  flightNumber: z.string().optional(),
  trackingNumber: z.string().optional(),
  etd: z.date().optional().nullable(),
  eta: z.date().optional().nullable(),
  partialShipments: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  shippingMarks: z.string().optional(),
  certificateOfOrigin: z.array(z.enum(certificateOfOriginCountries)).optional(),
  notifyPartyNameAndAddress: z.string().optional(),
  notifyPartyName: z.string().optional(),
  notifyPartyCell: z.string().optional(),
  notifyPartyEmail: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')),
  lcIssueDate: z.date({ required_error: "L/C issue date is required" }),
  expireDate: z.date({ required_error: "Expire date is required" }),
  latestShipmentDate: z.date({ required_error: "Latest shipment date is required" }),
  firstPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  secondPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  thirdPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  firstPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional()),
  secondPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional()),
  thirdPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional()),
  firstPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional()),
  firstPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional()),
  firstPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional()),
  firstPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional()),
  secondPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional()),
  secondPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional()),
  secondPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional()),
  secondPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional()),
  thirdPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional()),
  thirdPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional()),
  thirdPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional()),
  thirdPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional()),
  totalPackageQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Package quantity cannot be negative").optional()),
  totalNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net weight cannot be negative").optional()),
  totalGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross weight cannot be negative").optional()),
  totalCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional()),
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
  billOfExchangeQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional()),
  purchaseOrderUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  finalPIUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  finalLcUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  shippingDocumentsUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
});

type LCEditFormValues = z.infer<typeof lcEntrySchema>;

interface EditLCEntryFormProps {
  initialData: LCEntryDocument;
  lcId: string;
}

const sectionHeadingClass = "font-bold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-4 flex items-center";

const defaultFormValues: LCEditFormValues = {
  applicantId: '',
  beneficiaryId: '',
  currency: currencyOptions[0],
  amount: undefined,
  termsOfPay: termsOfPayOptions[0],
  documentaryCreditNumber: '',
  proformaInvoiceNumber: '',
  invoiceDate: undefined,
  totalMachineQty: undefined,
  numberOfAmendments: undefined,
  status: lcStatusOptions[0],
  itemDescriptions: '',
  partialShipments: '',
  portOfLoading: '',
  portOfDischarge: '',
  consigneeBankNameAddress: '',
  notifyPartyNameAndAddress: '',
  notifyPartyName: '',
  notifyPartyCell: '',
  notifyPartyEmail: '',
  lcIssueDate: new Date(),
  expireDate: new Date(),
  latestShipmentDate: new Date(),
  partialShipmentAllowed: partialShipmentAllowedOptions[1], // Default to "No"
  firstPartialQty: 0,
  secondPartialQty: 0,
  thirdPartialQty: 0,
  firstPartialAmount: 0,
  secondPartialAmount: 0,
  thirdPartialAmount: 0,
  firstPartialPkgs: 0,
  secondPartialPkgs: 0,
  thirdPartialPkgs: 0,
  firstPartialNetWeight: 0,
  secondPartialNetWeight: 0,
  thirdPartialNetWeight: 0,
  firstPartialGrossWeight: 0,
  secondPartialGrossWeight: 0,
  thirdPartialGrossWeight: 0,
  firstPartialCbm: 0,
  secondPartialCbm: 0,
  thirdPartialCbm: 0,
  totalPackageQty: 0,
  totalNetWeight: 0,
  totalGrossWeight: 0,
  totalCbm: 0,
  shipmentMode: shipmentModeOptions[0],
  vesselOrFlightName: '',
  vesselImoNumber: '',
  flightNumber: '',
  trackingCourier: '',
  trackingNumber: '',
  etd: undefined,
  eta: undefined,
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
  billOfExchangeQty: 0,
  certificateOfOrigin: [],
  shippingMarks: '',
  purchaseOrderUrl: '',
  finalPIUrl: '',
  finalLcUrl: '',
  shippingDocumentsUrl: '',
};

// Helper to get a valid option or a default
const getValidOption = <T extends string>(
  valueFromInitialData: T | undefined | null,
  optionsArray: readonly T[],
  fallbackDefault: T
): T => {
  const trimmedValue = typeof valueFromInitialData === 'string' ? valueFromInitialData.trim() as T : valueFromInitialData;
  if (trimmedValue && optionsArray.includes(trimmedValue)) {
    return trimmedValue;
  }
  return fallbackDefault;
};


export function EditLCEntryForm({ initialData, lcId }: EditLCEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ApplicantOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [lcOptions, setLcOptions] = React.useState<LcOption[]>([]); // For PI connection, not directly used here
  const [isLoadingApplicants, setIsLoadingApplicants] = React.useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = React.useState(true);
  const [isLoadingLcOptions, setIsLoadingLcOptions] = React.useState(true); // For PI connection

  const [totalCalculatedPartialQty, setTotalCalculatedPartialQty] = React.useState<number>(0);
  const [totalCalculatedPartialAmount, setTotalCalculatedPartialAmount] = React.useState<number>(0);
  const [activeSection46A, setActiveSection46A] = React.useState<string | undefined>(undefined);

  const form = useForm<LCEditFormValues>({
    resolver: zodResolver(lcEntrySchema),
    defaultValues: defaultFormValues,
  });

  const { control, setValue, watch, getValues, reset } = form;
  const prevPartialShipmentAllowedRef = React.useRef<PartialShipmentAllowed | undefined>();

  React.useEffect(() => {
    const fetchDropdownData = async () => {
      setIsLoadingApplicants(true);
      setIsLoadingBeneficiaries(true);
      // setIsLoadingLcOptions(true); // Not needed directly for L/C edit form unless connecting to another LC
      try {
        const customersSnapshot = await getDocs(collection(firestore, "customers"));
        const fetchedApplicants = customersSnapshot.docs.map(doc => {
          const data = doc.data() as any;
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

        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        const fetchedBeneficiaries = suppliersSnapshot.docs.map(doc => {
          const data = doc.data() as any;
          return { value: doc.id, label: data.beneficiaryName || 'Unnamed Beneficiary' };
        });
        setBeneficiaryOptions(fetchedBeneficiaries);

      } catch (error) {
        console.error("EditLCEntryForm: Error fetching dropdown data: ", error);
        Swal.fire("Error", "Could not fetch applicant/beneficiary data. See console.", "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
        // setIsLoadingLcOptions(false);
      }
    };
    fetchDropdownData();
  }, []);

  React.useEffect(() => {
    if (initialData && !isLoadingApplicants && !isLoadingBeneficiaries) {
      console.log("EditLCEntryForm: Initial L/C Data for Form:", initialData);
      const valuesToSet: LCEditFormValues = {
        applicantId: getValidOption(initialData.applicantId, applicantOptions.map(o => o.value), defaultFormValues.applicantId),
        beneficiaryId: getValidOption(initialData.beneficiaryId, beneficiaryOptions.map(o => o.value), defaultFormValues.beneficiaryId),
        currency: getValidOption(initialData.currency, currencyOptions, defaultFormValues.currency),
        amount: initialData.amount ?? defaultFormValues.amount,
        termsOfPay: getValidOption(initialData.termsOfPay, termsOfPayOptions, defaultFormValues.termsOfPay),
        documentaryCreditNumber: initialData.documentaryCreditNumber || defaultFormValues.documentaryCreditNumber!,
        proformaInvoiceNumber: initialData.proformaInvoiceNumber || defaultFormValues.proformaInvoiceNumber,
        invoiceDate: initialData.invoiceDate && isValid(parseISO(initialData.invoiceDate)) ? parseISO(initialData.invoiceDate) : defaultFormValues.invoiceDate,
        totalMachineQty: initialData.totalMachineQty ?? defaultFormValues.totalMachineQty,
        numberOfAmendments: initialData.numberOfAmendments ?? defaultFormValues.numberOfAmendments,
        status: getValidOption(initialData.status, lcStatusOptions, defaultFormValues.status),
        itemDescriptions: initialData.itemDescriptions || defaultFormValues.itemDescriptions,
        partialShipments: initialData.partialShipments || defaultFormValues.partialShipments,
        portOfLoading: initialData.portOfLoading || defaultFormValues.portOfLoading,
        portOfDischarge: initialData.portOfDischarge || defaultFormValues.portOfDischarge,
        consigneeBankNameAddress: initialData.consigneeBankNameAddress || defaultFormValues.consigneeBankNameAddress,
        notifyPartyNameAndAddress: initialData.notifyPartyNameAndAddress || defaultFormValues.notifyPartyNameAndAddress,
        notifyPartyName: initialData.notifyPartyName || defaultFormValues.notifyPartyName,
        notifyPartyCell: initialData.notifyPartyCell || defaultFormValues.notifyPartyCell,
        notifyPartyEmail: initialData.notifyPartyEmail || defaultFormValues.notifyPartyEmail,
        lcIssueDate: initialData.lcIssueDate && isValid(parseISO(initialData.lcIssueDate)) ? parseISO(initialData.lcIssueDate) : defaultFormValues.lcIssueDate!,
        expireDate: initialData.expireDate && isValid(parseISO(initialData.expireDate)) ? parseISO(initialData.expireDate) : defaultFormValues.expireDate!,
        latestShipmentDate: initialData.latestShipmentDate && isValid(parseISO(initialData.latestShipmentDate)) ? parseISO(initialData.latestShipmentDate) : defaultFormValues.latestShipmentDate!,
        partialShipmentAllowed: getValidOption(initialData.partialShipmentAllowed, partialShipmentAllowedOptions, defaultFormValues.partialShipmentAllowed),
        firstPartialQty: initialData.firstPartialQty ?? defaultFormValues.firstPartialQty,
        secondPartialQty: initialData.secondPartialQty ?? defaultFormValues.secondPartialQty,
        thirdPartialQty: initialData.thirdPartialQty ?? defaultFormValues.thirdPartialQty,
        firstPartialAmount: initialData.firstPartialAmount ?? defaultFormValues.firstPartialAmount,
        secondPartialAmount: initialData.secondPartialAmount ?? defaultFormValues.secondPartialAmount,
        thirdPartialAmount: initialData.thirdPartialAmount ?? defaultFormValues.thirdPartialAmount,
        firstPartialPkgs: initialData.firstPartialPkgs ?? defaultFormValues.firstPartialPkgs,
        secondPartialPkgs: initialData.secondPartialPkgs ?? defaultFormValues.secondPartialPkgs,
        thirdPartialPkgs: initialData.thirdPartialPkgs ?? defaultFormValues.thirdPartialPkgs,
        firstPartialNetWeight: initialData.firstPartialNetWeight ?? defaultFormValues.firstPartialNetWeight,
        secondPartialNetWeight: initialData.secondPartialNetWeight ?? defaultFormValues.secondPartialNetWeight,
        thirdPartialNetWeight: initialData.thirdPartialNetWeight ?? defaultFormValues.thirdPartialNetWeight,
        firstPartialGrossWeight: initialData.firstPartialGrossWeight ?? defaultFormValues.firstPartialGrossWeight,
        secondPartialGrossWeight: initialData.secondPartialGrossWeight ?? defaultFormValues.secondPartialGrossWeight,
        thirdPartialGrossWeight: initialData.thirdPartialGrossWeight ?? defaultFormValues.thirdPartialGrossWeight,
        firstPartialCbm: initialData.firstPartialCbm ?? defaultFormValues.firstPartialCbm,
        secondPartialCbm: initialData.secondPartialCbm ?? defaultFormValues.secondPartialCbm,
        thirdPartialCbm: initialData.thirdPartialCbm ?? defaultFormValues.thirdPartialCbm,
        totalPackageQty: initialData.totalPackageQty ?? defaultFormValues.totalPackageQty,
        totalNetWeight: initialData.totalNetWeight ?? defaultFormValues.totalNetWeight,
        totalGrossWeight: initialData.totalGrossWeight ?? defaultFormValues.totalGrossWeight,
        totalCbm: initialData.totalCbm ?? defaultFormValues.totalCbm,
        shipmentMode: getValidOption(initialData.shipmentMode, shipmentModeOptions, defaultFormValues.shipmentMode),
        vesselOrFlightName: initialData.vesselOrFlightName || defaultFormValues.vesselOrFlightName,
        vesselImoNumber: initialData.vesselImoNumber || defaultFormValues.vesselImoNumber,
        flightNumber: initialData.flightNumber || defaultFormValues.flightNumber,
        trackingCourier: initialData.trackingCourier || defaultFormValues.trackingCourier,
        trackingNumber: initialData.trackingNumber || defaultFormValues.trackingNumber,
        etd: initialData.etd && isValid(parseISO(initialData.etd)) ? parseISO(initialData.etd) : defaultFormValues.etd,
        eta: initialData.eta && isValid(parseISO(initialData.eta)) ? parseISO(initialData.eta) : defaultFormValues.eta,
        originalBlQty: initialData.originalBlQty ?? defaultFormValues.originalBlQty,
        copyBlQty: initialData.copyBlQty ?? defaultFormValues.copyBlQty,
        originalCooQty: initialData.originalCooQty ?? defaultFormValues.originalCooQty,
        copyCooQty: initialData.copyCooQty ?? defaultFormValues.copyCooQty,
        invoiceQty: initialData.invoiceQty ?? defaultFormValues.invoiceQty,
        packingListQty: initialData.packingListQty ?? defaultFormValues.packingListQty,
        beneficiaryCertificateQty: initialData.beneficiaryCertificateQty ?? defaultFormValues.beneficiaryCertificateQty,
        brandNewCertificateQty: initialData.brandNewCertificateQty ?? defaultFormValues.brandNewCertificateQty,
        beneficiaryWarrantyCertificateQty: initialData.beneficiaryWarrantyCertificateQty ?? defaultFormValues.beneficiaryWarrantyCertificateQty,
        beneficiaryComplianceCertificateQty: initialData.beneficiaryComplianceCertificateQty ?? defaultFormValues.beneficiaryComplianceCertificateQty,
        shipmentAdviceQty: initialData.shipmentAdviceQty ?? defaultFormValues.shipmentAdviceQty,
        billOfExchangeQty: initialData.billOfExchangeQty ?? defaultFormValues.billOfExchangeQty,
        certificateOfOrigin: initialData.certificateOfOrigin || defaultFormValues.certificateOfOrigin!,
        shippingMarks: initialData.shippingMarks || defaultFormValues.shippingMarks,
        purchaseOrderUrl: initialData.purchaseOrderUrl || defaultFormValues.purchaseOrderUrl,
        finalPIUrl: initialData.finalPIUrl || defaultFormValues.finalPIUrl,
        finalLcUrl: initialData.finalLcUrl || defaultFormValues.finalLcUrl,
        shippingDocumentsUrl: initialData.shippingDocumentsUrl || defaultFormValues.shippingDocumentsUrl,
      };
      reset(valuesToSet);
      console.log("EditLCEntryForm: Form reset complete.");
      console.log("EditLCEntryForm: Setting Applicant ID in form to:", valuesToSet.applicantId);
      console.log("EditLCEntryForm: Setting Beneficiary ID in form to:", valuesToSet.beneficiaryId);
    }
  }, [initialData, reset, isLoadingApplicants, isLoadingBeneficiaries, applicantOptions, beneficiaryOptions]);


  const watchedApplicantId = watch("applicantId");
  React.useEffect(() => {
    console.log("EditLCEntryForm: Auto-populate effect triggered. Watched Applicant ID:", watchedApplicantId);
    if (watchedApplicantId && applicantOptions.length > 0) {
      const selectedApplicant = applicantOptions.find(opt => opt.value === watchedApplicantId);
      console.log("EditLCEntryForm: Applicant Options for check:", applicantOptions);
      console.log("EditLCEntryForm: Selected Applicant for auto-fill:", selectedApplicant);
      if (selectedApplicant) {
        setValue("notifyPartyNameAndAddress", selectedApplicant.address || '', { shouldDirty: true, shouldValidate: true });
        setValue("notifyPartyName", selectedApplicant.contactPersonName || '', { shouldDirty: true, shouldValidate: true });
        setValue("notifyPartyCell", selectedApplicant.phone || '', { shouldDirty: true, shouldValidate: true });
        setValue("notifyPartyEmail", selectedApplicant.email || '', { shouldDirty: true, shouldValidate: true });
      }
    }
  }, [watchedApplicantId, applicantOptions, setValue]);


  const watchedShipmentMode = watch("shipmentMode");
  const watchedCurrency = watch("currency");
  const watchedPartialShipmentAllowed = watch("partialShipmentAllowed");

  const partialFieldsToWatch = [
    "firstPartialQty", "secondPartialQty", "thirdPartialQty",
    "firstPartialAmount", "secondPartialAmount", "thirdPartialAmount",
    "firstPartialPkgs", "secondPartialPkgs", "thirdPartialPkgs",
    "firstPartialNetWeight", "secondPartialNetWeight", "thirdPartialNetWeight",
    "firstPartialGrossWeight", "secondPartialGrossWeight", "thirdPartialGrossWeight",
    "firstPartialCbm", "secondPartialCbm", "thirdPartialCbm"
  ] as const;
  const watchedPartialValues = watch(partialFieldsToWatch);

  React.useEffect(() => {
    if (watchedPartialShipmentAllowed === "Yes" && watchedPartialShipmentAllowed !== prevPartialShipmentAllowedRef.current) {
      const fieldsToInitializeZero = [
        "firstPartialQty", "secondPartialQty", "thirdPartialQty",
        "firstPartialAmount", "secondPartialAmount", "thirdPartialAmount",
        "firstPartialPkgs", "secondPartialPkgs", "thirdPartialPkgs",
        "firstPartialNetWeight", "secondPartialNetWeight", "thirdPartialNetWeight",
        "firstPartialGrossWeight", "secondPartialGrossWeight", "thirdPartialGrossWeight",
        "firstPartialCbm", "secondPartialCbm", "thirdPartialCbm",
        "originalBlQty", "copyBlQty", "originalCooQty", "copyCooQty",
        "invoiceQty", "packingListQty", "beneficiaryCertificateQty", "brandNewCertificateQty",
        "beneficiaryWarrantyCertificateQty", "beneficiaryComplianceCertificateQty", "shipmentAdviceQty", "billOfExchangeQty"
      ] as const;

      fieldsToInitializeZero.forEach(fieldName => {
        const currentValue = getValues(fieldName);
        if (currentValue === undefined || String(currentValue).trim() === '') {
          setValue(fieldName, 0 as any, { shouldValidate: true, shouldDirty: true });
        }
      });
    }
    prevPartialShipmentAllowedRef.current = watchedPartialShipmentAllowed;
  }, [watchedPartialShipmentAllowed, setValue, getValues]);


  React.useEffect(() => {
    const firstQty = Number(getValues("firstPartialQty") || 0);
    const secondQty = Number(getValues("secondPartialQty") || 0);
    const thirdQty = Number(getValues("thirdPartialQty") || 0);
    const firstAmount = Number(getValues("firstPartialAmount") || 0);
    const secondAmount = Number(getValues("secondPartialAmount") || 0);
    const thirdAmount = Number(getValues("thirdPartialAmount") || 0);

    setTotalCalculatedPartialQty(firstQty + secondQty + thirdQty);
    setTotalCalculatedPartialAmount(firstAmount + secondAmount + thirdAmount);

    if (watchedPartialShipmentAllowed === "Yes") {
      const firstPartialPkgs = Number(getValues("firstPartialPkgs") || 0);
      const secondPartialPkgs = Number(getValues("secondPartialPkgs") || 0);
      const thirdPartialPkgs = Number(getValues("thirdPartialPkgs") || 0);
      const newTotalPkgs = firstPartialPkgs + secondPartialPkgs + thirdPartialPkgs;
      if (Number(getValues("totalPackageQty") || 0) !== newTotalPkgs) {
        setValue("totalPackageQty", newTotalPkgs, { shouldValidate: true, shouldDirty: true });
      }

      const firstPartialNetWeight = Number(getValues("firstPartialNetWeight") || 0);
      const secondPartialNetWeight = Number(getValues("secondPartialNetWeight") || 0);
      const thirdPartialNetWeight = Number(getValues("thirdPartialNetWeight") || 0);
      const newTotalNetWeight = firstPartialNetWeight + secondPartialNetWeight + thirdPartialNetWeight;
      if (Number(getValues("totalNetWeight") || 0) !== newTotalNetWeight) {
        setValue("totalNetWeight", newTotalNetWeight, { shouldValidate: true, shouldDirty: true });
      }

      const firstPartialGrossWeight = Number(getValues("firstPartialGrossWeight") || 0);
      const secondPartialGrossWeight = Number(getValues("secondPartialGrossWeight") || 0);
      const thirdPartialGrossWeight = Number(getValues("thirdPartialGrossWeight") || 0);
      const newTotalGrossWeight = firstPartialGrossWeight + secondPartialGrossWeight + thirdPartialGrossWeight;
      if (Number(getValues("totalGrossWeight") || 0) !== newTotalGrossWeight) {
        setValue("totalGrossWeight", newTotalGrossWeight, { shouldValidate: true, shouldDirty: true });
      }

      const firstPartialCbm = Number(getValues("firstPartialCbm") || 0);
      const secondPartialCbm = Number(getValues("secondPartialCbm") || 0);
      const thirdPartialCbm = Number(getValues("thirdPartialCbm") || 0);
      const newTotalCbm = firstPartialCbm + secondPartialCbm + thirdPartialCbm;
      if (Number(getValues("totalCbm") || 0) !== newTotalCbm) {
        setValue("totalCbm", newTotalCbm, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [watchedPartialShipmentAllowed, ...watchedPartialValues, getValues, setValue]);


  async function onSubmit(data: LCEditFormValues) {
    setIsSubmitting(true);

    const finalData = { ...data }; // Use a mutable copy

    const selectedApp = applicantOptions.find(opt => opt.value === finalData.applicantId);
    const selectedBen = beneficiaryOptions.find(opt => opt.value === finalData.beneficiaryId);

    const dateToFirestore = (date?: Date | null): string | ReturnType<typeof deleteField> => {
      if (date === undefined || date === null) return deleteField();
      return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : deleteField();
    };

    const lcIssueDateFromForm = finalData.lcIssueDate ? new Date(finalData.lcIssueDate) : (initialData.lcIssueDate ? parseISO(initialData.lcIssueDate) : new Date());
    const extractedYear = lcIssueDateFromForm.getFullYear();

    const dataToUpdate: Partial<Omit<LCEntryDocument, 'id' | 'createdAt'>> = {
      applicantId: finalData.applicantId,
      applicantName: selectedApp ? selectedApp.label : initialData.applicantName,
      beneficiaryId: finalData.beneficiaryId,
      beneficiaryName: selectedBen ? selectedBen.label : initialData.beneficiaryName,
      currency: finalData.currency,
      amount: finalData.amount,
      termsOfPay: finalData.termsOfPay,
      status: finalData.status,
      shipmentMode: finalData.shipmentMode,
      trackingCourier: finalData.trackingCourier === "" || finalData.trackingCourier === NONE_COURIER_VALUE ? deleteField() : finalData.trackingCourier,
      documentaryCreditNumber: finalData.documentaryCreditNumber,
      proformaInvoiceNumber: finalData.proformaInvoiceNumber || deleteField(),
      invoiceDate: dateToFirestore(finalData.invoiceDate),
      totalMachineQty: finalData.totalMachineQty,
      lcIssueDate: dateToFirestore(finalData.lcIssueDate),
      expireDate: dateToFirestore(finalData.expireDate),
      latestShipmentDate: dateToFirestore(finalData.latestShipmentDate),
      purchaseOrderUrl: finalData.purchaseOrderUrl || deleteField(),
      finalPIUrl: finalData.finalPIUrl || deleteField(),
      shippingDocumentsUrl: finalData.shippingDocumentsUrl || deleteField(),
      finalLcUrl: finalData.finalLcUrl || deleteField(),
      trackingNumber: (finalData.trackingCourier === "" || finalData.trackingCourier === NONE_COURIER_VALUE || !finalData.trackingCourier) ? deleteField() : finalData.trackingNumber || deleteField(),
      etd: dateToFirestore(finalData.etd),
      eta: dateToFirestore(finalData.eta),
      itemDescriptions: finalData.itemDescriptions || deleteField(),
      consigneeBankNameAddress: finalData.consigneeBankNameAddress || deleteField(),
      vesselOrFlightName: finalData.vesselOrFlightName || deleteField(),
      vesselImoNumber: finalData.vesselImoNumber || deleteField(),
      flightNumber: finalData.flightNumber || deleteField(),
      partialShipments: finalData.partialShipments || deleteField(),
      portOfLoading: finalData.portOfLoading || deleteField(),
      portOfDischarge: finalData.portOfDischarge || deleteField(),
      shippingMarks: finalData.shippingMarks || deleteField(),
      certificateOfOrigin: finalData.certificateOfOrigin && finalData.certificateOfOrigin.length > 0 ? finalData.certificateOfOrigin : deleteField(),
      notifyPartyNameAndAddress: finalData.notifyPartyNameAndAddress || deleteField(),
      notifyPartyName: finalData.notifyPartyName || deleteField(),
      notifyPartyCell: finalData.notifyPartyCell || deleteField(),
      notifyPartyEmail: finalData.notifyPartyEmail || deleteField(),
      numberOfAmendments: finalData.numberOfAmendments,
      partialShipmentAllowed: finalData.partialShipmentAllowed,
      firstPartialQty: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialQty) ?? deleteField() : deleteField(),
      secondPartialQty: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialQty) ?? deleteField() : deleteField(),
      thirdPartialQty: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialQty) ?? deleteField() : deleteField(),
      firstPartialAmount: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialAmount) ?? deleteField() : deleteField(),
      secondPartialAmount: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialAmount) ?? deleteField() : deleteField(),
      thirdPartialAmount: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialAmount) ?? deleteField() : deleteField(),
      firstPartialPkgs: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialPkgs) ?? deleteField() : deleteField(),
      secondPartialPkgs: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialPkgs) ?? deleteField() : deleteField(),
      thirdPartialPkgs: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialPkgs) ?? deleteField() : deleteField(),
      firstPartialNetWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialNetWeight) ?? deleteField() : deleteField(),
      secondPartialNetWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialNetWeight) ?? deleteField() : deleteField(),
      thirdPartialNetWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialNetWeight) ?? deleteField() : deleteField(),
      firstPartialGrossWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialGrossWeight) ?? deleteField() : deleteField(),
      secondPartialGrossWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialGrossWeight) ?? deleteField() : deleteField(),
      thirdPartialGrossWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialGrossWeight) ?? deleteField() : deleteField(),
      firstPartialCbm: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialCbm) ?? deleteField() : deleteField(),
      secondPartialCbm: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialCbm) ?? deleteField() : deleteField(),
      thirdPartialCbm: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialCbm) ?? deleteField() : deleteField(),
      totalPackageQty: finalData.partialShipmentAllowed === "Yes"
        ? [finalData.firstPartialPkgs, finalData.secondPartialPkgs, finalData.thirdPartialPkgs].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(finalData.totalPackageQty) ?? deleteField(),
      totalNetWeight: finalData.partialShipmentAllowed === "Yes"
        ? [finalData.firstPartialNetWeight, finalData.secondPartialNetWeight, finalData.thirdPartialNetWeight].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(finalData.totalNetWeight) ?? deleteField(),
      totalGrossWeight: finalData.partialShipmentAllowed === "Yes"
        ? [finalData.firstPartialGrossWeight, finalData.secondPartialGrossWeight, finalData.thirdPartialGrossWeight].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(finalData.totalGrossWeight) ?? deleteField(),
      totalCbm: finalData.partialShipmentAllowed === "Yes"
        ? [finalData.firstPartialCbm, finalData.secondPartialCbm, finalData.thirdPartialCbm].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(finalData.totalCbm) ?? deleteField(),
      originalBlQty: toNumberOrUndefined(finalData.originalBlQty) ?? deleteField(),
      copyBlQty: toNumberOrUndefined(finalData.copyBlQty) ?? deleteField(),
      originalCooQty: toNumberOrUndefined(finalData.originalCooQty) ?? deleteField(),
      copyCooQty: toNumberOrUndefined(finalData.copyCooQty) ?? deleteField(),
      invoiceQty: toNumberOrUndefined(finalData.invoiceQty) ?? deleteField(),
      packingListQty: toNumberOrUndefined(finalData.packingListQty) ?? deleteField(),
      beneficiaryCertificateQty: toNumberOrUndefined(finalData.beneficiaryCertificateQty) ?? deleteField(),
      brandNewCertificateQty: toNumberOrUndefined(finalData.brandNewCertificateQty) ?? deleteField(),
      beneficiaryWarrantyCertificateQty: toNumberOrUndefined(finalData.beneficiaryWarrantyCertificateQty) ?? deleteField(),
      beneficiaryComplianceCertificateQty: toNumberOrUndefined(finalData.beneficiaryComplianceCertificateQty) ?? deleteField(),
      shipmentAdviceQty: toNumberOrUndefined(finalData.shipmentAdviceQty) ?? deleteField(),
      billOfExchangeQty: toNumberOrUndefined(finalData.billOfExchangeQty) ?? deleteField(),
      updatedAt: serverTimestamp(),
      year: extractedYear,
    };

    const cleanedDataToUpdate = Object.entries(dataToUpdate).reduce((acc, [key, value]) => {
      if (value !== undefined) {
         acc[key as keyof typeof acc] = value;
      }
      return acc;
    }, {} as Partial<Omit<LCEntryDocument, 'id' | 'createdAt'>> & {updatedAt: any});


    try {
      const lcDocRef = doc(firestore, "lc_entries", lcId);
      await updateDoc(lcDocRef, cleanedDataToUpdate);
      Swal.fire({
        title: "L/C Entry Updated!",
        text: `L/C entry (ID: ${lcId}) has been successfully updated.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (error: any)  {
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

  const handleTrackDocument = () => {
    const courier = getValues("trackingCourier");
    const number = getValues("trackingNumber");

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
      url = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number.trim())}`;
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
    const imoNumber = getValues("vesselImoNumber");
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
    return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading form options...</span></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {/* L/C & Invoice Details */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <FileText className="mr-2 h-5 w-5 text-primary" />
          L/C &amp; Invoice Details
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
                  selectPlaceholder={isLoadingBeneficiaries ? "Loading beneficiaries..." : "Select beneficiary"}
                  emptyStateMessage="No beneficiary found."
                  disabled={isLoadingBeneficiaries}
                />
                <FormDescription>Select from your list of suppliers/beneficiaries.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              control={control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency*</FormLabel>
                  <Select onValueChange={field.onChange} value={currencyOptions.includes(field.value as Currency) ? field.value : currencyOptions[0]}>
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
              control={control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{currencyOptions.includes(watchedCurrency as Currency) ? `${watchedCurrency} Amount*` : `${defaultFormValues.currency} Amount*`}</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 50000" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={control}
              name="termsOfPay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms of Pay*</FormLabel>
                   <Select onValueChange={field.onChange} value={termsOfPayOptions.includes(field.value as TermsOfPay) ? field.value : termsOfPayOptions[0]}>
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
              control={control}
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
              control={control}
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
              control={control}
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
              control={control}
              name="totalMachineQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total L/C Machine Qty*</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 5" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormDescription>Overall quantity for this L/C.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
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
              control={control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />L/C Status*</FormLabel>
                   <Select onValueChange={field.onChange} value={lcStatusOptions.includes(field.value as LCStatus) ? field.value : lcStatusOptions[0]}>
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
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={control}
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
            control={control}
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
            control={control}
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
         <FormField
            control={control}
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
        <Separator />

        {/* Important Dates & Partial Shipment Details */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <CalendarDays className="mr-2 h-5 w-5 text-primary" />
            Important Dates &amp; Partial Shipment Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
                control={control}
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
                control={control}
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
                control={control}
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
        <FormField
          control={control}
          name="partialShipmentAllowed"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Partial Shipment Allowed*</FormLabel>
               <Select onValueChange={field.onChange} value={partialShipmentAllowedOptions.includes(field.value as PartialShipmentAllowed) ? field.value : partialShipmentAllowedOptions[1]}>
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
          <Card className="p-4 mt-4 border-dashed">
            <CardHeader className="p-2 pb-4">
                <CardTitle className="text-md font-medium text-foreground flex items-center">
                    <Package className="mr-2 h-5 w-5 text-muted-foreground" />
                    Partial Shipment Breakdown
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
              <FormField control={control} name="firstPartialQty" render={({ field }) => (<FormItem><FormLabel>1st P. Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="firstPartialAmount" render={({ field }) => (<FormItem><FormLabel>1st P. Amt ({watch("currency")})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="firstPartialPkgs" render={({ field }) => (<FormItem><FormLabel>1st P. Pkgs</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="firstPartialNetWeight" render={({ field }) => (<FormItem><FormLabel>1st P. Net W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="firstPartialGrossWeight" render={({ field }) => (<FormItem><FormLabel>1st P. Gross W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="firstPartialCbm" render={({ field }) => (<FormItem><FormLabel>1st P. CBM</FormLabel><FormControl><Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
              <FormField control={control} name="secondPartialQty" render={({ field }) => (<FormItem><FormLabel>2nd P. Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="secondPartialAmount" render={({ field }) => (<FormItem><FormLabel>2nd P. Amt ({watch("currency")})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="secondPartialPkgs" render={({ field }) => (<FormItem><FormLabel>2nd P. Pkgs</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="secondPartialNetWeight" render={({ field }) => (<FormItem><FormLabel>2nd P. Net W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="secondPartialGrossWeight" render={({ field }) => (<FormItem><FormLabel>2nd P. Gross W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="secondPartialCbm" render={({ field }) => (<FormItem><FormLabel>2nd P. CBM</FormLabel><FormControl><Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-start">
              <FormField control={control} name="thirdPartialQty" render={({ field }) => (<FormItem><FormLabel>3rd P. Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="thirdPartialAmount" render={({ field }) => (<FormItem><FormLabel>3rd P. Amt ({watch("currency")})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="thirdPartialPkgs" render={({ field }) => (<FormItem><FormLabel>3rd P. Pkgs</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="thirdPartialNetWeight" render={({ field }) => (<FormItem><FormLabel>3rd P. Net W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="thirdPartialGrossWeight" render={({ field }) => (<FormItem><FormLabel>3rd P. Gross W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="thirdPartialCbm" render={({ field }) => (<FormItem><FormLabel>3rd P. CBM</FormLabel><FormControl><Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mt-4">
            <FormField
                control={control}
                name="totalPackageQty"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Box className="mr-2 h-4 w-4 text-muted-foreground" />Total Package Qty</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="0" {...field} value={field.value ?? ''} disabled={watchedPartialShipmentAllowed === 'Yes'} />
                    </FormControl>
                    <FormDescription className="text-xs">{watchedPartialShipmentAllowed === 'Yes' ? "Auto-calculated." : "Enter total."}</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name="totalNetWeight"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Weight className="mr-2 h-4 w-4 text-muted-foreground" />Total Net Weight (KGS)</FormLabel>
                    <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} disabled={watchedPartialShipmentAllowed === 'Yes'}/>
                    </FormControl>
                     <FormDescription className="text-xs">{watchedPartialShipmentAllowed === 'Yes' ? "Auto-calculated." : "Enter total."}</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name="totalGrossWeight"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Scale className="mr-2 h-4 w-4 text-muted-foreground" />Total Gross Weight (KGS)</FormLabel>
                    <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} disabled={watchedPartialShipmentAllowed === 'Yes'}/>
                    </FormControl>
                    <FormDescription className="text-xs">{watchedPartialShipmentAllowed === 'Yes' ? "Auto-calculated." : "Enter total."}</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name="totalCbm"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Box className="mr-2 h-4 w-4 text-muted-foreground" />Total CBM</FormLabel>
                    <FormControl>
                    <Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} disabled={watchedPartialShipmentAllowed === 'Yes'}/>
                    </FormControl>
                     <FormDescription className="text-xs">{watchedPartialShipmentAllowed === 'Yes' ? "Auto-calculated." : "Enter total."}</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            {watchedPartialShipmentAllowed === "Yes" && (
              <>
                <FormItem>
                    <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4 text-muted-foreground"/>Total Machine Qty</FormLabel>
                    <FormControl>
                    <Input type="text" value={totalCalculatedPartialQty} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" />
                    </FormControl>
                </FormItem>
                <FormItem>
                    <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground"/>Total Partial Amount ({watch("currency")})</FormLabel>
                    <FormControl>
                    <Input type="text" value={totalCalculatedPartialAmount.toFixed(2)} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" />
                    </FormControl>
                </FormItem>
              </>
            )}
        </div>
        <Separator />

        {/* Shipping Information */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <Workflow className="mr-2 h-5 w-5 text-primary" />
            Shipping Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <FormField
                control={control}
                name="shipmentMode"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Shipment Mode*</FormLabel>
                     <Select onValueChange={field.onChange} value={shipmentModeOptions.includes(field.value as ShipmentMode) ? field.value : shipmentModeOptions[0]}>
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
                control={control}
                name="vesselOrFlightName"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>{watchedShipmentMode === "Sea" ? "Vessel Name" : watchedShipmentMode === "Air" ? "Flight Name" : "Vessel/Flight Name"}</FormLabel>
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
                    control={control}
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
                    disabled={!watch("vesselImoNumber") || isSubmitting}
                    className="md:col-span-1"
                    title="Track Vessel via IMO Number"
                >
                    <Search className="mr-2 h-4 w-4" />
                    Track Vessel
                </Button>
            </div>
        )}
        {watchedShipmentMode === 'Air' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end mt-4">
            <FormField
              control={control}
              name="flightNumber"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Flight Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter Flight Number (e.g., EK582)" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="default"
              onClick={() => {
                const flightNum = getValues("flightNumber");
                if (flightNum && flightNum.trim() !== "") {
                  window.open(`https://www.flightradar24.com/${encodeURIComponent(flightNum.trim())}`, '_blank', 'noopener,noreferrer');
                } else {
                  Swal.fire("Info", "Please enter a flight number to track.", "info");
                }
              }}
              disabled={!watch("flightNumber") || isSubmitting}
              className="md:col-span-1"
              title="Track Flight on FlightRadar24"
            >
              <Search className="mr-2 h-4 w-4" />
              Track Flight
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
             <FormField
                control={control}
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
                control={control}
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
        <Separator />

        {/* Original Document Tracking */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <PackageCheck className="mr-2 h-5 w-5 text-primary" /> Original Document Tracking
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end">
            <FormField
                control={control}
                name="trackingCourier"
                render={({ field }) => (
                <FormItem className="md:col-span-1">
                    <FormLabel>Courier By</FormLabel>
                    <Select
                        onValueChange={(value) => field.onChange(value === NONE_COURIER_VALUE ? "" : value)}
                        value={field.value === "" ? NONE_COURIER_VALUE : field.value}
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
                control={control}
                name="trackingNumber"
                render={({ field }) => (
                <FormItem className="md:col-span-1">
                    <FormLabel>Tracking Number</FormLabel>
                    <FormControl>
                    <Input placeholder="Enter tracking number" {...field} disabled={!watch("trackingCourier") || watch("trackingCourier") === NONE_COURIER_VALUE} value={field.value ?? ''}/>
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <Button
                type="button"
                variant="default"
                onClick={handleTrackDocument}
                disabled={!watch("trackingNumber") || !watch("trackingCourier") || watch("trackingCourier") === NONE_COURIER_VALUE || isSubmitting}
                className="md:col-span-1 mt-4 md:mt-0"
                title="Track Original Document"
            >
                <ExternalLink className="mr-2 h-4 w-4" />
                Track
            </Button>
        </div>
        <Separator/>


        {/* Consignee Bank Details */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <Landmark className="mr-2 h-5 w-5 text-primary" />
          Consignee Bank Details
        </h3>
        <FormField
            control={control}
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
        <Separator />

        {/* Notify Details */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <BellRing className="mr-2 h-5 w-5 text-primary" />
            Notify Details
        </h3>
         <FormField
            control={control}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
              control={control}
              name="notifyPartyName"
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
          <FormField
              control={control}
              name="notifyPartyCell"
              render={({ field }) => (
              <FormItem>
                  <FormLabel>Notify Party Cell</FormLabel>
                  <FormControl>
                  <Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
              </FormItem>
              )}
          />
          <FormField
              control={control}
              name="notifyPartyEmail"
              render={({ field }) => (
              <FormItem>
                  <FormLabel>Notify Party Email</FormLabel>
                  <FormControl>
                  <Input type="email" placeholder="notify@example.com" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
              </FormItem>
              )}
          />
        </div>
        <Separator />

        {/* 46A: Documents Required */}
        <Accordion type="single" collapsible className="w-full" value={activeSection46A} onValueChange={setActiveSection46A}>
          <AccordionItem value="section46A" className="border-none">
            <AccordionTrigger className={cn("hover:no-underline py-3 font-bold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b mb-4 w-full")}>
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2">
                        <FileSignature className="mr-2 h-5 w-5 text-primary" />
                        46A: Documents Required
                    </div>
                    {activeSection46A === "section46A" ? <Minus className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField control={control} name="originalBlQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Original BL Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="copyBlQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Copy BL Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="originalCooQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Original COO Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="copyCooQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Copy COO Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="invoiceQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Invoice Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="packingListQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Packing List Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="beneficiaryCertificateQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Beneficiary Certificate Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="brandNewCertificateQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Brand New Certificate Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="beneficiaryWarrantyCertificateQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Beneficiary's Warranty Certificate Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="beneficiaryComplianceCertificateQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Beneficiary's Compliance Certificate Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField
                  control={control}
                  name="shipmentAdviceQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Shipment Advice Qty</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={control}
                  name="billOfExchangeQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Bill of Exchange Qty</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={control}
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
                          control={control}
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Separator />

        {/* 47A: Additional Conditions */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <Edit3 className="mr-2 h-5 w-5 text-primary" />
            47A: Additional Conditions
        </h3>
        <FormField
            control={control}
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
        <Separator />

        {/* Document URLs */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <UploadCloud className="mr-2 h-5 w-5 text-primary" /> Document URLs
        </h3>
        <div className="space-y-6">
         <FormField
            control={control}
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
            control={control}
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
            control={control}
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
          <FormField
            control={control}
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
        </div>
        <Separator />

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingApplicants || isLoadingBeneficiaries}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
               Save Changes
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

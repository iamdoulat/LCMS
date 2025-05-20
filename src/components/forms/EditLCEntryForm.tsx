
"use client";

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntryDocument, Currency, TrackingCourier, LCStatus, ShipmentMode, PartialShipmentAllowed, CertificateOfOriginCountry, TermsOfPay, ApplicantOption } from '@/types';
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
import { Loader2, Landmark, FileText, CalendarDays, Ship, Plane, Workflow, Layers, FileSignature, Edit3, BellRing, Users, Building, Hash, ExternalLink, PackageCheck, Search, Save, CheckSquare, UploadCloud, DollarSign, Package, FileIcon, Box, Weight, Scale, Link as LinkIcon, Minus, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
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


const lcEntrySchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required"),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required"),
  currency: z.enum(currencyOptions, { required_error: "Currency is required" }),
  amount: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive")
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
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Quantity must be a number" }).int().positive("Quantity must be positive")
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

const getValidOption = <T extends string>(value: T | undefined | null, options: readonly T[], defaultValue: T): T => {
  if (value && options.includes(value)) {
    return value;
  }
  return defaultValue;
};


export function EditLCEntryForm({ initialData, lcId }: EditLCEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ApplicantOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = React.useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = React.useState(true);

  const [totalCalculatedPartialQty, setTotalCalculatedPartialQty] = React.useState<number>(0);
  const [totalCalculatedPartialAmount, setTotalCalculatedPartialAmount] = React.useState<number>(0);
  const [activeSection46A, setActiveSection46A] = React.useState<string | undefined>(undefined);

  const form = useForm<LCEditFormValues>({
    resolver: zodResolver(lcEntrySchema),
    defaultValues: { // Explicit default values
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
      status: 'Draft',
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
      partialShipmentAllowed: 'No',
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
    },
  });

  const { control, setValue, watch, getValues, reset } = form;

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

        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        const fetchedBeneficiaries = suppliersSnapshot.docs.map(doc => {
          const data = doc.data() as SupplierDocument;
          return { value: doc.id, label: data.beneficiaryName || 'Unnamed Beneficiary' };
        });
        setBeneficiaryOptions(fetchedBeneficiaries);

      } catch (error) {
        console.error("EditLCEntryForm: Error fetching dropdown data: ", error);
        Swal.fire("Error", "Could not fetch applicant/beneficiary data. See console.", "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };
    fetchDropdownData();
  }, []);

  React.useEffect(() => {
    if (initialData && !isLoadingApplicants && !isLoadingBeneficiaries && applicantOptions.length > 0 && beneficiaryOptions.length > 0) {
      console.log("EditLCEntryForm: Initial L/C Data for Form:", initialData);
      const defaultValues = form.formState.defaultValues;
      reset({
        applicantId: initialData.applicantId || '',
        beneficiaryId: initialData.beneficiaryId || '',
        currency: getValidOption(initialData.currency, currencyOptions, defaultValues?.currency || currencyOptions[0]),
        termsOfPay: getValidOption(initialData.termsOfPay, termsOfPayOptions, defaultValues?.termsOfPay || termsOfPayOptions[0]),
        status: getValidOption(initialData.status, lcStatusOptions, defaultValues?.status || lcStatusOptions[0]),
        shipmentMode: getValidOption(initialData.shipmentMode, shipmentModeOptions, defaultValues?.shipmentMode || shipmentModeOptions[0]),
        trackingCourier: initialData.trackingCourier || '', // Handled by NONE_COURIER_VALUE in Select
        partialShipmentAllowed: getValidOption(initialData.partialShipmentAllowed, partialShipmentAllowedOptions, defaultValues?.partialShipmentAllowed || 'No'),
        amount: initialData.amount ?? undefined,
        documentaryCreditNumber: initialData.documentaryCreditNumber || '',
        proformaInvoiceNumber: initialData.proformaInvoiceNumber || '',
        invoiceDate: initialData.invoiceDate && isValid(parseISO(initialData.invoiceDate)) ? parseISO(initialData.invoiceDate) : undefined,
        totalMachineQty: initialData.totalMachineQty ?? undefined,
        lcIssueDate: initialData.lcIssueDate && isValid(parseISO(initialData.lcIssueDate)) ? parseISO(initialData.lcIssueDate) : new Date(),
        expireDate: initialData.expireDate && isValid(parseISO(initialData.expireDate)) ? parseISO(initialData.expireDate) : new Date(),
        latestShipmentDate: initialData.latestShipmentDate && isValid(parseISO(initialData.latestShipmentDate)) ? parseISO(initialData.latestShipmentDate) : new Date(),
        purchaseOrderUrl: initialData.purchaseOrderUrl || '',
        finalPIUrl: initialData.finalPIUrl || '',
        shippingDocumentsUrl: initialData.shippingDocumentsUrl || '',
        finalLcUrl: initialData.finalLcUrl || '',
        trackingNumber: initialData.trackingNumber || '',
        etd: initialData.etd && isValid(parseISO(initialData.etd)) ? parseISO(initialData.etd) : undefined,
        eta: initialData.eta && isValid(parseISO(initialData.eta)) ? parseISO(initialData.eta) : undefined,
        itemDescriptions: initialData.itemDescriptions || '',
        consigneeBankNameAddress: initialData.consigneeBankNameAddress || '',
        vesselOrFlightName: initialData.vesselOrFlightName || '',
        vesselImoNumber: initialData.vesselImoNumber || '',
        flightNumber: initialData.flightNumber || '',
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
        numberOfAmendments: initialData.numberOfAmendments ?? undefined,
        firstPartialQty: initialData.firstPartialQty ?? 0,
        secondPartialQty: initialData.secondPartialQty ?? 0,
        thirdPartialQty: initialData.thirdPartialQty ?? 0,
        firstPartialAmount: initialData.firstPartialAmount ?? 0,
        secondPartialAmount: initialData.secondPartialAmount ?? 0,
        thirdPartialAmount: initialData.thirdPartialAmount ?? 0,
        firstPartialPkgs: initialData.firstPartialPkgs ?? 0,
        secondPartialPkgs: initialData.secondPartialPkgs ?? 0,
        thirdPartialPkgs: initialData.thirdPartialPkgs ?? 0,
        firstPartialNetWeight: initialData.firstPartialNetWeight ?? 0,
        secondPartialNetWeight: initialData.secondPartialNetWeight ?? 0,
        thirdPartialNetWeight: initialData.thirdPartialNetWeight ?? 0,
        firstPartialGrossWeight: initialData.firstPartialGrossWeight ?? 0,
        secondPartialGrossWeight: initialData.secondPartialGrossWeight ?? 0,
        thirdPartialGrossWeight: initialData.thirdPartialGrossWeight ?? 0,
        firstPartialCbm: initialData.firstPartialCbm ?? 0,
        secondPartialCbm: initialData.secondPartialCbm ?? 0,
        thirdPartialCbm: initialData.thirdPartialCbm ?? 0,
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
        billOfExchangeQty: initialData.billOfExchangeQty ?? 0,
      });
      console.log("EditLCEntryForm: Form reset complete.");
      console.log("EditLCEntryForm: Setting Applicant ID in form to:", initialData.applicantId || '');
      console.log("EditLCEntryForm: Setting Beneficiary ID in form to:", initialData.beneficiaryId || '');
    }
  }, [initialData, reset, isLoadingApplicants, isLoadingBeneficiaries, applicantOptions, beneficiaryOptions, form.formState.defaultValues]);

  const watchedApplicantId = watch("applicantId");
  const { setValue: setFormValue } = form; // Destructure setValue

  React.useEffect(() => {
    console.log("EditLCEntryForm: Auto-populate effect triggered. Watched Applicant ID:", watchedApplicantId);
    if (watchedApplicantId && applicantOptions.length > 0) {
      const selectedApplicant = applicantOptions.find(opt => opt.value === watchedApplicantId);
      console.log("EditLCEntryForm: Applicant Options for check:", applicantOptions);
      console.log("EditLCEntryForm: Selected Applicant for auto-fill:", selectedApplicant);
      if (selectedApplicant) {
        setFormValue("notifyPartyNameAndAddress", selectedApplicant.address || '', { shouldDirty: true, shouldValidate: true });
        console.log("EditLCEntryForm: Setting notifyPartyNameAndAddress to:", selectedApplicant.address);
        setFormValue("notifyPartyName", selectedApplicant.contactPersonName || '', { shouldDirty: true, shouldValidate: true });
        console.log("EditLCEntryForm: Setting notifyPartyName to:", selectedApplicant.contactPersonName);
        setFormValue("notifyPartyCell", selectedApplicant.phone || '', { shouldDirty: true, shouldValidate: true });
        console.log("EditLCEntryForm: Setting notifyPartyCell to:", selectedApplicant.phone);
        setFormValue("notifyPartyEmail", selectedApplicant.email || '', { shouldDirty: true, shouldValidate: true });
        console.log("EditLCEntryForm: Setting notifyPartyEmail to:", selectedApplicant.email);
      }
    }
  }, [watchedApplicantId, applicantOptions, setFormValue]);


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
    if (watchedPartialShipmentAllowed === "Yes") {
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
  }, [watchedPartialShipmentAllowed, setValue, getValues]);


  React.useEffect(() => {
    const qtys = [getValues("firstPartialQty"), getValues("secondPartialQty"), getValues("thirdPartialQty")].map(q => Number(q) || 0);
    const amounts = [getValues("firstPartialAmount"), getValues("secondPartialAmount"), getValues("thirdPartialAmount")].map(a => Number(a) || 0);

    if (watchedPartialShipmentAllowed === "Yes") {
        setTotalCalculatedPartialQty(qtys.reduce((sum, val) => sum + val, 0));
        setTotalCalculatedPartialAmount(amounts.reduce((sum, val) => sum + val, 0));

        const pkgs = [getValues("firstPartialPkgs"), getValues("secondPartialPkgs"), getValues("thirdPartialPkgs")].map(p => Number(p) || 0);
        const netWeights = [getValues("firstPartialNetWeight"), getValues("secondPartialNetWeight"), getValues("thirdPartialNetWeight")].map(nw => Number(nw) || 0);
        const grossWeights = [getValues("firstPartialGrossWeight"), getValues("secondPartialGrossWeight"), getValues("thirdPartialGrossWeight")].map(gw => Number(gw) || 0);
        const cbms = [getValues("firstPartialCbm"), getValues("secondPartialCbm"), getValues("thirdPartialCbm")].map(c => Number(c) || 0);

        setValue("totalPackageQty", pkgs.reduce((sum, val) => sum + val, 0), { shouldValidate: true, shouldDirty: true });
        setValue("totalNetWeight", netWeights.reduce((sum, val) => sum + val, 0), { shouldValidate: true, shouldDirty: true });
        setValue("totalGrossWeight", grossWeights.reduce((sum, val) => sum + val, 0), { shouldValidate: true, shouldDirty: true });
        setValue("totalCbm", cbms.reduce((sum, val) => sum + val, 0), { shouldValidate: true, shouldDirty: true });
    } else {
        // If not "Yes", ensure calculated totals are reset, and main totals are re-populated from initialData if they were previously auto-filled
        setTotalCalculatedPartialQty(0);
        setTotalCalculatedPartialAmount(0);
        setValue("totalPackageQty", initialData?.totalPackageQty ?? 0, { shouldValidate: true, shouldDirty: true });
        setValue("totalNetWeight", initialData?.totalNetWeight ?? 0, { shouldValidate: true, shouldDirty: true });
        setValue("totalGrossWeight", initialData?.totalGrossWeight ?? 0, { shouldValidate: true, shouldDirty: true });
        setValue("totalCbm", initialData?.totalCbm ?? 0, { shouldValidate: true, shouldDirty: true });
    }
  }, [
    watchedPartialShipmentAllowed,
    ...watchedPartialValues,
    setValue, 
    getValues,
    initialData?.totalPackageQty,
    initialData?.totalNetWeight,
    initialData?.totalGrossWeight,
    initialData?.totalCbm
  ]);

  async function onSubmit(data: LCEditFormValues) {
    setIsSubmitting(true);

    const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);

    const dateToFirestore = (date?: Date | null): string | ReturnType<typeof deleteField> => {
      if (date === undefined || date === null) return deleteField();
      return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : deleteField();
    };

    const dataToUpdate: Partial<Omit<LCEntryDocument, 'id' | 'createdAt'>> = {
      applicantId: data.applicantId,
      applicantName: selectedApplicant ? selectedApplicant.label : initialData.applicantName,
      beneficiaryId: data.beneficiaryId,
      beneficiaryName: selectedBeneficiary ? selectedBeneficiary.label : initialData.beneficiaryName,
      currency: data.currency,
      termsOfPay: data.termsOfPay,
      status: data.status,
      shipmentMode: data.shipmentMode,
      trackingCourier: data.trackingCourier === "" || data.trackingCourier === NONE_COURIER_VALUE ? deleteField() : data.trackingCourier,
      amount: data.amount,
      documentaryCreditNumber: data.documentaryCreditNumber,
      proformaInvoiceNumber: data.proformaInvoiceNumber || deleteField(),
      invoiceDate: dateToFirestore(data.invoiceDate),
      totalMachineQty: data.totalMachineQty,
      lcIssueDate: dateToFirestore(data.lcIssueDate),
      expireDate: dateToFirestore(data.expireDate),
      latestShipmentDate: dateToFirestore(data.latestShipmentDate),
      purchaseOrderUrl: data.purchaseOrderUrl || deleteField(),
      finalPIUrl: data.finalPIUrl || deleteField(),
      shippingDocumentsUrl: data.shippingDocumentsUrl || deleteField(),
      finalLcUrl: data.finalLcUrl || deleteField(),
      trackingNumber: (data.trackingCourier === "" || data.trackingCourier === NONE_COURIER_VALUE || !data.trackingCourier) ? deleteField() : data.trackingNumber || deleteField(),
      etd: dateToFirestore(data.etd),
      eta: dateToFirestore(data.eta),
      itemDescriptions: data.itemDescriptions || deleteField(),
      consigneeBankNameAddress: data.consigneeBankNameAddress || deleteField(),
      vesselOrFlightName: data.vesselOrFlightName || deleteField(),
      vesselImoNumber: data.vesselImoNumber || deleteField(),
      flightNumber: data.flightNumber || deleteField(),
      partialShipments: data.partialShipments || deleteField(),
      portOfLoading: data.portOfLoading || deleteField(),
      portOfDischarge: data.portOfDischarge || deleteField(),
      shippingMarks: data.shippingMarks || deleteField(),
      certificateOfOrigin: data.certificateOfOrigin && data.certificateOfOrigin.length > 0 ? data.certificateOfOrigin : deleteField(),
      notifyPartyNameAndAddress: data.notifyPartyNameAndAddress || deleteField(),
      notifyPartyName: data.notifyPartyName || deleteField(),
      notifyPartyCell: data.notifyPartyCell || deleteField(),
      notifyPartyEmail: data.notifyPartyEmail || deleteField(),
      numberOfAmendments: data.numberOfAmendments,
      partialShipmentAllowed: data.partialShipmentAllowed,

      firstPartialQty: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.firstPartialQty) ?? deleteField() : deleteField(),
      secondPartialQty: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.secondPartialQty) ?? deleteField() : deleteField(),
      thirdPartialQty: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.thirdPartialQty) ?? deleteField() : deleteField(),
      firstPartialAmount: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.firstPartialAmount) ?? deleteField() : deleteField(),
      secondPartialAmount: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.secondPartialAmount) ?? deleteField() : deleteField(),
      thirdPartialAmount: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.thirdPartialAmount) ?? deleteField() : deleteField(),
      firstPartialPkgs: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.firstPartialPkgs) ?? deleteField() : deleteField(),
      secondPartialPkgs: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.secondPartialPkgs) ?? deleteField() : deleteField(),
      thirdPartialPkgs: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.thirdPartialPkgs) ?? deleteField() : deleteField(),
      firstPartialNetWeight: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.firstPartialNetWeight) ?? deleteField() : deleteField(),
      secondPartialNetWeight: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.secondPartialNetWeight) ?? deleteField() : deleteField(),
      thirdPartialNetWeight: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.thirdPartialNetWeight) ?? deleteField() : deleteField(),
      firstPartialGrossWeight: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.firstPartialGrossWeight) ?? deleteField() : deleteField(),
      secondPartialGrossWeight: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.secondPartialGrossWeight) ?? deleteField() : deleteField(),
      thirdPartialGrossWeight: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.thirdPartialGrossWeight) ?? deleteField() : deleteField(),
      firstPartialCbm: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.firstPartialCbm) ?? deleteField() : deleteField(),
      secondPartialCbm: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.secondPartialCbm) ?? deleteField() : deleteField(),
      thirdPartialCbm: data.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(data.thirdPartialCbm) ?? deleteField() : deleteField(),

      totalPackageQty: data.partialShipmentAllowed === "Yes"
        ? [data.firstPartialPkgs, data.secondPartialPkgs, data.thirdPartialPkgs].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(data.totalPackageQty) ?? deleteField(),
      totalNetWeight: data.partialShipmentAllowed === "Yes"
        ? [data.firstPartialNetWeight, data.secondPartialNetWeight, data.thirdPartialNetWeight].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(data.totalNetWeight) ?? deleteField(),
      totalGrossWeight: data.partialShipmentAllowed === "Yes"
        ? [data.firstPartialGrossWeight, data.secondPartialGrossWeight, data.thirdPartialGrossWeight].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(data.totalGrossWeight) ?? deleteField(),
      totalCbm: data.partialShipmentAllowed === "Yes"
        ? [data.firstPartialCbm, data.secondPartialCbm, data.thirdPartialCbm].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(data.totalCbm) ?? deleteField(),

      originalBlQty: toNumberOrUndefined(data.originalBlQty) ?? deleteField(),
      copyBlQty: toNumberOrUndefined(data.copyBlQty) ?? deleteField(),
      originalCooQty: toNumberOrUndefined(data.originalCooQty) ?? deleteField(),
      copyCooQty: toNumberOrUndefined(data.copyCooQty) ?? deleteField(),
      invoiceQty: toNumberOrUndefined(data.invoiceQty) ?? deleteField(),
      packingListQty: toNumberOrUndefined(data.packingListQty) ?? deleteField(),
      beneficiaryCertificateQty: toNumberOrUndefined(data.beneficiaryCertificateQty) ?? deleteField(),
      brandNewCertificateQty: toNumberOrUndefined(data.brandNewCertificateQty) ?? deleteField(),
      beneficiaryWarrantyCertificateQty: toNumberOrUndefined(data.beneficiaryWarrantyCertificateQty) ?? deleteField(),
      beneficiaryComplianceCertificateQty: toNumberOrUndefined(data.beneficiaryComplianceCertificateQty) ?? deleteField(),
      shipmentAdviceQty: toNumberOrUndefined(data.shipmentAdviceQty) ?? deleteField(),
      billOfExchangeQty: toNumberOrUndefined(data.billOfExchangeQty) ?? deleteField(),
      updatedAt: serverTimestamp(),
      year: data.lcIssueDate ? new Date(data.lcIssueDate).getFullYear() : initialData.year,
    };

    const cleanedDataToUpdate = Object.entries(dataToUpdate).reduce((acc, [key, value]) => {
      if (value !== undefined) { // Only include defined values for update
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
    return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading L/C options...</span></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

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
                  <FormLabel>{currencyOptions.includes(watchedCurrency as Currency) ? `${watchedCurrency} Amount*` : `${currencyOptions[0]} Amount*`}</FormLabel>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-start">
              <FormField control={control} name="firstPartialQty" render={({ field }) => (<FormItem><FormLabel>1st P. Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="firstPartialAmount" render={({ field }) => (<FormItem><FormLabel>1st P. Amt ({watch("currency")})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="firstPartialPkgs" render={({ field }) => (<FormItem><FormLabel>1st P. Pkgs</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="firstPartialNetWeight" render={({ field }) => (<FormItem><FormLabel>1st P. Net W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="firstPartialGrossWeight" render={({ field }) => (<FormItem><FormLabel>1st P. Gross W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="firstPartialCbm" render={({ field }) => (<FormItem><FormLabel>1st P. CBM</FormLabel><FormControl><Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <Separator />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-start">
              <FormField control={control} name="secondPartialQty" render={({ field }) => (<FormItem><FormLabel>2nd P. Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="secondPartialAmount" render={({ field }) => (<FormItem><FormLabel>2nd P. Amt ({watch("currency")})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="secondPartialPkgs" render={({ field }) => (<FormItem><FormLabel>2nd P. Pkgs</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="secondPartialNetWeight" render={({ field }) => (<FormItem><FormLabel>2nd P. Net W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="secondPartialGrossWeight" render={({ field }) => (<FormItem><FormLabel>2nd P. Gross W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={control} name="secondPartialCbm" render={({ field }) => (<FormItem><FormLabel>2nd P. CBM</FormLabel><FormControl><Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <Separator />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-start">
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
                    {watchedPartialShipmentAllowed === 'Yes' && <FormDescription className="text-xs">Auto-calculated.</FormDescription>}
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
                     {watchedPartialShipmentAllowed === 'Yes' && <FormDescription className="text-xs">Auto-calculated.</FormDescription>}
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
                     {watchedPartialShipmentAllowed === 'Yes' && <FormDescription className="text-xs">Auto-calculated.</FormDescription>}
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
                     {watchedPartialShipmentAllowed === 'Yes' && <FormDescription className="text-xs">Auto-calculated.</FormDescription>}
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
                    <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground"/>Total Partial Amount ({form.getValues("currency") || 'Currency'})</FormLabel>
                    <FormControl>
                    <Input type="text" value={totalCalculatedPartialAmount.toFixed(2)} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" />
                    </FormControl>
                </FormItem>
              </>
            )}
        </div>
        <Separator />

         <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <Ship className="mr-2 h-5 w-5 text-primary" />
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
                    <FormLabel>{watchedShipmentMode ? (watchedShipmentMode === "Sea" ? "Vessel Name" : "Flight Name") : "Vessel/Flight Name"}</FormLabel>
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
        <Separator />

        <div className="mt-6">
            <h4 className={cn(sectionHeadingClass, "!text-lg !border-b-0 !pb-0 mb-2 flex items-center")}>
                <PackageCheck className="mr-2 h-5 w-5 text-primary" /> Original Document Tracking
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end">
                <FormField
                    control={control}
                    name="trackingCourier"
                    render={({ field }) => (
                    <FormItem className="md:col-span-1">
                        <FormLabel>Courier By</FormLabel>
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
        </div>

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

        <Accordion type="single" collapsible className="w-full" value={activeSection46A} onValueChange={setActiveSection46A}>
          <AccordionItem value="section46A">
             <AccordionTrigger className={cn("hover:no-underline py-3 font-bold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b mb-4 w-full flex justify-between items-center")}>
                <div className="flex items-center gap-2">
                    <FileSignature className="mr-2 h-5 w-5 text-primary" />
                    46A: Documents Required
                </div>
                {activeSection46A === "section46A" ? <Minus className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
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
                  <FormField control={control} name="shipmentAdviceQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Shipment Advice Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={control} name="billOfExchangeQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Bill of Exchange Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
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

    
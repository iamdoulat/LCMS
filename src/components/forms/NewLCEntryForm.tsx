
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntryDocument, Currency, TrackingCourier, LCStatus, ShipmentMode, PartialShipmentAllowed, CertificateOfOriginCountry, TermsOfPay, ApplicantOption, SupplierDocument } from '@/types';
import { termsOfPayOptions, shipmentModeOptions, currencyOptions, trackingCourierOptions, lcStatusOptions, partialShipmentAllowedOptions, certificateOfOriginCountries } from '@/types';
import Swal from 'sweetalert2';
import { isValid, parseISO, format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { addDoc, serverTimestamp, collection, getDocs, query, where, deleteField } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, Landmark, FileText, CalendarDays, Ship, Plane, Layers, FileSignature, Edit3, BellRing, Users, Building, Hash, ExternalLink, PackageCheck, Search, CheckSquare, UploadCloud, DollarSign, Package, FileIcon, Box, Weight, Scale, LinkIcon, Plus, Minus, PlusCircle, Trash2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

const toNumberOrUndefined = (val: unknown): number | undefined => {
  if (val === "" || val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
    return undefined;
  }
  const num = Number(String(val).trim());
  return isNaN(num) ? undefined : num;
};

const lcEntrySchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required"),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required"),
  currency: z.enum(currencyOptions, { required_error: "Currency is required" }),
  amount: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive")
  ),
  termsOfPay: z.enum(termsOfPayOptions).optional(),
  documentaryCreditNumber: z.string().min(1, "Documentary Credit Number is required"),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional().nullable(),
  commercialInvoiceNumber: z.string().optional(),
  commercialInvoiceDate: z.date().optional().nullable(),
  totalMachineQty: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Quantity must be a number" }).int().positive("Quantity must be positive")
  ),
  numberOfAmendments: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Amendments must be non-negative integer.").optional().default(0)),
  status: z.enum(lcStatusOptions).optional(),
  itemDescriptions: z.string().optional(),
  partialShipments: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  consigneeBankNameAddress: z.string().optional(),
  notifyPartyNameAndAddress: z.string().optional(),
  notifyPartyName: z.string().optional(),
  notifyPartyCell: z.string().optional(),
  notifyPartyEmail: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')),
  lcIssueDate: z.date({ required_error: "L/C Issue Date is required." }).nullable(),
  expireDate: z.date().optional().nullable(),
  latestShipmentDate: z.date().optional().nullable(),
  partialShipmentAllowed: z.enum(partialShipmentAllowedOptions).optional(),
  firstPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  secondPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  thirdPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  firstPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional().default(0)),
  secondPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional().default(0)),
  thirdPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional().default(0)),
  firstPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional().default(0)),
  firstPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional().default(0)),
  firstPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional().default(0)),
  firstPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  secondPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional().default(0)),
  secondPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional().default(0)),
  secondPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional().default(0)),
  secondPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  thirdPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional().default(0)),
  thirdPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional().default(0)),
  thirdPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional().default(0)),
  thirdPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  totalPackageQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Package quantity cannot be negative").optional().default(0)),
  totalNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net weight cannot be negative").optional().default(0)),
  totalGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross weight cannot be negative").optional().default(0)),
  totalCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  shipmentMode: z.enum(shipmentModeOptions).optional(),
  vesselOrFlightName: z.string().optional(),
  vesselImoNumber: z.string().optional(),
  flightNumber: z.string().optional(),
  trackingCourier: z.enum(["", ...trackingCourierOptions]).optional(),
  trackingNumber: z.string().optional(),
  etd: z.date().optional().nullable(),
  eta: z.date().optional().nullable(),
  originalBlQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  copyBlQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  originalCooQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  copyCooQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  invoiceQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  packingListQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  beneficiaryCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  brandNewCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  beneficiaryWarrantyCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  beneficiaryComplianceCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  shipmentAdviceQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  billOfExchangeQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  certificateOfOrigin: z.array(z.enum(certificateOfOriginCountries)).optional().default([]),
  shippingMarks: z.string().optional(),
  purchaseOrderUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  finalPIUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  finalLcUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  shippingDocumentsUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  packingListUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  isFirstShipment: z.boolean().optional().default(true),
  isSecondShipment: z.boolean().optional().default(false),
  isThirdShipment: z.boolean().optional().default(false),
}).refine(data => {
  if (data.termsOfPay === "T/T In Advance") {
    return data.expireDate === null || data.expireDate === undefined;
  }
  return data.expireDate !== null && data.expireDate !== undefined;
}, {
  message: "Expire Date is required unless Terms of Pay is T/T In Advance.",
  path: ["expireDate"],
}).refine(data => {
  if (data.termsOfPay === "T/T In Advance") {
    return data.latestShipmentDate === null || data.latestShipmentDate === undefined;
  }
  return data.latestShipmentDate !== null && data.latestShipmentDate !== undefined;
}, {
  message: "Latest Shipment Date is required unless Terms of Pay is T/T In Advance.",
  path: ["latestShipmentDate"],
});

export type NewLCFormValues = z.infer<typeof lcEntrySchema>;

const defaultFormValues: NewLCFormValues = {
  applicantId: '',
  beneficiaryId: '',
  currency: currencyOptions[0],
  amount: undefined,
  termsOfPay: undefined,
  documentaryCreditNumber: '',
  proformaInvoiceNumber: '',
  invoiceDate: undefined,
  commercialInvoiceNumber: '',
  commercialInvoiceDate: undefined,
  totalMachineQty: undefined,
  numberOfAmendments: 0,
  status: undefined,
  itemDescriptions: '',
  partialShipments: "ALLOWED",
  portOfLoading: "CHINA",
  portOfDischarge: "CHATTOGRAM",
  consigneeBankNameAddress: '',
  notifyPartyNameAndAddress: '',
  notifyPartyName: '',
  notifyPartyCell: '',
  notifyPartyEmail: '',
  lcIssueDate: undefined,
  expireDate: undefined,
  latestShipmentDate: undefined,
  partialShipmentAllowed: "No",
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
  trackingCourier: "DHL",
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
  packingListUrl: '',
  isFirstShipment: true,
  isSecondShipment: false,
  isThirdShipment: false,
};

const sectionHeadingClass = "font-bold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_APPLICANT_VALUE = "__LC_NEW_APPLICANT_PLACEHOLDER__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__LC_NEW_BENEFICIARY_PLACEHOLDER__";
const NONE_COURIER_VALUE = "__NONE_LC_NEW_COURIER__";

export function NewLCEntryForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ApplicantOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = React.useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = React.useState(true);

  const [totalCalculatedPartialQty, setTotalCalculatedPartialQty] = React.useState<number>(0);
  const [totalCalculatedPartialAmount, setTotalCalculatedPartialAmount] = React.useState<number>(0);
  const [activeSection46A, setActiveSection46A] = React.useState<string | undefined>(undefined);
  const prevPartialShipmentAllowedRef = React.useRef<PartialShipmentAllowed | undefined | null>();


  const form = useForm<NewLCFormValues>({
    resolver: zodResolver(lcEntrySchema),
    defaultValues: defaultFormValues,
  });

  const { control, setValue, watch, getValues, reset } = form;

  const watchedApplicantId = watch("applicantId");
  const watchedShipmentMode = watch("shipmentMode");
  const watchedCurrency = watch("currency");
  const watchedPartialShipmentAllowed = watch("partialShipmentAllowed");
  const watchedTermsOfPay = watch("termsOfPay");


  React.useEffect(() => {
    if (watchedTermsOfPay === "T/T In Advance") {
      setValue("expireDate", undefined, { shouldValidate: true, shouldDirty: true });
      setValue("latestShipmentDate", undefined, { shouldValidate: true, shouldDirty: true });
    }
  }, [watchedTermsOfPay, setValue]);


  React.useEffect(() => {
    const fetchDropdownData = async () => {
      setIsLoadingApplicants(true);
      setIsLoadingBeneficiaries(true);
      try {
        const customersSnapshot = await getDocs(collection(firestore, "customers"));
        const fetchedApplicants = customersSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            value: docSnap.id,
            label: data.applicantName || 'Unnamed Applicant',
            address: data.address,
            contactPersonName: data.contactPerson,
            email: data.email,
            phone: data.phone,
           } as ApplicantOption;
        });
        setApplicantOptions(fetchedApplicants);

        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        setBeneficiaryOptions(
          suppliersSnapshot.docs.map(docSnap => {
            const data = docSnap.data() as SupplierDocument;
            return { value: docSnap.id, label: data.beneficiaryName || 'Unnamed Beneficiary' };
          })
        );
      } catch (error) {
        console.error("Error fetching dropdown data:", error);
        Swal.fire("Error", "Could not fetch applicant/beneficiary data. See console for details.", "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };
    fetchDropdownData();
  }, []);


  React.useEffect(() => {
    if (watchedApplicantId && applicantOptions.length > 0) {
      const selectedApplicant = applicantOptions.find(opt => opt.value === watchedApplicantId);
      if (selectedApplicant) {
        setValue("notifyPartyNameAndAddress", selectedApplicant.address || '', { shouldDirty: true, shouldValidate: true });
        setValue("notifyPartyName", selectedApplicant.contactPersonName || '', { shouldDirty: true, shouldValidate: true });
        setValue("notifyPartyCell", selectedApplicant.phone || '', { shouldDirty: true, shouldValidate: true });
        setValue("notifyPartyEmail", selectedApplicant.email || '', { shouldDirty: true, shouldValidate: true });
      }
    }
  }, [watchedApplicantId, applicantOptions, setValue]);


  let viaLabel = "Vessel/Flight Name";
  if (watchedShipmentMode === "Sea") {
    viaLabel = "Vessel Name";
  } else if (watchedShipmentMode === "Air") {
    viaLabel = "Flight Name";
  }

  const amountLabel = currencyOptions.includes(watchedCurrency as Currency) ? `${watchedCurrency} Amount*` : "Amount*";


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
        "originalBlQty", "copyBlQty", "originalCooQty", "copyCooQty", "invoiceQty", "packingListQty",
        "beneficiaryCertificateQty", "brandNewCertificateQty", "beneficiaryWarrantyCertificateQty",
        "beneficiaryComplianceCertificateQty", "shipmentAdviceQty", "billOfExchangeQty"
      ] as const;

      fieldsToInitializeZero.forEach(fieldName => {
        const currentValue = getValues(fieldName);
        if (currentValue === undefined || String(currentValue ?? '').trim() === '') {
          setValue(fieldName, 0 as any, { shouldValidate: true, shouldDirty: true });
        }
      });
    }
    prevPartialShipmentAllowedRef.current = watchedPartialShipmentAllowed;
  }, [watchedPartialShipmentAllowed, setValue, getValues]);


  React.useEffect(() => {
    const firstPartialQty = Number(getValues("firstPartialQty") || 0);
    const secondPartialQty = Number(getValues("secondPartialQty") || 0);
    const thirdPartialQty = Number(getValues("thirdPartialQty") || 0);
    const newTotalQty = firstPartialQty + secondPartialQty + thirdPartialQty;

    const firstPartialAmount = Number(getValues("firstPartialAmount") || 0);
    const secondPartialAmount = Number(getValues("secondPartialAmount") || 0);
    const thirdPartialAmount = Number(getValues("thirdPartialAmount") || 0);
    const newTotalAmount = firstPartialAmount + secondPartialAmount + thirdPartialAmount;

    if (totalCalculatedPartialQty !== newTotalQty) {
      setTotalCalculatedPartialQty(newTotalQty);
    }
    if (totalCalculatedPartialAmount !== newTotalAmount) {
      setTotalCalculatedPartialAmount(newTotalAmount);
    }

    if (watchedPartialShipmentAllowed === "Yes") {
      const firstPartialPkgs = Number(getValues("firstPartialPkgs") || 0);
      const secondPartialPkgs = Number(getValues("secondPartialPkgs") || 0);
      const thirdPartialPkgs = Number(getValues("thirdPartialPkgs") || 0);
      const newTotalPkgs = firstPartialPkgs + secondPartialPkgs + thirdPartialPkgs;
      const currentTotalPkgs = Number(getValues("totalPackageQty") || 0);
      if (currentTotalPkgs !== newTotalPkgs) {
          setValue("totalPackageQty", newTotalPkgs, { shouldValidate: true, shouldDirty: true });
      }

      const firstPartialNetW = Number(getValues("firstPartialNetWeight") || 0);
      const secondPartialNetW = Number(getValues("secondPartialNetWeight") || 0);
      const thirdPartialNetW = Number(getValues("thirdPartialNetWeight") || 0);
      const newTotalNetW = firstPartialNetW + secondPartialNetW + thirdPartialNetW;
      const currentTotalNetW = Number(getValues("totalNetWeight") || 0);
       if (currentTotalNetW !== newTotalNetW) {
        setValue("totalNetWeight", newTotalNetW, { shouldValidate: true, shouldDirty: true });
      }

      const firstPartialGrossW = Number(getValues("firstPartialGrossWeight") || 0);
      const secondPartialGrossW = Number(getValues("secondPartialGrossWeight") || 0);
      const thirdPartialGrossW = Number(getValues("thirdPartialGrossWeight") || 0);
      const newTotalGrossW = firstPartialGrossW + secondPartialGrossW + thirdPartialGrossW;
      const currentTotalGrossW = Number(getValues("totalGrossWeight") || 0);
       if (currentTotalGrossW !== newTotalGrossW) {
        setValue("totalGrossWeight", newTotalGrossW, { shouldValidate: true, shouldDirty: true });
      }

      const firstPartialCbm = Number(getValues("firstPartialCbm") || 0);
      const secondPartialCbm = Number(getValues("secondPartialCbm") || 0);
      const thirdPartialCbm = Number(getValues("thirdPartialCbm") || 0);
      const newTotalCbm = firstPartialCbm + secondPartialCbm + thirdPartialCbm;
      const currentTotalCbm = Number(getValues("totalCbm") || 0);
       if (currentTotalCbm !== newTotalCbm) {
        setValue("totalCbm", newTotalCbm, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [watchedPartialShipmentAllowed, ...watchedPartialValues, getValues, setValue, totalCalculatedPartialQty, totalCalculatedPartialAmount]);


  async function onSubmit(finalData: NewLCFormValues) {
    setIsSubmitting(true);

    const lcIssueDateObj = finalData.lcIssueDate ? new Date(finalData.lcIssueDate) : new Date();
    const extractedYear = lcIssueDateObj.getFullYear();

    const selectedApplicant = applicantOptions.find(opt => opt.value === finalData.applicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === finalData.beneficiaryId);

    const dataToSave: Partial<Omit<LCEntryDocument, 'id' | 'createdAt' | 'updatedAt'>> & { year: number, createdAt: any, updatedAt: any } = {
      applicantId: finalData.applicantId,
      applicantName: selectedApplicant ? selectedApplicant.label : 'N/A',
      beneficiaryId: finalData.beneficiaryId,
      beneficiaryName: selectedBeneficiary ? selectedBeneficiary.label : 'N/A',
      currency: finalData.currency,
      amount: finalData.amount,
      termsOfPay: finalData.termsOfPay,
      documentaryCreditNumber: finalData.documentaryCreditNumber,
      proformaInvoiceNumber: finalData.proformaInvoiceNumber || undefined,
      invoiceDate: finalData.invoiceDate ? format(new Date(finalData.invoiceDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      commercialInvoiceNumber: finalData.commercialInvoiceNumber || undefined,
      commercialInvoiceDate: finalData.commercialInvoiceDate ? format(new Date(finalData.commercialInvoiceDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      totalMachineQty: finalData.totalMachineQty,
      numberOfAmendments: toNumberOrUndefined(finalData.numberOfAmendments),
      status: finalData.status,
      itemDescriptions: finalData.itemDescriptions || undefined,
      partialShipments: finalData.partialShipments || undefined,
      portOfLoading: finalData.portOfLoading || undefined,
      portOfDischarge: finalData.portOfDischarge || undefined,
      consigneeBankNameAddress: finalData.consigneeBankNameAddress || undefined,
      notifyPartyNameAndAddress: finalData.notifyPartyNameAndAddress || undefined,
      notifyPartyName: finalData.notifyPartyName || undefined,
      notifyPartyCell: finalData.notifyPartyCell || undefined,
      notifyPartyEmail: finalData.notifyPartyEmail || undefined,
      lcIssueDate: finalData.lcIssueDate ? format(new Date(finalData.lcIssueDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      expireDate: finalData.termsOfPay === "T/T In Advance" || !finalData.expireDate ? undefined : format(new Date(finalData.expireDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      latestShipmentDate: finalData.termsOfPay === "T/T In Advance" || !finalData.latestShipmentDate ? undefined : format(new Date(finalData.latestShipmentDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      partialShipmentAllowed: finalData.partialShipmentAllowed,
      shipmentMode: finalData.shipmentMode,
      vesselOrFlightName: finalData.vesselOrFlightName || undefined,
      vesselImoNumber: finalData.vesselImoNumber || undefined,
      flightNumber: finalData.flightNumber || undefined,
      trackingCourier: finalData.trackingCourier || undefined,
      trackingNumber: (finalData.trackingCourier === "" || !finalData.trackingCourier) ? undefined : finalData.trackingNumber || undefined,
      etd: finalData.etd ? format(new Date(finalData.etd), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      eta: finalData.eta ? format(new Date(finalData.eta), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      certificateOfOrigin: finalData.certificateOfOrigin && finalData.certificateOfOrigin.length > 0 ? finalData.certificateOfOrigin : undefined,
      shippingMarks: finalData.shippingMarks || undefined,
      purchaseOrderUrl: finalData.purchaseOrderUrl || undefined,
      finalPIUrl: finalData.finalPIUrl || undefined,
      finalLcUrl: finalData.finalLcUrl || undefined,
      shippingDocumentsUrl: finalData.shippingDocumentsUrl || undefined,
      packingListUrl: finalData.packingListUrl || undefined,
      year: extractedYear,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      firstPartialQty: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialQty) : undefined,
      secondPartialQty: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialQty) : undefined,
      thirdPartialQty: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialQty) : undefined,
      firstPartialAmount: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialAmount) : undefined,
      secondPartialAmount: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialAmount) : undefined,
      thirdPartialAmount: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialAmount) : undefined,
      firstPartialPkgs: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialPkgs) : undefined,
      secondPartialPkgs: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialPkgs) : undefined,
      thirdPartialPkgs: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialPkgs) : undefined,
      firstPartialNetWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialNetWeight) : undefined,
      secondPartialNetWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialNetWeight) : undefined,
      thirdPartialNetWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialNetWeight) : undefined,
      firstPartialGrossWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialGrossWeight) : undefined,
      secondPartialGrossWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialGrossWeight) : undefined,
      thirdPartialGrossWeight: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialGrossWeight) : undefined,
      firstPartialCbm: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.firstPartialCbm) : undefined,
      secondPartialCbm: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.secondPartialCbm) : undefined,
      thirdPartialCbm: finalData.partialShipmentAllowed === "Yes" ? toNumberOrUndefined(finalData.thirdPartialCbm) : undefined,
      totalPackageQty: finalData.partialShipmentAllowed === "Yes"
        ? [finalData.firstPartialPkgs, finalData.secondPartialPkgs, finalData.thirdPartialPkgs].map(p => Number(p || 0)).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(finalData.totalPackageQty),
      totalNetWeight: finalData.partialShipmentAllowed === "Yes"
        ? [finalData.firstPartialNetWeight, finalData.secondPartialNetWeight, finalData.thirdPartialNetWeight].map(p => Number(p || 0)).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(finalData.totalNetWeight),
      totalGrossWeight: finalData.partialShipmentAllowed === "Yes"
        ? [finalData.firstPartialGrossWeight, finalData.secondPartialGrossWeight, finalData.thirdPartialGrossWeight].map(p => Number(p || 0)).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(finalData.totalGrossWeight),
      totalCbm: finalData.partialShipmentAllowed === "Yes"
        ? [finalData.firstPartialCbm, finalData.secondPartialCbm, finalData.thirdPartialCbm].map(p => Number(p || 0)).reduce((s, v) => s + v, 0)
        : toNumberOrUndefined(finalData.totalCbm),
      originalBlQty: toNumberOrUndefined(finalData.originalBlQty),
      copyBlQty: toNumberOrUndefined(finalData.copyBlQty),
      originalCooQty: toNumberOrUndefined(finalData.originalCooQty),
      copyCooQty: toNumberOrUndefined(finalData.copyCooQty),
      invoiceQty: toNumberOrUndefined(finalData.invoiceQty),
      packingListQty: toNumberOrUndefined(finalData.packingListQty),
      beneficiaryCertificateQty: toNumberOrUndefined(finalData.beneficiaryCertificateQty),
      brandNewCertificateQty: toNumberOrUndefined(finalData.brandNewCertificateQty),
      beneficiaryWarrantyCertificateQty: toNumberOrUndefined(finalData.beneficiaryWarrantyCertificateQty),
      beneficiaryComplianceCertificateQty: toNumberOrUndefined(finalData.beneficiaryComplianceCertificateQty),
      shipmentAdviceQty: toNumberOrUndefined(finalData.shipmentAdviceQty),
      billOfExchangeQty: toNumberOrUndefined(finalData.billOfExchangeQty),
      isFirstShipment: finalData.isFirstShipment ?? false,
      isSecondShipment: finalData.isSecondShipment ?? false,
      isThirdShipment: finalData.isThirdShipment ?? false,
    };

    const cleanedDataToSave = Object.fromEntries(
      Object.entries(dataToSave).filter(([, value]) => value !== undefined)
    ) as typeof dataToSave;


    try {
      await addDoc(collection(firestore, "lc_entries"), cleanedDataToSave);
      Swal.fire({
        title: "L/C Entry Saved!",
        text: `L/C entry has been successfully saved.`,
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      });
      reset(defaultFormValues);
      setTotalCalculatedPartialQty(0);
      setTotalCalculatedPartialAmount(0);
      setActiveSection46A(undefined);
    } catch (error: any) {
      console.error("Error saving L/C entry:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save L/C entry: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleTrackDocument = () => {
    const courier = getValues("trackingCourier");
    const number = getValues("trackingNumber");

    if (!courier || String(courier).trim() === "" || !number || String(number).trim() === "") {
      Swal.fire({
        title: "Information Missing",
        text: "Please select a courier and enter a tracking number.",
        icon: "info",
      });
      return;
    }

    let url = "";
    if (courier === "DHL") {
      url = `https://www.dhl.com/bd-en/home/tracking.html?tracking-id=${encodeURIComponent(String(number).trim())}&submit=1`;
    } else if (courier === "FedEx") {
      url = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(String(number).trim())}`;
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
    if (!imoNumber || String(imoNumber).trim() === "") {
       Swal.fire({
        title: "IMO Number Missing",
        text: "Please enter a Vessel IMO number to track.",
        icon: "info",
      });
      return;
    }
    const url = `https://www.vesselfinder.com/vessels/details/${encodeURIComponent(String(imoNumber).trim())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleTrackFlight = () => {
    const flightNum = getValues("flightNumber");
    if (!flightNum || String(flightNum).trim() === "") {
      Swal.fire("Info", "Please enter a flight number to track.", "info");
      return;
    }
    const url = `https://www.flightradar24.com/${encodeURIComponent(String(flightNum).trim())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleViewUrl = (url: string | undefined | null) => {
    if (url && String(url).trim() !== "") {
      try {
        new URL(String(url));
        window.open(String(url), '_blank', 'noopener,noreferrer');
      } catch (e) {
        Swal.fire("Invalid URL", "The provided URL is not valid.", "error");
      }
    } else {
      Swal.fire("No URL", "No URL provided to view.", "info");
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {/* Section: L/C & Invoice Details */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
           <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem className="space-y-3 pb-4">
                <FormLabel>Currency*</FormLabel>
                <FormControl>
                   <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value ?? defaultFormValues.currency}
                    className="flex flex-wrap items-center gap-x-6 gap-y-2"
                  >
                    {currencyOptions.map((option) => (
                      <FormItem key={option} className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value={option} /></FormControl>
                        <FormLabel className="font-normal text-sm">{option}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{amountLabel}</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="e.g., 50000.00" {...field} value={field.value ?? ''} />
                </FormControl>
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
                  <Input type="number" placeholder="0" {...field} value={field.value ?? 0} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="commercialInvoiceNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Commercial Invoice Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter C.I. number" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="commercialInvoiceDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Commercial Invoice Date</FormLabel>
                <DatePickerField field={field} placeholder="Select C.I. date" />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-4">
            <FormField
            control={control}
            name="termsOfPay"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Terms of Pay*</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value ?? defaultFormValues.termsOfPay}
                    className="flex flex-wrap items-center gap-x-6 gap-y-2"
                  >
                    {termsOfPayOptions.map((option) => (
                      <FormItem key={option} className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value={option} /></FormControl>
                        <FormLabel className="font-normal text-sm">{option}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="status"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-center"><CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />L/C Status*</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                     value={field.value ?? defaultFormValues.status}
                    className="flex flex-wrap items-center gap-x-6 gap-y-2"
                  >
                    {lcStatusOptions.map((statusOpt) => (
                      <FormItem key={statusOpt} className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={statusOpt} />
                        </FormControl>
                        <FormLabel className="font-normal text-sm">{statusOpt}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
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

        {/* Section: Important Dates & Partial Shipment Details */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
            <CalendarDays className="mr-2 h-5 w-5 text-primary" />
            Important Dates & Partial Shipment Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
                control={control}
                name="lcIssueDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>T/T or L/C Issue Date*</FormLabel>
                    <DatePickerField field={field} placeholder="Select date" />
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name="expireDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Expire Date{watchedTermsOfPay !== "T/T In Advance" && "*"}</FormLabel>
                    <DatePickerField 
                        field={field} 
                        placeholder="Select date" 
                        disabled={watchedTermsOfPay === "T/T In Advance"}
                    />
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={control}
                name="latestShipmentDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Latest Shipment Date{watchedTermsOfPay !== "T/T In Advance" && "*"}</FormLabel>
                     <DatePickerField 
                        field={field} 
                        placeholder="Select date" 
                        disabled={watchedTermsOfPay === "T/T In Advance"}
                    />
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        <FormField
          control={control}
          name="partialShipmentAllowed"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Partial Shipment Allowed*</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value ?? defaultFormValues.partialShipmentAllowed}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2"
                >
                  {partialShipmentAllowedOptions.map((option) => (
                    <FormItem key={option} className="flex items-center space-x-2 space-y-0">
                      <FormControl><RadioGroupItem value={option} /></FormControl>
                      <FormLabel className="font-normal text-sm">{option}</FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {watchedPartialShipmentAllowed === "Yes" && (
          <div className="p-4 mt-4 border border-dashed rounded-md shadow-sm bg-muted/20">
            <h4 className="text-md font-medium text-foreground flex items-center mb-4 border-b pb-2">
                <Package className="mr-2 h-5 w-5 text-muted-foreground" />
                Partial Shipment Breakdown
            </h4>
            <div className="space-y-6">
              {/* 1st Partial Shipment */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-start">
                <FormField control={control} name="firstPartialQty" render={({ field }) => (<FormItem><FormLabel>1st Partial Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="firstPartialAmount" render={({ field }) => (<FormItem><FormLabel>1st Partial Amount ({watch("currency")})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="firstPartialPkgs" render={({ field }) => (<FormItem><FormLabel>1st Partial Pkgs</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="firstPartialNetWeight" render={({ field }) => (<FormItem><FormLabel>1st P. Net Weight (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="firstPartialGrossWeight" render={({ field }) => (<FormItem><FormLabel>1st P. Gross Weight (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="firstPartialCbm" render={({ field }) => (<FormItem><FormLabel>1st Partial CBM</FormLabel><FormControl><Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <Separator />
              {/* 2nd Partial Shipment */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-start">
                <FormField control={control} name="secondPartialQty" render={({ field }) => (<FormItem><FormLabel>2nd Partial Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="secondPartialAmount" render={({ field }) => (<FormItem><FormLabel>2nd Partial Amount ({watch("currency")})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="secondPartialPkgs" render={({ field }) => (<FormItem><FormLabel>2nd Partial Pkgs</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="secondPartialNetWeight" render={({ field }) => (<FormItem><FormLabel>2nd P. Net Weight (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="secondPartialGrossWeight" render={({ field }) => (<FormItem><FormLabel>2nd P. Gross Weight (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="secondPartialCbm" render={({ field }) => (<FormItem><FormLabel>2nd Partial CBM</FormLabel><FormControl><Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <Separator />
              {/* 3rd Partial Shipment */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-start">
                <FormField control={control} name="thirdPartialQty" render={({ field }) => (<FormItem><FormLabel>3rd Partial Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="thirdPartialAmount" render={({ field }) => (<FormItem><FormLabel>3rd Partial Amount ({watch("currency")})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="thirdPartialPkgs" render={({ field }) => (<FormItem><FormLabel>3rd Partial Pkgs</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="thirdPartialNetWeight" render={({ field }) => (<FormItem><FormLabel>3rd P. Net Weight (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="thirdPartialGrossWeight" render={({ field }) => (<FormItem><FormLabel>3rd P. Gross Weight (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="thirdPartialCbm" render={({ field }) => (<FormItem><FormLabel>3rd Partial CBM</FormLabel><FormControl><Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 mt-4 items-end">
            <FormField
                control={form.control}
                name="totalPackageQty"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Box className="mr-2 h-4 w-4 text-muted-foreground" />Total Package Qty</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="0" {...field} value={field.value ?? ''} disabled={watchedPartialShipmentAllowed === 'Yes'} />
                    </FormControl>
                     <FormDescription className="text-xs">
                        {watchedPartialShipmentAllowed === 'Yes' ? 'Auto-calculated.' : 'Enter if no partials.'}
                    </FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="totalNetWeight"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Weight className="mr-2 h-4 w-4 text-muted-foreground" />Total Net Weight (KGS)</FormLabel>
                    <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} disabled={watchedPartialShipmentAllowed === 'Yes'}/>
                    </FormControl>
                     <FormDescription className="text-xs">
                        {watchedPartialShipmentAllowed === 'Yes' ? 'Auto-calculated.' : 'Enter if no partials.'}
                    </FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="totalGrossWeight"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Scale className="mr-2 h-4 w-4 text-muted-foreground" />Total Gross Weight (KGS)</FormLabel>
                    <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} disabled={watchedPartialShipmentAllowed === 'Yes'}/>
                    </FormControl>
                     <FormDescription className="text-xs">
                        {watchedPartialShipmentAllowed === 'Yes' ? 'Auto-calculated.' : 'Enter if no partials.'}
                    </FormDescription>
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
                    <Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} disabled={watchedPartialShipmentAllowed === 'Yes'}/>
                    </FormControl>
                     <FormDescription className="text-xs">
                        {watchedPartialShipmentAllowed === 'Yes' ? 'Auto-calculated.' : 'Enter if no partials.'}
                    </FormDescription>
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
                        <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground"/>Total Partial Amount ({watchedCurrency})</FormLabel>
                        <FormControl>
                        <Input type="text" value={totalCalculatedPartialAmount.toFixed(2)} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" />
                        </FormControl>
                    </FormItem>
                </>
            )}
        </div>
        <Separator />
        
        {/* Section: Shipping Information */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <Ship className="mr-2 h-5 w-5 text-primary" />
          Shipping Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
           <FormField
              control={control}
              name="shipmentMode"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Shipment Mode*</FormLabel>
                   <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value ?? defaultFormValues.shipmentMode}
                      className="flex flex-wrap items-center gap-x-6 gap-y-2"
                    >
                      {shipmentModeOptions.map((option) => (
                        <FormItem key={option} className="flex items-center space-x-2 space-y-0">
                          <FormControl><RadioGroupItem value={option} /></FormControl>
                          <FormLabel className="font-normal text-sm">
                              {option === 'Sea' && <Ship className="mr-1 h-4 w-4 inline-block" />}
                              {option === 'Air' && <Plane className="mr-1 h-4 w-4 inline-block" />}
                              {option}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          <FormField
            control={control}
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
              control={control}
              name="vesselImoNumber"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Vessel IMO Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter Vessel IMO Number" {...field} value={field.value ?? ''} />
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
              onClick={handleTrackFlight}
              disabled={!watch("flightNumber") || isSubmitting}
              className="md:col-span-1"
              title="Track Flight on FlightRadar24"
            >
              <Search className="mr-2 h-4 w-4" />
              Track Flight
            </Button>
          </div>
        )}

        <div className="mt-6">
          <h4 className="text-base font-medium text-foreground flex items-center mb-2">
            <PackageCheck className="mr-2 h-5 w-5 text-muted-foreground" /> Original Document Tracking
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end">
             <FormField
                control={control}
                name="trackingCourier"
                render={({ field }) => (
                  <FormItem className="md:col-span-1 space-y-3">
                    <FormLabel>Courier By</FormLabel>
                    <FormControl>
                       <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value ?? "DHL"}
                          className="flex flex-wrap items-center gap-x-6 gap-y-2"
                        >
                          {trackingCourierOptions.map((courier) => (
                            <FormItem key={courier} className="flex items-center space-x-2 space-y-0">
                              <FormControl><RadioGroupItem value={courier} /></FormControl>
                              <FormLabel className="font-normal text-sm">{courier}</FormLabel>
                            </FormItem>
                          ))}
                        </RadioGroup>
                    </FormControl>
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
                    <Input placeholder="Enter tracking number" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="default"
              onClick={handleTrackDocument}
              disabled={!watch("trackingNumber") || !watch("trackingCourier") || isSubmitting}
              className="md:col-span-1 mt-4 md:mt-0"
              title="Track Original Document"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Track
            </Button>
          </div>
        </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mt-4">
          <FormField
            control={control}
            name="isFirstShipment"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal text-foreground hover:cursor-pointer">
                  1st shipment
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="isSecondShipment"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal text-foreground hover:cursor-pointer">
                  2nd shipment
                </FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="isThirdShipment"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal text-foreground hover:cursor-pointer">
                  3rd shipment
                </FormLabel>
              </FormItem>
            )}
          />
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <FormField
            control={control}
            name="etd"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>ETD (Estimated Time of Departure)</FormLabel>
                <DatePickerField field={field} placeholder="Select date" />
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
                <DatePickerField field={field} placeholder="Select date" />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Separator />

        {/* Section: Consignee Bank Details */}
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
                <Textarea placeholder="Enter bank name and full address" {...field} rows={3} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        
        {/* Section: Notify Details */}
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
                <Textarea placeholder="Enter notify party's full name and address" {...field} rows={3} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
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
            control={form.control}
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
            control={form.control}
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

        {/* Section: 46A: Documents Required */}
         <Accordion type="single" collapsible className="w-full" value={activeSection46A} onValueChange={setActiveSection46A}>
          <AccordionItem value="section46A" className="border-none">
            <AccordionTrigger
              className={cn(
                "flex w-full items-center justify-between py-3 text-foreground hover:no-underline",
                sectionHeadingClass, "border-b-0 mb-0" 
              )}
            >
              <div className="flex items-center gap-2">
                <FileSignature className="mr-2 h-5 w-5 text-primary" />
                46A: Documents Required
              </div>
               {activeSection46A === "section46A" ? 
                <Minus className="h-5 w-5 text-primary" /> : 
                <Plus className="h-5 w-5 text-primary" />}
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={control} name="originalBlQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Original BL Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="copyBlQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Copy BL Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="originalCooQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Original COO Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="copyCooQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Copy COO Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="invoiceQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Invoice Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="packingListQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Packing List Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="beneficiaryCertificateQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Beneficiary Certificate Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="brandNewCertificateQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Brand New Certificate Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="beneficiaryWarrantyCertificateQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Beneficiary's Warranty Certificate Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="beneficiaryComplianceCertificateQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Beneficiary's Compliance Certificate Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="shipmentAdviceQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Shipment Advice Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={control} name="billOfExchangeQty" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />Bill of Exchange Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Separator />

        {/* Section: 47A: Additional Conditions */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <Edit3 className="mr-2 h-5 w-5 text-primary" />
          47A: Additional Conditions
        </h3>
         <FormField
          control={control}
          name="certificateOfOrigin"
          render={() => (
            <FormItem>
              <FormLabel className="text-base font-medium text-foreground flex items-center mb-2">
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
        <FormField
          control={control}
          name="shippingMarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shipping Marks</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter shipping marks as specified in additional conditions" {...field} rows={3} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />

        {/* Section: Document URLs */}
        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <UploadCloud className="mr-2 h-5 w-5 text-primary" /> Document URLs
        </h3>
        <div className="space-y-6">
          <FormField
            control={control}
            name="purchaseOrderUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />OCS / Purchase Order URL</FormLabel>
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
                <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />Final PI URL</FormLabel>
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
                <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />Final LC URL</FormLabel>
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
                <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />Shipping Documents URL</FormLabel>
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
            control={control}
            name="packingListUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />Packing List URL</FormLabel>
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
        <Separator />

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingApplicants || isLoadingBeneficiaries}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Entry...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Submit T/T OR L/C Entry
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

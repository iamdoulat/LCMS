
"use client";

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntry, ShipmentMode, Currency, TrackingCourier, LCStatus, PartialShipmentAllowed, CertificateOfOriginCountry, TermsOfPay, ApplicantOption } from '@/types';
import { termsOfPayOptions, shipmentModeOptions, currencyOptions, trackingCourierOptions, lcStatusOptions, partialShipmentAllowedOptions, certificateOfOriginCountries } from '@/types';
import Swal from 'sweetalert2';
import { isValid, parseISO, format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { doc, addDoc, serverTimestamp, collection, getDocs, deleteField } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, Landmark, FileText, CalendarDays, Ship, Plane, Workflow, Layers, FileSignature, Edit3, BellRing, Users, Building, Hash, ExternalLink, PackageCheck, Search, CheckSquare, UploadCloud, DollarSign, Package, FileIcon, Box, Weight, Scale, Link as LinkIcon, Plus, Minus } from 'lucide-react';
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

const NONE_COURIER_VALUE = "__NONE_LC_NEW__";
const PLACEHOLDER_APPLICANT_VALUE = "__LC_NEW_APPLICANT_PLACEHOLDER__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__LC_NEW_BENEFICIARY_PLACEHOLDER__";
const PLACEHOLDER_PSA_VALUE = "__SELECT_PSA_OPTION_NEW__";


const lcEntrySchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required"),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required"),
  currency: z.enum(currencyOptions, { required_error: "Currency is required" }),
  amount: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive")
  ),
  termsOfPay: z.enum(termsOfPayOptions, { required_error: "Terms of Pay are required" }),
  documentaryCreditNumber: z.string().min(1, "Documentary Credit Number is required"),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional().nullable(),
  totalMachineQty: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Quantity must be a number" }).int().positive("Quantity must be positive")
  ),
  numberOfAmendments: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Amendments must be a non-negative integer.").optional().default(0)),
  status: z.enum(lcStatusOptions, { required_error: "L/C Status is required" }),
  itemDescriptions: z.string().optional(),
  partialShipments: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  consigneeBankNameAddress: z.string().optional(),
  notifyPartyNameAndAddress: z.string().optional(),
  notifyPartyName: z.string().optional(),
  notifyPartyCell: z.string().optional(),
  notifyPartyEmail: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')),
  lcIssueDate: z.date({ required_error: "L/C Issue Date is required." }),
  expireDate: z.date({ required_error: "Expire Date is required." }),
  latestShipmentDate: z.date({ required_error: "Latest Shipment Date is required." }),
  partialShipmentAllowed: z.enum(partialShipmentAllowedOptions).optional(),
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
  shipmentMode: z.enum(shipmentModeOptions, { required_error: "Shipment mode is required."}),
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
  billOfExchangeQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Bill of Exchange Qty cannot be negative").optional().default(0)),
  certificateOfOrigin: z.array(z.enum(certificateOfOriginCountries)).optional(),
  shippingMarks: z.string().optional(),
  purchaseOrderUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  finalPIUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  finalLcUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  shippingDocumentsUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
});

type LCFormValues = z.infer<typeof lcEntrySchema>;

const defaultFormValues: Partial<LCFormValues> = {
  applicantId: '',
  beneficiaryId: '',
  currency: currencyOptions[0],
  termsOfPay: termsOfPayOptions[0],
  status: 'Draft',
  shipmentMode: shipmentModeOptions[0],
  trackingCourier: '',
  documentaryCreditNumber: '',
  proformaInvoiceNumber: '',
  lcIssueDate: undefined,
  expireDate: undefined,
  latestShipmentDate: undefined,
  etd: undefined,
  eta: undefined,
  invoiceDate: undefined,
  purchaseOrderUrl: '',
  finalPIUrl: '',
  finalLcUrl: '',
  shippingDocumentsUrl: '',
  trackingNumber: '',
  itemDescriptions: '',
  consigneeBankNameAddress: '',
  vesselOrFlightName: '',
  vesselImoNumber: '',
  flightNumber: '',
  totalPackageQty: 0,
  totalNetWeight: 0,
  totalGrossWeight: 0,
  totalCbm: 0,
  partialShipments: '',
  portOfLoading: '',
  portOfDischarge: '',
  shippingMarks: '',
  certificateOfOrigin: [],
  notifyPartyNameAndAddress: '',
  notifyPartyName: '',
  notifyPartyCell: '',
  notifyPartyEmail: '',
  numberOfAmendments: 0,
  partialShipmentAllowed: undefined,
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
};

const sectionHeadingClass = "font-bold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-4 flex items-center";

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


  const form = useForm<LCFormValues>({
    resolver: zodResolver(lcEntrySchema),
    defaultValues: defaultFormValues as any, 
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
        console.log("NewLCEntryForm: Fetched Applicant Options:", fetchedApplicants);

        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        setBeneficiaryOptions(
          suppliersSnapshot.docs.map(doc => {
            const data = doc.data() as SupplierDocument;
            return { value: doc.id, label: data.beneficiaryName || 'Unnamed Beneficiary' };
          })
        );
      } catch (error) {
        console.error("Error fetching dropdown data for New L/C Entry Form: ", error);
        Swal.fire("Error", "Could not fetch applicant/beneficiary data. See console for details.", "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };
    fetchDropdownData();
  }, []);

  const watchedApplicantId = watch("applicantId");
  const { setValue: setFormValueForNotify } = form; 

  React.useEffect(() => {
    console.log("NewLCEntryForm: Auto-populate effect triggered. Watched Applicant ID:", watchedApplicantId);
    if (watchedApplicantId && applicantOptions.length > 0) {
      const selectedApplicant = applicantOptions.find(opt => opt.value === watchedApplicantId);
      console.log("NewLCEntryForm: Applicant Options for check:", applicantOptions);
      console.log("NewLCEntryForm: Selected Applicant for auto-fill:", selectedApplicant);
      if (selectedApplicant) {
        setFormValueForNotify("notifyPartyNameAndAddress", selectedApplicant.address || '', { shouldDirty: true, shouldValidate: true });
        console.log("NewLCEntryForm: Setting notifyPartyNameAndAddress to:", selectedApplicant.address);
        setFormValueForNotify("notifyPartyName", selectedApplicant.contactPersonName || '', { shouldDirty: true, shouldValidate: true });
        console.log("NewLCEntryForm: Setting notifyPartyName to:", selectedApplicant.contactPersonName);
        setFormValueForNotify("notifyPartyCell", selectedApplicant.phone || '', { shouldDirty: true, shouldValidate: true });
        console.log("NewLCEntryForm: Setting notifyPartyCell to:", selectedApplicant.phone);
        setFormValueForNotify("notifyPartyEmail", selectedApplicant.email || '', { shouldDirty: true, shouldValidate: true });
        console.log("NewLCEntryForm: Setting notifyPartyEmail to:", selectedApplicant.email);
      }
    }
  }, [watchedApplicantId, applicantOptions, setFormValueForNotify]);


  const watchedShipmentMode = watch("shipmentMode");
  let viaLabel = "Vessel/Flight Name";
  if (watchedShipmentMode === "Sea") {
    viaLabel = "Vessel Name";
  } else if (watchedShipmentMode === "Air") {
    viaLabel = "Flight Name";
  }

  const watchedCurrency = watch("currency");
  const amountLabel = watchedCurrency ? `${watchedCurrency} Amount*` : "Amount*";

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
        "originalBlQty", "copyBlQty", "originalCooQty", "copyCooQty", "invoiceQty", "packingListQty", 
        "beneficiaryCertificateQty", "brandNewCertificateQty", "beneficiaryWarrantyCertificateQty", 
        "beneficiaryComplianceCertificateQty", "shipmentAdviceQty", "billOfExchangeQty"
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
    const firstPartialQty = Number(getValues("firstPartialQty") || 0);
    const secondPartialQty = Number(getValues("secondPartialQty") || 0);
    const thirdPartialQty = Number(getValues("thirdPartialQty") || 0);
    const newTotalQty = firstPartialQty + secondPartialQty + thirdPartialQty;

    const firstPartialAmount = Number(getValues("firstPartialAmount") || 0);
    const secondPartialAmount = Number(getValues("secondPartialAmount") || 0);
    const thirdPartialAmount = Number(getValues("thirdPartialAmount") || 0);
    const newTotalAmount = firstPartialAmount + secondPartialAmount + thirdPartialAmount;
    
    if (watchedPartialShipmentAllowed === "Yes") {
      setTotalCalculatedPartialQty(newTotalQty);
      setTotalCalculatedPartialAmount(newTotalAmount);

      const firstPartialPkgs = Number(getValues("firstPartialPkgs") || 0);
      const secondPartialPkgs = Number(getValues("secondPartialPkgs") || 0);
      const thirdPartialPkgs = Number(getValues("thirdPartialPkgs") || 0);
      const newTotalPkgs = firstPartialPkgs + secondPartialPkgs + thirdPartialPkgs;
      if (Number(getValues("totalPackageQty") || 0) !== newTotalPkgs) {
          setValue("totalPackageQty", newTotalPkgs, { shouldValidate: true, shouldDirty: true });
      }

      const firstPartialNetW = Number(getValues("firstPartialNetWeight") || 0);
      const secondPartialNetW = Number(getValues("secondPartialNetWeight") || 0);
      const thirdPartialNetW = Number(getValues("thirdPartialNetWeight") || 0);
      const newTotalNetW = firstPartialNetW + secondPartialNetW + thirdPartialNetW;
      if (Number(getValues("totalNetWeight") || 0) !== newTotalNetW) {
        setValue("totalNetWeight", newTotalNetW, { shouldValidate: true, shouldDirty: true });
      }

      const firstPartialGrossW = Number(getValues("firstPartialGrossWeight") || 0);
      const secondPartialGrossW = Number(getValues("secondPartialGrossWeight") || 0);
      const thirdPartialGrossW = Number(getValues("thirdPartialGrossWeight") || 0);
      const newTotalGrossW = firstPartialGrossW + secondPartialGrossW + thirdPartialGrossW;
       if (Number(getValues("totalGrossWeight") || 0) !== newTotalGrossW) {
        setValue("totalGrossWeight", newTotalGrossW, { shouldValidate: true, shouldDirty: true });
      }
      
      const firstPartialCbm = Number(getValues("firstPartialCbm") || 0);
      const secondPartialCbm = Number(getValues("secondPartialCbm") || 0);
      const thirdPartialCbm = Number(getValues("thirdPartialCbm") || 0);
      const newTotalCbm = firstPartialCbm + secondPartialCbm + thirdPartialCbm;
       if (Number(getValues("totalCbm") || 0) !== newTotalCbm) {
        setValue("totalCbm", newTotalCbm, { shouldValidate: true, shouldDirty: true });
      }

    } else {
      setTotalCalculatedPartialQty(0);
      setTotalCalculatedPartialAmount(0);
    }
  }, [watchedPartialShipmentAllowed, setValue, getValues, ...watchedPartialValues]);


  async function onSubmit(data: LCFormValues) {
    setIsSubmitting(true);

    const lcIssueDateObj = data.lcIssueDate ? new Date(data.lcIssueDate) : new Date();
    const extractedYear = lcIssueDateObj.getFullYear();

    const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);

    let dataToSave: Partial<Omit<LCEntry, 'id' | 'createdAt' | 'updatedAt' | 'year'>> & { year: number, createdAt: any, updatedAt: any } = {
      applicantId: data.applicantId,
      applicantName: selectedApplicant ? selectedApplicant.label : '',
      beneficiaryId: data.beneficiaryId,
      beneficiaryName: selectedBeneficiary ? selectedBeneficiary.label : '',
      currency: data.currency,
      amount: data.amount,
      termsOfPay: data.termsOfPay,
      documentaryCreditNumber: data.documentaryCreditNumber,
      proformaInvoiceNumber: data.proformaInvoiceNumber,
      invoiceDate: data.invoiceDate ? format(new Date(data.invoiceDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      totalMachineQty: data.totalMachineQty,
      numberOfAmendments: data.numberOfAmendments,
      status: data.status || 'Draft',
      itemDescriptions: data.itemDescriptions,
      partialShipments: data.partialShipments,
      portOfLoading: data.portOfLoading,
      portOfDischarge: data.portOfDischarge,
      consigneeBankNameAddress: data.consigneeBankNameAddress,
      notifyPartyNameAndAddress: data.notifyPartyNameAndAddress,
      notifyPartyName: data.notifyPartyName,
      notifyPartyCell: data.notifyPartyCell,
      notifyPartyEmail: data.notifyPartyEmail,
      lcIssueDate: data.lcIssueDate ? format(new Date(data.lcIssueDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      expireDate: data.expireDate ? format(new Date(data.expireDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      latestShipmentDate: data.latestShipmentDate ? format(new Date(data.latestShipmentDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      partialShipmentAllowed: data.partialShipmentAllowed,
      shipmentMode: data.shipmentMode,
      vesselOrFlightName: data.vesselOrFlightName,
      vesselImoNumber: data.vesselImoNumber,
      flightNumber: data.flightNumber,
      trackingCourier: data.trackingCourier === NONE_COURIER_VALUE ? "" : data.trackingCourier,
      trackingNumber: (data.trackingCourier === "" || data.trackingCourier === NONE_COURIER_VALUE || !data.trackingCourier) ? undefined : data.trackingNumber,
      etd: data.etd ? format(new Date(data.etd), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      eta: data.eta ? format(new Date(data.eta), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      certificateOfOrigin: data.certificateOfOrigin && data.certificateOfOrigin.length > 0 ? data.certificateOfOrigin : undefined,
      shippingMarks: data.shippingMarks,
      purchaseOrderUrl: data.purchaseOrderUrl,
      finalPIUrl: data.finalPIUrl,
      finalLcUrl: data.finalLcUrl,
      shippingDocumentsUrl: data.shippingDocumentsUrl,
      year: extractedYear,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      firstPartialQty: data.partialShipmentAllowed === "Yes" ? data.firstPartialQty : undefined,
      secondPartialQty: data.partialShipmentAllowed === "Yes" ? data.secondPartialQty : undefined,
      thirdPartialQty: data.partialShipmentAllowed === "Yes" ? data.thirdPartialQty : undefined,
      firstPartialAmount: data.partialShipmentAllowed === "Yes" ? data.firstPartialAmount : undefined,
      secondPartialAmount: data.partialShipmentAllowed === "Yes" ? data.secondPartialAmount : undefined,
      thirdPartialAmount: data.partialShipmentAllowed === "Yes" ? data.thirdPartialAmount : undefined,
      firstPartialPkgs: data.partialShipmentAllowed === "Yes" ? data.firstPartialPkgs : undefined,
      secondPartialPkgs: data.partialShipmentAllowed === "Yes" ? data.secondPartialPkgs : undefined,
      thirdPartialPkgs: data.partialShipmentAllowed === "Yes" ? data.thirdPartialPkgs : undefined,
      firstPartialNetWeight: data.partialShipmentAllowed === "Yes" ? data.firstPartialNetWeight : undefined,
      secondPartialNetWeight: data.partialShipmentAllowed === "Yes" ? data.secondPartialNetWeight : undefined,
      thirdPartialNetWeight: data.partialShipmentAllowed === "Yes" ? data.thirdPartialNetWeight : undefined,
      firstPartialGrossWeight: data.partialShipmentAllowed === "Yes" ? data.firstPartialGrossWeight : undefined,
      secondPartialGrossWeight: data.partialShipmentAllowed === "Yes" ? data.secondPartialGrossWeight : undefined,
      thirdPartialGrossWeight: data.partialShipmentAllowed === "Yes" ? data.thirdPartialGrossWeight : undefined,
      firstPartialCbm: data.partialShipmentAllowed === "Yes" ? data.firstPartialCbm : undefined,
      secondPartialCbm: data.partialShipmentAllowed === "Yes" ? data.secondPartialCbm : undefined,
      thirdPartialCbm: data.partialShipmentAllowed === "Yes" ? data.thirdPartialCbm : undefined,
      totalPackageQty: data.partialShipmentAllowed === "Yes"
        ? [data.firstPartialPkgs, data.secondPartialPkgs, data.thirdPartialPkgs].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : data.totalPackageQty,
      totalNetWeight: data.partialShipmentAllowed === "Yes"
        ? [data.firstPartialNetWeight, data.secondPartialNetWeight, data.thirdPartialNetWeight].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : data.totalNetWeight,
      totalGrossWeight: data.partialShipmentAllowed === "Yes"
        ? [data.firstPartialGrossWeight, data.secondPartialGrossWeight, data.thirdPartialGrossWeight].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : data.totalGrossWeight,
      totalCbm: data.partialShipmentAllowed === "Yes"
        ? [data.firstPartialCbm, data.secondPartialCbm, data.thirdPartialCbm].map(p => Number(p) || 0).reduce((s, v) => s + v, 0)
        : data.totalCbm,
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
      billOfExchangeQty: data.billOfExchangeQty,
    };
    
    const cleanedDataToSave = Object.entries(dataToSave).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key as keyof typeof acc] = value;
      }
      return acc;
    }, {} as typeof dataToSave);


    try {
      await addDoc(collection(firestore, "lc_entries"), cleanedDataToSave);
      Swal.fire({
        title: "L/C Entry Saved!",
        text: `L/C entry has been successfully saved.`,
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      });
      reset(defaultFormValues as any);
      setTotalCalculatedPartialQty(0);
      setTotalCalculatedPartialAmount(0);
      setActiveSection46A(undefined);
    } catch (error) {
      console.error("Error adding L/C document: ", error);
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


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || currencyOptions[0]}>
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
            name="termsOfPay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Terms of Pay*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || termsOfPayOptions[0]}>
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
                  <Input placeholder="Enter Documentary Credit Number" {...field} value={field.value ?? ''} />
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
                  <Input placeholder="Enter PI number" {...field} value={field.value ?? ''} />
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
                  <Input type="number" placeholder="0" {...field} value={field.value ?? 0} />
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
                <Select onValueChange={field.onChange} value={field.value || lcStatusOptions[0]}>
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
                  <Input placeholder="e.g., Allowed / Not Allowed" {...field} value={field.value ?? ''} />
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
                  <Input placeholder="Enter port name" {...field} value={field.value ?? ''} />
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
                  <Input placeholder="Enter port name" {...field} value={field.value ?? ''} />
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
                <Textarea placeholder="Describe the items being shipped." {...field} rows={4} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />

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
                    <FormLabel>L/C Issue Date*</FormLabel>
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
                    <FormLabel>Expire Date*</FormLabel>
                    <DatePickerField field={field} placeholder="Select date" />
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
                    <DatePickerField field={field} placeholder="Select date" />
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
              <FormLabel>Partial Shipment Allowed</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === PLACEHOLDER_PSA_VALUE ? undefined : value as PartialShipmentAllowed)}
                value={field.value || PLACEHOLDER_PSA_VALUE}
              >
                <FormControl>
                  <SelectTrigger>
                     <SelectValue placeholder="Select option (Optional)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={PLACEHOLDER_PSA_VALUE} disabled>Select option (Optional)</SelectItem>
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
            <CardHeader className="p-2 pb-4"><CardTitle className="text-md font-medium text-foreground flex items-center"><Package className="mr-2 h-5 w-5 text-muted-foreground" />Partial Shipment Breakdown</CardTitle></CardHeader>
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
        
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 mt-4">
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
                        {watchedPartialShipmentAllowed === 'Yes' ? 'Auto-calculated from partials.' : 'Enter total if no partials.'}
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
                        {watchedPartialShipmentAllowed === 'Yes' ? 'Auto-calculated from partials.' : 'Enter total if no partials.'}
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
                        {watchedPartialShipmentAllowed === 'Yes' ? 'Auto-calculated from partials.' : 'Enter total if no partials.'}
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
                        {watchedPartialShipmentAllowed === 'Yes' ? 'Auto-calculated from partials.' : 'Enter total if no partials.'}
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
                    <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground"/>Total Partial Amount (USD)</FormLabel>
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
                <Select onValueChange={field.onChange} value={field.value || shipmentModeOptions[0]}>
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
        
        <div className="mt-6">
          <h4 className="text-base font-bold text-foreground flex items-center mb-2">
            <PackageCheck className="mr-2 h-5 w-5 text-muted-foreground" /> Original Document Tracking
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
                    <Input placeholder="Enter tracking number" {...field} disabled={!watch("trackingCourier") || watch("trackingCourier") === NONE_COURIER_VALUE} value={field.value ?? ''} />
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
                <Textarea placeholder="Enter bank name and full address" {...field} rows={3} value={field.value ?? ''} />
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
                <Textarea placeholder="Enter notify party's full name and address" {...field} rows={3} value={field.value ?? ''} />
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
          <AccordionItem value="section46A" className="border-none">
             <AccordionTrigger
              className={cn(
                "flex w-full items-center justify-between py-3 font-bold text-xl text-foreground hover:no-underline",
                sectionHeadingClass, "border-b-0 mb-0" 
              )}
            >
              <div className="flex items-center gap-2"> 
                <FileSignature className="mr-2 h-5 w-5 text-primary" />
                46A: Documents Required
              </div>
              {activeSection46A === "section46A" ? <Minus className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
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

        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <Edit3 className="mr-2 h-5 w-5 text-primary" />
          47A: Additional Conditions
        </h3>
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

        <h3 className={cn(sectionHeadingClass, "flex items-center")}>
          <UploadCloud className="mr-2 h-5 w-5 text-primary" /> Document URLs
        </h3>
        <div className="space-y-6">
          <FormField
            control={control}
            name="purchaseOrderUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />Purchase Order URL</FormLabel>
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
        </div>
        <Separator />

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingApplicants || isLoadingBeneficiaries}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving L/C Entry...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Save L/C Entry
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}


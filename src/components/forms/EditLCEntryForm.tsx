

"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntryDocument, Currency, TrackingCourier, LCStatus, ShipmentMode, PartialShipmentAllowed, CertificateOfOriginCountry, TermsOfPay, ApplicantOption, SupplierDocument, ShipmentTerms } from '@/types';
import { termsOfPayOptions, shipmentModeOptions, currencyOptions, trackingCourierOptions, lcStatusOptions, partialShipmentAllowedOptions, certificateOfOriginCountries, lcEntrySchema, toNumberOrUndefined, shipmentTermsOptions } from '@/types';
import Swal from 'sweetalert2';
import { isValid, parseISO, format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { addDoc, serverTimestamp, collection, getDocs, query, where, deleteField, updateDoc, doc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, Landmark, FileText, CalendarDays, Ship, Plane, Layers, FileSignature, Edit3, BellRing, Users, Building, Hash, ExternalLink, PackageCheck, Search, CheckSquare, UploadCloud, DollarSign, Package, FileIcon, Box, Weight, Scale, LinkIcon, Plus, Minus, PlusCircle, Trash2, Save } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '../ui/RichTextEditor';

export type LCEditFormValues = z.infer<typeof lcEntrySchema>;

interface EditLCEntryFormProps {
  initialData: LCEntryDocument;
  lcId: string;
}

const defaultFormValues: LCEditFormValues = {
  applicantId: '',
  beneficiaryId: '',
  currency: currencyOptions[0],
  amount: 0,
  termsOfPay: termsOfPayOptions[0],
  paymentMaturityDate: '',
  documentaryCreditNumber: '',
  proformaInvoiceNumber: '',
  invoiceDate: undefined,
  commercialInvoiceNumber: '',
  commercialInvoiceDate: undefined,
  totalMachineQty: 0,
  numberOfAmendments: 0,
  status: [lcStatusOptions[0]],
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
  purchaseOrderUrl: '',
  finalPIUrl: '',
  finalLcUrl: '',
  shippingDocumentsUrl: '',
  packingListUrl: '',
  trackingCourier: "",
  trackingNumber: "",
  etd: undefined,
  eta: undefined,
  shipmentMode: undefined,
  shipmentTerms: shipmentTermsOptions[0],
  vesselOrFlightName: '',
  vesselImoNumber: '',
  flightNumber: '',
  totalPackageQty: 0,
  totalNetWeight: 0,
  totalGrossWeight: 0,
  totalCbm: 0,
  partialShipmentAllowed: "No",
  firstPartialQty: 0,
  secondPartialQty: 0,
  thirdPartialQty: 0,
  firstPartialAmount: 0,
  secondPartialAmount: 0,
  thirdPartialAmount: 0,
  firstPartialPkgs: 0,
  firstPartialNetWeight: 0,
  firstPartialGrossWeight: 0,
  firstPartialCbm: 0,
  secondPartialPkgs: 0,
  secondPartialNetWeight: 0,
  secondPartialGrossWeight: 0,
  secondPartialCbm: 0,
  thirdPartialPkgs: 0,
  thirdPartialNetWeight: 0,
  thirdPartialGrossWeight: 0,
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
  certificateOfOrigin: [],
  shippingMarks: '',
  isFirstShipment: true,
  isSecondShipment: false,
  isThirdShipment: false,
  firstShipmentNote: '',
  secondShipmentNote: '',
  thirdShipmentNote: '',
};

const sectionHeadingClass = "font-bold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_APPLICANT_VALUE = "__LC_EDIT_APPLICANT_PLACEHOLDER__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__LC_EDIT_BENEFICIARY_PLACEHOLDER__";
const NONE_COURIER_VALUE = "__NONE_LC_NEW_COURIER__";

export function EditLCEntryForm({ initialData, lcId }: EditLCEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ApplicantOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = React.useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = React.useState(true);

  const [activeSection46A, setActiveSection46A] = React.useState<string | undefined>(undefined);
  const [totalCalculatedPartialQty, setTotalCalculatedPartialQty] = React.useState<number>(0);
  const [totalCalculatedPartialAmount, setTotalCalculatedPartialAmount] = React.useState<number>(0);
  const prevPartialShipmentAllowedRef = React.useRef<PartialShipmentAllowed | undefined | null>();
  

  const form = useForm<LCEditFormValues>({
    resolver: zodResolver(lcEntrySchema),
    defaultValues: defaultFormValues,
  });

  const { control, setValue, watch, getValues, reset } = form;

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
        const fetchedBeneficiaries = suppliersSnapshot.docs.map(docSnap => {
          const data = docSnap.data() as SupplierDocument;
          return { value: docSnap.id, label: data.beneficiaryName || 'Unnamed Beneficiary' };
        });
        setBeneficiaryOptions(fetchedBeneficiaries);

      } catch (error) {
        console.error("EditLCEntryForm: Error fetching dropdown data: ", error);
        Swal.fire("Error", "Could not fetch applicant/beneficiary data. See console for details.", "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };
    fetchDropdownData();
  }, []);

  React.useEffect(() => {
    if (initialData && !isLoadingApplicants && !isLoadingBeneficiaries) {
        const currentStatus = Array.isArray(initialData.status)
            ? initialData.status
            : initialData.status
            ? [initialData.status as LCStatus]
            : defaultFormValues.status;

        const valuesToSet: LCEditFormValues = {
            applicantId: initialData.applicantId || defaultFormValues.applicantId,
            beneficiaryId: initialData.beneficiaryId || defaultFormValues.beneficiaryId,
            currency: initialData.currency ?? defaultFormValues.currency,
            amount: initialData.amount ?? defaultFormValues.amount,
            termsOfPay: initialData.termsOfPay ?? defaultFormValues.termsOfPay,
            paymentMaturityDate: initialData.paymentMaturityDate ?? defaultFormValues.paymentMaturityDate,
            documentaryCreditNumber: initialData.documentaryCreditNumber || defaultFormValues.documentaryCreditNumber,
            proformaInvoiceNumber: initialData.proformaInvoiceNumber ?? defaultFormValues.proformaInvoiceNumber,
            invoiceDate: initialData.invoiceDate && isValid(parseISO(initialData.invoiceDate)) ? parseISO(initialData.invoiceDate) : defaultFormValues.invoiceDate,
            commercialInvoiceNumber: initialData.commercialInvoiceNumber ?? defaultFormValues.commercialInvoiceNumber,
            commercialInvoiceDate: initialData.commercialInvoiceDate && isValid(parseISO(initialData.commercialInvoiceDate)) ? parseISO(initialData.commercialInvoiceDate) : defaultFormValues.commercialInvoiceDate,
            totalMachineQty: initialData.totalMachineQty ?? defaultFormValues.totalMachineQty,
            numberOfAmendments: initialData.numberOfAmendments ?? defaultFormValues.numberOfAmendments,
            status: currentStatus,
            itemDescriptions: initialData.itemDescriptions ?? defaultFormValues.itemDescriptions,
            partialShipments: initialData.partialShipments ?? defaultFormValues.partialShipments,
            portOfLoading: initialData.portOfLoading ?? defaultFormValues.portOfLoading,
            portOfDischarge: initialData.portOfDischarge ?? defaultFormValues.portOfDischarge,
            consigneeBankNameAddress: initialData.consigneeBankNameAddress ?? defaultFormValues.consigneeBankNameAddress,
            notifyPartyNameAndAddress: initialData.notifyPartyNameAndAddress ?? defaultFormValues.notifyPartyNameAndAddress,
            notifyPartyName: initialData.notifyPartyName ?? defaultFormValues.notifyPartyName,
            notifyPartyCell: initialData.notifyPartyCell ?? defaultFormValues.notifyPartyCell,
            notifyPartyEmail: initialData.notifyPartyEmail ?? defaultFormValues.notifyPartyEmail,
            lcIssueDate: initialData.lcIssueDate && isValid(parseISO(initialData.lcIssueDate)) ? parseISO(initialData.lcIssueDate) : defaultFormValues.lcIssueDate,
            expireDate: initialData.expireDate && isValid(parseISO(initialData.expireDate)) ? parseISO(initialData.expireDate) : defaultFormValues.expireDate,
            latestShipmentDate: initialData.latestShipmentDate && isValid(parseISO(initialData.latestShipmentDate)) ? parseISO(initialData.latestShipmentDate) : defaultFormValues.latestShipmentDate,
            partialShipmentAllowed: initialData.partialShipmentAllowed ?? defaultFormValues.partialShipmentAllowed,
            firstPartialQty: initialData.firstPartialQty ?? defaultFormValues.firstPartialQty,
            secondPartialQty: initialData.secondPartialQty ?? defaultFormValues.secondPartialQty,
            thirdPartialQty: initialData.thirdPartialQty ?? defaultFormValues.thirdPartialQty,
            firstPartialAmount: initialData.firstPartialAmount ?? defaultFormValues.firstPartialAmount,
            secondPartialAmount: initialData.secondPartialAmount ?? defaultFormValues.secondPartialAmount,
            thirdPartialAmount: initialData.thirdPartialAmount ?? defaultFormValues.thirdPartialAmount,
            firstPartialPkgs: initialData.firstPartialPkgs ?? defaultFormValues.firstPartialPkgs,
            firstPartialNetWeight: initialData.firstPartialNetWeight ?? defaultFormValues.firstPartialNetWeight,
            firstPartialGrossWeight: initialData.firstPartialGrossWeight ?? defaultFormValues.firstPartialGrossWeight,
            firstPartialCbm: initialData.firstPartialCbm ?? defaultFormValues.firstPartialCbm,
            secondPartialPkgs: initialData.secondPartialPkgs ?? defaultFormValues.secondPartialPkgs,
            secondPartialNetWeight: initialData.secondPartialNetWeight ?? defaultFormValues.secondPartialNetWeight,
            secondPartialGrossWeight: initialData.secondPartialGrossWeight ?? defaultFormValues.secondPartialGrossWeight,
            secondPartialCbm: initialData.secondPartialCbm ?? defaultFormValues.secondPartialCbm,
            thirdPartialPkgs: initialData.thirdPartialPkgs ?? defaultFormValues.thirdPartialPkgs,
            thirdPartialNetWeight: initialData.thirdPartialNetWeight ?? defaultFormValues.thirdPartialNetWeight,
            thirdPartialGrossWeight: initialData.thirdPartialGrossWeight ?? defaultFormValues.thirdPartialGrossWeight,
            thirdPartialCbm: initialData.thirdPartialCbm ?? defaultFormValues.thirdPartialCbm,
            totalPackageQty: initialData.totalPackageQty ?? defaultFormValues.totalPackageQty,
            totalNetWeight: initialData.totalNetWeight ?? defaultFormValues.totalNetWeight,
            totalGrossWeight: initialData.totalGrossWeight ?? defaultFormValues.totalGrossWeight,
            totalCbm: initialData.totalCbm ?? defaultFormValues.totalCbm,
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
            certificateOfOrigin: initialData.certificateOfOrigin || defaultFormValues.certificateOfOrigin,
            shippingMarks: initialData.shippingMarks ?? defaultFormValues.shippingMarks,
            purchaseOrderUrl: initialData.purchaseOrderUrl ?? defaultFormValues.purchaseOrderUrl,
            finalPIUrl: initialData.finalPIUrl ?? defaultFormValues.finalPIUrl,
            finalLcUrl: initialData.finalLcUrl ?? defaultFormValues.finalLcUrl,
            shippingDocumentsUrl: initialData.shippingDocumentsUrl ?? defaultFormValues.shippingDocumentsUrl,
            packingListUrl: initialData.packingListUrl ?? defaultFormValues.packingListUrl,
            trackingCourier: initialData.trackingCourier ?? defaultFormValues.trackingCourier,
            trackingNumber: initialData.trackingNumber ?? defaultFormValues.trackingNumber,
            etd: initialData.etd && isValid(parseISO(initialData.etd)) ? parseISO(initialData.etd) : defaultFormValues.etd,
            eta: initialData.eta && isValid(parseISO(initialData.eta)) ? parseISO(initialData.eta) : defaultFormValues.eta,
            shipmentMode: initialData.shipmentMode ?? defaultFormValues.shipmentMode,
            vesselOrFlightName: initialData.vesselOrFlightName ?? defaultFormValues.vesselOrFlightName,
            vesselImoNumber: initialData.vesselImoNumber ?? defaultFormValues.vesselImoNumber,
            flightNumber: initialData.flightNumber ?? defaultFormValues.flightNumber,
            isFirstShipment: initialData.isFirstShipment ?? defaultFormValues.isFirstShipment,
            isSecondShipment: initialData.isSecondShipment ?? defaultFormValues.isSecondShipment,
            isThirdShipment: initialData.isThirdShipment ?? defaultFormValues.isThirdShipment,
            firstShipmentNote: initialData.firstShipmentNote ?? defaultFormValues.firstShipmentNote,
            secondShipmentNote: initialData.secondShipmentNote ?? defaultFormValues.secondShipmentNote,
            thirdShipmentNote: initialData.thirdShipmentNote ?? defaultFormValues.thirdShipmentNote,
        };
      reset(valuesToSet);
    }
  }, [initialData, reset, isLoadingApplicants, isLoadingBeneficiaries, applicantOptions, beneficiaryOptions]);


  const watchedApplicantId = watch("applicantId");

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

  const watchedCurrency = watch("currency");
  const amountLabel = currencyOptions.includes(watchedCurrency as Currency) ? `${watchedCurrency} Amount*` : "Amount*";

  const watchedTermsOfPay = watch("termsOfPay");
  const watchedStatus = watch("status");
  const isDeferredPayment = watchedTermsOfPay && watchedTermsOfPay.startsWith("Deferred");

  const shipmentModeValue = getValues("shipmentMode");
  let viaLabel = "Vessel/Flight/Courier Name";
  if (shipmentModeValue === "Sea") {
    viaLabel = "Vessel Name";
  } else if (shipmentModeValue === "Air") {
    viaLabel = "Flight Name";
  } else if (shipmentModeValue === "By Courier") {
    viaLabel = "Courier Name";
  }

  React.useEffect(() => {
    if (watchedTermsOfPay === "T/T In Advance") {
      setValue("expireDate", undefined, { shouldValidate: true, shouldDirty: true });
      setValue("latestShipmentDate", undefined, { shouldValidate: true, shouldDirty: true });
    }
  }, [watchedTermsOfPay, setValue]);

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
        if(Number(getValues("totalPackageQty") || 0) !== newTotalPkgs){
             setValue("totalPackageQty", newTotalPkgs, { shouldValidate: true, shouldDirty: true });
        }

        const firstPartialNetW = Number(getValues("firstPartialNetWeight") || 0);
        const secondPartialNetW = Number(getValues("secondPartialNetWeight") || 0);
        const thirdPartialNetW = Number(getValues("thirdPartialNetWeight") || 0);
        const newTotalNetW = firstPartialNetW + secondPartialNetW + thirdPartialNetW;
        if(Number(getValues("totalNetWeight") || 0) !== newTotalNetW){
             setValue("totalNetWeight", newTotalNetW, { shouldValidate: true, shouldDirty: true });
        }

        const firstPartialGrossW = Number(getValues("firstPartialGrossWeight") || 0);
        const secondPartialGrossW = Number(getValues("secondPartialGrossWeight") || 0);
        const thirdPartialGrossW = Number(getValues("thirdPartialGrossWeight") || 0);
        const newTotalGrossW = firstPartialGrossW + secondPartialGrossW + thirdPartialGrossW;
        if(Number(getValues("totalGrossWeight") || 0) !== newTotalGrossW){
             setValue("totalGrossWeight", newTotalGrossW, { shouldValidate: true, shouldDirty: true });
        }
        
        const firstPartialCbm = Number(getValues("firstPartialCbm") || 0);
        const secondPartialCbm = Number(getValues("secondPartialCbm") || 0);
        const thirdPartialCbm = Number(getValues("thirdPartialCbm") || 0);
        const newTotalCbm = firstPartialCbm + secondPartialCbm + thirdPartialCbm;
        if(Number(getValues("totalCbm") || 0) !== newTotalCbm){
            setValue("totalCbm", newTotalCbm, { shouldValidate: true, shouldDirty: true });
        }
    }
  }, [watchedPartialShipmentAllowed, ...watchedPartialValues, getValues, setValue, totalCalculatedPartialQty, totalCalculatedPartialAmount]);


  async function onSubmit(finalData: LCEditFormValues) {
    setIsSubmitting(true);

    const lcIssueDateObj = finalData.lcIssueDate ? new Date(finalData.lcIssueDate) : new Date();
    const extractedYear = lcIssueDateObj.getFullYear();

    const selectedApplicant = applicantOptions.find(opt => opt.value === finalData.applicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === finalData.beneficiaryId);

    const dataToUpdate: Partial<Omit<LCEntryDocument, 'id' | 'createdAt'>> & { updatedAt: any } = {
      applicantId: finalData.applicantId,
      applicantName: selectedApplicant ? selectedApplicant.label : initialData.applicantName,
      beneficiaryId: finalData.beneficiaryId,
      beneficiaryName: selectedBeneficiary ? selectedBeneficiary.label : initialData.beneficiaryName,
      currency: finalData.currency,
      termsOfPay: finalData.termsOfPay,
      paymentMaturityDate: finalData.paymentMaturityDate,
      status: finalData.status,
      amount: finalData.amount,
      documentaryCreditNumber: finalData.documentaryCreditNumber,
      proformaInvoiceNumber: finalData.proformaInvoiceNumber,
      invoiceDate: finalData.invoiceDate ? format(new Date(finalData.invoiceDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      commercialInvoiceNumber: finalData.commercialInvoiceNumber,
      commercialInvoiceDate: finalData.commercialInvoiceDate ? format(new Date(finalData.commercialInvoiceDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      totalMachineQty: finalData.totalMachineQty,
      numberOfAmendments: toNumberOrUndefined(finalData.numberOfAmendments),
      itemDescriptions: finalData.itemDescriptions,
      partialShipments: finalData.partialShipments,
      portOfLoading: finalData.portOfLoading,
      portOfDischarge: finalData.portOfDischarge,
      consigneeBankNameAddress: finalData.consigneeBankNameAddress,
      vesselOrFlightName: finalData.vesselOrFlightName,
      vesselImoNumber: finalData.vesselImoNumber,
      flightNumber: finalData.flightNumber,
      trackingCourier: finalData.trackingCourier,
      trackingNumber: (finalData.trackingCourier === "" || !finalData.trackingCourier) ? undefined : finalData.trackingNumber || undefined,
      etd: finalData.etd ? format(new Date(finalData.etd), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      eta: finalData.eta ? format(new Date(finalData.eta), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      shipmentMode: finalData.shipmentMode,
      shipmentTerms: finalData.shipmentTerms,
      certificateOfOrigin: finalData.certificateOfOrigin && finalData.certificateOfOrigin.length > 0 ? finalData.certificateOfOrigin : undefined,
      shippingMarks: finalData.shippingMarks,
      purchaseOrderUrl: finalData.purchaseOrderUrl,
      finalPIUrl: finalData.finalPIUrl,
      finalLcUrl: finalData.finalLcUrl,
      shippingDocumentsUrl: finalData.shippingDocumentsUrl,
      packingListUrl: finalData.packingListUrl,
      notifyPartyNameAndAddress: finalData.notifyPartyNameAndAddress,
      notifyPartyName: finalData.notifyPartyName,
      notifyPartyCell: finalData.notifyPartyCell,
      notifyPartyEmail: finalData.notifyPartyEmail,
      lcIssueDate: finalData.lcIssueDate ? format(new Date(finalData.lcIssueDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      expireDate: finalData.termsOfPay === "T/T In Advance" || !finalData.expireDate ? undefined : format(new Date(finalData.expireDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      latestShipmentDate: finalData.termsOfPay === "T/T In Advance" || !finalData.latestShipmentDate ? undefined : format(new Date(finalData.latestShipmentDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      partialShipmentAllowed: finalData.partialShipmentAllowed,
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
      firstShipmentNote: finalData.firstShipmentNote,
      secondShipmentNote: finalData.secondShipmentNote,
      thirdShipmentNote: finalData.thirdShipmentNote,
      year: extractedYear,
      updatedAt: serverTimestamp(),
    };

    const finalObjectForFirestore: Record<string, any> = {};
    for (const key in dataToUpdate) {
        const typedKey = key as keyof typeof dataToUpdate;
        const value = dataToUpdate[typedKey];
        if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
            finalObjectForFirestore[key] = deleteField();
        } else if (value !== undefined) {
            finalObjectForFirestore[key] = value;
        }
     }


    try {
      const lcDocRef = doc(firestore, "lc_entries", lcId);
      await updateDoc(lcDocRef, finalObjectForFirestore);
      Swal.fire({
        title: "L/C Entry Updated!",
        text: `L/C entry (ID: ${lcId}) has been successfully updated.`,
        icon: "success",
        timer: 1000,
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
    } else if (courier === "UPS") {
      url = `https://www.ups.com/track?track=yes&trackNums=${encodeURIComponent(String(number).trim())}`;
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

  const handleStatusToggle = (toggledStatus: LCStatus) => {
    const currentStatusSet = new Set(getValues('status') || []);

    // Handle Draft exclusivity
    if (toggledStatus === 'Draft') {
      setValue('status', ['Draft']);
      return;
    } else {
      currentStatusSet.delete('Draft');
    }

    // Handle mutually exclusive pairs
    const pairs: [LCStatus, LCStatus][] = [
        ['Shipment Pending', 'Shipment Done'],
        ['Payment Pending', 'Payment Done'],
    ];

    pairs.forEach(([pending, done]) => {
        if (toggledStatus === pending) currentStatusSet.delete(done);
        if (toggledStatus === done) currentStatusSet.delete(pending);
    });

    // Add or remove the toggled status
    if (currentStatusSet.has(toggledStatus)) {
        currentStatusSet.delete(toggledStatus);
    } else {
        currentStatusSet.add(toggledStatus);
    }

    // Ensure 'Draft' is added if no other status is selected
    if (currentStatusSet.size === 0) {
        currentStatusSet.add('Draft');
    }

    setValue('status', Array.from(currentStatusSet), { shouldValidate: true });
  };


  if (isLoadingApplicants || isLoadingBeneficiaries) {
    return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading form options...</span></div>;
  }
  

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
                    value={field.value}
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
                <DatePickerField field={field} placeholder="Select date" />
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
                    value={field.value}
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
          {isDeferredPayment && (
            <FormField
              control={control}
              name="paymentMaturityDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Maturity Date (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Specify maturity details for deferred payment"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
              control={control}
              name="status"
              render={() => (
                <FormItem>
                  <div className="mb-2">
                    <FormLabel className="flex items-center font-semibold"><CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />L/C Status*</FormLabel>
                    <FormDescription>Toggle the applicable statuses for this L/C entry.</FormDescription>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                    {lcStatusOptions.map((item) => (
                      <FormField
                        key={item}
                        control={control}
                        name="status"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <FormLabel className="text-sm font-medium">{item}</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value?.includes(item)}
                                onCheckedChange={() => handleStatusToggle(item)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            <FormField
              control={form.control}
              name="shipmentTerms"
              render={({ field }) => (
                  <FormItem className="space-y-3">
                      <FormLabel>Shipment Terms*</FormLabel>
                      <FormControl>
                          <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex flex-wrap items-center gap-x-4 gap-y-2"
                          >
                              {shipmentTermsOptions.map((option) => (
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
        </div>
        <FormField
          control={form.control}
          name="itemDescriptions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item Descriptions</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Describe the items being shipped..."
                />
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
                    <FormLabel>T/T or L/C Issue Date{watchedStatus?.includes('Draft') ? '' : '*'}</FormLabel>
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
                    <FormLabel>Expire Date{watchedStatus?.includes('Draft') || watchedTermsOfPay === "T/T In Advance" ? '' : '*'}</FormLabel>
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
                    <FormLabel>Latest Shipment Date{watchedStatus?.includes('Draft') || watchedTermsOfPay === "T/T In Advance" ? '' : '*'}</FormLabel>
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
                  value={field.value}
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
                <FormField control={control} name="firstPartialQty" render={({ field }) => (<FormItem><FormLabel>1st P. Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="firstPartialAmount" render={({ field }) => (<FormItem><FormLabel>1st P. Amt ({watch("currency")})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="firstPartialPkgs" render={({ field }) => (<FormItem><FormLabel>1st P. Pkgs</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="firstPartialNetWeight" render={({ field }) => (<FormItem><FormLabel>1st P. Net W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="firstPartialGrossWeight" render={({ field }) => (<FormItem><FormLabel>1st P. Gross W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="firstPartialCbm" render={({ field }) => (<FormItem><FormLabel>1st P. CBM</FormLabel><FormControl><Input type="number" step="0.001" placeholder="0.000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <Separator />
              {/* 2nd Partial Shipment */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-start">
                <FormField control={control} name="secondPartialQty" render={({ field }) => (<FormItem><FormLabel>2nd Partial Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="secondPartialAmount" render={({ field }) => (<FormItem><FormLabel>2nd P. Amt ({watch("currency")})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="secondPartialPkgs" render={({ field }) => (<FormItem><FormLabel>2nd Partial Pkgs</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="secondPartialNetWeight" render={({ field }) => (<FormItem><FormLabel>2nd P. Net W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="secondPartialGrossWeight" render={({ field }) => (<FormItem><FormLabel>2nd P. Gross W. (KGS)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
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
                      value={field.value}
                      className="flex flex-wrap items-center gap-x-6 gap-y-2"
                    >
                      {shipmentModeOptions.map((option) => (
                        <FormItem key={option} className="flex items-center space-x-2 space-y-0">
                          <FormControl><RadioGroupItem value={option} /></FormControl>
                          <FormLabel className="font-normal text-sm">
                              {option === 'Sea' && <Ship className="mr-1 h-4 w-4 inline-block" />}
                              {option === 'Air' && <Plane className="mr-1 h-4 w-4 inline-block" />}
                              {option === 'By Courier' && <FileText className="mr-1 h-4 w-4 inline-block" />}
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
                    placeholder={getValues("shipmentMode") ? `Enter ${viaLabel}` : "Enter name"}
                    {...field}
                    disabled={!getValues("shipmentMode")}
                    value={field.value ?? ''}
                  />
                </FormControl>
                {!getValues("shipmentMode") && <FormDescription>Select shipment mode first.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {getValues("shipmentMode") === 'Sea' && (
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
        {getValues("shipmentMode") === 'Air' && (
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
                          value={field.value ?? ""}
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
            control={form.control}
            name="isFirstShipment"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                <FormLabel className="text-sm font-normal text-foreground">
                  1st Shipment
                </FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isSecondShipment"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                <FormLabel className="text-sm font-normal text-foreground">
                  2nd Shipment
                </FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isThirdShipment"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                <FormLabel className="text-sm font-normal text-foreground">
                  3rd Shipment
                </FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={control}
            name="firstShipmentNote"
            render={({ field }) => (
              <FormItem>
                <FormLabel>1st Shipment Note</FormLabel>
                <FormControl>
                  <Textarea placeholder="Note for 1st shipment..." {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="secondShipmentNote"
            render={({ field }) => (
              <FormItem>
                <FormLabel>2nd Shipment Note</FormLabel>
                <FormControl>
                  <Textarea placeholder="Note for 2nd shipment..." {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="thirdShipmentNote"
            render={({ field }) => (
              <FormItem>
                <FormLabel>3rd Shipment Note</FormLabel>
                <FormControl>
                  <Textarea placeholder="Note for 3rd shipment..." {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
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
          control={form.control}
          name="consigneeBankNameAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Consignee Bank Name and Address</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Enter bank name and full address"
                />
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
                <RichTextEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Enter notify party's full name and address"
                />
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
          control={form.control}
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
          control={form.control}
          name="shippingMarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shipping Marks</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Enter shipping marks as specified in additional conditions"
                />
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

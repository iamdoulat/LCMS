
"use client";

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import type { CustomerDocument, SupplierDocument, Currency, TermsOfPay, LCStatus, PartialShipmentAllowed, ShipmentMode, TrackingCourier, ApplicantOption, CertificateOfOriginCountry } from '@/types';
import { currencyOptions, termsOfPayOptions, lcStatusOptions, partialShipmentAllowedOptions, shipmentModeOptions, trackingCourierOptions, certificateOfOriginCountries } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FileText, Users, Building, Save, CalendarDays, Hash, Package, DollarSign, Layers, Ship, Plane, ExternalLink, Search, PackageCheck, Landmark, BellRing, FileSignature, Edit3, UploadCloud, FileIcon, Box, Weight, Scale, Link as LinkIcon, Plus, Minus } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { format, isValid, parseISO } from 'date-fns';

const toNumberOrUndefined = (val: unknown): number | undefined => {
  if (val === "" || val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
    return undefined;
  }
  const num = Number(String(val).trim());
  return isNaN(num) ? undefined : num;
};

const lcTtEntrySchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required."),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required."),
  currency: z.enum(currencyOptions, { required_error: "Currency is required." }),
  amount: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Amount must be a number." }).positive("Amount must be positive.")
  ),
  lcOrTtNumber: z.string().min(1, "L/C or T/T Number is required."),
  amendmentsNumber: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Amendments must be a non-negative integer.").optional().default(0)),
  totalMachineQty: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Quantity must be a number." }).int().positive("Quantity must be a positive integer.")
  ),
  partialShipments: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  piNumber: z.string().optional(),
  piDate: z.date().optional().nullable(),
  termsOfPay: z.enum(termsOfPayOptions, { required_error: "Terms of Pay are required." }),
  lcStatus: z.enum(lcStatusOptions, { required_error: "L/C Status is required." }),
  itemDescriptionsDetails: z.string().optional(),
  lcIssueDate: z.date({ required_error: "L/C Issue Date is required." }),
  expireDate: z.date({ required_error: "Expire Date is required." }),
  latestShipmentDate: z.date({ required_error: "Latest Shipment Date is required." }),
  partialShipmentAllowed: z.enum(partialShipmentAllowedOptions).optional(),
  firstPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity must be a non-negative integer.").optional()),
  secondPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity must be a non-negative integer.").optional()),
  thirdPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity must be a non-negative integer.").optional()),
  firstPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount must be non-negative.").optional()),
  secondPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount must be non-negative.").optional()),
  thirdPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount must be non-negative.").optional()),
  shipmentMode: z.enum(shipmentModeOptions, { required_error: "Shipment mode is required."}),
  vesselOrFlightName: z.string().optional(),
  vesselImoNumber: z.string().optional(),
  flightNumber: z.string().optional(),
  trackingCourier: z.enum(["", ...trackingCourierOptions]).optional(),
  trackingNumber: z.string().optional(),
  etd: z.date().optional().nullable(),
  eta: z.date().optional().nullable(),
  consigneeBankNameAddress: z.string().optional(),
  notifyPartyNameAndAddress: z.string().optional(),
  notifyPartyName: z.string().optional(), 
  notifyPartyCell: z.string().optional(),
  notifyPartyEmail: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')),
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

type LcTtEntryFormValues = z.infer<typeof lcTtEntrySchema>;

const PLACEHOLDER_APPLICANT_VALUE = "__LCTTT_APPLICANT_PLACEHOLDER__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__LCTTT_BENEFICIARY_PLACEHOLDER__";
const NONE_COURIER_VALUE = "__NONE_LC_TTT_COURIER__"; 
const PLACEHOLDER_PSA_VALUE = "__SELECT_PSA_OPTION__"; // Placeholder for Partial Shipment Allowed

const sectionHeadingClass = "font-bold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

export default function LcTtEntryPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ApplicantOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [totalCalculatedPartialQty, setTotalCalculatedPartialQty] = React.useState<number>(0);
  const [totalCalculatedPartialAmount, setTotalCalculatedPartialAmount] = React.useState<number>(0);
  const [activeSection46A, setActiveSection46A] = React.useState<string | undefined>(undefined);
  const prevPartialShipmentAllowedRef = React.useRef<PartialShipmentAllowed | undefined | null>();


  const form = useForm<LcTtEntryFormValues>({
    resolver: zodResolver(lcTtEntrySchema),
    defaultValues: {
      applicantId: '',
      beneficiaryId: '',
      currency: currencyOptions[0],
      amount: undefined,
      lcOrTtNumber: '',
      amendmentsNumber: 0,
      totalMachineQty: undefined,
      partialShipments: '',
      portOfLoading: '',
      portOfDischarge: '',
      piNumber: '',
      piDate: undefined,
      termsOfPay: termsOfPayOptions[0],
      lcStatus: lcStatusOptions[0],
      itemDescriptionsDetails: '',
      lcIssueDate: new Date(),
      expireDate: new Date(),
      latestShipmentDate: new Date(),
      partialShipmentAllowed: undefined,
      firstPartialQty: 0,
      secondPartialQty: 0,
      thirdPartialQty: 0,
      firstPartialAmount: 0,
      secondPartialAmount: 0,
      thirdPartialAmount: 0,
      shipmentMode: shipmentModeOptions[0],
      vesselOrFlightName: '',
      vesselImoNumber: '',
      flightNumber: '',
      trackingCourier: '',
      trackingNumber: '',
      etd: undefined,
      eta: undefined,
      consigneeBankNameAddress: '',
      notifyPartyNameAndAddress: '',
      notifyPartyName: '',
      notifyPartyCell: '',
      notifyPartyEmail: '',
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

  const { control, watch, setValue, getValues } = form;
  const watchedCurrency = watch("currency");
  const watchedPartialShipmentAllowed = watch("partialShipmentAllowed");
  const watchedShipmentMode = watch("shipmentMode");
  const watchedApplicantId = watch("applicantId");

  const partialFieldsToWatch: (keyof LcTtEntryFormValues)[] = [
    "firstPartialQty", "secondPartialQty", "thirdPartialQty",
    "firstPartialAmount", "secondPartialAmount", "thirdPartialAmount"
  ];
  const watchedPartialValues = watch(partialFieldsToWatch);

  React.useEffect(() => {
    const fetchDropdownData = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, suppliersSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "suppliers"))
        ]);

        setApplicantOptions(
          customersSnap.docs.map(doc => {
            const data = doc.data() as CustomerDocument;
            return { 
                value: doc.id, 
                label: data.applicantName || 'Unnamed Applicant',
                address: data.address,
                contactPersonName: data.contactPerson,
                email: data.email,
                phone: data.phone,
            };
          })
        );

        setBeneficiaryOptions(
          suppliersSnap.docs.map(doc => {
            const data = doc.data() as SupplierDocument;
            return { value: doc.id, label: data.beneficiaryName || 'Unnamed Beneficiary' };
          })
        );
      } catch (error) {
        console.error("Error fetching dropdown data for LC T/T Entry Form: ", error);
        Swal.fire("Error", "Could not load applicant/beneficiary data. See console.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchDropdownData();
  }, []);

  React.useEffect(() => {
    console.log("LC T/T Entry Form: Auto-populate effect triggered. Watched Applicant ID:", watchedApplicantId);
    if (watchedApplicantId && applicantOptions.length > 0) {
      const selectedApplicant = applicantOptions.find(opt => opt.value === watchedApplicantId);
      console.log("LC T/T Entry Form: Applicant Options for check:", applicantOptions);
      console.log("LC T/T Entry Form: Selected Applicant for auto-fill:", selectedApplicant);
      if (selectedApplicant) {
        setValue("notifyPartyNameAndAddress", selectedApplicant.address || '', { shouldDirty: true, shouldValidate: true });
        console.log("LC T/T Entry Form: Setting notifyPartyNameAndAddress to:", selectedApplicant.address);
        setValue("notifyPartyName", selectedApplicant.contactPersonName || '', { shouldDirty: true, shouldValidate: true });
        console.log("LC T/T Entry Form: Setting notifyPartyName to:", selectedApplicant.contactPersonName);
        setValue("notifyPartyCell", selectedApplicant.phone || '', { shouldDirty: true, shouldValidate: true });
        console.log("LC T/T Entry Form: Setting notifyPartyCell to:", selectedApplicant.phone);
        setValue("notifyPartyEmail", selectedApplicant.email || '', { shouldDirty: true, shouldValidate: true });
        console.log("LC T/T Entry Form: Setting notifyPartyEmail to:", selectedApplicant.email);
      }
    }
  }, [watchedApplicantId, applicantOptions, setValue]);


  React.useEffect(() => {
    if (watchedPartialShipmentAllowed === "Yes" && watchedPartialShipmentAllowed !== prevPartialShipmentAllowedRef.current) {
      const fieldsToInitializeZero = [
        "firstPartialQty", "secondPartialQty", "thirdPartialQty",
        "firstPartialAmount", "secondPartialAmount", "thirdPartialAmount",
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
    if (watchedPartialShipmentAllowed === "Yes") {
      const qtys = [getValues("firstPartialQty"), getValues("secondPartialQty"), getValues("thirdPartialQty")].map(q => Number(q || 0));
      const amounts = [getValues("firstPartialAmount"), getValues("secondPartialAmount"), getValues("thirdPartialAmount")].map(a => Number(a || 0));
      setTotalCalculatedPartialQty(qtys.reduce((sum, val) => sum + val, 0));
      setTotalCalculatedPartialAmount(amounts.reduce((sum, val) => sum + val, 0));
    } else {
      setTotalCalculatedPartialQty(0);
      setTotalCalculatedPartialAmount(0);
    }
  }, [watchedPartialShipmentAllowed, ...watchedPartialValues, getValues]);


  async function onSubmit(data: LcTtEntryFormValues) {
    setIsSubmitting(true);
    console.log("LC T/T Entry Data to save (simulated):", data);
    // TODO: Implement Firestore save logic for a new 'lc_tt_entries' collection
    // Convert date objects to ISO strings or Firestore Timestamps before saving.
    // Handle optional fields appropriately (e.g., save as undefined or deleteField() if empty).

    Swal.fire({
      title: "Submission Simulated",
      text: "LC T/T Entry data logged to console. Backend saving not yet implemented.",
      icon: "info",
    });
    // form.reset(); // Optionally reset form
    setIsSubmitting(false);
  }

  const handleTrackDocument = () => {
    const courier = getValues("trackingCourier");
    const number = getValues("trackingNumber");
    if (!courier || courier.trim() === "" || courier === NONE_COURIER_VALUE || !number || number.trim() === "") {
      Swal.fire("Information Missing", "Please select a courier and enter a tracking number.", "info");
      return;
    }
    let url = "";
    if (courier === "DHL") url = `https://www.dhl.com/bd-en/home/tracking.html?tracking-id=${encodeURIComponent(number.trim())}&submit=1`;
    else if (courier === "FedEx") url = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number.trim())}`;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else Swal.fire("Courier Not Supported", "Tracking for the selected courier is not implemented.", "warning");
  };

  const handleTrackVessel = () => {
    const imoNumber = getValues("vesselImoNumber");
    if (!imoNumber || imoNumber.trim() === "") {
      Swal.fire("IMO Number Missing", "Please enter a Vessel IMO number to track.", "info");
      return;
    }
    window.open(`https://www.vesselfinder.com/vessels/details/${encodeURIComponent(imoNumber.trim())}`, '_blank', 'noopener,noreferrer');
  };

  const handleTrackFlight = () => {
    const flightNum = getValues("flightNumber");
    if (!flightNum || flightNum.trim() === "") {
      Swal.fire("Flight Number Missing", "Please enter a flight number to track.", "info");
      return;
    }
    window.open(`https://www.flightradar24.com/${encodeURIComponent(flightNum.trim())}`, '_blank', 'noopener,noreferrer');
  };

  const handleViewUrl = (url: string | undefined | null) => {
    if (url && url.trim() !== "") {
      try {
        new URL(url); // Validate URL structure
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        Swal.fire("Invalid URL", "The provided URL is not valid.", "error");
      }
    } else {
      Swal.fire("No URL", "No URL provided to view.", "info");
    }
  };

  const amountLabel = watchedCurrency ? `${watchedCurrency} Amount*` : "Amount*";
  let viaLabel = "Vessel/Flight Name";
  if (watchedShipmentMode === "Sea") viaLabel = "Vessel Name";
  else if (watchedShipmentMode === "Air") viaLabel = "Flight Name";

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FileText className="h-7 w-7 text-primary" />
            LC T/T Entry
          </CardTitle>
          <CardDescription>
            Fill in the details below to create a new LC T/T Entry. Fields marked with an asterisk (*) are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

              <h3 className={cn(sectionHeadingClass)}>
                <FileText className="mr-2 h-5 w-5 text-primary" />
                Invoice and T/C, L/C Details
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
                        selectPlaceholder={isLoadingDropdowns ? "Loading applicants..." : "Select applicant"}
                        emptyStateMessage="No applicant found."
                        disabled={isLoadingDropdowns}
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
                        selectPlaceholder={isLoadingDropdowns ? "Loading beneficiaries..." : "Select beneficiary"}
                        emptyStateMessage="No beneficiary found."
                        disabled={isLoadingDropdowns}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Currency*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger></FormControl><SelectContent>{currencyOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={control} name="amount" render={({ field }) => (<FormItem><FormLabel>{amountLabel}</FormLabel><FormControl><Input type="number" placeholder="e.g., 50000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="lcOrTtNumber" render={({ field }) => (<FormItem><FormLabel>L/C Or TT Number*</FormLabel><FormControl><Input placeholder="Enter L/C or T/T No." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="amendmentsNumber" render={({ field }) => (<FormItem><FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Amendments Number</FormLabel><FormControl><Input type="number" placeholder="e.g., 0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="totalMachineQty" render={({ field }) => (<FormItem><FormLabel>Total L/C Machine Qty*</FormLabel><FormControl><Input type="number" placeholder="e.g., 5" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="partialShipments" render={({ field }) => (<FormItem><FormLabel>Partial Shipments</FormLabel><FormControl><Input placeholder="e.g., Allowed" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="portOfLoading" render={({ field }) => (<FormItem><FormLabel>Port of Loading</FormLabel><FormControl><Input placeholder="Enter port name" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="portOfDischarge" render={({ field }) => (<FormItem><FormLabel>Port of Discharge</FormLabel><FormControl><Input placeholder="Enter port name" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="piNumber" render={({ field }) => (<FormItem><FormLabel>PI Number</FormLabel><FormControl><Input placeholder="Enter PI number" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="piDate" render={({ field }) => (<FormItem className="flex flex-col pt-0.5"><FormLabel>PI Date</FormLabel><DatePickerField field={field} placeholder="Select PI date" /><FormMessage /></FormItem>)} />
                <FormField control={control} name="termsOfPay" render={({ field }) => ( <FormItem><FormLabel>Terms of Pay*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger></FormControl><SelectContent>{termsOfPayOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={control} name="lcStatus" render={({ field }) => ( <FormItem><FormLabel>L/C Status*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{lcStatusOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <FormField control={control} name="itemDescriptionsDetails" render={({ field }) => (<FormItem><FormLabel>Details Item Descriptions</FormLabel><FormControl><Textarea placeholder="Detailed description of items..." {...field} rows={4} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />

              <Separator />
              <h3 className={cn(sectionHeadingClass)}>
                <CalendarDays className="mr-2 h-5 w-5 text-primary" />
                Important Dates &amp; Partial Shipment Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={control} name="lcIssueDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>L/C Issue Date*</FormLabel><DatePickerField field={field} placeholder="Select L/C Issue Date" /><FormMessage /></FormItem>)} />
                <FormField control={control} name="expireDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Expire Date*</FormLabel><DatePickerField field={field} placeholder="Select Expire Date" /><FormMessage /></FormItem>)} />
                <FormField control={control} name="latestShipmentDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Latest Shipment Date*</FormLabel><DatePickerField field={field} placeholder="Select Latest Shipment Date" /><FormMessage /></FormItem>)} />
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
                          <SelectValue /> {/* Placeholder is handled by the first disabled SelectItem */}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={PLACEHOLDER_PSA_VALUE} disabled>
                          Select option (Optional)
                        </SelectItem>
                        {partialShipmentAllowedOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
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
                    {[
                      { qty: "firstPartialQty", amount: "firstPartialAmount", labelPrefix: "1st" },
                      { qty: "secondPartialQty", amount: "secondPartialAmount", labelPrefix: "2nd" },
                      { qty: "thirdPartialQty", amount: "thirdPartialAmount", labelPrefix: "3rd" },
                    ].map((partial, index) => (
                      <React.Fragment key={index}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 items-start">
                          <FormField control={control} name={partial.qty as any} render={({ field }) => (<FormItem><FormLabel>{partial.labelPrefix} Partial Qty</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={control} name={partial.amount as any} render={({ field }) => (<FormItem><FormLabel>{partial.labelPrefix} Partial Amount ({watchedCurrency})</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        {index < 2 && <Separator />}
                      </React.Fragment>
                    ))}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <FormItem>
                            <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4 text-muted-foreground"/>Total Machine Qty</FormLabel>
                            <FormControl><Input type="text" value={totalCalculatedPartialQty} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" /></FormControl>
                        </FormItem>
                        <FormItem>
                            <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground"/>Total Partial Amount ({watchedCurrency})</FormLabel>
                            <FormControl><Input type="text" value={totalCalculatedPartialAmount.toFixed(2)} readOnly disabled className="bg-muted/50 cursor-not-allowed font-semibold" /></FormControl>
                        </FormItem>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select shipment mode" /></SelectTrigger></FormControl>
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
                        <FormControl><Input placeholder={watchedShipmentMode ? `Enter ${viaLabel}` : "Enter name"} {...field} value={field.value ?? ''} disabled={!watchedShipmentMode} /></FormControl>
                        {!watchedShipmentMode && <FormDescription>Select shipment mode first.</FormDescription>}
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>

                {watchedShipmentMode === 'Sea' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end mt-4">
                        <FormField control={control} name="vesselImoNumber" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel>Vessel IMO Number</FormLabel><FormControl><Input placeholder="Enter Vessel IMO Number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <Button type="button" variant="default" onClick={handleTrackVessel} disabled={!watch("vesselImoNumber")} className="md:col-span-1" title="Track Vessel"><Search className="mr-2 h-4 w-4" />Track Vessel</Button>
                    </div>
                )}
                {watchedShipmentMode === 'Air' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end mt-4">
                        <FormField control={control} name="flightNumber" render={({ field }) => ( <FormItem className="md:col-span-2"><FormLabel>Flight Number</FormLabel><FormControl><Input placeholder="Enter Flight Number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <Button type="button" variant="default" onClick={handleTrackFlight} disabled={!watch("flightNumber")} className="md:col-span-1" title="Track Flight"><Search className="mr-2 h-4 w-4" />Track Flight</Button>
                    </div>
                )}
                
                <div className="mt-6">
                    <h4 className="text-base font-medium text-foreground flex items-center mb-2"><PackageCheck className="mr-2 h-5 w-5 text-muted-foreground" /> Original Document Tracking</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end">
                        <FormField
                        control={control}
                        name="trackingCourier"
                        render={({ field }) => (
                            <FormItem className="md:col-span-1">
                            <FormLabel>Courier By</FormLabel>
                            <Select
                                onValueChange={(value) => field.onChange(value === NONE_COURIER_VALUE ? "" : value)}
                                value={field.value && trackingCourierOptions.includes(field.value as TrackingCourier) ? field.value : NONE_COURIER_VALUE}
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
                        <FormField control={control} name="trackingNumber" render={({ field }) => (<FormItem className="md:col-span-1"><FormLabel>Tracking Number</FormLabel><FormControl><Input placeholder="Enter tracking number" {...field} disabled={!watch("trackingCourier") || watch("trackingCourier") === NONE_COURIER_VALUE} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <Button type="button" variant="default" onClick={handleTrackDocument} disabled={!watch("trackingNumber") || !watch("trackingCourier") || watch("trackingCourier") === NONE_COURIER_VALUE} className="md:col-span-1 mt-4 md:mt-0" title="Track Original Document"><ExternalLink className="mr-2 h-4 w-4" />Track</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <FormField control={control} name="etd" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>ETD (Estimated Time of Departure)</FormLabel><DatePickerField field={field} placeholder="Select ETD" /><FormMessage /></FormItem>)} />
                    <FormField control={control} name="eta" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>ETA (Estimated Time of Arrival)</FormLabel><DatePickerField field={field} placeholder="Select ETA" /><FormMessage /></FormItem>)} />
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

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingDropdowns}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Entry...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save LC T/T Entry
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

    
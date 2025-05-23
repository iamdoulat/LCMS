
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import type { CustomerDocument, SupplierDocument, Currency, TermsOfPay, LCStatus, PartialShipmentAllowed, ShipmentMode, TrackingCourier } from '@/types';
import { currencyOptions, termsOfPayOptions, lcStatusOptions, partialShipmentAllowedOptions, shipmentModeOptions, trackingCourierOptions } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FileText, Users, Building, Save, CalendarDays, Hash, Package, DollarSign, Layers, Ship, Plane, ExternalLink, Search, PackageCheck } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Separator } from '@/components/ui/separator';
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
  amendmentsNumber: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Amendments must be a non-negative integer.").optional()),
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
});

type LcTtEntryFormValues = z.infer<typeof lcTtEntrySchema>;

const PLACEHOLDER_APPLICANT_VALUE = "__LCTTT_APPLICANT_PLACEHOLDER__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__LCTTT_BENEFICIARY_PLACEHOLDER__";
const NONE_COURIER_VALUE = "__NONE_LC_TTT_COURIER__";

const sectionHeadingClass = "font-bold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

export default function LcTtEntryPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [totalCalculatedPartialQty, setTotalCalculatedPartialQty] = React.useState<number>(0);
  const [totalCalculatedPartialAmount, setTotalCalculatedPartialAmount] = React.useState<number>(0);
  const prevPartialShipmentAllowedRef = React.useRef<PartialShipmentAllowed | undefined>();


  const form = useForm<LcTtEntryFormValues>({
    resolver: zodResolver(lcTtEntrySchema),
    defaultValues: {
      applicantId: '',
      beneficiaryId: '',
      currency: currencyOptions[0],
      amount: undefined,
      lcOrTtNumber: '',
      amendmentsNumber: undefined,
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
    },
  });

  const { control, watch, setValue, getValues } = form;
  const watchedCurrency = watch("currency");
  const watchedPartialShipmentAllowed = watch("partialShipmentAllowed");
  const watchedShipmentMode = watch("shipmentMode");

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
            return { value: doc.id, label: data.applicantName || 'Unnamed Applicant' };
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
                <FormField control={control} name="partialShipments" render={({ field }) => (<FormItem><FormLabel>Partial Shipments</FormLabel><FormControl><Input placeholder="e.g., Allowed" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="portOfLoading" render={({ field }) => (<FormItem><FormLabel>Port of Loading</FormLabel><FormControl><Input placeholder="Enter port name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="portOfDischarge" render={({ field }) => (<FormItem><FormLabel>Port of Discharge</FormLabel><FormControl><Input placeholder="Enter port name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="piNumber" render={({ field }) => (<FormItem><FormLabel>PI Number</FormLabel><FormControl><Input placeholder="Enter PI number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={control} name="piDate" render={({ field }) => (<FormItem className="flex flex-col pt-0.5"><FormLabel>PI Date</FormLabel><DatePickerField field={field} placeholder="Select PI date" /><FormMessage /></FormItem>)} />
                <FormField control={control} name="termsOfPay" render={({ field }) => ( <FormItem><FormLabel>Terms of Pay*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger></FormControl><SelectContent>{termsOfPayOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={control} name="lcStatus" render={({ field }) => ( <FormItem><FormLabel>L/C Status*</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{lcStatusOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <FormField control={control} name="itemDescriptionsDetails" render={({ field }) => (<FormItem><FormLabel>Details Item Descriptions</FormLabel><FormControl><Textarea placeholder="Detailed description of items..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />

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
                        onValueChange={(value) => field.onChange(value === "" ? undefined : value)}
                        value={field.value ?? ""}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select option (Optional)" /></SelectTrigger></FormControl>
                      <SelectContent>
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
              <h3 className={cn(sectionHeadingClass)}>
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
                        <FormField control={control} name="trackingCourier" render={({ field }) => (<FormItem className="md:col-span-1"><FormLabel>Courier By</FormLabel><Select onValueChange={(value) => field.onChange(value === NONE_COURIER_VALUE ? "" : value)} value={field.value === "" || field.value === undefined ? NONE_COURIER_VALUE : field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Courier" /></SelectTrigger></FormControl><SelectContent><SelectItem value={NONE_COURIER_VALUE}>None</SelectItem>{trackingCourierOptions.map(courier => (<SelectItem key={courier} value={courier}>{courier}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={control} name="trackingNumber" render={({ field }) => (<FormItem className="md:col-span-1"><FormLabel>Tracking Number</FormLabel><FormControl><Input placeholder="Enter tracking number" {...field} disabled={!watch("trackingCourier") || watch("trackingCourier") === NONE_COURIER_VALUE} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <Button type="button" variant="default" onClick={handleTrackDocument} disabled={!watch("trackingNumber") || !watch("trackingCourier") || watch("trackingCourier") === NONE_COURIER_VALUE} className="md:col-span-1 mt-4 md:mt-0" title="Track Original Document"><ExternalLink className="mr-2 h-4 w-4" />Track</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <FormField control={control} name="etd" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>ETD (Estimated Time of Departure)</FormLabel><DatePickerField field={field} placeholder="Select ETD" /><FormMessage /></FormItem>)} />
                    <FormField control={control} name="eta" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>ETA (Estimated Time of Arrival)</FormLabel><DatePickerField field={field} placeholder="Select ETA" /><FormMessage /></FormItem>)} />
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


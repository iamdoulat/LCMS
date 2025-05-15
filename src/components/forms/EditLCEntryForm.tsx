
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntryDocument, Currency, TrackingCourier, LCStatus, ShipmentMode } from '@/types';
// Removed unused options imports: termsOfPayOptions, shipmentModeOptions, currencyOptions, trackingCourierOptions, lcStatusOptions
import Swal from 'sweetalert2';
import { isValid, parseISO, format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, Landmark, FileText, CalendarDays, Ship, Plane, Workflow, FileSignature, Edit3, BellRing, Users, Building, Hash, ExternalLink, PackageCheck, Search, Save, Info } from 'lucide-react';
// Removed Select imports as they are no longer used for these fields on this form
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Schema now only includes fields that are directly editable on this form.
// Fields like applicantName, beneficiaryName, currency, termsOfPay, status, shipmentMode, trackingCourier
// will be displayed from initialData but are not part of the form's editable state or validation here.
const lcEntrySchema = z.object({
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
  bankTin: z.string().optional(),
  vesselOrFlightName: z.string().optional(),
  vesselImoNumber: z.string().optional(),
  partialShipments: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  documentsRequired: z.string().optional(),
  shippingMarks: z.string().optional(),
  certificateOfOrigin: z.string().optional(),
  notifyPartyNameAndAddress: z.string().optional(),
  notifyPartyContactDetails: z.string().optional(),
  numberOfAmendments: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Number of amendments must be a number" }).int().nonnegative("Number of amendments cannot be negative").optional().or(z.literal(''))
  ),
});

type LCEditFormValues = z.infer<typeof lcEntrySchema>;

interface EditLCEntryFormProps {
  initialData: LCEntryDocument;
  lcId: string;
}

export function EditLCEntryForm({ initialData, lcId }: EditLCEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const form = useForm<LCEditFormValues>({
    resolver: zodResolver(lcEntrySchema),
  });

  React.useEffect(() => {
    if (initialData) {
      console.log("Initial L/C Data for Edit Form:", initialData);
      form.reset({
        // Only reset fields that are part of the LCEditFormValues (editable fields)
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
        bankTin: initialData.bankTin || '',
        vesselOrFlightName: initialData.vesselOrFlightName || '',
        vesselImoNumber: initialData.vesselImoNumber || '',
        partialShipments: initialData.partialShipments || '',
        portOfLoading: initialData.portOfLoading || '',
        portOfDischarge: initialData.portOfDischarge || '',
        documentsRequired: initialData.documentsRequired || '',
        shippingMarks: initialData.shippingMarks || '',
        certificateOfOrigin: initialData.certificateOfOrigin || '',
        notifyPartyNameAndAddress: initialData.notifyPartyNameAndAddress || '',
        notifyPartyContactDetails: initialData.notifyPartyContactDetails || '',
        numberOfAmendments: initialData.numberOfAmendments !== undefined ? initialData.numberOfAmendments : undefined,
      });
    }
  }, [initialData, form]);

  async function onSubmit(data: LCEditFormValues) {
    setIsSubmitting(true);
    
    const dataToUpdate: Partial<LCEntryDocument> = {
      // Editable fields from the form
      ...data, 
      
      // Preserve non-editable (display-only) fields from initialData
      applicantId: initialData.applicantId,
      applicantName: initialData.applicantName,
      beneficiaryId: initialData.beneficiaryId,
      beneficiaryName: initialData.beneficiaryName,
      currency: initialData.currency,
      termsOfPay: initialData.termsOfPay,
      status: initialData.status,
      shipmentMode: initialData.shipmentMode,
      trackingCourier: initialData.trackingCourier,
      
      // Ensure correct types for numbers and dates
      amount: Number(data.amount),
      totalMachineQty: data.totalMachineQty !== undefined ? Number(data.totalMachineQty) : undefined,
      numberOfAmendments: data.numberOfAmendments !== '' && data.numberOfAmendments !== undefined && data.numberOfAmendments !== null ? Number(data.numberOfAmendments) : undefined,
      
      lcIssueDate: data.lcIssueDate ? format(data.lcIssueDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      expireDate: data.expireDate ? format(data.expireDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      latestShipmentDate: data.latestShipmentDate ? format(data.latestShipmentDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      invoiceDate: data.invoiceDate ? format(data.invoiceDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      etd: data.etd ? format(data.etd, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      eta: data.eta ? format(data.eta, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      
      updatedAt: serverTimestamp() as any,
      year: data.lcIssueDate ? new Date(data.lcIssueDate).getFullYear() : initialData.year,
    };
        
    // Clean up undefined fields before sending to Firestore
    for (const key in dataToUpdate) {
        if (dataToUpdate[key as keyof typeof dataToUpdate] === undefined) {
            delete dataToUpdate[key as keyof typeof dataToUpdate];
        }
    }
    
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
    } catch (error) {
      console.error("Error updating L/C document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update L/C entry: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const watchedShipmentModeFromInitial = initialData.shipmentMode; // Use initialData for display logic
  let viaLabel = "Vessel/Flight Name";
  if (watchedShipmentModeFromInitial === "Sea") {
    viaLabel = "Vessel Name";
  } else if (watchedShipmentModeFromInitial === "Air") {
    viaLabel = "Flight Name";
  }

  const amountLabel = initialData.currency ? `${initialData.currency} Amount*` : "Amount*";
  
  const handleTrackDocument = () => {
    const courier = initialData.trackingCourier; // Use initialData for tracking
    const number = form.getValues("trackingNumber"); // Tracking number is editable

    if (!courier || courier.trim() === "" || !number || number.trim() === "") {
      Swal.fire({
        title: "Information Missing",
        text: "Courier is not set or tracking number is missing.",
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
        text: "Tracking for the selected courier is not implemented or courier not set.",
        icon: "warning",
      });
    }
  };

  const handleTrackVessel = () => {
    const imoNumber = form.getValues("vesselImoNumber"); // IMO number is editable
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


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        <h3 className="text-lg font-semibold border-b pb-2 text-foreground flex items-center">
          <FileText className="mr-2 h-5 w-5 text-primary" />
          L/C & Invoice Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormItem>
            <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Applicant Name*</FormLabel>
            <FormControl>
              <Input value={initialData.applicantName || 'N/A'} readOnly disabled className="cursor-not-allowed bg-muted/50" />
            </FormControl>
            <FormDescription>Applicant for this L/C (cannot be changed here).</FormDescription>
          </FormItem>
          
          <FormItem>
            <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Beneficiary Name*</FormLabel>
            <FormControl>
              <Input value={initialData.beneficiaryName || 'N/A'} readOnly disabled className="cursor-not-allowed bg-muted/50" />
            </FormControl>
            <FormDescription>Beneficiary for this L/C (cannot be changed here).</FormDescription>
          </FormItem>

          <FormItem>
            <FormLabel>Currency*</FormLabel>
            <FormControl>
                <Input value={initialData.currency || 'N/A'} readOnly disabled className="cursor-not-allowed bg-muted/50" />
            </FormControl>
            <FormDescription>Currency of this L/C (cannot be changed here).</FormDescription>
          </FormItem>

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
          <FormItem>
            <FormLabel>Terms of Pay*</FormLabel>
            <FormControl>
                <Input value={initialData.termsOfPay || 'N/A'} readOnly disabled className="cursor-not-allowed bg-muted/50" />
            </FormControl>
            <FormDescription>Terms of pay for this L/C (cannot be changed here).</FormDescription>
          </FormItem>

          <FormField
            control={form.control}
            name="documentaryCreditNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Documentary Credit Number*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Documentary Credit Number" {...field} />
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
                  <Input placeholder="Enter PI number" {...field} />
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
                <FormLabel>Total Machine Qty*</FormLabel>
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
          <FormItem>
            <FormLabel className="flex items-center"><Info className="mr-2 h-4 w-4 text-muted-foreground" />L/C Status*</FormLabel>
            <FormControl>
                <Input value={initialData.status || 'N/A'} readOnly disabled className="cursor-not-allowed bg-muted/50" />
            </FormControl>
            <FormDescription>Current status of this L/C (cannot be changed here).</FormDescription>
          </FormItem>
        </div>
        <FormField
            control={form.control}
            name="itemDescriptions"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Item Descriptions</FormLabel>
                <FormControl>
                <Textarea placeholder="Describe the items being shipped." {...field} rows={4} />
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
                <FormLabel>43P: Partial Shipments</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Allowed / Not Allowed" {...field} />
                </FormControl>
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
                  <Input placeholder="Enter port name" {...field} />
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
                  <Input placeholder="Enter port name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-4 text-foreground flex items-center">
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
                <Textarea placeholder="Enter bank name and full address" {...field} rows={3}/>
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="bankBin"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Bank BIN</FormLabel>
                    <FormControl>
                    <Input placeholder="Enter Bank Identification Number" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="bankTin"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Bank TIN</FormLabel>
                    <FormControl>
                    <Input placeholder="Enter Taxpayer Identification Number" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-4 text-foreground flex items-center">
            <BellRing className="mr-2 h-5 w-5 text-primary" />
            Notify Details
        </h3>
        <FormField
            control={form.control}
            name="notifyPartyNameAndAddress"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Notify Party name and Address</FormLabel>
                <FormControl>
                <Textarea placeholder="Enter notify party's name and full address" {...field} rows={3}/>
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="notifyPartyContactDetails"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Notify Party Contact Details</FormLabel>
                <FormControl>
                <Input placeholder="e.g., Phone or Email" {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />


        <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-4 text-foreground flex items-center">
            <CalendarDays className="mr-2 h-5 w-5 text-primary" />
            Important Dates
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

        <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-4 text-foreground flex items-center">
            <Workflow className="mr-2 h-5 w-5 text-primary" />
            Shipping Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <FormItem>
                <FormLabel>Shipment Mode*</FormLabel>
                <FormControl>
                    <Input value={initialData.shipmentMode || 'N/A'} readOnly disabled className="cursor-not-allowed bg-muted/50" />
                </FormControl>
                <FormDescription>Shipment mode for this L/C (cannot be changed here).</FormDescription>
            </FormItem>
            <FormField
                control={form.control}
                name="vesselOrFlightName"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>{viaLabel}</FormLabel>
                    <FormControl>
                    <Input
                        placeholder={watchedShipmentModeFromInitial ? `Enter ${watchedShipmentModeFromInitial === "Sea" ? "Vessel" : "Flight"} name` : "Enter name"}
                        {...field}
                        disabled={!watchedShipmentModeFromInitial}
                    />
                    </FormControl>
                    {!watchedShipmentModeFromInitial && <FormDescription>Shipment mode not set.</FormDescription>}
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        {watchedShipmentModeFromInitial === 'Sea' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end mt-4">
                <FormField
                    control={form.control}
                    name="vesselImoNumber"
                    render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Vessel IMO Number</FormLabel>
                            <FormControl>
                                <Input placeholder="Enter Vessel IMO Number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="button"
                    variant="outline"
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

         <div className="mt-6">
            <FormLabel className="text-base font-semibold text-foreground flex items-center mb-2">
                <PackageCheck className="mr-2 h-5 w-5 text-muted-foreground" /> Original Document Tracking
            </FormLabel>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end">
                <FormItem className="md:col-span-1">
                    <FormLabel>Courier</FormLabel>
                    <FormControl>
                        <Input value={initialData.trackingCourier || 'N/A'} readOnly disabled className="cursor-not-allowed bg-muted/50" />
                    </FormControl>
                    <FormDescription>Courier (cannot be changed here).</FormDescription>
                </FormItem>
                <FormField
                    control={form.control}
                    name="trackingNumber"
                    render={({ field }) => (
                    <FormItem className="md:col-span-1">
                        <FormLabel>Tracking Number</FormLabel>
                        <FormControl>
                        <Input placeholder="Enter tracking number" {...field} disabled={!initialData.trackingCourier} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleTrackDocument}
                    disabled={!form.watch("trackingNumber") || !initialData.trackingCourier || isSubmitting}
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

        <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-4 text-foreground flex items-center">
            <FileSignature className="mr-2 h-5 w-5 text-primary" />
            46A: Documents Required
        </h3>
        <FormField
            control={form.control}
            name="documentsRequired"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Full Set of Documents</FormLabel>
                <FormControl>
                <Textarea placeholder="Specify all required documents as per L/C terms" {...field} rows={5} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="certificateOfOrigin"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Certificate of Origin</FormLabel>
                    <FormControl>
                    <Input placeholder="e.g., Required / Not Required / Specify details" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-4 text-foreground flex items-center">
            <Edit3 className="mr-2 h-5 w-5 text-primary" />
            47A: Additional Conditions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="shippingMarks"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Shipping Marks</FormLabel>
                    <FormControl>
                    <Input placeholder="Enter shipping marks as specified" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        
        {/* File uploads are not part of this edit form for simplicity. 
            Could display existing file URLs/names if available in initialData.
        */}
         <FormItem>
            <FormLabel>Final PI Document</FormLabel>
            <Input value={initialData.finalPIUrl ? "File previously uploaded" : "No file uploaded"} readOnly disabled className="cursor-not-allowed bg-muted/50" />
            <FormDescription>Final PI file (cannot be changed here).</FormDescription>
        </FormItem>
        <FormItem>
            <FormLabel>Shipping Documents</FormLabel>
            <Input value={initialData.shippingDocumentsUrl ? "File previously uploaded" : "No file uploaded"} readOnly disabled className="cursor-not-allowed bg-muted/50" />
            <FormDescription>Shipping documents (cannot be changed here).</FormDescription>
        </FormItem>


        <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting}>
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

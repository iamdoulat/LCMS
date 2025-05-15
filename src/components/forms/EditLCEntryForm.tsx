
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntryDocument, Currency, TrackingCourier, CustomerDocument, SupplierDocument, LCStatus } from '@/types';
import { termsOfPayOptions, shipmentModeOptions, currencyOptions, trackingCourierOptions, lcStatusOptions } from '@/types';
// Removed AI import as it's not used in edit form: import { extractShippingData, type ExtractShippingDataOutput } from '@/ai/flows/extract-shipping-data';
import Swal from 'sweetalert2';
import { isValid, parseISO, format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
// Removed FileInput import as file re-upload is not handled in this version
// import { FileInput } from './FileInput'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileScan, Loader2, Info, Landmark, Library, FileText, CalendarDays, Ship, Plane, Workflow, Layers, FileSignature, Edit3, BellRing, Users, Building, Hash, ExternalLink, PackageCheck, Search, CheckSquare, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Schema is largely the same as NewLCEntryForm, ensure consistency
const lcEntrySchema = z.object({
  // beneficiaryName stores the ID of the selected beneficiary (from suppliers)
  beneficiaryName: z.string().min(1, "Beneficiary ID is required"), 
  // applicantName stores the ID of the selected applicant (from customers)
  applicantName: z.string().min(1, "Applicant ID is required"), 
  currency: z.enum(currencyOptions, { required_error: "Currency is required" }),
  amount: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive")
  ),
  termsOfPay: z.enum(termsOfPayOptions, { required_error: "Terms of pay are required" }),
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
  trackingCourier: z.enum(["", ...trackingCourierOptions]).optional(),
  trackingNumber: z.string().optional(),
  etd: z.date().optional().nullable(),
  eta: z.date().optional().nullable(),
  itemDescriptions: z.string().optional(),
  consigneeBankNameAddress: z.string().optional(),
  bankBin: z.string().optional(),
  bankTin: z.string().optional(),
  shipmentMode: z.enum(shipmentModeOptions, { required_error: "Shipment mode is required" }),
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
  status: z.enum(lcStatusOptions, { required_error: "L/C Status is required"})
});

type LCEditFormValues = z.infer<typeof lcEntrySchema>;

interface DropdownOption {
  value: string; // Firestore document ID
  label: string; // Name to display
}

interface EditLCEntryFormProps {
  initialData: LCEntryDocument;
  lcId: string;
}

export function EditLCEntryForm({ initialData, lcId }: EditLCEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [applicantOptions, setApplicantOptions] = React.useState<DropdownOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<DropdownOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = React.useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = React.useState(true);

  const form = useForm<LCEditFormValues>({
    resolver: zodResolver(lcEntrySchema),
    // Default values will be set by form.reset in useEffect below
  });

  // Fetch applicant (customer) options for dropdown
  React.useEffect(() => {
    const fetchApplicants = async () => {
      setIsLoadingApplicants(true);
      try {
        const querySnapshot = await getDocs(collection(firestore, "customers"));
        const fetchedApplicants = querySnapshot.docs.map(doc => {
          const data = doc.data() as CustomerDocument;
          return { value: doc.id, label: data.applicantName || `Unnamed Applicant (${doc.id.substring(0,5)})` };
        });
        setApplicantOptions(fetchedApplicants);
        console.log("Fetched Applicant Options:", fetchedApplicants);
      } catch (error) {
        console.error("Error fetching applicants for dropdown: ", error);
        Swal.fire("Error", "Could not fetch applicant data for dropdown. See console.", "error");
      } finally {
        setIsLoadingApplicants(false);
      }
    };
    fetchApplicants();
  }, []);

  // Fetch beneficiary (supplier) options for dropdown
  React.useEffect(() => {
    const fetchBeneficiaries = async () => {
      setIsLoadingBeneficiaries(true);
      try {
        const querySnapshot = await getDocs(collection(firestore, "suppliers"));
        const fetchedBeneficiaries = querySnapshot.docs.map(doc => {
          const data = doc.data() as SupplierDocument;
          return { value: doc.id, label: data.beneficiaryName || `Unnamed Beneficiary (${doc.id.substring(0,5)})` };
        });
        setBeneficiaryOptions(fetchedBeneficiaries);
        console.log("Fetched Beneficiary Options:", fetchedBeneficiaries);
      } catch (error) {
        console.error("Error fetching beneficiaries for dropdown: ", error);
        Swal.fire("Error", "Could not fetch beneficiary data for dropdown. See console.", "error");
      } finally {
        setIsLoadingBeneficiaries(false);
      }
    };
    fetchBeneficiaries();
  }, []);

  // Populate form with initialData once it's available
  React.useEffect(() => {
    if (initialData) {
      console.log("Initial L/C Data for Form:", initialData);
      console.log("Setting Applicant ID in form:", initialData.applicantId);
      console.log("Setting Beneficiary ID in form:", initialData.beneficiaryId);
      form.reset({
        ...initialData, // Spread initial data first
        // Crucially, the form fields 'applicantName' and 'beneficiaryName' must be set to the IDs
        // that correspond to the 'value' of the SelectItem options.
        applicantName: initialData.applicantId || '', 
        beneficiaryName: initialData.beneficiaryId || '', 
        
        // Convert ISO date strings from Firestore back to Date objects for DatePickerFields
        amount: initialData.amount !== undefined ? initialData.amount : undefined,
        totalMachineQty: initialData.totalMachineQty !== undefined ? initialData.totalMachineQty : undefined,
        numberOfAmendments: initialData.numberOfAmendments !== undefined ? initialData.numberOfAmendments : undefined,
        invoiceDate: initialData.invoiceDate && isValid(parseISO(initialData.invoiceDate)) ? parseISO(initialData.invoiceDate) : undefined,
        lcIssueDate: initialData.lcIssueDate && isValid(parseISO(initialData.lcIssueDate)) ? parseISO(initialData.lcIssueDate) : undefined,
        expireDate: initialData.expireDate && isValid(parseISO(initialData.expireDate)) ? parseISO(initialData.expireDate) : undefined,
        latestShipmentDate: initialData.latestShipmentDate && isValid(parseISO(initialData.latestShipmentDate)) ? parseISO(initialData.latestShipmentDate) : undefined,
        etd: initialData.etd && isValid(parseISO(initialData.etd)) ? parseISO(initialData.etd) : undefined,
        eta: initialData.eta && isValid(parseISO(initialData.eta)) ? parseISO(initialData.eta) : undefined,
        status: initialData.status || 'Draft', 
      });
    }
  }, [initialData, form]);


  async function onSubmit(data: LCEditFormValues) {
    setIsSubmitting(true);

    // Find the label for applicant and beneficiary based on selected ID for storing the name.
    const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantName); // data.applicantName holds the ID
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryName); // data.beneficiaryName holds the ID

    // Prepare data for Firestore update
    const dataToUpdate: Partial<LCEntryDocument> = {
      ...(Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      ) as Partial<LCEntryDocument>),
      
      // Store both ID and Name for applicant and beneficiary
      applicantId: data.applicantName, // This is the ID
      applicantName: selectedApplicant ? selectedApplicant.label : initialData.applicantName, // Keep old name if new not found
      beneficiaryId: data.beneficiaryName, // This is the ID
      beneficiaryName: selectedBeneficiary ? selectedBeneficiary.label : initialData.beneficiaryName, // Keep old name if new not found
      
      amount: Number(data.amount),
      totalMachineQty: data.totalMachineQty !== undefined ? Number(data.totalMachineQty) : undefined,
      numberOfAmendments: data.numberOfAmendments !== '' && data.numberOfAmendments !== undefined && data.numberOfAmendments !== null ? Number(data.numberOfAmendments) : undefined,
      
      // Convert Date objects back to ISO strings for Firestore
      lcIssueDate: data.lcIssueDate ? format(data.lcIssueDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      expireDate: data.expireDate ? format(data.expireDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      latestShipmentDate: data.latestShipmentDate ? format(data.latestShipmentDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      invoiceDate: data.invoiceDate ? format(data.invoiceDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      etd: data.etd ? format(data.etd, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      eta: data.eta ? format(data.eta, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      
      updatedAt: serverTimestamp() as any,
      year: data.lcIssueDate ? new Date(data.lcIssueDate).getFullYear() : initialData.year,
      status: data.status,
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
  

  const watchedShipmentMode = form.watch("shipmentMode");
  let viaLabel = "Vessel/Flight Name";
  if (watchedShipmentMode === "Sea") {
    viaLabel = "Vessel Name";
  } else if (watchedShipmentMode === "Air") {
    viaLabel = "Flight Name";
  }

  const watchedCurrency = form.watch("currency");
  const amountLabel = watchedCurrency ? `${watchedCurrency} Amount*` : "Amount*";
  
  const handleTrackDocument = () => {
    const courier = form.getValues("trackingCourier");
    const number = form.getValues("trackingNumber");

    if (!courier || courier.trim() === "" || !number || number.trim() === "") {
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


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        <h3 className="text-lg font-semibold border-b pb-2 text-foreground flex items-center">
          <FileText className="mr-2 h-5 w-5 text-primary" />
          L/C & Invoice Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="applicantName" 
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Applicant Name*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""} disabled={isLoadingApplicants}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingApplicants ? "Loading applicants..." : "Select applicant"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {!isLoadingApplicants && applicantOptions.length === 0 && (
                      <SelectItem value="no-applicants" disabled>No applicants found</SelectItem>
                    )}
                    {applicantOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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
            name="beneficiaryName" 
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Beneficiary Name*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""} disabled={isLoadingBeneficiaries}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingBeneficiaries ? "Loading beneficiaries..." : "Select beneficiary"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                     {!isLoadingBeneficiaries && beneficiaryOptions.length === 0 && (
                      <SelectItem value="no-beneficiaries" disabled>No beneficiaries found</SelectItem>
                    )}
                    {beneficiaryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
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
                <FormField
                    control={form.control}
                    name="trackingCourier"
                    render={({ field }) => (
                    <FormItem className="md:col-span-1">
                        <FormLabel>Courier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select Courier" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                        <Input placeholder="Enter tracking number" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button
                    type="button"
                    variant="outline"
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
        

        <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || isLoadingApplicants || isLoadingBeneficiaries}>
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


    
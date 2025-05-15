
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntry, ShipmentMode, Currency, TrackingCourier, LCEntryDocument, CustomerDocument, SupplierDocument, LCStatus } from '@/types';
import { termsOfPayOptions, shipmentModeOptions, currencyOptions, trackingCourierOptions, lcStatusOptions } from '@/types';
import { extractShippingData, type ExtractShippingDataOutput } from '@/ai/flows/extract-shipping-data';
import Swal from 'sweetalert2';
import { isValid, parseISO, format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { FileInput } from './FileInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileScan, Loader2, Info, Landmark, Library, FileText, CalendarDays, Ship, Plane, Workflow, Layers, FileSignature, Edit3, BellRing, Users, Building, Hash, ExternalLink, PackageCheck, Search, CheckSquare, UploadCloud } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const lcEntrySchema = z.object({
  beneficiaryName: z.string().min(1, "Beneficiary name is required"), 
  applicantName: z.string().min(1, "Applicant name is required"), 
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
  finalPIUrl: z.string().url({ message: "Invalid URL format for Final PI" }).optional().or(z.literal('')),
  shippingDocumentsUrl: z.string().url({ message: "Invalid URL format for Shipping Documents" }).optional().or(z.literal('')),
  trackingCourier: z.enum(["", ...trackingCourierOptions]).optional(),
  trackingNumber: z.string().optional(),
  etd: z.date().optional().nullable(),
  eta: z.date().optional().nullable(),
  itemDescriptions: z.string().optional(),
  shippingDocumentForAI: z.instanceof(File).optional().nullable(),
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
  status: z.enum(lcStatusOptions).default("Draft")
});

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

interface DropdownOption {
  value: string;
  label: string;
}

export function NewLCEntryForm() {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [applicantOptions, setApplicantOptions] = React.useState<DropdownOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<DropdownOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = React.useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = React.useState(true);


  React.useEffect(() => {
    const fetchApplicants = async () => {
      setIsLoadingApplicants(true);
      try {
        const querySnapshot = await getDocs(collection(firestore, "customers"));
        const fetchedApplicants = querySnapshot.docs.map(doc => {
          const data = doc.data() as CustomerDocument;
          return { value: doc.id, label: data.applicantName || 'Unnamed Applicant' };
        });
        setApplicantOptions(fetchedApplicants);
      } catch (error) {
        console.error("Error fetching applicants: ", error);
        Swal.fire("Error", "Could not fetch applicant data for dropdown. See console for details.", "error");
      } finally {
        setIsLoadingApplicants(false);
      }
    };
    fetchApplicants();
  }, []);

  React.useEffect(() => {
    const fetchBeneficiaries = async () => {
      setIsLoadingBeneficiaries(true);
      try {
        const querySnapshot = await getDocs(collection(firestore, "suppliers"));
        const fetchedBeneficiaries = querySnapshot.docs.map(doc => {
          const data = doc.data() as SupplierDocument;
          return { value: doc.id, label: data.beneficiaryName || 'Unnamed Beneficiary' };
        });
        setBeneficiaryOptions(fetchedBeneficiaries);
      } catch (error) {
        console.error("Error fetching beneficiaries: ", error);
        Swal.fire("Error", "Could not fetch beneficiary data for dropdown. See console for details.", "error");
      } finally {
        setIsLoadingBeneficiaries(false);
      }
    };
    fetchBeneficiaries();
  }, []);


  const form = useForm<LCEntry>({
    resolver: zodResolver(lcEntrySchema),
    defaultValues: {
      beneficiaryName: '', 
      applicantName: '', 
      currency: 'USD' as Currency,
      amount: '',
      termsOfPay: "" as LCEntry['termsOfPay'],
      documentaryCreditNumber: '',
      proformaInvoiceNumber: '',
      invoiceDate: undefined,
      totalMachineQty: '',
      lcIssueDate: undefined,
      expireDate: undefined,
      latestShipmentDate: undefined,
      finalPIUrl: '',
      shippingDocumentsUrl: '',
      trackingCourier: '',
      trackingNumber: '',
      etd: undefined,
      eta: undefined,
      itemDescriptions: '',
      shippingDocumentForAI: null,
      consigneeBankNameAddress: '',
      bankBin: '',
      bankTin: '',
      shipmentMode: "" as ShipmentMode,
      vesselOrFlightName: '',
      vesselImoNumber: '',
      partialShipments: '',
      portOfLoading: '',
      portOfDischarge: '',
      documentsRequired: '',
      shippingMarks: '',
      certificateOfOrigin: '',
      notifyPartyNameAndAddress: '',
      notifyPartyContactDetails: '',
      numberOfAmendments: '',
      status: 'Draft',
    },
  });

  const watchedShipmentMode = form.watch("shipmentMode");
  let viaLabel = "Vessel/Flight Name";
  if (watchedShipmentMode === "Sea") {
    viaLabel = "Vessel Name";
  } else if (watchedShipmentMode === "Air") {
    viaLabel = "Flight Name";
  }

  const watchedCurrency = form.watch("currency");
  const amountLabel = watchedCurrency ? `${watchedCurrency} Amount*` : "Amount*";


  async function onSubmit(data: LCEntry) {
    setIsSubmitting(true);

    const lcIssueDate = data.lcIssueDate ? new Date(data.lcIssueDate) : new Date();
    const extractedYear = lcIssueDate.getFullYear();

    const { shippingDocumentForAI, ...restOfData } = data;

    const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantName);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryName);

    const dataToSave: Omit<LCEntryDocument, 'id'> = {
      ...restOfData,
      applicantName: selectedApplicant ? selectedApplicant.label : data.applicantName, 
      beneficiaryName: selectedBeneficiary ? selectedBeneficiary.label : data.beneficiaryName, 
      applicantId: data.applicantName, 
      beneficiaryId: data.beneficiaryName, 
      year: extractedYear,
      amount: Number(data.amount),
      totalMachineQty: data.totalMachineQty ? Number(data.totalMachineQty) : 0,
      lcIssueDate: data.lcIssueDate ? format(new Date(data.lcIssueDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      expireDate: data.expireDate ? format(new Date(data.expireDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      latestShipmentDate: data.latestShipmentDate ? format(new Date(data.latestShipmentDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      invoiceDate: data.invoiceDate ? format(new Date(data.invoiceDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      etd: data.etd ? format(new Date(data.etd), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      eta: data.eta ? format(new Date(data.eta), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      numberOfAmendments: data.numberOfAmendments !== '' && data.numberOfAmendments !== undefined ? Number(data.numberOfAmendments) : undefined,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      status: data.status || 'Draft',
      finalPIUrl: data.finalPIUrl || '',
      shippingDocumentsUrl: data.shippingDocumentsUrl || '',
    };

    (Object.keys(dataToSave) as Array<keyof typeof dataToSave>).forEach(key => {
        if (dataToSave[key] === undefined) {
            delete dataToSave[key as keyof Omit<LCEntryDocument, 'id'>];
        }
    });
    
    try {
      const docRef = await addDoc(collection(firestore, "lc_entries"), dataToSave);
      Swal.fire({
        title: "L/C Entry Saved!",
        text: `L/C entry has been successfully saved to Firestore with ID: ${docRef.id}.`,
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      });
      form.reset();
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

  const handleAnalyzeDocument = async () => {
    const file = form.getValues("shippingDocumentForAI");
    if (!file) {
      Swal.fire({
        title: "No Document Selected",
        text: "Please select a shipping document to analyze.",
        icon: "warning",
      });
      return;
    }

    setIsAnalyzing(true);
    setAiError(null);
    try {
      const dataUri = await fileToDataUri(file);
      const result: ExtractShippingDataOutput = await extractShippingData({ documentDataUri: dataUri });

      const parsedEtd = result.etd ? parseISO(result.etd) : undefined;
      const parsedEta = result.eta ? parseISO(result.eta) : undefined;

      if (parsedEtd && isValid(parsedEtd)) {
        form.setValue("etd", parsedEtd, { shouldValidate: true });
      }
      if (parsedEta && isValid(parsedEta)) {
        form.setValue("eta", parsedEta, { shouldValidate: true });
      }
      form.setValue("itemDescriptions", result.itemDescriptions, { shouldValidate: true });

      Swal.fire({
        title: "Analysis Complete",
        text: "ETD, ETA, and Item Descriptions have been populated.",
        icon: "success",
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("AI Analysis Error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during analysis.";
      setAiError(errorMessage);
      Swal.fire({
        title: "Analysis Failed",
        text: errorMessage,
        icon: "error",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

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

  const handleViewUrl = (url: string | undefined) => {
    if (url && url.trim() !== "") {
      try {
        new URL(url); // Check if it's a valid URL structure
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
        <Card className="border-dashed border-primary/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-primary">
              <FileScan className="h-5 w-5" />
              AI-Powered Data Extraction
            </CardTitle>
            <CardDescription>
              Upload a shipping document (e.g., Proforma Invoice) to automatically extract ETD, ETA, and item descriptions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="shippingDocumentForAI"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shipping Document for Analysis</FormLabel>
                  <FormControl>
                     <FileInput
                        onFileChange={(file) => field.onChange(file)}
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="button" onClick={handleAnalyzeDocument} disabled={isAnalyzing || isSubmitting} className="bg-primary hover:bg-primary/90">
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <FileScan className="mr-2 h-4 w-4" />
                  Analyze Document
                </>
              )}
            </Button>
            {aiError && (
                 <Alert variant="destructive" className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Analysis Error</AlertTitle>
                    <AlertDescription>{aiError}</AlertDescription>
                </Alert>
            )}
          </CardContent>
        </Card>

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
                <FormDescription>Select from your list of customers/applicants.</FormDescription>
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
                  <Input type="number" placeholder="e.g., 50000" {...field} />
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
                  <Input type="number" placeholder="e.g., 5" {...field} />
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
                  <Input type="number" placeholder="e.g., 0" {...field} />
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
                <Textarea placeholder="Auto-filled by AI or manually enter. Describe the items being shipped." {...field} rows={4} />
                </FormControl>
                <FormDescription>Can be extracted by AI from a shipping document.</FormDescription>
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
                        <Input placeholder="Enter tracking number" {...field} disabled={!form.watch("trackingCourier")} />
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
                    <FormDescription>Can be auto-filled by AI.</FormDescription>
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
                    <FormDescription>Can be auto-filled by AI.</FormDescription>
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
                <Textarea placeholder="Specify all required documents as per L/C terms (e.g., Commercial Invoice, Packing List, Bill of Lading/Air Waybill, etc.)" {...field} rows={5} />
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
                    <Input placeholder="Enter shipping marks as specified in additional conditions" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>


        <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-4 text-foreground flex items-center">
          <UploadCloud className="mr-2 h-5 w-5 text-primary" /> Document URLs
        </h3>
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="finalPIUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Final PI URL</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl className="flex-grow">
                    <Input type="url" placeholder="https://example.com/pi.pdf" {...field} />
                  </FormControl>
                  <Button 
                    type="button" 
                    variant="outline" 
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
                <FormLabel>Shipping Documents URL</FormLabel>
                 <div className="flex items-center gap-2">
                    <FormControl className="flex-grow">
                        <Input type="url" placeholder="https://example.com/shipping-docs.pdf" {...field} />
                    </FormControl>
                     <Button 
                        type="button" 
                        variant="outline" 
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
        

        <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSubmitting || isLoadingApplicants || isLoadingBeneficiaries}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Library className="mr-2 h-4 w-4" />
              Submit L/C Entry
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

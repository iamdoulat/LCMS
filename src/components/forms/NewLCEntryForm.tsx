
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntry, ShipmentMode, Currency } from '@/types';
import { termsOfPayOptions, shipmentModeOptions, currencyOptions } from '@/types';
import { extractShippingData, type ExtractShippingDataOutput } from '@/ai/flows/extract-shipping-data';
import Swal from 'sweetalert2';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { FileInput } from './FileInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileScan, Loader2, Info, Landmark, Library, FileText, CalendarDays, Ship, Plane, Workflow, Layers, FileSignature, Edit3, BellRing, Users, Building } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const lcEntrySchema = z.object({
  beneficiaryName: z.string().min(1, "Beneficiary name is required"), 
  applicantName: z.string().min(1, "Applicant name is required"), 
  currency: z.enum(currencyOptions, { required_error: "Currency is required" }),
  amount: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive")
  ),
  termsOfPay: z.enum(termsOfPayOptions, { required_error: "Terms of pay are required" }),
  documentaryCreditNumber: z.string().min(1, "Documentary Credit Number is required"),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional(),
  totalMachineQty: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number({ invalid_type_error: "Quantity must be a number" }).int().positive("Quantity must be positive")
  ),
  lcIssueDate: z.date({ required_error: "L/C issue date is required" }),
  expireDate: z.date({ required_error: "Expire date is required" }),
  latestShipmentDate: z.date({ required_error: "Latest shipment date is required" }),
  finalPIFile: z.instanceof(File).optional().nullable(),
  shippingDocumentsFile: z.instanceof(File).optional().nullable(),
  dhlNumber: z.string().optional(),
  etd: z.string().optional(),
  eta: z.string().optional(),
  itemDescriptions: z.string().optional(),
  shippingDocumentForAI: z.instanceof(File).optional().nullable(),
  consigneeBankNameAddress: z.string().optional(),
  bankBin: z.string().optional(),
  bankTin: z.string().optional(),
  shipmentMode: z.enum(shipmentModeOptions, { required_error: "Shipment mode is required" }),
  vesselOrFlightName: z.string().optional(),
  partialShipments: z.string().optional(), // 43P
  portOfLoading: z.string().optional(), // 44E
  portOfDischarge: z.string().optional(), // 44F
  documentsRequired: z.string().optional(), // 46A - main text
  shippingMarks: z.string().optional(),
  certificateOfOrigin: z.string().optional(),
  notifyPartyName: z.string().optional(),
  notifyPartyAddress: z.string().optional(),
  notifyPartyContactDetails: z.string().optional(),
});

// Helper function to convert File to Data URI
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

// Placeholder data for dropdowns - replace with actual data fetching
const placeholderBeneficiaryOptionsFromSuppliers = [ 
  { value: "Supplier One Corp", label: "Supplier One Corp" },
  { value: "Advanced Tech Components", label: "Advanced Tech Components" },
  { value: "Global Manufacturing Co.", label: "Global Manufacturing Co." },
];

const placeholderApplicantOptions = [ 
  { value: "Customer Alpha Inc.", label: "Customer Alpha Inc." },
  { value: "Beta Services Ltd.", label: "Beta Services Ltd." },
  { value: "Global Imports Corp", label: "Global Imports Corp" },
];


export function NewLCEntryForm() {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);

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
      finalPIFile: null,
      shippingDocumentsFile: null,
      dhlNumber: '',
      etd: '',
      eta: '',
      itemDescriptions: '',
      shippingDocumentForAI: null,
      consigneeBankNameAddress: '',
      bankBin: '',
      bankTin: '',
      shipmentMode: "" as ShipmentMode,
      vesselOrFlightName: '',
      partialShipments: '',
      portOfLoading: '',
      portOfDischarge: '',
      documentsRequired: '',
      shippingMarks: '',
      certificateOfOrigin: '',
      notifyPartyName: '',
      notifyPartyAddress: '',
      notifyPartyContactDetails: '',
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
    console.log("Form Data:", data);
    Swal.fire({
      title: "L/C Entry Submitted (Simulated)",
      text: "Data logged to console. Implement Firebase submission.",
      icon: "success",
      timer: 3000,
      showConfirmButton: true,
    });
    // form.reset(); 
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
      
      form.setValue("etd", result.etd, { shouldValidate: true });
      form.setValue("eta", result.eta, { shouldValidate: true });
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
            <Button type="button" onClick={handleAnalyzeDocument} disabled={isAnalyzing} className="bg-primary hover:bg-primary/90">
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select applicant (customer)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {placeholderApplicantOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Select from your list of customers.</FormDescription>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select beneficiary (supplier)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {placeholderBeneficiaryOptionsFromSuppliers.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Select from your list of suppliers.</FormDescription>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            name="notifyPartyName"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Notify Party name</FormLabel>
                <FormControl>
                <Input placeholder="Enter notify party's name" {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="notifyPartyAddress"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Notify Party Address</FormLabel>
                <FormControl>
                <Textarea placeholder="Enter notify party's full address" {...field} rows={3}/>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="shipmentMode"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Shipment Mode*</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
             <FormField
              control={form.control}
              name="dhlNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DHL Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter DHL tracking number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                control={form.control}
                name="etd"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>ETD (Estimated Time of Departure)</FormLabel>
                    <FormControl>
                    <Input placeholder="Auto-filled by AI" {...field} />
                    </FormControl>
                    <FormDescription>Extracted from shipping document.</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="eta"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>ETA (Estimated Time of Arrival)</FormLabel>
                    <FormControl>
                    <Input placeholder="Auto-filled by AI" {...field} />
                    </FormControl>
                    <FormDescription>Extracted from shipping document.</FormDescription>
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


        <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-4 text-foreground">Document Uploads</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="finalPIFile"
            render={({ field }) => ( 
              <FormItem>
                <FormLabel>Final PI (PDF/JPG)</FormLabel>
                <FormControl>
                  <FileInput 
                    onFileChange={(file) => field.onChange(file)} 
                    accept=".pdf,.jpg,.jpeg"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shippingDocumentsFile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shipping Documents (PDF/JPG)</FormLabel>
                <FormControl>
                  <FileInput 
                    onFileChange={(file) => field.onChange(file)}
                    accept=".pdf,.jpg,.jpeg"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
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


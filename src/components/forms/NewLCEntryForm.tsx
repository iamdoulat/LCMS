
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntry } from '@/types';
import { extractShippingData, type ExtractShippingDataOutput } from '@/ai/flows/extract-shipping-data';
import Swal from 'sweetalert2';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { FileInput } from './FileInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileScan, Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const lcEntrySchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  supplierName: z.string().min(1, "Supplier name is required"),
  value: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number({ invalid_type_error: "Value must be a number" }).positive("Value must be positive")
  ),
  termsOfPay: z.string().min(1, "Terms of pay are required"),
  ttNumber: z.string().optional(),
  lcNumber: z.string().min(1, "L/C number is required"),
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

export function NewLCEntryForm() {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);

  const form = useForm<LCEntry>({
    resolver: zodResolver(lcEntrySchema),
    defaultValues: {
      customerName: '',
      supplierName: '',
      value: '',
      termsOfPay: '',
      ttNumber: '',
      lcNumber: '',
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
    },
  });

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
      setAiError(errorMessage); // For inline error display
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="customerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter customer name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="supplierName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter supplier name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Value (USD)*</FormLabel>
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
                <FormControl>
                  <Textarea placeholder="e.g., 30% TT Advance, 70% LC at sight" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ttNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>TT Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter TT number if applicable" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lcNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>L/C Number*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter L/C number" {...field} />
                </FormControl>
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
        </div>

        <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-4 text-foreground">Dates</h3>
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
        
        <h3 className="text-lg font-semibold border-b pb-2 mt-6 mb-4 text-foreground">Shipping Information (Auto-populated by AI)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <FormField
            control={form.control}
            name="itemDescriptions"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Item Descriptions</FormLabel>
                <FormControl>
                <Textarea placeholder="Auto-filled by AI. Describe the items being shipped." {...field} rows={4} />
                </FormControl>
                <FormDescription>Extracted from shipping document.</FormDescription>
                <FormMessage />
            </FormItem>
            )}
        />

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
            'Submit L/C Entry'
          )}
        </Button>
      </form>
    </Form>
  );
}


"use client";

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LCEntryDocument, ShipmentMode, shipmentModeOptions } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, getDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { format, isValid, parseISO, differenceInDays } from 'date-fns';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatePickerField } from './DatePickerField';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Loader2, Save, Users, Building, DollarSign, CalendarDays, Ship, FileText, Info, ExternalLink, Link as LinkIcon, Plane } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

const paymentTrackingSchema = z.object({
  lcId: z.string().min(1, "Documentary Credit Number is required."),
  shipmentValue: z.number().positive("Shipment value must be a positive number."),
  isFirstShipment: z.boolean().default(false),
  isSecondShipment: z.boolean().default(false),
  isThirdShipment: z.boolean().default(false),
  shipmentDate: z.date({ required_error: "Shipment Date is required." }),
  shipmentMode: z.enum(shipmentModeOptions, { required_error: "Shipment Mode is required." }),
  maturityDate: z.date({ required_error: "Maturity Date is required." }),
  goodsDescription: z.string().optional(),
  documentUrls: z.string().optional(),
});

type PaymentTrackingFormValues = z.infer<typeof paymentTrackingSchema>;

const PLACEHOLDER_LC_VALUE = "__PAYMENT_TRACKING_LC_PLACEHOLDER__";

export function PaymentTrackingEntryForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [lcOptions, setLcOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingLcs, setIsLoadingLcs] = React.useState(true);
  const [selectedLcDetails, setSelectedLcDetails] = React.useState<Partial<LCEntryDocument> | null>(null);
  const [remainingDays, setRemainingDays] = React.useState<number | null>(null);

  const form = useForm<PaymentTrackingFormValues>({
    resolver: zodResolver(paymentTrackingSchema),
    defaultValues: {
      lcId: '',
      shipmentValue: undefined,
      isFirstShipment: false,
      isSecondShipment: false,
      isThirdShipment: false,
      shipmentDate: new Date(),
      shipmentMode: "Sea",
      maturityDate: new Date(),
      goodsDescription: '',
      documentUrls: '',
    }
  });

  const { control, watch, setValue, handleSubmit, reset } = form;
  const watchedLcId = watch('lcId');
  const watchedMaturityDate = watch('maturityDate');

  React.useEffect(() => {
    const fetchLcs = async () => {
      setIsLoadingLcs(true);
      try {
        const lcQuery = query(collection(firestore, "lc_entries"));
        const snapshot = await getDocs(lcQuery);
        const options = snapshot.docs.map(doc => {
          const data = doc.data() as LCEntryDocument;
          return { value: doc.id, label: data.documentaryCreditNumber || 'Unnamed L/C' };
        });
        setLcOptions(options);
      } catch (error) {
        Swal.fire("Error", "Could not load L/C options.", "error");
      } finally {
        setIsLoadingLcs(false);
      }
    };
    fetchLcs();
  }, []);

  React.useEffect(() => {
    const fetchLcDetails = async () => {
      if (watchedLcId && watchedLcId !== PLACEHOLDER_LC_VALUE) {
        const lcDocRef = doc(firestore, "lc_entries", watchedLcId);
        const lcDocSnap = await getDoc(lcDocRef);
        if (lcDocSnap.exists()) {
          const lcData = lcDocSnap.data() as LCEntryDocument;
          setSelectedLcDetails(lcData);
          setValue('goodsDescription', lcData.itemDescriptions || '');
        }
      } else {
        setSelectedLcDetails(null);
        setValue('goodsDescription', '');
      }
    };
    fetchLcDetails();
  }, [watchedLcId, setValue]);

  React.useEffect(() => {
    if (watchedMaturityDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today to the start of the day
      const maturity = new Date(watchedMaturityDate);
      maturity.setHours(0, 0, 0, 0); // Normalize maturity date
      if (isValid(maturity)) {
        setRemainingDays(differenceInDays(maturity, today));
      }
    } else {
      setRemainingDays(null);
    }
  }, [watchedMaturityDate]);

  const handleViewUrl = (url: string | undefined | null) => {
    if (url && url.trim() !== "") {
      try {
        new URL(url);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        Swal.fire("Invalid URL", "The provided URL is not valid.", "error");
      }
    } else {
      Swal.fire("No URL", "No URL provided for this document.", "info");
    }
  };

  const renderDocumentLink = (label: string, url: string | undefined) => {
    return (
      <div className="flex items-center justify-between p-2 border rounded-md bg-background">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleViewUrl(url)}
          disabled={!url}
        >
          <ExternalLink className="mr-2 h-4 w-4" /> View
        </Button>
      </div>
    );
  };


  async function onSubmit(data: PaymentTrackingFormValues) {
    setIsSubmitting(true);
    try {
      const lcDocRef = doc(firestore, "lc_entries", data.lcId);
      const updateData = {
        shipmentValue: data.shipmentValue, // This seems to be a new field, assuming it's for tracking this shipment's value
        isFirstShipment: data.isFirstShipment,
        isSecondShipment: data.isSecondShipment,
        isThirdShipment: data.isThirdShipment,
        etd: format(data.shipmentDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"), // Assuming shipment date is ETD
        shipmentMode: data.shipmentMode,
        paymentMaturityDate: format(data.maturityDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        // You might want to update status here too, e.g., to "Shipment Done"
        // status: [...(selectedLcDetails?.status || []), "Shipment Done"],
        updatedAt: serverTimestamp(),
      };
      await updateDoc(lcDocRef, updateData);
      Swal.fire("Success", "Payment tracking information updated successfully!", "success");
      reset();
      setSelectedLcDetails(null);
    } catch (error: any) {
      Swal.fire("Error", `Failed to update tracking information: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <FormField
            control={control}
            name="lcId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Documentary Credit Number*</FormLabel>
                <Combobox
                  options={lcOptions}
                  value={field.value || PLACEHOLDER_LC_VALUE}
                  onValueChange={(value) => field.onChange(value === PLACEHOLDER_LC_VALUE ? '' : value)}
                  placeholder="Search L/C Number..."
                  selectPlaceholder={isLoadingLcs ? "Loading..." : "Select L/C"}
                  disabled={isLoadingLcs}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          {selectedLcDetails && (
            <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-md bg-muted/50">
                <p><strong className="text-muted-foreground">Applicant:</strong><br /> {selectedLcDetails.applicantName}</p>
                <p><strong className="text-muted-foreground">Beneficiary:</strong><br /> {selectedLcDetails.beneficiaryName}</p>
                <p><strong className="text-muted-foreground">L/C Value:</strong><br /> {selectedLcDetails.amount?.toLocaleString() || 'N/A'} {selectedLcDetails.currency}</p>
                <p><strong className="text-muted-foreground">Deferred Period:</strong><br /> {selectedLcDetails.termsOfPay}</p>
            </div>
          )}
        </div>
        <Separator/>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <FormField control={control} name="shipmentValue" render={({ field }) => (<FormItem><FormLabel>Shipment Value*</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="isFirstShipment" render={({ field }) => (<FormItem className="flex items-center space-x-2 pt-6"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label>1st Shipment</Label></FormItem>)} />
            <FormField control={control} name="isSecondShipment" render={({ field }) => (<FormItem className="flex items-center space-x-2 pt-6"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label>2nd Shipment</Label></FormItem>)} />
            <FormField control={control} name="isThirdShipment" render={({ field }) => (<FormItem className="flex items-center space-x-2 pt-6"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label>3rd Shipment</Label></FormItem>)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
             <FormField control={control} name="shipmentDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Shipment Date*</FormLabel><DatePickerField field={field} /></FormItem>)}/>
             <FormField control={control} name="maturityDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Maturity Date*</FormLabel><DatePickerField field={field} /></FormItem>)}/>
             <FormItem><FormLabel>Remaining Days</FormLabel><Input value={remainingDays !== null ? `${remainingDays} days` : 'N/A'} readOnly disabled className="bg-muted/50 cursor-not-allowed"/></FormItem>
        </div>
        <FormField control={control} name="shipmentMode" render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Shipment Mode*</FormLabel>
                 <FormControl>
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-wrap items-center gap-x-6 gap-y-2">
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
        )}/>
        <Separator/>
        <FormField control={control} name="goodsDescription" render={({ field }) => (<FormItem><FormLabel>Goods Description</FormLabel><FormControl><Textarea placeholder="Description of goods in this shipment..." {...field} /></FormControl><FormMessage /></FormItem>)}/>
        {selectedLcDetails && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Linked Documents</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderDocumentLink("Purchase Order", selectedLcDetails.purchaseOrderUrl)}
              {renderDocumentLink("Final PI", selectedLcDetails.finalPIUrl)}
              {renderDocumentLink("Final L/C", selectedLcDetails.finalLcUrl)}
              {renderDocumentLink("Shipping Docs", selectedLcDetails.shippingDocumentsUrl)}
              {renderDocumentLink("Packing List", selectedLcDetails.packingListUrl)}
            </div>
          </div>
        )}
        <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/>Save Entry</>}
            </Button>
        </div>
      </form>
    </Form>
  );
}

    
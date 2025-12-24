
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { LCEntryDocument, ShipmentMode, shipmentModeOptions as ShipmentModeOptionsType } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, getDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { format, isValid, parseISO, differenceInDays, addDays } from 'date-fns';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { shipmentModeOptions } from '@/types';

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
  status: z.enum(["Payment Pending", "Payment Done"]),
});

type PaymentTrackingFormValues = z.infer<typeof paymentTrackingSchema>;

const PLACEHOLDER_LC_VALUE = "__PAYMENT_TRACKING_EDIT_LC_PLACEHOLDER__";

interface EditPaymentTrackingEntryFormProps {
  initialData: LCEntryDocument;
}

export function EditPaymentTrackingEntryForm({ initialData }: EditPaymentTrackingEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [lcOptions, setLcOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingLcs, setIsLoadingLcs] = React.useState(true);
  const [selectedLcDetails, setSelectedLcDetails] = React.useState<Partial<LCEntryDocument> | null>(initialData);
  const [remainingDays, setRemainingDays] = React.useState<number | null>(null);

  const form = useForm<PaymentTrackingFormValues>({
    resolver: zodResolver(paymentTrackingSchema),
    defaultValues: {
      lcId: initialData.id,
      shipmentValue: initialData.shipmentValue,
      isFirstShipment: initialData.isFirstShipment,
      isSecondShipment: initialData.isSecondShipment,
      isThirdShipment: initialData.isThirdShipment,
      shipmentDate: parseISO(initialData.shipmentDate as string),
      shipmentMode: initialData.shipmentMode,
      maturityDate: parseISO(initialData.maturityDate as string),
      goodsDescription: initialData.goodsDescription,
      status: (initialData.status === "Payment Pending" || initialData.status === "Payment Done") ? initialData.status : "Payment Pending",
    },
  });

  const { control, watch, setValue, handleSubmit, reset } = form;
  const watchedLcId = watch('lcId');
  const watchedMaturityDate = watch('maturityDate');
  const watchedShipmentDate = watch('shipmentDate');

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
        }
      } else {
        setSelectedLcDetails(null);
      }
    };
    fetchLcDetails();
  }, [watchedLcId]);

  React.useEffect(() => {
    if (watchedShipmentDate && selectedLcDetails?.termsOfPay?.startsWith('Deferred')) {
      const deferredDaysMatch = selectedLcDetails.termsOfPay.match(/\d+/);
      if (deferredDaysMatch) {
        const days = parseInt(deferredDaysMatch[0], 10);
        const newMaturityDate = addDays(new Date(watchedShipmentDate), days);
        setValue('maturityDate', newMaturityDate, { shouldValidate: true });
      }
    }
  }, [watchedShipmentDate, selectedLcDetails, setValue]);

  React.useEffect(() => {
    if (watchedMaturityDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maturity = new Date(watchedMaturityDate);
      maturity.setHours(0, 0, 0, 0); // Normalize maturity date
      if (isValid(maturity)) {
        setRemainingDays(differenceInDays(maturity, today));
      }
    } else {
      setRemainingDays(null);
    }
  }, [watchedMaturityDate]);

  async function onSubmit(data: PaymentTrackingFormValues) {
    setIsSubmitting(true);
    if (!initialData.id) {
      Swal.fire("Error", "No record ID found. Cannot update.", "error");
      setIsSubmitting(false);
      return;
    }

    try {
      const dataToUpdate = {
        ...data,
        shipmentDate: format(data.shipmentDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        maturityDate: format(data.maturityDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        remainingDays: remainingDays,
        updatedAt: serverTimestamp(),
      };

      const docRef = doc(firestore, "deferred_payment_tracker", initialData.id);
      await updateDoc(docRef, dataToUpdate);

      Swal.fire("Success", "Payment tracking entry updated successfully!", "success");
    } catch (error: any) {
      Swal.fire("Error", `Failed to update tracking entry: ${error.message}`, "error");
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
                  disabled
                />
                <FormMessage />
              </FormItem>
            )}
          />
          {selectedLcDetails && (
            <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-md bg-muted/50">
              <p><strong className="text-muted-foreground">Applicant:</strong><br /> {selectedLcDetails.applicantName}</p>
              <p><strong className="text-muted-foreground">Beneficiary:</strong><br /> {selectedLcDetails.beneficiaryName}</p>
              <p><strong className="text-muted-foreground">L/C Value:</strong><br /> {selectedLcDetails.amount?.toLocaleString() || 'N/A'} {typeof selectedLcDetails.currency === 'string' ? selectedLcDetails.currency : selectedLcDetails.currency?.code}</p>
              <p><strong className="text-muted-foreground">Deferred Period:</strong><br /> {selectedLcDetails.termsOfPay}</p>
            </div>
          )}
        </div>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <FormField control={control} name="shipmentValue" render={({ field }) => (<FormItem><FormLabel>Shipment Value*</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
          <div className="flex items-center space-x-4 pt-6">
            <FormField control={control} name="isFirstShipment" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label>1st Shipment</Label></FormItem>)} />
            <FormField control={control} name="isSecondShipment" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label>2nd Shipment</Label></FormItem>)} />
            <FormField control={control} name="isThirdShipment" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label>3rd Shipment</Label></FormItem>)} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <FormField control={control} name="shipmentDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Shipment Date*</FormLabel><DatePickerField field={field} /></FormItem>)} />
          <FormField control={control} name="maturityDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Maturity Date*</FormLabel><DatePickerField field={field} /></FormItem>)} />
          <FormItem><FormLabel>Remaining Days</FormLabel><Input value={remainingDays !== null ? `${remainingDays} days` : 'N/A'} readOnly disabled className="bg-muted/50 cursor-not-allowed" /></FormItem>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <FormField control={control} name="shipmentMode" render={({ field }) => (
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
                        {option}
                      </FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status*</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Payment Pending">Payment Pending</SelectItem>
                    <SelectItem value="Payment Done">Payment Done</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Separator />
        <FormField control={control} name="goodsDescription" render={({ field }) => (<FormItem><FormLabel>Goods Description</FormLabel><FormControl><Textarea placeholder="Description of goods in this shipment..." {...field} /></FormControl><FormMessage /></FormItem>)} />

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
          </Button>
        </div>
      </form>
    </Form>
  );
}

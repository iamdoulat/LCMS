
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Banknote, BarChart3, CalendarDays, DollarSign, Loader2, Save, Store, Link as LinkIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, getDocs, collection, query, where } from 'firebase/firestore';
import type { Supplier, SupplierDocument, ProformaInvoiceDocument } from '@/types';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';


const beneficiarySchema = z.object({
  beneficiaryName: z.string().min(1, "Beneficiary name is required"),
  headOfficeAddress: z.string().min(1, "Head office address is required"),
  bankInformation: z.string().optional(),
  contactPersonName: z.string().min(1, "Contact person name is required"),
  cellNumber: z.string().optional().or(z.literal('')),
  emailId: z.string().email("Invalid email address"),
  website: z.string().url("Invalid URL format").optional().or(z.literal('')),
  brandName: z.string().min(1, "Brand name is required"),
  brandLogoUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format for Brand Logo" }).optional()
  ),
});

type BeneficiaryEditFormValues = z.infer<typeof beneficiarySchema>;

interface EditBeneficiaryFormProps {
  initialData: SupplierDocument;
  beneficiaryId: string;
}

const currentSystemYear = new Date().getFullYear();
const commissionYearOptions = Array.from({ length: (currentSystemYear - 2020 + 6) }, (_, i) => (2020 + i).toString()); // 2020 to currentYear + 5


export function EditBeneficiaryForm({ initialData, beneficiaryId }: EditBeneficiaryFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedCommissionYear, setSelectedCommissionYear] = React.useState<string>(currentSystemYear.toString());
  const [totalYearlyCommission, setTotalYearlyCommission] = React.useState<number>(0);
  const [isLoadingCommission, setIsLoadingCommission] = React.useState<boolean>(false);
  const [currentLogoUrlForPreview, setCurrentLogoUrlForPreview] = React.useState<string | undefined>(initialData?.brandLogoUrl || undefined);

  const form = useForm<BeneficiaryEditFormValues>({
    resolver: zodResolver(beneficiarySchema),
    defaultValues: {
      beneficiaryName: initialData?.beneficiaryName || '',
      headOfficeAddress: initialData?.headOfficeAddress || '',
      bankInformation: initialData?.bankInformation || '',
      contactPersonName: initialData?.contactPersonName || '',
      cellNumber: initialData?.cellNumber || '',
      emailId: initialData?.emailId || '',
      website: initialData?.website || '',
      brandName: initialData?.brandName || '',
      brandLogoUrl: initialData?.brandLogoUrl || '',
    }
  });

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        beneficiaryName: initialData.beneficiaryName || '',
        headOfficeAddress: initialData.headOfficeAddress || '',
        bankInformation: initialData.bankInformation || '',
        contactPersonName: initialData.contactPersonName || '',
        cellNumber: initialData.cellNumber || '',
        emailId: initialData.emailId || '',
        website: initialData.website || '',
        brandName: initialData.brandName || '',
        brandLogoUrl: initialData.brandLogoUrl || '',
      });
      setCurrentLogoUrlForPreview(initialData.brandLogoUrl || undefined);
    }
  }, [initialData, form]);

  const watchedBrandLogoUrl = form.watch("brandLogoUrl");
  React.useEffect(() => {
    if (watchedBrandLogoUrl && (watchedBrandLogoUrl.startsWith('http://') || watchedBrandLogoUrl.startsWith('https://'))) {
      setCurrentLogoUrlForPreview(watchedBrandLogoUrl);
    } else if (!watchedBrandLogoUrl) {
      setCurrentLogoUrlForPreview(undefined);
    }
  }, [watchedBrandLogoUrl]);

  React.useEffect(() => {
    const fetchCommissionData = async () => {
      if (!beneficiaryId || !selectedCommissionYear) {
        setTotalYearlyCommission(0);
        return;
      }
      setIsLoadingCommission(true);
      try {
        const piCollectionRef = collection(firestore, "proforma_invoices");
        const q = query(
          piCollectionRef,
          where("beneficiaryId", "==", beneficiaryId)
        );
        const querySnapshot = await getDocs(q);
        let commissionSum = 0;
        querySnapshot.forEach((docSnap) => {
          const pi = docSnap.data() as ProformaInvoiceDocument;
          if (pi.piDate && new Date(pi.piDate).getFullYear() === parseInt(selectedCommissionYear)) {
            const purchasePrice = pi.totalPurchasePrice || 0;
            const salesPrice = pi.grandTotalSalesPrice || 0;
            if (salesPrice > purchasePrice) {
              commissionSum += (salesPrice - purchasePrice);
            }
          }
        });
        setTotalYearlyCommission(commissionSum);
      } catch (error) {
        console.error("Error fetching commission data:", error);
        setTotalYearlyCommission(0);
        Swal.fire("Error", "Could not load commission data for this beneficiary.", "error");
      } finally {
        setIsLoadingCommission(false);
      }
    };

    fetchCommissionData();
  }, [beneficiaryId, selectedCommissionYear]);

  async function onSubmit(data: BeneficiaryEditFormValues) {
    setIsSubmitting(true);

    const dataToUpdate: Partial<Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>> & { updatedAt: any } = {
      ...data,
      bankInformation: data.bankInformation || undefined,
      brandLogoUrl: data.brandLogoUrl || undefined,
      updatedAt: serverTimestamp(),
    };

    (Object.keys(dataToUpdate) as Array<keyof typeof dataToUpdate>).forEach(key => {
      if (dataToUpdate[key] === undefined) {
        delete dataToUpdate[key];
      }
    });

    try {
      const beneficiaryDocRef = doc(firestore, "suppliers", beneficiaryId);
      await updateDoc(beneficiaryDocRef, dataToUpdate);
      Swal.fire({
        title: "Beneficiary Profile Updated!",
        text: `Beneficiary profile for ID: ${beneficiaryId} has been successfully updated.`,
        icon: "success",
        timer: 1000,
        showConfirmButton: true,
      });
    } catch (error) {
      console.error("Error updating beneficiary document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update beneficiary profile: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="beneficiaryName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Beneficiary Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter beneficiary's official name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="brandName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brand Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter brand name (if different)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="headOfficeAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Head Office Address*</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter full head office address" {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bankInformation"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center">
                <Banknote className="mr-2 h-4 w-4 text-muted-foreground" />
                Bank Information
              </FormLabel>
              <FormControl>
                <Textarea placeholder="Enter beneficiary's bank details (name, account number, SWIFT, etc.)" {...field} rows={4} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="contactPersonName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter main contact's full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cellNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cell Number</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="emailId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email ID*</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="contact@beneficiary.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website URL</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://www.beneficiary.com" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="brandLogoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />Brand Logo URL</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormDescription>
                Enter the direct URL to the brand logo.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {currentLogoUrlForPreview && (currentLogoUrlForPreview.startsWith('http://') || currentLogoUrlForPreview.startsWith('https://')) && (
          <div className="space-y-2">
            <Label>Logo Preview (max height 80px)</Label>
            <div className="mt-2">
              <Image
                src={currentLogoUrlForPreview}
                alt={form.getValues("brandName") || 'Brand Logo Preview'}
                className="h-20 w-auto rounded-md border object-contain"
                width={100} // Provide a base width, height will be auto or constrained by h-20
                height={80}
                onError={() => {
                  console.warn("Error loading logo preview from URL:", currentLogoUrlForPreview);
                }}
                data-ai-hint="brand logo"
              />
            </div>
          </div>
        )}

        <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
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

      <Separator className="my-10" />

      <div>
        <h3 className={cn("flex items-center gap-2 mb-4", "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
          <BarChart3 className="h-6 w-6 text-primary" />
          Beneficiary Commission Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end mb-4 p-4 border rounded-md shadow-sm">
          <FormItem>
            <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />Commissioning Year</FormLabel>
            <Select value={selectedCommissionYear} onValueChange={setSelectedCommissionYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {commissionYearOptions.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
          <FormItem>
            <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Total Commissions</FormLabel>
            {isLoadingCommission ? (
              <div className="flex items-center justify-center h-10 rounded-md border bg-muted/50">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <Input
                type="text"
                value={totalYearlyCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                readOnly
                disabled
                className="bg-muted/50 cursor-not-allowed font-semibold text-foreground"
              />
            )}
          </FormItem>
        </div>
        <FormDescription>
          Shows total commission calculated from Proforma Invoices (Grand Total Sales - Total Purchase Price) linked to this beneficiary for the selected year.
        </FormDescription>
      </div>

    </Form>
  );
}

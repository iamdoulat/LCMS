
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, UserCog, CalendarDays, DollarSign, BarChart3 } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import type { Customer, CustomerDocument, LCEntryDocument } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const applicantSchema = z.object({
  applicantName: z.string().min(1, "Applicant name is required"),
  address: z.string().min(1, "Address is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format").optional().or(z.literal('')),
  contactPerson: z.string().optional(),
  contactPersonDesignation: z.string().optional(),
  binNo: z.string().optional(),
  tinNo: z.string().optional(),
  newIrcNo: z.string().optional(),
  oldIrcNo: z.string().optional(),
  applicantBondNo: z.string().optional(),
  groupName: z.string().optional(),
  bidaRegNo: z.string().optional(),
});

type ApplicantEditFormValues = z.infer<typeof applicantSchema>;

interface EditApplicantFormProps {
  initialData: CustomerDocument;
  applicantId: string;
}

const currentSystemYear = new Date().getFullYear();
const lcYearOptions = Array.from({ length: (currentSystemYear - 2020 + 6) }, (_, i) => (2020 + i).toString()); // 2020 to currentYear + 5

export function EditApplicantForm({ initialData, applicantId }: EditApplicantFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedLcYear, setSelectedLcYear] = React.useState<string>(currentSystemYear.toString());
  const [totalLcValueForYear, setTotalLcValueForYear] = React.useState<number>(0);
  const [isLoadingLcStats, setIsLoadingLcStats] = React.useState<boolean>(false);

  const form = useForm<ApplicantEditFormValues>({
    resolver: zodResolver(applicantSchema),
    defaultValues: { 
      applicantName: '',
      address: '',
      email: '',
      phone: '',
      contactPerson: '',
      contactPersonDesignation: '',
      binNo: '',
      tinNo: '',
      newIrcNo: '',
      oldIrcNo: '',
      applicantBondNo: '',
      groupName: '',
      bidaRegNo: '',
    }
  });

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        applicantName: initialData.applicantName || '',
        address: initialData.address || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        contactPerson: initialData.contactPerson || '',
        contactPersonDesignation: initialData.contactPersonDesignation || '',
        binNo: initialData.binNo || '',
        tinNo: initialData.tinNo || '',
        newIrcNo: initialData.newIrcNo || '',
        oldIrcNo: initialData.oldIrcNo || '',
        applicantBondNo: initialData.applicantBondNo || '',
        groupName: initialData.groupName || '',
        bidaRegNo: initialData.bidaRegNo || '',
      });
    }
  }, [initialData, form]);

  React.useEffect(() => {
    const fetchLcStats = async () => {
      if (!applicantId || !selectedLcYear) {
        setTotalLcValueForYear(0);
        return;
      }
      setIsLoadingLcStats(true);
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");
        const q = query(
          lcEntriesRef,
          where("applicantId", "==", applicantId),
          where("year", "==", parseInt(selectedLcYear))
        );
        const querySnapshot = await getDocs(q);
        let totalValue = 0;
        querySnapshot.forEach((docSnap) => {
          const lc = docSnap.data() as LCEntryDocument;
          totalValue += lc.amount || 0; 
        });
        setTotalLcValueForYear(totalValue);
      } catch (error) {
        console.error("Error fetching L/C statistics for applicant:", error);
        setTotalLcValueForYear(0);
      } finally {
        setIsLoadingLcStats(false);
      }
    };

    fetchLcStats();
  }, [applicantId, selectedLcYear]);

  async function onSubmit(data: ApplicantEditFormValues) {
    setIsSubmitting(true);

    const dataToUpdate: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>> & { updatedAt: any } = {
      ...data, 
      phone: data.phone || undefined,
      contactPerson: data.contactPerson || undefined,
      contactPersonDesignation: data.contactPersonDesignation || undefined,
      binNo: data.binNo || undefined,
      tinNo: data.tinNo || undefined,
      newIrcNo: data.newIrcNo || undefined,
      oldIrcNo: data.oldIrcNo || undefined,
      applicantBondNo: data.applicantBondNo || undefined,
      groupName: data.groupName || undefined,
      bidaRegNo: data.bidaRegNo || undefined,
      updatedAt: serverTimestamp(),
    };

    (Object.keys(dataToUpdate) as Array<keyof typeof dataToUpdate>).forEach(key => {
      if (dataToUpdate[key] === undefined) {
        delete dataToUpdate[key];
      }
    });

    try {
      const applicantDocRef = doc(firestore, "customers", applicantId);
      await updateDoc(applicantDocRef, dataToUpdate);
      Swal.fire({
        title: "Applicant Profile Updated!",
        text: `Applicant profile for ID: ${applicantId} has been successfully updated.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (error) {
      console.error("Error updating applicant document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update applicant profile: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="applicantName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Applicant Name*</FormLabel>
              <FormControl>
                <Input placeholder="Enter applicant's full name or company name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address*</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter applicant's full address" {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address*</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="applicant@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
            control={form.control}
            name="contactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter name of the primary contact person" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="contactPersonDesignation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Designation</FormLabel>
                <FormControl>
                  <Input placeholder="Enter contact person's designation" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="binNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>BIN No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter BIN number" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tinNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>TIN No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter TIN number" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="newIrcNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New IRC No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter New IRC number" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="oldIrcNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Old IRC No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Old IRC number" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="applicantBondNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Applicant Bond No.:</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Applicant's Bond Number" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="groupName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Group Name:</FormLabel>
                <FormControl>
                  <Input placeholder="Enter group name" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="bidaRegNo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>BIDA Reg. No:</FormLabel>
              <FormControl>
                <Input placeholder="Enter BIDA Registration Number" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
            Applicant LC Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end mb-4 p-4 border rounded-md shadow-sm">
            <FormItem>
                <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />L/C Year</FormLabel>
                <Select value={selectedLcYear} onValueChange={setSelectedLcYear}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {lcYearOptions.map(year => (
                            <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </FormItem>
            <FormItem>
                <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Total L/C Value</FormLabel>
                {isLoadingLcStats ? (
                     <div className="flex items-center justify-center h-10 rounded-md border bg-muted/50">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                     </div>
                ) : (
                    <Input
                        type="text"
                        value={totalLcValueForYear.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        readOnly
                        disabled
                        className="bg-muted/50 cursor-not-allowed font-semibold text-foreground"
                    />
                )}
            </FormItem>
        </div>
        <p className="text-xs text-muted-foreground">
            Total value of L/Cs for this applicant in the selected year. Values are summed directly; currency conversion is not applied if multiple currencies exist.
        </p>
      </div>

    </Form>
  );
}

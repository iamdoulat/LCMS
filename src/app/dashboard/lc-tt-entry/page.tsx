
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import type { CustomerDocument, SupplierDocument } from '@/types';

import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FileText, Users, Building, Save } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const lcTtEntrySchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required."),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required."),
  // Add other fields for LC T/T Entry as needed
});

type LcTtEntryFormValues = z.infer<typeof lcTtEntrySchema>;

const PLACEHOLDER_APPLICANT_VALUE = "__LCTTT_APPLICANT_PLACEHOLDER__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__LCTTT_BENEFICIARY_PLACEHOLDER__";

const sectionHeadingClass = "font-bold text-xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-4 flex items-center";

export default function LcTtEntryPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const form = useForm<LcTtEntryFormValues>({
    resolver: zodResolver(lcTtEntrySchema),
    defaultValues: {
      applicantId: '',
      beneficiaryId: '',
    },
  });

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

  async function onSubmit(data: LcTtEntryFormValues) {
    setIsSubmitting(true);
    console.log("LC T/T Entry Data to save (simulated):", data);
    // TODO: Implement Firestore save logic for lc_tt_entries collection
    // For example:
    // const dataToSave = {
    //   ...data,
    //   applicantName: applicantOptions.find(opt => opt.value === data.applicantId)?.label || '',
    //   beneficiaryName: beneficiaryOptions.find(opt => opt.value === data.beneficiaryId)?.label || '',
    //   createdAt: serverTimestamp(),
    //   updatedAt: serverTimestamp(),
    // };
    // await addDoc(collection(firestore, "lc_tt_entries"), dataToSave);

    Swal.fire({
      title: "Submission Simulated",
      text: "LC T/T Entry data logged to console. Backend saving not yet implemented.",
      icon: "info",
    });
    // form.reset(); // Optionally reset form
    setIsSubmitting(false);
  }

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
              
              <h3 className={cn(sectionHeadingClass, "flex items-center")}>
                <FileText className="mr-2 h-5 w-5 text-primary" />
                Invoice and T/C, L/C Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
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
                  control={form.control}
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

              {/* Add more fields for LC T/T Entry as needed here */}

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


"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import type { CustomerDocument, SupplierDocument } from '@/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Loader2, Wrench, Users, Building, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const installationReportSchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required"),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required"),
  // Add other installation report fields here later
});

type InstallationReportFormValues = z.infer<typeof installationReportSchema>;

const PLACEHOLDER_APPLICANT_VALUE = "__INSTALL_REPORT_APPLICANT__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__INSTALL_REPORT_BENEFICIARY__";

export default function NewInstallationReportPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const form = useForm<InstallationReportFormValues>({
    resolver: zodResolver(installationReportSchema),
    defaultValues: {
      applicantId: '',
      beneficiaryId: '',
    },
  });

  React.useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, suppliersSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "suppliers"))
        ]);

        setApplicantOptions(
          customersSnap.docs.map(doc => ({ value: doc.id, label: (doc.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
        );
        setBeneficiaryOptions(
          suppliersSnap.docs.map(doc => ({ value: doc.id, label: (doc.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );

      } catch (error) {
        console.error("Error fetching dropdown options for Installation Report form: ", error);
        Swal.fire("Error", "Could not load supporting data (Applicants/Beneficiaries). Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, []);

  async function onSubmit(data: InstallationReportFormValues) {
    setIsSubmitting(true);
    console.log("Installation Report Data (Simulated Save):", data);
    
    // TODO: Implement saving to Firestore (e.g., to an 'installation_reports' collection)
    // const selectedApplicant = applicantOptions.find(opt => opt.value === data.applicantId);
    // const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === data.beneficiaryId);
    // const dataToSave = {
    //   ...data,
    //   applicantName: selectedApplicant?.label,
    //   beneficiaryName: selectedBeneficiary?.label,
    //   createdAt: serverTimestamp(),
    //   updatedAt: serverTimestamp(),
    // };
    // await addDoc(collection(firestore, "installation_reports"), dataToSave);

    Swal.fire({
      title: "Form Submitted (Simulated)",
      html: `Data for Applicant ID: <strong>${data.applicantId}</strong> and Beneficiary ID: <strong>${data.beneficiaryId}</strong> has been logged to the console.
             <br/><br/>Actual saving to a database (e.g., 'installation_reports' collection in Firestore) is not yet implemented for this form.`,
      icon: "info",
    });
    form.reset();
    setIsSubmitting(false);
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2 text-primary", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Wrench className="h-7 w-7 text-primary" />
            New Installation Report
          </CardTitle>
          <CardDescription>
            Fill in the details below to create a new installation report. Fields marked with an asterisk (*) are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <h3 className={cn(sectionHeadingClass)}>
                <FileText className="mr-2 h-5 w-5 text-primary" />
                L/C &amp; Invoice Details
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
                        selectPlaceholder={isLoadingDropdowns ? "Loading Applicants..." : "Select Applicant"}
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
                        selectPlaceholder={isLoadingDropdowns ? "Loading Beneficiaries..." : "Select Beneficiary"}
                        emptyStateMessage="No beneficiary found."
                        disabled={isLoadingDropdowns}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Add other L/C & Invoice related fields here later if needed */}
              <Separator />

              {/* Add other installation report sections and fields here */}

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingDropdowns}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Report...
                  </>
                ) : (
                  <>
                    <Wrench className="mr-2 h-4 w-4" />
                    Submit Installation Report
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

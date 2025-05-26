
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import type { DemoMachineApplication, DemoMachineFactoryDocument, DemoMachineDocument } from '@/types'; // Assuming these are defined
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AppWindow, Factory, Laptop, CalendarDays, Hash, User, Phone, MessageSquare, FileText, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const demoMachineApplicationSchema = z.object({
  factoryId: z.string().min(1, "Customer Name (Factory) is required."),
  // factoryLocation will be auto-filled, not part of Zod schema for submission validation
  demoMachineId: z.string().min(1, "Machine Model is required."),
  // machineModel, machineSerial, machineBrand will be auto-filled
  deliveryDate: z.date({ required_error: "Delivery Date is required." }),
  estReturnDate: z.date({ required_error: "Est. Return Date is required." }),
  // demoPeriodDays will be calculated
  factoryInchargeName: z.string().optional(),
  inchargeCell: z.string().optional().refine(
    (value) => value === "" || value === undefined || /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/.test(value),
    "Invalid phone number format"
  ),
  notes: z.string().optional(),
}).refine(data => {
  if (data.deliveryDate && data.estReturnDate) {
    return data.estReturnDate >= data.deliveryDate;
  }
  return true;
}, {
  message: "Est. Return Date must be on or after Delivery Date.",
  path: ["estReturnDate"],
});

type DemoMachineApplicationFormValues = z.infer<typeof demoMachineApplicationSchema>;

const PLACEHOLDER_FACTORY_VALUE = "__DEMO_APP_FACTORY__";
const PLACEHOLDER_MACHINE_VALUE = "__DEMO_APP_MACHINE__";

interface FactoryOption extends ComboboxOption {
  location: string;
}
interface MachineOption extends ComboboxOption {
  serial: string;
  brand: string;
}

export default function DemoMachineApplicationPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [factoryOptions, setFactoryOptions] = React.useState<FactoryOption[]>([]);
  const [machineOptions, setMachineOptions] = React.useState<MachineOption[]>([]);
  const [isLoadingFactories, setIsLoadingFactories] = React.useState(true);
  const [isLoadingMachines, setIsLoadingMachines] = React.useState(true);

  const [factoryLocationDisplay, setFactoryLocationDisplay] = React.useState<string>('');
  const [machineSerialDisplay, setMachineSerialDisplay] = React.useState<string>('');
  const [machineBrandDisplay, setMachineBrandDisplay] = React.useState<string>('');
  const [demoPeriodDisplay, setDemoPeriodDisplay] = React.useState<string>('0 Days');

  const form = useForm<DemoMachineApplicationFormValues>({
    resolver: zodResolver(demoMachineApplicationSchema),
    defaultValues: {
      factoryId: '',
      demoMachineId: '',
      deliveryDate: undefined,
      estReturnDate: undefined,
      factoryInchargeName: '',
      inchargeCell: '',
      notes: '',
    },
  });

  const { control, setValue, watch, reset } = form;

  const watchedFactoryId = watch("factoryId");
  const watchedDemoMachineId = watch("demoMachineId");
  const watchedDeliveryDate = watch("deliveryDate");
  const watchedEstReturnDate = watch("estReturnDate");

  React.useEffect(() => {
    const fetchFactories = async () => {
      setIsLoadingFactories(true);
      try {
        const factoriesSnapshot = await getDocs(query(collection(firestore, "demo_machine_factories"), orderBy("factoryName")));
        setFactoryOptions(
          factoriesSnapshot.docs.map(docSnap => {
            const data = docSnap.data() as DemoMachineFactoryDocument;
            return {
              value: docSnap.id,
              label: data.factoryName || 'Unnamed Factory',
              location: data.factoryLocation || 'N/A',
            };
          })
        );
      } catch (error) {
        console.error("Error fetching factories:", error);
        Swal.fire("Error", "Could not load factories.", "error");
      } finally {
        setIsLoadingFactories(false);
      }
    };
    fetchFactories();
  }, []);

  React.useEffect(() => {
    const fetchMachines = async () => {
      setIsLoadingMachines(true);
      try {
        const machinesSnapshot = await getDocs(query(collection(firestore, "demo_machines"), orderBy("machineModel")));
        setMachineOptions(
          machinesSnapshot.docs.map(docSnap => {
            const data = docSnap.data() as DemoMachineDocument;
            return {
              value: docSnap.id,
              label: data.machineModel || 'Unnamed Model',
              serial: data.machineSerial || 'N/A',
              brand: data.machineBrand || 'N/A',
            };
          })
        );
      } catch (error) {
        console.error("Error fetching demo machines:", error);
        Swal.fire("Error", "Could not load demo machines.", "error");
      } finally {
        setIsLoadingMachines(false);
      }
    };
    fetchMachines();
  }, []);

  React.useEffect(() => {
    if (watchedFactoryId && factoryOptions.length > 0) {
      const selectedFactory = factoryOptions.find(opt => opt.value === watchedFactoryId);
      setFactoryLocationDisplay(selectedFactory?.location || 'N/A');
    } else {
      setFactoryLocationDisplay('');
    }
  }, [watchedFactoryId, factoryOptions]);

  React.useEffect(() => {
    if (watchedDemoMachineId && machineOptions.length > 0) {
      const selectedMachine = machineOptions.find(opt => opt.value === watchedDemoMachineId);
      setMachineSerialDisplay(selectedMachine?.serial || 'N/A');
      setMachineBrandDisplay(selectedMachine?.brand || 'N/A');
    } else {
      setMachineSerialDisplay('');
      setMachineBrandDisplay('');
    }
  }, [watchedDemoMachineId, machineOptions]);

  React.useEffect(() => {
    if (watchedDeliveryDate && watchedEstReturnDate && isValid(watchedDeliveryDate) && isValid(watchedEstReturnDate) && watchedEstReturnDate >= watchedDeliveryDate) {
      const days = differenceInDays(watchedEstReturnDate, watchedDeliveryDate);
      setDemoPeriodDisplay(`${days} Day(s)`);
    } else {
      setDemoPeriodDisplay('0 Days');
    }
  }, [watchedDeliveryDate, watchedEstReturnDate]);

  async function onSubmit(data: DemoMachineApplicationFormValues) {
    setIsSubmitting(true);
    const selectedFactory = factoryOptions.find(opt => opt.value === data.factoryId);
    const selectedMachine = machineOptions.find(opt => opt.value === data.demoMachineId);

    const dataToSave = {
      factoryId: data.factoryId,
      factoryName: selectedFactory?.label || 'N/A',
      factoryLocation: selectedFactory?.location || 'N/A',
      demoMachineId: data.demoMachineId,
      machineModel: selectedMachine?.label || 'N/A',
      machineSerial: selectedMachine?.serial || 'N/A',
      machineBrand: selectedMachine?.brand || 'N/A',
      deliveryDate: format(data.deliveryDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      estReturnDate: format(data.estReturnDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      demoPeriodDays: (watchedDeliveryDate && watchedEstReturnDate && isValid(watchedDeliveryDate) && isValid(watchedEstReturnDate) && watchedEstReturnDate >= watchedDeliveryDate) ? differenceInDays(watchedEstReturnDate, watchedDeliveryDate) : 0,
      factoryInchargeName: data.factoryInchargeName || undefined,
      inchargeCell: data.inchargeCell || undefined,
      notes: data.notes || undefined,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, "demo_machine_applications"), dataToSave);
      Swal.fire("Success!", "Demo machine application submitted.", "success");
      reset();
      setFactoryLocationDisplay('');
      setMachineSerialDisplay('');
      setMachineBrandDisplay('');
      setDemoPeriodDisplay('0 Days');
    } catch (error) {
      console.error("Error submitting demo application:", error);
      Swal.fire("Error", `Failed to submit application: ${(error as Error).message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <AppWindow className="h-7 w-7 text-primary" />
            New Demo Machine Application
          </CardTitle>
          <CardDescription>
            Fill in the details below to request a demo machine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingFactories || isLoadingMachines ? (
            <div className="flex flex-col items-center justify-center h-60">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">Loading form options...</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={control}
                  name="factoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Factory className="mr-2 h-4 w-4 text-muted-foreground" />Customer Name (Factory)*</FormLabel>
                      <Combobox
                        options={factoryOptions}
                        value={field.value || PLACEHOLDER_FACTORY_VALUE}
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_FACTORY_VALUE ? '' : value)}
                        placeholder="Search Factory..."
                        selectPlaceholder="Select Factory"
                        emptyStateMessage="No factory found."
                        disabled={isLoadingFactories}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Factory Location</FormLabel>
                  <Input value={factoryLocationDisplay} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                </FormItem>

                <Separator />

                <FormField
                  control={control}
                  name="demoMachineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Laptop className="mr-2 h-4 w-4 text-muted-foreground" />Machine Model*</FormLabel>
                      <Combobox
                        options={machineOptions}
                        value={field.value || PLACEHOLDER_MACHINE_VALUE}
                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_MACHINE_VALUE ? '' : value)}
                        placeholder="Search Machine Model..."
                        selectPlaceholder="Select Machine Model"
                        emptyStateMessage="No machine found."
                        disabled={isLoadingMachines}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormItem>
                    <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Machine Serial</FormLabel>
                    <Input value={machineSerialDisplay} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                  </FormItem>
                  <FormItem>
                    <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Machine Brand</FormLabel>
                    <Input value={machineBrandDisplay} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                  </FormItem>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <FormField
                    control={control}
                    name="deliveryDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />Delivery Date*</FormLabel>
                        <DatePickerField field={field} placeholder="Select delivery date" />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="estReturnDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />Est. Return Date*</FormLabel>
                        <DatePickerField field={field} placeholder="Select return date" />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />Demo Period</FormLabel>
                    <Input value={demoPeriodDisplay} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                  </FormItem>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={control}
                    name="factoryInchargeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Factory Incharge Name</FormLabel>
                        <FormControl><Input placeholder="Enter incharge name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="inchargeCell"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground" />Incharge Cell</FormLabel>
                        <FormControl><Input type="tel" placeholder="Enter cell number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <FormField
                  control={control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Expected Result After Test/ Note</FormLabel>
                      <FormControl><Textarea placeholder="Describe expected results or any notes..." {...field} rows={4} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingFactories || isLoadingMachines}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" /> Submit Application</>
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    
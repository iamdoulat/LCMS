
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import type { DemoMachineApplicationDocument, DemoMachineFactoryDocument, DemoMachineDocument, DemoMachineStatusOption as AppDemoMachineStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AppWindow, Factory, Laptop, CalendarDays, Hash, User, Phone, MessageSquare, FileText, Save, PlusCircle, FileBadge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

const phoneRegexForValidation = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const demoMachineApplicationSchema = z.object({
  factoryId: z.string().min(1, "Customer Name (Factory) is required."),
  demoMachineId: z.string().min(1, "Machine Model is required."),
  challanNo: z.string().min(1, "Challan No. is required."),
  deliveryDate: z.date({ required_error: "Delivery Date is required." }),
  estReturnDate: z.date({ required_error: "Est. Return Date is required." }),
  factoryInchargeName: z.string().optional(),
  inchargeCell: z.string().optional().refine(
    (value) => value === "" || value === undefined || phoneRegexForValidation.test(value),
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

const PLACEHOLDER_FACTORY_VALUE = "__DEMO_APP_FACTORY_NEW__";
const PLACEHOLDER_MACHINE_VALUE = "__DEMO_APP_MACHINE_NEW__";

interface FactoryOption extends ComboboxOption {
  location: string;
  contactPerson?: string;
  cellNumber?: string;
}
interface MachineOption extends ComboboxOption {
  id: string;
  serial: string;
  brand: string;
}

export default function NewDemoMachineApplicationPage() {
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
      challanNo: '',
      deliveryDate: undefined,
      estReturnDate: undefined,
      factoryInchargeName: '',
      inchargeCell: '',
      notes: '',
    },
  });

  const { control, setValue, watch, reset, getValues } = form;

  const watchedFactoryId = watch("factoryId");
  const watchedDemoMachineId = watch("demoMachineId");
  const watchedDeliveryDate = watch("deliveryDate");
  const watchedEstReturnDate = watch("estReturnDate");
  const watchedInchargeCell = watch("inchargeCell");

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
              contactPerson: data.contactPerson,
              cellNumber: data.cellNumber,
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
        const availableMachines = machinesSnapshot.docs
          .map(docSnap => {
            const data = docSnap.data() as DemoMachineDocument;
            return { id: docSnap.id, ...data };
          })
          .filter(machine => machine.currentStatus === "Available");

        setMachineOptions(
          availableMachines.map(machine => ({
            id: machine.id,
            value: machine.id,
            label: machine.machineModel || 'Unnamed Model',
            serial: machine.machineSerial || 'N/A',
            brand: machine.machineBrand || 'N/A',
          }))
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
      setValue("factoryInchargeName", selectedFactory?.contactPerson || '', { shouldValidate: true, shouldDirty: true });
      setValue("inchargeCell", selectedFactory?.cellNumber || '', { shouldValidate: true, shouldDirty: true });
    } else if (!watchedFactoryId) {
      setFactoryLocationDisplay('');
      setValue("factoryInchargeName", '', { shouldValidate: true, shouldDirty: false });
      setValue("inchargeCell", '', { shouldValidate: true, shouldDirty: false });
    }
  }, [watchedFactoryId, factoryOptions, setValue]);

  React.useEffect(() => {
    if (watchedDemoMachineId && machineOptions.length > 0) {
      const selectedMachine = machineOptions.find(opt => opt.value === watchedDemoMachineId);
      setMachineSerialDisplay(selectedMachine?.serial || 'N/A');
      setMachineBrandDisplay(selectedMachine?.brand || 'N/A');
    } else if (!watchedDemoMachineId) {
      setMachineSerialDisplay('');
      setMachineBrandDisplay('');
    }
  }, [watchedDemoMachineId, machineOptions]);

  React.useEffect(() => {
    if (watchedDeliveryDate && watchedEstReturnDate && isValid(new Date(watchedDeliveryDate)) && isValid(new Date(watchedEstReturnDate)) && new Date(watchedEstReturnDate) >= new Date(watchedDeliveryDate)) {
      const days = differenceInDays(new Date(watchedEstReturnDate), new Date(watchedDeliveryDate));
      setDemoPeriodDisplay(`${days} Day(s)`);
    } else {
      setDemoPeriodDisplay('0 Days');
    }
  }, [watchedDeliveryDate, watchedEstReturnDate]);

  async function onSubmit(data: DemoMachineApplicationFormValues) {
    setIsSubmitting(true);
    const selectedFactory = factoryOptions.find(opt => opt.value === data.factoryId);
    const selectedMachine = machineOptions.find(opt => opt.value === data.demoMachineId);
    const deliveryDateValue = getValues("deliveryDate");
    const estReturnDateValue = getValues("estReturnDate");


    const dataToSave: Omit<DemoMachineApplicationDocument, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any, updatedAt: any } = {
      factoryId: data.factoryId,
      factoryName: selectedFactory?.label || 'N/A',
      factoryLocation: selectedFactory?.location || 'N/A',
      demoMachineId: data.demoMachineId,
      machineModel: selectedMachine?.label || 'N/A',
      machineSerial: selectedMachine?.serial || 'N/A',
      machineBrand: selectedMachine?.brand || 'N/A',
      challanNo: data.challanNo,
      deliveryDate: deliveryDateValue ? format(new Date(deliveryDateValue), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : '',
      estReturnDate: estReturnDateValue ? format(new Date(estReturnDateValue), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : '',
      demoPeriodDays: (deliveryDateValue && estReturnDateValue && isValid(new Date(deliveryDateValue)) && isValid(new Date(estReturnDateValue)) && new Date(estReturnDateValue) >= new Date(deliveryDateValue)) ? differenceInDays(new Date(estReturnDateValue), new Date(deliveryDateValue)) : 0,
      factoryInchargeName: data.factoryInchargeName || undefined,
      inchargeCell: data.inchargeCell || undefined,
      notes: data.notes || undefined,
      machineReturned: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key as keyof typeof dataToSave] === undefined) {
            delete dataToSave[key as keyof typeof dataToSave];
        }
    });

    try {
      await addDoc(collection(firestore, "demo_machine_applications"), dataToSave);

      if (data.demoMachineId) {
        const machineRef = doc(firestore, "demo_machines", data.demoMachineId);
        try {
          await updateDoc(machineRef, {
            currentStatus: "Allocated" as AppDemoMachineStatus,
            updatedAt: serverTimestamp(),
          });
          setMachineOptions(prev => prev.filter(m => m.id !== data.demoMachineId));
        } catch (machineError) {
          console.error("Error updating demo machine status:", machineError);
           Swal.fire("Warning", `Application saved, but failed to update machine status: ${(machineError as Error).message}`, "warning");
        }
      }

      Swal.fire("Success!", "Demo machine application submitted and machine status updated.", "success");
      reset();
      setFactoryLocationDisplay('');
      setMachineSerialDisplay('');
      setMachineBrandDisplay('');
      setDemoPeriodDisplay('0 Days');
      setValue("factoryInchargeName", '', { shouldValidate: false });
      setValue("inchargeCell", '', { shouldValidate: false });
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <AppWindow className="h-7 w-7 text-primary" />
                New Demo Machine Application
              </CardTitle>
              <CardDescription>
                Fill in the details below to request a demo machine. Only 'Available' machines are shown.
              </CardDescription>
            </div>
          </div>
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
                        emptyStateMessage="No available machine found."
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
                 <FormField
                  control={form.control}
                  name="challanNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><FileBadge className="mr-2 h-4 w-4 text-muted-foreground" />Challan No:*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Challan No" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                        <FormControl><Input placeholder="Enter incharge name" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="inchargeCell"
                    render={({ field }) => (
                     <FormItem>
                        <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground"/>Incharge Cell</FormLabel>
                         <div className="flex items-center gap-2">
                            <FormControl className="flex-grow">
                                <Input type="tel" placeholder="Enter cell number" {...field} value={field.value ?? ''} />
                            </FormControl>
                            {watchedInchargeCell && phoneRegexForValidation.test(watchedInchargeCell) ? (
                                <a href={`tel:${watchedInchargeCell.replace(/\s/g, '')}`} title={`Call ${watchedInchargeCell}`}>
                                    <Button type="button" variant="outline" size="icon" className="shrink-0">
                                        <Phone className="h-4 w-4 text-primary" />
                                    </Button>
                                </a>
                            ) : (
                                <Button type="button" variant="outline" size="icon" className="shrink-0" disabled>
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            )}
                            {watchedInchargeCell && phoneRegexForValidation.test(watchedInchargeCell) ? (
                                <a
                                href={`https://wa.me/${watchedInchargeCell.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Chat on WhatsApp with ${watchedInchargeCell}`}
                                >
                                    <Button type="button" variant="outline" size="icon" className="shrink-0">
                                        <MessageSquare className="h-4 w-4 text-primary" />
                                    </Button>
                                </a>
                            ) : (
                                <Button type="button" variant="outline" size="icon" className="shrink-0" disabled>
                                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            )}
                        </div>
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
                      <FormControl><Textarea placeholder="Describe expected results or any notes..." {...field} rows={4} value={field.value ?? ''} /></FormControl>
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

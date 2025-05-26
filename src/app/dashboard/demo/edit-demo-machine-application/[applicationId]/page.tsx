
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid, differenceInDays, isPast, isFuture, isToday, startOfDay } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, getDoc, Timestamp } from 'firebase/firestore'; // Added Timestamp
import type { DemoMachineApplicationDocument, DemoMachineFactoryDocument, DemoMachineDocument, DemoMachineStatusOption as AppDemoMachineStatus } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Loader2, Factory, Laptop, CalendarDays, Hash, User, Phone, MessageSquare, FileText, Save, ArrowLeft, AppWindow, AlertTriangle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useParams, useRouter } from 'next/navigation';

const phoneRegexForValidation = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const demoMachineApplicationSchema = z.object({
  factoryId: z.string().min(1, "Customer Name (Factory) is required."),
  demoMachineId: z.string().min(1, "Machine Model is required."),
  deliveryDate: z.date({ required_error: "Delivery Date is required." }),
  estReturnDate: z.date({ required_error: "Est. Return Date is required." }),
  factoryInchargeName: z.string().optional(),
  inchargeCell: z.string().optional().refine(
    (value) => value === "" || value === undefined || phoneRegexForValidation.test(value),
    "Invalid phone number format"
  ),
  notes: z.string().optional(),
  machineReturned: z.boolean().optional().default(false),
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

const PLACEHOLDER_FACTORY_VALUE = "__EDIT_DEMO_APP_FACTORY__";
const PLACEHOLDER_MACHINE_VALUE = "__EDIT_DEMO_APP_MACHINE__";

interface FactoryOption extends ComboboxOption {
  location: string;
  contactPerson?: string;
  cellNumber?: string;
}
interface MachineOption extends ComboboxOption {
  serial: string;
  brand: string;
}

type CurrentDemoStatus = "Upcoming" | "Active" | "Overdue" | "Returned";

interface EditDemoMachineApplicationFormProps {
  initialData: DemoMachineApplicationDocument;
  applicationId: string;
}

export function EditDemoMachineApplicationForm({ initialData, applicationId }: EditDemoMachineApplicationFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [factoryOptions, setFactoryOptions] = React.useState<FactoryOption[]>([]);
  const [machineOptions, setMachineOptions] = React.useState<MachineOption[]>([]);
  const [isLoadingFactories, setIsLoadingFactories] = React.useState(true);
  const [isLoadingMachines, setIsLoadingMachines] = React.useState(true);

  const [factoryLocationDisplay, setFactoryLocationDisplay] = React.useState<string>(initialData.factoryLocation || '');
  const [machineSerialDisplay, setMachineSerialDisplay] = React.useState<string>(initialData.machineSerial || '');
  const [machineBrandDisplay, setMachineBrandDisplay] = React.useState<string>(initialData.machineBrand || '');
  const [demoPeriodDisplay, setDemoPeriodDisplay] = React.useState<string>(`${initialData.demoPeriodDays || 0} Day(s)`);
  const [currentDemoStatus, setCurrentDemoStatus] = React.useState<CurrentDemoStatus>("Upcoming");

  const form = useForm<DemoMachineApplicationFormValues>({
    resolver: zodResolver(demoMachineApplicationSchema),
    defaultValues: {
      factoryId: initialData.factoryId || '',
      demoMachineId: initialData.demoMachineId || '',
      deliveryDate: initialData.deliveryDate && isValid(parseISO(initialData.deliveryDate)) ? parseISO(initialData.deliveryDate) : undefined,
      estReturnDate: initialData.estReturnDate && isValid(parseISO(initialData.estReturnDate)) ? parseISO(initialData.estReturnDate) : undefined,
      factoryInchargeName: initialData.factoryInchargeName || '',
      inchargeCell: initialData.inchargeCell || '',
      notes: initialData.notes || '',
      machineReturned: initialData.machineReturned ?? false,
    },
  });

  const { control, setValue, watch, reset, getValues } = form;

  const watchedFactoryId = watch("factoryId");
  const watchedDemoMachineId = watch("demoMachineId");
  const watchedDeliveryDate = watch("deliveryDate");
  const watchedEstReturnDate = watch("estReturnDate");
  const watchedInchargeCell = watch("inchargeCell");
  const watchedMachineReturned = watch("machineReturned");

  React.useEffect(() => {
    const calculateCurrentDemoStatus = (): CurrentDemoStatus => {
        const machineReturnedValue = getValues("machineReturned"); 
        if (machineReturnedValue) return "Returned";
        
        const deliveryDateValue = getValues("deliveryDate");
        const estReturnDateValue = getValues("estReturnDate");

        const today = startOfDay(new Date());
        const delivery = deliveryDateValue ? startOfDay(new Date(deliveryDateValue)) : null;
        const estReturn = estReturnDateValue ? startOfDay(new Date(estReturnDateValue)) : null;

        if (!delivery || !estReturn || !isValid(delivery) || !isValid(estReturn)) return "Upcoming"; 

        if (isPast(estReturn)) return "Overdue";
        if ((isToday(delivery) || isPast(delivery)) && (isToday(estReturn) || isFuture(estReturn))) return "Active";
        if (isFuture(delivery)) return "Upcoming";
        
        return "Upcoming"; 
    };
    setCurrentDemoStatus(calculateCurrentDemoStatus());
  }, [watchedDeliveryDate, watchedEstReturnDate, watchedMachineReturned, getValues]);


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
          .filter(machine => machine.currentStatus === "Available" || machine.id === initialData.demoMachineId);

        setMachineOptions(
          availableMachines.map(machine => ({
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
  }, [initialData.demoMachineId]);

  React.useEffect(() => {
    if (initialData && factoryOptions.length > 0 && machineOptions.length > 0) {
      const resetValues: DemoMachineApplicationFormValues = {
        factoryId: initialData.factoryId || '',
        demoMachineId: initialData.demoMachineId || '',
        deliveryDate: initialData.deliveryDate && isValid(parseISO(initialData.deliveryDate)) ? parseISO(initialData.deliveryDate) : undefined as any, 
        estReturnDate: initialData.estReturnDate && isValid(parseISO(initialData.estReturnDate)) ? parseISO(initialData.estReturnDate) : undefined as any, 
        factoryInchargeName: initialData.factoryInchargeName || '',
        inchargeCell: initialData.inchargeCell || '',
        notes: initialData.notes || '',
        machineReturned: initialData.machineReturned ?? false,
      };
      reset(resetValues);

      const selectedFactory = factoryOptions.find(opt => opt.value === initialData.factoryId);
      setFactoryLocationDisplay(selectedFactory?.location || initialData.factoryLocation || 'N/A');
      
      const selectedMachine = machineOptions.find(opt => opt.value === initialData.demoMachineId);
      setMachineSerialDisplay(selectedMachine?.serial || initialData.machineSerial || 'N/A');
      setMachineBrandDisplay(selectedMachine?.brand || initialData.machineBrand || 'N/A');

    }
  }, [initialData, reset, factoryOptions, machineOptions]);


  React.useEffect(() => {
    if (watchedFactoryId && factoryOptions.length > 0) {
      const selectedFactory = factoryOptions.find(opt => opt.value === watchedFactoryId);
      setFactoryLocationDisplay(selectedFactory?.location || 'N/A');
      
      if (getValues("factoryInchargeName") === (initialData.factoryInchargeName || '')) {
         setValue("factoryInchargeName", selectedFactory?.contactPerson || '', { shouldValidate: true, shouldDirty: true });
      }
      if (getValues("inchargeCell") === (initialData.inchargeCell || '')) {
        setValue("inchargeCell", selectedFactory?.cellNumber || '', { shouldValidate: true, shouldDirty: true });
      }
    } else if (!watchedFactoryId && (!isLoadingFactories && factoryOptions.length > 0)) { 
        setFactoryLocationDisplay('');
        setValue("factoryInchargeName", '', { shouldValidate: true, shouldDirty: true });
        setValue("inchargeCell", '', { shouldValidate: true, shouldDirty: true });
    } else if (!watchedFactoryId) {
         setFactoryLocationDisplay(initialData.factoryLocation || '');
    }
  }, [watchedFactoryId, factoryOptions, setValue, getValues, initialData.factoryInchargeName, initialData.inchargeCell, initialData.factoryLocation, isLoadingFactories]);

  React.useEffect(() => {
    if (watchedDemoMachineId && machineOptions.length > 0) {
      const selectedMachine = machineOptions.find(opt => opt.value === watchedDemoMachineId);
      setMachineSerialDisplay(selectedMachine?.serial || 'N/A');
      setMachineBrandDisplay(selectedMachine?.brand || 'N/A');
    } else if (!watchedDemoMachineId && (!isLoadingMachines && machineOptions.length > 0)) {
       setMachineSerialDisplay('');
       setMachineBrandDisplay('');
    } else if (!watchedDemoMachineId) {
       setMachineSerialDisplay(initialData.machineSerial || '');
       setMachineBrandDisplay(initialData.machineBrand || '');
    }
  }, [watchedDemoMachineId, machineOptions, initialData.machineSerial, initialData.machineBrand, isLoadingMachines]);

  React.useEffect(() => {
    const deliveryDateVal = getValues("deliveryDate");
    const estReturnDateVal = getValues("estReturnDate");
    if (deliveryDateVal && estReturnDateVal && isValid(new Date(deliveryDateVal)) && isValid(new Date(estReturnDateVal)) && new Date(estReturnDateVal) >= new Date(deliveryDateVal)) {
      const days = differenceInDays(new Date(estReturnDateVal), new Date(deliveryDateVal));
      setDemoPeriodDisplay(`${days} Day(s)`);
    } else {
      setDemoPeriodDisplay('0 Days');
    }
  }, [watchedDeliveryDate, watchedEstReturnDate, getValues]);

  async function onSubmit(data: DemoMachineApplicationFormValues) {
    if (!applicationId) {
      Swal.fire("Error", "Application ID is missing. Cannot update.", "error");
      return;
    }
    setIsSubmitting(true);
    const selectedFactory = factoryOptions.find(opt => opt.value === data.factoryId);
    const selectedMachine = machineOptions.find(opt => opt.value === data.demoMachineId);
    const deliveryDateVal = getValues("deliveryDate");
    const estReturnDateVal = getValues("estReturnDate");


    const dataToUpdate: Partial<Omit<DemoMachineApplicationDocument, 'id' | 'createdAt'>> & {updatedAt: any} = {
      factoryId: data.factoryId,
      factoryName: selectedFactory?.label || initialData.factoryName,
      factoryLocation: selectedFactory?.location || initialData.factoryLocation,
      demoMachineId: data.demoMachineId,
      machineModel: selectedMachine?.label || initialData.machineModel,
      machineSerial: selectedMachine?.serial || initialData.machineSerial,
      machineBrand: selectedMachine?.brand || initialData.machineBrand,
      deliveryDate: data.deliveryDate ? format(new Date(data.deliveryDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      estReturnDate: data.estReturnDate ? format(new Date(data.estReturnDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      demoPeriodDays: (deliveryDateVal && estReturnDateVal && isValid(new Date(deliveryDateVal)) && isValid(new Date(estReturnDateVal)) && new Date(estReturnDateVal) >= new Date(deliveryDateVal)) ? differenceInDays(new Date(estReturnDateVal), new Date(deliveryDateVal)) : 0,
      factoryInchargeName: data.factoryInchargeName || undefined,
      inchargeCell: data.inchargeCell || undefined,
      notes: data.notes || undefined,
      machineReturned: data.machineReturned ?? false,
      updatedAt: serverTimestamp(),
    };
    
    Object.keys(dataToUpdate).forEach(key => {
        if (dataToUpdate[key as keyof typeof dataToUpdate] === undefined) {
            delete dataToUpdate[key as keyof typeof dataToUpdate];
        }
    });

    try {
      const appDocRef = doc(firestore, "demo_machine_applications", applicationId);
      await updateDoc(appDocRef, dataToUpdate);
      Swal.fire("Success!", "Demo machine application updated.", "success");
    } catch (error) {
      console.error("Error updating demo application:", error);
      Swal.fire("Error", `Failed to update application: ${(error as Error).message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const getDemoStatusBadgeVariant = (status: CurrentDemoStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
        case "Active": return "default"; 
        case "Overdue": return "destructive";
        case "Returned": return "secondary";
        case "Upcoming": return "outline";
        default: return "outline";
    }
  };

  if (isLoadingFactories || isLoadingMachines) {
    return (
      <div className="flex flex-col items-center justify-center h-60">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
        <p className="text-muted-foreground">Loading form options...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex justify-end mb-4">
             <Badge variant={getDemoStatusBadgeVariant(currentDemoStatus)} className="text-sm px-3 py-1">
                {currentDemoStatus}
            </Badge>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
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

        <div className="space-y-4">
             <FormField
                control={form.control}
                name="machineReturned"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-card">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            id="machineReturned"
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel htmlFor="machineReturned" className="text-sm font-medium hover:cursor-pointer">
                            Machine Returned by Factory
                            </FormLabel>
                            <FormDescription className="text-xs">
                            Check this if the demo machine has been returned.
                            </FormDescription>
                        </div>
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name="notes"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Expected Result After Test/ Note</FormLabel>
                    <FormControl><Textarea placeholder="Describe expected results or any notes..." {...field} rows={4} value={field.value ?? ''}/></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <div className="space-y-1">
                 <FormLabel className="flex items-center text-sm font-medium">Calculated Demo Status</FormLabel>
                 <Input value={currentDemoStatus} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                 <FormDescription className="text-xs">This status is automatically calculated based on dates and returned status.</FormDescription>
            </div>
        </div>


        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingFactories || isLoadingMachines}>
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Changes...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save Changes</>
          )}
        </Button>
      </form>
    </Form>
  );
}


export default function EditDemoMachineApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.applicationId as string;

  const [applicationData, setApplicationData] = React.useState<DemoMachineApplicationDocument | null>(null);
  const [isLoadingPage, setIsLoadingPage] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (applicationId) {
      setIsLoadingPage(true);
      setError(null);
      const fetchApp = async () => {
        try {
          const docRef = doc(firestore, "demo_machine_applications", applicationId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as Omit<DemoMachineApplicationDocument, 'id'>;
            setApplicationData({ 
                id: docSnap.id, 
                ...data,
                deliveryDate: data.deliveryDate instanceof Timestamp ? data.deliveryDate.toDate().toISOString() : data.deliveryDate,
                estReturnDate: data.estReturnDate instanceof Timestamp ? data.estReturnDate.toDate().toISOString() : data.estReturnDate,
            } as DemoMachineApplicationDocument);
          } else {
            setError("Demo Machine Application not found.");
            Swal.fire("Error", `Application with ID ${applicationId} not found.`, "error").then(() => {
                 router.push("/dashboard/demo/demo-machine-program");
            });
          }
        } catch (err: any) {
            console.error("Error fetching application data: ", err);
            setError(`Failed to fetch application data: ${err.message}`);
            Swal.fire("Error", `Failed to fetch application: ${err.message}`, "error");
        } finally {
            setIsLoadingPage(false);
        }
      };
      fetchApp();
    } else {
        setError("No Application ID provided.");
        setIsLoadingPage(false);
        Swal.fire("Error", "No Application ID specified.", "error").then(() => {
            router.push("/dashboard/demo/demo-machine-program");
        });
    }
  }, [applicationId, router]);

  if (isLoadingPage) {
    return (
      <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading application details for ID: {applicationId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-4xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading Application
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/demo/demo-machine-program">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Demo Program List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!applicationData) {
     return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Application data could not be loaded.</p>
         <Button variant="outline" asChild className="mt-4">
            <Link href="/dashboard/demo/demo-machine-program">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Demo Program List
            </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/demo/demo-machine-program" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Demo Program List
          </Button>
        </Link>
      </div>
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <AppWindow className="h-7 w-7 text-primary" />
            Edit Demo Machine Application
          </CardTitle>
          <CardDescription>
            Modify the details for application ID: <span className="font-semibold text-foreground">{applicationId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditDemoMachineApplicationForm initialData={applicationData} applicationId={applicationId} />
        </CardContent>
      </Card>
    </div>
  );
}

    
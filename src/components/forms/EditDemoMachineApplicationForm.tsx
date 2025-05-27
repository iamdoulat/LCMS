
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid, differenceInDays, isPast, isFuture, isToday, startOfDay } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Added Timestamp
import type { DemoMachineApplicationDocument, DemoMachineFactoryDocument, DemoMachineDocument, DemoMachineStatusOption as AppDemoMachineStatus } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Loader2, Factory, Laptop, CalendarDays, Hash, User, Phone, MessageSquare, FileText, Save, FileBadge } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const phoneRegexForValidation = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const demoMachineApplicationSchema = z.object({
  factoryId: z.string().min(1, "Customer Name (Factory) is required."),
  demoMachineId: z.string().min(1, "Machine Model is required."),
  challanNo: z.string().optional(),
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
  id: string;
  serial: string;
  brand: string;
}

type CurrentDemoStatus = "Upcoming" | "Active" | "Overdue" | "Returned";

interface EditDemoMachineApplicationFormProps {
  initialData: DemoMachineApplicationDocument;
  applicationId: string;
  onApplicationStatusChange?: (status: CurrentDemoStatus) => void;
}

export function EditDemoMachineApplicationForm({ initialData, applicationId, onApplicationStatusChange }: EditDemoMachineApplicationFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [factoryOptions, setFactoryOptions] = React.useState<FactoryOption[]>([]);
  const [machineOptions, setMachineOptions] = React.useState<MachineOption[]>([]);
  const [isLoadingFactories, setIsLoadingFactories] = React.useState(true);
  const [isLoadingMachines, setIsLoadingMachines] = React.useState(true);

  const [factoryLocationDisplay, setFactoryLocationDisplay] = React.useState<string>(initialData.factoryLocation || '');
  const [machineSerialDisplay, setMachineSerialDisplay] = React.useState<string>(initialData.machineSerial || '');
  const [machineBrandDisplay, setMachineBrandDisplay] = React.useState<string>(initialData.machineBrand || '');
  const [demoPeriodDisplay, setDemoPeriodDisplay] = React.useState<string>(`${initialData.demoPeriodDays || 0} Day(s)`);
  
  const isInitialMount = React.useRef(true);
  const prevMachineReturnedRef = React.useRef(initialData.machineReturned);
  const isAfterInitialResetRef = React.useRef(false);

  const form = useForm<DemoMachineApplicationFormValues>({
    resolver: zodResolver(demoMachineApplicationSchema),
    defaultValues: {
      factoryId: initialData.factoryId || '',
      demoMachineId: initialData.demoMachineId || '',
      challanNo: initialData.challanNo || '',
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

        if (isPast(estReturn) && !isToday(estReturn)) return "Overdue";
        if ((isToday(delivery) || isPast(delivery)) && (isToday(estReturn) || isFuture(estReturn))) return "Active";
        if (isFuture(delivery)) return "Upcoming";
        
        return "Upcoming"; 
    };
    const newStatus = calculateCurrentDemoStatus();
    if (onApplicationStatusChange) {
        onApplicationStatusChange(newStatus);
    }
  }, [watchedDeliveryDate, watchedEstReturnDate, watchedMachineReturned, getValues, onApplicationStatusChange]);


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
        const allFetchedMachines = machinesSnapshot.docs.map(docSnap => {
          const data = docSnap.data() as DemoMachineDocument;
          return { id: docSnap.id, ...data };
        });
        
        // Filter for available machines OR the machine currently selected in initialData
        const availableMachines = allFetchedMachines.filter(machine => 
          machine.currentStatus === "Available" || machine.id === initialData.demoMachineId
        );

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
  }, [initialData.demoMachineId]); // Add initialData.demoMachineId to ensure options include current machine

 React.useEffect(() => {
    if (initialData && factoryOptions.length > 0 && machineOptions.length > 0 && !isSubmitting) {
      // Check if options actually contain the IDs from initialData, essential for Combobox to pre-select
      const factoryExists = factoryOptions.some(opt => opt.value === initialData.factoryId);
      const machineExists = machineOptions.some(opt => opt.value === initialData.demoMachineId);

      const resetValues: DemoMachineApplicationFormValues = {
        factoryId: factoryExists ? initialData.factoryId || '' : '',
        demoMachineId: machineExists ? initialData.demoMachineId || '' : '',
        challanNo: initialData.challanNo || '',
        deliveryDate: initialData.deliveryDate && isValid(parseISO(initialData.deliveryDate)) ? parseISO(initialData.deliveryDate) : undefined as any, 
        estReturnDate: initialData.estReturnDate && isValid(parseISO(initialData.estReturnDate)) ? parseISO(initialData.estReturnDate) : undefined as any, 
        factoryInchargeName: initialData.factoryInchargeName || '',
        inchargeCell: initialData.inchargeCell || '',
        notes: initialData.notes || '',
        machineReturned: initialData.machineReturned ?? false,
      };
      reset(resetValues);
      
      const selectedFactory = factoryOptions.find(opt => opt.value === resetValues.factoryId);
      setFactoryLocationDisplay(selectedFactory?.location || initialData.factoryLocation || 'N/A');
      
      const selectedMachine = machineOptions.find(opt => opt.value === resetValues.demoMachineId);
      setMachineSerialDisplay(selectedMachine?.serial || initialData.machineSerial || 'N/A');
      setMachineBrandDisplay(selectedMachine?.brand || initialData.machineBrand || 'N/A');
      
      isAfterInitialResetRef.current = true; 
      prevMachineReturnedRef.current = resetValues.machineReturned; 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, factoryOptions, machineOptions]); // Removed reset from dependencies as it can cause loops


  React.useEffect(() => {
    // Auto-fill factory details only if factoryId changes and is valid
    if (watchedFactoryId && factoryOptions.length > 0) {
      const selectedFactory = factoryOptions.find(opt => opt.value === watchedFactoryId);
      setFactoryLocationDisplay(selectedFactory?.location || 'N/A');
      setValue("factoryInchargeName", selectedFactory?.contactPerson || '', { shouldValidate: true, shouldDirty: true });
      setValue("inchargeCell", selectedFactory?.cellNumber || '', { shouldValidate: true, shouldDirty: true });
    } else if (!watchedFactoryId && isAfterInitialResetRef.current) { // Only clear if after initial reset
        setFactoryLocationDisplay('');
        setValue("factoryInchargeName", '', { shouldValidate: true, shouldDirty: true });
        setValue("inchargeCell", '', { shouldValidate: true, shouldDirty: true });
    }
  }, [watchedFactoryId, factoryOptions, setValue, initialData.factoryLocation, initialData.factoryInchargeName, initialData.inchargeCell]);

  React.useEffect(() => {
    // Auto-fill machine details only if demoMachineId changes and is valid
    if (watchedDemoMachineId && machineOptions.length > 0) {
      const selectedMachine = machineOptions.find(opt => opt.value === watchedDemoMachineId);
      setMachineSerialDisplay(selectedMachine?.serial || 'N/A');
      setMachineBrandDisplay(selectedMachine?.brand || 'N/A');
    } else if (!watchedDemoMachineId && isAfterInitialResetRef.current) { // Only clear if after initial reset
       setMachineSerialDisplay('');
       setMachineBrandDisplay('');
    }
  }, [watchedDemoMachineId, machineOptions, initialData.machineSerial, initialData.machineBrand]);

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

   React.useEffect(() => {
    // Effect to auto-update machine status in Firestore when "Machine Returned" checkbox changes
    if (!isAfterInitialResetRef.current) { 
        // Don't run this effect until the form is fully initialized with initialData
        return;
    }

    if (watchedMachineReturned !== prevMachineReturnedRef.current) {
      const currentDemoMachineId = getValues("demoMachineId");
      if (currentDemoMachineId) {
        const newMachineStatus = watchedMachineReturned ? "Available" : "Allocated";
        const updateMachineStatusInFirestore = async () => {
          console.log(`EditDemoAppForm: Automatic status update for Machine ID ${currentDemoMachineId} to ${newMachineStatus} due to 'Machine Returned' checkbox change.`);
          try {
            const machineRef = doc(firestore, "demo_machines", currentDemoMachineId);
            await updateDoc(machineRef, {
              currentStatus: newMachineStatus as AppDemoMachineStatus,
              updatedAt: serverTimestamp(),
            });
            // Optionally, a less intrusive notification or none at all for auto-updates
             Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'info',
              title: `Machine ${selectedMachine?.label || currentDemoMachineId} status updated to ${newMachineStatus}.`,
              showConfirmButton: false,
              timer: 2500,
            });
          } catch (error) {
            console.error("Error auto-updating machine status in EditDemoAppForm:", error);
            // Revert checkbox if update fails? Or just notify user.
            setValue("machineReturned", !watchedMachineReturned, { shouldValidate: false }); // Revert optimistic UI change
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: `Failed to auto-update machine status: ${(error as Error).message}. Change reverted.`,
                showConfirmButton: false,
                timer: 3500,
            });
          }
        };
        updateMachineStatusInFirestore();
      }
      prevMachineReturnedRef.current = watchedMachineReturned;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedMachineReturned, initialData.demoMachineId, getValues, setValue]);


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
      challanNo: data.challanNo || undefined,
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
      
      // Ensure machine status is synced on main save as well
      if (data.demoMachineId) {
        const machineRef = doc(firestore, "demo_machines", data.demoMachineId);
        const finalMachineStatus = data.machineReturned ? "Available" : "Allocated";
        try {
          await updateDoc(machineRef, {
            currentStatus: finalMachineStatus as AppDemoMachineStatus,
            updatedAt: serverTimestamp(),
          });
        } catch (machineError) {
          console.error("Error updating demo machine status on main save:", machineError);
           Swal.fire("Warning", `Application saved, but failed to update machine status: ${(machineError as Error).message}`, "warning");
        }
      }

      Swal.fire("Success!", "Demo machine application updated and machine status synced.", "success");
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
        {/* ... other form fields ... */}
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
              <FormLabel className="flex items-center"><FileBadge className="mr-2 h-4 w-4 text-muted-foreground" />Challan No:</FormLabel>
              <FormControl>
                <Input placeholder="Enter Challan No (Optional)" {...field} value={field.value ?? ''} />
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
                            Check this if the demo machine has been returned by the factory. This will attempt to update the machine's status to 'Available'.
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

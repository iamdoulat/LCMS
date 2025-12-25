
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid, differenceInDays, isPast, isFuture, isToday, startOfDay } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { DemoMachineApplicationDocument, DemoMachineFactoryDocument, DemoMachineDocument, DemoMachineStatusOption as AppDemoMachineStatus, DemoMachineApplicationFormValues as PageDemoMachineApplicationFormValues, AppliedMachineItem as PageAppliedMachineItem } from '@/types';
import { demoMachineApplicationSchema, AppliedMachineItemSchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/common';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Loader2, Factory, Laptop, CalendarDays, Hash, User, Phone, MessageSquare, FileText, Save, FileBadge, PlusCircle, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

const phoneRegexForValidation = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

type DemoMachineApplicationFormValues = PageDemoMachineApplicationFormValues;
type AppliedMachineItemType = PageAppliedMachineItem; // Matches the schema used

const PLACEHOLDER_FACTORY_VALUE = "__EDIT_DEMO_APP_FACTORY__";
const PLACEHOLDER_MACHINE_VALUE_PREFIX = "__EDIT_DEMO_APP_MACHINE_PLACEHOLDER__"; // Prefix for unique placeholders

interface FactoryOption extends ComboboxOption {
  id: string;
  location: string;
  contactPerson?: string;
  cellNumber?: string;
}
interface AvailableMachineOption extends ComboboxOption {
  id: string;
  serial: string;
  brand: string;
  currentStatus?: AppDemoMachineStatus; // To know if it's available or allocated to this app
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
  const [allFetchedMachines, setAllFetchedMachines] = React.useState<DemoMachineDocument[]>([]);
  const [availableMachineOptions, setAvailableMachineOptions] = React.useState<AvailableMachineOption[]>([]);

  const [isLoadingFactories, setIsLoadingFactories] = React.useState(true);
  const [isLoadingMachines, setIsLoadingMachines] = React.useState(true);

  const [factoryLocationDisplay, setFactoryLocationDisplay] = React.useState<string>(initialData.factoryLocation || '');
  const [demoPeriodDisplay, setDemoPeriodDisplay] = React.useState<string>(`${initialData.demoPeriodDays || 0} Day(s)`);

  const form = useForm<DemoMachineApplicationFormValues>({
    resolver: zodResolver(demoMachineApplicationSchema),
    defaultValues: {
      factoryId: initialData.factoryId || '',
      challanNo: initialData.challanNo || '',
      deliveryPersonName: initialData.deliveryPersonName || '',
      deliveryDate: initialData.deliveryDate && isValid(parseISO(initialData.deliveryDate)) ? parseISO(initialData.deliveryDate) : undefined,
      estReturnDate: initialData.estReturnDate && isValid(parseISO(initialData.estReturnDate)) ? parseISO(initialData.estReturnDate) : undefined,
      factoryInchargeName: initialData.factoryInchargeName || '',
      inchargeCell: initialData.inchargeCell || '',
      notes: initialData.notes || '',
      machineReturned: initialData.machineReturned ?? false,
      appliedMachines: initialData.appliedMachines?.map(m => ({ demoMachineId: m.demoMachineId })) || [{ demoMachineId: '' }],
    },
  });

  const { control, setValue, watch, reset, getValues, formState: { errors } } = form;

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "appliedMachines",
  });

  const watchedFactoryId = watch("factoryId");
  const watchedAppliedMachines = watch("appliedMachines");
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
    const fetchInitialDropdownData = async () => {
      setIsLoadingFactories(true);
      setIsLoadingMachines(true);
      try {
        const factoriesSnapshot = await getDocs(query(collection(firestore, "demo_machine_factories"), orderBy("factoryName")));
        setFactoryOptions(
          factoriesSnapshot.docs.map(docSnap => {
            const data = docSnap.data() as DemoMachineFactoryDocument;
            return { id: docSnap.id, value: docSnap.id, label: data.factoryName || 'Unnamed Factory', location: data.factoryLocation || 'N/A', contactPerson: data.contactPerson, cellNumber: data.cellNumber };
          })
        );

        const machinesSnapshot = await getDocs(query(collection(firestore, "demo_machines"), orderBy("machineModel")));
        const fetchedMachines = machinesSnapshot.docs.map(docSnap => ({ ...(docSnap.data() as Omit<DemoMachineDocument, 'id'>), id: docSnap.id }));
        setAllFetchedMachines(fetchedMachines);

      } catch (error) {
        console.error("Error fetching dropdown data:", error);
        Swal.fire("Error", `Could not load factories or machines: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingFactories(false);
        setIsLoadingMachines(false);
      }
    };
    fetchInitialDropdownData();
  }, []);

  React.useEffect(() => {
    if (!isLoadingFactories && !isLoadingMachines && initialData) {
        const resetValues = {
            factoryId: initialData.factoryId || '',
            challanNo: initialData.challanNo || '',
            deliveryPersonName: initialData.deliveryPersonName || '',
            deliveryDate: initialData.deliveryDate && isValid(parseISO(initialData.deliveryDate)) ? parseISO(initialData.deliveryDate) : undefined,
            estReturnDate: initialData.estReturnDate && isValid(parseISO(initialData.estReturnDate)) ? parseISO(initialData.estReturnDate) : undefined,
            factoryInchargeName: initialData.factoryInchargeName || '',
            inchargeCell: initialData.inchargeCell || '',
            notes: initialData.notes || '',
            machineReturned: initialData.machineReturned ?? false,
            appliedMachines: initialData.appliedMachines && initialData.appliedMachines.length > 0
                ? initialData.appliedMachines.map(m => ({ demoMachineId: m.demoMachineId || '' }))
                : [{ demoMachineId: '' }],
        };
        replace(resetValues.appliedMachines); // Use replace for field array to correctly set initial values
        
        // Need to reset other form values separately if `replace` only handles array
        Object.keys(resetValues).forEach(key => {
            if (key !== 'appliedMachines') {
                setValue(key as keyof DemoMachineApplicationFormValues, resetValues[key as keyof DemoMachineApplicationFormValues], { shouldValidate: true, shouldDirty: false });
            }
        });
    }
  }, [initialData, isLoadingFactories, isLoadingMachines, replace, setValue]);


  React.useEffect(() => {
    const currentAppliedMachineIds = watchedAppliedMachines.map(m => m.demoMachineId).filter(Boolean);
    const newAvailableOptions = allFetchedMachines
      .filter(machine =>
        (machine.currentStatus === "Available" || currentAppliedMachineIds.includes(machine.id)) // Machine is available OR already selected in this app
      )
      .map(machine => ({
        id: machine.id,
        value: machine.id,
        label: `${machine.machineModel || 'Unnamed Model'} (S/N: ${machine.machineSerial || 'N/A'})`,
        serial: machine.machineSerial || 'N/A',
        brand: machine.machineBrand || 'N/A',
        currentStatus: machine.currentStatus,
      }));
    setAvailableMachineOptions(newAvailableOptions);
  }, [watchedAppliedMachines, allFetchedMachines]);


  React.useEffect(() => {
    if (watchedFactoryId && factoryOptions.length > 0) {
      const selectedFactory = factoryOptions.find(opt => opt.id === watchedFactoryId);
      setFactoryLocationDisplay(selectedFactory?.location || initialData.factoryLocation || 'N/A');
      setValue("factoryInchargeName", selectedFactory?.contactPerson || initialData.factoryInchargeName || '', { shouldValidate: true, shouldDirty: true });
      setValue("inchargeCell", selectedFactory?.cellNumber || initialData.inchargeCell || '', { shouldValidate: true, shouldDirty: true });
    }
  }, [watchedFactoryId, factoryOptions, setValue, initialData]);


  React.useEffect(() => {
    if (watchedDeliveryDate && watchedEstReturnDate && isValid(new Date(watchedDeliveryDate)) && isValid(new Date(watchedEstReturnDate)) && new Date(watchedEstReturnDate) >= new Date(watchedDeliveryDate)) {
      const days = differenceInDays(new Date(watchedEstReturnDate), new Date(watchedDeliveryDate));
      setDemoPeriodDisplay(`${days} Day(s)`);
    } else {
      setDemoPeriodDisplay(initialData.demoPeriodDays ? `${initialData.demoPeriodDays} Day(s)` : '0 Days');
    }
  }, [watchedDeliveryDate, watchedEstReturnDate, initialData.demoPeriodDays]);

  async function onSubmit(data: DemoMachineApplicationFormValues) {
    if (!applicationId) {
      Swal.fire("Error", "Application ID is missing. Cannot update.", "error");
      return;
    }
    setIsSubmitting(true);
    const batch = writeBatch(firestore);

    const selectedFactory = factoryOptions.find(opt => opt.value === data.factoryId);
    const deliveryDateVal = getValues("deliveryDate");
    const estReturnDateVal = getValues("estReturnDate");

    const finalAppliedMachines = data.appliedMachines.map(applied => {
      const machineDetail = allFetchedMachines.find(m => m.id === applied.demoMachineId);
      return {
        demoMachineId: applied.demoMachineId,
        machineModel: machineDetail?.machineModel || 'N/A',
        machineSerial: machineDetail?.machineSerial || 'N/A',
        machineBrand: machineDetail?.machineBrand || 'N/A',
      };
    }).filter(m => m.demoMachineId); // Ensure only valid entries are saved

    const appDataToUpdate: Partial<Omit<DemoMachineApplicationDocument, 'id' | 'createdAt'>> & {updatedAt: any} = {
      factoryId: data.factoryId,
      factoryName: selectedFactory?.label || initialData.factoryName,
      factoryLocation: selectedFactory?.location || initialData.factoryLocation,
      challanNo: data.challanNo,
      deliveryPersonName: data.deliveryPersonName,
      deliveryDate: deliveryDateVal ? format(new Date(deliveryDateVal), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      estReturnDate: estReturnDateVal ? format(new Date(estReturnDateVal), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      demoPeriodDays: (deliveryDateVal && estReturnDateVal && isValid(new Date(deliveryDateVal)) && isValid(new Date(estReturnDateVal)) && new Date(estReturnDateVal) >= new Date(deliveryDateVal)) ? differenceInDays(new Date(estReturnDateVal), new Date(deliveryDateVal)) : initialData.demoPeriodDays,
      factoryInchargeName: data.factoryInchargeName || undefined,
      inchargeCell: data.inchargeCell || undefined,
      notes: data.notes || undefined,
      machineReturned: data.machineReturned ?? false,
      appliedMachines: finalAppliedMachines,
      updatedAt: serverTimestamp(),
    };
     Object.keys(appDataToUpdate).forEach(key => {
        const typedKey = key as keyof typeof appDataToUpdate;
        if (appDataToUpdate[typedKey] === undefined) {
            delete appDataToUpdate[typedKey];
        }
    });
    const appDocRef = doc(firestore, "demo_machine_applications", applicationId);
    batch.update(appDocRef, appDataToUpdate);

    // Machine Status Update Logic
    const initialMachineIds = new Set(initialData.appliedMachines?.map(m => m.demoMachineId));
    const finalMachineIds = new Set(finalAppliedMachines.map(m => m.demoMachineId));

    // Machines removed from this application
    initialData.appliedMachines?.forEach(initialMachine => {
      if (!finalMachineIds.has(initialMachine.demoMachineId)) {
        const machineRef = doc(firestore, "demo_machines", initialMachine.demoMachineId);
        batch.update(machineRef, { currentStatus: "Available" as AppDemoMachineStatus, machineReturned: true, updatedAt: serverTimestamp() });
      }
    });

    // Machines added or kept in this application
    finalAppliedMachines.forEach(finalMachine => {
      const machineRef = doc(firestore, "demo_machines", finalMachine.demoMachineId);
      const newStatus = data.machineReturned ? "Available" : "Allocated";
      batch.update(machineRef, { currentStatus: newStatus as AppDemoMachineStatus, machineReturned: data.machineReturned, updatedAt: serverTimestamp() });
    });

    try {
      await batch.commit();
      Swal.fire("Success!", "Demo machine application and machine statuses updated.", "success");
    } catch (error) {
      console.error("Error updating demo application and machines:", error);
      Swal.fire("Error", `Failed to update: ${(error as Error).message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

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
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <FormField
              control={form.control}
              name="deliveryPersonName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Delivery Person*</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter Delivery Person Name" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        <Separator />

        <h3 className="text-lg font-semibold text-foreground flex items-center">
            <Laptop className="mr-2 h-5 w-5 text-primary" /> Applied Machines
        </h3>
        {fields.map((item, index) => {
            const currentMachineIdInField = getValues(`appliedMachines.${index}.demoMachineId`);
            const selectedMachineDetails = allFetchedMachines.find(m => m.id === currentMachineIdInField);
            return (
            <div key={item.id} className="p-4 border rounded-md space-y-4 relative bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <FormField
                    control={control}
                    name={`appliedMachines.${index}.demoMachineId`}
                    render={({ field }) => (
                    <FormItem className="md:col-span-1">
                        <FormLabel className="flex items-center"><Laptop className="mr-2 h-4 w-4 text-muted-foreground" />Machine Model*</FormLabel>
                        <Combobox
                        options={availableMachineOptions}
                        value={field.value || PLACEHOLDER_MACHINE_VALUE_PREFIX + index}
                        onValueChange={(value) => field.onChange(value === (PLACEHOLDER_MACHINE_VALUE_PREFIX + index) ? '' : value)}
                        placeholder="Search Machine Model..."
                        selectPlaceholder="Select Machine Model"
                        emptyStateMessage="No available machine found or all selected."
                        disabled={isLoadingMachines}
                        />
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormItem className="md:col-span-1">
                    <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Machine Serial</FormLabel>
                    <Input value={selectedMachineDetails?.machineSerial || 'N/A'} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                </FormItem>
                <FormItem className="md:col-span-1">
                    <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Machine Brand</FormLabel>
                    <Input value={selectedMachineDetails?.machineBrand || 'N/A'} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                </FormItem>
                </div>
                {fields.length > 1 && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                    title="Remove Machine"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
                )}
            </div>
            );
        })}
        <Button
            type="button"
            variant="outline"
            onClick={() => append({ demoMachineId: '' })}
            className="mt-2"
        >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Another Machine
        </Button>
        {errors.appliedMachines && typeof errors.appliedMachines.message === 'string' && (
            <FormMessage>{errors.appliedMachines.message}</FormMessage>
        )}
        {errors.appliedMachines && Array.isArray(errors.appliedMachines) && errors.appliedMachines.map((err, i) => err?.demoMachineId?.message ? <FormMessage key={i}>Machine {i+1}: {err.demoMachineId.message}</FormMessage> : null)}


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
                            id="editMachineReturned"
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel htmlFor="editMachineReturned" className="text-sm font-medium hover:cursor-pointer">
                            All Machines Returned by Factory
                            </FormLabel>
                            <FormDescription className="text-xs">
                            Check this if all demo machines in this application have been returned. This will update their statuses.
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


"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, isValid, differenceInDays } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, serverTimestamp, getDocs, query, orderBy, doc, runTransaction } from 'firebase/firestore';
import type { DemoMachineApplicationFormValues, DemoMachineApplicationDocument, DemoMachineFactoryDocument, DemoMachineDocument, DemoMachineStatusOption as AppDemoMachineStatus } from '@/types';
import { demoMachineApplicationSchema } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AppWindow, Factory, Laptop, CalendarDays, Hash, User, Phone, MessageSquare, FileText, Save, FileBadge, PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox'; // Added for machineReturned
import { useAuth } from '@/context/AuthContext';

const phoneRegexForValidation = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const PLACEHOLDER_FACTORY_VALUE = "__DEMO_APP_FACTORY_NEW__";
const PLACEHOLDER_MACHINE_VALUE = "__DEMO_APP_MACHINE_NEW_PLACEHOLDER__"; // Generic placeholder

interface FactoryOption extends ComboboxOption {
  id: string;
  location: string;
  contactPerson?: string;
  cellNumber?: string;
}
interface AvailableMachineOption extends ComboboxOption { // Renamed for clarity
  id: string;
  serial: string;
  brand: string;
}

export default function NewDemoMachineApplicationPage() {
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [factoryOptions, setFactoryOptions] = React.useState<FactoryOption[]>([]);
  const [availableMachineOptions, setAvailableMachineOptions] = React.useState<AvailableMachineOption[]>([]); // For Combobox
  const [allFetchedMachines, setAllFetchedMachines] = React.useState<DemoMachineDocument[]>([]); // Store all for details

  const [isLoadingFactories, setIsLoadingFactories] = React.useState(true);
  const [isLoadingMachines, setIsLoadingMachines] = React.useState(true);

  const [factoryLocationDisplay, setFactoryLocationDisplay] = React.useState<string>('');
  const [demoPeriodDisplay, setDemoPeriodDisplay] = React.useState<string>('0 Days');

  const form = useForm<DemoMachineApplicationFormValues>({
    resolver: zodResolver(demoMachineApplicationSchema),
    defaultValues: {
      factoryId: '',
      challanNo: '',
      deliveryPersonName: '',
      deliveryDate: undefined,
      estReturnDate: undefined,
      factoryInchargeName: '',
      inchargeCell: '',
      notes: '',
      machineReturned: false, // Default for new application
      appliedMachines: [{ demoMachineId: '' }], // Start with one machine entry
    },
  });

  const { control, setValue, watch, reset, getValues, formState: { errors } } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "appliedMachines",
  });

  const watchedFactoryId = watch("factoryId");
  const watchedAppliedMachines = watch("appliedMachines"); // Watch the array of machines
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
              id: docSnap.id,
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
        const fetchedMachines = machinesSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          // Ensure `id` from the document is included without conflict
          return { ...data, id: docSnap.id } as DemoMachineDocument;
        });
        setAllFetchedMachines(fetchedMachines); // Store all for lookups

        const currentlySelectedMachineIds = getValues("appliedMachines").map(m => m.demoMachineId).filter(Boolean);
        const availableForSelection = fetchedMachines
          .filter(machine => machine.currentStatus === "Available" && !currentlySelectedMachineIds.includes(machine.id))
          .map(machine => ({
            id: machine.id,
            value: machine.id,
            label: `${machine.machineModel || 'Unnamed Model'} (S/N: ${machine.machineSerial || 'N/A'})`, // Include S/N in label for uniqueness
            serial: machine.machineSerial || 'N/A',
            brand: machine.machineBrand || 'N/A',
          }));
        setAvailableMachineOptions(availableForSelection);
      } catch (error) {
        console.error("Error fetching demo machines:", error);
        Swal.fire("Error", "Could not load demo machines.", "error");
      } finally {
        setIsLoadingMachines(false);
      }
    };
    fetchMachines();
  }, [getValues]); // Re-fetch/filter when appliedMachines change (though actual selection change is better)

  // Update available machine options when selected machines change
  React.useEffect(() => {
    const currentlySelectedMachineIds = watchedAppliedMachines.map(m => m.demoMachineId).filter(Boolean);
    const newAvailableOptions = allFetchedMachines
      .filter(machine => machine.currentStatus === "Available" && !currentlySelectedMachineIds.includes(machine.id))
      .map(machine => ({
        id: machine.id,
        value: machine.id,
        label: `${machine.machineModel || 'Unnamed Model'} (S/N: ${machine.machineSerial || 'N/A'})`,
        serial: machine.machineSerial || 'N/A',
        brand: machine.machineBrand || 'N/A',
      }));
    setAvailableMachineOptions(newAvailableOptions);
  }, [watchedAppliedMachines, allFetchedMachines]);


  React.useEffect(() => {
    if (watchedFactoryId && factoryOptions.length > 0) {
      const selectedFactory = factoryOptions.find(opt => opt.id === watchedFactoryId);
      setFactoryLocationDisplay(selectedFactory?.location || 'N/A');
      setValue("factoryInchargeName", selectedFactory?.contactPerson || '', { shouldValidate: true, shouldDirty: true });
      setValue("inchargeCell", selectedFactory?.cellNumber || '', { shouldValidate: true, shouldDirty: true });
    } else if (!watchedFactoryId) {
      setFactoryLocationDisplay('');
      setValue("factoryInchargeName", '', { shouldValidate: false });
      setValue("inchargeCell", '', { shouldValidate: false });
    }
  }, [watchedFactoryId, factoryOptions, setValue]);

  React.useEffect(() => {
    const deliveryDateValue = getValues("deliveryDate");
    const estReturnDateValue = getValues("estReturnDate");
    if (deliveryDateValue && estReturnDateValue && isValid(new Date(deliveryDateValue)) && isValid(new Date(estReturnDateValue)) && new Date(estReturnDateValue) >= new Date(deliveryDateValue)) {
      const days = differenceInDays(new Date(estReturnDateValue), new Date(deliveryDateValue));
      setDemoPeriodDisplay(`${days} Day(s)`);
    } else {
      setDemoPeriodDisplay('0 Days');
    }
  }, [watchedDeliveryDate, watchedEstReturnDate, getValues]);

  async function onSubmit(data: DemoMachineApplicationFormValues) {
    setIsSubmitting(true);

    const selectedFactory = factoryOptions.find(opt => opt.value === data.factoryId);
    if (!selectedFactory) {
      Swal.fire("Error", "Selected factory not found.", "error");
      setIsSubmitting(false);
      return;
    }

    try {
      await runTransaction(firestore, async (transaction) => {
        const appCounterRef = doc(firestore, "counters", "demoApplicationNumberGenerator");
        const appCounterSnap = await transaction.get(appCounterRef);
        const currentYear = new Date().getFullYear();
        const factoryPrefix = selectedFactory.label.substring(0, 3).toUpperCase();

        // Application ID
        const currentAppCount = appCounterSnap.exists() ? appCounterSnap.data()?.yearlyCounts?.[currentYear] || 0 : 0;
        const newAppCount = currentAppCount + 1;
        const newAppId = `${factoryPrefix}${currentYear}${String(newAppCount).padStart(3, '0')}`;

        transaction.set(appCounterRef, { yearlyCounts: { ...(appCounterSnap.data()?.yearlyCounts || {}), [currentYear]: newAppCount } }, { merge: true });

        // --- Prepare Application Data ---
        const deliveryDateValue = getValues("deliveryDate");
        const estReturnDateValue = getValues("estReturnDate");
        const machinesToSave = data.appliedMachines.map(appliedMachine => {
          const machineDetails = allFetchedMachines.find(m => m.id === appliedMachine.demoMachineId);
          return {
            demoMachineId: appliedMachine.demoMachineId,
            machineModel: machineDetails?.machineModel || 'N/A',
            machineSerial: machineDetails?.machineSerial || 'N/A',
            machineBrand: machineDetails?.machineBrand || 'N/A',
          };
        });

        const appDataToSave: Omit<DemoMachineApplicationDocument, 'id' | 'createdAt' | 'updatedAt'> = {
          factoryId: data.factoryId,
          factoryName: selectedFactory?.label || 'N/A',
          factoryLocation: selectedFactory?.location || 'N/A',
          appliedMachines: machinesToSave,
          challanNo: data.challanNo || '', // Use manually entered challan no
          deliveryPersonName: data.deliveryPersonName,
          deliveryDate: deliveryDateValue ? format(new Date(deliveryDateValue), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : '',
          estReturnDate: estReturnDateValue ? format(new Date(estReturnDateValue), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : '',
          demoPeriodDays: (deliveryDateValue && estReturnDateValue && isValid(new Date(deliveryDateValue)) && isValid(new Date(estReturnDateValue)) && new Date(estReturnDateValue) >= new Date(deliveryDateValue)) ? differenceInDays(new Date(estReturnDateValue), new Date(deliveryDateValue)) : 0,
          factoryInchargeName: data.factoryInchargeName || undefined,
          inchargeCell: data.inchargeCell || undefined,
          notes: data.notes || undefined,
          machineReturned: data.machineReturned ?? false,
        };

        const cleanedAppData = { ...appDataToSave, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        Object.keys(cleanedAppData).forEach(key => { if (cleanedAppData[key as keyof typeof cleanedAppData] === undefined) delete cleanedAppData[key as keyof typeof cleanedAppData]; });

        const newAppDocRef = doc(firestore, "demo_machine_applications", newAppId);
        transaction.set(newAppDocRef, cleanedAppData);

        // --- Update Machine Statuses ---
        for (const appliedMachine of data.appliedMachines) {
          if (appliedMachine.demoMachineId) {
            const machineRef = doc(firestore, "demo_machines", appliedMachine.demoMachineId);
            transaction.update(machineRef, {
              currentStatus: "Allocated" as AppDemoMachineStatus,
              updatedAt: serverTimestamp(),
            });
          }
        }
        return newAppId; // Return new ID for success message
      }).then(async (newAppId) => {
        Swal.fire("Success!", `Demo application submitted with ID: ${newAppId} and Challan No: ${data.challanNo} has been created. Machine statuses updated.`, "success");
        reset();
        setFactoryLocationDisplay('');
        setDemoPeriodDisplay('0 Days');

        // Refetch machine options to reflect updated statuses
        const machinesSnapshot = await getDocs(query(collection(firestore, "demo_machines"), orderBy("machineModel")));
        const fetchedMachines = machinesSnapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as DemoMachineDocument));
        setAllFetchedMachines(fetchedMachines);
      });
    } catch (error) {
      console.error("Error submitting demo application:", error);
      Swal.fire("Error", `Failed to submit application: ${(error as Error).message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl max-w-6xl mx-auto">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <AppWindow className="h-7 w-7 text-primary" />
                New Demo Machine Application
              </CardTitle>
              <CardDescription>
                Fill in the details below to request demo machines. Only &apos;Available&apos; machines are shown.
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
                  <FormField
                    control={form.control}
                    name="challanNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><FileBadge className="mr-2 h-4 w-4 text-muted-foreground" />Challan No.*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter Manual Challan No." {...field} value={field.value ?? ''} />
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
                  const selectedMachineDetails = allFetchedMachines.find(m => m.id === watchedAppliedMachines[index]?.demoMachineId);
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
                                value={field.value || PLACEHOLDER_MACHINE_VALUE + index} // Ensure unique placeholder if needed
                                onValueChange={(value) => field.onChange(value === (PLACEHOLDER_MACHINE_VALUE + index) ? '' : value)}
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
                        <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground" />Incharge Cell</FormLabel>
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
                            id="machineReturnedAppForm"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel htmlFor="machineReturnedAppForm" className="text-sm font-medium hover:cursor-pointer">
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
                        <FormControl><Textarea placeholder="Describe expected results or any notes..." {...field} rows={4} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingFactories || isLoadingMachines || isReadOnly}>
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

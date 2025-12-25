
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, updateDoc } from 'firebase/firestore';
import type { DemoChallanFormValues, DemoMachineFactoryDocument, DemoMachineApplicationDocument, DemoChallanDocument } from '@/types';
import { DemoChallanSchema } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/common';
import { Loader2, PlusCircle, Trash2, Users, FileText, CalendarDays, Save, X, ShoppingBag, Hash, Truck, Factory } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_FACTORY_VALUE = "__DEMO_CHALLAN_EDIT_FACTORY__";
const PLACEHOLDER_APPLICATION_VALUE = "__DEMO_CHALLAN_EDIT_APP__";

interface FactoryOption extends ComboboxOption {
  address?: string;
}
interface ApplicationOption extends ComboboxOption {
  applicationData?: DemoMachineApplicationDocument;
}

interface EditDemoMachineChallanFormProps {
    initialData: DemoChallanDocument;
    challanId: string;
}

export function EditDemoMachineChallanForm({ initialData, challanId }: EditDemoMachineChallanFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [factoryOptions, setFactoryOptions] = React.useState<FactoryOption[]>([]);
  const [applicationOptions, setApplicationOptions] = React.useState<ApplicationOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);

  const form = useForm<DemoChallanFormValues>({
    resolver: zodResolver(DemoChallanSchema),
    defaultValues: {
      factoryId: initialData.factoryId,
      deliveryAddress: initialData.deliveryAddress,
      challanDate: parseISO(initialData.challanDate),
      linkedApplicationId: initialData.linkedApplicationId,
      deliveryPerson: initialData.deliveryPerson,
      vehicleNo: initialData.vehicleNo,
      lineItems: initialData.lineItems.map(item => ({...item, qty: item.qty.toString()})),
    },
  });

  const { control, setValue, watch, reset, handleSubmit } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const watchedFactoryId = watch("factoryId");
  const watchedApplicationId = watch("linkedApplicationId");

  React.useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [factoriesSnap, applicationsSnap] = await Promise.all([
          getDocs(collection(firestore, "demo_machine_factories")),
          getDocs(collection(firestore, "demo_machine_applications"))
        ]);
        setFactoryOptions(
          factoriesSnap.docs.map(doc => {
            const data = doc.data() as DemoMachineFactoryDocument;
            return { value: doc.id, label: data.factoryName || 'Unnamed Factory', address: data.factoryLocation };
          })
        );
        setApplicationOptions(
          applicationsSnap.docs.map(doc => {
            const data = doc.data() as DemoMachineApplicationDocument;
            return {
              value: doc.id,
              label: `${doc.id} - ${data.factoryName}`,
              applicationData: { ...data, id: doc.id },
            };
          })
        );
      } catch (error) {
        Swal.fire("Error", "Could not load factory or application data. Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, []);

  React.useEffect(() => {
    if (watchedFactoryId) {
      const selectedFactory = factoryOptions.find(opt => opt.value === watchedFactoryId);
      if (selectedFactory) {
        setValue("deliveryAddress", selectedFactory.address || "");
      }
    }
  }, [watchedFactoryId, factoryOptions, setValue]);
  
  React.useEffect(() => {
    if(watchedApplicationId) {
        const selectedApp = applicationOptions.find(opt => opt.value === watchedApplicationId)?.applicationData;
        if(selectedApp) {
            setValue("factoryId", selectedApp.factoryId, { shouldValidate: true });
            setValue("deliveryAddress", selectedApp.factoryLocation || '', { shouldValidate: true });
            setValue("deliveryPerson", selectedApp.deliveryPersonName || '', { shouldValidate: true });
            
            const newLineItems = selectedApp.appliedMachines.map(item => ({
                demoMachineId: item.demoMachineId,
                description: `${item.machineModel || 'N/A'} (S/N: ${item.machineSerial || 'N/A'})`,
                qty: '1'
            }));
            
            form.setValue("lineItems", newLineItems);
        }
    }
  }, [watchedApplicationId, applicationOptions, setValue, form]);

  const handleSave = async (data: DemoChallanFormValues) => {
    setIsSubmitting(true);
    const selectedFactory = factoryOptions.find(opt => opt.value === data.factoryId);

    const challanDataToUpdate: Partial<Omit<DemoChallanDocument, 'id' | 'createdAt'>> = {
        factoryId: data.factoryId,
        factoryName: selectedFactory?.label || 'N/A',
        deliveryAddress: data.deliveryAddress,
        challanDate: format(data.challanDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        linkedApplicationId: data.linkedApplicationId || undefined,
        deliveryPerson: data.deliveryPerson,
        vehicleNo: data.vehicleNo,
        lineItems: data.lineItems.map(item => ({...item, qty: parseFloat(item.qty)})),
        updatedAt: serverTimestamp(),
    };

    try {
        const docRef = doc(firestore, "demo_machine_challans", challanId);
        await updateDoc(docRef, challanDataToUpdate);
        Swal.fire("Challan Updated!", `Demo Challan ${challanId} has been successfully updated.`, "success");
    } catch(error: any) {
        Swal.fire("Update Failed", `Failed to update challan: ${error.message}`, "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoadingDropdowns) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading form options...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(handleSave)} className="space-y-8">
        <h3 className={cn(sectionHeadingClass)}><Factory className="mr-2 h-5 w-5 text-primary" />Factory & Delivery Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
           <FormField
              control={control}
              name="linkedApplicationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link to Demo Application (Optional)</FormLabel>
                  <Combobox
                    options={applicationOptions}
                    value={field.value || PLACEHOLDER_APPLICATION_VALUE}
                    onValueChange={(value) => field.onChange(value === PLACEHOLDER_APPLICATION_VALUE ? '' : value)}
                    placeholder="Search Application ID..."
                    selectPlaceholder="Select Application"
                    emptyStateMessage="No application found."
                  />
                  <FormDescription>Select an application to auto-fill factory and machine details.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          <FormField
              control={control}
              name="factoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Factory*</FormLabel>
                  <Combobox
                    options={factoryOptions}
                    value={field.value || PLACEHOLDER_FACTORY_VALUE}
                    onValueChange={(value) => field.onChange(value === PLACEHOLDER_FACTORY_VALUE ? '' : value)}
                    placeholder="Search Factory..."
                    selectPlaceholder="Select Factory"
                    disabled={isLoadingDropdowns || !!watchedApplicationId}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        <FormField
            control={control}
            name="deliveryAddress"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Delivery Address*</FormLabel>
                <FormControl><Textarea placeholder="Delivery address" {...field} rows={3} /></FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        
        <h3 className={cn(sectionHeadingClass)}><Truck className="mr-2 h-5 w-5 text-primary" />Challan Details</h3>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
             <FormItem><FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Challan Number</FormLabel><Input value={challanId} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" /></FormItem>
            <FormField control={control} name="challanDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Challan Date*</FormLabel><DatePickerField field={field} placeholder="Select date" /><FormMessage /></FormItem>)}/>
            <FormField control={control} name="deliveryPerson" render={({ field }) => (<FormItem><FormLabel>Delivery Person*</FormLabel><FormControl><Input placeholder="Name of delivery person" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={control} name="vehicleNo" render={({ field }) => (<FormItem><FormLabel>Vehicle No.</FormLabel><FormControl><Input placeholder="Vehicle number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
        
        <Separator className="my-6" />
        <h3 className={cn(sectionHeadingClass, "mb-0 border-b-0")}><ShoppingBag className="mr-2 h-5 w-5 text-primary" /> Line Items</h3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead className="w-[80px]">SL No.</TableHead><TableHead className="min-w-[250px]">Description of Goods*</TableHead><TableHead className="w-[120px]">Quantity*</TableHead><TableHead className="w-[50px] text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell><Input value={index + 1} readOnly disabled className="h-9 bg-muted/50" /></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.description`} render={({ field: itemField }) => (<Textarea placeholder="Item description" {...itemField} rows={1} className="h-9 min-h-[2.25rem] resize-y"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.description?.message}</FormMessage></TableCell>
                  <TableCell><FormField control={control} name={`lineItems.${index}.qty`} render={({ field: itemField }) => (<Input type="text" placeholder="1" {...itemField} className="h-9"/>)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.qty?.message}</FormMessage></TableCell>
                  <TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} title="Remove line item"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>))}
            </TableBody>
          </Table>
        </div>
        {form.formState.errors.lineItems && !form.formState.errors.lineItems.message && typeof form.formState.errors.lineItems === 'object' && form.formState.errors.lineItems.root && (<p className="text-sm font-medium text-destructive">{form.formState.errors.lineItems.root?.message || "Please ensure all line items are valid."}</p>)}
        <Button type="button" variant="outline" onClick={() => append({ demoMachineId: '', description: '', qty: '1'})} className="mt-2"><PlusCircle className="mr-2 h-4 w-4" /> Add Item</Button>
        <Separator />
        
        <div className="flex flex-wrap gap-2 justify-end">
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isLoadingDropdowns}>
              {isSubmitting ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Changes...</> ) : ( <><Save className="mr-2 h-4 w-4" />Save Changes</> )}
            </Button>
        </div>
      </form>
    </Form>
  );
}

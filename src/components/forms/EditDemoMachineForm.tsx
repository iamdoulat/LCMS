
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Laptop, Activity, Cog, Hash, FileText, FileInput, FileBadge } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { DemoMachineDocument, DemoMachineOwnerOption, DemoMachineStatusOption } from '@/types';
import { demoMachineOwnerOptions, demoMachineStatusOptions } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';

const demoMachineSchema = z.object({
  machineModel: z.string().min(1, "Machine Model is required"),
  machineSerial: z.string().min(1, "Machine Serial is required"),
  machineBrand: z.string().min(1, "Machine Brand is required"),
  motorOrControlBoxModel: z.string().optional(),
  controlBoxSerialNo: z.string().optional(),
  // challanNo: z.string().optional(), // Removed
  machineOwner: z.enum(demoMachineOwnerOptions, { required_error: "Machine Owner selection is required" }),
  currentStatus: z.enum(demoMachineStatusOptions, { required_error: "Current Machine Status is required" }),
  machineFeatures: z.string().optional(),
  note: z.string().optional(),
});

type DemoMachineEditFormValues = z.infer<typeof demoMachineSchema>;

interface EditDemoMachineFormProps {
  initialData: DemoMachineDocument;
  machineId: string;
}

const defaultFormValues: DemoMachineEditFormValues = {
  machineModel: '',
  machineSerial: '',
  machineBrand: '',
  motorOrControlBoxModel: '',
  controlBoxSerialNo: '',
  // challanNo: '', // Removed
  machineOwner: demoMachineOwnerOptions[0],
  currentStatus: demoMachineStatusOptions[0],
  machineFeatures: '',
  note: '',
};

export function EditDemoMachineForm({ initialData, machineId }: EditDemoMachineFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<DemoMachineEditFormValues>({
    resolver: zodResolver(demoMachineSchema),
    defaultValues: defaultFormValues,
  });

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        machineModel: initialData.machineModel || '',
        machineSerial: initialData.machineSerial || '',
        machineBrand: initialData.machineBrand || '',
        motorOrControlBoxModel: initialData.motorOrControlBoxModel || '',
        controlBoxSerialNo: initialData.controlBoxSerialNo || '',
        // challanNo: initialData.challanNo || '', // Removed
        machineOwner: initialData.machineOwner || demoMachineOwnerOptions[0],
        currentStatus: initialData.currentStatus || demoMachineStatusOptions[0],
        machineFeatures: initialData.machineFeatures || '',
        note: initialData.note || '',
      });
    }
  }, [initialData, form]);

  async function onSubmit(data: DemoMachineEditFormValues) {
    setIsSubmitting(true);

    const dataToUpdate: Partial<Omit<DemoMachineDocument, 'id' | 'createdAt' | 'machineReturned'>> & { updatedAt: any } = {
      machineModel: data.machineModel,
      machineSerial: data.machineSerial,
      machineBrand: data.machineBrand,
      motorOrControlBoxModel: data.motorOrControlBoxModel || undefined,
      controlBoxSerialNo: data.controlBoxSerialNo || undefined,
      // challanNo: data.challanNo || undefined, // Removed
      machineOwner: data.machineOwner,
      currentStatus: data.currentStatus,
      machineFeatures: data.machineFeatures || undefined,
      note: data.note || undefined,
      updatedAt: serverTimestamp(),
    };

    Object.keys(dataToUpdate).forEach(key => {
      const typedKey = key as keyof typeof dataToUpdate;
      if (dataToUpdate[typedKey] === '') {
         if (['motorOrControlBoxModel', 'controlBoxSerialNo', 'machineFeatures', 'note'].includes(typedKey)) {
            (dataToUpdate as any)[typedKey] = undefined;
         }
      }
    });


    try {
      const machineDocRef = doc(firestore, "demo_machines", machineId);
      await updateDoc(machineDocRef, dataToUpdate);
      Swal.fire({
        title: "Demo Machine Updated!",
        text: `Demo Machine (ID: ${machineId}) has been successfully updated.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (error: any) {
      console.error("Error updating demo machine document: ", error);
      const errorMessage = error.message || "An unknown error occurred.";
      Swal.fire({
        title: "Update Failed",
        text: `Failed to update demo machine: ${errorMessage}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="machineModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Machine Model*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter machine model" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="machineBrand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Machine Brand*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter machine brand" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="machineSerial"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Hash className="mr-1 h-3.5 w-3.5 text-muted-foreground"/>Machine Serial*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter machine serial number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="motorOrControlBoxModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Cog className="mr-1 h-3.5 w-3.5 text-muted-foreground"/>Motor or Control Box Model</FormLabel>
                <FormControl>
                  <Input placeholder="Enter model" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="controlBoxSerialNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Hash className="mr-1 h-3.5 w-3.5 text-muted-foreground"/>Control Box Serial No.</FormLabel>
                <FormControl>
                  <Input placeholder="Enter serial number" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {/* Challan No field removed */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="machineOwner"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-center"><Laptop className="mr-2 h-4 w-4 text-muted-foreground" />Machine Owner*</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value ?? defaultFormValues.machineOwner}
                    className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-4"
                  >
                    {demoMachineOwnerOptions.map((option) => (
                      <FormItem key={option} className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={option} />
                        </FormControl>
                        <FormLabel className="font-normal">{option}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currentStatus"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-center"><Activity className="mr-2 h-4 w-4 text-muted-foreground" />Current Machine Status*</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value ?? defaultFormValues.currentStatus}
                    className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-4"
                  >
                    {demoMachineStatusOptions.map((option) => (
                      <FormItem key={option} className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value={option} />
                        </FormControl>
                        <FormLabel className="font-normal">{option}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="machineFeatures"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Machine features:</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe machine features (e.g., color, special functions)" {...field} rows={3} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />Note:</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter any additional notes for this machine" {...field} rows={3} value={field.value ?? ''}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
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
    </Form>
  );
}

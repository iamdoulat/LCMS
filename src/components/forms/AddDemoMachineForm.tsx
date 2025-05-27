
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Laptop, Activity, Cog, Hash, FileText, FileBadge } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { DemoMachine, DemoMachineOwnerOption, DemoMachineStatusOption } from '@/types';
import { demoMachineOwnerOptions, demoMachineStatusOptions } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const demoMachineSchema = z.object({
  machineModel: z.string().min(1, "Machine Model is required"),
  machineSerial: z.string().min(1, "Machine Serial is required"),
  machineBrand: z.string().min(1, "Machine Brand is required"),
  motorOrControlBoxModel: z.string().optional(),
  controlBoxSerialNo: z.string().optional(),
  // challanNo: z.string().optional(), // Removed Challan No from here
  machineOwner: z.enum(demoMachineOwnerOptions, { required_error: "Machine Owner selection is required" }),
  currentStatus: z.enum(demoMachineStatusOptions, { required_error: "Current Machine Status is required" }).default(demoMachineStatusOptions[0]),
  machineFeatures: z.string().optional(),
  note: z.string().optional(),
});

type DemoMachineFormValues = z.infer<typeof demoMachineSchema>;

export function AddDemoMachineForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<DemoMachineFormValues>({
    resolver: zodResolver(demoMachineSchema),
    defaultValues: {
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
    },
  });

  async function onSubmit(data: DemoMachineFormValues) {
    setIsSubmitting(true);

    const dataToSave: Omit<DemoMachine, 'id' | 'createdAt' | 'updatedAt' | 'machineReturned'> & { createdAt: any, updatedAt: any } = {
      ...data,
      motorOrControlBoxModel: data.motorOrControlBoxModel || undefined,
      controlBoxSerialNo: data.controlBoxSerialNo || undefined,
      // challanNo: data.challanNo || undefined, // Removed
      machineFeatures: data.machineFeatures || undefined,
      note: data.note || undefined,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Ensure optional fields that are empty strings become undefined for Firestore
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key as keyof typeof dataToSave] === '') {
         if (['motorOrControlBoxModel', 'controlBoxSerialNo', 'machineFeatures', 'note'].includes(key)) {
             (dataToSave as any)[key] = undefined;
         }
      }
    });


    try {
      const docRef = await addDoc(collection(firestore, "demo_machines"), dataToSave);
      Swal.fire({
        title: "Demo Machine Saved!",
        text: `Demo Machine data saved successfully with ID: ${docRef.id}`,
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      });
      form.reset();
    } catch (error) {
      console.error("Error adding demo machine document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save demo machine: ${errorMessage}`,
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
                  <Input placeholder="Enter model" {...field} />
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
                  <Input placeholder="Enter serial number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {/* Challan No field removed from here */}
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
                    value={field.value}
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
                    value={field.value}
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
                <Textarea placeholder="Describe machine features (e.g., color, special functions)" {...field} rows={3} />
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
                <Textarea placeholder="Enter any additional notes for this machine" {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Demo Machine...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Demo Machine
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}


"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Laptop } from 'lucide-react';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { DemoMachine, DemoMachineOwnerOption } from '@/types'; // Ensure correct import
import { demoMachineOwnerOptions } from '@/types'; // Ensure correct import

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const demoMachineSchema = z.object({
  machineModel: z.string().min(1, "Machine Model is required"),
  machineSerial: z.string().min(1, "Machine Serial is required"),
  machineBrand: z.string().min(1, "Machine Brand is required"),
  machineOwner: z.enum(demoMachineOwnerOptions, { required_error: "Machine Owner selection is required" }),
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
      machineOwner: demoMachineOwnerOptions[0], // Default to "Own Machine"
    },
  });

  async function onSubmit(data: DemoMachineFormValues) {
    setIsSubmitting(true);
    
    const dataToSave: Omit<DemoMachine, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any, updatedAt: any } = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

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
          name="machineSerial"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Machine Serial*</FormLabel>
              <FormControl>
                <Input placeholder="Enter machine serial number" {...field} />
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
        
        <FormField
          control={form.control}
          name="machineOwner"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Machine Owner*</FormLabel>
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

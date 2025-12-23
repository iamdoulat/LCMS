
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Factory as FactoryIcon, Phone, Save, MessageSquare, User, Building } from 'lucide-react'; // Added MessageSquare and User
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { DemoMachineFactory } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const demoMachineFactorySchema = z.object({
  factoryName: z.string().min(1, "Factory name is required"),
  factoryLocation: z.string().min(1, "Factory location is required"),
  groupName: z.string().optional(),
  contactPerson: z.string().optional(),
  cellNumber: z.string().optional().refine(
    (value) => value === "" || value === undefined || phoneRegex.test(value),
    "Invalid phone number format"
  ),
  note: z.string().optional(),
});

type DemoMachineFactoryFormValues = z.infer<typeof demoMachineFactorySchema>;

export function AddDemoMachineFactoryForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<DemoMachineFactoryFormValues>({
    resolver: zodResolver(demoMachineFactorySchema),
    defaultValues: {
      factoryName: '',
      factoryLocation: '',
      groupName: '',
      contactPerson: '',
      cellNumber: '',
      note: '',
    },
  });

  const watchedCellNumber = form.watch("cellNumber");

  async function onSubmit(data: DemoMachineFactoryFormValues) {
    setIsSubmitting(true);
    
    const dataToSave: Omit<DemoMachineFactory, 'id'> & { createdAt: any, updatedAt: any } = {
      factoryName: data.factoryName,
      factoryLocation: data.factoryLocation,
      groupName: data.groupName || undefined,
      contactPerson: data.contactPerson || undefined,
      cellNumber: data.cellNumber || undefined,
      note: data.note || undefined,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key as keyof typeof dataToSave] === undefined) {
            delete dataToSave[key as keyof typeof dataToSave];
        }
    });

    try {
      const docRef = await addDoc(collection(firestore, "demo_machine_factories"), dataToSave);
      Swal.fire({
        title: "Factory Profile Saved!",
        text: `Demo Machine Factory data saved successfully with ID: ${docRef.id}`,
        icon: "success",
        timer: 1000,
        showConfirmButton: true,
      });
      form.reset();
    } catch (error) {
      console.error("Error adding demo machine factory document: ", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save factory profile: ${errorMessage}`,
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
          name="factoryName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Factory Name*</FormLabel>
              <FormControl>
                <Input placeholder="Enter factory name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="factoryLocation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Factory Location*</FormLabel>
                <FormControl>
                  <Textarea placeholder="Enter factory's full address" {...field} rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="groupName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground"/>Group Name:</FormLabel>
                <FormControl>
                  <Input placeholder="Enter group name (e.g., ABC Group)" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="contactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground"/>Incharge Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter incharge person's name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cellNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center">Cell Number</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl className="flex-grow">
                    <Input type="tel" placeholder="e.g., +8801XXXXXXXXX" {...field} />
                  </FormControl>
                  {watchedCellNumber && phoneRegex.test(watchedCellNumber) ? (
                     <a href={`tel:${watchedCellNumber.replace(/\s/g, '')}`} title={`Call ${watchedCellNumber}`}>
                        <Button type="button" variant="outline" size="icon" className="shrink-0">
                            <Phone className="h-4 w-4 text-primary" />
                        </Button>
                     </a>
                  ) : (
                    <Button type="button" variant="outline" size="icon" className="shrink-0" disabled>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  {watchedCellNumber && phoneRegex.test(watchedCellNumber) ? (
                     <a 
                       href={`https://wa.me/${watchedCellNumber.replace(/[^0-9]/g, '')}`} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       title={`Chat on WhatsApp with ${watchedCellNumber}`}
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
        
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter any additional notes for this factory" {...field} rows={4} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Factory...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Factory
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

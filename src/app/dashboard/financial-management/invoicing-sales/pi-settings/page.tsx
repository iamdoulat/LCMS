
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';

const PI_SETTINGS_COLLECTION = 'pi_layout_settings';
const PI_SETTINGS_DOC_ID = 'main_settings';

const piSettingsSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().optional(),
});

type PiSettingsFormValues = z.infer<typeof piSettingsSchema>;

export default function PISettingsPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');

  const form = useForm<PiSettingsFormValues>({
    resolver: zodResolver(piSettingsSchema),
    defaultValues: {
      name: '',
      address: '',
      email: '',
      phone: '',
    },
  });

  React.useEffect(() => {
    const fetchSettings = async () => {
      setIsLoadingData(true);
      try {
        const docRef = doc(firestore, PI_SETTINGS_COLLECTION, PI_SETTINGS_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          form.reset(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching PI settings:", error);
        Swal.fire("Error", "Could not load PI settings.", "error");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchSettings();
  }, [form]);

  async function onSubmit(data: PiSettingsFormValues) {
    setIsSubmitting(true);
    try {
      const docRef = doc(firestore, PI_SETTINGS_COLLECTION, PI_SETTINGS_DOC_ID);
      await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
      Swal.fire({
        title: "Settings Saved!",
        text: "Your PI layout settings have been updated.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error saving PI settings:", error);
      Swal.fire("Save Failed", "Could not save your settings.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingData) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Settings className="h-7 w-7 text-primary" />
            PI Settings
          </CardTitle>
          <CardDescription>
            Manage settings for Proforma Invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter a name" {...field} value={field.value ?? ""} disabled={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter an address" {...field} value={field.value ?? ""} disabled={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter an email" {...field} value={field.value ?? ""} disabled={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Enter a phone number" {...field} value={field.value ?? ""} disabled={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isSubmitting || isReadOnly}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Settings
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

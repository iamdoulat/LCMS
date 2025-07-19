
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Loader2, Save, Send, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const smtpEncryptionOptions = ["None", "TLS", "SSL"] as const;

const smtpSettingsSchema = z.object({
  smtpHost: z.string().min(1, "SMTP Host is required."),
  smtpPort: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Port must be a number." }).int().min(1, "Port must be positive.").max(65535, "Port is out of range.")
  ),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpEncryption: z.enum(smtpEncryptionOptions).default("TLS"),
  smtpFromEmail: z.string().email({ message: "Invalid 'From Email' address."}).min(1, "'From Email' is required."),
});

type SmtpSettingsFormValues = z.infer<typeof smtpSettingsSchema>;

const testEmailSchema = z.object({
  testEmailRecipient: z.string().email("Invalid recipient email address.").min(1, "Recipient email is required."),
});
type TestEmailFormValues = z.infer<typeof testEmailSchema>;

const SMTP_SETTINGS_STORAGE_KEY = 'appSmtpSettings'; // Key for localStorage

export default function SmtpSettingsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmittingSettings, setIsSubmittingSettings] = React.useState(false);
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const isReadOnly = userRole?.includes('Viewer');

  const settingsForm = useForm<SmtpSettingsFormValues>({
    resolver: zodResolver(smtpSettingsSchema),
    defaultValues: {
      smtpHost: '',
      smtpPort: 587, // Common port for TLS
      smtpUsername: '',
      smtpPassword: '',
      smtpEncryption: 'TLS',
      smtpFromEmail: '',
    },
  });

  const testEmailForm = useForm<TestEmailFormValues>({
    resolver: zodResolver(testEmailSchema),
    defaultValues: {
      testEmailRecipient: '',
    },
  });

  // Load saved settings from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem(SMTP_SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings) as SmtpSettingsFormValues;
          // Do NOT load password from localStorage for security
          settingsForm.reset({
            smtpHost: parsedSettings.smtpHost || '',
            smtpPort: parsedSettings.smtpPort || 587,
            smtpUsername: parsedSettings.smtpUsername || '',
            smtpPassword: '', // Always clear password field on load
            smtpEncryption: parsedSettings.smtpEncryption || 'TLS',
            smtpFromEmail: parsedSettings.smtpFromEmail || '',
          });
        } catch (error) {
          console.error("Error loading SMTP settings from localStorage:", error);
        }
      }
    }
  }, [settingsForm]);


  // Access control
  React.useEffect(() => {
    if (!authLoading && !userRole?.includes("Super Admin") && !isReadOnly) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to view/edit SMTP settings.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    }
  }, [userRole, authLoading, router, isReadOnly]);

  const onSaveSettings = async (data: SmtpSettingsFormValues) => {
    setIsSubmittingSettings(true);
    console.log("SMTP Settings (excluding password for security):", { ...data, smtpPassword: '***' });
    
    // Simulate saving to localStorage (excluding password)
    if (typeof window !== 'undefined') {
        const { smtpPassword, ...settingsToStore } = data; // Exclude password from storage
        localStorage.setItem(SMTP_SETTINGS_STORAGE_KEY, JSON.stringify(settingsToStore));
    }

    Swal.fire({
      title: "Settings Update (Simulated)",
      html: `SMTP settings (excluding password) have been "saved" to local browser storage for this demo.
             <br/><br/><strong>Important:</strong> In a real application, these settings, especially passwords, 
             must be stored securely on a backend server and never exposed to the client-side.`,
      icon: "info",
    });
    setIsSubmittingSettings(false);
  };

  const onSendTestEmail = async (data: TestEmailFormValues) => {
    setIsSendingTest(true);
    const currentSmtpSettings = settingsForm.getValues();

    // Check if essential SMTP settings are configured (even if just in form state for demo)
    if (!currentSmtpSettings.smtpHost || !currentSmtpSettings.smtpPort || !currentSmtpSettings.smtpFromEmail) {
         Swal.fire({
            title: "Configuration Incomplete",
            text: "Please configure and save SMTP Host, Port, and 'From Email' before sending a test email.",
            icon: "warning",
        });
        setIsSendingTest(false);
        return;
    }

    Swal.fire({
      title: "Test Email (Simulated)",
      html: `A test email would now be sent to <strong>${data.testEmailRecipient}</strong> 
             using the configured SMTP settings (Host: ${currentSmtpSettings.smtpHost}, Port: ${currentSmtpSettings.smtpPort}, From: ${currentSmtpSettings.smtpFromEmail}). 
             <br/><br/><strong>Note:</strong> This is a frontend simulation. Actual email sending requires a backend service.`,
      icon: "info",
    });
    setIsSendingTest(false);
    testEmailForm.reset();
  };


  if (authLoading || (!authLoading && !userRole?.includes("Super Admin") && !isReadOnly)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <SettingsIcon className="h-7 w-7 text-primary" />
            SMTP Settings
          </CardTitle>
          <CardDescription>
            Configure email server settings for application notifications. Sensitive data like passwords are not persistently stored client-side in this demo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-amber-500/10 border-amber-500/30">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-700 font-semibold">Security Notice</AlertTitle>
            <AlertDescription className="text-amber-700/90">
              This page is for demonstrating SMTP configuration UI. In a production environment, SMTP credentials must be managed securely on a backend server. <strong>Do not enter real production passwords here.</strong> Settings (excluding password) are saved to browser local storage for demo persistence only.
            </AlertDescription>
          </Alert>

          <Form {...settingsForm}>
            <form onSubmit={settingsForm.handleSubmit(onSaveSettings)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={settingsForm.control}
                  name="smtpHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Host*</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., smtp.example.com" {...field} disabled={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={settingsForm.control}
                  name="smtpPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Port*</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 587 or 465" {...field} disabled={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
               <FormField
                control={settingsForm.control}
                name="smtpFromEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>'From' Email Address*</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., no-reply@example.com" {...field} disabled={isReadOnly} />
                    </FormControl>
                    <FormDescription>The email address application emails will be sent from.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={settingsForm.control}
                  name="smtpUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter SMTP username" {...field} autoComplete="new-password" disabled={isReadOnly} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={settingsForm.control}
                  name="smtpPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter SMTP password" {...field} autoComplete="new-password" disabled={isReadOnly} />
                      </FormControl>
                      <FormDescription>Not persistently stored by this demo.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={settingsForm.control}
                name="smtpEncryption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Encryption*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select encryption type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {smtpEncryptionOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmittingSettings || isReadOnly}>
                {isSubmittingSettings ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save SMTP Settings (Simulated)
                  </>
                )}
              </Button>
            </form>
          </Form>

          <Separator className="my-8" />

          <h3 className={cn("font-semibold text-xl mb-4 text-foreground flex items-center")}>
            <Send className="mr-2 h-5 w-5 text-primary" />
            Test SMTP Configuration
          </h3>
          <Form {...testEmailForm}>
            <form onSubmit={testEmailForm.handleSubmit(onSendTestEmail)} className="space-y-6">
              <FormField
                control={testEmailForm.control}
                name="testEmailRecipient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Email Address*</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter recipient's email" {...field} disabled={isReadOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" variant="outline" disabled={isSendingTest || isReadOnly}>
                {isSendingTest ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Email (Simulated)
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

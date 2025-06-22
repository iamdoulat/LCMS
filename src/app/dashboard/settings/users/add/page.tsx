
"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, ArrowLeft, ShieldAlert, Info } from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { UserRole, UserDocumentForAdmin } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';


const addUserProfileSchema = z.object({
  displayName: z.string().min(1, "Display name is required."),
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  contactNumber: z.string().optional(),
  role: z.enum(["Admin", "User", "Super Admin", "Service"]).default("User"), // Added "Service"
});

type AddUserProfileFormValues = z.infer<typeof addUserProfileSchema>;

export default function AddUserPage() {
  const { userRole: adminUserRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddUserProfileFormValues>({
    resolver: zodResolver(addUserProfileSchema),
    defaultValues: {
      displayName: '',
      email: '',
      contactNumber: '',
      role: "User",
    },
  });

  useEffect(() => {
    if (!authLoading && adminUserRole !== "Super Admin" && adminUserRole !== "Admin") {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to add new user profiles.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard/settings/users');
      });
    }
  }, [adminUserRole, authLoading, router]);

  const onSubmit = async (data: AddUserProfileFormValues) => {
    setIsSubmitting(true);
    
    const profileToSave: Omit<UserDocumentForAdmin, 'id' | 'createdAt' | 'updatedAt' | 'uid' | 'photoURL'> & { createdAt: any, updatedAt: any } = {
      displayName: data.displayName,
      email: data.email,
      contactNumber: data.contactNumber || undefined,
      role: data.role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    Object.keys(profileToSave).forEach(key => {
        if (profileToSave[key as keyof typeof profileToSave] === undefined) {
            delete profileToSave[key as keyof typeof profileToSave];
        }
    });

    try {
      await addDoc(collection(firestore, "users"), profileToSave);
      Swal.fire({
        title: "User Profile Added to Firestore!",
        text: `Profile for ${data.displayName} (${data.email}) with role ${data.role} added to Firestore.`,
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      }).then((result) => {
        if(result.isConfirmed || result.isDismissed) {
            router.push('/dashboard/settings/users'); // Redirect to user list after saving
        }
      });
      form.reset();

    } catch (error: any) {
      console.error("Error adding user profile to Firestore:", error);
      Swal.fire({
        title: "Profile Creation Failed",
        text: error.message || "Could not add user profile to Firestore.",
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (authLoading || (!authLoading && adminUserRole !== "Super Admin" && adminUserRole !== "Admin")) {
     if (authLoading) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Verifying access...</p>
            </div>
        );
    }
    return ( // This UI is for after auth load but still no permission, while redirecting
         <div className="container mx-auto py-8">
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <ShieldAlert /> Access Denied
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>You do not have permission to view this page. Redirecting...</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/settings/users" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to User List
          </Button>
        </Link>
      </div>
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <UserPlus className="h-7 w-7 text-primary" />
            Add New User Profile (to Firestore)
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new user profile to the application database. This does not create a Firebase Authentication login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-blue-500/10 border-blue-500/30">
            <Info className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-700 font-semibold">Important Note</AlertTitle>
            <AlertDescription className="text-blue-700/90">
              - This form creates a user profile record in your Firestore database.
              - It does **not** create a Firebase Authentication account (login credentials). That requires a separate process (e.g., user self-registration or a backend Admin SDK function).
              - The assigned role is for application-level permissions.
            </AlertDescription>
          </Alert>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter user's full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address*</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Number (Optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign Role* (Application Level)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Super Admin">Super Admin</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="User">User</SelectItem>
                        <SelectItem value="Service">Service</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>This role is stored in Firestore and used for application permissions.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Profile...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add User Profile to Firestore
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

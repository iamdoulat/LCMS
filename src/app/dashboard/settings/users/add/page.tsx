
"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, UserPlus, ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const addUserSchema = z.object({
  displayName: z.string().min(1, "Display name is required."),
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string().min(6, "Confirm password is required."),
  contactNumber: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

export default function AddUserPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      contactNumber: '',
    },
  });

  useEffect(() => {
    if (!authLoading && userRole !== "Super Admin" && userRole !== "Admin") {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to add new users.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard/settings/users');
      });
    }
  }, [userRole, authLoading, router]);

  const onSubmit = async (data: AddUserFormValues) => {
    setIsSubmitting(true);
    console.log("Add User Form Submitted (UI Simulation):", data);

    // Simulate backend call for user creation
    await new Promise(resolve => setTimeout(resolve, 1500));

    Swal.fire({
      title: "User Creation (Simulated)",
      html: `User <b>${data.displayName}</b> with email <b>${data.email}</b> would be created here.<br/><b>Note:</b> Actual user creation in Firebase Authentication requires a secure backend call using the Firebase Admin SDK. This is a frontend simulation.`,
      icon: "info",
      confirmButtonText: "Understood",
    }).then(() => {
        form.reset();
    });

    setIsSubmitting(false);
    // TODO: Implement actual Firebase Admin SDK call via a backend function to create user
    // try {
    //   // Example: await callBackendFunction('createUser', { email: data.email, password: data.password, displayName: data.displayName, contactNumber: data.contactNumber });
    //   Swal.fire("User Created!", "User has been successfully created (simulated).", "success");
    //   form.reset();
    // } catch (error: any) {
    //   Swal.fire("Creation Failed", `Could not create user: ${error.message}`, "error");
    // }
  };

  if (authLoading || (userRole !== "Super Admin" && userRole !== "Admin")) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading or verifying access...</p>
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
            Add New User
          </CardTitle>
          <CardDescription>
            Fill in the details below to create a new user account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-amber-500/10 border-amber-500/30">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-700 font-semibold">Backend Required</AlertTitle>
            <AlertDescription className="text-amber-700/90">
              Actual user creation in Firebase Authentication must be handled by a secure backend function (e.g., Firebase Cloud Function) using the Firebase Admin SDK. This form simulates the UI for this process.
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password*</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter a secure password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password*</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Re-enter password" {...field} />
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
                      <Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* TODO: Add Role Assignment Dropdown here if Super Admin is creating an Admin */}
              {/* This would also require backend logic to set custom claims */}

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating User...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create User (Simulated)
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


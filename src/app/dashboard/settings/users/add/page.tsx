
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


const addUserProfileSchema = z.object({
  displayName: z.string().min(1, "Display name is required."),
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters long."),
  contactNumber: z.string().optional(),
  role: z.enum(["Admin", "User", "Super Admin", "Service", "DemoManager", "Store Manager"]).default("User"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
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
      password: '',
      confirmPassword: '',
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
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          displayName: data.displayName,
          role: data.role,
          // contactNumber can be added here if the API supports it
        }),
      });

      const result = await response.json();

      if (response.ok) {
        Swal.fire({
          title: "User Created!",
          text: result.message,
          icon: "success",
        });
        form.reset();
        router.push('/dashboard/settings/users'); // Go back to the user list
      } else {
        throw new Error(result.error || "An unknown error occurred");
      }
    } catch (error: any) {
      console.error("Error creating user from admin panel:", error);
      Swal.fire({
        title: "Creation Failed",
        text: error.message,
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
    return (
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
            Add New User
          </CardTitle>
          <CardDescription>
            Create a new login account and application profile for a user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-blue-500/10 border-blue-500/30">
            <Info className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-700 font-semibold">Admin User Creation</AlertTitle>
            <AlertDescription className="text-blue-700/90">
                This form uses a secure backend API route to create the user. You will remain logged in as an admin after creation.
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

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Password*</FormLabel>
                        <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
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
                        <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
               </div>


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
                        <SelectItem value="DemoManager">DemoManager</SelectItem>
                        <SelectItem value="Store Manager">Store Manager</SelectItem>
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
                    Creating User Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create User
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

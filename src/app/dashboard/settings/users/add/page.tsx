
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
import { Loader2, UserPlus, ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { UserRole } from '@/types';
import { auth } from '@/lib/firebase/config'; // Import Firebase auth instance
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';


const addUserSchema = z.object({
  displayName: z.string().min(1, "Display name is required."),
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string().min(6, "Confirm password is required."),
  contactNumber: z.string().optional(),
  role: z.enum(["Admin", "User", "Super Admin"]).default("User"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

export default function AddUserPage() {
  const { userRole: adminUserRole, loading: authLoading, user: adminUser } = useAuth();
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
      role: "User",
    },
  });

  useEffect(() => {
    if (!authLoading && adminUserRole !== "Super Admin" && adminUserRole !== "Admin") {
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
  }, [adminUserRole, authLoading, router]);

  const onSubmit = async (data: AddUserFormValues) => {
    setIsSubmitting(true);
    try {
      // Temporarily store admin's credentials if needed for re-authentication later
      // This is complex and generally not recommended for client-side.
      // The simpler flow is admin gets signed out.
      const adminAuth = auth; // Use the global auth instance

      // Create the new user
      const userCredential = await createUserWithEmailAndPassword(adminAuth, data.email, data.password);
      const newUser = userCredential.user;

      // Update the new user's profile with the display name
      await updateProfile(newUser, { displayName: data.displayName });

      // Sign out the newly created user (which also signs out the admin)
      await signOut(adminAuth);
      
      Swal.fire({
        title: "User Created in Firebase!",
        html: `User <b>${data.displayName}</b> (${data.email}) has been created in Firebase Authentication.
               <br/><br/><strong>IMPORTANT:</strong> You (the admin) have been signed out. Please log back in to continue.
               <br/><br/>Role assignment (<b>${data.role}</b>) needs to be handled via backend custom claims.
               <br/>Contact number is not stored in Firebase Auth.`,
        icon: "success",
        confirmButtonText: "OK, Re-login",
      }).then(() => {
        router.push('/login'); // Redirect admin to login page
      });
      form.reset();

    } catch (error: any) {
      console.error("Error creating user:", error);
      Swal.fire({
        title: "User Creation Failed",
        text: error.message || "Could not create user in Firebase Authentication.",
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (authLoading || (adminUserRole !== "Super Admin" && adminUserRole !== "Admin")) {
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
            Fill in the details below. This will create a new user in Firebase Authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-amber-500/10 border-amber-500/30">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-700 font-semibold">Admin Sign-Out & Role Assignment</AlertTitle>
            <AlertDescription className="text-amber-700/90">
              Creating a user here will sign you (the admin) out. You will need to log back in.
              Assigning roles (e.g., "{form.getValues("role")}") requires backend logic using Firebase Admin SDK (Custom Claims). The contact number is not stored in Firebase Auth by this form.
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
                      <Input type="tel" placeholder="e.g., +1 123 456 7890" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormDescription>
                      Contact number is not stored in Firebase Auth; it would require a separate database (e.g., Firestore) entry linked to the user.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign Role* (Note: Requires Backend)</FormLabel>
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
                      </SelectContent>
                    </Select>
                    <FormDescription>Actual Firebase roles require custom claims set by a backend.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create User in Firebase
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

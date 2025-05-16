
"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, UserPlus, ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

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
  const { userRole, loading: authLoading, user: adminUser, logout: adminLogout } = useAuth();
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

    try {
      // Create the user
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const newUser = userCredential.user;

      // Update the new user's profile with the display name
      await updateProfile(newUser, {
        displayName: data.displayName
      });
      
      // If a contact number was provided, it would typically be stored in Firestore
      // alongside the user's UID, as Firebase Auth doesn't have a direct field for it.
      // This part is omitted as it requires Firestore setup for user profiles.
      console.log("Contact number (if provided, store in Firestore):", data.contactNumber);

      // IMPORTANT: The admin is now signed in as the new user.
      // We must sign out this new user session. This will also sign out the admin.
      await signOut(auth);

      Swal.fire({
        title: "User Created Successfully!",
        html: `User <b>${data.displayName}</b> (${data.email}) has been created in Firebase Authentication.<br/><br/><b>Important:</b> You (the admin) have been signed out as part of this process. Please log in again.`,
        icon: "success",
        confirmButtonText: "OK",
      }).then(() => {
        form.reset();
        // Since the admin is logged out, redirect to login.
        // The AuthGuard will handle this, but we can be explicit.
        router.push('/login'); 
      });

    } catch (error: any) {
      console.error("Error creating user:", error);
      let errorMessage = "Failed to create user. Please try again.";
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = "This email address is already in use by another account.";
            break;
          case 'auth/invalid-email':
            errorMessage = "The email address is not valid.";
            break;
          case 'auth/operation-not-allowed':
            errorMessage = "Email/password accounts are not enabled. Please enable it in the Firebase Console.";
            break;
          case 'auth/weak-password':
            errorMessage = "The password is too weak.";
            break;
          default:
            errorMessage = error.message;
        }
      }
      Swal.fire("User Creation Failed", errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
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
            Fill in the details below to create a new user account in Firebase Authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-amber-500/10 border-amber-500/30">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-700 font-semibold">Important Considerations</AlertTitle>
            <AlertDescription className="text-amber-700/90">
              - Creating a user here will add them to Firebase Authentication. <br/>
              - **You (the admin) will be signed out after creating a user.** This is a side effect of using the client-side SDK for user creation in an admin context. You will need to log back in.<br/>
              - Role assignment (e.g., Admin, User) and storing contact numbers require backend functions (Firebase Admin SDK) and are not handled by this form.
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
                    <FormDescription>
                      Contact number is not stored in Firebase Auth; it would require a separate database (e.g., Firestore) entry linked to the user.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating User...
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

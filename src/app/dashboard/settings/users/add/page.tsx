
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

// Interface for simulated user data stored in localStorage
interface SimulatedUser {
  id: string;
  displayName: string;
  email: string;
  contactNumber?: string;
  role: UserRole;
}

const SIMULATED_USERS_STORAGE_KEY = 'simulatedUsersList';

export default function AddUserPage() {
  const { userRole: adminUserRole, loading: authLoading } = useAuth();
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
    
    // Simulate saving to localStorage
    try {
      const existingUsersString = localStorage.getItem(SIMULATED_USERS_STORAGE_KEY);
      const existingUsers: SimulatedUser[] = existingUsersString ? JSON.parse(existingUsersString) : [];
      
      const newUser: SimulatedUser = {
        id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, // Simple unique ID for simulation
        displayName: data.displayName,
        email: data.email,
        contactNumber: data.contactNumber,
        role: data.role as UserRole,
      };
      
      existingUsers.push(newUser);
      localStorage.setItem(SIMULATED_USERS_STORAGE_KEY, JSON.stringify(existingUsers));

      Swal.fire({
        title: "User Added (Locally Simulated)",
        html: `User <b>${data.displayName}</b> (${data.email}) has been added to the local simulated list.
               <br/><br/><strong>Note:</strong> Actual user creation in Firebase Authentication requires a secure backend function (e.g., Firebase Cloud Function) using the Firebase Admin SDK.
               <br/>This also applies to setting roles/custom claims. The admin performing this action remains logged in.`,
        icon: "success",
        confirmButtonText: "OK",
      }).then(() => {
        form.reset();
        router.push('/dashboard/settings/users'); 
      });

    } catch (e) {
        console.error("Error saving simulated user to localStorage:", e);
        Swal.fire("Error", "Could not save user to local simulation. Check console.", "error");
    }


    setIsSubmitting(false);
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
            Fill in the details below. User is added to a local simulated list. Actual Firebase user creation requires backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-amber-500/10 border-amber-500/30">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-700 font-semibold">Backend Operation Required for Full Functionality</AlertTitle>
            <AlertDescription className="text-amber-700/90">
              - Creating a user with a password in Firebase Authentication, assigning roles (via custom claims), and storing additional details (like contact number in Firestore) must be performed by a secure backend function using the Firebase Admin SDK.
              - This form collects information and adds the user to a <strong>local simulated list</strong> for demonstration.
              - The admin performing this action will remain logged in.
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
                      Contact number is stored in the local simulated list.
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
                    <FormLabel>Assign Role* (Simulated)</FormLabel>
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
                    <FormDescription>This role is for local simulation. Actual Firebase roles require custom claims set by a backend.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding User to Local List...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add User (Simulated Backend)
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

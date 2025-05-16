
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, ArrowLeft, UserCog, ShieldAlert, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { UserRole, UserDocumentForAdmin } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const userRoleOptions: UserRole[] = ["Super Admin", "Admin", "User"];

const editUserSchema = z.object({
  displayName: z.string().min(1, "Display name is required."),
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  contactNumber: z.string().optional(),
  role: z.enum(userRoleOptions, { required_error: "Role is required." }),
  newPassword: z.string().optional().refine(val => !val || val.length >= 6, {
    message: "New password must be at least 6 characters if provided.",
  }),
  confirmNewPassword: z.string().optional(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "New passwords do not match.",
  path: ["confirmNewPassword"],
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string; // This is Firestore document ID
  const { userRole: adminUserRole, loading: authLoading } = useAuth(); 
  
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState<UserDocumentForAdmin | null>(null);
  
  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      displayName: '',
      email: '',
      contactNumber: '',
      role: 'User',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const fetchUserData = useCallback(async () => {
    if (!userId) {
      Swal.fire("Error", "No User ID provided.", "error").then(() => router.push('/dashboard/settings/users'));
      setIsLoadingUserData(false);
      return;
    }
    setIsLoadingUserData(true);
    try {
      const userDocRef = doc(firestore, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const fetchedData = { id: userDocSnap.id, ...userDocSnap.data() } as UserDocumentForAdmin;
        setUserData(fetchedData);
        form.reset({
          displayName: fetchedData.displayName || '',
          email: fetchedData.email || '',
          contactNumber: fetchedData.contactNumber || '',
          role: fetchedData.role || 'User',
          newPassword: '', // Passwords are not pre-filled
          confirmNewPassword: '',
        });
      } else {
        Swal.fire("Error", `User profile with ID ${userId} not found in Firestore.`, "error");
        setUserData(null);
        router.push('/dashboard/settings/users');
      }
    } catch (error: any) {
      console.error("Error fetching user profile from Firestore:", error);
      Swal.fire("Error", `Failed to fetch user profile: ${error.message}`, "error");
      router.push('/dashboard/settings/users');
    } finally {
      setIsLoadingUserData(false);
    }
  }, [userId, router, form]);

  useEffect(() => {
    if (!authLoading && adminUserRole !== "Super Admin") {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to edit users.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard/settings/users');
      });
    } else if (!authLoading && adminUserRole === "Super Admin") {
      fetchUserData();
    }
  }, [userId, adminUserRole, authLoading, router, fetchUserData]);

  const onSubmit = async (data: EditUserFormValues) => {
    if (!userData) {
      Swal.fire("Error", "User data not loaded, cannot save.", "error");
      return;
    }
    setIsSubmitting(true);

    const profileDataToUpdate: Partial<Omit<UserDocumentForAdmin, 'id' | 'createdAt' | 'updatedAt' | 'uid'>> & { updatedAt: any } = {
      displayName: data.displayName,
      email: data.email,
      contactNumber: data.contactNumber || undefined, // Store undefined if empty
      role: data.role,
      updatedAt: serverTimestamp(),
    };
    
    // Remove undefined fields
    Object.keys(profileDataToUpdate).forEach(key => {
        if (profileDataToUpdate[key as keyof typeof profileDataToUpdate] === undefined) {
            delete profileDataToUpdate[key as keyof typeof profileDataToUpdate];
        }
    });

    try {
      const userDocRef = doc(firestore, "users", userId);
      await updateDoc(userDocRef, profileDataToUpdate);
      
      let successMessage = `User profile for ${data.displayName} updated successfully in Firestore.`;
      if (data.newPassword) {
        successMessage += "\n\nNote: Password change for Firebase Authentication requires a secure backend function using the Firebase Admin SDK. This form does not directly update Firebase Auth passwords.";
      }

      Swal.fire({
        title: "Profile Updated!",
        text: successMessage,
        icon: "success",
      });
      // Optionally refetch data or update local state if needed, or simply rely on next navigation
      // fetchUserData(); // To re-fetch and re-populate form, showing updated data
    } catch (error: any) {
      console.error("Error updating user profile in Firestore:", error);
      Swal.fire("Error", `Failed to update user profile: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoadingUserData || (adminUserRole !== "Super Admin" && !userData)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading user details or verifying access...</p>
      </div>
    );
  }

  if (!userData && !isLoadingUserData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground mb-4">User data could not be loaded or user not found.</p>
        <Link href="/dashboard/settings/users" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to User List
          </Button>
        </Link>
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
            <UserCog className="h-7 w-7 text-primary" />
            Edit User Profile
          </CardTitle>
          <CardDescription>
            Modify details for User ID: <span className="font-semibold text-foreground">{userId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-amber-500/10 border-amber-500/30">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-700 font-semibold">Important Note</AlertTitle>
            <AlertDescription className="text-amber-700/90">
              - Changes here update the user's profile in the Firestore database.
              - Password changes for Firebase Authentication accounts require backend operations using the Firebase Admin SDK. This form only captures the intent for a password change.
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
                    <FormLabel>Contact Number</FormLabel>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {userRoleOptions.map(roleOpt => (
                          <SelectItem key={roleOpt} value={roleOpt}>{roleOpt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <h3 className="text-md font-semibold text-muted-foreground mb-2">Change Password (Optional)</h3>
                 <Alert variant="default" className="mb-4 text-xs bg-blue-500/10 border-blue-500/30 text-blue-700/90">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription>
                        Leave blank to keep the current Firebase Authentication password (if one exists for this user).
                        Actual password updates for Firebase Auth require a secure backend process.
                    </AlertDescription>
                </Alert>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="newPassword"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                            <Input type="password" placeholder="Enter new password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="confirmNewPassword"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                            <Input type="password" placeholder="Re-enter new password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
              </div>

              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingUserData}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
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

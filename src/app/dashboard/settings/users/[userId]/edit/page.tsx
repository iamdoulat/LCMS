
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Loader2, ArrowLeft, UserCog, ShieldAlert, Save, Info } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { UserRole, UserDocumentForAdmin } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const userRoleOptions: UserRole[] = ["Super Admin", "Admin", "User", "Service", "DemoManager", "Store Manager"];

const editUserProfileSchema = z.object({
  displayName: z.string().min(1, "Display name is required."),
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  contactNumber: z.string().optional(),
  role: z.enum(userRoleOptions, { required_error: "Role is required." }),
});

type EditUserProfileFormValues = z.infer<typeof editUserProfileSchema>;

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string; // This is Firestore document ID
  const { userRole: adminUserRole, loading: authLoading } = useAuth(); 
  
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState<UserDocumentForAdmin | null>(null);
  
  const form = useForm<EditUserProfileFormValues>({
    resolver: zodResolver(editUserProfileSchema),
    defaultValues: {
      displayName: '',
      email: '',
      contactNumber: '',
      role: 'User',
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
    if (!authLoading && adminUserRole !== "Super Admin" && adminUserRole !== "Admin") {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to edit user profiles.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard/settings/users');
      });
    } else if (!authLoading && (adminUserRole === "Super Admin" || adminUserRole === "Admin")) {
      fetchUserData();
    }
  }, [userId, adminUserRole, authLoading, router, fetchUserData]);

  const onSubmit = async (data: EditUserProfileFormValues) => {
    if (!userData) {
      Swal.fire("Error", "User data not loaded, cannot save.", "error");
      return;
    }
    setIsSubmitting(true);

    const profileDataToUpdate: Partial<Omit<UserDocumentForAdmin, 'id' | 'createdAt' | 'updatedAt' | 'uid'>> & { updatedAt: any } = {
      displayName: data.displayName,
      email: data.email,
      contactNumber: data.contactNumber || undefined, 
      role: data.role,
      updatedAt: serverTimestamp(),
    };
    
    Object.keys(profileDataToUpdate).forEach(key => {
        if (profileDataToUpdate[key as keyof typeof profileDataToUpdate] === undefined) {
            delete profileDataToUpdate[key as keyof typeof profileDataToUpdate];
        }
    });

    try {
      const userDocRef = doc(firestore, "users", userId);
      await updateDoc(userDocRef, profileDataToUpdate);
      
      Swal.fire({
        title: "Profile Updated in Firestore!",
        text: `User profile for ${data.displayName} updated successfully in Firestore.`,
        icon: "success",
      }).then(() => {
        router.push('/dashboard/settings/users'); // Redirect after successful update
      });
    } catch (error: any) {
      console.error("Error updating user profile in Firestore:", error);
      Swal.fire("Error", `Failed to update user profile: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoadingUserData || (!authLoading && adminUserRole !== "Super Admin" && adminUserRole !== "Admin" && !userData)) {
     if (authLoading || isLoadingUserData) {
        return (
          <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Loading user details or verifying access...</p>
          </div>
        );
    }
     // If auth loaded, but role is not Super Admin/Admin, and we haven't yet determined if userData will load
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

  if (!userData && !isLoadingUserData) { // If done loading and still no user data (e.g., user not found)
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground mb-4">User profile data could not be loaded or user not found.</p>
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
            Edit User Profile (Firestore)
          </CardTitle>
          <CardDescription>
            Modify Firestore profile details for User ID: <span className="font-semibold text-foreground">{userId}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-blue-500/10 border-blue-500/30">
            <Info className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-700 font-semibold">Important Note</AlertTitle>
            <AlertDescription className="text-blue-700/90">
              - Changes here update the user's profile in the Firestore &lsquo;users&rsquo; database collection.
              - This does **not** directly modify Firebase Authentication account details (like login password or Auth email). Such changes require backend operations using the Firebase Admin SDK.
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
                     <FormDescription>This email is for the Firestore profile and may differ from the Firebase Auth login email.</FormDescription>
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
                    <FormDescription>This role is stored in Firestore and used for application permissions.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingUserData}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Profile Changes
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

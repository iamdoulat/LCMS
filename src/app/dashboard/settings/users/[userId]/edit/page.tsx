
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, UserCog, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { UserDocumentForAdmin, UserRole } from '@/types';
import { userRoles } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const editUserSchema = z.object({
  displayName: z.string().min(1, "Display name is required."),
  role: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one role.",
  }),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, userRole: currentUserRoles } = useAuth();
  const userId = params.userId as string;

  const [userData, setUserData] = useState<UserDocumentForAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { displayName: '', role: [] },
  });
  
  const isReadOnly = currentUserRoles?.includes('Viewer');

  useEffect(() => {
    if (!userId) {
      setError("No user ID provided.");
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const userDocRef = doc(firestore, "users", userId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const fetchedData = { id: userDocSnap.id, ...userDocSnap.data() } as UserDocumentForAdmin;
          setUserData(fetchedData);
          form.reset({
            displayName: fetchedData.displayName,
            // Ensure role is always treated as an array
            role: Array.isArray(fetchedData.role) ? fetchedData.role : (fetchedData.role ? [fetchedData.role as unknown as UserRole] : []),
          });
        } else {
          setError("User not found.");
          Swal.fire("Error", "User not found.", "error");
        }
      } catch (err: any) {
        setError("Failed to fetch user data.");
        Swal.fire("Error", `Error fetching data: ${err.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [userId, form]);
  
  const onSubmit = async (data: EditUserFormValues) => {
    if (isReadOnly) {
        Swal.fire("Permission Denied", "You have read-only access and cannot save changes.", "error");
        return;
    }

    if (userData?.role?.includes("Super Admin") && currentUser?.uid !== userId) {
        Swal.fire("Permission Denied", "You cannot change the role of another Super Admin.", "error");
        return;
    }

    setIsSubmitting(true);
    try {
        const userDocRef = doc(firestore, "users", userId);
        await updateDoc(userDocRef, {
            displayName: data.displayName,
            role: data.role,
            updatedAt: serverTimestamp(),
        });
        Swal.fire("Success", "User details updated successfully.", "success").then(() => {
            router.push('/dashboard/settings/users');
        });
    } catch (err: any) {
        Swal.fire("Error", `Failed to update user: ${err.message}`, "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-5 flex justify-center items-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
        <div className="container mx-auto py-8 px-5 text-center text-destructive">{error}</div>
    );
  }
  
  const canEditRole = (currentUserRoles?.includes('Super Admin') || currentUserRoles?.includes('Admin')) && (!userData?.role?.includes('Super Admin') || userData.id === currentUser?.uid);

  return (
    <div className="container mx-auto py-8 px-5">
       <div className="mb-6">
            <Link href="/dashboard/settings/users" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to User List</Button>
            </Link>
        </div>
      <Card className="max-w-7xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold">
            <UserCog className="h-7 w-7 text-primary" />{isReadOnly ? 'View User' : 'Edit User'}
          </CardTitle>
          <CardDescription>
            {isReadOnly ? 'Viewing details for user:' : 'Modify details for user:'} <span className="font-semibold text-foreground">{userData?.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                        <FormItem><FormLabel>Display Name*</FormLabel><FormControl><Input {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="role"
                    render={() => (
                        <FormItem>
                            <div className="mb-4">
                                <FormLabel className="text-base">User Roles</FormLabel>
                                <FormDescription>
                                    Select the roles to assign to this user.
                                </FormDescription>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                {userRoles.map((role) => (
                                    <FormField
                                        key={role}
                                        control={form.control}
                                        name="role"
                                        render={({ field }) => {
                                        const isRoleDisabled = !canEditRole || (userData?.role?.includes('Super Admin') && role !== 'Super Admin');
                                        return (
                                            <FormItem
                                            key={role}
                                            className="flex flex-row items-center space-x-3 space-y-0"
                                            >
                                            <FormControl>
                                                <Checkbox
                                                checked={field.value?.includes(role)}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                    ? field.onChange([...field.value, role])
                                                    : field.onChange(
                                                        field.value?.filter(
                                                        (value) => value !== role
                                                        )
                                                    )
                                                }}
                                                disabled={isRoleDisabled || isReadOnly}
                                                />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                                {role}
                                            </FormLabel>
                                            </FormItem>
                                        )
                                        }}
                                    />
                                ))}
                            </div>
                            {!canEditRole && <FormDescription className="text-destructive mt-2">Only Super Admins and Admins can change roles. Another Super Admin's role cannot be changed.</FormDescription>}
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 {!isReadOnly && (
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
                    </Button>
                 )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

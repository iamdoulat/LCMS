
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, UserCog, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { UserDocumentForAdmin, UserRole } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const userRolesForSelect: [UserRole, ...UserRole[]] = ["Admin", "User", "Service", "DemoManager", "Store Manager", "Viewer"];

const editUserSchema = z.object({
  displayName: z.string().min(1, "Display name is required."),
  role: z.enum(userRolesForSelect, { required_error: "A role must be selected." }),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, userRole } = useAuth();
  const userId = params.userId as string;
  const isReadOnly = userRole === 'Viewer';

  const [userData, setUserData] = useState<UserDocumentForAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { displayName: '', role: 'User' },
  });

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
            role: fetchedData.role as any, // Cast because form doesn't include Super Admin
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
    if (userData?.role === "Super Admin" && currentUser?.uid !== userId) {
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
      <div className="container mx-auto py-8 flex justify-center items-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
        <div className="container mx-auto py-8 text-center text-destructive">{error}</div>
    );
  }
  
  const canEditRole = (userRole === 'Super Admin' || userRole === 'Admin') && (!userData || userData.role !== 'Super Admin' || userData.id === currentUser?.uid);

  return (
    <div className="container mx-auto py-8">
       <div className="mb-6">
            <Link href="/dashboard/settings/users" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to User List</Button>
            </Link>
        </div>
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold">
            <UserCog className="h-7 w-7 text-primary" />Edit User
          </CardTitle>
          <CardDescription>
            Modify details for user: <span className="font-semibold text-foreground">{userData?.email}</span>
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
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Role*</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value} 
                              disabled={!canEditRole || isReadOnly}
                            >
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {userData?.role === "Super Admin" && (
                                        <SelectItem value="Super Admin">Super Admin</SelectItem>
                                    )}
                                    {userRolesForSelect.map(role => (
                                        <SelectItem key={role} value={role}>{role}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                             {!canEditRole && <FormDescription>Only Super Admins and Admins can change roles. Another Super Admin's role cannot be changed.</FormDescription>}
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <Button type="submit" disabled={isSubmitting || isReadOnly}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
                </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

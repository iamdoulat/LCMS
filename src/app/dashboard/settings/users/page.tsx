
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, FileEdit, Trash2, Loader2, ShieldAlert, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { UserDocumentForAdmin, UserRole } from '@/types'; // Ensure UserDocumentForAdmin is correctly typed
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

export default function UserSettingsPage() {
  const { userRole: adminUserRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserDocumentForAdmin[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (adminUserRole !== "Super Admin") {
      setIsLoadingUsers(false);
      return; // Only Super Admins can view the user list from Firestore
    }
    setIsLoadingUsers(true);
    setFetchError(null);
    try {
      const usersCollectionRef = collection(firestore, "users");
      const querySnapshot = await getDocs(usersCollectionRef);
      const fetchedUsers = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UserDocumentForAdmin, 'id'>)
      }));
      setUsers(fetchedUsers);
    } catch (error: any) {
      console.error("Error fetching users from Firestore:", error);
      setFetchError(`Failed to fetch users: ${error.message}. Ensure Firestore rules allow reads for Super Admins.`);
      Swal.fire("Error", `Failed to fetch users: ${error.message}`, "error");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [adminUserRole]);

  useEffect(() => {
    if (!authLoading && adminUserRole !== "Super Admin") {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to manage users.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    } else if (!authLoading && adminUserRole === "Super Admin") {
      fetchUsers();
    }
  }, [adminUserRole, authLoading, router, fetchUsers]);

  const handleEditUser = (userId: string) => {
    router.push(`/dashboard/settings/users/${userId}/edit`);
  };

  const handleDeleteUser = (userId: string, userName?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete the user profile for "${userName || userId}" from the Firestore database. This does NOT delete their Firebase Authentication account (if one exists).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "users", userId));
          setUsers(prev => prev.filter(user => user.id !== userId));
          Swal.fire(
            'User Profile Deleted!',
            `User profile for ${userName || userId} has been removed from Firestore.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting user profile from Firestore:", error);
          Swal.fire("Error", `Could not delete user profile: ${error.message}`, "error");
        }
      }
    });
  };

  if (authLoading || (adminUserRole !== "Super Admin" && isLoadingUsers)) { // Keep loading if auth or users are still loading
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading or verifying access...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Users className="h-7 w-7 text-primary" />
            User Management
          </CardTitle>
          <CardDescription>
            View and manage user profiles stored in the application database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-primary/10 border-primary/30">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">User Profile Management</AlertTitle>
            <AlertDescription className="text-primary/90">
              - This page lists user profiles from the Firestore database.
              - Creating a profile here does **not** automatically create a Firebase Authentication login.
              - Deleting a profile here deletes the Firestore record, not the Firebase Auth account.
              - Actual Firebase Authentication user management (linking profiles, password resets for Auth accounts, deleting Auth accounts) typically requires secure backend operations.
            </AlertDescription>
          </Alert>

          <div className="mb-4 flex justify-end">
            <Link href="/dashboard/settings/users/add" passHref>
              <Button variant="default" disabled={adminUserRole !== "Super Admin"}>
                <UserPlus className="mr-2 h-4 w-4" /> Add New User Profile
              </Button>
            </Link>
          </div>

          {fetchError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Fetching Users</AlertTitle>
              <AlertDescription>{fetchError}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Display Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact Number</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading users from database...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium truncate max-w-[200px]">{user.displayName || 'N/A'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.contactNumber || 'N/A'}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleEditUser(user.id)} disabled={adminUserRole !== "Super Admin"}>
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit User Profile</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit User Profile</p></TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                               <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id, user.displayName)} disabled={adminUserRole !== "Super Admin"}>
                                 <Trash2 className="h-4 w-4" />
                                 <span className="sr-only">Delete User Profile</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete User Profile from Database</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      {adminUserRole === "Super Admin" ? "No user profiles found in the database." : "Access to user list restricted."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                List of user profiles from Firestore. {users.length} profile(s) found.
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

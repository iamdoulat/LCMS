
"use client";

import React, { useEffect, useState } from 'react';
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
import type { UserDocumentForAdmin } from '@/types';
// Firestore imports are removed for this specific user list display as it's intended for Firebase Auth users

export default function UserSettingsPage() {
  const { userRole: adminUserRole, loading: authLoading } = useAuth();
  const router = useRouter();
  // State for a conceptual list, but actual data would come from a backend
  const [displayUsers, setDisplayUsers] = useState<Partial<UserDocumentForAdmin>[]>([]); 
  const [isLoadingUsers, setIsLoadingUsers] = useState(false); // Kept for UI consistency

  useEffect(() => {
    if (!authLoading && adminUserRole !== "Super Admin") {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to view this page.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    }
    // No data fetching here, as client-side cannot list all Firebase Auth users
  }, [adminUserRole, authLoading, router]);

  const handleEditUser = (userId?: string) => {
    if (!userId) {
        Swal.fire("Info", "Cannot edit user without an ID.", "info");
        return;
    }
    Swal.fire({
        title: 'Backend Required',
        text: `Editing user ${userId} requires backend integration with Firebase Admin SDK to fetch and update Firebase Authentication user data and/or Firestore profiles.`,
        icon: 'info'
    });
    // For UI demonstration, we can still navigate to an edit page for a Firestore profile if that's the intent
    // router.push(`/dashboard/settings/users/${userId}/edit`);
  };

  const handleDeleteUser = (userId?: string, userName?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action would attempt to delete the user profile for "${userName || userId}". Actual deletion of a Firebase Authentication user requires a backend function using the Firebase Admin SDK.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, proceed (Simulated)',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        // Simulate removing from a conceptual list or state
        // In a real scenario, this would trigger a backend call
        Swal.fire(
          'Action Simulated!',
          `A request to delete user ${userName || userId} would be sent to the backend.`,
          'success'
        );
      }
    });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }
  
  if (adminUserRole !== "Super Admin") {
    // This is a fallback, primary redirection happens in useEffect
    return (
        <div className="container mx-auto py-8">
             <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <ShieldAlert /> Access Denied
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>You do not have permission to view this page.</p>
                </CardContent>
            </Card>
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
            View and manage user accounts. Note: Full administrative capabilities require backend integration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-primary/10 border-primary/30">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Important: Firebase Authentication Users</AlertTitle>
            <AlertDescription className="text-primary/90">
              - Displaying a list of all users directly from Firebase Authentication is not possible from the client-side for security reasons.
              - This page would typically display users managed via a backend service that uses the Firebase Admin SDK.
              - The "Add New User Profile" button below creates a user profile record in your Firestore database, not directly in Firebase Authentication.
              - Full create, update (including roles/permissions), and delete operations for Firebase Authentication accounts by an admin must be handled by secure backend functions.
            </AlertDescription>
          </Alert>

          <div className="mb-4 flex justify-end">
            <Link href="/dashboard/settings/users/add" passHref>
              <Button variant="default" disabled={adminUserRole !== "Super Admin"}>
                <UserPlus className="mr-2 h-4 w-4" /> Add New User Profile (to Firestore)
              </Button>
            </Link>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Display Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role (Application)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading user information...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayUsers.length > 0 ? (
                  displayUsers.map((user) => (
                    <TableRow key={user.id || user.email}>
                      <TableCell className="font-medium truncate max-w-[200px]">{user.displayName || 'N/A'}</TableCell>
                      <TableCell>{user.email || 'N/A'}</TableCell>
                      <TableCell>{user.role || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleEditUser(user.id)} disabled={adminUserRole !== "Super Admin"}>
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit User Profile</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit User (Requires Backend)</p></TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                               <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id, user.displayName)} disabled={adminUserRole !== "Super Admin"}>
                                 <Trash2 className="h-4 w-4" />
                                 <span className="sr-only">Delete User</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete User (Requires Backend)</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        To see a list of all Firebase Authentication users here, a backend function using the Firebase Admin SDK is required.
                        Currently, this page would list user profiles managed in Firestore if connected.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                This table would list users from Firebase Authentication if fetched via a secure backend.
                The "Add New User Profile" button manages profiles in Firestore.
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

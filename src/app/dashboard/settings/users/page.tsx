
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
// Firestore imports for listing users are removed as per request to simulate Firebase Auth user listing (which needs backend)

export default function UserSettingsPage() {
  const { userRole: adminUserRole, loading: authLoading } = useAuth();
  const router = useRouter();
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
    // No client-side data fetching for Firebase Auth user list
    // This would require a backend call to a Cloud Function using Firebase Admin SDK
  }, [adminUserRole, authLoading, router]);

  const handleEditUser = (userId?: string) => {
    if (!userId) {
        Swal.fire("Info", "Cannot edit user without an ID.", "info");
        return;
    }
    Swal.fire({
        title: 'Backend Action Required',
        html: `Editing user <strong>${userId}</strong> requires backend integration with the Firebase Admin SDK.<br/>This would typically involve fetching user data from Firebase Authentication and updating it securely.`,
        icon: 'info',
        confirmButtonText: 'Got it!',
    });
    // router.push(`/dashboard/settings/users/${userId}/edit`); // Navigation is kept for UI flow demonstration
  };

  const handleDeleteUser = (userId?: string, userName?: string) => {
    if (!userId) {
        Swal.fire("Info", "Cannot delete user without an ID.", "info");
        return;
    }
    Swal.fire({
      title: 'Are you absolutely sure?',
      html: `This action attempts to simulate deleting the user profile for "<strong>${userName || userId}</strong>".<br/><br/>Actual deletion of a Firebase Authentication user account and their associated data (if any in Firestore) must be handled by a secure backend function using the Firebase Admin SDK.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, proceed (Simulated)',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        // Simulate removing from a conceptual list (no actual client-side list from Firebase Auth)
        setDisplayUsers(prev => prev.filter(u => u.id !== userId));
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
                    <Button variant="outline" asChild className="mt-4">
                        <Link href="/dashboard">Back to Dashboard</Link>
                    </Button>
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
            User Management (Firebase Authentication)
          </CardTitle>
          <CardDescription>
            View and manage user accounts from Firebase Authentication. Full administrative capabilities require backend integration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-primary/10 border-primary/30">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Backend Required for Full Functionality</AlertTitle>
            <AlertDescription className="text-primary/90">
              - Displaying a list of all users directly from Firebase Authentication is **not possible from the client-side** for security reasons. This requires a backend service using the Firebase Admin SDK.
              - The "Add New User Profile (to Firestore)" button below creates a user profile record in your Firestore database, not directly in Firebase Authentication.
              - Full create, update (including roles/permissions via custom claims), and delete operations for Firebase Authentication accounts by an admin **must be handled by secure backend functions.**
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
                  <TableHead className="w-[200px]">Display Name (from Auth)</TableHead>
                  <TableHead>Email (from Auth)</TableHead>
                  <TableHead>Firebase UID</TableHead>
                  <TableHead>Role (Application - via Firestore)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Simulating connection to backend...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayUsers.length > 0 ? (
                  displayUsers.map((user) => (
                    <TableRow key={user.id || user.email}>
                      <TableCell className="font-medium truncate max-w-[200px]">{user.displayName || 'N/A'}</TableCell>
                      <TableCell>{user.email || 'N/A'}</TableCell>
                      <TableCell className="text-xs truncate">{user.uid || 'N/A (Firestore Profile)'}</TableCell>
                      <TableCell>{user.role || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleEditUser(user.id)} disabled={adminUserRole !== "Super Admin"}>
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit User (Simulated)</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit User (Requires Backend)</p></TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                               <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id, user.displayName)} disabled={adminUserRole !== "Super Admin"}>
                                 <Trash2 className="h-4 w-4" />
                                 <span className="sr-only">Delete User (Simulated)</span>
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
                    <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center">
                            <Info className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-xl font-semibold text-muted-foreground">No Users to Display</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                To see a list of all Firebase Authentication users, a backend function using the Firebase Admin SDK is required.
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                You can add user profiles to Firestore via the "Add New User Profile" button.
                            </p>
                        </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                This table would list users from Firebase Authentication if fetched via a secure backend.
                The "Add New User Profile" button manages profiles in Firestore. Edit/Delete actions here are simulated and require backend logic for Firebase Auth.
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

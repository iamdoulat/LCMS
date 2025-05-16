
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Info, ShieldAlert, Loader2, UserPlus, FileEdit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Placeholder data - actual user data requires backend implementation
const initialPlaceholderUsers = [
  { id: 'user1_abc', email: 'alice@example.com', displayName: 'Alice Wonderland', role: 'Admin' },
  { id: 'user2_xyz', email: 'bob@example.com', displayName: 'Bob The Builder', role: 'Editor' },
  { id: 'user3_123', email: 'carol@example.com', displayName: 'Carol Danvers', role: 'Viewer' },
  { id: 'user4_mdd', email: 'mddoulat@gmail.com', displayName: 'Doulat (Super Admin)', role: 'Super Admin' },
  { id: 'user5_css', email: 'commercial@smartsolution-bd.com', displayName: 'Commercial (Admin)', role: 'Admin' },
];

export default function UserSettingsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [placeholderUsers, setPlaceholderUsers] = useState(initialPlaceholderUsers);

  useEffect(() => {
    if (!authLoading && userRole !== "Super Admin") { // Only Super Admins can see this page
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to manage users.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    }
  }, [userRole, authLoading, router]);

  const handleEditUser = (userId: string) => {
    Swal.fire({
      title: "Redirecting to Edit User (UI Placeholder)",
      text: `Navigation to edit page for user ID ${userId} will occur. Full user data editing requires backend integration with Firebase Admin SDK.`,
      icon: "info",
      timer: 2500,
      showConfirmButton: false,
    });
    router.push(`/dashboard/settings/users/${userId}/edit`);
  };

  const handleDeleteUser = (userId: string, userName?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete the user "${userName || userId}" from the list. (This is a UI simulation - actual deletion from Firebase Authentication requires backend).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        // Simulate deletion from local list
        setPlaceholderUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
        Swal.fire(
          'Deleted (Simulated)!',
          `User ${userName || userId} has been removed from this list. Actual deletion from Firebase Authentication requires backend integration with Firebase Admin SDK.`,
          'success'
        );
        // TODO: Implement actual Firebase Admin SDK call via a backend function to delete user
        // try {
        //   // Example: await callBackendFunction('deleteUser', { userId });
        // } catch (error: any) {
        //   Swal.fire("Error", `Could not delete user from Firebase: ${error.message}`, "error");
        // }
      }
    });
  };


  if (authLoading || userRole !== "Super Admin") {
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
            View and manage user accounts, roles, and permissions for LC Vision. (Limited functionality without backend).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-primary/10 border-primary/30">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Important Security Note & Feature Scope</AlertTitle>
            <AlertDescription className="text-primary/90">
              Displaying a full list of users from Firebase Authentication, creating new users, editing roles, and deleting users are administrative actions that **require a secure backend (e.g., Firebase Cloud Functions with Admin SDK).**
              The data and actions below are for UI demonstration purposes and use placeholder data. User roles are currently simulated based on email.
            </AlertDescription>
          </Alert>

          <div className="mb-4 flex justify-end">
            <Link href="/dashboard/settings/users/add" passHref>
              <Button variant="default" disabled={userRole !== "Super Admin"}>
                 <UserPlus className="mr-2 h-4 w-4" /> Add New User
              </Button>
            </Link>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">User ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Role (Simulated)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {placeholderUsers.length > 0 ? (
                  placeholderUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium truncate max-w-[200px]">{user.id}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.displayName || 'N/A'}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleEditUser(user.id)} disabled={userRole !== "Super Admin"}>
                                <FileEdit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit User (Backend Required)</p></TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                               <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id, user.displayName)} disabled={userRole !== "Super Admin"}>
                                 <Trash2 className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete User (Backend Required)</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No placeholder users to display. Fetching actual users requires backend integration.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                This is a list of placeholder users. Actual user management requires backend integration.
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    
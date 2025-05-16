
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

// Placeholder structure for user data (would be fetched from backend)
interface UserAuthData {
  id: string;
  email?: string;
  displayName?: string;
  role?: string; // Would come from custom claims
}

// Simulate an empty list initially, or a loading state
const initialUsers: UserAuthData[] = [
    // Example placeholder - remove if you want to show "fetching" state first
    // { id: 'user1_abc', email: 'alice@example.com', displayName: 'Alice Wonderland', role: 'Admin' },
    // { id: 'user4_mdd', email: 'mddoulat@gmail.com', displayName: 'Doulat (Super Admin)', role: 'Super Admin' },
    // { id: 'user5_css', email: 'commercial@smartsolution-bd.com', displayName: 'Commercial (Admin)', role: 'Admin' },
];


export default function UserSettingsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserAuthData[]>(initialUsers); // Will hold users fetched from backend
  const [isLoadingUsers, setIsLoadingUsers] = useState(true); // Simulate loading state

  useEffect(() => {
    if (!authLoading && userRole !== "Super Admin") {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to manage users.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    } else if (userRole === "Super Admin") {
      // Simulate fetching users from backend
      setIsLoadingUsers(true);
      console.log("UserSettingsPage: Would fetch all users from backend Admin SDK here.");
      // Replace with actual fetch call
      setTimeout(() => {
        // For demonstration, we'll re-populate with placeholders.
        // In a real app, this would be data from your backend.
        setUsers([
            { id: 'user1_abc_fetched', email: 'alice.fetched@example.com', displayName: 'Alice (Fetched)', role: 'Admin' },
            { id: 'mddoulat_gmail_com', email: 'mddoulat@gmail.com', displayName: 'Doulat (Super Admin)', role: 'Super Admin' },
            { id: 'commercial_smartsolution_bd_com', email: 'commercial@smartsolution-bd.com', displayName: 'Commercial (Admin)', role: 'Admin' },
            { id: 'user2_xyz_fetched', email: 'bob.fetched@example.com', displayName: 'Bob (Fetched)', role: 'Editor' },
        ]);
        setIsLoadingUsers(false);
      }, 1500);
    }
  }, [userRole, authLoading, router]);

  const handleEditUser = (userId: string) => {
    Swal.fire({
      title: "Backend Required",
      text: `Editing user (ID: ${userId}) profile details, email, password, or roles requires backend integration with Firebase Admin SDK. You will be navigated to a UI placeholder for editing.`,
      icon: "info",
      timer: 3000,
      showConfirmButton: false,
    }).then(() => {
      router.push(`/dashboard/settings/users/${userId}/edit`);
    });
  };

  const handleDeleteUser = (userId: string, userName?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will request to permanently delete the user "${userName || userId}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        console.log(`UserSettingsPage: Would call backend function to delete user ${userId} from Firebase Authentication.`);
        // Simulate local deletion for UI feedback
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
        Swal.fire(
          'Deletion Requested (Simulated)',
          `Request to delete user ${userName || userId} has been processed. Actual deletion from Firebase Authentication requires backend integration with Firebase Admin SDK.`,
          'success'
        );
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
            View and manage user accounts, roles, and permissions. Full functionality requires backend integration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-primary/10 border-primary/30">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Backend Required for Full Functionality</AlertTitle>
            <AlertDescription className="text-primary/90">
              Displaying a complete list of users from Firebase Authentication, creating new users with specific roles, editing other users' roles/details, and deleting users are administrative actions that **require a secure backend (e.g., Firebase Cloud Functions with Admin SDK).**
              The data below is illustrative or fetched via placeholder mechanisms.
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
                  <TableHead className="w-[200px]">User ID (Simulated)</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Role (Simulated)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading users (simulated fetch)...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length > 0 ? (
                  users.map((user) => (
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
                      No users found or backend call needed to list users.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                This user list is illustrative. Actual user management and listing requires backend integration with Firebase Admin SDK.
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

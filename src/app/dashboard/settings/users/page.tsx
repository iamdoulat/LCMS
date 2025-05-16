
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
import type { UserRole } from '@/types';

// Interface for simulated user data stored in localStorage
interface SimulatedUser {
  id: string;
  displayName?: string;
  email?: string;
  contactNumber?: string;
  role?: UserRole;
}

const SIMULATED_USERS_STORAGE_KEY = 'simulatedUsersList';

export default function UserSettingsPage() {
  const { userRole: adminUserRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<SimulatedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

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
    } else if (adminUserRole === "Super Admin") {
      setIsLoadingUsers(true);
      try {
        const storedUsersString = localStorage.getItem(SIMULATED_USERS_STORAGE_KEY);
        if (storedUsersString) {
          setUsers(JSON.parse(storedUsersString));
        } else {
          setUsers([]);
        }
      } catch (e) {
        console.error("Error loading simulated users from localStorage:", e);
        setUsers([]);
      }
      setIsLoadingUsers(false);
    }
  }, [adminUserRole, authLoading, router]);

  const handleEditUser = (userId: string) => {
     Swal.fire({
      title: "Edit User (Simulated)",
      text: `Navigating to edit page for simulated user ID: ${userId}. Changes will be saved locally.`,
      icon: "info",
      timer: 2000,
      showConfirmButton: false,
    });
    router.push(`/dashboard/settings/users/${userId}/edit`);
  };

  const handleDeleteUser = (userId: string, userName?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This will remove the user "${userName || userId}" from the local simulated list. This action cannot be undone locally. Actual Firebase user deletion requires backend integration.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete from local list!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const updatedUsers = users.filter(user => user.id !== userId);
          setUsers(updatedUsers);
          localStorage.setItem(SIMULATED_USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
          Swal.fire(
            'Deleted (Locally Simulated)!',
            `User ${userName || userId} has been removed from the local list. Actual Firebase deletion requires backend.`,
            'success'
          );
        } catch (e) {
            console.error("Error deleting simulated user from localStorage:", e);
            Swal.fire("Error", "Could not delete user from local simulation. Check console.", "error");
        }
      }
    });
  };


  if (authLoading || adminUserRole !== "Super Admin") {
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
            User Management (Simulated)
          </CardTitle>
          <CardDescription>
            View and manage user accounts from a local simulated list. Full functionality requires backend integration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-primary/10 border-primary/30">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Backend Required for Full Functionality</AlertTitle>
            <AlertDescription className="text-primary/90">
              - This page displays users from a <strong>local simulated list</strong> for demonstration.
              - Actual Firebase Authentication user management (listing all Firebase users, creating users with roles, editing roles/details in Firebase Auth, deleting from Firebase Auth) requires secure backend operations using the Firebase Admin SDK.
            </AlertDescription>
          </Alert>

          <div className="mb-4 flex justify-end">
            <Link href="/dashboard/settings/users/add" passHref>
              <Button variant="default" disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}>
                 <UserPlus className="mr-2 h-4 w-4" /> Add New User (to Local List)
              </Button>
            </Link>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Display Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact Number</TableHead>
                  <TableHead>Role (Simulated)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading users from local simulation...
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
                              <Button variant="ghost" size="icon" onClick={() => handleEditUser(user.id)} disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}>
                                <FileEdit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit User (Simulated Local)</p></TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                               <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id, user.displayName)} disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}>
                                 <Trash2 className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete User (Simulated Local)</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No users found in the local simulated list. Add users via the "Add New User" button.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                This user list is managed in your browser's local storage for simulation purposes.
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

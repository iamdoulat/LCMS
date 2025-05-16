
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Info, ShieldAlert, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Placeholder data - actual user data requires backend implementation
const placeholderUsers = [
  { id: 'user1_abc', email: 'alice@example.com', displayName: 'Alice Wonderland', role: 'Admin' },
  { id: 'user2_xyz', email: 'bob@example.com', displayName: 'Bob The Builder', role: 'Editor' },
  { id: 'user3_123', email: 'carol@example.com', displayName: 'Carol Danvers', role: 'Viewer' },
];

export default function UserSettingsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && userRole !== "Super Admin") {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to view/edit settings.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
    }
  }, [userRole, authLoading, router]);

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
            View and manage user accounts, roles, and permissions for LC Vision.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-primary/10 border-primary/30">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Important Security Note & Feature Scope</AlertTitle>
            <AlertDescription className="text-primary/90">
              Displaying a full list of users from Firebase Authentication and managing them (add, edit role, delete) requires special administrative permissions and is typically handled by a secure backend (e.g., Firebase Cloud Functions with Admin SDK).
              The data below is for UI demonstration purposes only and does not reflect actual user data. The action buttons are disabled.
            </AlertDescription>
          </Alert>

          <div className="mb-4 flex justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}> {/* Required for Tooltip to work on disabled button */}
                    <Button variant="outline" disabled>
                      {/* <UserPlus className="mr-2 h-4 w-4" /> */} Add New User
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Adding users requires backend integration with Firebase Admin SDK.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">User ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Role (Placeholder)</TableHead>
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
                              <span tabIndex={0}>
                                <Button variant="ghost" size="icon" disabled>
                                  {/* <FileEdit className="h-4 w-4" /> */}
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-cog"><circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M12 22v-2"/><path d="M9 22v-6H5v2"/><path d="M14.39 11.61A6.5 6.5 0 0 0 9 8.5M15.3 21a3 3 0 0 1-2.6-5"/><path d="m21.16 17.81-1.31-1.31M17.81 21.16l-1.31-1.31"/></svg>
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent><p>Editing roles requires backend integration.</p></TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                               <span tabIndex={0}>
                                <Button variant="ghost" size="icon" disabled>
                                  {/* <Trash2 className="h-4 w-4" /> */}
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                                </Button>
                               </span>
                            </TooltipTrigger>
                            <TooltipContent><p>Deleting users requires backend integration.</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No placeholder users to display.
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

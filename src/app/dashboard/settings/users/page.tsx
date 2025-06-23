
"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Edit, Trash2, Loader2, ShieldAlert, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { UserDocumentForAdmin } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, onSnapshot, deleteDoc, doc, query } from 'firebase/firestore';

const ITEMS_PER_PAGE = 10;

export default function UserSettingsPage() {
  const { userRole: adminUserRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserDocumentForAdmin[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!authLoading && adminUserRole !== "Super Admin" && adminUserRole !== "Admin") {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to view this page.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
      return;
    }

    if (!authLoading && (adminUserRole === "Super Admin" || adminUserRole === "Admin")) {
      setIsLoadingUsers(true);
      setFetchError(null);
      
      const usersCollectionRef = collection(firestore, "users");
      const q = query(usersCollectionRef);

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedUsers: UserDocumentForAdmin[] = [];
        querySnapshot.forEach((doc) => {
          fetchedUsers.push({ id: doc.id, ...doc.data() } as UserDocumentForAdmin);
        });
        
        fetchedUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        
        setUsers(fetchedUsers);
        setIsLoadingUsers(false);
      }, (error) => {
        console.error("Error fetching user profiles from Firestore (onSnapshot):", error);
        let errorMessage = `Could not fetch user profiles. Code: ${error.code || 'N/A'}.`;
         if (error.code === 'permission-denied') {
            errorMessage = `Could not fetch user profiles: Missing or insufficient permissions for the 'users' collection. Please check your Firestore security rules to allow admins to list users.`;
        } else if (error.code === 'failed-precondition') {
            errorMessage = `Could not fetch user profiles: This query may require a Firestore index that is missing. Please check the browser console for a link to create it automatically.`;
        } else if (error.message) {
            errorMessage += ` Details: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
        setIsLoadingUsers(false);
      });
      
      // Cleanup listener on component unmount
      return () => unsubscribe();
    }
  }, [adminUserRole, authLoading, router]);

  const handleEditUser = (userId?: string) => {
    if (!userId) {
      Swal.fire("Info", "Cannot edit user profile without an ID.", "info");
      return;
    }
    router.push(`/dashboard/settings/users/${userId}/edit`);
  };

  const handleDeleteUser = (userId?: string, userName?: string) => {
    if (!userId) {
      Swal.fire("Info", "Cannot delete user profile without an ID.", "info");
      return;
    }
    Swal.fire({
      title: 'Are you absolutely sure?',
      html: `This action will permanently delete the Firestore user profile for "<strong>${userName || userId}</strong>".<br/><br/>Note: This action only deletes the profile from the Firestore 'users' collection. Deleting the actual Firebase Authentication account requires a backend function.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete Firestore profile!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "users", userId));
          // No need to manually filter state, onSnapshot will handle it.
          Swal.fire(
            'Profile Deleted!',
            `Firestore user profile for ${userName || userId} has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting user profile from Firestore: ", error);
          Swal.fire("Error", `Could not delete Firestore user profile: ${error.message}`, "error");
        }
      }
    });
  };

  // Pagination Logic
  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = users.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const getPageNumbers = () => {
    const pageNumbers = []; const maxPagesToShow = 5; const halfPagesToShow = Math.floor(maxPagesToShow / 2);
    if (totalPages <= maxPagesToShow + 2) { for (let i = 1; i <= totalPages; i++) pageNumbers.push(i); }
    else {
      pageNumbers.push(1); let startPage = Math.max(2, currentPage - halfPagesToShow); let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);
      if (currentPage <= halfPagesToShow + 1) endPage = Math.min(totalPages - 1, maxPagesToShow);
      if (currentPage >= totalPages - halfPagesToShow) startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      if (startPage > 2) pageNumbers.push("...");
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages - 1) pageNumbers.push("...");
      pageNumbers.push(totalPages);
    } return pageNumbers;
  };

  if (authLoading || (!authLoading && adminUserRole !== "Super Admin" && adminUserRole !== "Admin")) {
    if (authLoading) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Verifying access...</p>
            </div>
        );
    }
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


  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Users className="h-7 w-7 text-primary" />
            User Management
          </CardTitle>
          <CardDescription>
            View and manage user profiles stored in the application database (Firestore).
            Full Firebase Authentication user management requires backend integration.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Alert variant="default" className="mb-6 bg-primary/10 border-primary/30">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Backend Required for Full Firebase Auth Management</AlertTitle>
            <AlertDescription className="text-primary/90">
              - This page lists user profiles from your Firestore &lsquo;users&rsquo; collection.
              - Adding, editing, or deleting profiles here modifies the Firestore records.
              - To create/delete actual Firebase Authentication accounts or manage roles via custom claims (for login and broader permissions), secure backend functions using the Firebase Admin SDK are necessary.
            </AlertDescription>
          </Alert>

          <div className="mb-4 flex justify-end">
            <Link href="/dashboard/settings/users/add" passHref>
              <Button variant="default" disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}>
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
                  <TableHead>Contact Number</TableHead>
                  <TableHead>Role (Application)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading user profiles...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : fetchError ? (
                   <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-destructive">
                        {fetchError}
                      </TableCell>
                    </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium truncate max-w-[200px]">{user.displayName || 'N/A'}</TableCell>
                      <TableCell>{user.email || 'N/A'}</TableCell>
                      <TableCell>{user.contactNumber || 'N/A'}</TableCell>
                      <TableCell>{user.role || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleEditUser(user.id)} disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit User Profile</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit User Profile (Firestore)</p></TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                               <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id, user.displayName)} disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}>
                                 <Trash2 className="h-4 w-4" />
                                 <span className="sr-only">Delete User Profile</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete User Profile (Firestore)</p></TooltipContent>
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
                            <p className="text-xl font-semibold text-muted-foreground">No User Profiles Found</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                No user profiles found in your Firestore 'users' collection.
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                You can add user profiles via the "Add New User Profile" button.
                            </p>
                        </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                List of user profiles managed in Firestore. Displaying {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, users.length)} of {users.length} entries.
              </TableCaption>
            </Table>
          </div>
           {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <Button
                    key={`user-page-${page}`}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-user-${index}`} className="px-2 py-1 text-sm">
                    {page}
                  </span>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

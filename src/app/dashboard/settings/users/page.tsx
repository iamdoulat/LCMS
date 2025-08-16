
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Loader2, Users as UsersIcon, PlusCircle, FileEdit, Trash2, ShieldAlert, MoreHorizontal, UserCheck, UserX, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { UserDocumentForAdmin, UserRole } from '@/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

const ITEMS_PER_PAGE = 10;

export default function UserListPage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserDocumentForAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const isAdminOrSuperAdmin = userRole?.includes('Admin') || userRole?.includes('Super Admin');
  const isSuperAdmin = userRole?.includes('Super Admin');
  const isReadOnly = userRole?.includes('Viewer');

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const usersRef = collection(firestore, "users");
      const q = query(usersRef, orderBy("displayName", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedUsers = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UserDocumentForAdmin));
      setUsers(fetchedUsers);
    } catch (error: any) {
      setFetchError(`Failed to fetch users: ${error.message}`);
      Swal.fire("Error", `Failed to fetch user data. Check console and Firestore rules.`, "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAdminOrSuperAdmin && !isReadOnly) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to view this page.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard');
      });
      return;
    }

    if (isAdminOrSuperAdmin || isReadOnly) {
      fetchUsers();
    }
  }, [userRole, authLoading, router, isAdminOrSuperAdmin, isReadOnly, fetchUsers]);

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const actionText = currentStatus ? 'enable' : 'disable';
    const newStatus = !currentStatus;

    Swal.fire({
      title: `Are you sure you want to ${actionText} this user?`,
      text: `${newStatus ? 'Enabling' : 'Disabling'} this user will ${newStatus ? 'allow them to log in' : 'prevent them from logging in'}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${actionText} user`,
      cancelButtonText: 'Cancel',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const userDocRef = doc(firestore, "users", userId);
          await updateDoc(userDocRef, {
            disabled: newStatus,
            updatedAt: serverTimestamp(),
          });
          Swal.fire('Success', `User has been successfully ${actionText}d.`, 'success');
          fetchUsers(); // Re-fetch users to update the UI
        } catch (error: any) {
          Swal.fire('Error', `Failed to ${actionText} user: ${error.message}`, 'error');
        }
      }
    });
  };

  const handleDeleteUser = async (userId: string, userDisplayName: string) => {
    if (userId === user?.uid) {
        Swal.fire("Action Forbidden", "You cannot delete your own account.", "error");
        return;
    }

    Swal.fire({
        title: 'Are you sure?',
        text: `This will permanently delete the user "${userDisplayName}". This action is irreversible.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'hsl(var(--destructive))',
        confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Note: In a production app, you would call an API route to delete the user
            // from Firebase Auth using the Admin SDK. Here, we only delete from Firestore for the demo.
            try {
                await deleteDoc(doc(firestore, "users", userId));
                setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
                Swal.fire('Deleted!', `User "${userDisplayName}" has been removed from Firestore.`, 'success');
            } catch (error: any) {
                Swal.fire('Error', `Could not delete user from Firestore: ${error.message}`, 'error');
            }
        }
    });
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };
  
  // Pagination Logic
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return users.slice(startIndex, endIndex);
  }, [users, currentPage]);

  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5; 
    const halfPagesToShow = Math.floor(maxPagesToShow / 2);

    if (totalPages <= maxPagesToShow + 2) { 
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1); 
      let startPage = Math.max(2, currentPage - halfPagesToShow);
      let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);
      if (currentPage <= halfPagesToShow + 1) endPage = Math.min(totalPages - 1, maxPagesToShow);
      if (currentPage >= totalPages - halfPagesToShow) startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      if (startPage > 2) pageNumbers.push("...");
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages - 1) pageNumbers.push("...");
      pageNumbers.push(totalPages); 
    }
    return pageNumbers;
  };

  if (authLoading || (!isAdminOrSuperAdmin && !isReadOnly)) {
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
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2")}>
                    <UsersIcon className="h-7 w-7 text-primary" />
                    User Management
                </CardTitle>
                <CardDescription>
                    View and manage user accounts and roles. User registration is public.
                </CardDescription>
              </div>
           </div>
        </CardHeader>
        <CardContent>
          {fetchError && (
             <div className="my-4 text-center text-destructive bg-destructive/10 p-4 rounded-md">{fetchError}</div>
          )}
          <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role(s)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin inline-block mr-2" />Loading users...</TableCell></TableRow>
                    ) : paginatedUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center">No users found.</TableCell></TableRow>
                    ) : (
                        paginatedUsers.map(u => {
                            const rolesToDisplay = Array.isArray(u.role) ? u.role : (u.role ? [u.role as UserRole] : []);
                            const isDisabled = u.disabled === true;
                            return (
                                <TableRow key={u.id} className={cn(isDisabled && 'bg-muted/50 text-muted-foreground')}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={u.photoURL || undefined} alt={u.displayName} data-ai-hint="avatar person" />
                                                <AvatarFallback>{getInitials(u.displayName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="font-medium">{u.displayName}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{u.email}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {rolesToDisplay.map(r => <Badge key={r} variant={r === "Super Admin" || r === "Admin" ? "default" : "secondary"}>{r}</Badge>)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={isDisabled ? 'destructive' : 'default'} className={cn(!isDisabled && 'bg-green-600 hover:bg-green-700')}>
                                            {isDisabled ? 'Disabled' : 'Active'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                    {(rolesToDisplay.includes("Super Admin") && u.uid !== user?.uid) ? (
                                        <span className="text-xs text-muted-foreground">No actions</span>
                                    ) : (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/settings/users/${u.id}/edit`}>
                                                        <FileEdit className="mr-2 h-4 w-4" />{isReadOnly ? 'View User' : 'Edit User'}
                                                    </Link>
                                                </DropdownMenuItem>
                                                 {(isAdminOrSuperAdmin && !isReadOnly && u.uid !== user?.uid) && (
                                                    <DropdownMenuItem onClick={() => handleToggleUserStatus(u.id, !!u.disabled)}>
                                                        {u.disabled ? <UserCheck className="mr-2 h-4 w-4"/> : <UserX className="mr-2 h-4 w-4"/>}
                                                        <span>{u.disabled ? 'Enable User' : 'Disable User'}</span>
                                                    </DropdownMenuItem>
                                                )}
                                                {isSuperAdmin && (
                                                    <>
                                                        <DropdownMenuSeparator/>
                                                        <DropdownMenuItem 
                                                            className="text-destructive focus:text-destructive focus:bg-destructive/10" 
                                                            onClick={() => handleDeleteUser(u.id, u.displayName)} 
                                                            disabled={u.uid === user?.uid || isReadOnly}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />Delete User
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    )}
                </TableBody>
                <TableCaption>
                    Showing {paginatedUsers.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}-
                    {Math.min(currentPage * ITEMS_PER_PAGE, users.length)} of {users.length} users.
                </TableCaption>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    <ChevronLeft className="h-4 w-4" /> Previous
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
                    ) : (<span key={`ellipsis-user-${index}`} className="px-2 py-1 text-sm">{page}</span>)
                )}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                >
                    Next <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

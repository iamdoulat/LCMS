
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users as UsersIcon, PlusCircle, FileEdit, Trash2, ShieldAlert, MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import type { UserDocumentForAdmin } from '@/types';
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


export default function UserListPage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserDocumentForAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && userRole !== "Super Admin" && userRole !== "Admin") {
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

    if (userRole === "Super Admin" || userRole === "Admin") {
      const fetchUsers = async () => {
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
      };
      fetchUsers();
    }
  }, [userRole, authLoading, router]);

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
  
  if (authLoading || (!authLoading && userRole !== "Super Admin" && userRole !== "Admin")) {
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
                    View, add, and manage user accounts and roles.
                </CardDescription>
              </div>
              {userRole === "Super Admin" && (
                <Link href="/dashboard/settings/users/add" passHref>
                    <Button><PlusCircle className="mr-2 h-4 w-4" /> Add New User</Button>
                </Link>
              )}
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
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin inline-block mr-2" />Loading users...</TableCell></TableRow>
                    ) : users.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="h-24 text-center">No users found.</TableCell></TableRow>
                    ) : (
                        users.map(u => (
                            <TableRow key={u.id}>
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
                                <TableCell><Badge variant={u.role === "Super Admin" || u.role === "Admin" ? "default" : "secondary"}>{u.role}</Badge></TableCell>
                                <TableCell className="text-right">
                                  {u.role !== "Super Admin" || u.uid === user?.uid ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem asChild><Link href={`/dashboard/settings/users/${u.id}/edit`}><FileEdit className="mr-2 h-4 w-4" />Edit User</Link></DropdownMenuItem>
                                            {userRole === "Super Admin" && (
                                                <>
                                                    <DropdownMenuSeparator/>
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDeleteUser(u.id, u.displayName)} disabled={u.uid === user?.uid}>
                                                        <Trash2 className="mr-2 h-4 w-4" />Delete User
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">No actions</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

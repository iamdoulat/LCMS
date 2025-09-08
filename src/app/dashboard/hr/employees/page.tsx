
"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Loader2, Users, FileEdit, Trash2, PlusCircle, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Swal from 'sweetalert2';
import type { EmployeeDocument } from '@/types';
import { collection, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

const formatDisplayDate = (dateString?: string) => {
    if (!dateString || !isValid(parseISO(dateString))) return 'N/A';
    try {
        return format(parseISO(dateString), 'PPP');
    } catch {
        return 'Invalid Date';
    }
};

const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

const EmployeeListSkeleton = () => (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-32" /></TableCell>
            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
);

export default function EmployeesListPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');

  const [employees, setEmployees] = React.useState<EmployeeDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const fetchEmployees = React.useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
        const employeesCollectionRef = collection(firestore, "employees");
        const q = query(employeesCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedEmployees = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as EmployeeDocument));
        setEmployees(fetchedEmployees);
    } catch (error: any) {
        setFetchError(`Error fetching employees: ${error.message}`);
        Swal.fire("Error", "Could not fetch employee data. Please check console and Firestore rules.", "error");
    } finally {
        setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);


  const handleDeleteEmployee = (employeeId: string, employeeName?: string) => {
    if (isReadOnly) return;
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action will permanently delete the employee "${employeeName || employeeId}". This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "employees", employeeId));
          setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
          Swal.fire('Deleted!', 'The employee has been removed.', 'success');
        } catch (error: any) {
          Swal.fire("Error", `Could not delete employee: ${error.message}`, "error");
        }
      }
    });
  };

  const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'Active': return 'default';
      case 'On Leave': return 'secondary';
      case 'Terminated': return 'destructive';
      default: return 'secondary';
    }
  };


  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Users className="h-7 w-7 text-primary" />
                Employee List
              </CardTitle>
              <CardDescription>
                View and manage all employees in the system.
              </CardDescription>
            </div>
            <Link href="/dashboard/hr/employees/add" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isReadOnly}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New Employee
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead>Joined Date</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <EmployeeListSkeleton />
                ) : fetchError ? (
                   <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-destructive">
                      {fetchError}
                    </TableCell>
                  </TableRow>
                ) : employees.length > 0 ? (
                  employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.employeeCode}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={employee.photoURL} alt={employee.fullName} data-ai-hint="employee photo"/>
                            <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{employee.fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{employee.designation}</TableCell>
                      <TableCell>{formatDisplayDate(employee.dateOfBirth)}</TableCell>
                      <TableCell>{formatDisplayDate(employee.joinedDate)}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.phone}</TableCell>
                      <TableCell><Badge variant={getStatusVariant(employee.status)}>{employee.status || 'N/A'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!employee.id || isReadOnly}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/employees/edit/${employee.id}`)} disabled={isReadOnly}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>{isReadOnly ? 'View' : 'Edit'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteEmployee(employee.id, employee.fullName)}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                              disabled={isReadOnly}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                       No employees found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of all employees in your system.
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


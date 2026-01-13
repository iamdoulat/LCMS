
"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Users as UsersIcon, FileEdit, Trash2, Filter, XCircle, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
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
import type { EmployeeDocument, DesignationDocument, UserDocumentForAdmin, UserRole } from '@/types';
import { employeeStatusOptions } from '@/types';
import { collection, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { RoleBadge } from '@/components/ui/RoleBadge';


const formatDisplayDate = (dateString?: string) => {
  if (!dateString || !isValid(parseISO(dateString))) return 'N/A';
  try {
    return format(parseISO(dateString), 'MM/dd/yyyy');
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
        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
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

const ALL_STATUSES_VALUE = "__ALL_STATUSES__";
const ALL_DESIGNATIONS_VALUE = "__ALL_DESIGNATIONS__";

export default function EmployeesListPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');

  const [filterEmployeeCode, setFilterEmployeeCode] = React.useState('');
  const [filterEmployeeName, setFilterEmployeeName] = React.useState('');
  const [filterDesignation, setFilterDesignation] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;

  const { data: employees, isLoading: isLoadingEmployees, error: fetchError, refetch } = useFirestoreQuery<EmployeeDocument[]>(
    query(collection(firestore, "employees"), orderBy("createdAt", "desc")),
    undefined,
    ['employees']
  );

  const { data: users, isLoading: isLoadingUsers } = useFirestoreQuery<UserDocumentForAdmin[]>(
    query(collection(firestore, "users")),
    undefined,
    ['users_for_employee_roles']
  );

  const { data: designations, isLoading: isLoadingDesignations } = useFirestoreQuery<DesignationDocument[]>(
    query(collection(firestore, "designations"), orderBy("name", "asc")),
    undefined,
    ['designations_for_filter']
  );

  const isLoading = isLoadingEmployees || isLoadingDesignations || isLoadingUsers;

  const designationOptions = React.useMemo(() => {
    if (!designations) return [];
    return designations.map(d => ({ value: d.name, label: d.name }));
  }, [designations]);

  const displayedEmployees = React.useMemo(() => {
    if (!employees) return [];

    // Create a map of email to user data for quick role lookup
    const userRoleMap = new Map<string, UserRole[]>();
    if (users) {
      users.forEach(u => {
        if (u.email && u.role) {
          const emailKey = u.email.toLowerCase().trim();
          const roles = Array.isArray(u.role) ? u.role : [u.role];
          userRoleMap.set(emailKey, roles);
        }
      });
    }

    return employees.filter(emp => {
      const codeMatch = !filterEmployeeCode || emp.employeeCode?.toLowerCase().includes(filterEmployeeCode.toLowerCase());
      const nameMatch = !filterEmployeeName || emp.fullName?.toLowerCase().includes(filterEmployeeName.toLowerCase());
      const designationMatch = !filterDesignation || emp.designation === filterDesignation;
      const statusMatch = !filterStatus || emp.status === filterStatus;
      return codeMatch && nameMatch && designationMatch && statusMatch;
    }).map(emp => {
      // Merge roles from the user collection if available
      const emailKey = emp.email?.toLowerCase().trim();
      const userRoles = emailKey ? userRoleMap.get(emailKey) : undefined;

      // Combine employee.role and user.role, ensuring we don't have duplicates
      const mergedRoles = Array.from(new Set([
        ...((emp as any).role || []),
        ...((emp as any).roles || []),
        ...(userRoles || [])
      ]));

      return {
        ...emp,
        mergedRoles
      };
    });
  }, [employees, users, filterEmployeeCode, filterEmployeeName, filterDesignation, filterStatus]);

  // Pagination Logic
  const totalPages = Math.ceil(displayedEmployees.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = displayedEmployees.slice(indexOfFirstItem, indexOfLastItem);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(curr => curr + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(curr => curr - 1);
  };

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterEmployeeCode, filterEmployeeName, filterDesignation, filterStatus, employees?.length]);


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
          refetch(); // Refetch data after deletion
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

  const clearFilters = () => {
    setFilterEmployeeCode('');
    setFilterEmployeeName('');
    setFilterDesignation('');
    setFilterStatus('');
  };


  return (
    <div className="py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <UsersIcon className="h-7 w-7 text-primary" />
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
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="employeeCodeFilter">Employee Code</Label>
                  <Input id="employeeCodeFilter" placeholder="Search Code..." value={filterEmployeeCode} onChange={(e) => setFilterEmployeeCode(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="employeeNameFilter">Employee Name</Label>
                  <Input id="employeeNameFilter" placeholder="Search Name..." value={filterEmployeeName} onChange={(e) => setFilterEmployeeName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="designationFilter">Designation</Label>
                  <Combobox
                    options={designationOptions}
                    value={filterDesignation || ALL_DESIGNATIONS_VALUE}
                    onValueChange={(value) => setFilterDesignation(value === ALL_DESIGNATIONS_VALUE ? '' : value)}
                    placeholder="Filter by Designation..."
                    selectPlaceholder={isLoadingDesignations ? "Loading..." : "All Designations"}
                    emptyStateMessage="No designation found."
                    disabled={isLoadingDesignations}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="statusFilter">Status</Label>
                  <Select value={filterStatus || ALL_STATUSES_VALUE} onValueChange={(value) => setFilterStatus(value === ALL_STATUSES_VALUE ? '' : value)}>
                    <SelectTrigger id="statusFilter"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
                      {employeeStatusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-6">
                  <Button onClick={clearFilters} variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Clear Filters</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
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
                    <TableCell colSpan={10} className="h-24 text-center text-destructive">
                      {fetchError.message}
                    </TableCell>
                  </TableRow>
                ) : currentItems && currentItems.length > 0 ? (
                  currentItems.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.employeeCode}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={employee.photoURL} alt={employee.fullName} data-ai-hint="employee photo" />
                            <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{employee.fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge roles={employee.mergedRoles} size="xs" />
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
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!employee.id}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/employees/edit/${employee.id}`)}>
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
                    <TableCell colSpan={10} className="h-24 text-center">
                      No employees found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of all employees in your system.
              </TableCaption>
            </Table>
          </div>

          {/* Pagination Controls */}
          {displayedEmployees.length > itemsPerPage && (
            <div className="flex flex-col md:grid md:grid-cols-3 items-center gap-4 py-4 px-2 border-t mt-4">
              <div className="text-sm text-muted-foreground text-center md:text-left order-2 md:order-1">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, displayedEmployees.length)} of {displayedEmployees.length} entries
              </div>
              <div className="flex items-center justify-center gap-2 order-1 md:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className="h-9"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                  className="h-9"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              <div className="hidden md:block md:order-3" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

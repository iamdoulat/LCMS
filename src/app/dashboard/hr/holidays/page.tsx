
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Calendar, PlusCircle, AlertTriangle, Info, Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import type { HolidayDocument } from '@/types';
import Swal from 'sweetalert2';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function HolidaysPage() {
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const router = useRouter();

  const { data: holidays, isLoading, error, refetch } = useFirestoreQuery<HolidayDocument[]>(
    query(collection(firestore, 'holidays'), orderBy('fromDate', 'asc')),
    undefined,
    ['holidays']
  );

  const handleDelete = (id: string, name: string) => {
    if (isReadOnly) return;
    Swal.fire({
      title: `Delete '${name}'?`,
      text: "This action cannot be undone.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "holidays", id));
          refetch();
          Swal.fire('Deleted!', 'The holiday has been removed.', 'success');
        } catch (e: any) {
          Swal.fire('Error!', `Could not delete holiday: ${e.message}`, 'error');
        }
      }
    });
  };

  const handleEdit = (id: string) => {
    router.push(`/dashboard/hr/holidays/edit/${id}`);
  };

  const formatHolidayDate = (holiday: HolidayDocument) => {
    const fromDate = format(parseISO(holiday.fromDate), 'PPP');
    if (holiday.toDate) {
      const toDate = format(parseISO(holiday.toDate), 'PPP');
      return fromDate === toDate ? fromDate : `${fromDate} - ${toDate}`;
    }
    return fromDate;
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <Card className="shadow-xl w-full">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Calendar className="h-7 w-7 text-primary" />
                Holiday Management
              </CardTitle>
              <CardDescription>View, add, and manage company and public holidays.</CardDescription>
            </div>
            <Button asChild disabled={isReadOnly}>
              <Link href="/dashboard/hr/holidays/add">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Holiday
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="text-destructive-foreground bg-destructive/10 p-4 rounded-md text-center">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8" />
              <p className="font-semibold">Error Loading Holidays</p>
              <p className="text-sm">{error.message}</p>
            </div>
          ) : !holidays || holidays.length === 0 ? (
            <div className="text-muted-foreground text-center py-10">
              <Info className="mx-auto mb-2 h-10 w-10" />
              <p className="font-semibold">No Holidays Found</p>
              <p className="text-sm">Click &quot;Add Holiday&quot; to get started.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%] whitespace-nowrap">Holiday Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[40%]">Message</TableHead>
                    {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map(holiday => (
                    <TableRow key={holiday.id}>
                      <TableCell className="whitespace-nowrap">{holiday.name}</TableCell>
                      <TableCell className="min-w-[200px]">{formatHolidayDate(holiday)}</TableCell>
                      <TableCell>{holiday.type}</TableCell>
                      <TableCell className="whitespace-pre-wrap">{holiday.message || 'N/A'}</TableCell>
                      {!isReadOnly && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEdit(holiday.id)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(holiday.id, holiday.name)}
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

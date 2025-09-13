
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Calendar, PlusCircle, AlertTriangle, Info, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import type { HolidayDocument } from '@/types';
import Swal from 'sweetalert2';
import Link from 'next/link';

export default function HolidaysPage() {
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');

  const { data: holidays, isLoading, error, refetch } = useFirestoreQuery<HolidayDocument[]>(
    query(collection(firestore, 'holidays'), orderBy('date', 'asc')),
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

  return (
    <div className="container mx-auto py-8">
        <Card className="shadow-xl">
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
                <p className="text-sm">Click "Add Holiday" to get started.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Holiday Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holidays.map(holiday => (
                      <TableRow key={holiday.id}>
                        <TableCell>{holiday.name}</TableCell>
                        <TableCell>{format(parseISO(holiday.date), 'PPP')}</TableCell>
                        <TableCell>{holiday.type}</TableCell>
                        {!isReadOnly && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(holiday.id, holiday.name)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

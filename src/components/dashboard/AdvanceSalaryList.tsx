"use client";

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Filter, XCircle, ChevronLeft, ChevronRight, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import type { AdvanceSalaryDocument } from '@/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const ITEMS_PER_PAGE = 10;

const formatDisplayDate = (dateString: string) => format(parseISO(dateString), 'PPP');
const formatCurrency = (amount: number) => `BDT ${amount.toLocaleString()}`;

export function AdvanceSalaryList() {
    const router = useRouter();
    const { data: advances, isLoading, error } = useFirestoreQuery<AdvanceSalaryDocument[]>(
        query(collection(firestore, "advance_salary"), orderBy("applyDate", "desc")),
        undefined,
        ['advance_salary']
    );

    const [searchTerm, setSearchTerm] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);

    const filteredAdvances = React.useMemo(() => {
        if (!advances) return [];
        return advances.filter(a =>
            a.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [advances, searchTerm]);
    
    const totalPages = Math.ceil(filteredAdvances.length / ITEMS_PER_PAGE);
    const paginatedAdvances = filteredAdvances.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );
    
    const handleDelete = async (id: string, name: string) => {
        Swal.fire({
            title: 'Are you sure?',
            text: `This will permanently delete the advance salary record for ${name}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(firestore, "advance_salary", id));
                    Swal.fire('Deleted!', 'The record has been deleted.', 'success');
                } catch (e: any) {
                    Swal.fire('Error!', `Could not delete the record: ${e.message}`, 'error');
                }
            }
        });
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
    if (error) return <div className="text-destructive-foreground bg-destructive/10 p-4 rounded-md text-center">Error: {error.message}</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"/>
                    <Input placeholder="Search by Employee Name or Code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10 w-full" />
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Apply Date</TableHead>
                            <TableHead>Payment Starts From</TableHead>
                            <TableHead>Payment Duration</TableHead>
                            <TableHead>Advance Amount</TableHead>
                            <TableHead>Due Amount</TableHead>
                            <TableHead>Amount Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedAdvances.length > 0 ? paginatedAdvances.map(advance => (
                            <TableRow key={advance.id}>
                                <TableCell>{advance.employeeName} ({advance.employeeCode})</TableCell>
                                <TableCell>{formatDisplayDate(advance.applyDate)}</TableCell>
                                <TableCell>{formatDisplayDate(advance.paymentStartsFrom)}</TableCell>
                                <TableCell>{advance.paymentDuration} months</TableCell>
                                <TableCell>{formatCurrency(advance.advanceAmount)}</TableCell>
                                <TableCell>{formatCurrency(advance.dueAmount)}</TableCell>
                                <TableCell>{advance.paymentMethod}</TableCell>
                                <TableCell><Badge>{advance.status}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/payroll/advance-salary/edit/${advance.id}`)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDelete(advance.id, advance.employeeName)} className="text-destructive focus:text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={9} className="h-24 text-center">No Data Found</TableCell></TableRow>
                        )}
                    </TableBody>
                     <TableCaption>A list of all advance salary applications.</TableCaption>
                </Table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 py-4">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                    <span className="text-sm">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                </div>
            )}
        </div>
    );
}

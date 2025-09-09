
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListChecks, Loader2, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { Payslip } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
    } catch { return 'Invalid Date'; }
};

const formatCurrency = (value?: number) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return `BDT ${value.toLocaleString()}`;
};

const ITEMS_PER_PAGE = 20;

export default function PayslipListPage() {
  const router = useRouter();
  const { data: payslips, isLoading, error } = useFirestoreQuery<Payslip[]>(
    query(collection(firestore, 'payslips'), orderBy('createdAt', 'desc')),
    undefined,
    ['payslips']
  );
  
  const [currentPage, setCurrentPage] = useState(1);

  const handlePreview = (payslipId: string) => {
    router.push(`/dashboard/hr/payroll/payslip-preview/${payslipId}`);
  };
  
  const totalPages = payslips ? Math.ceil(payslips.length / ITEMS_PER_PAGE) : 0;
  const currentPayslips = payslips?.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ListChecks className="h-7 w-7 text-primary" />
            Generated Payslip List
          </CardTitle>
          <CardDescription>
            View, manage, and print generated payslips for all employees.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pay Period</TableHead>
                            <TableHead>Employee Name</TableHead>
                            <TableHead>Designation</TableHead>
                            <TableHead>Gross Salary</TableHead>
                            <TableHead>Total Deductions</TableHead>
                            <TableHead>Net Salary</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <div className="flex items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                                        <p className="ml-3 text-muted-foreground">Loading payslips...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-destructive">
                                    Error: {error.message}
                                </TableCell>
                            </TableRow>
                        ) : !currentPayslips || currentPayslips.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No payslips have been generated yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            currentPayslips.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell>{p.payPeriod}</TableCell>
                                    <TableCell>{p.employeeName}</TableCell>
                                    <TableCell>{p.designation}</TableCell>
                                    <TableCell>{formatCurrency(p.grossSalary)}</TableCell>
                                    <TableCell>{formatCurrency(p.totalDeductions)}</TableCell>
                                    <TableCell className="font-semibold">{formatCurrency(p.netSalary)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => handlePreview(p.id)}>
                                            <Printer className="mr-2 h-4 w-4"/> View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                     <TableCaption>
                        {payslips && `Showing ${((currentPage - 1) * ITEMS_PER_PAGE) + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, payslips.length)} of ${payslips.length} payslips.`}
                    </TableCaption>
                </Table>
            </div>
            {totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 py-4 mt-4">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Prev</Button>
                    <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

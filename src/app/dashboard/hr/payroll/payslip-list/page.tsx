
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListChecks, Loader2, Printer, ChevronLeft, ChevronRight, MoreHorizontal, FileEdit, Trash2, Filter, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, orderBy, doc, runTransaction, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { Payslip, PettyCashTransactionDocument, PettyCashAccountDocument, DesignationDocument } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';

import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';



const formatCurrency = (value?: number) => {
  if (typeof value !== 'number' || isNaN(value)) return 'N/A';
  return `BDT ${value.toLocaleString()}`;
};

const ITEMS_PER_PAGE = 20;

const monthOptions = [
  "All", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const currentSystemYear = new Date().getFullYear();
const yearOptions = ["All", ...Array.from({ length: (currentSystemYear - 2020 + 6) }, (_, i) => (2020 + i).toString())];


export default function PayslipListPage() {
  const router = useRouter();
  const { data: payslips, isLoading, error, refetch } = useFirestoreQuery<Payslip[]>(
    query(collection(firestore, 'payslips'), orderBy('createdAt', 'desc')),
    undefined,
    ['payslips']
  );
  const { data: designations, isLoading: isLoadingDesignations } = useFirestoreQuery<DesignationDocument[]>(
    query(collection(firestore, 'designations'), orderBy('name')),
    undefined,
    ['designations_for_filter']
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [filterEmployeeCode, setFilterEmployeeCode] = useState('');
  const [filterEmployeeName, setFilterEmployeeName] = useState('');
  const [filterYear, setFilterYear] = useState('All');
  const [filterMonth, setFilterMonth] = useState('All');
  const [filterDesignation, setFilterDesignation] = useState('All');

  const filteredPayslips = useMemo(() => {
    if (!payslips) return [];
    return payslips.filter(p => {
      const payPeriodParts = p.payPeriod?.split(', ');
      const monthMatch = filterMonth === 'All' || (payPeriodParts && payPeriodParts[0] === filterMonth);
      const yearMatch = filterYear === 'All' || (payPeriodParts && payPeriodParts[1] === filterYear);

      return (
        (!filterEmployeeCode || p.employeeCode?.toLowerCase().includes(filterEmployeeCode.toLowerCase())) &&
        (!filterEmployeeName || p.employeeName?.toLowerCase().includes(filterEmployeeName.toLowerCase())) &&
        monthMatch &&
        yearMatch &&
        (!filterDesignation || filterDesignation === 'All' || p.designation === filterDesignation)
      )
    });
  }, [payslips, filterEmployeeCode, filterEmployeeName, filterYear, filterMonth, filterDesignation]);

  const clearFilters = () => {
    setFilterEmployeeCode('');
    setFilterEmployeeName('');
    setFilterYear('All');
    setFilterMonth('All');
    setFilterDesignation('All');
  };

  const handlePreview = (payslipId: string) => {
    router.push(`/dashboard/hr/payroll/payslip-preview/${payslipId}`);
  };

  const handleEdit = (payslipId: string) => {
    router.push(`/dashboard/hr/payroll/edit-payslip/${payslipId}`);
  };

  const handleDelete = async (payslipId: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This will delete the payslip and attempt to reverse the corresponding transaction from the petty cash account. This action cannot be undone.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      const payslipToDelete = payslips?.find(p => p.id === payslipId);
      if (!payslipToDelete) {
        Swal.fire("Error", "Could not find the payslip to delete.", "error");
        return;
      }

      try {
        await runTransaction(firestore, async (transaction) => {
          const payslipDocRef = doc(firestore, 'payslips', payslipId);
          // Find the related petty cash transaction (assuming it was created)
          const txQuery = query(collection(firestore, "petty_cash_transactions"), where("connectedSaleId", "==", `payslip_${payslipId}`));
          const txSnapshot = await getDocs(txQuery);

          if (!txSnapshot.empty) {
            const txDoc = txSnapshot.docs[0];
            const txData = txDoc.data() as PettyCashTransactionDocument;
            const accountRef = doc(firestore, 'petty_cash_accounts', txData.accountId);
            const accountSnap = await transaction.get(accountRef);

            if (accountSnap.exists()) {
              const accountData = accountSnap.data() as PettyCashAccountDocument;
              const newBalance = accountData.balance + txData.amount; // Reverse the debit
              transaction.update(accountRef, { balance: newBalance, updatedAt: serverTimestamp() });
            }
            transaction.delete(txDoc.ref); // Delete the transaction log
          }

          transaction.delete(payslipDocRef); // Finally delete the payslip
        });

        Swal.fire('Deleted!', 'The payslip and associated transaction have been deleted.', 'success');
        refetch(); // Refetch the payslip list
      } catch (e: any) {
        Swal.fire('Error!', `Could not delete payslip: ${e.message}`, 'error');
      }
    }
  };

  const totalPages = filteredPayslips ? Math.ceil(filteredPayslips.length / ITEMS_PER_PAGE) : 0;
  const currentPayslips = filteredPayslips?.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <Card className="shadow-xl overflow-hidden">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ListChecks className="h-7 w-7 text-primary" />
            Generated Payslip List
          </CardTitle>
          <CardDescription>
            View, manage, and print generated payslips for all employees.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="employeeCodeFilter">Employee Code</Label>
                  <Input id="employeeCodeFilter" placeholder="Search Code..." value={filterEmployeeCode} onChange={(e) => setFilterEmployeeCode(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="employeeNameFilter">Employee Name</Label>
                  <Input id="employeeNameFilter" placeholder="Search Name..." value={filterEmployeeName} onChange={(e) => setFilterEmployeeName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="yearFilter">Pay Year</Label>
                  <Select value={filterYear} onValueChange={setFilterYear}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="monthFilter">Pay Month</Label>
                  <Select value={filterMonth} onValueChange={setFilterMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="designationFilter">Designation</Label>
                  <Select value={filterDesignation} onValueChange={setFilterDesignation} disabled={isLoadingDesignations}>
                    <SelectTrigger><SelectValue placeholder="Select Designation" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Designations</SelectItem>
                      {designations?.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
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
                  <TableHead>Pay Period</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Gross Salary</TableHead>
                  <TableHead>Advance Paid</TableHead>
                  <TableHead>Total Deductions</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="ml-3 text-muted-foreground">Loading payslips...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-destructive">
                      Error: {error.message}
                    </TableCell>
                  </TableRow>
                ) : !currentPayslips || currentPayslips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No payslips found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentPayslips.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.payPeriod}</TableCell>
                      <TableCell>{p.employeeName}</TableCell>
                      <TableCell>{p.employeeCode}</TableCell>
                      <TableCell>{p.designation}</TableCell>
                      <TableCell>{formatCurrency(p.grossSalary)}</TableCell>
                      <TableCell>{formatCurrency(p.advanceDeduction)}</TableCell>
                      <TableCell>{formatCurrency(p.totalDeductions)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(p.netSalary)}</TableCell>
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
                            <DropdownMenuItem onClick={() => handlePreview(p.id)}>
                              <Printer className="mr-2 h-4 w-4" />
                              <span>View</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(p.id)}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(p.id)} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableCaption>
                {filteredPayslips && `Showing ${((currentPage - 1) * ITEMS_PER_PAGE) + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, filteredPayslips.length)} of ${filteredPayslips.length} payslips.`}
              </TableCaption>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-4">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Prev</Button>
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/common';
import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, Filter, XCircle, Users, CalendarDays, MoreHorizontal, Printer, FileText, ChevronLeft, ChevronRight, Building, Link as LinkIcon } from 'lucide-react';
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
import Swal from 'sweetalert2';
import type { ClaimReportDocument, CustomerDocument, SupplierDocument, ClaimStatus } from '@/types';
import { claimStatusOptions } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { collection, getDocs, deleteDoc, doc, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
  } catch (e) {
    return 'N/A';
  }
};

const ITEMS_PER_PAGE = 10;
const ALL_SUPPLIERS_VALUE = "__ALL_SUPPLIERS_CLAIM__";
const ALL_STATUSES_VALUE = "__ALL_STATUSES_CLAIM__";

export default function ClaimReportListPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const [allReports, setAllReports] = useState<ClaimReportDocument[]>([]);
  const [displayedReports, setDisplayedReports] = useState<ClaimReportDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterClaimNumber, setFilterClaimNumber] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterStatus, setFilterStatus] = useState<ClaimStatus | ''>('');

  const [supplierOptions, setSupplierOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const handleViewUrl = (url: string | undefined | null) => {
    if (url && url.trim() !== "") {
      try {
        new URL(url); window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) { Swal.fire("Invalid URL", "The provided URL is not valid.", "error"); }
    } else { Swal.fire("No URL", "No URL provided to view.", "info"); }
  };

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const reportsQuery = query(collection(firestore, "claim_reports"));
        const querySnapshot = await getDocs(reportsQuery);
        const fetchedReports = querySnapshot.docs.map(d => ({ ...d.data(), id: d.id } as ClaimReportDocument));
        fetchedReports.sort((a, b) => (new Date(b.claimDate).getTime() - new Date(a.claimDate).getTime()));
        setAllReports(fetchedReports);
      } catch (error: any) {
        const msg = `Could not fetch claim reports. Error: ${error.message}`;
        setFetchError(msg);
        Swal.fire("Fetch Error", msg, "error");
      } finally {
        setIsLoading(false);
      }
    };
    const fetchSuppliers = async () => {
      setIsLoadingSuppliers(true);
      try {
        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        setSupplierOptions(
          suppliersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as SupplierDocument).beneficiaryName || 'Unnamed Supplier' }))
        );
      } catch (error: any) {
        Swal.fire("Error", `Could not load supplier options. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingSuppliers(false);
      }
    };

    fetchReports();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    let filtered = [...allReports];
    if (filterClaimNumber) filtered = filtered.filter(c => c.claimNumber.toLowerCase().includes(filterClaimNumber.toLowerCase()));
    if (filterSupplierId) filtered = filtered.filter(c => c.supplierId === filterSupplierId);
    if (filterStatus) filtered = filtered.filter(c => c.status === filterStatus);
    setDisplayedReports(filtered);
    setCurrentPage(1);
  }, [allReports, filterClaimNumber, filterSupplierId, filterStatus]);

  const handleEdit = (id: string) => router.push(`/dashboard/warranty-management/claim-report/edit/${id}`);

  const handleDelete = async (id: string, claimNumber: string) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `This will permanently delete Claim Report "${claimNumber}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonText: 'Cancel',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "claim_reports", id));
          setAllReports(prev => prev.filter(c => c.id !== id));
          Swal.fire('Deleted!', `Claim Report "${claimNumber}" has been removed.`, 'success');
        } catch (error: any) {
          Swal.fire("Error", `Could not delete report: ${error.message}`, "error");
        }
      }
    });
  };

  const clearFilters = () => {
    setFilterClaimNumber('');
    setFilterSupplierId('');
    setFilterStatus('');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedReports.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedReports.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
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

  const getStatusBadgeVariant = (status: ClaimStatus) => {
    switch (status) {
      case 'Pending': return 'destructive';
      case 'Complete': return 'default';
      case 'Rejected': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" /> Claim Report List
              </CardTitle>
              <CardDescription>View, search, and manage all claim reports.</CardDescription>
            </div>
            <Link href="/dashboard/warranty-management/claim-report" passHref>
              <Button className="bg-primary hover:bg-primary/90" disabled={isReadOnly}>
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Claim Report
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4"><CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Reports</CardTitle></CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div><Label htmlFor="claimNoFilter">Claim No.</Label><Input id="claimNoFilter" placeholder="Search by Claim No..." value={filterClaimNumber} onChange={(e) => setFilterClaimNumber(e.target.value)} /></div>
                <div><Label htmlFor="supplierFilter" className="flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground" />Supplier</Label>
                  <Combobox options={supplierOptions} value={filterSupplierId || ALL_SUPPLIERS_VALUE} onValueChange={(v) => setFilterSupplierId(v === ALL_SUPPLIERS_VALUE ? '' : v)} placeholder="Search Supplier..." selectPlaceholder="All Suppliers" disabled={isLoadingSuppliers} />
                </div>
                <div><Label htmlFor="statusFilter" className="text-sm font-medium">Status</Label>
                  <Select value={filterStatus || ALL_STATUSES_VALUE} onValueChange={(v) => setFilterStatus(v === ALL_STATUSES_VALUE ? '' : v as ClaimStatus)}>
                    <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent><SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>{claimStatusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Button onClick={clearFilters} variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Clear Filters</Button></div>
              </div>
            </CardContent>
          </Card>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim Date</TableHead>
                  <TableHead>Claim No.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Claim Qty</TableHead>
                  <TableHead>Pending Qty</TableHead>
                  <TableHead>Email Resent</TableHead>
                  <TableHead>Email View</TableHead>
                  <TableHead>Claim Report (.XLS)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={11} className="h-24 text-center"><Loader2 className="mr-2 h-6 w-6 animate-spin inline" /> Loading reports...</TableCell></TableRow>
                ) : fetchError ? (
                  <TableRow><TableCell colSpan={11} className="h-24 text-center text-destructive">{fetchError}</TableCell></TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>{formatDisplayDate(report.claimDate)}</TableCell>
                      <TableCell className="font-medium">{report.claimNumber}</TableCell>
                      <TableCell><Badge variant={getStatusBadgeVariant(report.status)}>{report.status}</Badge></TableCell>
                      <TableCell>{report.customerName || 'N/A'}</TableCell>
                      <TableCell>{report.supplierName}</TableCell>
                      <TableCell>{report.claimQty}</TableCell>
                      <TableCell className="font-semibold">{report.pendingQty}</TableCell>
                      <TableCell>
                        <Button variant="destructive" size="sm" className="font-bold cursor-default">
                          {report.emailResentCount}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="default"
                          size="icon"
                          disabled={!report.emailsViewUrl}
                          onClick={() => handleViewUrl(report.emailsViewUrl)}
                          title="View Email Thread"
                          className="bg-green-500 hover:bg-green-600 text-white h-8 w-8"
                        >
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="default"
                          size="icon"
                          disabled={!report.claimReportUrl}
                          onClick={() => handleViewUrl(report.claimReportUrl)}
                          title="View Claim Report"
                          className="bg-green-500 hover:bg-green-600 text-white h-8 w-8"
                        >
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="default" className="h-8 w-8 p-0 bg-green-500 hover:bg-green-600 text-white" disabled={!report.id}><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel><DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEdit(report.id)} disabled={isReadOnly}><FileEdit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(report.id, report.claimNumber)} className="text-destructive focus:text-destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={11} className="h-24 text-center">No claim reports found matching your criteria.</TableCell></TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedReports.length)} of {displayedReports.length} entries.
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
                    key={`claim-report-page-${page}`}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (<span key={`ellipsis-claim-report-${index}`} className="px-2 py-1 text-sm">{page}</span>)
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


"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { PlusCircle, FileEdit, Trash2, Loader2, Filter, XCircle, MoreHorizontal, Printer, Truck, ChevronLeft, ChevronRight, Factory } from 'lucide-react';
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
import type { DemoChallanDocument, DemoMachineFactoryDocument } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { collection, getDocs, deleteDoc, doc, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
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

const ITEMS_PER_PAGE = 20;
const ALL_FACTORIES_VALUE = "__ALL_FACTORIES_DEMO_CHALLAN__";

export default function DemoMachineChallanListPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const [allChallans, setAllChallans] = useState<DemoChallanDocument[]>([]);
  const [displayedChallans, setDisplayedChallans] = useState<DemoChallanDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterChallanId, setFilterChallanId] = useState('');
  const [filterFactoryId, setFilterFactoryId] = useState('');
  const [filterApplicationId, setFilterApplicationId] = useState('');

  const [factoryOptions, setFactoryOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingFactories, setIsLoadingFactories] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchChallans = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const challansQuery = query(collection(firestore, "demo_machine_challans"), firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(challansQuery);
        setAllChallans(querySnapshot.docs.map(d => ({ ...d.data(), id: d.id } as DemoChallanDocument)));
      } catch (error: any) {
        const msg = `Could not fetch demo challans. Error: ${error.message}`;
        setFetchError(msg);
        Swal.fire("Fetch Error", msg, "error");
      } finally {
        setIsLoading(false);
      }
    };
    const fetchFactories = async () => {
      setIsLoadingFactories(true);
      try {
        const factoriesSnapshot = await getDocs(collection(firestore, "demo_machine_factories"));
        setFactoryOptions(
          factoriesSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as DemoMachineFactoryDocument).factoryName || 'Unnamed Factory' }))
        );
      } catch (error: any) {
        Swal.fire("Error", `Could not load factory options. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingFactories(false);
      }
    };

    fetchChallans();
    fetchFactories();
  }, []);

  useEffect(() => {
    let filtered = [...allChallans];
    if (filterChallanId) filtered = filtered.filter(c => c.id.toLowerCase().includes(filterChallanId.toLowerCase()));
    if (filterFactoryId) filtered = filtered.filter(c => c.factoryId === filterFactoryId);
    if (filterApplicationId) filtered = filtered.filter(c => c.linkedApplicationId?.toLowerCase().includes(filterApplicationId.toLowerCase()));
    setDisplayedChallans(filtered);
    setCurrentPage(1);
  }, [allChallans, filterChallanId, filterFactoryId, filterApplicationId]);

  const handleEdit = (id: string) => router.push(`/dashboard/demo/demo-machine-challan/edit/${id}`);
  const handlePreview = (id: string) => window.open(`/dashboard/demo/demo-machine-challan/print/${id}`, '_blank');

  const handleDelete = async (id: string, challanNumber: string) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `This will permanently delete Demo Challan "${challanNumber}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonText: 'Cancel',
      confirmButtonText: 'Yes, delete it!',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "demo_machine_challans", id));
          setAllChallans(prev => prev.filter(c => c.id !== id));
          Swal.fire('Deleted!', `Challan "${challanNumber}" has been removed.`, 'success');
        } catch (error: any) {
          Swal.fire("Error", `Could not delete challan: ${error.message}`, "error");
        }
      }
    });
  };

  const clearFilters = () => {
    setFilterChallanId('');
    setFilterFactoryId('');
    setFilterApplicationId('');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedChallans.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedChallans.slice(indexOfFirstItem, indexOfLastItem);

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

  return (
    <div className="max-w-none mx-[25px] py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Truck className="h-7 w-7 text-primary" /> Demo Machine Challan List
              </CardTitle>
              <CardDescription>View, search, and manage all demo machine challans.</CardDescription>
            </div>
            <Link href="/dashboard/demo/demo-machine-challan/create" passHref>
              <Button className="bg-primary hover:bg-primary/90" disabled={isReadOnly}>
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Demo Challan
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4"><CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Demo Challans</CardTitle></CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div><Label htmlFor="challanIdFilter">Challan No.</Label><Input id="challanIdFilter" placeholder="Search by Challan No..." value={filterChallanId} onChange={(e) => setFilterChallanId(e.target.value)} /></div>
                <div><Label htmlFor="applicationIdFilter">Linked Application ID</Label><Input id="applicationIdFilter" placeholder="Search by App ID..." value={filterApplicationId} onChange={(e) => setFilterApplicationId(e.target.value)} /></div>
                <div><Label htmlFor="factoryFilter" className="flex items-center"><Factory className="mr-1 h-4 w-4 text-muted-foreground" />Factory</Label>
                  <Combobox options={factoryOptions} value={filterFactoryId || ALL_FACTORIES_VALUE} onValueChange={(v) => setFilterFactoryId(v === ALL_FACTORIES_VALUE ? '' : v)} placeholder="Search Factory..." selectPlaceholder="All Factories" disabled={isLoadingFactories} />
                </div>
                <div><Button onClick={clearFilters} variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Clear Filters</Button></div>
              </div>
            </CardContent>
          </Card>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Challan No.</TableHead>
                  <TableHead>Challan Date</TableHead>
                  <TableHead>Factory Name</TableHead>
                  <TableHead>Linked Application</TableHead>
                  <TableHead>Delivery Person</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mr-2 h-6 w-6 animate-spin inline" /> Loading challans...</TableCell></TableRow>
                ) : fetchError ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">{fetchError}</TableCell></TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((challan) => (
                    <TableRow key={challan.id}>
                      <TableCell className="font-medium">{challan.id}</TableCell>
                      <TableCell>{formatDisplayDate(challan.challanDate)}</TableCell>
                      <TableCell>{challan.factoryName || 'N/A'}</TableCell>
                      <TableCell>{challan.linkedApplicationId || 'N/A'}</TableCell>
                      <TableCell>{challan.deliveryPerson}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" disabled={!challan.id}><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel><DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEdit(challan.id)} disabled={isReadOnly}><FileEdit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePreview(challan.id)}><Printer className="mr-2 h-4 w-4" /><span>Preview</span></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(challan.id, challan.id)} className="text-destructive focus:text-destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">No demo challans found matching your criteria.</TableCell></TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedChallans.length)} of {displayedChallans.length} entries.
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
                    key={`demo-challan-page-${page}`}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (<span key={`ellipsis-demo-challan-${index}`} className="px-2 py-1 text-sm">{page}</span>)
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

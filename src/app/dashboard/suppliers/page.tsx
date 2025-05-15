
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { SupplierDocument } from '@/types'; 
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'; 
import { firestore } from '@/lib/firebase/config'; 
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

export default function BeneficiariesListPage() {
  const router = useRouter();
  const [beneficiaries, setBeneficiaries] = useState<SupplierDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchBeneficiaries = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(firestore, "suppliers"));
        const fetchedBeneficiaries = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierDocument));
        setBeneficiaries(fetchedBeneficiaries);
      } catch (error: any) {
        console.error("Error fetching beneficiaries: ", error);
         Swal.fire("Error", `Could not fetch beneficiary data from Firestore. Please check console for details and ensure Firestore rules allow reads. Error: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBeneficiaries();
  }, []);

  const handleEditBeneficiary = (beneficiaryId: string) => {
    Swal.fire({
      title: "Redirecting...",
      text: `Navigating to edit page for beneficiary ${beneficiaryId}.`,
      icon: "info",
      timer: 1500,
      showConfirmButton: false,
    });
    router.push(`/dashboard/suppliers/${beneficiaryId}/edit`);
  };

  const handleDeleteBeneficiary = (beneficiaryId: string, beneficiaryName?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete the beneficiary profile for "${beneficiaryName || beneficiaryId}" from Firestore.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "suppliers", beneficiaryId));
          setBeneficiaries(prevBeneficiaries => prevBeneficiaries.filter(b => b.id !== beneficiaryId));
          Swal.fire(
            'Deleted!',
            `Beneficiary ${beneficiaryName || beneficiaryId} has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting beneficiary: ", error);
          Swal.fire("Error", `Could not delete beneficiary: ${error.message}`, "error");
        }
      }
    });
  };

  // Pagination Logic
  const totalPages = Math.ceil(beneficiaries.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = beneficiaries.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
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

      if (currentPage <= halfPagesToShow + 1) {
        endPage = Math.min(totalPages - 1, maxPagesToShow);
      }
      if (currentPage >= totalPages - halfPagesToShow) {
        startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      }
      
      if (startPage > 2) {
        pageNumbers.push("...");
      }
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      if (endPage < totalPages - 1) {
        pageNumbers.push("...");
      }
      pageNumbers.push(totalPages);
    }
    return pageNumbers;
  };


  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Manage Beneficiaries
              </CardTitle>
              <CardDescription>
                View, search, and manage all beneficiary profiles from the database.
              </CardDescription>
            </div>
            <Link href="/dashboard/suppliers/add" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New Beneficiary
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Beneficiary Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                   <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading beneficiaries...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((beneficiary) => (
                    <TableRow key={beneficiary.id}>
                      <TableCell className="font-medium">{beneficiary.beneficiaryName || 'N/A'}</TableCell>
                      <TableCell>{beneficiary.emailId || 'N/A'}</TableCell>
                      <TableCell>{beneficiary.cellNumber || 'N/A'}</TableCell>
                      <TableCell>{beneficiary.contactPersonName || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditBeneficiary(beneficiary.id)}
                                className="hover:bg-accent/50 hover:text-accent-foreground"
                              >
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit Beneficiary</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit Beneficiary</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                           <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteBeneficiary(beneficiary.id, beneficiary.beneficiaryName)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete Beneficiary</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete Beneficiary</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                       No beneficiaries found. Ensure Firestore rules allow reads and data exists.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your beneficiaries from Firestore. 
                Showing {beneficiaries.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, beneficiaries.length)} of {beneficiaries.length} entries.
              </TableCaption>
            </Table>
          </div>
           {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-${index}`} className="px-2 py-1 text-sm">
                    {page}
                  </span>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


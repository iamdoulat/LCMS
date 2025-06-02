
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { PlusCircle, Users as UsersIcon, FileEdit, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { CustomerDocument } from '@/types'; 
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'; 
import { firestore } from '@/lib/firebase/config'; 
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

export default function ApplicantsListPage() {
  const router = useRouter();
  const [applicants, setApplicants] = useState<CustomerDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchApplicants = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(firestore, "customers"));
        const fetchedApplicants = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDocument));
        setApplicants(fetchedApplicants);
      } catch (error: any) {
        console.error("Error fetching applicants: ", error);
        Swal.fire("Error", `Could not fetch applicant data from Firestore. Please check console for details and ensure Firestore rules allow reads. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplicants();
  }, []);

  const handleEditApplicant = (applicantId: string) => {
    Swal.fire({
      title: "Redirecting...",
      text: `Navigating to edit page for applicant ${applicantId}.`,
      icon: "info",
      timer: 1500,
      showConfirmButton: false,
    });
    router.push(`/dashboard/customers/${applicantId}/edit`);
  };

  const handleDeleteApplicant = (applicantId: string, applicantName?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete the applicant profile for "${applicantName || applicantId}" from Firestore.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))', 
      cancelButtonColor: 'hsl(var(--secondary))', 
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "customers", applicantId));
          setApplicants(prevApplicants => prevApplicants.filter(applicant => applicant.id !== applicantId));
          Swal.fire(
            'Deleted!',
            `Applicant ${applicantName || applicantId} has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting applicant: ", error);
          Swal.fire("Error", `Could not delete applicant: ${error.message}`, "error");
        }
      }
    });
  };

  // Pagination Logic
  const totalPages = Math.ceil(applicants.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = applicants.slice(indexOfFirstItem, indexOfLastItem);

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
                <UsersIcon className="h-7 w-7 text-primary" />
                Manage Applicants
              </CardTitle>
              <CardDescription>
                View, search, and manage all applicant profiles from the database.
              </CardDescription>
            </div>
            <Link href="/dashboard/customers/add" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New Applicant
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Applicant Name</TableHead>
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
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading applicants...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((applicant) => (
                    <TableRow key={applicant.id}>
                      <TableCell className="font-medium">{applicant.applicantName || 'N/A'}</TableCell>
                      <TableCell>{applicant.email || 'N/A'}</TableCell>
                      <TableCell>{applicant.phone || 'N/A'}</TableCell>
                      <TableCell>{applicant.contactPerson || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="default"
                                size="icon"
                                onClick={() => handleEditApplicant(applicant.id)}
                                className="bg-accent text-accent-foreground hover:bg-accent/90 h-7 w-7"
                              >
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit Applicant</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit Applicant</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                           <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => handleDeleteApplicant(applicant.id, applicant.applicantName)}
                                  className="h-7 w-7"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete Applicant</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete Applicant</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                       No applicants found. Ensure Firestore rules allow reads and data exists.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your applicants from Firestore. 
                Showing {applicants.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, applicants.length)} of {applicants.length} entries.
              </TableCaption>
            </Table>
          </div>
           {/* Pagination controls will only show if there is more than one page */}
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


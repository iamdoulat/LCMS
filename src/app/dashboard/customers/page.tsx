
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Users as UsersIcon, FileEdit, Trash2, Loader2, ChevronLeft, ChevronRight, Search, Filter, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { CustomerDocument } from '@/types';
import { collection, getDocs, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

export default function ApplicantsListPage() {
  const router = useRouter();
  const [allApplicants, setAllApplicants] = useState<CustomerDocument[]>([]);
  const [displayedApplicants, setDisplayedApplicants] = useState<CustomerDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states
  const [filterApplicantName, setFilterApplicantName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterContactPerson, setFilterContactPerson] = useState('');

  useEffect(() => {
    const fetchApplicants = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const q = query(collection(firestore, "customers"), orderBy("applicantName", "asc"));
        const querySnapshot = await getDocs(q);
        const fetchedApplicants = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as CustomerDocument));
        setAllApplicants(fetchedApplicants);
      } catch (error: any) {
        console.error("Error fetching applicants: ", error);
        let errorMessage = `Could not fetch applicant data from Firestore. Please ensure Firestore rules allow reads.`;
         if (error.message && error.message.toLowerCase().includes("index")) {
            errorMessage = `Could not fetch applicant data: A Firestore index might be required. Please check the browser console for a link to create it.`;
        } else if (error.message) {
            errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplicants();
  }, []);

  useEffect(() => {
    let filtered = [...allApplicants];

    if (filterApplicantName) {
      filtered = filtered.filter(app =>
        app.applicantName?.toLowerCase().includes(filterApplicantName.toLowerCase())
      );
    }
    if (filterEmail) {
      filtered = filtered.filter(app =>
        app.email?.toLowerCase().includes(filterEmail.toLowerCase())
      );
    }
    if (filterPhone) {
      filtered = filtered.filter(app =>
        app.phone?.toLowerCase().includes(filterPhone.toLowerCase())
      );
    }
    if (filterContactPerson) {
      filtered = filtered.filter(app =>
        app.contactPerson?.toLowerCase().includes(filterContactPerson.toLowerCase())
      );
    }

    setDisplayedApplicants(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allApplicants, filterApplicantName, filterEmail, filterPhone, filterContactPerson]);


  const handleEditApplicant = (applicantId: string) => {
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
          setAllApplicants(prevApplicants => prevApplicants.filter(applicant => applicant.id !== applicantId));
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

  const clearFilters = () => {
    setFilterApplicantName('');
    setFilterEmail('');
    setFilterPhone('');
    setFilterContactPerson('');
    setCurrentPage(1);
  };


  // Pagination Logic
  const totalPages = Math.ceil(displayedApplicants.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedApplicants.slice(indexOfFirstItem, indexOfLastItem);

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
          {/* Filter Section */}
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <Label htmlFor="applicantNameFilter" className="text-sm font-medium">Applicant Name</Label>
                  <Input
                    id="applicantNameFilter"
                    placeholder="Search by Applicant Name..."
                    value={filterApplicantName}
                    onChange={(e) => setFilterApplicantName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="emailFilter" className="text-sm font-medium">Email</Label>
                  <Input
                    id="emailFilter"
                    type="email"
                    placeholder="Search by Email..."
                    value={filterEmail}
                    onChange={(e) => setFilterEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phoneFilter" className="text-sm font-medium">Phone</Label>
                  <Input
                    id="phoneFilter"
                    type="tel"
                    placeholder="Search by Phone..."
                    value={filterPhone}
                    onChange={(e) => setFilterPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="contactPersonFilter" className="text-sm font-medium">Contact Person</Label>
                  <Input
                    id="contactPersonFilter"
                    placeholder="Search by Contact Person..."
                    value={filterContactPerson}
                    onChange={(e) => setFilterContactPerson(e.target.value)}
                  />
                </div>
                <div className="lg:col-span-4 md:col-span-2">
                  <Button onClick={clearFilters} variant="outline" className="w-full md:w-auto">
                    <XCircle className="mr-2 h-4 w-4" /> Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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
                ) : fetchError ? (
                   <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-destructive">
                      {fetchError}
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
                       No applicants found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your applicants from Firestore.
                Showing {displayedApplicants.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedApplicants.length)} of {displayedApplicants.length} entries.
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
                    key={`app-page-${page}`}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-app-${index}`} className="px-2 py-1 text-sm">
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


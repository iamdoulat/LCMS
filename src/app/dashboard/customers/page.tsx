
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { PlusCircle, Users as UsersIcon, FileEdit, Info, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Swal from 'sweetalert2';
import type { CustomerDocument } from '@/types'; // Use CustomerDocument for Firestore data
// import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'; // Firestore imports
// import { firestore } from '@/lib/firebase/config'; // Firestore instance

export default function ApplicantsListPage() {
  const router = useRouter();
  const [applicants, setApplicants] = useState<CustomerDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For loading state

  useEffect(() => {
    // TODO: Implement actual data fetching from Firestore
    const fetchApplicants = async () => {
      setIsLoading(true);
      console.log("Fetching applicants from Firestore...");
      // Example Firestore fetch:
      // try {
      //   const querySnapshot = await getDocs(collection(firestore, "customers"));
      //   const fetchedApplicants = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDocument));
      //   setApplicants(fetchedApplicants);
      // } catch (error) {
      //   console.error("Error fetching applicants: ", error);
      //   Swal.fire("Error", "Could not fetch applicant data.", "error");
      // }
      setApplicants([]); // For now, set to empty after "fetching"
      setIsLoading(false);
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
      text: `This action cannot be undone. This will permanently delete the applicant profile for "${applicantName || applicantId}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))', 
      cancelButtonColor: 'hsl(var(--secondary))', 
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        console.log(`Simulating delete for applicant ID: ${applicantId} from Firestore.`);
        // TODO: Implement actual Firestore document deletion
        // try {
        //   await deleteDoc(doc(firestore, "customers", applicantId));
        //   setApplicants(prevApplicants => prevApplicants.filter(applicant => applicant.id !== applicantId));
        //   Swal.fire(
        //     'Deleted!',
        //     `Applicant ${applicantName || applicantId} has been removed.`,
        //     'success'
        //   );
        // } catch (error) {
        //   console.error("Error deleting applicant: ", error);
        //   Swal.fire("Error", `Could not delete applicant: ${error.message}`, "error");
        // }
        Swal.fire( // Placeholder success
          'Simulated Delete!',
          `Applicant ${applicantName || applicantId} would be removed from Firestore.`,
          'success'
        );
        // For local state update if not re-fetching:
        setApplicants(prevApplicants => prevApplicants.filter(applicant => applicant.id !== applicantId));
      }
    });
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
                <UsersIcon className="h-7 w-7" />
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
          <Alert variant="default" className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-700 dark:text-blue-300 font-semibold">Database Integration Note</AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400">
              This page is intended to display applicants from Firestore. Implement data fetching and real delete operations.
            </AlertDescription>
          </Alert>

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
                      Loading applicants...
                    </TableCell>
                  </TableRow>
                ) : applicants.length > 0 ? (
                  applicants.map((applicant) => (
                    <TableRow key={applicant.id}>
                      <TableCell className="font-medium">{applicant.applicantName}</TableCell>
                      <TableCell>{applicant.email}</TableCell>
                      <TableCell>{applicant.phone || 'N/A'}</TableCell>
                      <TableCell>{applicant.contactPerson || 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditApplicant(applicant.id)}
                                className="hover:bg-accent/50 hover:text-accent-foreground"
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
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteApplicant(applicant.id, applicant.applicantName)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
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
                      No applicants found in the database.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your applicants. (Data to be fetched from Firestore)
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

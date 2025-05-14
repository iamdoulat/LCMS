
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { PlusCircle, ListChecks, FileEdit, Info, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Swal from 'sweetalert2';
import type { LCEntryDocument, LCStatus } from '@/types'; 
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns'; 
// import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'; // Firestore imports
// import { firestore } from '@/lib/firebase/config'; // Firestore instance

const getStatusBadgeVariant = (status?: LCStatus) => {
  switch (status) {
    case 'Draft':
      return 'outline';
    case 'Transmitted':
      return 'secondary';
    case 'Shipping going on':
      return 'default'; 
    case 'Done':
      return 'default'; 
    default:
      return 'outline';
  }
};


export default function TotalLCPage() {
  const router = useRouter();
  const [lcEntries, setLcEntries] = useState<LCEntryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Implement actual data fetching from Firestore
    const fetchLCEntries = async () => {
      setIsLoading(true);
      console.log("Fetching L/C entries from Firestore...");
      // Example Firestore fetch:
      // try {
      //   const querySnapshot = await getDocs(collection(firestore, "lc_entries"));
      //   const fetchedLCs = querySnapshot.docs.map(doc => {
      //     const data = doc.data();
      //     return {
      //        id: doc.id,
      //        ...data,
      //        // Convert ISO string dates from Firestore back to Date objects if needed for display/formatting
      //        lcIssueDate: data.lcIssueDate ? parseISO(data.lcIssueDate) : undefined, 
      //        // Add other date conversions as needed
      //     } as LCEntryDocument;
      //   });
      //   setLcEntries(fetchedLCs);
      // } catch (error) {
      //   console.error("Error fetching L/C entries: ", error);
      //   Swal.fire("Error", "Could not fetch L/C data.", "error");
      // }
      setLcEntries([]); // For now, set to empty after "fetching"
      setIsLoading(false);
    };

    fetchLCEntries();
  }, []);


  const handleEditLC = (lcId: string) => {
    Swal.fire({
      title: "Redirecting...",
      text: `Navigating to edit page for L/C ${lcId}.`,
      icon: "info",
      timer: 1500,
      showConfirmButton: false,
    });
    router.push(`/dashboard/total-lc/${lcId}/edit`);
  };

  const handleDeleteLC = (lcId: string, lcNumber?: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete L/C "${lcNumber || lcId}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))', 
      cancelButtonColor: 'hsl(var(--secondary))', 
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        console.log(`Simulating delete for L/C ID: ${lcId} from Firestore.`);
         // TODO: Implement actual Firestore document deletion
        // try {
        //   await deleteDoc(doc(firestore, "lc_entries", lcId));
        //   setLcEntries(prevLcEntries => prevLcEntries.filter(lc => lc.id !== lcId));
        //   Swal.fire(
        //     'Deleted!',
        //     `L/C "${lcNumber || lcId}" has been removed.`,
        //     'success'
        //   );
        // } catch (error) {
        //   console.error("Error deleting L/C: ", error);
        //   Swal.fire("Error", `Could not delete L/C: ${error.message}`, "error");
        // }
        Swal.fire( // Placeholder success
          'Simulated Delete!',
          `L/C "${lcNumber || lcId}" would be removed from Firestore.`,
          'success'
        );
        // For local state update if not re-fetching:
        setLcEntries(prevLcEntries => prevLcEntries.filter(lc => lc.id !== lcId));
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
                <ListChecks className="h-7 w-7" />
                Total L/C Overview
              </CardTitle>
              <CardDescription>
                View, search, and manage all Letters of Credit from the database.
              </CardDescription>
            </div>
            <Link href="/dashboard/new-lc-entry" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New L/C Entry
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-700 dark:text-blue-300 font-semibold">Database Integration Note</AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400">
              This page is intended to display L/C entries from Firestore. Implement data fetching and real delete operations.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>L/C Number</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {isLoading ? (
                   <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Loading L/C entries...
                    </TableCell>
                  </TableRow>
                ) : lcEntries.length > 0 ? (
                  lcEntries.map((lc) => (
                    <TableRow key={lc.id}>
                      <TableCell className="font-medium">{lc.documentaryCreditNumber}</TableCell>
                      <TableCell>{lc.applicantName}</TableCell>
                      <TableCell>{lc.beneficiaryName}</TableCell>
                      <TableCell>{lc.currency} {typeof lc.amount === 'number' ? lc.amount.toLocaleString() : lc.amount}</TableCell>
                      <TableCell>{lc.lcIssueDate ? format(parseISO(lc.lcIssueDate), 'PPP') : 'N/A'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusBadgeVariant(lc.status)} 
                          className={lc.status === 'Shipping going on' ? 'bg-orange-500 text-white' : lc.status === 'Done' ? 'bg-green-600 text-white' : ''}
                        >
                          {lc.status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                           <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                // onClick={() => router.push(`/dashboard/total-lc/${lc.id}`)} // Placeholder for view details page
                                onClick={() => Swal.fire("Info", "View L/C Details page is not yet implemented.", "info")}
                                className="hover:bg-accent/50 hover:text-accent-foreground"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View Details</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View L/C Details (Not Implemented)</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => lc.id && handleEditLC(lc.id)}
                                className="hover:bg-accent/50 hover:text-accent-foreground"
                                disabled={!lc.id}
                              >
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit L/C</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit L/C</p>
                            </TooltipContent>
                          </Tooltip>
                           <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => lc.id && handleDeleteLC(lc.id, lc.documentaryCreditNumber)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                  disabled={!lc.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete L/C</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete L/C</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No L/C entries found in the database.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Letters of Credit. (Data to be fetched from Firestore)
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

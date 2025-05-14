
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { PlusCircle, ListChecks, FileEdit, Info, Trash2, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Swal from 'sweetalert2';
import type { SupplierDocument } from '@/types'; // Use SupplierDocument for Firestore data
// import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'; // Firestore imports
// import { firestore } from '@/lib/firebase/config'; // Firestore instance


export default function BeneficiariesListPage() {
  const router = useRouter();
  const [beneficiaries, setBeneficiaries] = useState<SupplierDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For loading state

  useEffect(() => {
    // TODO: Implement actual data fetching from Firestore
    const fetchBeneficiaries = async () => {
      setIsLoading(true);
      console.log("Fetching beneficiaries from Firestore...");
      // Example Firestore fetch:
      // try {
      //   const querySnapshot = await getDocs(collection(firestore, "suppliers"));
      //   const fetchedBeneficiaries = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierDocument));
      //   setBeneficiaries(fetchedBeneficiaries);
      // } catch (error) {
      //   console.error("Error fetching beneficiaries: ", error);
      //   Swal.fire("Error", "Could not fetch beneficiary data.", "error");
      // }
      setBeneficiaries([]); // For now, set to empty after "fetching"
      setIsLoading(false);
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
      text: `This action cannot be undone. This will permanently delete the beneficiary profile for "${beneficiaryName || beneficiaryId}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        console.log(`Simulating delete for beneficiary ID: ${beneficiaryId} from Firestore.`);
        // TODO: Implement actual Firestore document deletion
        // try {
        //   await deleteDoc(doc(firestore, "suppliers", beneficiaryId));
        //   setBeneficiaries(prevBeneficiaries => prevBeneficiaries.filter(b => b.id !== beneficiaryId));
        //   Swal.fire(
        //     'Deleted!',
        //     `Beneficiary ${beneficiaryName || beneficiaryId} has been removed.`,
        //     'success'
        //   );
        // } catch (error) {
        //   console.error("Error deleting beneficiary: ", error);
        //   Swal.fire("Error", `Could not delete beneficiary: ${error.message}`, "error");
        // }
         Swal.fire( // Placeholder success
          'Simulated Delete!',
          `Beneficiary ${beneficiaryName || beneficiaryId} would be removed from Firestore.`,
          'success'
        );
        // For local state update if not re-fetching:
        setBeneficiaries(prevBeneficiaries => prevBeneficiaries.filter(b => b.id !== beneficiaryId));
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
          <Alert variant="default" className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-700 dark:text-blue-300 font-semibold">Database Integration Note</AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400">
              This page is intended to display beneficiaries from Firestore. Implement data fetching and real delete operations.
            </AlertDescription>
          </Alert>

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
                      Loading beneficiaries...
                    </TableCell>
                  </TableRow>
                ) : beneficiaries.length > 0 ? (
                  beneficiaries.map((beneficiary) => (
                    <TableRow key={beneficiary.id}>
                      <TableCell className="font-medium">{beneficiary.beneficiaryName}</TableCell>
                      <TableCell>{beneficiary.emailId}</TableCell>
                      <TableCell>{beneficiary.cellNumber}</TableCell>
                      <TableCell>{beneficiary.contactPersonName}</TableCell>
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
                      No beneficiaries found in the database.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your beneficiaries. (Data to be fetched from Firestore)
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

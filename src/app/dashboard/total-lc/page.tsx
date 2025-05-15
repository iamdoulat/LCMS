
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, FileText } from 'lucide-react'; // Added FileText
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Swal from 'sweetalert2';
import type { LCEntryDocument, LCStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';

const getStatusBadgeVariant = (status?: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Draft':
      return 'outline';
    case 'Transmitted':
      return 'secondary';
    case 'Shipping pending':
      return 'default'; 
    case 'Shipping going on':
      return 'default';
    case 'Done':
      return 'default';
    default:
      return 'outline';
  }
};

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
  } catch (e) {
    return 'Invalid Date Format';
  }
};

const formatCurrencyValue = (currency?: string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString()}`;
};


export default function TotalLCPage() {
  const router = useRouter();
  const [lcEntries, setLcEntries] = useState<LCEntryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLCEntries = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(firestore, "lc_entries"));
        const fetchedLCs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
             id: doc.id,
             ...data,
          } as LCEntryDocument;
        });
        setLcEntries(fetchedLCs);
      } catch (error: any) {
        console.error("Error fetching L/C entries: ", error);
        Swal.fire("Error", `Could not fetch L/C data from Firestore. Please check console for details and ensure Firestore rules allow reads. Error: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLCEntries();
  }, []);


  const handleEditLC = (lcId: string) => {
    if (!lcId) {
        Swal.fire("Error", "L/C ID is missing, cannot edit.", "error");
        return;
    }
    router.push(`/dashboard/total-lc/${lcId}/edit`);
  };
  
  const handleDownloadLCPdf = (lcId: string, lcNumber?: string) => {
    if (!lcId) {
        Swal.fire("Error", "L/C ID is missing, cannot generate PDF.", "error");
        return;
    }
    Swal.fire({
        title: "PDF Download (Placeholder)",
        text: `PDF generation for L/C "${lcNumber || lcId}" would start here. This functionality is pending implementation.`,
        icon: "info",
        confirmButtonText: "OK"
    });
    // In a real implementation, you would call a PDF generation library here
    // e.g., using jsPDF, react-pdf, or a server-side PDF generation service.
    // console.log(`Attempting to generate PDF for L/C ID: ${lcId}`);
  };

  const handleDeleteLC = (lcId: string, lcNumber?: string) => {
     if (!lcId) {
        Swal.fire("Error", "L/C ID is missing, cannot delete.", "error");
        return;
    }
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete L/C "${lcNumber || lcId}" from Firestore.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "lc_entries", lcId));
          setLcEntries(prevLcEntries => prevLcEntries.filter(lc => lc.id !== lcId));
          Swal.fire(
            'Deleted!',
            `L/C "${lcNumber || lcId}" has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting L/C: ", error);
          Swal.fire("Error", `Could not delete L/C: ${error.message}`, "error");
        }
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>L/C Number</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Latest Shipment Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {isLoading ? (
                   <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                       <div className="flex justify-center items-center">
                         <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading L/C entries...
                       </div>
                    </TableCell>
                  </TableRow>
                ) : lcEntries.length > 0 ? (
                  lcEntries.map((lc) => (
                    <TableRow key={lc.id}>
                      <TableCell className="font-medium">{lc.documentaryCreditNumber || 'N/A'}</TableCell>
                      <TableCell>{lc.applicantName || 'N/A'}</TableCell>
                      <TableCell>{lc.beneficiaryName || 'N/A'}</TableCell>
                      <TableCell>{formatCurrencyValue(lc.currency, lc.amount)}</TableCell>
                      <TableCell>{formatDisplayDate(lc.lcIssueDate)}</TableCell>
                      <TableCell>{formatDisplayDate(lc.latestShipmentDate)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(lc.status)}
                          className={
                            lc.status === 'Shipping going on' ? 'bg-orange-500 text-white' :
                            lc.status === 'Done' ? 'bg-green-600 text-white' :
                            lc.status === 'Shipping pending' ? 'bg-yellow-500 text-black' : ''
                          }
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
                                onClick={() => lc.id && handleDownloadLCPdf(lc.id, lc.documentaryCreditNumber)}
                                className="hover:bg-accent/50 hover:text-accent-foreground"
                                disabled={!lc.id}
                              >
                                <FileText className="h-4 w-4" /> {/* Changed icon */}
                                <span className="sr-only">Download L/C as PDF</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Download L/C as PDF</p> {/* Changed tooltip text */}
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
                    <TableCell colSpan={8} className="h-24 text-center">
                      No L/C entries found. Ensure Firestore rules allow reads and data exists.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Letters of Credit from Firestore. If empty, check Firestore data and security rules.
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

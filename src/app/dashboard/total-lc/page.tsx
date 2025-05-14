
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { PlusCircle, ListChecks, FileEdit, Info, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Swal from 'sweetalert2';
import type { LCEntry, LCStatus } from '@/types'; // Import LCEntry and LCStatus
import { Badge } from '@/components/ui/badge'; // For status display
import { format } from 'date-fns'; // For date formatting

// Placeholder data - replace with actual data fetching
const initialLCs: LCEntry[] = [
  { 
    id: 'lc001', 
    documentaryCreditNumber: 'DC-2024-001', 
    applicantName: 'Global Imports Corp', 
    beneficiaryName: 'Advanced Tech Components', 
    currency: 'USD', 
    amount: 50000, 
    lcIssueDate: new Date('2024-01-15'), 
    status: 'Transmitted' as LCStatus,
    termsOfPay: "LC at sight",
    totalMachineQty: 10,
  },
  { 
    id: 'lc002', 
    documentaryCreditNumber: 'DC-2024-002', 
    applicantName: 'Tech Solutions Ltd.', 
    beneficiaryName: 'Global Manufacturing Co.', 
    currency: 'EURO', 
    amount: 120000, 
    lcIssueDate: new Date('2024-02-20'), 
    status: 'Shipping going on' as LCStatus,
    termsOfPay: "UPAS",
    totalMachineQty: 5,
  },
  { 
    id: 'lc003', 
    documentaryCreditNumber: 'DC-2024-003', 
    applicantName: 'Orient Exports Co.', 
    beneficiaryName: 'Precision Parts Inc.', 
    currency: 'USD', 
    amount: 75000, 
    lcIssueDate: new Date('2024-03-10'), 
    status: 'Done' as LCStatus,
    termsOfPay: "Deffered 180days",
    totalMachineQty: 25,
  },
  { 
    id: 'lc004', 
    documentaryCreditNumber: 'DC-2024-004', 
    applicantName: 'Pharma Global', 
    beneficiaryName: 'Supplier Alpha', 
    currency: 'USD', 
    amount: 25000, 
    lcIssueDate: new Date('2024-04-05'), 
    status: 'Draft' as LCStatus,
    termsOfPay: "TT in Advance",
    totalMachineQty: 2,
  },
];

const getStatusBadgeVariant = (status?: LCStatus) => {
  switch (status) {
    case 'Draft':
      return 'outline';
    case 'Transmitted':
      return 'secondary';
    case 'Shipping going on':
      return 'default'; // Primary color
    case 'Done':
      return 'default'; // Could use a different success color if available
    default:
      return 'outline';
  }
};


export default function TotalLCPage() {
  const router = useRouter();
  const [lcEntries, setLcEntries] = useState<LCEntry[]>(initialLCs);

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
      text: `This action cannot be undone. This will permanently delete the L/C "${lcNumber || lcId}" (simulated).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))', 
      cancelButtonColor: 'hsl(var(--secondary))', 
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        console.log(`Deleting L/C ${lcId}`);
        // Simulate API call for deletion
        setLcEntries(prevLcEntries => prevLcEntries.filter(lc => lc.id !== lcId));
        Swal.fire(
          'Deleted!',
          `L/C "${lcNumber || lcId}" has been removed from the list. (Simulated)`,
          'success'
        );
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
                View, search, and manage all Letters of Credit.
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
            <AlertTitle className="text-blue-700 dark:text-blue-300 font-semibold">Placeholder Data & Functionality</AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400">
              The L/C list below uses placeholder data. Actual data integration and full edit/delete functionality require backend setup.
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
                {lcEntries.length > 0 ? (
                  lcEntries.map((lc) => (
                    <TableRow key={lc.id}>
                      <TableCell className="font-medium">{lc.documentaryCreditNumber}</TableCell>
                      <TableCell>{lc.applicantName}</TableCell>
                      <TableCell>{lc.beneficiaryName}</TableCell>
                      <TableCell>{lc.currency} {typeof lc.amount === 'number' ? lc.amount.toLocaleString() : lc.amount}</TableCell>
                      <TableCell>{lc.lcIssueDate ? format(lc.lcIssueDate, 'PPP') : 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(lc.status)} className={lc.status === 'Shipping going on' ? 'bg-orange-500 text-white' : lc.status === 'Done' ? 'bg-green-600 text-white' : ''}>
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
                                onClick={() => router.push(`/dashboard/total-lc/${lc.id}`)} // Placeholder for view details page
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
                      No L/C entries found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Letters of Credit. (Currently displaying placeholder data)
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

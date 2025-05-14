
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { PlusCircle, ListChecks, FileEdit, Info, Trash2, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Swal from 'sweetalert2';

// Placeholder data - replace with actual data fetching
const initialSuppliers = [
  { id: 'supp1', supplierName: 'Advanced Tech Components', email: 'sales@atc.com', phone: '+1-555-0100', contactPerson: 'Sarah Miller', address: '789 Tech Row, Silicon Valley, CA' },
  { id: 'supp2', supplierName: 'Global Manufacturing Co.', email: 'contact@globalmfg.com', phone: '+86-21-5555-0200', contactPerson: 'Chen Wei', address: '101 Factory Rd, Shanghai, CN' },
  { id: 'supp3', supplierName: 'Precision Parts Inc.', email: 'info@precisionparts.net', phone: '+49-30-555-0300', contactPerson: 'Klaus Richter', address: '23 Industrial Park, Berlin, DE' },
];

export default function SuppliersListPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState(initialSuppliers);

  const handleEditSupplier = (supplierId: string) => {
    Swal.fire({
      title: "Redirecting...",
      text: `Navigating to edit page for supplier ${supplierId}.`,
      icon: "info",
      timer: 1500,
      showConfirmButton: false,
    });
    router.push(`/dashboard/suppliers/${supplierId}/edit`);
  };

  const handleDeleteSupplier = (supplierId: string, supplierName: string) => {
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete the supplier profile for "${supplierName || supplierId}" and remove their data from our servers (simulated).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        // Simulate API call for deletion
        // In a real app, you would make a call to your backend here:
        // e.g., await deleteSupplierFromDb(supplierId);
        console.log(`Simulating delete for supplier ${supplierId}`);
        
        // Update local state
        setSuppliers(prevSuppliers => prevSuppliers.filter(supplier => supplier.id !== supplierId));
        
        Swal.fire(
          'Deleted!',
          `Supplier ${supplierName || supplierId} has been removed from the list. (Simulated)`,
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
                Manage Suppliers
              </CardTitle>
              <CardDescription>
                View, search, and manage all supplier profiles.
              </CardDescription>
            </div>
            <Link href="/dashboard/suppliers/add" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New Supplier
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-700 dark:text-blue-300 font-semibold">Placeholder Data & Functionality</AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400">
              The supplier list below uses placeholder data. Actual data integration and full edit/delete functionality require backend setup.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Supplier Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length > 0 ? (
                  suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                      <TableCell>{supplier.email}</TableCell>
                      <TableCell>{supplier.phone}</TableCell>
                      <TableCell>{supplier.contactPerson}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditSupplier(supplier.id)}
                                className="hover:bg-accent/50 hover:text-accent-foreground"
                              >
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit Supplier</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit Supplier</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                           <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteSupplier(supplier.id, supplier.supplierName)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete Supplier</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete Supplier</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No suppliers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your suppliers. (Currently displaying placeholder data)
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

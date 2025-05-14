
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { PlusCircle, Users as UsersIcon, FileEdit, Info, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Placeholder data - replace with actual data fetching
const initialCustomers = [
  { id: 'cust1', customerName: 'Global Imports Corp', email: 'contact@globalimports.com', phone: '+1-202-555-0173', contactPerson: 'John Doe', address: '123 Import Lane, New York, NY' },
  { id: 'cust2', customerName: 'Tech Solutions Ltd.', email: 'info@techsolutions.io', phone: '+44 20 7946 0958', contactPerson: 'Jane Smith', address: '456 Tech Park, London, UK' },
  { id: 'cust3', customerName: 'Orient Exports Co.', email: 'sales@orientexports.asia', phone: '+65 6734 8888', contactPerson: 'Lee Wang', address: '789 Export Plaza, Singapore' },
];

export default function CustomersListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  const handleEditCustomer = (customerId: string) => {
    toast({
      title: "Redirecting...",
      description: `Navigating to edit page for customer ${customerId}.`,
      variant: "default"
    });
    router.push(`/dashboard/customers/${customerId}/edit`);
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomerToDelete(customerId);
  };

  const handleConfirmDelete = () => {
    if (customerToDelete) {
      // Simulate API call for deletion
      console.log(`Deleting customer ${customerToDelete}`);
      
      // Update local state
      setCustomers(prevCustomers => prevCustomers.filter(customer => customer.id !== customerToDelete));
      
      toast({
        title: "Customer Deleted (Simulated)",
        description: `Customer ${customerToDelete} has been removed from the list.`,
        variant: "default" // Or "destructive" depending on desired styling for delete toasts
      });
      setCustomerToDelete(null); // Close dialog
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
                <UsersIcon className="h-7 w-7" />
                Manage Customers
              </CardTitle>
              <CardDescription>
                View, search, and manage all customer profiles.
              </CardDescription>
            </div>
            <Link href="/dashboard/customers/add" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New Customer
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-700 dark:text-blue-300 font-semibold">Placeholder Data & Functionality</AlertTitle>
            <AlertDescription className="text-blue-600 dark:text-blue-400">
              The customer list below uses placeholder data. Actual data integration and full edit/delete functionality require backend setup.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Customer Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length > 0 ? (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.customerName}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>{customer.contactPerson}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCustomer(customer.id)}
                                className="hover:bg-accent/50 hover:text-accent-foreground"
                              >
                                <FileEdit className="h-4 w-4" />
                                <span className="sr-only">Edit Customer</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit Customer</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                           <Tooltip>
                            <TooltipTrigger asChild>
                               <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteCustomer(customer.id)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete Customer</span>
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete Customer</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No customers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your customers. (Currently displaying placeholder data)
              </TableCaption>
            </Table>
          </div>
        </CardContent>
      </Card>

      {customerToDelete && (
        <AlertDialog open={!!customerToDelete} onOpenChange={() => setCustomerToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the customer
                profile and remove their data from our servers (simulated).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}


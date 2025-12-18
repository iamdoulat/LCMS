
import { SalesInvoiceList } from '@/components/dashboard/SalesInvoiceList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ListChecks, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';


export default function SalesInvoicesPage() {
  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Sales Invoices List
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all sales invoices.
              </CardDescription>
            </div>
            <Link href="/dashboard/inventory/sales/create" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create New Sales Invoice
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <SalesInvoiceList />
        </CardContent>
      </Card>
    </div>
  );
}

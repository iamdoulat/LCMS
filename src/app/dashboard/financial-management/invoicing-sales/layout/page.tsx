
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LayoutGrid, FileText, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface LayoutType {
  id: string;
  title: string;
  description: string;
  editUrl: string;
  icon: React.ElementType;
}

const layoutTypes: LayoutType[] = [
  {
    id: 'quote',
    title: 'Quote Layout',
    description: 'Customize the appearance and structure of your sales quotations.',
    editUrl: '/dashboard/financial-management/invoicing-sales/edit-layout/quote',
    icon: FileText,
  },
  {
    id: 'invoice',
    title: 'Invoice Layout',
    description: 'Design how your sales invoices will look when printed or sent.',
    editUrl: '/dashboard/financial-management/invoicing-sales/edit-layout/invoice',
    icon: FileText,
  },
  {
    id: 'order',
    title: 'Order Layout',
    description: 'Define the layout for your sales order confirmations.',
    editUrl: '/dashboard/financial-management/invoicing-sales/edit-layout/order',
    icon: FileText,
  },
];

export default function FinancialManagementLayoutPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader className="mb-4">
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <LayoutGrid className="h-7 w-7 text-primary" />
            Document Layout Management
          </CardTitle>
          <CardDescription>
            Choose a document type below to customize its layout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {layoutTypes.map((layout) => (
              <Card key={layout.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold flex items-center gap-2 text-foreground">
                    <layout.icon className="h-6 w-6 text-primary" />
                    {layout.title}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground pt-1 h-16">
                    {layout.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex justify-end">
                  <Link href={layout.editUrl} passHref>
                    <Button variant="default">
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Layout
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

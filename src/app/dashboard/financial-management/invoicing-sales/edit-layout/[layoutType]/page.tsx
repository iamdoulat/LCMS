

"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LayoutGrid, Move, ImageIcon, Type, FileText, CalendarDays as CalendarIcon, Hash as HashIcon, Users as UsersIcon, Package as PackageIcon, DollarSign as DollarSignIcon, InfoIcon, Columns } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const componentPaletteItems = [
  { id: 'companyLogo', label: 'Company Logo', icon: ImageIcon },
  { id: 'companyNameAddress', label: 'Company Name & Address', icon: Type },
  { id: 'customerDetails', label: 'Customer/Beneficiary Details', icon: UsersIcon },
  { id: 'documentTitle', label: 'Document Title (e.g., Invoice)', icon: Type },
  { id: 'documentId', label: 'Document ID (e.g., INV-001)', icon: HashIcon },
  { id: 'documentDate', label: 'Document Date', icon: CalendarIcon },
  { id: 'dueDate', label: 'Due Date', icon: CalendarIcon },
  { id: 'lineItemsTable', label: 'Line Items Table', icon: PackageIcon },
  { id: 'subtotal', label: 'Subtotal Amount', icon: DollarSignIcon },
  { id: 'taxTotal', label: 'Tax Total', icon: DollarSignIcon },
  { id: 'discountTotal', label: 'Discount Total', icon: DollarSignIcon },
  { id: 'grandTotal', label: 'Grand Total', icon: DollarSignIcon },
  { id: 'paymentTerms', label: 'Payment Terms', icon: Type },
  { id: 'notesComments', label: 'Notes/Comments Section', icon: FileText },
  { id: 'salesperson', label: 'Salesperson', icon: UsersIcon },
  { id: 'customText', label: 'Custom Text Block', icon: Type },
  { id: 'customImage', label: 'Custom Image', icon: ImageIcon },
  { id: 'pageNumber', label: 'Page Number', icon: HashIcon },
  { id: 'twoColumnBlock', label: 'Two Column Block', icon: Columns },
];

export default function EditDocumentLayoutPage() {
  const params = useParams();

  const layoutType = params.layoutType as string;

  const [title, setTitle] = useState('Document Layout');

  useEffect(() => {
    if (layoutType) {
      const formattedType = layoutType.charAt(0).toUpperCase() + layoutType.slice(1);
      setTitle(`${formattedType} Layout Editor`);
    }
  }, [layoutType]);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/financial-management/invoicing-sales/setting" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Layout Settings
          </Button>
        </Link>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <LayoutGrid className="h-7 w-7 text-primary" />
            {title}
          </CardTitle>
          <CardDescription>
            Drag and drop components to design your document. (Note: Drag-and-drop functionality is a placeholder for this demo).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-blue-500/10 border-blue-500/30">
            <InfoIcon className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-700 font-semibold">Developer Note</AlertTitle>
            <AlertDescription className="text-blue-700/90">
              This page demonstrates the structure for a layout editor. Implementing full drag-and-drop functionality, component configuration, and layout saving requires a dedicated library (e.g., dnd-kit, react-grid-layout) and backend integration, which is beyond the scope of this current AI-assisted prototyping.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Component Palette */}
            <Card className="w-full md:w-1/3 lg:w-1/4 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">Components</CardTitle>
                <CardDescription className="text-xs">Click or drag items to the layout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
                {componentPaletteItems.map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-2 px-3 cursor-grab"
                    title={`Add ${item.label}`}
                  >
                    <item.icon className="mr-2 h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm">{item.label}</span>
                    <Move className="ml-auto h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Layout Area */}
            <Card className="flex-1 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">Document Preview (Layout Area)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 border-2 border-dashed border-muted-foreground/30 rounded-md min-h-[70vh] bg-background">
                <div className="p-4 border-b border-muted-foreground/20 min-h-[15vh] bg-white/50 rounded-t-md">
                  <p className="text-sm font-medium text-muted-foreground text-center">Header Section</p>
                  {/* Placeholder for Header content */}
                </div>
                <div className="p-4 border-b border-muted-foreground/20 min-h-[40vh] bg-white/50">
                  <p className="text-sm font-medium text-muted-foreground text-center">Body Section (e.g., Line Items)</p>
                  {/* Placeholder for Body content */}
                </div>
                <div className="p-4 min-h-[15vh] bg-white/50 rounded-b-md">
                  <p className="text-sm font-medium text-muted-foreground text-center">Footer Section</p>
                  {/* Placeholder for Footer content */}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

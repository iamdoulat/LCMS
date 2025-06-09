
"use client"; // Added "use client" as forms are client-side interactive

import { CreateSaleForm } from '@/components/forms/CreateSaleForm'; // Import the new form
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SalesManagementPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-screen-2xl mx-auto shadow-xl"> {/* Changed max-width for a potentially larger form */}
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <DollarSign className="h-7 w-7 text-primary" />
            Record New Sale
          </CardTitle>
          <CardDescription>
            Fill in the details below to record a new sale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateSaleForm /> {/* Use the imported form component */}
        </CardContent>
      </Card>
    </div>
  );
}

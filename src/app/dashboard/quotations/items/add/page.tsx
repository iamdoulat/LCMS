import { AddQuoteItemForm } from '@/components/forms/AddQuoteItemForm'; // Changed import
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AddNewQuoteItemPage() {
  return (
    <div className="container mx-auto py-8 px-6">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Package className="h-7 w-7 text-primary" />
            Add New Quote Item
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new item to your quote item list. Fields marked with an asterisk (*) are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddQuoteItemForm /> {/* Changed component */}
        </CardContent>
      </Card>
    </div>
  );
}

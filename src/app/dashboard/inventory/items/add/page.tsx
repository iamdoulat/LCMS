import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AddItemForm } from '@/components/forms/AddItemForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package as PackageIcon, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AddNewItemPage() {
  return (
    <div className="container mx-auto py-8 px-5">
      <div className="mb-6">
        <Link href="/dashboard/inventory/items/list" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Items List
          </Button>
        </Link>
      </div>
      <Card className="max-w-5xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <PackageIcon className="h-7 w-7 text-primary" />
            Add New Item
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new item to your inventory. Fields marked with an asterisk (*) are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddItemForm />
        </CardContent>
      </Card>
    </div>
  );
}

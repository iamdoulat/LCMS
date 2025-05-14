
import { AddSupplierForm } from '@/components/forms/AddSupplierForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Store } from 'lucide-react';

export default function AddSupplierPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Store className="h-7 w-7" /> {/* Could be PlusCircle or FilePlus2 here too */}
            Add New Supplier
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new supplier to the system. Fields marked with an asterisk (*) are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddSupplierForm />
        </CardContent>
      </Card>
    </div>
  );
}


import { AddProformaInvoiceForm } from '@/components/forms/AddProformaInvoiceForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FilePlus2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AddNewPIPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-primary">
            <FilePlus2 className="h-7 w-7 text-primary" />
            Add New Proforma Invoice (PI)
          </CardTitle>
          <CardDescription>
            Fill in the details below to create a new Proforma Invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddProformaInvoiceForm />
        </CardContent>
      </Card>
    </div>
  );
}

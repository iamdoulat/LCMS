
import { AddCommissionInvoiceForm } from '../components/AddCommissionInvoiceForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FilePlus2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AddNewPIPage() {
  return (
    <div className="m-[25px]">
      <Card className="w-full shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FilePlus2 className="h-7 w-7 text-primary" />
            Add New Commission Invoice (PI)
          </CardTitle>
          <CardDescription>
            Fill in the details below to create a new Commission Invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddCommissionInvoiceForm defaultDate={new Date().toISOString()} />
        </CardContent>
      </Card>
    </div>
  );
}

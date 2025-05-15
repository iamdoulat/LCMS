
import { AddSupplierForm } from '@/components/forms/AddSupplierForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Store } from 'lucide-react'; 
import { cn } from '@/lib/utils';

export default function AddBeneficiaryPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Store className="h-7 w-7 text-primary" /> 
            Add New Beneficiary
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new beneficiary to the system. Fields marked with an asterisk (*) are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddSupplierForm />
        </CardContent>
      </Card>
    </div>
  );
}

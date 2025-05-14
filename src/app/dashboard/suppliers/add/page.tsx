
import { AddSupplierForm } from '@/components/forms/AddSupplierForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Store } from 'lucide-react'; // Or FilePlus2

export default function AddBeneficiaryPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Store className="h-7 w-7" /> 
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

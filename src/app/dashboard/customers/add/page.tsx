
import { AddCustomerForm } from '@/components/forms/AddCustomerForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserPlus } from 'lucide-react';

export default function AddCustomerPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <UserPlus className="h-7 w-7" />
            Add New Customer
          </CardTitle>
          <CardDescription>
            Fill in the details below to add a new customer to the system. Fields marked with an asterisk (*) are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddCustomerForm />
        </CardContent>
      </Card>
    </div>
  );
}

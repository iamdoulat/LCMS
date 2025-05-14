
import { CompanySetupForm } from '@/components/forms/CompanySetupForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building } from 'lucide-react';

export default function CompanySetupPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Building className="h-7 w-7" />
            Company Setup
          </CardTitle>
          <CardDescription>
            Configure your company&apos;s core information. This data may be used across the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanySetupForm />
        </CardContent>
      </Card>
    </div>
  );
}

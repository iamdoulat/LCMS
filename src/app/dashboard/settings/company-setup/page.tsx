
import { CompanySetupForm } from '@/components/forms/CompanySetupForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CompanySetupPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Building className="h-7 w-7 text-primary" />
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

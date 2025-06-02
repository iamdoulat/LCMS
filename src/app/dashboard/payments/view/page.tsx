import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ViewPaymentsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ListChecks className="h-7 w-7 text-primary" />
            View Payments
          </CardTitle>
          <CardDescription>
            This page is under construction. Functionality for Viewing Payments will be implemented here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Content for View Payments goes here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

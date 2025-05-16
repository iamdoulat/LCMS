
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function IssuedPIListPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ListChecks className="h-7 w-7 text-primary" />
            Issued Proforma Invoice (PI) List
          </CardTitle>
          <CardDescription>
            This page will display a list of all issued Proforma Invoices relevant to commission management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Table or list of issued PIs will be displayed here.</p>
          {/* Placeholder for PI list component */}
        </CardContent>
      </Card>
    </div>
  );
}

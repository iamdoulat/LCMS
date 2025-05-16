
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FilePlus2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AddNewPIPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FilePlus2 className="h-7 w-7 text-primary" />
            Add New Proforma Invoice (PI)
          </CardTitle>
          <CardDescription>
            This page will be used to add new Proforma Invoice entries for commission management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Form for adding new PI details will be here.</p>
          {/* Placeholder for AddNewPIForm component */}
        </CardContent>
      </Card>
    </div>
  );
}

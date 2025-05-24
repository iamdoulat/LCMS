
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MachineUnderWarrantyPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary")}>
            <ShieldCheck className="h-7 w-7 text-primary" />
            Machines Under Warranty
          </CardTitle>
          <CardDescription>
            View all machines currently under warranty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>A list of machines under warranty will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

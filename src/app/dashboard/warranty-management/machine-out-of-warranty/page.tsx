
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MachineOutOfWarrantyPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary")}>
            <ShieldOff className="h-7 w-7 text-primary" />
            Machines Out of Warranty
          </CardTitle>
          <CardDescription>
            View all machines whose warranty period has expired.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>A list of machines out of warranty will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

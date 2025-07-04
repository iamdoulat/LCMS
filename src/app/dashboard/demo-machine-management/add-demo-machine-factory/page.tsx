
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AddDemoMachineFactoryPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Factory className="h-7 w-7 text-primary" />
            Add Demo Machine Factory
          </CardTitle>
          <CardDescription>
            Add or manage factories related to demo machines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Form for adding demo machine factory details will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

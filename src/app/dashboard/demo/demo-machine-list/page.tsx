import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DemoMachineListPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <ListChecks className="h-7 w-7 text-primary" />
            Demo Machine List
          </CardTitle>
          <CardDescription>
            View and manage the list of available demo machines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>A table or list of demo machines will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

    
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DemoMachineProgramPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FileCode className="h-7 w-7 text-primary" />
            Demo Machine Program
          </CardTitle>
          <CardDescription>
            Manage programs and software for demo machines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Functionality for managing demo machine programs will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

    
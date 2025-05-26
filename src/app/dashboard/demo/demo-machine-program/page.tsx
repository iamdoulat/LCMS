
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AppWindow, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DemoMachineProgramPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <FileCode className="h-7 w-7 text-primary" />
                Demo Machine Program
              </CardTitle>
              <CardDescription>
                Manage programs and software for demo machines.
              </CardDescription>
            </div>
            <Link href="/dashboard/demo/demo-machine-application" passHref>
              <Button variant="default">
                <AppWindow className="mr-2 h-4 w-4" />
                New Demo Application
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p>Functionality for managing demo machine programs will be here.</p>
          {/* Add specific content for demo machine programs, e.g., a list or form */}
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListChecks, PlusCircle } from 'lucide-react'; // Changed icon to ListChecks
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DemoMachineListPage() { // Renamed function
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" /> {/* Changed icon */}
                Demo Machine List {/* Updated title */}
              </CardTitle>
              <CardDescription>
                View and manage the list of available demo machines. {/* Updated description */}
              </CardDescription>
            </div>
            <Link href="/dashboard/demo/add-demo-machine-factory" passHref>
              <Button variant="default">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Factory
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p>A table or list of demo machines will be displayed here.</p> {/* Updated placeholder content */}
        </CardContent>
      </Card>
    </div>
  );
}

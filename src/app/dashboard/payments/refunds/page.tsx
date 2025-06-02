import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RefundsAndReturnsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Undo2 className="h-7 w-7 text-primary" />
            Refunds & Returns
          </CardTitle>
          <CardDescription>
            This page is under construction. Functionality for Refunds & Returns will be implemented here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Content for Refunds & Returns goes here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

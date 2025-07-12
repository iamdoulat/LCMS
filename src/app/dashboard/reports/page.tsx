import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <BarChart3 className="h-7 w-7 text-primary" />
            Reports
          </CardTitle>
          <CardDescription>
            View and generate various reports for L/C and financial data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>This page is under construction. Future updates will include various reporting functionalities.</p>
        </CardContent>
      </Card>
    </div>
  );
}


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DemoMachineSearchPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Search className="h-7 w-7 text-primary" />
            Demo Machine Search
          </CardTitle>
          <CardDescription>
            Search for demo machines based on various criteria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Search form and results for demo machines will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FilePlus2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LcTtEntryPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl text-primary")}>
            <FilePlus2 className="h-7 w-7 text-primary" />
            LC T/T Entry
          </CardTitle>
          <CardDescription>
            This page is for creating new LC T/T entries. Content under development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Form and functionality for LC T/T Entry will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

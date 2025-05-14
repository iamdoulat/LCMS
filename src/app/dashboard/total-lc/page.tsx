import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListChecks, Info } from 'lucide-react';

export default function TotalLCPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <ListChecks className="h-7 w-7" />
            Total L/C Overview
          </CardTitle>
          <CardDescription>
            This section will display a comprehensive list and details of all Letters of Credit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <Info className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">Content Under Development</p>
            <p className="text-sm text-muted-foreground">
              Detailed L/C listings and management features will be available here soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NewInstallationReportPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary")}>
            <Wrench className="h-7 w-7 text-primary" />
            New Installation Report
          </CardTitle>
          <CardDescription>
            Create a new installation report for a machine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Content for creating a new installation report will go here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

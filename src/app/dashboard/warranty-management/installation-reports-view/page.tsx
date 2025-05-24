
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InstallationReportsViewPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary")}>
            <ClipboardList className="h-7 w-7 text-primary" />
            View Installation Reports
          </CardTitle>
          <CardDescription>
            Browse and manage existing installation reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>A list of installation reports will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

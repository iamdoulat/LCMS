import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CalendarClock, Info } from 'lucide-react';

export default function UpcomingShipmentsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <CalendarClock className="h-7 w-7" />
            Upcoming Shipments
          </CardTitle>
          <CardDescription>
            This section will provide a schedule and details for upcoming shipments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <Info className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">Content Under Development</p>
            <p className="text-sm text-muted-foreground">
              Planning and tracking for upcoming shipments will be available soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sheet as SheetIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GoogleSheetsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <SheetIcon className="h-7 w-7 text-primary" />
            Google Sheets Integration
          </CardTitle>
          <CardDescription>
            Manage and configure Google Sheets integration for L/C and T/T data. (Placeholder Page)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Functionality to connect and sync data with Google Sheets will be implemented here.
          </p>
          <div className="mt-6 p-6 border-2 border-dashed rounded-lg bg-muted/30">
            <h4 className="text-lg font-semibold mb-2 text-foreground">Upcoming Features:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Authenticate with Google Sheets API.</li>
              <li>Select specific sheets for data export/import.</li>
              <li>Configure mapping between application fields and sheet columns.</li>
              <li>Schedule automated data synchronization tasks.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

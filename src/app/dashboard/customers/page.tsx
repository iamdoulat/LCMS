
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users as UsersIcon, Info } from 'lucide-react'; // Renamed to avoid conflict

export default function CustomersPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <UsersIcon className="h-7 w-7" />
            Manage Customers
          </CardTitle>
          <CardDescription>
            Add, view, and manage customer information for L/C entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <Info className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">Content Under Development</p>
            <p className="text-sm text-muted-foreground">
              Customer management forms and listings will be implemented here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

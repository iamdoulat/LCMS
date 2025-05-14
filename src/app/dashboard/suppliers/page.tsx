
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Store, Info } from 'lucide-react';

export default function SuppliersPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Store className="h-7 w-7" />
            Manage Suppliers
          </CardTitle>
          <CardDescription>
            Add, view, and manage supplier information for L/C entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <Info className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">Content Under Development</p>
            <p className="text-sm text-muted-foreground">
              Supplier management forms and listings will be implemented here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

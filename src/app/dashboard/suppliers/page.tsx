
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListChecks, PlusCircle, Info } from 'lucide-react';
import Link from 'next/link';

export default function SuppliersListPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
                <ListChecks className="h-7 w-7" />
                Manage Suppliers
              </CardTitle>
              <CardDescription>
                View, search, and manage all supplier profiles.
              </CardDescription>
            </div>
            <Link href="/dashboard/suppliers/add" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New Supplier
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <Info className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-xl font-semibold text-muted-foreground">Supplier List Under Development</p>
            <p className="text-sm text-muted-foreground">
              A table displaying all registered suppliers will be implemented here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

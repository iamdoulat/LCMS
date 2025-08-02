// This file is obsolete and will be removed. The new page is at /dashboard/inventory/items/list/page.tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function DeprecatedItemsListPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Page Not Available</CardTitle>
          <CardDescription>
            This page has been moved. Please use the{' '}
            <Link href="/dashboard/inventory/items/list" className="text-primary hover:underline">
              Inventory Items page
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

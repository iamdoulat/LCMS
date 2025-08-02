// This file is obsolete and will be removed. The new page is at /dashboard/inventory/items/add/page.tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function DeprecatedAddItemPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Page Not Available</CardTitle>
          <CardDescription>
            This page has been moved. Please use the{' '}
            <Link href="/dashboard/inventory/items/add" className="text-primary hover:underline">
              new Add Item page
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

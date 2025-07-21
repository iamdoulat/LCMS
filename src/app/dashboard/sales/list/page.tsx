// This page has been removed to consolidate routes.
// The primary sales list is now located at /dashboard/inventory/sales-list

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function DeprecatedSalesListPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Page Not Available</CardTitle>
          <CardDescription>
            This page has been removed. Please use the{' '}
            <Link href="/dashboard/inventory/sales-list" className="text-primary hover:underline">
              official Sales List page
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

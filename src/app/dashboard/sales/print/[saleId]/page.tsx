// This page has been removed to consolidate routes.
// The primary print preview is now located at /dashboard/inventory/sales/print/[saleId]

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function DeprecatedSalesPrintPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Page Not Available</CardTitle>
          <CardDescription>
            This page has been removed. The print preview is now generated from the main sales list.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

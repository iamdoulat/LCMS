
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function DeprecatedRecordSalePage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Page Not Available</CardTitle>
          <CardDescription>
            This page has been removed. Please use the{' '}
            <Link href="/dashboard/inventory/sales-list" className="text-primary hover:underline">
              Sales List page
            </Link>
            {' '}to manage sales.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

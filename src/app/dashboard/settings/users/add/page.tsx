// This page has been removed as user creation is now handled on the public /register page.
// Admin-only user creation has been disabled.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export default function DeprecatedAddUserPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Page Not Available</CardTitle>
          <CardDescription>
            User creation is now handled through the public <Link href="/register" className="text-primary hover:underline">registration page</Link>.
            Admin-only user creation has been disabled.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

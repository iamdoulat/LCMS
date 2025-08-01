// This page has been moved.
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function MovedPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Page Moved</CardTitle>
          <CardDescription>
            This page has been moved to a new location.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Button asChild>
                <Link href="/dashboard/quotations/create">
                    <ArrowLeft className="mr-2 h-4 w-4"/>
                    Go to the new Create Quote page
                </Link>
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}

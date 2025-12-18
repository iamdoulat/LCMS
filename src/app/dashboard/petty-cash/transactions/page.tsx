
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TransactionsRedirectPage() {
    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-xl max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>Page Moved</CardTitle>
                    <CardDescription>
                        The daily transaction list has been moved to the main Petty Cash Dashboard for a unified view.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <Link href="/dashboard/petty-cash/dashboard">
                            <ArrowLeft className="mr-2 h-4 w-4"/>
                            Go to Petty Cash Dashboard
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

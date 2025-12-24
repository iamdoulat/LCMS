"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { AddBranchForm } from '@/components/forms/AddBranchForm';

export default function AddBranchPage() {
    const router = useRouter();

    const handleFormSubmit = () => {
        router.push('/dashboard/hr/settings');
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <Button
                variant="ghost"
                onClick={() => router.push('/dashboard/hr/settings')}
                className="mb-4"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Settings
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle>Add New Branch</CardTitle>
                    <CardDescription>
                        Create a new company branch with location details.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <AddBranchForm onFormSubmit={handleFormSubmit} />
                </CardContent>
            </Card>
        </div>
    );
}

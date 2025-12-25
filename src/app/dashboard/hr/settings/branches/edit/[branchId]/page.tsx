"use client";

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { EditBranchForm } from '@/components/forms/hr';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { BranchDocument } from '@/types';

export default function EditBranchPage() {
    const router = useRouter();
    const params = useParams();
    const branchId = params.branchId as string;

    const [branchData, setBranchData] = React.useState<BranchDocument | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchBranch = async () => {
            try {
                const branchRef = doc(firestore, 'branches', branchId);
                const branchSnap = await getDoc(branchRef);

                if (branchSnap.exists()) {
                    setBranchData({ id: branchSnap.id, ...branchSnap.data() } as BranchDocument);
                } else {
                    setError('Branch not found');
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load branch');
            } finally {
                setIsLoading(false);
            }
        };

        if (branchId) {
            fetchBranch();
        }
    }, [branchId]);

    const handleFormSubmit = () => {
        router.push('/dashboard/hr/settings');
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 max-w-4xl flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !branchData) {
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
                        <CardTitle>Error</CardTitle>
                        <CardDescription>{error || 'Branch not found'}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

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
                    <CardTitle>Edit Branch</CardTitle>
                    <CardDescription>
                        Update the details for {branchData.name}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <EditBranchForm initialData={branchData} onFormSubmit={handleFormSubmit} />
                </CardContent>
            </Card>
        </div>
    );
}


"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ErrorCodeForm } from '@/components/warranty/ErrorCodeForm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FileCode, ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { ErrorCodeRecord } from '@/types/warranty';

export default function EditErrorCodePage() {
    const params = useParams();
    const router = useRouter();
    const [record, setRecord] = useState<ErrorCodeRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRecord = async () => {
            if (!params.id) return;

            try {
                const docRef = doc(firestore, 'error_codes', params.id as string);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setRecord({ id: docSnap.id, ...docSnap.data() } as ErrorCodeRecord);
                } else {
                    setError("Error code record not found.");
                }
            } catch (err) {
                console.error("Error fetching record:", err);
                setError("Failed to fetch record details.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecord();
    }, [params.id]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-slate-500 font-medium">Loading record data...</p>
            </div>
        );
    }

    if (error || !record) {
        return (
            <div className="max-w-2xl mx-auto py-20 px-4 text-center">
                <div className="h-20 w-20 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-6">
                    <AlertCircle className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Record Not Found</h2>
                <p className="text-slate-500 mb-8">{error || "The error code record you're looking for doesn't exist."}</p>
                <Button asChild>
                    <Link href="/dashboard/warranty-management/error-codes">
                        Go Back
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 mb-20">
            <div className="mb-8">
                <Button variant="ghost" size="sm" className="mb-4 text-slate-500 hover:text-primary" asChild>
                    <Link href="/dashboard/warranty-management/error-codes">
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Error Codes
                    </Link>
                </Button>

                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <FileCode className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Edit Error Code</h1>
                        <p className="text-slate-500 mt-1">Update troubleshooting details for code: <span className="font-bold text-slate-700">{record.errorCode}</span></p>
                    </div>
                </div>
            </div>

            <Card className="border-slate-100 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                    <CardTitle className="text-xl font-bold text-slate-800">Modify Fault Details</CardTitle>
                    <CardDescription>
                        Update the problem description or technical solution for this specific fault.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <ErrorCodeForm initialData={record} isEdit />
                </CardContent>
            </Card>
        </div>
    );
}

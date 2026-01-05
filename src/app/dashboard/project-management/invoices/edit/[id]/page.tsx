"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { DollarSign, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EditProjectInvoiceForm } from '@/components/forms/project-management';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { SaleDocument as ProjectInvoiceDocument } from '@/types';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { parseISO, isValid } from 'date-fns';

export default function EditProjectInvoicePage() {
    const params = useParams();
    const router = useRouter();
    const invoiceId = params.id as string;

    const [invoiceData, setInvoiceData] = useState<ProjectInvoiceDocument | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInvoiceData = useCallback(async () => {
        if (!invoiceId) {
            setError("No Invoice ID provided.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const docRef = doc(firestore, "project_invoices", invoiceId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as Omit<ProjectInvoiceDocument, 'id'>;
                const processedData: ProjectInvoiceDocument = {
                    ...data,
                    id: docSnap.id,
                    invoiceDate: data.invoiceDate && isValid(parseISO(data.invoiceDate)) ? data.invoiceDate : new Date().toISOString(),
                    lineItems: data.lineItems || [],
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
                    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
                };
                setInvoiceData(processedData);
            } else {
                setError("Invoice record not found.");
                Swal.fire("Error", `Invoice with ID ${invoiceId} not found.`, "error").then(() => {
                    router.push('/dashboard/project-management/invoices');
                });
            }
        } catch (err: any) {
            setError(`Failed to fetch invoice data: ${err.message}`);
            Swal.fire("Error", `Failed to fetch invoice data: ${err.message}`, "error");
        } finally {
            setIsLoading(false);
        }
    }, [invoiceId, router]);

    useEffect(() => {
        fetchInvoiceData();
    }, [fetchInvoiceData]);

    if (isLoading) {
        return (
            <div className="container mx-auto py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading invoice details for ID: {invoiceId}...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto py-8">
                <Card className="max-w-screen-2xl mx-auto shadow-xl border-destructive">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive"><AlertTriangle className="h-7 w-7" />Error Loading Invoice</CardTitle></CardHeader>
                    <CardContent><p className="text-destructive-foreground">{error}</p>
                        <Button variant="outline" asChild className="mt-4"><Link href="/dashboard/project-management/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back to Invoice List</Link></Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!invoiceData) {
        return (
            <div className="container mx-auto py-8 text-center">
                <p className="text-muted-foreground">Invoice data could not be loaded.</p>
                <Button variant="outline" asChild className="mt-4"><Link href="/dashboard/project-management/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back to Invoice List</Link></Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <div className="mb-6"><Link href="/dashboard/project-management/invoices" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Invoice List</Button></Link></div>
            <Card className="max-w-screen-2xl mx-auto shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <DollarSign className="h-7 w-7 text-primary" />Edit Project Invoice
                    </CardTitle>
                    <CardDescription>Modify the details for Invoice ID: <span className="font-semibold text-foreground">{invoiceId}</span>.</CardDescription>
                </CardHeader>
                <CardContent><EditProjectInvoiceForm initialData={invoiceData} invoiceId={invoiceId} /></CardContent>
            </Card>
        </div>
    );
}


"use client";

import React from 'react';
import { ErrorCodeForm } from '@/components/warranty/ErrorCodeForm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FileCode, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AddErrorCodePage() {
    return (
        <div className="max-w-5xl mx-auto py-10 px-4 mb-20">
            <div className="mb-8">
                <Button variant="ghost" size="sm" className="mb-4 text-slate-500 hover:text-primary" asChild>
                    <Link href="/dashboard/warranty-management/error-codes">
                        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Error Codes
                    </Link>
                </Button>

                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <FileCode className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Add New Error Code</h1>
                        <p className="text-slate-500 mt-1">Register a new machine fault and its corresponding solution.</p>
                    </div>
                </div>
            </div>

            <Card className="border-slate-100 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                    <CardTitle className="text-xl font-bold text-slate-800">Fault Registration Form</CardTitle>
                    <CardDescription>
                        Please provide accurate technical details to help service engineers troubleshoot effectively.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <ErrorCodeForm />
                </CardContent>
            </Card>
        </div>
    );
}

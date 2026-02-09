
"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { CatalogueForm } from '@/components/warranty/CatalogueForm';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

export default function AddCataloguePage() {
    const router = useRouter();
    const { userRole } = useAuth();

    useEffect(() => {
        if (userRole && !userRole.includes('Admin') && !userRole.includes('Service') && !userRole.includes('Super Admin') && !userRole.includes('Supervisor')) {
            Swal.fire("Access Denied", "You do not have permission to add catalogues.", "error");
            router.push('/dashboard/warranty-management/machinery-catalogues');
        }
    }, [userRole, router]);

    return (
        <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
            <div className="mb-6 flex items-center justify-between">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="group flex items-center gap-2 hover:bg-slate-100 rounded-full px-4"
                >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Back to Catalogues</span>
                </Button>
            </div>

            <Card className="shadow-2xl border-none overflow-hidden bg-white/80 backdrop-blur-md">
                <CardHeader className="pb-8 border-b border-slate-50">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            <BookOpen className="h-7 w-7" />
                        </div>
                        <div>
                            <CardTitle className={cn(
                                "text-2xl lg:text-3xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text",
                                "hover:tracking-wider transition-all duration-300 ease-in-out"
                            )}>
                                Add New Catalogue
                            </CardTitle>
                            <CardDescription className="text-slate-500 font-medium">Create a new machinery catalogue with technical manuals and videos.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8">
                    <CatalogueForm />
                </CardContent>
            </Card>
        </div>
    );
}

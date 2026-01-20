
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Edit3, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { CatalogueForm } from '@/components/warranty/CatalogueForm';
import { getCatalogueById } from '@/lib/firebase/warranty';
import type { MachineryCatalogue } from '@/types/warranty';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

export default function EditCataloguePage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const { userRole } = useAuth();
    const [catalogue, setCatalogue] = useState<MachineryCatalogue | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userRole && !userRole.includes('Admin') && !userRole.includes('Service') && !userRole.includes('Super Admin')) {
            Swal.fire("Access Denied", "You do not have permission to edit catalogues.", "error");
            router.push('/dashboard/warranty-management/machinery-catalogues');
            return;
        }

        const fetchCatalogue = async () => {
            try {
                const data = await getCatalogueById(id);
                if (data) {
                    setCatalogue(data);
                } else {
                    Swal.fire("Error", "Catalogue not found", "error");
                    router.push('/dashboard/warranty-management/machinery-catalogues');
                }
            } catch (error) {
                console.error("Error fetching catalogue:", error);
                Swal.fire("Error", "Failed to load catalogue data", "error");
            } finally {
                setIsLoading(false);
            }
        };

        if (id) fetchCatalogue();
    }, [userRole, router, id]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-slate-500 font-medium">Loading catalogue details...</p>
            </div>
        );
    }

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
                            <Edit3 className="h-7 w-7" />
                        </div>
                        <div>
                            <CardTitle className={cn(
                                "text-2xl lg:text-3xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text",
                                "hover:tracking-wider transition-all duration-300 ease-in-out"
                            )}>
                                Edit Catalogue
                            </CardTitle>
                            <CardDescription className="text-slate-500 font-medium">Modify existing catalogue details and technical files.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8">
                    {catalogue && <CatalogueForm initialData={catalogue} isEdit={true} />}
                </CardContent>
            </Card>
        </div>
    );
}

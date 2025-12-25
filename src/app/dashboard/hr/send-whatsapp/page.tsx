"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SendWhatsAppForm } from '@/components/forms/common';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function SendWhatsAppPage() {
    const { userRole } = useAuth();
    const router = useRouter();

    // Check if user has Admin or HR role
    React.useEffect(() => {
        if (userRole && !userRole.includes('Admin') && !userRole.includes('HR') && !userRole.includes('Super Admin')) {
            router.push('/dashboard');
        }
    }, [userRole, router]);

    if (!userRole || (!userRole.includes('Admin') && !userRole.includes('HR') && !userRole.includes('Super Admin'))) {
        return null;
    }

    return (
        <div className="container mx-auto py-8 px-6">
            <Card className="max-w-4xl mx-auto shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "text-green-600")}>
                        <Smartphone className="h-7 w-7" />
                        Send WhatsApp to Employees
                    </CardTitle>
                    <CardDescription>
                        Send bulk WhatsApp notifications to employees. You can use variables and emojis.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SendWhatsAppForm />
                </CardContent>
            </Card>
        </div>
    );
}

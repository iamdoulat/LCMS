"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SendEmailForm } from '@/components/forms/SendEmailForm';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function SendEmailPage() {
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
            <Card className="max-w-5xl mx-auto shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <Mail className="h-7 w-7 text-primary" />
                        Send Email to Employees
                    </CardTitle>
                    <CardDescription>
                        Compose and send customized emails to selected employees. You can use variables and attach files.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SendEmailForm />
                </CardContent>
            </Card>
        </div>
    );
}

"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SendNotificationForm } from '@/components/forms/hr/SendNotificationForm';
import { BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PushNotificationsPage() {
    return (
        <div className="container mx-auto py-8 px-[20px]">
            <Card className="max-w-3xl mx-auto shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text")}>
                        <BellRing className="h-7 w-7 text-primary" />
                        Push Notifications
                    </CardTitle>
                    <CardDescription>
                        Send instant push notifications to employees' devices (Web & Mobile).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SendNotificationForm />
                </CardContent>
            </Card>
        </div>
    );
}

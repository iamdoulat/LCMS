"use client";

import { NotificationHistoryList } from '@/components/dashboard/hr/NotificationHistoryList';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SendNotificationForm } from '@/components/forms/hr/SendNotificationForm';
import { BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PushNotificationsPage() {
    return (
        <div className="container mx-auto py-8 px-[20px]">
            <div className="flex flex-col gap-8">
                {/* Header Section */}
                <div>
                    <h1 className={cn("font-bold text-3xl flex items-center gap-2 mb-2", "text-slate-800")}>
                        <BellRing className="h-8 w-8 text-indigo-600" />
                        Push Notifications
                    </h1>
                    <p className="text-slate-500 max-w-2xl">
                        Manage and send push notifications to your employees' devices. View history and delivery status below.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Send Form Column */}
                    <div className="lg:col-span-4">
                        <Card className="shadow-xl border-t-4 border-t-indigo-500/20 top-4 sticky">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold">Send New</CardTitle>
                                <CardDescription>
                                    Compose a message to specific users or roles.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <SendNotificationForm />
                            </CardContent>
                        </Card>
                    </div>

                    {/* History Column */}
                    <div className="lg:col-span-8">
                        <NotificationHistoryList />
                    </div>
                </div>
            </div>
        </div>
    );
}

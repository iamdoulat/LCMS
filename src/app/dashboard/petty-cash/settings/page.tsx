
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
export default function PettyCashSettingsPage() {
    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                        <Settings className="h-7 w-7 text-primary" />
                        Petty Cash Settings
                    </CardTitle>
                    <CardDescription>
                        Manage source accounts and transaction categories for your petty cash.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <p className="text-muted-foreground">Settings for Source Accounts and Categories are under construction.</p>
                </CardContent>
            </Card>
        </div>
    );
}


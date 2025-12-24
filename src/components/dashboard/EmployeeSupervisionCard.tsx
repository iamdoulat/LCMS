"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, ExternalLink } from 'lucide-react';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { EmployeeDocument } from '@/types';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmployeeSupervisionCardProps {
    currentEmployeeId: string;
}

export function EmployeeSupervisionCard({ currentEmployeeId }: EmployeeSupervisionCardProps) {
    // Fetch employees where supervisorId matches currentEmployeeId
    // Note: Compound queries might require an index. If so, filtering client-side might be safer for now if list is small,
    // but "where" clause is better. Let's try the query.
    // We need an index on supervisorId.

    const { data: subordinates, isLoading } = useFirestoreQuery<EmployeeDocument[]>(
        query(
            collection(firestore, 'employees'),
            where('supervisorId', '==', currentEmployeeId)
            // orderBy('firstName') // Might require composite index with supervisorId
        ),
        undefined,
        [`subordinates_${currentEmployeeId}`]
    );

    if (isLoading) {
        return (
            <Card className="h-full">
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        My Team
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Loading team info...</div>
                </CardContent>
            </Card>
        )
    }

    if (!subordinates || subordinates.length === 0) {
        return null; // Don't show card if not a supervisor
    }

    return (
        <Card className="h-full">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className={cn(
                        "text-lg flex items-center gap-2 font-bold",
                        "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
                    )}>
                        <Users className="h-5 w-5 text-primary" />
                        My Team
                    </CardTitle>
                    <Badge variant="secondary">{subordinates.length} Members</Badge>
                </div>
                <CardDescription className="text-xs">Employees reporting to you</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
                <div className="space-y-4">
                    {subordinates.map(emp => (
                        <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border">
                                    <AvatarImage src={emp.photoURL} alt={emp.fullName} />
                                    <AvatarFallback>{emp.fullName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-medium text-sm">{emp.fullName}</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        {emp.designation}
                                        <span className="w-1 h-1 rounded-full bg-border" />
                                        <span className={emp.status === 'Active' ? 'text-green-600' : 'text-red-500'}>{emp.status}</span>
                                    </div>
                                </div>
                            </div>
                            {/* Actions later: View Attendance, Approve Leave */}
                            {/* For now just a placeholder action or link to their profile if we had one for supervisors */}
                        </div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t flex gap-2">
                    <Link href="/dashboard/hr/attendance-reconciliation?view=team" className="w-full">
                        <Button variant="outline" size="sm" className="w-full text-xs h-8">
                            View Attendance Reconciliation
                        </Button>
                    </Link>
                    <Link href="/dashboard/hr/leaves?view=team" className="w-full">
                        <Button variant="outline" size="sm" className="w-full text-xs h-8">
                            Review Leave Requests
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

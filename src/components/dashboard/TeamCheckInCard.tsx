import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, Clock, Building2, LogIn, LogOut } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { EmployeeDocument } from '@/types';
import type { MultipleCheckInOutRecord } from '@/types/checkInOut';
import { format } from 'date-fns';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface TeamCheckInCardProps {
    isSupervisor?: boolean;
    supervisedEmployeeIds?: string[];
}

export function TeamCheckInCard({
    isSupervisor: propIsSupervisor,
    supervisedEmployeeIds: propSupervisedEmployeeIds
}: TeamCheckInCardProps) {
    const { user } = useAuth();
    const supervisorCheck = useSupervisorCheck(user?.email);

    // Use props if provided, otherwise fallback to hook
    const isSupervisor = propIsSupervisor ?? supervisorCheck.isSupervisor;
    const supervisedEmployeeIds = propSupervisedEmployeeIds ?? supervisorCheck.supervisedEmployeeIds;

    const [allRecords, setAllRecords] = useState<MultipleCheckInOutRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'checkin' | 'checkout'>('checkin');

    useEffect(() => {
        const fetchRecentCheckIns = async () => {
            if (!isSupervisor || !supervisedEmployeeIds || supervisedEmployeeIds.length === 0) {
                setIsLoading(false);
                return;
            }

            try {
                // Firestore 'in' operator supports up to 10 values
                const chunkSize = 10;
                const records: MultipleCheckInOutRecord[] = [];

                for (let i = 0; i < supervisedEmployeeIds.length; i += chunkSize) {
                    const chunk = supervisedEmployeeIds.slice(i, i + chunkSize);

                    // Query without orderBy to avoid composite index requirement
                    const q = query(
                        collection(firestore, 'multiple_check_inout'),
                        where('employeeId', 'in', chunk)
                    );

                    const snapshot = await getDocs(q);
                    const fetchedRecords = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as MultipleCheckInOutRecord));

                    records.push(...fetchedRecords);
                }

                // Sort by timestamp descending and take most recent
                records.sort((a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );

                setAllRecords(records);
            } catch (error) {
                console.error('Error fetching team check-ins:', error);
                setAllRecords([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecentCheckIns();
    }, [isSupervisor, supervisedEmployeeIds]);

    if (!isSupervisor) {
        return null; // Don't show if not a supervisor
    }

    const checkInRecords = allRecords.filter(r => r.type === 'Check In').slice(0, 10);
    const checkOutRecords = allRecords.filter(r => r.type === 'Check Out').slice(0, 10);

    const RecordsList = ({ records }: { records: MultipleCheckInOutRecord[] }) => (
        isLoading ? (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        ) : records.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
                No recent records from your team
            </div>
        ) : (
            <div className="space-y-2">
                {records.map((record) => (
                    <div
                        key={record.id}
                        className="flex items-start justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{record.employeeName}</p>
                                <Badge
                                    variant={record.type === 'Check In' ? 'default' : 'secondary'}
                                    className="text-xs"
                                >
                                    {record.type}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                <span>{record.companyName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{format(new Date(record.timestamp), 'PPp')}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )
    );

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className={cn(
                    "text-lg flex items-center gap-2 font-bold",
                    "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
                )}>
                    <MapPin className="h-5 w-5 text-primary" />
                    My Team Check In/Out History
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex gap-2">
                    <Button
                        variant={activeTab === 'checkin' ? 'default' : 'outline'}
                        className={cn(
                            "flex-1 transition-all duration-300",
                            activeTab === 'checkin' && "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        )}
                        onClick={() => setActiveTab('checkin')}
                    >
                        <LogIn className="h-4 w-4 mr-2" />
                        Check In
                    </Button>
                    <Button
                        variant={activeTab === 'checkout' ? 'default' : 'outline'}
                        className={cn(
                            "flex-1 transition-all duration-300",
                            activeTab === 'checkout' && "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        )}
                        onClick={() => setActiveTab('checkout')}
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Check Out
                    </Button>
                </div>

                <div className="mt-4">
                    {activeTab === 'checkin' ? (
                        <RecordsList records={checkInRecords} />
                    ) : (
                        <RecordsList records={checkOutRecords} />
                    )}
                </div>

                <Link href="/dashboard/hr/multiple-check-in-out?view=team" className="w-full block mt-4">
                    <Button variant="outline" size="sm" className="w-full">
                        View All Team Check-Ins
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}

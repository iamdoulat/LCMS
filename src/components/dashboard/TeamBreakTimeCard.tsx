import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Loader2, Coffee, Check, X, Timer, MapPin } from 'lucide-react';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { BreakTimeRecord } from '@/types/breakTime';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { approveBreakRecord, rejectBreakRecord } from '@/lib/firebase/breakTime';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';

interface TeamBreakTimeCardProps {
    supervisedEmployeeIds: string[];
    isSupervisor: boolean;
}

export function TeamBreakTimeCard({ supervisedEmployeeIds, isSupervisor }: TeamBreakTimeCardProps) {
    const { user } = useAuth();
    const [records, setRecords] = useState<BreakTimeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!isSupervisor || supervisedEmployeeIds.length === 0) {
            setLoading(false);
            return;
        }

        const chunkSize = 10;
        const unsubscribes: (() => void)[] = [];

        const fetchChunks = () => {
            const allFetchedRecords: Record<string, BreakTimeRecord> = {};

            for (let i = 0; i < supervisedEmployeeIds.length; i += chunkSize) {
                const chunk = supervisedEmployeeIds.slice(i, i + chunkSize);
                const q = query(
                    collection(firestore, 'break_time'),
                    where('employeeId', 'in', chunk),
                    where('status', 'in', ['pending', 'approved', 'auto-approved'])
                );

                const unsub = onSnapshot(q, (snapshot) => {
                    snapshot.docs.forEach(doc => {
                        allFetchedRecords[doc.id] = { id: doc.id, ...doc.data() } as BreakTimeRecord;
                    });

                    const sorted = Object.values(allFetchedRecords)
                        .filter(r => {
                            // Only show today's breaks or active breaks
                            const today = format(new Date(), 'yyyy-MM-dd');
                            return r.date === today || r.onBreak;
                        })
                        .sort((a, b) => {
                            const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
                            const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
                            return bTime - aTime;
                        });

                    setRecords(sorted);
                    setLoading(false);
                });
                unsubscribes.push(unsub);
            }
        };

        fetchChunks();
        return () => unsubscribes.forEach(unsub => unsub());
    }, [isSupervisor, supervisedEmployeeIds]);

    const formatElapsedTime = (startTime?: string) => {
        if (!startTime) return "00:00:00";
        const start = new Date(startTime);
        const diff = Math.max(0, currentTime.getTime() - start.getTime());
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleApprove = async (id: string) => {
        if (!user) return;
        try {
            await approveBreakRecord(id, user.uid);
            Swal.fire({ title: 'Approved', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (error: any) {
            Swal.fire('Error', error.message, 'error');
        }
    };

    const handleReject = async (id: string) => {
        if (!user) return;
        const { value: reason } = await Swal.fire({
            title: 'Reject Break?',
            input: 'text',
            inputLabel: 'Reason for rejection',
            showCancelButton: true,
            inputValidator: (value) => !value ? 'Reason is required!' : null
        });
        if (reason) {
            try {
                await rejectBreakRecord(id, user.uid, reason);
                Swal.fire({ title: 'Rejected', icon: 'info', timer: 1500, showConfirmButton: false });
            } catch (error: any) {
                Swal.fire('Error', error.message, 'error');
            }
        }
    };

    const handleViewLocation = (location: { latitude: number; longitude: number; address?: string } | undefined | null) => {
        if (!location?.latitude || !location?.longitude) {
            Swal.fire("Location Not Available", "No coordinates were captured.", "info");
            return;
        }
        const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
        window.open(url, '_blank');
    };

    if (!isSupervisor) return null;

    return (
        <Card className="shadow-xl">
            <CardHeader className="pb-3 border-b">
                <CardTitle className={cn(
                    "text-xl flex items-center gap-2 font-bold",
                    "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text"
                )}>
                    <Coffee className="h-6 w-6 text-primary" />
                    My Team Break Times
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-4 py-3">Employee</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Timer/Duration</th>
                                <th className="px-4 py-3">Loc</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                        No team members on break today.
                                    </td>
                                </tr>
                            ) : (
                                records.map((rec) => (
                                    <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{rec.employeeName}</div>
                                            <div className="text-xs text-muted-foreground">{rec.employeeCode}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {rec.onBreak ? (
                                                <Badge className="bg-orange-500 hover:bg-orange-600 animate-pulse">On Break</Badge>
                                            ) : (
                                                <Badge variant={rec.status === 'approved' || rec.status === 'auto-approved' ? 'default' : 'secondary'}>
                                                    {rec.status.toUpperCase()}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono font-semibold">
                                            {rec.onBreak ? (
                                                <div className="flex items-center gap-1 text-orange-600">
                                                    <Timer className="h-3 w-3" />
                                                    {formatElapsedTime(rec.startTime)}
                                                </div>
                                            ) : (
                                                <div className="text-muted-foreground">
                                                    {rec.durationMinutes} mins
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                {rec.locationStart && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 p-0" onClick={() => handleViewLocation(rec.locationStart)} title="Start Location">
                                                        <MapPin className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                {rec.locationEnd && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-600 p-0" onClick={() => handleViewLocation(rec.locationEnd)} title="Stop Location">
                                                        <MapPin className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                {!rec.locationStart && !rec.locationEnd && (
                                                    <span className="text-muted-foreground text-[10px] italic">N/A</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {rec.status === 'pending' && !rec.onBreak && (
                                                <div className="flex justify-end gap-1">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => rec.id && handleApprove(rec.id)}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => rec.id && handleReject(rec.id)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

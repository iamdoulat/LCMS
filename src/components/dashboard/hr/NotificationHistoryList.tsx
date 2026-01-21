"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, startAfter, getDocs, deleteDoc, doc, Timestamp, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Calendar, Trash2, Users, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';

interface PushNotification {
    id: string;
    title: string;
    body: string;
    sentAt: Timestamp;
    successCount: number;
    failureCount: number;
    targetRoles?: string[];
    userIds?: string[];
    totalTokens?: number;
}

const ITEMS_PER_PAGE = 20;

export function NotificationHistoryList() {
    const [notifications, setNotifications] = useState<PushNotification[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedNotification, setSelectedNotification] = useState<PushNotification | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Simplistic pagination approach:
    // For "Next", we use startAfter(lastDoc).
    // For "Prev", strict Firestore pagination is hard without keeping track of all page starts.
    // For this requirement ("per page will show 10"), simple "Load More" or basics is often enough.
    // However, to support standard prev/next, we'd need to cache page cursors.
    // Let's implement a simple "Load More" or "Next/Prev" if we maintain a stack of cursors.
    // Given the request implies a standard list, let's try a simple "Next" / "Prev" by keeping an array of start docs?
    // Or just simple standard query with limit. 

    // Actually, for "per page", let's use a simpler approach: 
    // Fetch generic 'limit' and handle 'next' using the last doc of current list.
    // Handling 'prev' in Firestore is tricky without snapping.
    // Let's stick to "Next" / "Prev" using a cursor stack for now, or just "Next" (Load More) style if acceptable?
    // The prompt says "per page will show 10", implying pagination.

    // Let's implement a simple cursor-based pagination.
    const [pageCursors, setPageCursors] = useState<any[]>([null]); // Index 0 is null (start)

    const fetchNotifications = async (cursor: any = null) => {
        setLoading(true);
        try {
            let q = query(
                collection(firestore, 'push_notifications'),
                orderBy('sentAt', 'desc'),
                limit(ITEMS_PER_PAGE)
            );

            if (cursor) {
                q = query(
                    collection(firestore, 'push_notifications'),
                    orderBy('sentAt', 'desc'),
                    startAfter(cursor),
                    limit(ITEMS_PER_PAGE)
                );
            }

            const snapshot = await getDocs(q);
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PushNotification));

            setNotifications(items);
            setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);

            // Only update lastDoc if we have items
            if (snapshot.docs.length > 0) {
                setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications(pageCursors[page - 1]);
    }, [page]);

    const handleNext = () => {
        if (!hasMore) return;
        // Save current last doc as the start for next page
        const newCursors = [...pageCursors];
        // If we haven't visited this page before, add the cursor
        if (newCursors.length === page) {
            newCursors.push(lastDoc);
        }
        setPageCursors(newCursors);
        setPage(p => p + 1);
    };

    const handlePrev = () => {
        if (page === 1) return;
        setPage(p => p - 1);
    };

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(firestore, 'push_notifications', id));
                setNotifications(prev => prev.filter(n => n.id !== id));
                Swal.fire('Deleted!', 'Notification has been deleted.', 'success');
            } catch (error) {
                console.error("Error deleting:", error);
                Swal.fire('Error', 'Failed to delete notification.', 'error');
            }
        }
    };

    return (
        <Card className="shadow-lg h-full border-t-4 border-t-primary/20">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-slate-500" />
                    Notification History
                </CardTitle>
                <CardDescription>
                    Recent push notifications sent to devices.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                            <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p>No history found.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notifications.map((item) => (
                                <div key={item.id} className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-700 p-1.5 rounded-lg">
                                                <Bell className="h-4 w-4" />
                                            </span>
                                            <div>
                                                <h4 className="font-semibold text-sm line-clamp-1">{item.title}</h4>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                    <span>{item.sentAt ? format(item.sentAt.toDate(), "MMM d, yyyy h:mm a") : 'Unknown Date'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-blue-600"
                                                onClick={() => setSelectedNotification(item)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                                onClick={() => handleDelete(item.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-600 line-clamp-2 mb-3 pl-[3rem]">
                                        {item.body}
                                    </p>

                                    <div className="flex items-center justify-between pl-[3rem] text-xs">
                                        <div className="flex gap-3">
                                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                                <CheckCircle2 className="h-3 w-3" /> {item.successCount}
                                            </span>
                                            {(item.failureCount > 0) && (
                                                <span className="flex items-center gap-1 text-rose-500 font-medium">
                                                    <XCircle className="h-3 w-3" /> {item.failureCount}
                                                </span>
                                            )}
                                        </div>
                                        <Badge variant="outline" className="text-[10px] font-normal text-slate-500">
                                            {item.targetRoles ? `${item.targetRoles.length} Roles` : item.userIds ? `${item.userIds.length} Users` : 'All'}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between pt-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrev}
                            disabled={page === 1 || loading}
                            className="gap-1"
                        >
                            <ChevronLeft className="h-4 w-4" /> Prev
                        </Button>
                        <span className="text-xs text-slate-500 font-medium">Page {page}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNext}
                            disabled={!hasMore || loading}
                            className="gap-1"
                        >
                            Next <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Details Dialog */}
                <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Notification Details</DialogTitle>
                            <DialogDescription>
                                Sent on {selectedNotification?.sentAt ? format(selectedNotification.sentAt.toDate(), "PPP pp") : ''}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Title</label>
                                <div className="p-3 bg-slate-50 rounded-lg text-sm font-medium border">
                                    {selectedNotification?.title}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Message Body</label>
                                <div className="p-3 bg-slate-50 rounded-lg text-sm border min-h-[80px] whitespace-pre-wrap">
                                    {selectedNotification?.body}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Target Audience</label>
                                    <div className="text-sm">
                                        {selectedNotification?.targetRoles ? (
                                            <div className="flex flex-wrap gap-1">
                                                {selectedNotification.targetRoles.map(r => (
                                                    <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                                                ))}
                                            </div>
                                        ) : selectedNotification?.userIds ? (
                                            <span className="text-slate-600">{selectedNotification.userIds.length} Specific Users</span>
                                        ) : (
                                            <span className="text-slate-600">All Users (Legacy)</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Delivery Status</label>
                                    <div className="flex flex-col gap-1 text-sm">
                                        <span className="text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> {selectedNotification?.successCount} Success
                                        </span>
                                        <span className="text-rose-600 flex items-center gap-1">
                                            <XCircle className="h-3 w-3" /> {selectedNotification?.failureCount} Failed
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}


"use client";

import React, { useEffect, useState } from 'react';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    arrayUnion,
    getDoc,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { DeviceChangeRequest, UserDocumentForAdmin, AllowedDevice } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, Search, Smartphone } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from '@/components/ui/use-toast';

export default function DeviceChangeRequestsPage() {
    const { user: currentUser } = useAuth();
    const [requests, setRequests] = useState<DeviceChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Cache for user allowed devices to avoid repetitive fetching
    // Key: userId, Value: AllowedDevice[]
    const [userDevices, setUserDevices] = useState<Record<string, AllowedDevice[]>>({});

    useEffect(() => {
        // Subscribe to requests in real-time
        const q = query(collection(firestore, 'device_change_requests'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const reqs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as DeviceChangeRequest[];

            setRequests(reqs);

            // Fetch user docs for any *new* userIds we don't have yet
            // (Or just refetch all to be safe for "Current Device" updates)
            const userIds = Array.from(new Set(reqs.map(r => r.userId)));
            const newUserDevices: Record<string, AllowedDevice[]> = {};

            await Promise.all(userIds.map(async (uid) => {
                try {
                    const userDoc = await getDoc(doc(firestore, 'users', uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data() as UserDocumentForAdmin;
                        newUserDevices[uid] = userData.allowedDevices || [];
                    }
                } catch (e) {
                    console.error("Error fetching user device info:", e);
                }
            }));

            setUserDevices(newUserDevices);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleApprove = async (request: DeviceChangeRequest) => {
        if (!currentUser) return;

        try {
            // 1. Add device to user's allowedDevices - REPLACING old devices as per requirement
            const userRef = doc(firestore, 'users', request.userId);
            const newDevice: AllowedDevice = {
                deviceId: request.deviceId,
                deviceName: request.deviceName,
                registeredAt: Timestamp.now()
            };

            await updateDoc(userRef, {
                allowedDevices: [newDevice] // Replaces any existing devices
            });

            // 2. Update request status
            const reqRef = doc(firestore, 'device_change_requests', request.id);
            await updateDoc(reqRef, {
                status: 'accepted',
                registeredEmployee: currentUser.displayName || 'Admin',
                reviewedBy: currentUser.uid,
                reviewedAt: serverTimestamp()
            });

            toast({
                title: "Request Approved",
                description: `Device for ${request.userName} has been authorized.`,
                variant: 'default'
            });

        } catch (error) {
            console.error("Error approving request:", error);
            toast({
                title: "Error",
                description: "Failed to approve request.",
                variant: "destructive"
            });
        }
    };

    const handleReject = async (request: DeviceChangeRequest) => {
        if (!currentUser) return;

        // Confirm rejection
        const result = await Swal.fire({
            title: 'Reject Request?',
            text: "The user will not be able to login from this device.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, reject it!'
        });

        if (!result.isConfirmed) return;

        try {
            const reqRef = doc(firestore, 'device_change_requests', request.id);
            await updateDoc(reqRef, {
                status: 'rejected',
                registeredEmployee: currentUser.displayName || 'Admin',
                reviewedBy: currentUser.uid,
                reviewedAt: serverTimestamp()
            });
            toast({
                title: "Request Rejected",
                description: "Device request has been rejected.",
                variant: 'default'
            });
        } catch (error) {
            console.error("Error rejecting request:", error);
            toast({
                title: "Error",
                description: "Failed to reject request.",
                variant: "destructive"
            });
        }
    };

    const filteredRequests = requests.filter(req =>
        req.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination could be added here, but for now we'll show all

    // Formatting helper
    const getDeviceString = (device: AllowedDevice) => {
        // Example: "276b6... (ANDROID)"
        // shorten ID
        const shortId = device.deviceId.substring(0, 8);
        return `${shortId}... (${device.deviceName})`; // rough approximation of screenshot style
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-primary">Device Change Requests</h2>
            </div>
            <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search requests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 w-[150px] lg:w-[250px]"
                />
            </div>

            <Card className="border-t-4 border-t-primary shadow-md">
                <CardHeader>
                    {/* <CardTitle>Requests List</CardTitle> */}
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Requested Employee</TableHead>
                                        <TableHead>Current Device</TableHead>
                                        <TableHead>Requested Device</TableHead>
                                        <TableHead>Registered Employee</TableHead>
                                        <TableHead>Request Status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRequests.map((req) => {
                                        const devices = userDevices[req.userId] || [];
                                        const currentDeviceStr = devices.length > 0
                                            ? devices.map(d => getDeviceString(d)).join(', ') // Or just list them
                                            : "N/A (N/A)";

                                        // Specific formatting for "Current Device" based on screenshot: 
                                        // It seems to show one line? If multiple, maybe just the first or "Multiple"?
                                        // For now, listing all might be too long. Let's show the most recent one or just the first.
                                        // Or better, map all of them.

                                        return (
                                            <TableRow key={req.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{req.userName}</span>
                                                        <span className="text-xs text-muted-foreground">{req.userEmail}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={currentDeviceStr}>
                                                    {devices.length > 0 ? (
                                                        <div className="flex flex-col space-y-1">
                                                            {devices.map((d, idx) => (
                                                                <span key={idx} className="text-xs">{d.deviceId.substring(0, 12)} ({d.deviceName})</span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">N/A (N/A)</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">{req.deviceId.substring(0, 12)}</span>
                                                        <span className="text-xs text-muted-foreground">({req.deviceName})</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {req.registeredEmployee || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={req.status === 'accepted' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}
                                                        className={req.status === 'accepted' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                                                    >
                                                        {req.status === 'accepted' ? 'Accepted' : req.status === 'rejected' ? 'Rejected' : 'Pending'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {req.status === 'pending' ? (
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                                                onClick={() => handleApprove(req)}
                                                                title="Approve"
                                                            >
                                                                <Check className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                                onClick={() => handleReject(req)}
                                                                title="Reject"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {filteredRequests.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                No requests found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

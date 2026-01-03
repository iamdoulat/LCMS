
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
import { cn } from '@/lib/utils';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Check, X, Search, Smartphone, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from '@/components/ui/use-toast';

export default function DeviceChangeRequestsPage() {
    const { user: currentUser } = useAuth();
    const [requests, setRequests] = useState<DeviceChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [featureEnabled, setFeatureEnabled] = useState(true);

    // Cache for user allowed devices to avoid repetitive fetching
    // Key: userId, Value: AllowedDevice[]
    const [userDevices, setUserDevices] = useState<Record<string, AllowedDevice[]>>({});

    const fetchRequests = () => {
        setLoading(true);
        // Subscribe to requests in real-time
        // Removed orderBy to rule out missing index issues. We sort client-side instead.
        const q = query(collection(firestore, 'device_change_requests'));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const reqs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as DeviceChangeRequest[];

            // Sort client-side
            const sortedReqs = [...reqs].sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });

            setRequests(sortedReqs);
            setLoading(false);

            // Fetch user docs without blocking the main render
            const userIds = Array.from(new Set(reqs.map(r => r.userId)));
            const newUserDevices: Record<string, AllowedDevice[]> = { ...userDevices };
            let updated = false;

            for (const uid of userIds) {
                if (!newUserDevices[uid]) {
                    try {
                        const userDoc = await getDoc(doc(firestore, 'users', uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data() as UserDocumentForAdmin;
                            newUserDevices[uid] = userData.allowedDevices || [];
                            updated = true;
                        }
                    } catch (e) {
                        console.error("Error fetching user device info:", e);
                    }
                }
            }

            if (updated) {
                setUserDevices(newUserDevices);
            }
        }, (error) => {
            console.error("Firestore onSnapshot error:", error);
            setLoading(false);
            toast({
                title: "Connection Error",
                description: "Failed to listen for updates. " + error.message,
                variant: "destructive"
            });
        });

        return unsubscribe;
    };

    useEffect(() => {
        const unsubscribe = fetchRequests();
        return () => unsubscribe();
    }, []);

    // Listen to feature toggle setting
    useEffect(() => {
        const settingsRef = doc(firestore, 'system_settings', 'device_change_feature');
        const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                setFeatureEnabled(snapshot.data().enabled ?? true);
            }
        }, (error) => {
            console.error('Error listening to feature toggle:', error);
        });
        return () => unsubscribe();
    }, []);

    const handleToggleFeature = async (enabled: boolean) => {
        if (!currentUser) return;

        // Optimistic update - immediately update UI
        setFeatureEnabled(enabled);

        try {
            const settingsRef = doc(firestore, 'system_settings', 'device_change_feature');
            await updateDoc(settingsRef, {
                enabled,
                updatedBy: currentUser.uid,
                updatedAt: serverTimestamp()
            });
            toast({
                title: enabled ? 'Feature Enabled' : 'Feature Disabled',
                description: `Device change requests are now ${enabled ? 'enabled' : 'disabled'} for employees.`,
            });
        } catch (error: any) {
            console.error('Error updating feature toggle:', error);
            // Revert optimistic update on error
            setFeatureEnabled(!enabled);
            toast({
                title: 'Error',
                description: error.message || 'Failed to update setting.',
                variant: 'destructive'
            });
        }
    };

    const handleApprove = async (request: DeviceChangeRequest) => {
        if (!currentUser) return;

        try {
            // 1. Add device to user's allowedDevices - REPLACING old devices as per requirement
            const userRef = doc(firestore, 'users', request.userId);
            const newDevice: AllowedDevice = {
                deviceId: request.deviceId,
                deviceName: request.deviceName,
                browser: request.browser,
                os: request.os,
                deviceType: request.deviceType,
                brand: request.brand,
                model: request.model,
                userAgent: request.userAgent,
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
        (req.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination
    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

    // Formatting helper
    const getDeviceString = (device: AllowedDevice | DeviceChangeRequest) => {
        const parts = [];
        if (device.brand && device.model) {
            parts.push(`${device.brand} ${device.model}`);
        } else if (device.deviceName) {
            parts.push(device.deviceName);
        }

        const details = [device.browser, device.os].filter(Boolean).join(' on ');
        if (details) parts.push(`(${details})`);

        const type = device.deviceType ? `[${device.deviceType}]` : '';
        if (type) parts.push(type);

        return parts.join(' ') || 'Unknown Device';
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-primary">Device Change Requests</h2>
            </div>
            <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search requests..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8 w-[150px] lg:w-[250px]"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 border rounded-md px-3 py-1.5">
                        <Label htmlFor="feature-toggle" className="text-sm font-medium cursor-pointer">
                            Device Change Requests
                        </Label>
                        <Switch
                            id="feature-toggle"
                            checked={featureEnabled}
                            onCheckedChange={handleToggleFeature}
                        />
                        <span className={cn("text-xs font-semibold", featureEnabled ? "text-green-600" : "text-red-600")}>
                            {featureEnabled ? 'ON' : 'OFF'}
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setRequests([]);
                            setLoading(true);
                            window.location.reload();
                        }}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
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
                                    {paginatedRequests.map((req) => {
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
                                                <TableCell className="max-w-[200px]">
                                                    {devices.length > 0 ? (
                                                        <div className="flex flex-col space-y-1">
                                                            {devices.map((d, idx) => (
                                                                <div key={idx} className="flex flex-col text-xs border-b last:border-0 pb-1 last:pb-0">
                                                                    <span className="font-semibold">{getDeviceString(d)}</span>
                                                                    <span className="text-muted-foreground text-[10px]">ID: {d.deviceId.substring(0, 8)}...</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">None</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">{getDeviceString(req)}</span>
                                                        <span className="text-xs text-muted-foreground">{req.deviceId.substring(0, 12)}...</span>
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
                                    {paginatedRequests.length === 0 && (
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

                    {/* Pagination Controls */}
                    {filteredRequests.length > 0 && (
                        <div className="flex items-center justify-between mt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {startIndex + 1}-{Math.min(endIndex, filteredRequests.length)} of {filteredRequests.length} requests
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>
                                <div className="text-sm font-medium">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

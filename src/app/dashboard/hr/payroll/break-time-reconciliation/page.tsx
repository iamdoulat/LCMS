"use client";

import React, { useState, useEffect } from 'react';
import {
    getAllBreakRecords,
    approveBreakRecord,
    rejectBreakRecord
} from '@/lib/firebase/breakTime';
import { BreakTimeRecord } from '@/types/breakTime';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useSupervisorCheck } from '@/hooks/useSupervisorCheck';
import { useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';
import { Loader2, Check, X, Search, MoreHorizontal, ChevronLeft, ChevronRight, Info, Coffee, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';

const formatDisplayDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return format(date, 'PPP');
    } catch (error) {
        return 'Invalid Date';
    }
};

const formatDisplayTime = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return format(date, 'hh:mm a');
    } catch (error) {
        return '-';
    }
};

export default function BreakTimeReconciliationPage() {
    const { user, userRole } = useAuth();
    const { isSupervisor, supervisedEmployeeIds } = useSupervisorCheck(user?.email);
    const searchParams = useSearchParams();
    const isTeamView = searchParams.get('view') === 'team';
    const isHROrAdmin = userRole?.some(role => ['Super Admin', 'Admin', 'HR'].includes(role));

    const [records, setRecords] = useState<BreakTimeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'auto-approved'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [processing, setProcessing] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all records and filter client-side to avoid complex index requirements
            const data = await getAllBreakRecords('all');
            setRecords(data);
        } catch (error) {
            console.error("Error fetching break records:", error);
            Swal.fire("Error", "Failed to load break records. Please check your connection.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []); // Only fetch once or when explicitly called

    const toggleSelect = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedIds(newSet);
    };

    const handleApprove = async (id: string) => {
        if (!user) return;
        try {
            setProcessing(true);
            await approveBreakRecord(id, user.uid);
            await Swal.fire({
                title: "Approved",
                text: "Break request approved successfully.",
                icon: "success",
                timer: 1500,
                showConfirmButton: false
            });
            fetchData();
        } catch (error) {
            Swal.fire("Error", "Failed to approve break.", "error");
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async (id: string) => {
        if (!user) return;
        try {
            const { value: reason } = await Swal.fire({
                title: 'Reject Break Request',
                input: 'text',
                inputLabel: 'Reason for rejection',
                inputPlaceholder: 'Enter reason...',
                showCancelButton: true,
                inputValidator: (value) => !value ? 'Reason is required!' : null
            });

            if (!reason) return;

            setProcessing(true);
            await rejectBreakRecord(id, user.uid);
            // In a real app, we'd also save the reason, but for now just notify
            await Swal.fire({
                title: "Rejected",
                text: "Break request rejected.",
                icon: "info",
                timer: 1500,
                showConfirmButton: false
            });
            fetchData();
        } catch (error) {
            Swal.fire("Error", "Failed to reject break.", "error");
        } finally {
            setProcessing(false);
        }
    };

    const filteredRecords = records.filter(r => {
        // First filter by status
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;

        // Then filter by search term
        const searchTermLower = searchTerm.toLowerCase();
        const matchesSearch = r.employeeName.toLowerCase().includes(searchTermLower) ||
            r.employeeCode.toLowerCase().includes(searchTermLower);

        if (!matchesSearch) return false;

        // Finally filter by role/permissions
        if (isTeamView && isSupervisor) {
            return supervisedEmployeeIds.includes(r.employeeId);
        }

        if (isHROrAdmin) return true;
        if (isSupervisor) return supervisedEmployeeIds.includes(r.employeeId);

        return false;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleViewLocation = (location: { latitude: number; longitude: number; address?: string } | undefined | null) => {
        if (!location?.latitude || !location?.longitude) {
            Swal.fire("Location Not Available", "No coordinates were captured for this event.", "info");
            return;
        }
        const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
        window.open(url, '_blank');
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Break Time Reconciliation</h1>
                    <p className="text-muted-foreground">Manage and review employee break time requests.</p>
                </div>
            </div>

            {(isTeamView || (!isHROrAdmin && isSupervisor)) && (
                <Alert className="mb-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        You are viewing break requests from your team members only.
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search employee..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-[250px]"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="auto-approved">Auto Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="all">All Records</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No break records found.</div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Start Time</TableHead>
                                        <TableHead>End Time</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedRecords.map(rec => (
                                        <TableRow key={rec.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{rec.employeeName}</span>
                                                    <span className="text-xs text-muted-foreground">{rec.employeeCode}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{formatDisplayDate(rec.startTime)}</TableCell>
                                            <TableCell>{formatDisplayTime(rec.startTime)}</TableCell>
                                            <TableCell>{formatDisplayTime(rec.endTime)}</TableCell>
                                            <TableCell>
                                                {rec.durationMinutes ? `${rec.durationMinutes} mins` : rec.onBreak ? (
                                                    <Badge variant="outline" className="animate-pulse flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> In Progress
                                                    </Badge>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {rec.locationStart && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            onClick={() => handleViewLocation(rec.locationStart)}
                                                            title="View Start Location"
                                                        >
                                                            <MapPin className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {rec.locationEnd && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                            onClick={() => handleViewLocation(rec.locationEnd)}
                                                            title="View Stop Location"
                                                        >
                                                            <MapPin className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {!rec.locationStart && !rec.locationEnd && (
                                                        <span className="text-muted-foreground text-xs italic">N/A</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    rec.status === 'approved' || rec.status === 'auto-approved' ? 'default' :
                                                        rec.status === 'rejected' ? 'destructive' : 'secondary'
                                                }>
                                                    {rec.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {rec.status === 'pending' && !rec.onBreak && (
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600 hover:text-green-700" onClick={() => rec.id && handleApprove(rec.id)}>
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" onClick={() => rec.id && handleReject(rec.id)}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                                {rec.onBreak && <span className="text-xs italic text-muted-foreground">Active</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center space-x-2 py-4 mt-4">
                            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                                <ChevronLeft className="h-4 w-4" /> Previous
                            </Button>
                            <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                                Next <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

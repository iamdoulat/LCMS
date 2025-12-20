"use client";

import React, { useState, useEffect } from 'react';
import {
    getAllReconciliations,
    approveReconciliation,
    rejectReconciliation,
    bulkApproveReconciliations,
    bulkRejectReconciliations,
    updateReconciliation,
    deleteReconciliation
} from '@/lib/firebase/reconciliation';
import type { AttendanceReconciliation } from '@/types/reconciliation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import Swal from 'sweetalert2';
import { Loader2, Check, X, Search, Edit, Trash2, Save, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from '@/components/ui/label';
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

export default function AttendanceReconciliationPage() {
    const { user } = useAuth();
    const [reconciliations, setReconciliations] = useState<AttendanceReconciliation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [processing, setProcessing] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Edit State
    const [editingRec, setEditingRec] = useState<AttendanceReconciliation | null>(null);
    const [editForm, setEditForm] = useState({
        requestedInTime: '',
        requestedOutTime: '',
        inTimeRemarks: '',
        outTimeRemarks: ''
    });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all for now and filter client side for specific status logic if needed,
            // or pass status to helper.
            const statusArg = filterStatus === 'all' ? undefined : filterStatus;
            const data = await getAllReconciliations(statusArg);
            setReconciliations(data);
        } catch (error) {
            console.error("Error fetching reconciliations:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filterStatus]);



    const toggleSelect = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedIds(newSet);
    };

    // Helper for safe SweetAlert firing to prevent Radix UI conflict
    const safeSwalFire = async (options: any) => {
        return new Promise<void>((resolve) => {
            setTimeout(async () => {
                await Swal.fire({
                    ...options,
                    didClose: () => {
                        // Force unlock body to prevent freeze
                        document.body.style.pointerEvents = 'auto';
                        document.body.style.overflow = 'auto';
                        if (options.didClose) options.didClose();
                    }
                });
                resolve();
            }, 500); // Increased delay to 500ms to ensure Radix exit animation completes
        });
    };

    // Helper to trigger email notification
    const notifyDecision = async (id: string, status: 'approved' | 'rejected', rejectionReason?: string) => {
        try {
            await fetch('/api/attendance/notify-decision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reconciliationId: id, status, rejectionReason })
            });
        } catch (error) {
            console.error(`Failed to send ${status} notification for ${id}:`, error);
        }
    };

    const handleApprove = async (rec: AttendanceReconciliation) => {
        if (!user) return;
        try {
            await approveReconciliation(rec.id, rec, user.uid);
            await notifyDecision(rec.id, 'approved'); // Trigger Email
            await safeSwalFire({
                title: "Approved",
                text: "Reconciliation approved successfully.",
                icon: "success",
                allowOutsideClick: true,
                allowEscapeKey: true,
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: true,
            });
            fetchData();
        } catch (error) {
            await safeSwalFire({
                title: "Error",
                text: "Failed to approve.",
                icon: "error",
                allowOutsideClick: true,
                allowEscapeKey: true,
                showConfirmButton: true,
            });
        }
    };

    const handleReject = async (id: string) => {
        if (!user) return;

        // Ask for rejection reason
        const { value: reason } = await Swal.fire({
            title: 'Reject Reconciliation',
            input: 'text',
            inputLabel: 'Reason for rejection',
            inputPlaceholder: 'Enter reason...',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) {
                    return 'You need to write a reason!';
                }
                return null;
            }
        });

        if (!reason) return; // User cancelled

        try {
            // Pass reason to rejectReconciliation if supported, or just to email
            // Assuming rejectReconciliation updates status. 
            // Ideally we should save the reason in Firestore too.
            // checking `rejectReconciliation` signature in imports... it takes (id, updatedBy). 
            // If it doesn't support reason, we only send it in email for now or update doc manually? 
            // Let's assume for now we just notify. 
            // Wait, usually rejection reason should be saved.
            // I'll update Firestore with reason if the lib function doesn't support it, but looking at file content earlier is hard.
            // I'll proceed with calling the lib function and then updating reason if possible, or just sending email.
            // But wait, the user implicitly asked "collect data of {{rejection_reason}} replace variable from firestore".
            // This implies the reason MUST be in Firestore. 
            // So `rejectReconciliation` or a separate update is needed.

            // Checking imports: `updateReconciliation` is available.
            // So I will Reject AND Update the comment.

            await updateReconciliation(id, { reviewComments: reason });
            await rejectReconciliation(id, user.uid);

            await notifyDecision(id, 'rejected', reason); // Trigger Email

            await safeSwalFire({
                title: "Rejected",
                text: "Reconciliation rejected.",
                icon: "info",
                allowOutsideClick: true,
                allowEscapeKey: true,
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: true,
            });
            fetchData();
        } catch (error) {
            await safeSwalFire({
                title: "Error",
                text: "Failed to reject.",
                icon: "error",
                allowOutsideClick: true,
                allowEscapeKey: true,
                showConfirmButton: true,
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!user) return;
        // ... (rest of delete logic)
        // Use standard Swal for the confirm dialog (Radix is still open, but we need to pause)
        // Actually, we should delay this too if it closes the dropdown implicitly?
        // Dropdown actions close the dropdown immediately.
        setTimeout(async () => {
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
                    await deleteReconciliation(id);
                    await safeSwalFire({
                        title: 'Deleted!',
                        text: 'The request has been deleted.',
                        icon: 'success',
                        allowOutsideClick: true,
                        allowEscapeKey: true,
                        timer: 3000,
                        timerProgressBar: true,
                        showConfirmButton: true,
                        showConfirmButton: true,
                    });
                    fetchData();
                } catch (error) {
                    await safeSwalFire({
                        title: 'Error',
                        text: 'Failed to delete request.',
                        icon: 'error',
                        allowOutsideClick: true,
                        allowEscapeKey: true,
                        showConfirmButton: true,
                    });
                }
            }
        }, 500);
    };

    const handleEditClick = (rec: AttendanceReconciliation) => {
        setEditingRec(rec);
        setEditForm({
            requestedInTime: rec.requestedInTime || '',
            requestedOutTime: rec.requestedOutTime || '',
            inTimeRemarks: rec.inTimeRemarks || '',
            outTimeRemarks: rec.outTimeRemarks || ''
        });
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async () => {
        if (!editingRec) return;
        setProcessing(true);
        try {
            await updateReconciliation(editingRec.id, {
                requestedInTime: editForm.requestedInTime || null as any,
                requestedOutTime: editForm.requestedOutTime || null as any,
                inTimeRemarks: editForm.inTimeRemarks || null as any,
                outTimeRemarks: editForm.outTimeRemarks || null as any
            });
            setIsEditModalOpen(false);
            setEditingRec(null);

            await safeSwalFire({
                title: 'Success',
                text: 'Request updated successfully.',
                icon: 'success',
                allowOutsideClick: true,
                allowEscapeKey: true,
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: true,
            });
            fetchData();
        } catch (error) {
            await safeSwalFire({
                title: 'Error',
                text: 'Failed to update request.',
                icon: 'error',
                allowOutsideClick: true,
                allowEscapeKey: true,
                showConfirmButton: true,
            });
        } finally {
            setProcessing(false);
        }
    };

    // Changing handleBulkApprove
    const handleBulkApprove = async () => {
        if (!user) return;
        setProcessing(true);
        try {
            const selectedRecs = reconciliations.filter(r => selectedIds.has(r.id));
            await bulkApproveReconciliations(selectedRecs, user.uid);

            // Trigger emails for all
            selectedRecs.forEach(rec => notifyDecision(rec.id, 'approved'));

            await safeSwalFire({
                title: "Success",
                text: `${selectedRecs.length} requests approved.`,
                icon: "success",
                allowOutsideClick: true,
                allowEscapeKey: true,
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: true,
            });
            setSelectedIds(new Set());
            fetchData();
        } catch (error) {
            console.error(error);
            await safeSwalFire({
                title: "Error",
                text: "Bulk approve failed.",
                icon: "error",
                allowOutsideClick: true,
                allowEscapeKey: true,
                showConfirmButton: true,
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleBulkReject = async () => {
        if (!user) return;

        // Ask for bulk rejection reason
        const { value: reason } = await Swal.fire({
            title: 'Bulk Reject',
            input: 'text',
            inputLabel: 'Reason for rejection (applied to all)',
            inputPlaceholder: 'Enter reason...',
            showCancelButton: true,
            inputValidator: (value) => !value ? 'Reason is required!' : null
        });

        if (!reason) return;

        setProcessing(true);
        try {
            // Update reasons first
            const ids = Array.from(selectedIds);
            await Promise.all(ids.map(id => updateReconciliation(id, { reviewComments: reason })));

            await bulkRejectReconciliations(ids, user.uid);

            // Trigger emails
            ids.forEach(id => notifyDecision(id, 'rejected', reason));

            await safeSwalFire({
                title: "Success",
                text: `${selectedIds.size} requests rejected.`,
                icon: "success",
                allowOutsideClick: true,
                allowEscapeKey: true,
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: true,
            });
            setSelectedIds(new Set());
            fetchData();
        } catch (error) {
            await safeSwalFire({
                title: "Error",
                text: "Bulk reject failed.",
                icon: "error",
                allowOutsideClick: true,
                allowEscapeKey: true,
                showConfirmButton: true,
            });
        } finally {
            setProcessing(false);
        }
    };

    // Filter by search term
    const filteredReconciliations = reconciliations.filter(r =>
        r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination Logic
    const totalPages = Math.ceil(filteredReconciliations.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedReconciliations = filteredReconciliations.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const getPageNumbers = () => {
        const pageNumbers = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i);
            }
        } else {
            const leftSide = Math.max(2, currentPage - 1);
            const rightSide = Math.min(totalPages - 1, currentPage + 1);

            pageNumbers.push(1);
            if (leftSide > 2) pageNumbers.push("...");
            for (let i = leftSide; i <= rightSide; i++) {
                pageNumbers.push(i);
            }
            if (rightSide < totalPages - 1) pageNumbers.push("...");
            pageNumbers.push(totalPages);
        }
        return pageNumbers;
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Attendance Reconciliation</h1>
                    <p className="text-muted-foreground">Manage employee attendance correction requests.</p>
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <>
                            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleBulkApprove} disabled={processing}>
                                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                Approve Selected ({selectedIds.size})
                            </Button>
                            <Button variant="destructive" onClick={handleBulkReject} disabled={processing}>
                                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                                Reject Selected ({selectedIds.size})
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or code..."
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
                    ) : filteredReconciliations.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No reconciliation requests found.</div>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">
                                                <Checkbox
                                                    checked={selectedIds.size === paginatedReconciliations.length && paginatedReconciliations.length > 0}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            const newIds = new Set(selectedIds);
                                                            paginatedReconciliations.forEach(r => newIds.add(r.id));
                                                            setSelectedIds(newIds);
                                                        } else {
                                                            const newIds = new Set(selectedIds);
                                                            paginatedReconciliations.forEach(r => newIds.delete(r.id));
                                                            setSelectedIds(newIds);
                                                        }
                                                    }}
                                                />
                                            </TableHead>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Reconciliation Date</TableHead>
                                            <TableHead>Requested In</TableHead>
                                            <TableHead>Requested Out</TableHead>
                                            <TableHead>Remarks (In/Out)</TableHead>
                                            <TableHead>Apply Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedReconciliations.map(rec => (
                                            <TableRow key={rec.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedIds.has(rec.id)}
                                                        onCheckedChange={(checked) => toggleSelect(rec.id, checked as boolean)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{rec.employeeName}</span>
                                                        <span className="text-xs text-muted-foreground">{rec.employeeCode} - {rec.designation}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{formatDisplayDate(rec.attendanceDate)}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col text-xs">
                                                        <span className={rec.requestedInTime ? "font-medium text-green-600" : ""}>{rec.requestedInTime || '-'}</span>
                                                        {rec.originalInTime && <span className="text-muted-foreground line-through">{rec.originalInTime}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col text-xs">
                                                        <span className={rec.requestedOutTime ? "font-medium text-green-600" : ""}>{rec.requestedOutTime || '-'}</span>
                                                        {rec.originalOutTime && <span className="text-muted-foreground line-through">{rec.originalOutTime}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col text-xs max-w-[200px]">
                                                        {rec.inTimeRemarks && <span>In: {rec.inTimeRemarks}</span>}
                                                        {rec.outTimeRemarks && <span>Out: {rec.outTimeRemarks}</span>}
                                                        {!rec.inTimeRemarks && !rec.outTimeRemarks && <span className="italic text-muted-foreground">No remarks</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs">{formatDisplayDate(rec.applyDate)}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={rec.status === 'approved' ? 'default' : rec.status === 'rejected' ? 'destructive' : 'secondary'}>
                                                        {rec.status.toUpperCase()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            {rec.status === 'pending' && (
                                                                <>
                                                                    <DropdownMenuItem onClick={() => handleApprove(rec)} className="text-green-600 focus:text-green-700">
                                                                        <Check className="mr-2 h-4 w-4" /> Approve
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleReject(rec.id)} className="text-red-600 focus:text-red-700">
                                                                        <X className="mr-2 h-4 w-4" /> Reject
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                </>
                                                            )}
                                                            <DropdownMenuItem onClick={() => handleEditClick(rec)}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleDelete(rec.id)} className="text- destructive focus:text-destructive">
                                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center space-x-2 py-4 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Previous
                                    </Button>
                                    {getPageNumbers().map((page, index) => (
                                        typeof page === 'number' ? (
                                            <Button
                                                key={index}
                                                variant={currentPage === page ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => handlePageChange(page)}
                                                className="w-9 h-9 p-0"
                                            >
                                                {page}
                                            </Button>
                                        ) : (
                                            <span key={index} className="px-2 text-muted-foreground">...</span>
                                        )
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Reconciliation Request</DialogTitle>
                        <DialogDescription>Modify requested times and remarks.</DialogDescription>
                    </DialogHeader>
                    {editingRec && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Requested In Time</Label>
                                    <Input
                                        value={editForm.requestedInTime}
                                        onChange={(e) => setEditForm({ ...editForm, requestedInTime: e.target.value })}
                                        placeholder="hh:mm AM/PM"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>In Time Remarks</Label>
                                    <Input
                                        value={editForm.inTimeRemarks}
                                        onChange={(e) => setEditForm({ ...editForm, inTimeRemarks: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Requested Out Time</Label>
                                    <Input
                                        value={editForm.requestedOutTime}
                                        onChange={(e) => setEditForm({ ...editForm, requestedOutTime: e.target.value })}
                                        placeholder="hh:mm AM/PM"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Out Time Remarks</Label>
                                    <Input
                                        value={editForm.outTimeRemarks}
                                        onChange={(e) => setEditForm({ ...editForm, outTimeRemarks: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleEditSubmit} disabled={processing}>
                            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}

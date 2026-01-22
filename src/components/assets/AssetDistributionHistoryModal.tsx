"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, getDoc, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { AssetDistributionDocument, EmployeeDocument } from '@/types';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface AssetDistributionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    assetId: string | null;
    assetName: string;
}

// Extends AssetDistributionDocument to include fetched employee details
// Use Omit to exclude employeeCode since we're redefining it as optional
interface ExpandedDistribution extends Omit<AssetDistributionDocument, 'employeeCode'> {
    employeeCode?: string;
    employeeBranch?: string;
    employeeDepartment?: string;
}

export function AssetDistributionHistoryModal({ isOpen, onClose, assetId, assetName }: AssetDistributionHistoryModalProps) {
    const [distributions, setDistributions] = useState<ExpandedDistribution[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        if (isOpen && assetId) {
            fetchHistory();
        } else {
            setDistributions([]);
        }
    }, [isOpen, assetId]);

    const fetchHistory = async () => {
        if (!assetId) return;
        setIsLoading(true);
        try {
            // 1. Fetch distributions for this asset
            // Note: Removed orderBy("startDate", "desc") to avoid needing a composite index immediately.
            // Sorting will be done client-side.
            const q = query(
                collection(firestore, "asset_distributions"),
                where("assetId", "==", assetId)
            );
            const snapshot = await getDocs(q);
            let dists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssetDistributionDocument));

            // Client-side filter: Only show 'Occupied' or 'Returned' (Accepted assignments)
            dists = dists.filter(d => d.status === 'Occupied' || d.status === 'Returned');

            // Client-side sort: Newest first
            dists.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

            // 2. Fetch employee details for each distribution
            // To optimize, find unique employee IDs first
            const uniqueEmployeeIds = Array.from(new Set(dists.map(d => d.employeeId))).filter(Boolean);

            const employeeMap: Record<string, EmployeeDocument> = {};

            // Fetch employees in parallel (or use 'in' query if list is small, here map is simple)
            await Promise.all(uniqueEmployeeIds.map(async (empId) => {
                const empDoc = await getDoc(doc(firestore, "employees", empId));
                if (empDoc.exists()) {
                    employeeMap[empId] = { id: empDoc.id, ...empDoc.data() } as EmployeeDocument;
                }
            }));

            // 3. Merge data
            const expandedDists: ExpandedDistribution[] = dists.map(d => {
                const emp = employeeMap[d.employeeId];
                return {
                    ...d,
                    employeeCode: emp?.employeeCode || '-',
                    employeeBranch: emp?.branch || '-',
                    employeeDepartment: emp?.department || '-',
                    employeeDesignation: emp?.designation || d.employeeDesignation || '-', // Prefer fetched designation
                };
            });

            setDistributions(expandedDists);
        } catch (error) {
            console.error("Error fetching distribution history:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Pagination Logic
    const totalPages = Math.ceil(distributions.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedData = distributions.slice(startIndex, startIndex + rowsPerPage);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[1000px] max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between">
                    <DialogTitle>Asset Distribution History</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto p-6">
                    {/* Asset Name Badge/Header if needed */}
                    <div className="mb-4 text-sm text-muted-foreground">
                        History for: <span className="font-semibold text-foreground">{assetName}</span>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-semibold text-foreground">Assigned To</TableHead>
                                    <TableHead className="font-semibold text-foreground">Employee Code</TableHead>
                                    <TableHead className="font-semibold text-foreground">Designation</TableHead>
                                    <TableHead className="font-semibold text-foreground">Branch</TableHead>
                                    <TableHead className="font-semibold text-foreground">Department</TableHead>
                                    <TableHead className="font-semibold text-foreground">Distribution Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : paginatedData.length > 0 ? (
                                    paginatedData.map((dist) => (
                                        <TableRow key={dist.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{dist.employeeName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{dist.employeeCode}</TableCell>
                                            <TableCell>{dist.employeeDesignation}</TableCell>
                                            <TableCell>{dist.employeeBranch}</TableCell>
                                            <TableCell>{dist.employeeDepartment}</TableCell>
                                            <TableCell>
                                                {(() => {
                                                    if (!dist.startDate) return '-';
                                                    try {
                                                        const d = parseISO(dist.startDate);
                                                        if (isNaN(d.getTime())) return '-';
                                                        return format(d, 'dd-MM-yyyy');
                                                    } catch (e) {
                                                        return '-';
                                                    }
                                                })()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No distribution history found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="px-6 py-4 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Items per page</span>
                        <Select
                            value={String(rowsPerPage)}
                            onValueChange={(v) => {
                                setRowsPerPage(Number(v));
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={rowsPerPage} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[5, 10, 20, 50].map((pageSize) => (
                                    <SelectItem key={pageSize} value={String(pageSize)}>
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span>
                            {distributions.length === 0 ? '0 - 0 of 0' :
                                `${startIndex + 1} - ${Math.min(startIndex + rowsPerPage, distributions.length)} of ${distributions.length}`}
                        </span>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <span className="sr-only">Go to previous page</span>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex w-[30px] items-center justify-center text-sm font-medium">
                            {currentPage}
                        </div>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                        >
                            <span className="sr-only">Go to next page</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

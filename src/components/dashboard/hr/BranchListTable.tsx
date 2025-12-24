"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Search,
    Plus,
    Edit,
    Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { BranchDocument } from '@/types';

interface BranchListTableProps {
    data: BranchDocument[];
    isLoading: boolean;
    onDelete: (id: string, name: string) => void;
    userRole?: string;
}

export function BranchListTable({
    data,
    isLoading,
    onDelete,
    userRole
}: BranchListTableProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredData = data.filter(branch =>
        branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.timezone?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

    const isReadOnly = userRole?.includes('Viewer');

    const StatusBadge = ({ value }: { value?: boolean }) => (
        <span className={value ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
            {value ? "Yes" : "No"}
        </span>
    );

    return (
        <Card className="w-full shadow-sm border-none bg-background">
            <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 bg-primary/5 rounded-t-lg">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-8 bg-background border-none shadow-sm"
                    />
                </div>
                <Button onClick={() => router.push('/dashboard/hr/settings/branches/add')} disabled={isReadOnly} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                    <Plus className="mr-2 h-4 w-4" /> Add New
                </Button>
            </div>

            <CardContent className="p-0">
                <div className="border rounded-b-lg overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="font-bold text-black">Branch Name</TableHead>
                                <TableHead className="font-bold text-black text-center">Is Head Office</TableHead>
                                <TableHead className="font-bold text-black text-center">Remote Attendance Allowed</TableHead>
                                <TableHead className="font-bold text-black text-center">Require Remote Attendance Approval</TableHead>
                                <TableHead className="font-bold text-black text-center">Allow Radius</TableHead>
                                <TableHead className="font-bold text-black">Time Zone</TableHead>
                                <TableHead className="font-bold text-black">Address</TableHead>
                                <TableHead className="font-bold text-black text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                        No branches found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((branch) => (
                                    <TableRow key={branch.id} className="hover:bg-muted/5">
                                        <TableCell className="font-medium text-foreground">{branch.name}</TableCell>
                                        <TableCell className="text-center"><StatusBadge value={branch.isHeadOffice} /></TableCell>
                                        <TableCell className="text-center"><StatusBadge value={branch.remoteAttendanceAllowed} /></TableCell>
                                        <TableCell className="text-center"><StatusBadge value={branch.requireRemoteAttendanceApproval} /></TableCell>
                                        <TableCell className="text-center text-muted-foreground">{branch.allowRadius || '-'}</TableCell>
                                        <TableCell className="text-muted-foreground">{branch.timezone}</TableCell>
                                        <TableCell className="text-muted-foreground max-w-[200px] truncate" title={branch.address}>{branch.address || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => router.push(`/dashboard/hr/settings/branches/edit/${branch.id}`)}
                                                    disabled={isReadOnly}
                                                    className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => onDelete(branch.id, branch.name)}
                                                    disabled={isReadOnly}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between px-4 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                        Items per page
                        <select
                            className="ml-2 border rounded p-1 text-xs"
                            disabled
                            value={itemsPerPage}
                        >
                            <option>10</option>
                        </select>
                        <span className="ml-4">
                            {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length}
                        </span>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0" // Using icon only for previous based on screenshot style implied
                        >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="sr-only">Previous</span>
                        </Button>
                        <span className="text-sm font-medium">
                            {currentPage}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="h-8 w-8 p-0" // Using icon only for next based on screenshot style implied
                        >
                            <ChevronRight className="h-4 w-4" />
                            <span className="sr-only">Next</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

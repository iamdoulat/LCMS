
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Plus,
    Search,
    AlertCircle,
    FileText,
    Settings,
    Wrench,
    ChevronDown,
    ChevronUp,
    Edit3,
    Trash2,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Loader2,
    FileCode,
    BookOpen
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/context/AuthContext';
import { deleteErrorCode } from '@/lib/firebase/warranty';
import type { ErrorCodeRecord } from '@/types/warranty';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

export default function ErrorCodesPage() {
    const router = useRouter();
    const [errorRecords, setErrorRecords] = useState<ErrorCodeRecord[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<ErrorCodeRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    // Auth & Permissions
    const { userRole } = useAuth();
    const isManager = React.useMemo(() => {
        return userRole?.some(role => ['Admin', 'Service', 'Super Admin', 'Supervisor'].includes(role)) ?? false;
    }, [userRole]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const fetchErrorCodes = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(firestore, 'error_codes'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ErrorCodeRecord));
            setErrorRecords(data);
        } catch (error) {
            console.error("Error fetching error codes:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchErrorCodes();
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredRecords([]);
            return;
        }

        const lowerQuery = searchQuery.toLowerCase();
        const filtered = errorRecords.filter(rec =>
            rec.errorCode?.toLowerCase().includes(lowerQuery) ||
            rec.machineModel?.toLowerCase().includes(lowerQuery) ||
            rec.brand?.toLowerCase().includes(lowerQuery) ||
            rec.problem?.toLowerCase().includes(lowerQuery) ||
            rec.solution?.toLowerCase().includes(lowerQuery)
        );
        setFilteredRecords(filtered);
    }, [searchQuery, errorRecords]);

    // Pagination Logic
    const totalPages = Math.ceil(errorRecords.length / ITEMS_PER_PAGE);
    const paginatedRecords = React.useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return errorRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [errorRecords, currentPage]);

    const goToPage = (page: number) => {
        const pageNumber = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(pageNumber);
    };

    const handleDelete = async (rec: ErrorCodeRecord) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `This will permanently delete error code ${rec.errorCode}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteErrorCode(rec.id);
                fetchErrorCodes();
                Swal.fire('Deleted!', 'Error code has been deleted.', 'success');
            } catch (error) {
                console.error("Error deleting error code:", error);
                Swal.fire('Error', 'Failed to delete record.', 'error');
            }
        }
    };

    const handleAddNew = () => {
        router.push('/dashboard/warranty-management/error-codes/add');
    };

    const toggleExpand = (id: string) => {
        setExpandedCard(expandedCard === id ? null : id);
    };

    return (
        <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className={cn(
                        "text-3xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text",
                        "hover:tracking-wider transition-all duration-300 ease-in-out"
                    )}>
                        Machine Error Codes
                    </h1>
                    <p className="text-slate-500 mt-1">Troubleshoot machine errors with comprehensive solutions and technical guides.</p>
                </div>
                <Button
                    onClick={handleAddNew}
                    className="bg-primary hover:bg-primary/90 shadow-lg transition-all active:scale-95"
                >
                    <Plus className="mr-2 h-4 w-4" /> Add New Error Code
                </Button>
            </div>

            <Card className="mb-8 border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm">
                <CardContent className="p-6">
                    <div className="relative max-w-2xl mx-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Search by Error Code, Model, or Solution..."
                            className="pl-12 h-14 text-lg rounded-2xl border-slate-200 focus:ring-2 focus:ring-primary shadow-sm bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-slate-500 font-medium">Loading error codes...</p>
                </div>
            ) : (
                <>
                    {/* Search Results (Cards) - Only show if searching */}
                    {searchQuery.trim() && (
                        <div className="mb-12">
                            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Search className="h-5 w-5 text-primary" /> Search Results
                            </h2>
                            {filteredRecords.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {filteredRecords.map((rec) => (
                                        <Card key={rec.id} className="border-slate-100 shadow-xl hover:shadow-2xl transition-all duration-300 group overflow-hidden flex flex-col">
                                            <CardHeader className="p-5 pb-2">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
                                                            <FileCode className="h-6 w-6" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-xl font-bold text-slate-800 uppercase tracking-tight">Code: {rec.errorCode}</CardTitle>
                                                            <CardDescription className="font-semibold text-primary">{rec.brand} - {rec.machineModel}</CardDescription>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-5 pt-4 flex-1 flex flex-col">
                                                <div className="space-y-4">
                                                    <div>
                                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block flex items-center gap-1.5">
                                                            <AlertCircle className="h-3 w-3" /> Identified Problem
                                                        </Label>
                                                        <p className="text-slate-700 text-sm font-medium leading-relaxed italic border-l-2 border-rose-200 pl-3">
                                                            "{rec.problem}"
                                                        </p>
                                                    </div>

                                                    <div className={cn(
                                                        "transition-all duration-300 overflow-hidden",
                                                        expandedCard === rec.id ? "max-h-[500px] opacity-100 mt-4" : "max-h-0 opacity-0"
                                                    )}>
                                                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block flex items-center gap-1.5">
                                                            <Wrench className="h-3 w-3" /> Suggested Solution
                                                        </Label>
                                                        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                                                            {rec.solution}
                                                        </div>

                                                        {rec.fileUrl && (
                                                            <Button variant="outline" size="sm" className="w-full mt-4 h-10 text-xs shadow-md border-slate-200" asChild>
                                                                <a href={rec.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                    <FileText className="mr-2 h-4 w-4" /> Download Guide
                                                                </a>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    onClick={() => toggleExpand(rec.id)}
                                                    className="w-full mt-auto mt-6 flex items-center justify-center text-slate-500 hover:text-primary transition-all duration-300 py-3 border-t border-slate-100 rounded-none bg-slate-50/20 hover:bg-white hover:shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]"
                                                >
                                                    {expandedCard === rec.id ? (
                                                        <>Hide Solution <ChevronUp className="ml-2 h-4 w-4" /></>
                                                    ) : (
                                                        <>Show Solution <ChevronDown className="ml-2 h-4 w-4" /></>
                                                    )}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                    <AlertCircle className="h-12 w-12 text-slate-300 mb-4" />
                                    <h3 className="text-lg font-bold text-slate-800">No Matching Faults Found</h3>
                                    <p className="text-slate-500 text-sm max-w-sm text-center mt-1 px-6">
                                        We couldn't find any error codes matching "{searchQuery}".
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Management Table */}
                    <div className="mt-12">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Settings className="h-5 w-5 text-primary" /> Error Code Management
                            </h2>
                            <div className="text-xs text-slate-400 font-medium">
                                Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, errorRecords.length)} to {Math.min(currentPage * ITEMS_PER_PAGE, errorRecords.length)} of {errorRecords.length} entries
                            </div>
                        </div>
                        <Card className="border-slate-100 shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Error Code</TableHead>
                                        <TableHead>Model / Brand</TableHead>
                                        <TableHead className="max-w-[300px]">Problem Detail</TableHead>
                                        <TableHead className="max-w-[300px]">Solution</TableHead>
                                        {isManager && <TableHead className="text-right">Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedRecords.map((rec) => (
                                        <TableRow key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="font-bold text-rose-600 uppercase">
                                                {rec.errorCode}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-semibold text-slate-800">{rec.machineModel}</div>
                                                <div className="text-[10px] text-primary font-bold">{rec.brand}</div>
                                            </TableCell>
                                            <TableCell className="max-w-[300px]">
                                                <div className="text-xs text-slate-600 line-clamp-2 italic">
                                                    "{rec.problem}"
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[300px]">
                                                <div className="text-xs text-emerald-700 line-clamp-2">
                                                    {rec.solution}
                                                </div>
                                            </TableCell>
                                            {isManager && (
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 rounded-full">
                                                                <MoreHorizontal className="h-4 w-4 text-slate-500" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-40">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/dashboard/warranty-management/error-codes/edit/${rec.id}`} className="flex items-center text-blue-600 focus:text-blue-700 focus:bg-blue-50 cursor-pointer">
                                                                    <Edit3 className="mr-2 h-4 w-4" /> Edit
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleDelete(rec)}
                                                                className="flex items-center text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer"
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => goToPage(1)}
                                    disabled={currentPage === 1}
                                    className="h-8 w-8 rounded-lg border-slate-200"
                                >
                                    <ChevronsLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="h-8 w-8 rounded-lg border-slate-200"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>

                                <div className="flex items-center gap-1 mx-2">
                                    {[...Array(totalPages)].map((_, i) => {
                                        const pageNumber = i + 1;
                                        if (
                                            totalPages <= 7 ||
                                            pageNumber === 1 ||
                                            pageNumber === totalPages ||
                                            (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                        ) {
                                            return (
                                                <Button
                                                    key={pageNumber}
                                                    variant={currentPage === pageNumber ? "default" : "outline"}
                                                    onClick={() => goToPage(pageNumber)}
                                                    className={cn(
                                                        "h-8 w-8 rounded-lg text-xs font-bold transition-all",
                                                        currentPage === pageNumber
                                                            ? "bg-primary shadow-md"
                                                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                                    )}
                                                >
                                                    {pageNumber}
                                                </Button>
                                            );
                                        } else if (
                                            (pageNumber === currentPage - 2 && pageNumber > 1) ||
                                            (pageNumber === currentPage + 2 && pageNumber < totalPages)
                                        ) {
                                            return <span key={pageNumber} className="px-1 text-slate-400">...</span>;
                                        }
                                        return null;
                                    })}
                                </div>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="h-8 w-8 rounded-lg border-slate-200"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => goToPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="h-8 w-8 rounded-lg border-slate-200"
                                >
                                    <ChevronsRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}



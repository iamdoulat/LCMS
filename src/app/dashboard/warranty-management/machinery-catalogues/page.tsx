
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Loader2,
    FileText,
    Plus,
    Search,
    Download,
    Eye,
    AlertCircle,
    BookOpen,
    Play,
    Settings,
    Edit3,
    Trash2,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    MoreHorizontal
} from 'lucide-react';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import type { MachineryCatalogue } from '@/types/warranty';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
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
import { deleteCatalogue } from '@/lib/firebase/warranty';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MachineryCataloguesPage() {
    const router = useRouter();
    const { userRole } = useAuth();
    const [catalogues, setCatalogues] = useState<MachineryCatalogue[]>([]);
    const [filteredCatalogues, setFilteredCatalogues] = useState<MachineryCatalogue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const isManager = useMemo(() => {
        return userRole?.some(role => ['Admin', 'Service', 'Super Admin', 'Supervisor'].includes(role)) ?? false;
    }, [userRole]);

    const fetchCatalogues = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(firestore, 'machinery_catalogues'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MachineryCatalogue));
            setCatalogues(data);
            setFilteredCatalogues(data);
        } catch (error) {
            console.error("Error fetching catalogues:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCatalogues();
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredCatalogues([]);
            return;
        }

        const lowerQuery = searchQuery.toLowerCase();
        const filtered = catalogues.filter(cat =>
            cat.title?.toLowerCase().includes(lowerQuery) ||
            cat.subtitle?.toLowerCase().includes(lowerQuery) ||
            cat.machineModels?.some(m => m.toLowerCase().includes(lowerQuery)) ||
            cat.brand?.toLowerCase().includes(lowerQuery)
        );
        setFilteredCatalogues(filtered);
    }, [searchQuery, catalogues]);

    // Pagination Logic for Management Table (Always shows all list)
    const totalPages = Math.ceil(catalogues.length / ITEMS_PER_PAGE);
    const paginatedCatalogues = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return catalogues.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [catalogues, currentPage]);

    const goToPage = (page: number) => {
        const pageNumber = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(pageNumber);
    };

    const handleDelete = async (cat: MachineryCatalogue) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "This will permanently delete the catalogue and all associated files!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteCatalogue(cat);
                Swal.fire('Deleted!', 'Catalogue has been deleted.', 'success');
                fetchCatalogues();
            } catch (error) {
                console.error("Error deleting catalogue:", error);
                Swal.fire('Error', 'Failed to delete catalogue', 'error');
            }
        }
    };

    return (
        <div className="max-w-none mx-[10px] md:mx-[25px] mt-[10px] md:mt-0 mb-[50px] md:mb-0 py-8 px-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className={cn(
                        "text-3xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text",
                        "hover:tracking-wider transition-all duration-300 ease-in-out"
                    )}>
                        Machinery Catalogues
                    </h1>
                    <p className="text-slate-500 mt-1">Browse and download technical catalogues for various machinery models.</p>
                </div>
                {isManager && (
                    <Button
                        asChild
                        className="bg-primary hover:bg-primary/90 shadow-lg transition-all active:scale-95"
                    >
                        <Link href="/dashboard/warranty-management/machinery-catalogues/add">
                            <Plus className="mr-2 h-4 w-4" /> Add New Catalogue
                        </Link>
                    </Button>
                )}
            </div>

            <Card className="mb-8 border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm">
                <CardContent className="p-6">
                    <div className="relative max-w-2xl mx-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Search by Title, Model, or Brand..."
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
                    <p className="text-slate-500 font-medium">Loading catalogues...</p>
                </div>
            ) : (
                <>
                    {/* Search Results (Cards) - Only show if searching */}
                    {searchQuery.trim() && (
                        <div className="mb-12">
                            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Search className="h-5 w-5 text-primary" /> Search Results
                            </h2>
                            {filteredCatalogues.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {filteredCatalogues.map((cat) => (
                                        <Card key={cat.id} className="group shadow-xl hover:shadow-2xl transition-all duration-300 border-slate-100 overflow-hidden flex flex-col">
                                            <div className="h-40 bg-slate-50 flex items-center justify-center border-b border-slate-50 relative overflow-hidden">
                                                {cat.thumbnailUrl ? (
                                                    <img src={cat.thumbnailUrl} alt={cat.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-slate-300">
                                                        <BookOpen className="h-12 w-12" />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest">No Preview</span>
                                                    </div>
                                                )}
                                                <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                                                    <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-[10px] font-bold shadow-sm whitespace-nowrap">
                                                        {cat.brand}
                                                    </Badge>
                                                    {cat.category && (
                                                        <Badge variant="outline" className="bg-primary/10 backdrop-blur-sm text-[9px] font-bold text-primary border-primary/20 shadow-sm whitespace-nowrap uppercase">
                                                            {cat.category}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <CardHeader className="p-4 pb-2">
                                                <CardTitle className="text-lg font-bold line-clamp-1 text-slate-800">{cat.title}</CardTitle>
                                                <CardDescription className="text-xs line-clamp-1">{cat.subtitle || 'Technical Specifications'}</CardDescription>
                                            </CardHeader>
                                            <CardContent className="p-4 pt-0 flex-1 flex flex-col">
                                                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                                                    {cat.machineModels?.map((model, idx) => (
                                                        <div key={idx} className="px-2 py-1 bg-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase">
                                                            {model}
                                                        </div>
                                                    ))}
                                                    {cat.subCategory && (
                                                        <div className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-400 uppercase">
                                                            {cat.subCategory}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 mt-auto">
                                                    <Button variant="outline" size="sm" className="flex-1 h-9 text-xs shadow-md border-slate-200" asChild>
                                                        <a href={cat.fileUrl} target="_blank" rel="noopener noreferrer">
                                                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                                                        </a>
                                                    </Button>
                                                    <Button size="sm" className="flex-1 h-9 text-xs shadow-md" asChild>
                                                        <a href={cat.fileUrl} download>
                                                            <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                                                        </a>
                                                    </Button>
                                                </div>
                                                {(cat.insManualsUrl || cat.videoUrl) && (
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        {cat.insManualsUrl && (
                                                            <Button variant="ghost" size="sm" className="h-8 text-[10px] text-orange-600 hover:text-orange-700 hover:bg-orange-50 shadow-sm border border-orange-100" asChild>
                                                                <a href={cat.insManualsUrl} target="_blank" rel="noopener noreferrer">
                                                                    <FileText className="mr-1.5 h-3 w-3" /> Manual
                                                                </a>
                                                            </Button>
                                                        )}
                                                        {cat.videoUrl && (
                                                            <Button variant="ghost" size="sm" className="h-8 text-[10px] text-purple-600 hover:text-purple-700 hover:bg-purple-50 shadow-sm border border-purple-100" asChild>
                                                                <a href={cat.videoUrl} target="_blank" rel="noopener noreferrer">
                                                                    <Play className="mr-1.5 h-3 w-3" /> Video
                                                                </a>
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                    <AlertCircle className="h-12 w-12 text-slate-300 mb-4" />
                                    <h3 className="text-lg font-bold text-slate-800">No Matching Models Found</h3>
                                    <p className="text-slate-500 text-sm max-w-sm text-center mt-1 px-6">
                                        We couldn't find any catalogues matching "{searchQuery}".
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Management Table */}
                    <div className="mt-12">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Settings className="h-5 w-5 text-primary" /> Catalogue Management
                            </h2>
                            <div className="text-xs text-slate-400 font-medium">
                                Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, catalogues.length)} to {Math.min(currentPage * ITEMS_PER_PAGE, catalogues.length)} of {catalogues.length} entries
                            </div>
                        </div>
                        <Card className="border-slate-100 shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[100px]">Thumbnail</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Model / Brand</TableHead>
                                        <TableHead>Category / Sub</TableHead>
                                        {isManager && <TableHead className="text-right">Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedCatalogues.map((cat) => (
                                        <TableRow key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                                            <TableCell>
                                                <div className="w-12 h-18 bg-slate-100 rounded border overflow-hidden">
                                                    {cat.thumbnailUrl && <img src={cat.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-semibold text-slate-800">{cat.title}</div>
                                                <div className="text-xs text-slate-500 line-clamp-1">{cat.subtitle}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1 max-w-[200px] mb-1">
                                                    {cat.machineModels?.map((model, idx) => (
                                                        <Badge key={idx} variant="outline" className="text-[9px] border-primary/20 text-primary py-0 px-1.5 h-4">
                                                            {model}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <div className="text-[10px] text-primary font-bold">{cat.brand}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="secondary" className="bg-slate-100 text-[10px] w-fit">
                                                        {cat.category || 'N/A'}
                                                    </Badge>
                                                    {cat.subCategory && (
                                                        <span className="text-[9px] text-slate-400 font-medium px-2 italic">
                                                            {cat.subCategory}
                                                        </span>
                                                    )}
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
                                                                <Link href={`/dashboard/warranty-management/machinery-catalogues/edit/${cat.id}`} className="flex items-center text-blue-600 focus:text-blue-700 focus:bg-blue-50 cursor-pointer">
                                                                    <Edit3 className="mr-2 h-4 w-4" /> Edit
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleDelete(cat)}
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
                                        // Show limited page numbers if there are too many
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

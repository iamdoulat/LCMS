"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    Search,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    Download,
    FilterX,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { firestore } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy as firestoreOrderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { format, getYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saleStatusOptions } from '@/types'; // Or define locally if not available

interface Invoice {
    id: string;
    invoiceNo: string;
    clientName: string;
    projectTitle: string;
    salesperson: string;
    dueDate: string;
    amount: number;
    paymentStatus: string;
    createdAt: any;
    lineItems?: any[];
}

export default function ManageInvoicesPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;


    // Filters
    const [invoiceNoFilter, setInvoiceNoFilter] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [salespersonFilter, setSalespersonFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [yearFilter, setYearFilter] = useState<string>('All');

    // Sorting
    const [sortBy, setSortBy] = useState<string>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        const q = query(collection(firestore, 'project_invoices'), firestoreOrderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const docData = doc.data();
                return {
                    id: doc.id,
                    invoiceNo: doc.id,
                    clientName: docData.customerName || 'Unknown Client',
                    projectTitle: docData.projectTitle || 'General Project',
                    salesperson: docData.salesperson || '',
                    dueDate: docData.invoiceDate || new Date().toISOString(),
                    amount: docData.totalAmount || 0,
                    paymentStatus: docData.status || 'Draft',
                    createdAt: docData.createdAt,
                    lineItems: docData.lineItems
                };
            }) as Invoice[];
            setInvoices(data);
        });

        return () => unsubscribe();
    }, []);

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this invoice?")) {
            await deleteDoc(doc(firestore, 'project_invoices', id));
        }
    };

    const handleDownloadPDF = (invoice: Invoice) => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text("INVOICE", 15, 20);
        doc.setFontSize(10);
        doc.text(`Invoice No: ${invoice.invoiceNo}`, 15, 30);
        const dateStr = invoice.createdAt instanceof Timestamp ?
            format(invoice.createdAt.toDate(), 'yyyy-MM-dd') :
            invoice.createdAt ? format(new Date(invoice.createdAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        doc.text(`Date: ${dateStr}`, 15, 35);
        doc.text(`Bill To:`, 15, 50);
        doc.setFontSize(12);
        doc.text(invoice.clientName, 15, 55);
        doc.setFontSize(10);
        doc.text(`Project: ${invoice.projectTitle}`, 15, 65);
        doc.text(`Salesperson: ${invoice.salesperson}`, 15, 70);

        const tableBody = invoice.lineItems?.map((item: any) => [
            item.description || 'Item',
            `$${Number(item.total || 0).toLocaleString()}`
        ]) || [['Consulting Services', `$${invoice.amount.toLocaleString()}`]];

        autoTable(doc, {
            startY: 75,
            head: [['Description', 'Amount']],
            body: tableBody,
        });

        // @ts-ignore
        const finalY = doc.lastAutoTable.finalY || 75;
        doc.setFontSize(12);
        doc.text(`Total Due: $${invoice.amount.toLocaleString()}`, 130, finalY + 20);
        doc.save(`invoice_${invoice.invoiceNo}.pdf`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Paid': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Unpaid': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            case 'Partial': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Overdue': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const clearFilters = () => {
        setInvoiceNoFilter('');
        setClientFilter('');
        setSalespersonFilter('');
        setStatusFilter('All');
        setYearFilter('All');
    };

    const filteredAndSortedInvoices = useMemo(() => {
        let filtered = invoices.filter(inv => {
            // Invoice No Filter
            if (invoiceNoFilter && !inv.invoiceNo.toLowerCase().includes(invoiceNoFilter.toLowerCase())) return false;

            // Client Filter
            if (clientFilter && !inv.clientName.toLowerCase().includes(clientFilter.toLowerCase())) return false;

            // Salesperson Filter
            if (salespersonFilter && !inv.salesperson.toLowerCase().includes(salespersonFilter.toLowerCase())) return false;

            // Status Filter
            if (statusFilter !== 'All' && inv.paymentStatus !== statusFilter) return false;

            // Year Filter
            if (yearFilter !== 'All') {
                const date = inv.createdAt instanceof Timestamp ? inv.createdAt.toDate() : new Date(inv.createdAt);
                if (getYear(date).toString() !== yearFilter) return false;
            }

            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            let valA: any = a[sortBy as keyof Invoice];
            let valB: any = b[sortBy as keyof Invoice];

            // Handle dates specifically if strictly needed, but string comparison works for ISO sorted, logic needed for Timestamp
            if (sortBy === 'createdAt') {
                valA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
                valB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
            } else if (sortBy === 'amount') {
                valA = Number(valA);
                valB = Number(valB);
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [invoices, invoiceNoFilter, clientFilter, salespersonFilter, statusFilter, yearFilter, sortBy, sortOrder]);

    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
    }, []);

    // Reset pagination on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [invoiceNoFilter, clientFilter, salespersonFilter, statusFilter, yearFilter]);

    const totalPages = Math.ceil(filteredAndSortedInvoices.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentInvoices = filteredAndSortedInvoices.slice(indexOfFirstItem, indexOfLastItem);

    const nextPage = () => {
        if (currentPage < totalPages) setCurrentPage(curr => curr + 1);
    };

    const prevPage = () => {
        if (currentPage > 1) setCurrentPage(curr => curr - 1);
    };
    return (
        <div className="p-6 space-y-6 min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-teal-600 via-emerald-600 to-amber-600 text-transparent bg-clip-text">Manage Invoices</h1>
                    <p className="text-muted-foreground">Track and generate project invoices</p>
                </div>
                <Button onClick={() => router.push('/dashboard/project-management/invoices/new')} className="bg-primary hover:bg-primary/90 text-white shadow-md">
                    <Plus className="h-4 w-4 mr-2" /> Create Invoice
                </Button>
            </div>

            {/* Filter Section */}
            <div className="bg-white dark:bg-card p-4 rounded-lg border shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {/* Invoice No */}
                    <Input
                        placeholder="Invoice No"
                        value={invoiceNoFilter}
                        onChange={(e) => setInvoiceNoFilter(e.target.value)}
                        className="bg-slate-50"
                    />
                    {/* Client Name */}
                    <Input
                        placeholder="Client Name"
                        value={clientFilter}
                        onChange={(e) => setClientFilter(e.target.value)}
                        className="bg-slate-50"
                    />
                    {/* Salesperson */}
                    <Input
                        placeholder="Salesperson"
                        value={salespersonFilter}
                        onChange={(e) => setSalespersonFilter(e.target.value)}
                        className="bg-slate-50"
                    />
                    {/* Year */}
                    <Select value={yearFilter} onValueChange={setYearFilter}>
                        <SelectTrigger className="bg-slate-50">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Years</SelectItem>
                            {years.map(year => (
                                <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {/* Status */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-slate-50">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            {saleStatusOptions.map(status => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                        <FilterX className="h-4 w-4 mr-2" /> Clear
                    </Button>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground font-medium">Sort By:</span>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Sort Field" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="createdAt">Date Created</SelectItem>
                            <SelectItem value="invoiceNo">Invoice No</SelectItem>
                            <SelectItem value="clientName">Client Name</SelectItem>
                            <SelectItem value="amount">Amount</SelectItem>
                            <SelectItem value="paymentStatus">Status</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Order" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="desc">Descending</SelectItem>
                            <SelectItem value="asc">Ascending</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex-1 text-right text-xs text-muted-foreground mr-4">
                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredAndSortedInvoices.length)} of {filteredAndSortedInvoices.length} results
                    </div>

                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-white dark:bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Invoice No</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Salesperson</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSortedInvoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    No invoices found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            currentInvoices.map((invoice) => (
                                <TableRow key={invoice.id}>

                                    <TableCell className="font-medium text-blue-600">{invoice.invoiceNo}</TableCell>
                                    <TableCell>{invoice.projectTitle}</TableCell>
                                    <TableCell>{invoice.clientName}</TableCell>
                                    <TableCell>{invoice.salesperson}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                                    </TableCell>
                                    <TableCell className="font-semibold text-slate-700">
                                        ${invoice.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn("whitespace-nowrap", getStatusColor(invoice.paymentStatus))}>
                                            {invoice.paymentStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/invoices/edit/${invoice.id}`)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDownloadPDF(invoice)}>
                                                    <Download className="mr-2 h-4 w-4" /> Download PDF
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(invoice.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {filteredAndSortedInvoices.length > itemsPerPage && (
                <div className="flex flex-col md:grid md:grid-cols-3 items-center gap-4 py-4 px-2 border-t mt-4 bg-white dark:bg-card rounded-lg border shadow-sm">
                    <div className="text-sm text-muted-foreground text-center md:text-left order-2 md:order-1 px-2">
                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredAndSortedInvoices.length)} of {filteredAndSortedInvoices.length} invoices
                    </div>
                    <div className="flex items-center justify-center gap-2 order-1 md:order-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={prevPage}
                            disabled={currentPage === 1}
                            className="h-9"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <div className="flex items-center gap-1 min-w-[5rem] justify-center text-sm font-medium">
                            Page {currentPage} of {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={nextPage}
                            disabled={currentPage === totalPages}
                            className="h-9"
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                    <div className="hidden md:block md:order-3" />
                </div>
            )}
        </div>

    );
}

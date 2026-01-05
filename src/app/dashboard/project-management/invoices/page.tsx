"use client";

import React, { useState, useEffect } from 'react';
import {
    Receipt,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    Download
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { firestore } from '@/lib/firebase/config';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Invoice } from '@/types/projectManagement';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ManageInvoicesPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const q = query(collection(firestore, 'project_invoices'), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Invoice[];
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
        doc.text(`Date: ${format(new Date(invoice.createdAt.seconds * 1000), 'yyyy-MM-dd')}`, 15, 35);

        doc.text(`Bill To:`, 15, 50);
        doc.setFontSize(12);
        doc.text(invoice.clientName, 15, 55);

        doc.setFontSize(10);
        doc.text(`Project: ${invoice.projectTitle}`, 15, 65);

        // Simple table content (replace with actual items if available)
        autoTable(doc, {
            startY: 75,
            head: [['Description', 'Amount']],
            body: [
                ['Consulting Services', `$${invoice.amount.toLocaleString()}`],
            ],
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

    const filteredInvoices = invoices.filter(inv => {
        return (
            inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.projectTitle.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    return (
        <div className="p-6 space-y-6 min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manage Invoices</h1>
                    <p className="text-muted-foreground">Track and generate project invoices</p>
                </div>
                <Button onClick={() => router.push('/dashboard/project-management/invoices/new')} className="bg-primary hover:bg-primary/90 text-white shadow-md">
                    <Plus className="h-4 w-4 mr-2" /> Create Invoice
                </Button>
            </div>

            {/* Controls */}
            <div className="bg-white dark:bg-card p-4 rounded-lg border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 md:max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search invoices..."
                        className="pl-8 bg-slate-50 border-slate-200"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
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
                            <TableHead>Due Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Payment Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInvoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No invoices found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredInvoices.map((invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell className="font-medium text-blue-600">{invoice.invoiceNo}</TableCell>
                                    <TableCell>{invoice.projectTitle}</TableCell>
                                    <TableCell>{invoice.clientName}</TableCell>
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
                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/invoices/${invoice.id}`)}>
                                                    <Eye className="mr-2 h-4 w-4" /> View
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/project-management/invoices/${invoice.id}/edit`)}>
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
        </div>
    );
}

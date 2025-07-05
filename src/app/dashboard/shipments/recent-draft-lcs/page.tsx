

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, FileEdit, Info, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LCEntryDocument, LCStatus, Currency } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

interface DraftLC extends Pick<LCEntryDocument, 'id' | 'documentaryCreditNumber' | 'beneficiaryName' | 'applicantName' | 'status' | 'currency' | 'amount'> {
  createdAtDate: Date;
}

const ITEMS_PER_PAGE = 10;

const getStatusBadgeVariant = (status?: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Draft':
      return 'outline';
    case 'Transmitted':
      return 'secondary';
    case 'Shipment Pending':
      return 'default';
    case 'Payment Pending':
      return 'destructive';
    case 'Payment Done':
      return 'default';
    case 'Shipment Done':
      return 'default';
    default:
      return 'outline';
  }
};

const formatCurrencyValue = (currency?: Currency | string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function RecentDraftLCsPage() {
  const [allDraftLCs, setAllDraftLCs] = useState<DraftLC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchDraftLCs = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");

        // Query 1: For new data model (status is an array)
        const arrayQuery = query(lcEntriesRef, where("status", "array-contains", "Draft"));
        
        // Query 2: For old data model (status is a string)
        const stringQuery = query(lcEntriesRef, where("status", "==", "Draft"));

        const [arraySnapshot, stringSnapshot] = await Promise.all([
            getDocs(arrayQuery),
            getDocs(stringQuery),
        ]);

        const fetchedLCsMap = new Map<string, DraftLC>();

        const processSnapshot = (snapshot: typeof arraySnapshot) => {
            snapshot.docs.forEach((doc) => {
                if (fetchedLCsMap.has(doc.id)) return; // Avoid duplicates

                const data = doc.data() as LCEntryDocument;
                let createdAtDate = new Date(0);

                if (data.createdAt) {
                    if (typeof (data.createdAt as unknown as Timestamp).toDate === 'function') {
                        createdAtDate = (data.createdAt as unknown as Timestamp).toDate();
                    } else if (typeof data.createdAt === 'string') {
                        const parsed = parseISO(data.createdAt);
                        if (isValid(parsed)) createdAtDate = parsed;
                    }
                }

                fetchedLCsMap.set(doc.id, {
                    id: doc.id,
                    documentaryCreditNumber: data.documentaryCreditNumber,
                    applicantName: data.applicantName,
                    beneficiaryName: data.beneficiaryName,
                    createdAtDate: createdAtDate,
                    status: data.status,
                    currency: data.currency,
                    amount: data.amount,
                });
            });
        };

        processSnapshot(arraySnapshot);
        processSnapshot(stringSnapshot);

        const fetchedLCs = Array.from(fetchedLCsMap.values());
        fetchedLCs.sort((a, b) => b.createdAtDate.getTime() - a.createdAtDate.getTime());

        setAllDraftLCs(fetchedLCs);

      } catch (error: any) {
        console.error("Error fetching draft L/Cs: ", error);
        let errorMessage = `Could not fetch draft L/C data. Please ensure Firestore rules allow reads.`;
        if (error.message && error.message.toLowerCase().includes("index")) {
            errorMessage = `Could not fetch draft L/C data: A Firestore index is required. Please check the browser console for a link to create the index, or create it manually for the 'lc_entries' collection.`;
        } else if (error.message) {
            errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire({
          title: "Fetch Error",
          html: errorMessage.replace(/\b(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline">$1</a>'),
          icon: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDraftLCs();
  }, []);

  const totalPages = Math.ceil(allDraftLCs.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = allDraftLCs.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5; 
    const halfPagesToShow = Math.floor(maxPagesToShow / 2);

    if (totalPages <= maxPagesToShow + 2) { 
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1); 
      let startPage = Math.max(2, currentPage - halfPagesToShow);
      let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);
      if (currentPage <= halfPagesToShow + 1) endPage = Math.min(totalPages - 1, maxPagesToShow);
      if (currentPage >= totalPages - halfPagesToShow) startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      if (startPage > 2) pageNumbers.push("...");
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages - 1) pageNumbers.push("...");
      pageNumbers.push(totalPages); 
    }
    return pageNumbers;
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <FileEdit className="h-7 w-7 text-primary" />
            Recent Draft L/Cs
          </CardTitle>
          <CardDescription>
            List of Letters of Credit currently in "Draft" status, sorted by most recent creation date. 
            Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, allDraftLCs.length)} of {allDraftLCs.length} entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading draft L/Cs from database...</p>
            </div>
          ) : fetchError ? (
             <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap"
                 dangerouslySetInnerHTML={{ __html: fetchError.replace(/\b(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline">$1</a>') }}>
              </p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Draft L/Cs Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no L/Cs currently in "Draft" status, or the required Firestore index is missing/still building.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {currentItems.map((lc) => (
                <li key={lc.id} className="p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
                    <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-semibold text-primary hover:underline text-lg mb-1 sm:mb-0 truncate">
                      {lc.documentaryCreditNumber || 'N/A'}
                    </Link>
                    <div className="flex flex-wrap gap-1">
                        {Array.isArray(lc.status) ? (
                            lc.status.map(s => (
                                <Badge key={s} variant={getStatusBadgeVariant(s)} className={s === 'Draft' ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-700 dark:text-blue-100 dark:border-blue-500' : ''}>{s}</Badge>
                            ))
                        ) : lc.status ? (
                            <Badge variant={getStatusBadgeVariant(lc.status as LCStatus)} className={(lc.status as LCStatus) === 'Draft' ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-700 dark:text-blue-100 dark:border-blue-500' : ''}>{lc.status}</Badge>
                        ) : (
                            <Badge variant="outline">N/A</Badge>
                        )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <p className="text-muted-foreground">
                      Applicant: <span className="font-medium text-foreground truncate">{lc.applicantName || 'N/A'}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Beneficiary: <span className="font-medium text-foreground truncate">{lc.beneficiaryName || 'N/A'}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Value: <span className="font-medium text-foreground">{formatCurrencyValue(lc.currency, lc.amount)}</span>
                    </p>
                  </div>
                   <div className="mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <p className="text-xs text-muted-foreground">
                        Created: {isValid(lc.createdAtDate) && lc.createdAtDate.getFullYear() > 1 ? format(lc.createdAtDate, 'PPP p') : 'Date not available'}
                    </p>
                    <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="text-xs text-primary hover:underline mt-1 sm:mt-0 inline-flex items-center">
                        View/Edit L/C <ExternalLink className="ml-1 h-3 w-3"/>
                    </Link>
                   </div>
                </li>
              ))}
            </ul>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              {getPageNumbers().map((page, index) =>
                typeof page === 'number' ? (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-draft-${index}`} className="px-2 py-1 text-sm">
                    {page}
                  </span>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

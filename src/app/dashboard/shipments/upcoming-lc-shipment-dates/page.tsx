
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CalendarClock, Info, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LCEntryDocument, LCStatus, Currency } from '@/types'; 
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid, startOfDay, compareAsc } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

interface UpcomingLC extends Pick<LCEntryDocument, 'id' | 'documentaryCreditNumber' | 'beneficiaryName' | 'status' | 'applicantName' | 'currency' | 'amount' | 'lcIssueDate' | 'latestShipmentDate' | 'etd' | 'eta' | 'isFirstShipment' | 'isSecondShipment' | 'isThirdShipment'> { 
  latestShipmentDateObj: Date;
}

const ITEMS_PER_PAGE = 10;
const ACTIVE_LC_STATUSES_FOR_UPCOMING: LCStatus[] = ["Transmitted", "Shipment Pending", "Payment Pending"]; 

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

const formatDisplayDate = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'Invalid Date Format';
  }
};

const formatCurrencyValue = (currency?: Currency | string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function UpcomingLcShipmentDatesPage() {
  const [allUpcomingLCs, setAllUpcomingLCs] = useState<UpcomingLC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchUpcomingLCs = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");
        const q = query(
          lcEntriesRef,
          where("status", "in", ACTIVE_LC_STATUSES_FOR_UPCOMING),
          orderBy("latestShipmentDate", "asc")
        );
        const querySnapshot = await getDocs(q);

        const fetchedLCs = querySnapshot.docs.map(doc => {
          const data = doc.data() as LCEntryDocument;
          let latestShipmentDateObj = new Date(0); 
          if (data.latestShipmentDate) {
            const parsed = parseISO(data.latestShipmentDate);
            if (isValid(parsed)) {
              latestShipmentDateObj = parsed;
            }
          }
          
          return {
            id: doc.id,
            documentaryCreditNumber: data.documentaryCreditNumber,
            beneficiaryName: data.beneficiaryName,
            applicantName: data.applicantName, 
            currency: data.currency, 
            amount: data.amount, 
            lcIssueDate: data.lcIssueDate,
            latestShipmentDate: data.latestShipmentDate,
            latestShipmentDateObj: latestShipmentDateObj,
            etd: data.etd,
            eta: data.eta,
            status: data.status,
            isFirstShipment: data.isFirstShipment,
            isSecondShipment: data.isSecondShipment,
            isThirdShipment: data.isThirdShipment,
          };
        });
        setAllUpcomingLCs(fetchedLCs);

      } catch (error: any) {
        console.error("Error fetching upcoming L/Cs: ", error);
        let errorMessage = `Could not fetch upcoming L/C data. Please ensure Firestore rules allow reads.`;
        if (error.message && error.message.includes("indexes?create_composite")) {
            errorMessage = `Could not fetch upcoming L/C data. This query likely requires a composite Firestore index. Please check your browser's developer console for a direct link to create it. The index is needed on the 'lc_entries' collection for fields: 'status' (IN array) and 'latestShipmentDate' (ascending).`;
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

    fetchUpcomingLCs();
  }, []);

  const totalPages = Math.ceil(allUpcomingLCs.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = allUpcomingLCs.slice(indexOfFirstItem, indexOfLastItem);

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
            <CalendarClock className="h-7 w-7 text-primary" />
            Upcoming L/C Shipment Dates
          </CardTitle>
          <CardDescription>
            List of L/Cs with active shipment statuses, sorted by nearest latest shipment date.
            Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, allUpcomingLCs.length)} of {allUpcomingLCs.length} entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading upcoming L/Cs from database...</p>
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
              <p className="text-xl font-semibold text-muted-foreground">No Upcoming L/Cs Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no active L/Cs nearing their shipment date, or the required Firestore index is missing/still building.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {currentItems.map((lc) => {
                const today = startOfDay(new Date());
                const shipmentDate = startOfDay(lc.latestShipmentDateObj);
                const isPastOrToday = isValid(shipmentDate) && compareAsc(shipmentDate, today) <= 0;
                
                return (
                  <li
                    key={lc.id}
                    className={cn(
                        "p-4 rounded-lg hover:shadow-md transition-shadow relative", 
                        isPastOrToday
                            ? "bg-red-100 dark:bg-red-900/50 border-red-500 dark:border-red-600 border-2"
                            : "border bg-card"
                    )}
                  >
                     <div className="absolute top-4 right-4 flex flex-col items-end space-y-1 z-10">
                        <Badge
                            variant={getStatusBadgeVariant(lc.status)}
                            className={cn(
                                lc.status === 'Shipment Pending' ? 'bg-yellow-500 text-black dark:bg-yellow-600 dark:text-black' :
                                lc.status === 'Transmitted' ? 'bg-blue-500 text-white dark:bg-blue-600' : ''
                            )}
                            >
                            {lc.status || 'N/A'}
                        </Badge>
                        <div className="flex gap-1.5">
                            <Link href={`/dashboard/total-lc/${lc.id}/edit`} passHref>
                                <Button
                                    variant={lc.isFirstShipment ? "default" : "outline"}
                                    size="icon"
                                    className={cn(
                                        "h-7 w-7 rounded-full p-0 text-xs font-bold",
                                        lc.isFirstShipment ? "bg-green-500 hover:bg-green-600 text-white" : "border-destructive text-destructive hover:bg-destructive/10"
                                    )}
                                    title="1st Shipment Status"
                                >
                                    1st
                                </Button>
                            </Link>
                            <Link href={`/dashboard/total-lc/${lc.id}/edit`} passHref>
                                <Button
                                    variant={lc.isSecondShipment ? "default" : "outline"}
                                    size="icon"
                                    className={cn(
                                        "h-7 w-7 rounded-full p-0 text-xs font-bold",
                                        lc.isSecondShipment ? "bg-green-500 hover:bg-green-600 text-white" : "border-destructive text-destructive hover:bg-destructive/10"
                                    )}
                                    title="2nd Shipment Status"
                                >
                                    2nd
                                </Button>
                            </Link>
                             <Link href={`/dashboard/total-lc/${lc.id}/edit`} passHref>
                                <Button
                                    variant={lc.isThirdShipment ? "default" : "outline"}
                                    size="icon"
                                    className={cn(
                                        "h-7 w-7 rounded-full p-0 text-xs font-bold",
                                        lc.isThirdShipment ? "bg-green-500 hover:bg-green-600 text-white" : "border-destructive text-destructive hover:bg-destructive/10"
                                    )}
                                    title="3rd Shipment Status"
                                >
                                    3rd
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-semibold text-primary hover:underline text-lg mb-1 block truncate pr-28"> 
                      {lc.documentaryCreditNumber || 'N/A'}
                    </Link>
                    
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm mb-1">
                      <p className="text-muted-foreground">
                        Applicant: <span className="font-medium text-foreground truncate">{lc.applicantName || 'N/A'}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Beneficiary: <span className="font-medium text-foreground truncate">{lc.beneficiaryName || 'N/A'}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Value: <span className="font-medium text-foreground">{formatCurrencyValue(lc.currency, lc.amount)}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Latest Shipment: <span className={cn("font-medium", isPastOrToday ? "text-destructive dark:text-red-400" : "text-foreground")}>{formatDisplayDate(lc.latestShipmentDateObj)}</span>
                      </p>
                       <p className="text-muted-foreground">
                        ETD: <span className="font-medium text-foreground">{formatDisplayDate(lc.etd)}</span>
                      </p>
                       <p className="text-muted-foreground">
                        ETA: <span className="font-medium text-foreground">{formatDisplayDate(lc.eta)}</span>
                      </p>
                    </div>
                    
                    <div className="mt-2 flex justify-end">
                         <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="text-xs text-primary hover:underline inline-flex items-center">
                            View L/C Details <ExternalLink className="ml-1 h-3 w-3"/>
                        </Link>
                    </div>
                  </li>
                );
              })}
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
                  <span key={`ellipsis-upcoming-lc-${index}`} className="px-2 py-1 text-sm">
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

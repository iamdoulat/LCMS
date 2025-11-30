
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CalendarClock, Info, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight, Filter, XCircle, Users, Building, CalendarDays, Hash } from 'lucide-react';
import type { LCEntryDocument, LCStatus, Currency, CustomerDocument, SupplierDocument } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp, orderBy as firestoreOrderBy } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid, differenceInDays, addDays, startOfDay, isWithinInterval, subDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';

interface ExpiringLC extends LCEntryDocument {
  expireDateObj: Date;
  remainingDays: number;
}

const ITEMS_PER_PAGE = 10;
const PLACEHOLDER_APPLICANT_VALUE = "__LC_EXPIRE_APPLICANT__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__LC_EXPIRE_BENEFICIARY__";


const getStatusBadgeVariant = (status?: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Draft': return 'outline';
    case 'Transmitted': return 'secondary';
    case 'Shipment Pending': return 'default';
    case 'Payment Pending': return 'destructive';
    case 'Payment Done': return 'default';
    case 'Shipment Done': return 'default';
    default: return 'outline';
  }
};

const formatDisplayDate = (dateString?: string | Date) => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (currency?: string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function LcExpireTrackerPage() {
  const [allExpiringLCs, setAllExpiringLCs] = useState<ExpiringLC[]>([]);
  const [displayedLCs, setDisplayedLCs] = useState<ExpiringLC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states
  const [filterLcNumber, setFilterLcNumber] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');

  const [applicantOptions, setApplicantOptions] = useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = useState(true);

  useEffect(() => {
    const fetchExpiringLCs = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");
        const today = startOfDay(new Date());
        const thirtyDaysAgo = subDays(today, 30);
        
        // Fetch all LCs that have a "Shipment Pending" status. We will filter by date on the client.
        const arrayQuery = query(lcEntriesRef, where("status", "array-contains", "Shipment Pending"));
        const stringQuery = query(lcEntriesRef, where("status", "==", "Shipment Pending"));

        const [arraySnapshot, stringSnapshot] = await Promise.all([
            getDocs(arrayQuery),
            getDocs(stringQuery),
        ]);
        
        const expiringLCsMap = new Map<string, ExpiringLC>();
        
        const processSnapshot = (snapshot: typeof arraySnapshot) => {
            snapshot.docs.forEach((doc) => {
                if (expiringLCsMap.has(doc.id)) return; // Avoid duplicates

                const data = doc.data() as LCEntryDocument;
                const expireDateObj = data.expireDate ? parseISO(data.expireDate as string) : new Date(0);
                const remainingDays = differenceInDays(expireDateObj, today);

                // Client-side filtering
                if (isValid(expireDateObj) && isWithinInterval(expireDateObj, { start: thirtyDaysAgo, end: today })) {
                    expiringLCsMap.set(doc.id, {
                        ...data,
                        id: doc.id,
                        expireDateObj,
                        remainingDays,
                    });
                }
            });
        };
        
        processSnapshot(arraySnapshot);
        processSnapshot(stringSnapshot);

        const expiringLCs = Array.from(expiringLCsMap.values());
        expiringLCs.sort((a, b) => b.expireDateObj.getTime() - a.expireDateObj.getTime());
        
        setAllExpiringLCs(expiringLCs);

      } catch (error: any) {
        console.error("Error fetching expiring L/Cs: ", error);
        let errorMessage = `Could not fetch L/C data. Ensure Firestore rules allow reads.`;
         if (error.message?.toLowerCase().includes("index")) {
            errorMessage = `A Firestore index is required for this query. Please check browser console for a link to create it. The query needs an index on 'status' (array-contains).`;
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
     const fetchFilterOptions = async () => {
        setIsLoadingApplicants(true);
        setIsLoadingBeneficiaries(true);
        try {
            const customersSnapshot = await getDocs(collection(firestore, "customers"));
            setApplicantOptions(customersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as CustomerDocument).applicantName || 'Unnamed' })));
            const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
            setBeneficiaryOptions(suppliersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as SupplierDocument).beneficiaryName || 'Unnamed' })));
        } catch (error: any) {
            Swal.fire("Error", `Could not load filter options: ${(error as Error).message}`, "error");
        } finally {
            setIsLoadingApplicants(false);
            setIsLoadingBeneficiaries(false);
        }
    };

    fetchExpiringLCs();
    fetchFilterOptions();
  }, []);
  
  useEffect(() => {
    let filtered = [...allExpiringLCs];
    if (filterLcNumber) filtered = filtered.filter(lc => lc.documentaryCreditNumber?.toLowerCase().includes(filterLcNumber.toLowerCase()));
    if (filterApplicantId) filtered = filtered.filter(lc => lc.applicantId === filterApplicantId);
    if (filterBeneficiaryId) filtered = filtered.filter(lc => lc.beneficiaryId === filterBeneficiaryId);
    setDisplayedLCs(filtered);
    setCurrentPage(1);
  }, [allExpiringLCs, filterLcNumber, filterApplicantId, filterBeneficiaryId]);

  const clearFilters = () => {
    setFilterLcNumber('');
    setFilterApplicantId('');
    setFilterBeneficiaryId('');
    setCurrentPage(1);
  };
  
  const totalPages = Math.ceil(displayedLCs.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedLCs.slice(indexOfFirstItem, indexOfLastItem);
  
  const handlePageChange = (page: number) => setCurrentPage(page);

  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-destructive", "bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-transparent bg-clip-text")}>
            <CalendarClock className="h-7 w-7 text-destructive" />
            L/C Expire Tracker
          </CardTitle>
          <CardDescription>
            List of all L/Cs with "Shipment Pending" status that have expired in the last 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div><Label htmlFor="lcNoFilter">L/C Number</Label><Input id="lcNoFilter" placeholder="Search by L/C No..." value={filterLcNumber} onChange={(e) => setFilterLcNumber(e.target.value)} /></div>
                <div><Label htmlFor="applicantFilter" className="flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground"/>Applicant</Label>
                  <Combobox options={applicantOptions} value={filterApplicantId || PLACEHOLDER_APPLICANT_VALUE} onValueChange={(v) => setFilterApplicantId(v === PLACEHOLDER_APPLICANT_VALUE ? '' : v)} placeholder="Search Applicant..." selectPlaceholder="All Applicants" disabled={isLoadingApplicants}/>
                </div>
                <div><Label htmlFor="beneficiaryFilter" className="flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground"/>Beneficiary</Label>
                  <Combobox options={beneficiaryOptions} value={filterBeneficiaryId || PLACEHOLDER_BENEFICIARY_VALUE} onValueChange={(v) => setFilterBeneficiaryId(v === PLACEHOLDER_BENEFICIARY_VALUE ? '' : v)} placeholder="Search Beneficiary..." selectPlaceholder="All Beneficiaries" disabled={isLoadingBeneficiaries}/>
                </div>
                <div className="pt-6"><Button onClick={clearFilters} variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Clear Filters</Button></div>
              </div>
            </CardContent>
          </Card>
          {isLoading ? (
             <div className="flex flex-col items-center justify-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /><p>Loading expired L/Cs...</p></div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: fetchError.replace(/\b(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline">$1</a>') }}></p>
            </div>
          ) : displayedLCs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Expired L/Cs Found</p>
              <p className="text-sm text-muted-foreground text-center">{allExpiringLCs.length > 0 ? "No records match your current filters." : "No L/Cs expired in the last 30 days."}</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                 <TableHeader><TableRow>
                    <TableHead>LC No.</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead>L/C Value</TableHead>
                    <TableHead>Expired Date</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {currentItems.map((lc) => (
                    <TableRow key={lc.id}>
                      <TableCell className="font-medium">{lc.documentaryCreditNumber || 'N/A'}</TableCell>
                      <TableCell>{lc.applicantName || 'N/A'}</TableCell>
                      <TableCell>{lc.beneficiaryName || 'N/A'}</TableCell>
                      <TableCell>{formatCurrencyValue(lc.currency, lc.amount)}</TableCell>
                      <TableCell>{formatDisplayDate(lc.expireDateObj)}</TableCell>
                      <TableCell>
                        <Badge variant={"destructive"}>
                          {Math.abs(lc.remainingDays)} days ago
                        </Badge>
                      </TableCell>
                       <TableCell>
                        <Badge variant="destructive">Expired</Badge>
                      </TableCell>
                       <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/total-lc/${lc.id}/edit`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                 <TableCaption>A list of L/Cs that expired in the last 30 days.</TableCaption>
              </Table>
            </div>
          )}
           {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-4">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Prev</Button>
              <span className="text-sm">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

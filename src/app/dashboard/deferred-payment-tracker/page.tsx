
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CalendarClock, Info, AlertTriangle, PlusCircle, MoreHorizontal, Edit, Trash2, Filter, XCircle, Users, Building } from 'lucide-react';
import type { Currency, CustomerDocument, SupplierDocument } from '@/types';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy as firestoreOrderBy, doc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { format, parseISO, isValid, differenceInDays, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,

  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { termsOfPayOptions } from '@/types';


interface DeferredPaymentRecord {
  id: string;
  documentaryCreditNumber?: string;
  applicantId?: string;
  applicantName?: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
  lcValue?: number;
  lcCurrency?: Currency;
  shipmentValue?: number;
  termsOfPay?: string;
  isFirstShipment?: boolean;
  isSecondShipment?: boolean;
  isThirdShipment?: boolean;
  shipmentDate: string;
  maturityDate: string;
  remainingDays?: number;
  status?: 'Payment Pending' | 'Payment Done';
  shipmentMode?: 'Sea' | 'Air';
}

const formatDisplayDate = (dateString?: string | Date) => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (currency?: string | Currency, amount?: number) => {
  const currencyCode = typeof currency === 'string' ? currency : (currency?.code || '');
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencyCode} N/A`;
  return `${currencyCode} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const PLACEHOLDER_APPLICANT_VALUE = "__DEFERRED_TRACKER_APPLICANT__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__DEFERRED_TRACKER_BENEFICIARY__";
const ALL_STATUSES = "__ALL_STATUSES__";
const ALL_TERMS = "__ALL_TERMS__";


export default function DeferredPaymentTrackerPage() {
  const router = useRouter();
  const [allDeferredPayments, setAllDeferredPayments] = useState<DeferredPaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter states
  const [filterLcNo, setFilterLcNo] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Payment Pending');
  const [filterDeferredPeriod, setFilterDeferredPeriod] = useState('');

  const [applicantOptions, setApplicantOptions] = useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = useState(true);

  const fetchDeferredPayments = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const trackerRef = collection(firestore, "deferred_payment_tracker");
      const q = query(trackerRef, firestoreOrderBy("maturityDate", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedRecords = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeferredPaymentRecord));
      setAllDeferredPayments(fetchedRecords);
    } catch (error: any) {
      console.error("Error fetching deferred payment tracker data: ", error);
      let errorMessage = `Could not fetch tracker data. Please ensure Firestore rules allow reads.`;
      if (error.message?.toLowerCase().includes("index")) {
        errorMessage = `A Firestore index is required for this query. Please check the browser console for a link to create it automatically.`;
      } else if (error.message) {
        errorMessage += ` Error: ${error.message}`;
      }
      setFetchError(errorMessage);
      Swal.fire({
        title: "Fetch Error",
        html: errorMessage,
        icon: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeferredPayments();
    const fetchFilterOptions = async () => {
      setIsLoadingApplicants(true);
      setIsLoadingBeneficiaries(true);
      try {
        const customersSnapshot = await getDocs(collection(firestore, "customers"));
        setApplicantOptions(
          customersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
        );
        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        setBeneficiaryOptions(
          suppliersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );
      } catch (error: any) {
        console.error("Error fetching filter options:", error);
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };
    fetchFilterOptions();
  }, []);

  const filteredPayments = useMemo(() => {
    return allDeferredPayments.filter(payment => {
      const lcNoMatch = !filterLcNo || payment.documentaryCreditNumber?.toLowerCase().includes(filterLcNo.toLowerCase());
      const applicantMatch = !filterApplicantId || payment.applicantId === filterApplicantId;
      const beneficiaryMatch = !filterBeneficiaryId || payment.beneficiaryId === filterBeneficiaryId;
      const statusMatch = !filterStatus || payment.status === filterStatus;
      const deferredPeriodMatch = !filterDeferredPeriod || payment.termsOfPay === filterDeferredPeriod;
      return lcNoMatch && applicantMatch && beneficiaryMatch && statusMatch && deferredPeriodMatch;
    });
  }, [allDeferredPayments, filterLcNo, filterApplicantId, filterBeneficiaryId, filterStatus, filterDeferredPeriod]);


  const handleEdit = (id: string) => {
    router.push(`/dashboard/deferred-payment-tracker/edit/${id}`);
  };

  const handleDelete = async (id: string) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "This will permanently delete this tracking entry. This action cannot be undone.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "deferred_payment_tracker", id));
          Swal.fire('Deleted!', 'The tracking entry has been deleted.', 'success');
          fetchDeferredPayments(); // Refetch data
        } catch (e: any) {
          Swal.fire('Error', `Could not delete the entry: ${e.message}`, 'error');
        }
      }
    });
  };

  const clearFilters = () => {
    setFilterLcNo('');
    setFilterApplicantId('');
    setFilterBeneficiaryId('');
    setFilterStatus('Payment Pending');
    setFilterDeferredPeriod('');
  };


  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <CalendarClock className="h-7 w-7 text-primary" />
                Deferred Payment Tracker
              </CardTitle>
              <CardDescription>
                A list of all deferred payment entries, sorted by maturity date.
              </CardDescription>
            </div>
            <Link href="/dashboard/shipments/payment-tracking-entry" passHref>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Payment Tracking Entry
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4"><CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle></CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div><Label htmlFor="lcNoFilter">L/C No.</Label><Input id="lcNoFilter" placeholder="Search by L/C No..." value={filterLcNo} onChange={(e) => setFilterLcNo(e.target.value)} /></div>
                <div><Label htmlFor="applicantFilter" className="flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground" />Applicant</Label>
                  <Combobox options={applicantOptions} value={filterApplicantId || PLACEHOLDER_APPLICANT_VALUE} onValueChange={(v) => setFilterApplicantId(v === PLACEHOLDER_APPLICANT_VALUE ? '' : v)} placeholder="Search Applicant..." selectPlaceholder="All Applicants" disabled={isLoadingApplicants} />
                </div>
                <div><Label htmlFor="beneficiaryFilter" className="flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground" />Beneficiary</Label>
                  <Combobox options={beneficiaryOptions} value={filterBeneficiaryId || PLACEHOLDER_BENEFICIARY_VALUE} onValueChange={(v) => setFilterBeneficiaryId(v === PLACEHOLDER_BENEFICIARY_VALUE ? '' : v)} placeholder="Search Beneficiary..." selectPlaceholder="All Beneficiaries" disabled={isLoadingBeneficiaries} />
                </div>
                <div><Label htmlFor="statusFilter">Status</Label>
                  <Select value={filterStatus || ALL_STATUSES} onValueChange={(value) => setFilterStatus(value === ALL_STATUSES ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent><SelectItem value={ALL_STATUSES}>All Statuses</SelectItem><SelectItem value="Payment Pending">Payment Pending</SelectItem><SelectItem value="Payment Done">Payment Done</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="deferredPeriodFilter">Deferred Period</Label>
                  <Select value={filterDeferredPeriod || ALL_TERMS} onValueChange={(value) => setFilterDeferredPeriod(value === ALL_TERMS ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="All Periods" /></SelectTrigger>
                    <SelectContent><SelectItem value={ALL_TERMS}>All Periods</SelectItem>{termsOfPayOptions.filter(t => t.startsWith("Deferred")).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="pt-6"><Button onClick={clearFilters} variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Clear Filters</Button></div>
              </div>
            </CardContent>
          </Card>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading deferred payment records...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: fetchError.replace(/\b(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline">$1</a>') }}></p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Records Found</p>
              <p className="text-sm text-muted-foreground text-center">{allDeferredPayments.length > 0 ? "No records match your current filters." : "There are no deferred payment tracking entries yet."}</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>LC No.</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead>L/C Value</TableHead>
                    <TableHead>Shipment Value</TableHead>
                    <TableHead>Deferred Period</TableHead>
                    <TableHead>Partial</TableHead>
                    <TableHead>Shipment Date</TableHead>
                    <TableHead>Maturity Date</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Status*</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((entry, index) => {
                    const today = startOfDay(new Date());
                    const maturity = parseISO(entry.maturityDate);
                    const remainingDays = isValid(maturity) ? differenceInDays(maturity, today) : null;

                    return (
                      <TableRow key={entry.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{entry.documentaryCreditNumber || 'N/A'}</TableCell>
                        <TableCell>{entry.applicantName || 'N/A'}</TableCell>
                        <TableCell>{entry.beneficiaryName || 'N/A'}</TableCell>
                        <TableCell>{formatCurrencyValue(entry.lcCurrency, entry.lcValue)}</TableCell>
                        <TableCell>{formatCurrencyValue(entry.lcCurrency, entry.shipmentValue)}</TableCell>
                        <TableCell>{entry.termsOfPay || 'N/A'}</TableCell>
                        <TableCell>
                          {entry.isFirstShipment && <Badge variant="secondary">1st</Badge>}
                          {entry.isSecondShipment && <Badge variant="secondary">2nd</Badge>}
                          {entry.isThirdShipment && <Badge variant="secondary">3rd</Badge>}
                        </TableCell>
                        <TableCell>{formatDisplayDate(entry.shipmentDate)}</TableCell>
                        <TableCell>{formatDisplayDate(entry.maturityDate)}</TableCell>
                        <TableCell className={cn("font-semibold", remainingDays !== null && remainingDays < 15 ? "text-destructive" : "text-foreground")}>
                          {remainingDays !== null ? `${remainingDays} days` : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.status === 'Payment Done' ? 'default' : 'destructive'}>
                            {entry.status || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEdit(entry.id)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(entry.id)} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

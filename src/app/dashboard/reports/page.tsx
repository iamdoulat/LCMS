

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { ListChecks, FileEdit, Trash2, Loader2, Search, Filter, XCircle, ArrowDownUp, Users, Building, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, BarChart3, Printer, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import type { LCEntryDocument, LCStatus, CustomerDocument, SupplierDocument, Currency } from '@/types';
import { lcStatusOptions, currencyOptions } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid, startOfDay, isAfter, isEqual } from 'date-fns';
import { collection, getDocs, deleteDoc, doc, query, orderBy as firestoreOrderBy, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';

const getStatusBadgeVariant = (status: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
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

const formatDisplayDate = (dateString?: string) => {
  if (!dateString || !isValid(parseISO(dateString))) return 'N/A';
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM do, yyyy');
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (currency?: Currency | string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface DropdownOption {
  value: string;
  label: string;
}

const sortOptions = [
  { value: "documentaryCreditNumber", label: "L/C Number" },
  { value: "applicantName", label: "Applicant Name" },
  { value: "beneficiaryName", label: "Beneficiary Name" },
  { value: "lcIssueDate", label: "Issue Date" },
  { value: "expireDate", label: "Expire Date" },
  { value: "latestShipmentDate", label: "Latest Shipment Date" },
  { value: "amount", label: "Amount" },
  { value: "status", label: "Status" },
  { value: "year", label: "Year" },
];

const currentSystemYear = new Date().getFullYear();
const yearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];

const ALL_YEARS_VALUE = "__ALL_YEARS__";
const ALL_STATUSES_VALUE = "__ALL_STATUSES__";
const ITEMS_PER_PAGE = 12;

// Helper to escape CSV data
const escapeCsvCell = (cellData: any): string => {
  const stringData = String(cellData ?? "");
  if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
    return `"${stringData.replace(/"/g, '""')}"`;
  }
  return stringData;
};


export default function ReportsPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isReadOnly = userRole === 'Viewer';
  const [allLcEntries, setAllLcEntries] = useState<LCEntryDocument[]>([]);
  const [displayedLcEntries, setDisplayedLcEntries] = useState<LCEntryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterLcNumber, setFilterLcNumber] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [filterShipmentDate, setFilterShipmentDate] = useState<Date | null>(null);
  const [filterStatus, setFilterStatus] = useState<LCStatus | ''>('');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  const [applicantOptions, setApplicantOptions] = useState<DropdownOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState<DropdownOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = useState(true);

  const [sortBy, setSortBy] = useState<string>('lcIssueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const lcQuery = query(collection(firestore, "lc_entries"), firestoreOrderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(lcQuery);
        const fetchedLCs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data } as LCEntryDocument;
        });
        setAllLcEntries(fetchedLCs);
      } catch (error: any) {
        const errorMsg = `Could not fetch L/C data. Error: ${error.message}`;
        setFetchError(errorMsg);
        Swal.fire("Error", errorMsg, "error");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchFilterOptions = async () => {
      setIsLoadingApplicants(true);
      setIsLoadingBeneficiaries(true);
      try {
        const customersSnapshot = await getDocs(collection(firestore, "customers"));
        setApplicantOptions(customersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as CustomerDocument).applicantName || 'Unnamed Applicant' })));
        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        setBeneficiaryOptions(suppliersSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' })));
      } catch (error: any) {
        Swal.fire("Error", `Could not load filter options. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };

    fetchInitialData();
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    let filtered = [...allLcEntries];

    if (filterLcNumber) filtered = filtered.filter(lc => lc.documentaryCreditNumber?.toLowerCase().includes(filterLcNumber.toLowerCase()));
    if (filterApplicantId) filtered = filtered.filter(lc => lc.applicantId === filterApplicantId);
    if (filterBeneficiaryId) filtered = filtered.filter(lc => lc.beneficiaryId === filterBeneficiaryId);
    
    if (filterShipmentDate) {
      const targetDate = startOfDay(filterShipmentDate);
      filtered = filtered.filter(lc => {
        if (!lc.latestShipmentDate) return false;
        try {
          const lcDate = startOfDay(parseISO(lc.latestShipmentDate));
          return isValid(lcDate) && (isAfter(lcDate, targetDate) || isEqual(lcDate, targetDate));
        } catch { return false; }
      });
    }
    
    if (filterStatus && filterStatus !== ALL_STATUSES_VALUE) {
      filtered = filtered.filter(lc => Array.isArray(lc.status) ? lc.status.includes(filterStatus) : lc.status === filterStatus);
    }
    
    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(lc => lc.year === yearNum);
    }

    if (sortBy) {
      filtered.sort((a, b) => {
        let valA = (a as any)[sortBy]; let valB = (b as any)[sortBy];
        if (sortBy.includes('Date') && typeof valA === 'string' && typeof valB === 'string') {
          try { valA = parseISO(valA); valB = parseISO(valB); } catch {}
        }
        if (sortBy === 'amount' || sortBy === 'year') { valA = Number(valA) || 0; valB = Number(valB) || 0; }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setDisplayedLcEntries(filtered);
    setCurrentPage(1);
  }, [allLcEntries, filterLcNumber, filterApplicantId, filterBeneficiaryId, filterShipmentDate, filterStatus, filterYear, sortBy, sortOrder]);

  const clearFilters = () => {
    setFilterLcNumber(''); setFilterApplicantId(''); setFilterBeneficiaryId('');
    setFilterShipmentDate(null); setFilterStatus('');
    setFilterYear(new Date().getFullYear().toString());
    setSortBy('lcIssueDate'); setSortOrder('desc');
    setCurrentPage(1);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (displayedLcEntries.length === 0) {
      Swal.fire("No Data", "There is no data to export.", "info");
      return;
    }

    const headers = [
      "L/C or TT No.", "Terms of Pay", "Applicant", "Value", "ETD", "ETA", "1st Shipment Note", "2nd Shipment Note", "3rd Shipment Note"
    ];

    const csvRows = [
      headers.join(','),
      ...displayedLcEntries.map(lc => [
        escapeCsvCell(lc.documentaryCreditNumber || 'N/A'),
        escapeCsvCell(lc.termsOfPay || 'N/A'),
        escapeCsvCell(lc.applicantName || 'N/A'),
        escapeCsvCell(formatCurrencyValue(lc.currency, lc.amount)),
        escapeCsvCell(formatDisplayDate(lc.etd)),
        escapeCsvCell(formatDisplayDate(lc.eta)),
        escapeCsvCell(lc.firstShipmentNote || 'N/A'),
        escapeCsvCell(lc.secondShipmentNote || 'N/A'),
        escapeCsvCell(lc.thirdShipmentNote || 'N/A'),
      ].join(','))
    ];

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `lc_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(displayedLcEntries.length / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedLcEntries.slice(indexOfFirstItem, indexOfLastItem);
  const handlePageChange = (page: number) => setCurrentPage(page);

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <BarChart3 className="h-7 w-7 text-primary" /> Reports
              </CardTitle>
              <CardDescription>Generate custom reports by filtering and sorting L/C data.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={handlePrint} variant="default" className="bg-primary hover:bg-primary/90">
                    <Printer className="mr-2 h-4 w-4" /> PDF Report
                </Button>
                <Button onClick={handleExport} variant="default" className="bg-green-600 hover:bg-green-700 text-white">
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Export to Excel
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4 noprint">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter &amp; Sort Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <label htmlFor="lcNumberFilter" className="text-sm font-medium">T/T OR L/C Number</label>
                  <Input id="lcNumberFilter" placeholder="Search by L/C No..." value={filterLcNumber} onChange={(e) => setFilterLcNumber(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="applicantFilter" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground"/>Applicant</label>
                  <Combobox options={applicantOptions} value={filterApplicantId} onValueChange={setFilterApplicantId} placeholder="Search Applicant..." selectPlaceholder={isLoadingApplicants ? "Loading..." : "All Applicants"} emptyStateMessage="No applicant found." disabled={isLoadingApplicants} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="beneficiaryFilter" className="text-sm font-medium flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground"/>Beneficiary</label>
                  <Combobox options={beneficiaryOptions} value={filterBeneficiaryId} onValueChange={setFilterBeneficiaryId} placeholder="Search Beneficiary..." selectPlaceholder={isLoadingBeneficiaries ? "Loading..." : "All Beneficiaries"} emptyStateMessage="No beneficiary found." disabled={isLoadingBeneficiaries} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="yearFilter" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Year</label>
                  <Select value={filterYear === '' ? ALL_YEARS_VALUE : filterYear} onValueChange={(v) => setFilterYear(v === ALL_YEARS_VALUE ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>{yearFilterOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="shipmentDateFilter" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground"/>Latest Shipment Date (On/After)</label>
                  <DatePickerField field={{ value: filterShipmentDate, onChange: setFilterShipmentDate, name: 'filterShipmentDate' }} placeholder="Select Date" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="statusFilter" className="text-sm font-medium flex items-center"><CheckSquare className="mr-1 h-4 w-4 text-muted-foreground"/>Status</label>
                  <Select value={filterStatus === '' ? ALL_STATUSES_VALUE : filterStatus} onValueChange={(v) => setFilterStatus(v === ALL_STATUSES_VALUE ? '' : v as LCStatus | '')}>
                    <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent><SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>{lcStatusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="sortBy" className="text-sm font-medium flex items-center"><ArrowDownUp className="mr-1 h-4 w-4 text-muted-foreground"/>Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{sortOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="pt-6">
                  <Button onClick={clearFilters} variant="outline" className="w-full"><XCircle className="mr-2 h-4 w-4" /> Clear Filters &amp; Sort</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          ) : fetchError ? (
            <div className="text-center text-destructive p-8">{fetchError}</div>
          ) : currentItems.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6">
                {currentItems.map(lc => (
                  <Card key={lc.id} className="shadow-md hover:shadow-lg transition-shadow duration-300">
                     <CardHeader className="bg-blue-500/10 p-3">
                        <div className="flex flex-wrap justify-start items-center gap-x-8 gap-y-2">
                            <div>
                                <p className="font-semibold text-primary">L/C or TT No.</p>
                                <p className="text-foreground font-bold text-lg">{lc.documentaryCreditNumber || 'N/A'}</p>
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-primary">Terms of Pay* :</p>
                                <p className="text-muted-foreground">{lc.termsOfPay || 'N/A'}</p>
                            </div>
                        </div>
                     </CardHeader>
                    <CardContent className="p-3">
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b">
                            <td className="py-2 pr-2 align-top">
                              <p className="font-semibold">Customer Name</p>
                              <p className="text-muted-foreground">{lc.applicantName || 'N/A'}</p>
                            </td>
                            <td className="py-2 px-2 align-top">
                                <p className="font-semibold">Value</p>
                                <p className="text-muted-foreground">{formatCurrencyValue(lc.currency, lc.amount)}</p>
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 pr-2 align-top">
                              <p className="font-semibold">Shipment Date</p>
                              <p className="text-muted-foreground">ETD: {formatDisplayDate(lc.etd)}</p>
                              <p className="text-muted-foreground">ETA: {formatDisplayDate(lc.eta)}</p>
                            </td>
                            <td className="py-2 px-2 align-top">
                                <p className="font-semibold">Shipment Note</p>
                                <p className="text-xs text-muted-foreground truncate" title={lc.firstShipmentNote}>1st: {lc.firstShipmentNote || 'N/A'}</p>
                                <p className="text-xs text-muted-foreground truncate" title={lc.secondShipmentNote}>2nd: {lc.secondShipmentNote || 'N/A'}</p>
                                <p className="text-xs text-muted-foreground truncate" title={lc.thirdShipmentNote}>3rd: {lc.thirdShipmentNote || 'N/A'}</p>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 py-4 mt-4 noprint">
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Prev</Button>
                  <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-8 text-muted-foreground">No L/C entries found matching your criteria.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



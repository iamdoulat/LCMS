
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/common';
import { Filter, XCircle, ArrowDownUp, Users, Building, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, BarChart3, Printer, FileSpreadsheet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { lcStatusOptions } from '@/types';
import type { LCEntryDocument, LCStatus, CustomerDocument, SupplierDocument, Currency } from '@/types';
import { format, parseISO, isValid, startOfDay, isAfter, isEqual } from 'date-fns';
import { collection, getDocs, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';

import { Skeleton } from '@/components/ui/skeleton';



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

const escapeCsvCell = (cellData: any): string => {
  const stringData = String(cellData ?? "");
  if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
    return `"${stringData.replace(/"/g, '""')}"`;
  }
  return stringData;
};

async function getInitialReportData() {
  const lcQuery = query(collection(firestore, "lc_entries"), firestoreOrderBy("createdAt", "desc"));
  const customersQuery = query(collection(firestore, "customers"));
  const suppliersQuery = query(collection(firestore, "suppliers"));

  const [lcSnapshot, customersSnapshot, suppliersSnapshot] = await Promise.all([
    getDocs(lcQuery),
    getDocs(customersQuery),
    getDocs(suppliersQuery)
  ]);

  const allLcEntries = lcSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LCEntryDocument));
  const applicantOptions = customersSnapshot.docs.map(doc => ({ value: doc.id, label: (doc.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }));
  const beneficiaryOptions = suppliersSnapshot.docs.map(doc => ({ value: doc.id, label: (doc.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }));

  return { allLcEntries, applicantOptions, beneficiaryOptions };
}

const ReportSkeleton = () => (
  <div className="space-y-4">
    <Card className="shadow-md p-4 noprint">
      <CardHeader className="p-2 pb-4"><Skeleton className="h-6 w-1/3" /></CardHeader>
      <CardContent className="p-2 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="space-y-1"><Skeleton className="h-5 w-24" /><Skeleton className="h-10 w-full" /></div>)}
        </div>
      </CardContent>
    </Card>
    <div className="my-4 text-center noprint flex flex-wrap justify-center items-center gap-4">
      <Skeleton className="h-10 w-48" />
      <div className="flex items-center gap-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-36" /></div>
    </div>
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="shadow-md hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="bg-primary/10 p-3"><div className="grid grid-cols-3 gap-x-4">
            <div className="text-left"><Skeleton className="h-4 w-20 mb-1" /><Skeleton className="h-5 w-32" /></div>
            <div className="text-left"><Skeleton className="h-4 w-24 mb-1" /><Skeleton className="h-5 w-40" /></div>
            <div className="text-left"><Skeleton className="h-4 w-28 mb-1" /><Skeleton className="h-5 w-36" /></div>
          </div></CardHeader>
          <CardContent className="p-3"><table className="w-full"><tbody>
            <tr className="align-top"><td className="py-2 pr-2 w-1/3"><Skeleton className="h-4 w-20 mb-1" /><Skeleton className="h-4 w-full" /></td>
              <td className="py-2 px-2 w-1/3"><Skeleton className="h-4 w-12 mb-1" /><Skeleton className="h-4 w-full" /></td>
              <td className="py-2 pl-2 w-1/3"><Skeleton className="h-4 w-24 mb-1" /><Skeleton className="h-4 w-full" /></td></tr>
            <tr className="align-top"><td className="py-2 pr-2"><Skeleton className="h-4 w-24 mb-1" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full mt-1" /></td>
              <td className="py-2 px-2"><Skeleton className="h-4 w-28 mb-1" /><Skeleton className="h-4 w-full" /></td>
              <td className="py-2 pl-2"><Skeleton className="h-4 w-24 mb-1" /><Skeleton className="h-4 w-full mt-1" /><Skeleton className="h-4 w-full mt-1" /><Skeleton className="h-4 w-full mt-1" /></td></tr>
          </tbody></table></CardContent>
        </Card>
      ))}
    </div>
  </div>
);


export default function ReportsPage() {
  const { userRole } = useAuth();
  const [initialData, setInitialData] = React.useState<{
    allLcEntries: LCEntryDocument[];
    applicantOptions: DropdownOption[];
    beneficiaryOptions: DropdownOption[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterLcNumber, setFilterLcNumber] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [filterShipmentDate, setFilterShipmentDate] = useState<Date | null>(null);
  const [filterStatus, setFilterStatus] = useState<LCStatus | ''>('Shipment Pending');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  const [sortBy, setSortBy] = useState<string>('lcIssueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [currentPage, setCurrentPage] = useState(1);


  useEffect(() => {
    getInitialReportData().then(data => {
      setInitialData(data);
    }).catch(error => {
      const errorMsg = `Could not fetch L/C data. Error: ${error.message}`;
      setFetchError(errorMsg);
      Swal.fire("Error", errorMsg, "error");
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const displayedLcEntries = useMemo(() => {
    if (!initialData) return [];
    let filtered = [...initialData.allLcEntries];

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

    if (filterStatus) {
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
          try { valA = parseISO(valA); valB = parseISO(valB); } catch { }
        }
        if (sortBy === 'amount' || sortBy === 'year') { valA = Number(valA) || 0; valB = Number(valB) || 0; }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [initialData, filterLcNumber, filterApplicantId, filterBeneficiaryId, filterShipmentDate, filterStatus, filterYear, sortBy, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [displayedLcEntries]);

  const clearFilters = () => {
    setFilterLcNumber(''); setFilterApplicantId(''); setFilterBeneficiaryId('');
    setFilterShipmentDate(null); setFilterStatus('');
    setFilterYear(new Date().getFullYear().toString());
    setSortBy('lcIssueDate'); setSortOrder('desc');
    setCurrentPage(1);
  };

  const handlePrint = () => {
    const reportIds = displayedLcEntries.map(lc => lc.id);
    if (reportIds.length === 0) {
      Swal.fire("No Data", "There are no reports matching the current filters to print.", "info");
      return;
    }

    const params = new URLSearchParams();
    params.append('ids', reportIds.join(','));
    params.append('statusLabel', filterStatus || 'All');

    const queryString = params.toString();
    window.open(`/dashboard/reports/print?${queryString}`, '_blank');
  };

  const handleExport = () => {
    if (displayedLcEntries.length === 0) {
      Swal.fire("No Data", "There is no data to export.", "info");
      return;
    }

    const headers = [
      "L/C or TT No.", "Terms of Pay", "Applicant", "Beneficiary", "Value", "ETD", "ETA", "1st Shipment Note", "2nd Shipment Note", "3rd Shipment Note"
    ];

    const csvRows = [
      headers.join(','),
      ...displayedLcEntries.map(lc => [
        escapeCsvCell(lc.documentaryCreditNumber || 'N/A'),
        escapeCsvCell(lc.termsOfPay || 'N/A'),
        escapeCsvCell(lc.applicantName || 'N/A'),
        escapeCsvCell(lc.beneficiaryName || 'N/A'),
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
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader className="noprint">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <BarChart3 className="h-7 w-7 text-primary" /> Reports
              </CardTitle>
              <CardDescription>Generate custom reports by filtering and sorting L/C data.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <ReportSkeleton /> : fetchError ? (
            <div className="text-center text-destructive p-8">{fetchError}</div>
          ) : (
            <>
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
                      <label htmlFor="applicantFilter" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground" />Applicant</label>
                      <Combobox options={initialData?.applicantOptions || []} value={filterApplicantId} onValueChange={setFilterApplicantId} placeholder="Search Applicant..." selectPlaceholder={isLoading ? "Loading..." : "All Applicants"} emptyStateMessage="No applicant found." disabled={isLoading} />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="beneficiaryFilter" className="text-sm font-medium flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground" />Beneficiary</label>
                      <Combobox options={initialData?.beneficiaryOptions || []} value={filterBeneficiaryId} onValueChange={setFilterBeneficiaryId} placeholder="Search Beneficiary..." selectPlaceholder={isLoading ? "Loading..." : "All Beneficiaries"} emptyStateMessage="No beneficiary found." disabled={isLoading} />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="yearFilter" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Year</label>
                      <Select value={filterYear === '' ? ALL_YEARS_VALUE : filterYear} onValueChange={(v) => setFilterYear(v === ALL_YEARS_VALUE ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                        <SelectContent>{yearFilterOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="shipmentDateFilter" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Latest Shipment Date (On/After)</label>
                      <DatePickerField
                        field={{
                          value: filterShipmentDate,
                          onChange: setFilterShipmentDate,
                          name: 'filterShipmentDate',
                          onBlur: () => { },
                          ref: () => { }
                        }}
                        placeholder="Select Date"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="statusFilter" className="text-sm font-medium flex items-center"><CheckSquare className="mr-1 h-4 w-4 text-muted-foreground" />Status</label>
                      <Select value={filterStatus === '' ? ALL_STATUSES_VALUE : filterStatus} onValueChange={(v) => setFilterStatus(v === ALL_STATUSES_VALUE ? '' : v as LCStatus | '')}>
                        <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                        <SelectContent><SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>{lcStatusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="sortBy" className="text-sm font-medium flex items-center"><ArrowDownUp className="mr-1 h-4 w-4 text-muted-foreground" />Sort By</label>
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

              <div className="my-4 text-center noprint flex flex-wrap justify-center items-center gap-4">
                <Button variant="outline" className="text-lg font-semibold border-2 border-primary text-primary cursor-default">
                  Report of : {filterStatus || 'All'}
                </Button>
                <div className="flex items-center gap-2">
                  <Button onClick={handlePrint} variant="default" className="bg-primary hover:bg-primary/90">
                    <Printer className="mr-2 h-4 w-4" /> PDF Report
                  </Button>
                  <Button onClick={handleExport} variant="default" className="bg-green-600 hover:bg-green-700 text-white">
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Export to Excel
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {currentItems.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 gap-6">
                      {currentItems.map(lc => (
                        <Card key={lc.id} className="shadow-md hover:shadow-lg transition-shadow duration-300 print:shadow-none print:border print:break-inside-avoid">
                          <CardHeader className="bg-primary text-primary-foreground p-3">
                            <div className="grid grid-cols-3 gap-x-4">
                              <div className="text-left">
                                <p className="font-semibold">L/C or TT No.</p>
                                <p className="text-lg">{lc.documentaryCreditNumber || 'N/A'}</p>
                              </div>
                              <div className="text-left">
                                <p className="font-semibold">Beneficiary</p>
                                <p className="truncate" title={lc.beneficiaryName || 'N/A'}>{lc.beneficiaryName || 'N/A'}</p>
                              </div>
                              <div className="text-left">
                                <p className="font-semibold">Terms of Pay* :</p>
                                <p>{lc.termsOfPay || 'N/A'}</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 bg-green-50 dark:bg-green-900/20">
                            <table className="w-full text-sm">
                              <tbody>
                                <tr className="align-top">
                                  <td className="py-1 pr-2 w-1/3">
                                    <p className="font-semibold">Customer Name</p>
                                    <p className="text-gray-600 dark:text-gray-300">{lc.applicantName || 'N/A'}</p>
                                  </td>
                                  <td className="py-1 px-2 w-1/3">
                                    <p className="font-semibold">Value</p>
                                    <p className="text-gray-600 dark:text-gray-300">{formatCurrencyValue(lc.currency, lc.amount)}</p>
                                  </td>
                                  <td className="py-1 pl-2 w-1/3">
                                    <p className="font-semibold">Invoice No:</p>
                                    <p className="text-gray-600 dark:text-gray-300">{lc.proformaInvoiceNumber || 'N/A'}</p>
                                  </td>
                                </tr>
                                <tr className="align-top">
                                  <td className="py-1 pr-2">
                                    <p className="font-semibold">Shipment Date</p>
                                    <p className="text-gray-600 dark:text-gray-300">ETD: {formatDisplayDate(lc.etd)}</p>
                                    <p className="text-gray-600 dark:text-gray-300">ETA: {formatDisplayDate(lc.eta)}</p>
                                  </td>
                                  <td className="py-1 px-2">
                                    <p className="font-semibold">Machine Qty:</p>
                                    <p className="text-gray-600 dark:text-gray-300">{lc.totalMachineQty || 'N/A'}</p>
                                  </td>
                                  <td className="py-1 pl-2">
                                    <p className="font-semibold">Shipment Note</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400"><span className="font-semibold">1st:</span> {lc.firstShipmentNote || 'N/A'}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400"><span className="font-semibold">2nd:</span> {lc.secondShipmentNote || 'N/A'}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400"><span className="font-semibold">3rd:</span> {lc.thirdShipmentNote || 'N/A'}</p>
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
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

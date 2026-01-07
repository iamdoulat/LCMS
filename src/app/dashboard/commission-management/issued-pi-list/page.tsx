
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { PlusCircle, ListChecks, FileEdit, Trash2, Loader2, Filter, XCircle, ArrowDownUp, Users, Building, CalendarDays, Clock, ChevronLeft, ChevronRight, MoreHorizontal, Download } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Swal from 'sweetalert2';
import type { ProformaInvoiceDocument, CustomerDocument, SupplierDocument } from '@/types';

import { format, parseISO, isValid, getMonth, getYear } from 'date-fns';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MM/dd/yyyy') : 'Invalid Date';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (amount?: number, currencySymbol: string = '$') => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencySymbol} N/A`;
  return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercentage = (percentage?: number) => {
  if (typeof percentage !== 'number' || isNaN(percentage)) return 'N/A %';
  return `${percentage.toFixed(2)}%`;
}

const getDataUrl = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error fetching image for PDF:", error);
    return "";
  }
};

const piSortOptions = [
  { value: "piNo", label: "PI Number" },
  { value: "piDate", label: "PI Date" },
  { value: "applicantName", label: "Applicant Name" },
  { value: "beneficiaryName", label: "Beneficiary Name" },
  { value: "grandTotalSalesPrice", label: "Grand Total" },
  { value: "totalCommissionPercentage", label: "Commission %" },
  { value: "salesPersonName", label: "Sales Person" },
];

const currentSystemYear = new Date().getFullYear();
const piYearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 5) }, (_, i) => (2020 + i).toString())]; // 2020 to currentYear + 4

const monthOptions = [
  "All Months", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const ALL_YEARS_VALUE = "All Years";
const ALL_MONTHS_VALUE = "All Months";
const ALL_STATUS_VALUE = "All Status";
const statusFilterOptions = [ALL_STATUS_VALUE, "Pending", "Paid", "Rejected"];
const PLACEHOLDER_APPLICANT_VALUE = "__PI_LIST_APPLICANT_PLACEHOLDER__";
const PLACEHOLDER_BENEFICIARY_VALUE = "__PI_LIST_BENEFICIARY_PLACEHOLDER__";
const PI_ITEMS_PER_PAGE = 10;

export default function IssuedPIListPage() {
  const router = useRouter();
  const { userRole, companyName, companyLogoUrl, address, invoiceLogoUrl } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const [allProformaInvoices, setAllProformaInvoices] = useState<ProformaInvoiceDocument[]>([]);
  const [displayedProformaInvoices, setDisplayedProformaInvoices] = useState<ProformaInvoiceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const [filterPiNo, setFilterPiNo] = useState('');
  const [filterApplicantId, setFilterApplicantId] = useState('');
  const [filterBeneficiaryId, setFilterBeneficiaryId] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>(ALL_MONTHS_VALUE);
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);
  const [filterStatus, setFilterStatus] = useState<string>("Pending");

  const [applicantOptions, setApplicantOptions] = useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingApplicants, setIsLoadingApplicants] = useState(true);
  const [isLoadingBeneficiaries, setIsLoadingBeneficiaries] = useState(true);

  const [sortBy, setSortBy] = useState<string>('piDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(firestore, "proforma_invoices"));
        const fetchedPIs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
          } as ProformaInvoiceDocument;
        });
        setAllProformaInvoices(fetchedPIs);
      } catch (error: any) {
        console.error("Error fetching Proforma Invoices: ", error);
        Swal.fire("Error", `Could not fetch PI data from Firestore. Please check console for details and ensure Firestore rules allow reads. Error: ${error.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchFilterOptions = async () => {
      setIsLoadingApplicants(true);
      setIsLoadingBeneficiaries(true);
      try {
        const customersSnapshot = await getDocs(collection(firestore, "customers"));
        setApplicantOptions(
          customersSnapshot.docs.map(doc => ({ value: doc.id, label: (doc.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
        );
        const suppliersSnapshot = await getDocs(collection(firestore, "suppliers"));
        setBeneficiaryOptions(
          suppliersSnapshot.docs.map(doc => ({ value: doc.id, label: (doc.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );
      } catch (error: any) {
        console.error("Error fetching filter options for PI list:", error);
        Swal.fire("Error", `Could not load filter options for applicants/beneficiaries. Error: ${(error as Error).message}`, "error");
      } finally {
        setIsLoadingApplicants(false);
        setIsLoadingBeneficiaries(false);
      }
    };

    fetchInitialData();
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    let filtered = [...allProformaInvoices];

    if (filterPiNo) {
      filtered = filtered.filter(pi => pi.piNo?.toLowerCase().includes(filterPiNo.toLowerCase()));
    }
    if (filterApplicantId) {
      filtered = filtered.filter(pi => pi.applicantId === filterApplicantId);
    }
    if (filterBeneficiaryId) {
      filtered = filtered.filter(pi => pi.beneficiaryId === filterBeneficiaryId);
    }
    if (filterStatus !== ALL_STATUS_VALUE) {
      filtered = filtered.filter(pi => pi.status === filterStatus || (!pi.status && filterStatus === "Pending"));
    }

    const selectedYearNum = filterYear !== ALL_YEARS_VALUE ? parseInt(filterYear) : null;
    const selectedMonthNum = filterMonth !== ALL_MONTHS_VALUE ? monthOptions.indexOf(filterMonth) - 1 : null; // 0-indexed month

    if (selectedYearNum !== null || selectedMonthNum !== null) {
      filtered = filtered.filter(pi => {
        if (!pi.piDate) return false;
        try {
          const date = parseISO(pi.piDate);
          if (!isValid(date)) return false;
          const piYear = getYear(date);
          const piMonth = getMonth(date); // 0-indexed

          const yearMatch = selectedYearNum === null || piYear === selectedYearNum;
          const monthMatch = selectedMonthNum === null || piMonth === selectedMonthNum;

          return yearMatch && monthMatch;
        } catch {
          return false;
        }
      });
    }


    if (sortBy) {
      filtered.sort((a, b) => {
        let valA = (a as any)[sortBy];
        let valB = (b as any)[sortBy];

        if (sortBy === 'piDate' && typeof valA === 'string' && typeof valB === 'string') {
          try {
            valA = parseISO(valA);
            valB = parseISO(valB);
            if (!isValid(valA) && isValid(valB)) return sortOrder === 'asc' ? 1 : -1;
            if (isValid(valA) && !isValid(valB)) return sortOrder === 'asc' ? -1 : 1;
            if (!isValid(valA) && !isValid(valB)) return 0;
          } catch { /* ignore parsing error, will compare as strings or fall through */ }
        }

        if (sortBy === 'grandTotalSalesPrice' || sortBy === 'totalCommissionPercentage') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setDisplayedProformaInvoices(filtered);
    setCurrentPage(1);
  }, [allProformaInvoices, filterPiNo, filterApplicantId, filterBeneficiaryId, filterMonth, filterYear, filterStatus, sortBy, sortOrder]);

  const handleEditPI = (piId: string) => {
    if (!piId) {
      Swal.fire("Error", "PI ID is missing, cannot edit.", "error");
      return;
    }
    router.push(`/dashboard/commission-management/edit-pi/${piId}`);
  };

  const handleDeletePI = (piId: string, piNumber?: string) => {
    if (!piId) {
      Swal.fire("Error", "PI ID is missing, cannot delete.", "error");
      return;
    }
    Swal.fire({
      title: 'Are you absolutely sure?',
      text: `This action cannot be undone. This will permanently delete PI "${piNumber || piId}" from Firestore.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "proforma_invoices", piId));
          setAllProformaInvoices(prevPIs => prevPIs.filter(pi => pi.id !== piId));
          Swal.fire(
            'Deleted!',
            `PI "${piNumber || piId}" has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting PI: ", error);
          Swal.fire("Error", `Could not delete PI: ${error.message}`, "error");
        }
      }
    });
  };

  const handleDownloadPDF = async (pi: ProformaInvoiceDocument) => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;

      // Header Section
      let textX = margin;
      const logoToUse = invoiceLogoUrl || companyLogoUrl;

      if (logoToUse) {
        try {
          const logoData = await getDataUrl(logoToUse);
          if (logoData) {
            doc.addImage(logoData, 'PNG', margin, 8, 22, 22);
            textX = margin + 26;
          }
        } catch (error) {
          console.warn("Could not add logo to PDF:", error);
        }
      }

      // Company Info (Left)
      doc.setFontSize(22);
      doc.setTextColor(40, 40, 40);
      doc.text(companyName || 'NextSew', textX, 16);

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      if (address) {
        const splitAddress = doc.splitTextToSize(address, 100);
        doc.text(splitAddress, textX, 22);
      }

      // Invoice Label (Right)
      doc.setFontSize(20);
      doc.setTextColor(59, 130, 246); // Blue
      doc.text('COMMISSION INVOICE', pageWidth - margin, 16, { align: 'right' });

      // Divider Line
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, 35, pageWidth - margin, 35);

      // Info Section
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);

      // 1. Customer Name (Left)
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Name:', margin, 45);
      doc.setFont('helvetica', 'normal');
      doc.text(pi.applicantName || 'N/A', margin, 50);

      // 2. Beneficiary Name (Middle)
      const middleX = pageWidth / 2 - 20;
      doc.setFont('helvetica', 'bold');
      doc.text('Beneficiary Name:', middleX, 45);
      doc.setFont('helvetica', 'normal');
      doc.text(pi.beneficiaryName || 'N/A', middleX, 50);

      // 3. Invoice Details (Right)
      const rightLabelX = pageWidth - 65;
      const rightValueX = pageWidth - margin;

      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE NO:', rightLabelX, 45);
      doc.setFont('helvetica', 'normal');
      doc.text(pi.piNo || 'N/A', rightValueX, 45, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text('DATE:', rightLabelX, 51);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDisplayDate(pi.piDate), rightValueX, 51, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text('SALES PERSON:', rightLabelX, 57);
      doc.setFont('helvetica', 'normal');
      doc.text(pi.salesPersonName || 'N/A', rightValueX, 57, { align: 'right' });

      // Table Section
      autoTable(doc, {
        startY: 65,
        margin: { left: margin, right: margin },
        head: [['Model No.', 'Qty', 'Unit Price', 'Total Price']],
        body: pi.lineItems.map(item => [
          item.modelNo || 'N/A',
          item.qty,
          formatCurrencyValue(item.salesPrice),
          formatCurrencyValue(item.qty * item.salesPrice)
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], halign: 'center' },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' }
        },
        styles: { fontSize: 9 }
      });

      // Summary Section
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      const summaryX = pageWidth - 85;
      const summaryValueX = pageWidth - margin;

      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);

      doc.setFont('helvetica', 'bold');
      doc.text('Total Items Qty:', summaryX, finalY);
      doc.setFont('helvetica', 'normal');
      doc.text(pi.totalQty.toString(), summaryValueX, finalY, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text('Basic Total Value:', summaryX, finalY + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(formatCurrencyValue(pi.totalSalesPrice), summaryValueX, finalY + 6, { align: 'right' });

      if (pi.totalOVI && pi.totalOVI > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Over Value Items (OVI):', summaryX, finalY + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(formatCurrencyValue(pi.totalOVI), summaryValueX, finalY + 12, { align: 'right' });
      }

      const grandTotalY = finalY + (pi.totalOVI ? 20 : 14);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('GRAND TOTAL:', summaryX, grandTotalY);
      doc.text(formatCurrencyValue(pi.grandTotalSalesPrice), summaryValueX, grandTotalY, { align: 'right' });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'italic');
      doc.text('This is a computer generated document and does not require a signature.', pageWidth / 2, 285, { align: 'center' });

      doc.save(`PI_${pi.piNo || 'Invoice'}.pdf`);
    } catch (error) {
      console.error("Error generating PI PDF:", error);
      Swal.fire("Error", "Could not generate PDF. Please try again.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const clearFilters = () => {
    setFilterPiNo('');
    setFilterApplicantId('');
    setFilterBeneficiaryId('');
    setFilterMonth(ALL_MONTHS_VALUE);
    setFilterYear(ALL_YEARS_VALUE);
    setFilterStatus("Pending");
    setSortBy('piDate');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(displayedProformaInvoices.length / PI_ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * PI_ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - PI_ITEMS_PER_PAGE;
  const currentItems = displayedProformaInvoices.slice(indexOfFirstItem, indexOfLastItem);

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
    <div className="max-w-none mx-[25px] py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Issued Proforma Invoice (PI) List
              </CardTitle>
              <CardDescription>
                View, search, filter, and manage all issued Proforma Invoices.
              </CardDescription>
            </div>
            <Link href="/dashboard/commission-management/add-pi" passHref>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isReadOnly}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New PI
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter & Sort Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <label htmlFor="piNoFilter" className="text-sm font-medium">PI Number</label>
                  <Input
                    id="piNoFilter"
                    placeholder="Search by PI No..."
                    value={filterPiNo}
                    onChange={(e) => setFilterPiNo(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="applicantFilterPi" className="text-sm font-medium flex items-center"><Users className="mr-1 h-4 w-4 text-muted-foreground" />Applicant</label>
                  <Combobox
                    options={applicantOptions}
                    value={filterApplicantId || PLACEHOLDER_APPLICANT_VALUE}
                    onValueChange={(value) => setFilterApplicantId(value === PLACEHOLDER_APPLICANT_VALUE ? '' : value)}
                    placeholder="Search Applicant..."
                    selectPlaceholder={isLoadingApplicants ? "Loading..." : "All Applicants"}
                    emptyStateMessage="No applicant found."
                    disabled={isLoadingApplicants}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="beneficiaryFilterPi" className="text-sm font-medium flex items-center"><Building className="mr-1 h-4 w-4 text-muted-foreground" />Beneficiary</label>
                  <Combobox
                    options={beneficiaryOptions}
                    value={filterBeneficiaryId || PLACEHOLDER_BENEFICIARY_VALUE}
                    onValueChange={(value) => setFilterBeneficiaryId(value === PLACEHOLDER_BENEFICIARY_VALUE ? '' : value)}
                    placeholder="Search Beneficiary..."
                    selectPlaceholder={isLoadingBeneficiaries ? "Loading..." : "All Beneficiaries"}
                    emptyStateMessage="No beneficiary found."
                    disabled={isLoadingBeneficiaries}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="yearFilterPi" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Year</label>
                  <Select
                    value={filterYear}
                    onValueChange={(value) => setFilterYear(value)}
                  >
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      {piYearFilterOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="monthFilterPi" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Month</label>
                  <Select
                    value={filterMonth}
                    onValueChange={(value) => setFilterMonth(value)}
                  >
                    <SelectTrigger><SelectValue placeholder="All Months" /></SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="statusFilterPi" className="text-sm font-medium flex items-center"><Clock className="mr-1 h-4 w-4 text-muted-foreground" />Comm. Status</label>
                  <Select
                    value={filterStatus}
                    onValueChange={(value) => setFilterStatus(value)}
                  >
                    <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
                    <SelectContent>
                      {statusFilterOptions.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="sortByPi" className="text-sm font-medium flex items-center"><ArrowDownUp className="mr-1 h-4 w-4 text-muted-foreground" />Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {piSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="self-end md:col-span-2 lg:col-span-1">
                  <Button onClick={clearFilters} variant="outline" className="w-full">
                    <XCircle className="mr-2 h-4 w-4" /> Clear Filters & Sort
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 sm:px-4">PI No.</TableHead>
                  <TableHead className="px-2 sm:px-4">PI Date</TableHead>
                  <TableHead className="px-2 sm:px-4">Applicant</TableHead>
                  <TableHead className="px-2 sm:px-4">Beneficiary</TableHead>
                  <TableHead className="px-2 sm:px-4">Grand Total</TableHead>
                  <TableHead className="px-2 sm:px-4">Comm. %</TableHead>
                  <TableHead className="px-2 sm:px-4">Total Net Comm.</TableHead>
                  <TableHead className="px-2 sm:px-4">Total OVI</TableHead>
                  <TableHead className="px-2 sm:px-4">Sales Person</TableHead>
                  <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center p-2 sm:p-4">
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading PIs...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : currentItems.length > 0 ? (
                  currentItems.map((pi) => (
                    <TableRow key={pi.id}>
                      <TableCell className="font-medium p-2 sm:p-4">{pi.piNo || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatDisplayDate(pi.piDate)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{pi.applicantName || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{pi.beneficiaryName || 'N/A'}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatCurrencyValue(pi.grandTotalSalesPrice)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{formatPercentage(pi.totalCommissionPercentage)}</TableCell>
                      <TableCell className="p-2 sm:p-4 font-semibold text-emerald-600">{formatCurrencyValue(pi.grandTotalCommissionUSD)}</TableCell>
                      <TableCell className="p-2 sm:p-4 font-semibold text-teal-600">{formatCurrencyValue(pi.totalOVI)}</TableCell>
                      <TableCell className="p-2 sm:p-4">{pi.salesPersonName || 'N/A'}</TableCell>
                      <TableCell className="text-right p-2 sm:p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" disabled={!pi.id || isReadOnly}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDownloadPDF(pi)}>
                              <Download className="mr-2 h-4 w-4" />
                              <span>Download PDF</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pi.id && handleEditPI(pi.id)} disabled={isReadOnly}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => pi.id && handleDeletePI(pi.id, pi.piNo)}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                              disabled={isReadOnly}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center p-2 sm:p-4">
                      No Proforma Invoices found matching your criteria. Ensure Firestore rules allow reads and data exists.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                A list of your Proforma Invoices from Database.
                Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedProformaInvoices.length)} of {displayedProformaInvoices.length} entries.
              </TableCaption>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4">
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
                  <span key={`ellipsis-pi-${index}`} className="px-2 py-1 text-sm">
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






"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, DollarSign, UsersRound, PieChart as PieChartIcon, CalendarDays, TrendingUp, CalendarIcon as CalendarIconLucide, Users, Loader2, CheckCircle2, Ship, FileEdit, Layers, Search, ExternalLink, Plane } from 'lucide-react';
import { firestore, auth } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp, documentId } from 'firebase/firestore';
import type { LCEntryDocument, LCStatus, Currency, ProformaInvoiceDocument, SupplierDocument } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isValid, isFuture, isToday, compareAsc } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';

const SupplierPieChart = dynamic(() =>
  import('@/components/dashboard/SupplierPieChart').then(mod => mod.SupplierPieChart),
  {
    loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading chart...</p></div>,
    ssr: false
  }
);


const years = ["2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028", "2029", "2030"];

interface DashboardStats {
  totalLCs: number;
  totalLCValue: number;
  activeSuppliers: number;
  activeApplicants: number;
  thisMonthLCQty: number;
  totalLinkedPIs: number;
}

interface PieChartDataItem {
  name: string;
  value: number;
  fill: string;
}

interface RecentlyCompletedLC {
  id: string;
  documentaryCreditNumber?: string;
  beneficiaryName?: string;
  applicantName?: string;
  status?: LCStatus;
  currency?: Currency;
  amount?: number;
  etd?: string;
  eta?: string;
}

interface DraftLC {
  id: string;
  documentaryCreditNumber?: string;
  beneficiaryName?: string;
  applicantName?: string;
  createdAtDate: Date;
  status?: LCStatus;
  currency?: Currency;
  amount?: number;
}

interface UpcomingEtdShipment {
  id: string;
  documentaryCreditNumber?: string;
  beneficiaryName?: string;
  applicantName?: string;
  etdDate: Date;
  currency?: Currency;
  amount?: number;
}


const PIE_CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const getStatusBadgeVariant = (status?: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Draft':
      return 'outline';
    case 'Transmitted':
      return 'secondary';
    case 'Shipment Pending':
      return 'default';
    case 'Shipping going on':
      return 'default';
    case 'Payment Done':
      return 'default';
    case 'Done':
      return 'default';
    default:
      return 'outline';
  }
};

const formatCurrencyValue = (currency?: string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDisplayDate = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
  } catch (e) {
    return 'Invalid Date Format';
  }
};


export default function DashboardPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalLCs: 0,
    totalLCValue: 0,
    activeSuppliers: 0,
    activeApplicants: 0,
    thisMonthLCQty: 0,
    totalLinkedPIs: 0,
  });
  const [supplierPieData, setSupplierPieData] = useState<PieChartDataItem[]>([]);
  const [recentlyCompletedLCs, setRecentlyCompletedLCs] = useState<RecentlyCompletedLC[]>([]);
  const [draftLCs, setDraftLCs] = useState<DraftLC[]>([]);
  const [upcomingEtdShipments, setUpcomingEtdShipments] = useState<UpcomingEtdShipment[]>([]);
  const [greeting, setGreeting] = useState('');

  const upcomingEtdScrollRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) {
      setGreeting('Good morning');
    } else if (currentHour < 18) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  }, []);

  const fetchDashboardData = useCallback(async (year: string) => {
    if (authLoading || !authUser) {
        console.log("Dashboard: Auth still loading or user not available yet. Waiting to fetch data.");
        setIsLoading(true);
        return;
    }

    console.log("Dashboard: Fetching data for year", year);
    console.log("Dashboard: Checking auth.currentUser before Firestore query:", auth.currentUser);
    if (!auth.currentUser) {
      console.warn("Dashboard: User not authenticated in Firebase Auth when attempting to fetch dashboard data.");
      setDashboardStats({ totalLCs: 0, totalLCValue: 0, activeSuppliers: 0, activeApplicants: 0, thisMonthLCQty: 0, totalLinkedPIs: 0 });
      setSupplierPieData([]);
      setRecentlyCompletedLCs([]);
      setDraftLCs([]);
      setUpcomingEtdShipments([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const yearNumber = parseInt(year);

      const lcEntriesRef = collection(firestore, "lc_entries");
      const q = query(lcEntriesRef, where("year", "==", yearNumber));
      const querySnapshot = await getDocs(q);

      const lcEntriesForTheYear: LCEntryDocument[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<LCEntryDocument, 'id'>;
        let lcIssueDateValid = false;
        if (data.lcIssueDate) {
          try {
             const parsedDate = typeof data.lcIssueDate === 'string' ? parseISO(data.lcIssueDate) : (data.lcIssueDate as unknown as Timestamp).toDate();
             if (isValid(parsedDate)) {
              lcIssueDateValid = true;
            }
          } catch (e) { console.warn("Invalid lcIssueDate encountered during dashboard fetch:", data.lcIssueDate); }
        }

        if (data.amount !== undefined && data.applicantId && data.beneficiaryId && lcIssueDateValid) {
          lcEntriesForTheYear.push({
              id: doc.id,
              ...data,
            } as LCEntryDocument);
        } else {
          console.warn("Dashboard: Filtered out L/C entry due to missing essential fields or invalid lcIssueDate:", doc.id, data);
        }
      });

      const uniqueBeneficiaryIds = Array.from(new Set(lcEntriesForTheYear.map(lc => lc.beneficiaryId).filter(id => !!id)));
      const supplierBrandNameMap = new Map<string, string>();

      if (uniqueBeneficiaryIds.length > 0) {
        const BATCH_SIZE = 30; 
        for (let i = 0; i < uniqueBeneficiaryIds.length; i += BATCH_SIZE) {
          const batchIds = uniqueBeneficiaryIds.slice(i, i + BATCH_SIZE);
          if (batchIds.length > 0) {
            const suppliersQuery = query(collection(firestore, "suppliers"), where(documentId(), "in", batchIds));
            const suppliersSnapshot = await getDocs(suppliersQuery);
            suppliersSnapshot.forEach((docSnap) => {
              const supplier = docSnap.data() as SupplierDocument;
              if (supplier.brandName && supplier.brandName.trim() !== "") {
                supplierBrandNameMap.set(docSnap.id, supplier.brandName);
              }
            });
          }
        }
      }


      if (lcEntriesForTheYear.length === 0) {
        setDashboardStats({
          totalLCs: 0,
          totalLCValue: 0,
          activeSuppliers: 0,
          activeApplicants: 0,
          thisMonthLCQty: 0,
          totalLinkedPIs: 0,
        });
        setSupplierPieData([]);
        setRecentlyCompletedLCs([]);
        setDraftLCs([]);
        setUpcomingEtdShipments([]);
        setIsLoading(false);
        return;
      }

      const totalLCValue = lcEntriesForTheYear.reduce((sum, lc) => sum + (lc.amount || 0), 0);
      const activeSuppliersCount = uniqueBeneficiaryIds.length;
      const activeApplicantsCount = new Set(lcEntriesForTheYear.map(lc => lc.applicantId).filter(id => id)).size;


      const currentDate = new Date();
      const currentSystemYear = currentDate.getFullYear();
      let thisMonthLCQty = 0;
      if (yearNumber === currentSystemYear) {
        const firstDayOfMonth = startOfMonth(currentDate);
        const lastDayOfMonth = endOfMonth(currentDate);
        thisMonthLCQty = lcEntriesForTheYear.filter(lc => {
          if (!lc.lcIssueDate) return false;
          try {
            const issueDate = typeof lc.lcIssueDate === 'string' ? parseISO(lc.lcIssueDate) : (lc.lcIssueDate as unknown as Timestamp).toDate();
            return isValid(issueDate) && isWithinInterval(issueDate, { start: firstDayOfMonth, end: lastDayOfMonth });
          } catch (e) {
            console.warn("Invalid lcIssueDate format for an L/C:", lc.lcIssueDate, lc.id);
            return false;
          }
        }).length;
      }

      const supplierValueMap: { [key: string]: number } = {};
      lcEntriesForTheYear.forEach(lc => {
        const brandName = supplierBrandNameMap.get(lc.beneficiaryId);
        const displayName = brandName || (lc.beneficiaryName ? (lc.beneficiaryName.length > 20 ? lc.beneficiaryName.substring(0, 17) + "..." : lc.beneficiaryName) : 'Unknown/No Brand');
        supplierValueMap[displayName] = (supplierValueMap[displayName] || 0) + (lc.amount || 0);
      });

      const pieData = Object.entries(supplierValueMap)
        .map(([name, value], index) => ({
          name,
          value,
          fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value);
      setSupplierPieData(pieData);

      const completedLCs = lcEntriesForTheYear
        .filter(lc => lc.status === 'Done')
        .map(lc => {
          let updatedAtDate = new Date(0);
          if (lc.updatedAt) {
            if (typeof (lc.updatedAt as unknown as Timestamp)?.toDate === 'function') {
              updatedAtDate = (lc.updatedAt as unknown as Timestamp).toDate();
            } else if (typeof lc.updatedAt === 'string') {
              try {
                const parsed = parseISO(lc.updatedAt);
                if (isValid(parsed)) updatedAtDate = parsed;
              } catch (e) { console.warn("Error parsing updatedAt for completed L/C:", lc.id, lc.updatedAt); }
            }
          }
          return {
            id: lc.id, documentaryCreditNumber: lc.documentaryCreditNumber,
            beneficiaryName: lc.beneficiaryName, applicantName: lc.applicantName,
            status: lc.status,
            currency: lc.currency, amount: lc.amount,
            etd: lc.etd, eta: lc.eta,
          } as RecentlyCompletedLC;
        })
        .sort((a, b) => { 
            const dateA = a.id ? lcEntriesForTheYear.find(l => l.id === a.id)?.updatedAt : null;
            const dateB = b.id ? lcEntriesForTheYear.find(l => l.id === b.id)?.updatedAt : null;

            let timeA = 0;
            let timeB = 0;

            if (dateA) {
                if (typeof (dateA as unknown as Timestamp)?.toDate === 'function') timeA = (dateA as unknown as Timestamp).toDate().getTime();
                else if (typeof dateA === 'string') try { timeA = parseISO(dateA).getTime(); } catch {}
            }
            if (dateB) {
                if (typeof (dateB as unknown as Timestamp)?.toDate === 'function') timeB = (dateB as unknown as Timestamp).toDate().getTime();
                else if (typeof dateB === 'string') try { timeB = parseISO(dateB).getTime(); } catch {}
            }
            return timeB - timeA; 
        })
        .slice(0, 10);
      setRecentlyCompletedLCs(completedLCs);

      const currentDraftLCs = lcEntriesForTheYear
        .filter(lc => lc.status === 'Draft')
        .map(lc => {
          let createdAtDate = new Date(0);
          if (lc.createdAt) {
            if (typeof (lc.createdAt as unknown as Timestamp)?.toDate === 'function') {
              createdAtDate = (lc.createdAt as unknown as Timestamp).toDate();
            } else if (typeof lc.createdAt === 'string') {
              try {
                const parsed = parseISO(lc.createdAt);
                if (isValid(parsed)) createdAtDate = parsed;
              } catch (e) { console.warn("Error parsing createdAt for draft L/C:", lc.id, lc.createdAt); }
            }
          }
          return {
            id: lc.id, documentaryCreditNumber: lc.documentaryCreditNumber,
            beneficiaryName: lc.beneficiaryName, applicantName: lc.applicantName,
            createdAtDate: createdAtDate, status: lc.status,
            currency: lc.currency, amount: lc.amount,
          } as DraftLC;
        })
        .sort((a, b) => b.createdAtDate.getTime() - a.createdAtDate.getTime())
        .slice(0, 10);
      setDraftLCs(currentDraftLCs);

      const today = new Date();
      today.setHours(0,0,0,0);
      const filteredUpcomingEtds = lcEntriesForTheYear
        .filter(lc => {
            if (!lc.etd || lc.status === 'Done') return false;
            try {
                const etdDate = typeof lc.etd === 'string' ? parseISO(lc.etd) : (lc.etd as unknown as Timestamp).toDate();
                return isValid(etdDate) && (isToday(etdDate) || isFuture(etdDate));
            } catch (e) { return false; }
        })
        .map(lc => ({
            id: lc.id,
            documentaryCreditNumber: lc.documentaryCreditNumber,
            beneficiaryName: lc.beneficiaryName,
            applicantName: lc.applicantName,
            etdDate: typeof lc.etd === 'string' ? parseISO(lc.etd!) : (lc.etd as unknown as Timestamp).toDate(),
            currency: lc.currency,
            amount: lc.amount,
        } as UpcomingEtdShipment))
        .sort((a, b) => compareAsc(a.etdDate, b.etdDate))
        .slice(0, 10);
      setUpcomingEtdShipments(filteredUpcomingEtds);

      const lcIdsForTheYear = new Set(lcEntriesForTheYear.map(lc => lc.id));
      const piCollectionRef = collection(firestore, "proforma_invoices");
      // TODO: This can be very inefficient for large PI collections. Consider backend aggregation.
      const piQuerySnapshot = await getDocs(piCollectionRef); 
      const allProformaInvoices: ProformaInvoiceDocument[] = [];
      piQuerySnapshot.forEach((docSnap) => {
        allProformaInvoices.push({ id: docSnap.id, ...docSnap.data() } as ProformaInvoiceDocument);
      });
      const linkedPIsForTheYear = allProformaInvoices.filter(pi =>
        pi.connectedLcId && lcIdsForTheYear.has(pi.connectedLcId)
      );
      const totalLinkedPIsCount = linkedPIsForTheYear.length;

      setDashboardStats({
        totalLCs: lcEntriesForTheYear.length,
        totalLCValue,
        activeSuppliers: activeSuppliersCount,
        activeApplicants: activeApplicantsCount,
        thisMonthLCQty,
        totalLinkedPIs: totalLinkedPIsCount,
      });

    } catch (error: any) {
      console.error("Dashboard: Detailed error fetching dashboard data: ", error);
      let errorMessage = `Could not fetch dashboard data. Please check console for details.`;
       if (error.code && (error.message?.toLowerCase().includes("permission") || error.message?.toLowerCase().includes("missing or insufficient"))) {
         errorMessage = `Could not fetch dashboard data. This is often due to Firestore security rules. Please ensure your rules allow read access to the 'lc_entries' collection for authenticated users (e.g., by having 'allow read: if request.auth != null;' for the '/lc_entries/{lcEntryId}' path). Original Firebase error: ${error.message} (Code: ${error.code || 'N/A'})`;
       } else if (error.message) {
         errorMessage = `Could not fetch dashboard data: ${error.message} (Code: ${error.code || 'N/A'})`;
       }
      Swal.fire("Dashboard Error", errorMessage, "error");
      setDashboardStats({ totalLCs: 0, totalLCValue: 0, activeSuppliers: 0, activeApplicants: 0, thisMonthLCQty: 0, totalLinkedPIs: 0 });
      setSupplierPieData([]);
      setRecentlyCompletedLCs([]);
      setDraftLCs([]);
      setUpcomingEtdShipments([]);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, authLoading]);

  useEffect(() => {
    if (!authLoading && authUser) {
      console.log("Dashboard: Auth loaded, user available. Triggering fetch.");
      fetchDashboardData(selectedYear);
    } else if (!authLoading && !authUser) {
      console.log("Dashboard: User not authenticated after auth load, clearing data.");
      setDashboardStats({ totalLCs: 0, totalLCValue: 0, activeSuppliers: 0, activeApplicants: 0, thisMonthLCQty: 0, totalLinkedPIs: 0 });
      setSupplierPieData([]);
      setRecentlyCompletedLCs([]);
      setDraftLCs([]);
      setUpcomingEtdShipments([]);
      setIsLoading(false);
    }
  }, [selectedYear, authUser, authLoading, fetchDashboardData]);

   useEffect(() => {
    const scrollElement = upcomingEtdScrollRef.current;

    const startScrolling = () => {
      if (scrollElement && scrollElement.scrollHeight > scrollElement.clientHeight) {
        scrollIntervalRef.current = setInterval(() => {
          if (scrollElement.scrollTop >= scrollElement.scrollHeight - scrollElement.clientHeight) {
            scrollElement.scrollTop = 0; 
          } else {
            scrollElement.scrollTop += 1; 
          }
        }, 75); 
      }
    };

    const stopScrolling = () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
    
    if (scrollElement && scrollElement.scrollHeight > scrollElement.clientHeight) {
        startScrolling();
        scrollElement.addEventListener('mouseenter', stopScrolling);
        scrollElement.addEventListener('mouseleave', startScrolling);
    }


    return () => {
      stopScrolling();
      if (scrollElement) {
        scrollElement.removeEventListener('mouseenter', stopScrolling);
        scrollElement.removeEventListener('mouseleave', startScrolling);
      }
    };
  }, [upcomingEtdShipments, isLoading]); 


  if (authLoading || (!authUser && !isLoading) ) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const userDisplayName = authUser?.displayName || authUser?.email || 'User';

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-row justify-between items-start gap-4 sm:items-center">
        <div>
           {greeting && authUser && (
            <h2 className="text-base font-semibold text-foreground mb-1">
              {greeting}, <span className="text-primary">{userDisplayName}</span>!
            </h2>
          )}
          <h1
            className={cn(
              "font-bold text-xl sm:text-2xl lg:text-3xl", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
            )}
          >
            Dashboard Overview
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px] bg-card shadow-sm">
              <CalendarIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      { isLoading && !authLoading ? (
         <div className="flex min-h-[calc(100vh-12rem)] w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Loading dashboard data for {selectedYear}...</p>
          </div>
      ) : (
        <>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total L/Cs Opened"
          value={dashboardStats.totalLCs.toLocaleString()}
          icon={<Package className="h-7 w-7 text-primary" />}
          description={`For year ${selectedYear}`}
        />
        <StatCard
          title="Total L/Cs Values"
          value={`$${dashboardStats.totalLCValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-7 w-7 text-primary" />}
          description={`For year ${selectedYear}`}
          className="xl:col-span-3"
        />
        <StatCard
          title="Active Beneficiaries"
          value={dashboardStats.activeSuppliers.toLocaleString()}
          icon={<UsersRound className="h-7 w-7 text-primary" />}
          description={`Unique in L/Cs for ${selectedYear}`}
        />
        <StatCard
          title="Active Applicants"
          value={dashboardStats.activeApplicants.toLocaleString()}
          icon={<Users className="h-7 w-7 text-primary" />}
          description={`Unique in L/Cs for ${selectedYear}`}
        />
        <StatCard
          title="This Month L/Cs Quantities"
          value={dashboardStats.thisMonthLCQty.toLocaleString()}
          icon={<TrendingUp className="h-7 w-7 text-primary" />}
          description={`In ${format(new Date(), 'MMMM')}, ${parseInt(selectedYear) === new Date().getFullYear() ? selectedYear : ' (Current Year Only)'}`}
          className="lg:col-start-1"
        />
         <StatCard
          title={`PI's Linked with to L/Cs (${selectedYear})`}
          value={dashboardStats.totalLinkedPIs.toLocaleString()}
          icon={<Layers className="h-7 w-7 text-primary" />}
          description={`Proforma Invoices connected to LCs issued in ${selectedYear}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <PieChartIcon className="h-6 w-6 text-primary" />
              Beneficiary L/Cs Value Distribution
            </CardTitle>
            <CardDescription>
              Breakdown of L/C value by beneficiary brand name for {selectedYear}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] w-full">
            {isLoading && !authLoading ? (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading chart data...</p>
                </div>
            ) : supplierPieData.length > 0 ? (
              <SupplierPieChart data={supplierPieData} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No L/C data available to display chart for {selectedYear}.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
            <CardHeader>
              <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "text-primary")}>
                <Ship className="h-6 w-6 text-primary" />
                Upcoming ETDs
              </CardTitle>
              <CardDescription>
                L/Cs from {selectedYear} nearing their Estimated Time of Departure.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[350px] space-y-3">
                 {isLoading && !authLoading ? (
                         <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                         </div>
                    ) : upcomingEtdShipments.length === 0 && !isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-sm text-muted-foreground text-center">No upcoming ETDs found for {selectedYear}.</p>
                        </div>
                    ) : (
                    <div
                        ref={upcomingEtdScrollRef}
                        className="h-full overflow-y-auto space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                    >
                        {upcomingEtdShipments.map((shipment) => (
                        <li key={shipment.id} className="text-sm p-3 rounded-md border hover:bg-muted/50 list-none">
                            <Link href={`/dashboard/total-lc/${shipment.id}/edit`} className="font-medium text-primary hover:underline truncate block">
                            {shipment.documentaryCreditNumber || 'N/A'}
                            </Link>
                             <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <p className="truncate">Applicant: <span className="font-medium text-foreground">{shipment.applicantName || 'N/A'}</span></p>
                                <p className="truncate">Beneficiary: <span className="font-medium text-foreground">{shipment.beneficiaryName || 'N/A'}</span></p>
                                <p className="truncate sm:col-span-2">Value: <span className="font-medium text-foreground">{formatCurrencyValue(shipment.currency, shipment.amount)}</span></p>
                                <p className="font-semibold text-foreground mt-0.5 sm:mt-0 sm:text-left sm:col-span-2">
                                ETD: {format(shipment.etdDate, 'PPP')}
                                </p>
                            </div>
                        </li>
                        ))}
                    </div>
                )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "text-primary")}>
              <FileEdit className="h-6 w-6 text-primary" />
              Draft L/Cs
            </CardTitle>
            <CardDescription>
              L/Cs currently in &quot;Draft&quot; status for {selectedYear}, sorted by most recent creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading && !authLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : draftLCs.length > 0 ? (
              <ul className="space-y-3">
                {draftLCs.map((lc) => (
                  <li key={lc.id} className="text-sm p-3 rounded-md border hover:bg-muted/50">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
                      <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-medium text-primary hover:underline">
                        {lc.documentaryCreditNumber || 'N/A'}
                      </Link>
                      <div className="flex items-center gap-2 mt-1 sm:mt-0">
                          <Badge
                            variant={getStatusBadgeVariant(lc.status)}
                            className={
                              lc.status === 'Draft' ? 'bg-primary/20 text-primary border-primary/30' : ''
                            }
                          >
                            {lc.status || 'N/A'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                          Created: {isValid(lc.createdAtDate) && lc.createdAtDate.getFullYear() > 1 ? format(lc.createdAtDate, 'PPP') : 'Date N/A'}
                          </span>
                      </div>
                    </div>
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <p className="truncate sm:col-span-1">Applicant: <span className="font-medium text-foreground">{lc.applicantName || 'N/A'}</span></p>
                        <p className="truncate sm:col-span-1">Beneficiary: <span className="font-medium text-foreground">{lc.beneficiaryName || 'N/A'}</span></p>
                        <p className="truncate sm:col-span-1">Value: <span className="font-medium text-foreground">{formatCurrencyValue(lc.currency, lc.amount)}</span></p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No L/Cs in &quot;Draft&quot; status found for {selectedYear}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "text-primary")}>
              <CheckCircle2 className="h-6 w-6 text-primary" />
              Recently Completed L/Cs
            </CardTitle>
            <CardDescription>
              L/Cs marked as &quot;Done&quot; in {selectedYear}, sorted by most recent update.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && !authLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : recentlyCompletedLCs.length > 0 ? (
              <ul className="space-y-3">
                {recentlyCompletedLCs.map((lc) => (
                  <li key={lc.id} className="text-sm p-3 rounded-md border hover:bg-muted/50">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
                      <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-medium text-primary hover:underline">
                        {lc.documentaryCreditNumber || 'N/A'}
                      </Link>
                      <div className="flex items-center gap-2 mt-1 sm:mt-0">
                          <Badge
                            variant={getStatusBadgeVariant(lc.status)}
                            className={
                              lc.status === 'Done' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' : ''
                            }
                          >
                            {lc.status || 'N/A'}
                          </Badge>
                      </div>
                    </div>
                     <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <p className="truncate sm:col-span-1">Applicant: <span className="font-medium text-foreground">{lc.applicantName || 'N/A'}</span></p>
                      <p className="truncate sm:col-span-1">Beneficiary: <span className="font-medium text-foreground">{lc.beneficiaryName || 'N/A'}</span></p>
                      <p className="truncate sm:col-span-1">Value: <span className="font-medium text-foreground">{formatCurrencyValue(lc.currency, lc.amount)}</span></p>
                    </div>
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {lc.etd && <p>ETD: <span className="font-medium text-foreground">{formatDisplayDate(lc.etd)}</span></p>}
                        {lc.eta && <p>ETA: <span className="font-medium text-foreground">{formatDisplayDate(lc.eta)}</span></p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No L/Cs marked as &quot;Done&quot; found for {selectedYear}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}


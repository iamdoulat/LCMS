
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, DollarSign, Layers, PieChart as PieChartIcon, TrendingUp, CalendarDays as CalendarIconLucide, Loader2, Ship, Truck, Factory, BarChart3, FileEdit, CheckCircle2 } from 'lucide-react';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp, documentId, orderBy } from 'firebase/firestore';
import type { LCEntryDocument, LCStatus, Currency, ProformaInvoiceDocument, SupplierDocument, NoticeBoardSettings, PettyCashTransactionDocument } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isValid, isToday, isFuture, compareAsc, getMonth } from 'date-fns';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from '@/components/ui/skeleton';
import { NoticeBoardDialog } from '@/components/dashboard/NoticeBoardDialog';

import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';


const SupplierPieChart = dynamic(() => import('@/components/dashboard/SupplierPieChart'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading chart...</p></div>,
});

const YearlyLcValueBarChart = dynamic(() => import('@/components/dashboard/YearlyLcValueBarChart'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading chart...</p></div>,
});

const MonthlyTransactionBarChart = dynamic(() => import('@/components/dashboard/MonthlyTransactionBarChart'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading chart...</p></div>,
});


const years = Array.from({ length: 16 }, (_, i) => (2015 + i).toString());

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

interface YearlyLcValue {
  year: string;
  totalValue: number | null;
}

interface MonthlyChartData {
  name: string;
  debits: number;
  credits: number;
}


interface UpcomingEtdShipment {
  id: string;
  documentaryCreditNumber?: string;
  applicantName?: string;
  beneficiaryName?: string;
  etdDate: Date;
  etaDate?: Date;
  currency?: Currency;
  amount?: number;
  isFirstShipment?: boolean;
  isSecondShipment?: boolean;
  isThirdShipment?: boolean;
  firstShipmentNote?: string;
  secondShipmentNote?: string;
  thirdShipmentNote?: string;
}

interface RecentlyCompletedLC {
  id: string;
  documentaryCreditNumber?: string;
  beneficiaryName?: string;
  applicantName?: string;
  status?: LCStatus[] | LCStatus;
  currency?: Currency;
  amount?: number;
  etd?: string;
  eta?: string;
  updatedAtDate: Date;
}

interface DraftLC {
  id: string;
  documentaryCreditNumber?: string;
  beneficiaryName?: string;
  applicantName?: string;
  createdAtDate: Date;
  status?: LCStatus[] | LCStatus;
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

const getStatusBadgeVariant = (status: LCStatus): "default" | "secondary" | "outline" | "destructive" => {
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

const formatCurrencyValue = (currency?: string | Currency, amount?: number) => {
  const currencyCode = typeof currency === 'string' ? currency : (currency?.code || '');
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencyCode} N/A`;
  return `${currencyCode} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDisplayDate = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const setupAutoScroll = (scrollRef: React.RefObject<HTMLDivElement>, intervalRef: React.MutableRefObject<NodeJS.Timeout | null>) => {
  const scrollElement = scrollRef.current;
  if (!scrollElement) return;

  let isPaused = false;

  const moveScroll = () => {
    if (scrollElement && !isPaused) {
      if (scrollElement.scrollTop >= scrollElement.scrollHeight - scrollElement.clientHeight - 1) {
        scrollElement.scrollTop = 0;
      } else {
        scrollElement.scrollTop += 1;
      }
    }
  };

  const startScrolling = () => {
    if (scrollElement && scrollElement.scrollHeight > scrollElement.clientHeight) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(moveScroll, 75);
    }
  };

  const stopScrolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleMouseEnter = () => { isPaused = true; };
  const handleMouseLeave = () => { isPaused = false; };

  scrollElement.addEventListener('mouseenter', handleMouseEnter);
  scrollElement.addEventListener('mouseleave', handleMouseLeave);
  startScrolling();

  return () => {
    stopScrolling();
    if (scrollElement) {
      scrollElement.removeEventListener('mouseenter', handleMouseEnter);
      scrollElement.removeEventListener('mouseleave', handleMouseLeave);
    }
  };
};


export default function DashboardPage() {
  const { user: authUser, loading: authLoading, userRole } = useAuth();
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedChartYear, setSelectedChartYear] = React.useState<string>(new Date().getFullYear().toString());
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
  const [yearlyLcValueData, setYearlyLcValueData] = useState<YearlyLcValue[]>(years.map(y => ({ year: y, totalValue: null })));
  const [monthlyTxData, setMonthlyTxData] = useState<MonthlyChartData[]>([]);
  const [recentlyCompletedLCs, setRecentlyCompletedLCs] = useState<RecentlyCompletedLC[]>([]);
  const [draftLCs, setDraftLCs] = useState<DraftLC[]>([]);
  const [upcomingEtdShipments, setUpcomingEtdShipments] = useState<UpcomingEtdShipment[]>([]);
  const [greeting, setGreeting] = useState('');
  const [notice, setNotice] = React.useState<(NoticeBoardSettings & { id: string }) | null>(null);

  const upcomingEtdScrollRef = useRef<HTMLDivElement>(null);
  const draftLcScrollRef = useRef<HTMLDivElement>(null);
  const completedLcScrollRef = useRef<HTMLDivElement>(null);
  const upcomingEtdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const draftLcIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedLcIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!authUser || !userRole?.some(r => ['Super Admin', 'Admin', 'Viewer', 'Commercial'].includes(r))) {
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
        lcEntriesForTheYear.push({ id: doc.id, ...data } as LCEntryDocument);
      });

      const validLcEntriesForStats = lcEntriesForTheYear.filter(lc =>
        typeof lc.amount === 'number' && !isNaN(lc.amount) &&
        lc.lcIssueDate && isValid(parseISO(lc.lcIssueDate))
      );

      const totalLCValue = validLcEntriesForStats.reduce((sum, lc) => sum + (lc.amount || 0), 0);

      const uniqueBeneficiaryIds = Array.from(new Set(validLcEntriesForStats.map(lc => lc.beneficiaryId).filter(id => !!id && id.trim() !== '')));
      const uniqueApplicantIds = Array.from(new Set(validLcEntriesForStats.map(lc => lc.applicantId).filter(id => !!id && id.trim() !== '')));

      const supplierMap = new Map<string, Pick<SupplierDocument, 'brandName' | 'beneficiaryName'>>();
      if (uniqueBeneficiaryIds.length > 0) {
        const BATCH_SIZE = 30; // Firestore 'in' query limit
        for (let i = 0; i < uniqueBeneficiaryIds.length; i += BATCH_SIZE) {
          const batchIds = uniqueBeneficiaryIds.slice(i, i + BATCH_SIZE);
          if (batchIds.length > 0) {
            const suppliersQuery = query(collection(firestore, "suppliers"), where(documentId(), "in", batchIds));
            const suppliersSnapshot = await getDocs(suppliersQuery);
            suppliersSnapshot.forEach((docSnap) => {
              const supplier = docSnap.data() as SupplierDocument;
              supplierMap.set(docSnap.id, { brandName: supplier.brandName, beneficiaryName: supplier.beneficiaryName });
            });
          }
        }
      }

      const activeSuppliersCount = supplierMap.size; // Count based on successfully fetched suppliers
      const activeApplicantsCount = uniqueApplicantIds.length;

      const currentDate = new Date();
      const currentSystemYear = currentDate.getFullYear();
      let thisMonthLCQty = 0;
      if (yearNumber === currentSystemYear) {
        const firstDayOfMonth = startOfMonth(currentDate);
        const lastDayOfMonth = endOfMonth(currentDate);
        thisMonthLCQty = validLcEntriesForStats.filter(lc => {
          const issueDate = parseISO(lc.lcIssueDate as string); // Already validated lc.lcIssueDate
          return isWithinInterval(issueDate, { start: firstDayOfMonth, end: lastDayOfMonth });
        }).length;
      }

      const supplierValueMap: { [key: string]: number } = {};
      validLcEntriesForStats.forEach(lc => {
        if (!lc.beneficiaryId) return;
        const supplierDetails = supplierMap.get(lc.beneficiaryId);
        let displayName = supplierDetails?.brandName?.trim() || '';
        if (!displayName) {
          displayName = lc.beneficiaryName ? (lc.beneficiaryName.length > 20 ? lc.beneficiaryName.substring(0, 17) + "..." : lc.beneficiaryName) : 'Unknown/No Brand';
        }
        supplierValueMap[displayName] = (supplierValueMap[displayName] || 0) + (lc.amount || 0);
      });

      const pieData = Object.entries(supplierValueMap)
        .map(([name, value], index) => ({
          name, value, fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value);
      setSupplierPieData(pieData);

      const completedLCs = lcEntriesForTheYear
        .filter(lc => Array.isArray(lc.status) ? lc.status.includes('Shipment Done') : lc.status === 'Shipment Done')
        .map(lc => {
          let updatedAtDate = new Date(0);
          if (lc.updatedAt && typeof (lc.updatedAt as unknown as Timestamp)?.toDate === 'function') {
            updatedAtDate = (lc.updatedAt as unknown as Timestamp).toDate();
          } else if (typeof lc.updatedAt === 'string' && isValid(parseISO(lc.updatedAt as string))) {
            updatedAtDate = parseISO(lc.updatedAt as string);
          }
          return {
            id: lc.id, documentaryCreditNumber: lc.documentaryCreditNumber,
            beneficiaryName: lc.beneficiaryName, applicantName: lc.applicantName,
            status: lc.status, currency: lc.currency, amount: lc.amount,
            etd: lc.etd, eta: lc.eta,
            updatedAtDate: updatedAtDate,
          };
        })
        .sort((a, b) => b.updatedAtDate.getTime() - a.updatedAtDate.getTime())
        .slice(0, 10);
      setRecentlyCompletedLCs(completedLCs);

      const currentDraftLCs = lcEntriesForTheYear
        .filter(lc => Array.isArray(lc.status) ? lc.status.includes('Draft') : lc.status === 'Draft')
        .map(lc => {
          let createdAtDate = new Date(0);
          if (lc.createdAt) {
            if (typeof (lc.createdAt as unknown as Timestamp)?.toDate === 'function') {
              createdAtDate = (lc.createdAt as unknown as Timestamp).toDate();
            } else if (typeof lc.createdAt === 'string' && isValid(parseISO(lc.createdAt as string))) {
              createdAtDate = parseISO(lc.createdAt as string);
            }
          }
          return {
            id: lc.id, documentaryCreditNumber: lc.documentaryCreditNumber,
            beneficiaryName: lc.beneficiaryName, applicantName: lc.applicantName,
            createdAtDate: createdAtDate, status: lc.status,
            currency: lc.currency, amount: lc.amount,
          };
        })
        .sort((a, b) => b.createdAtDate.getTime() - a.createdAtDate.getTime())
        .slice(0, 10);
      setDraftLCs(currentDraftLCs);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filteredUpcomingEtds = lcEntriesForTheYear
        .filter(lc => {
          const isShipmentDone = Array.isArray(lc.status) ? lc.status.includes('Shipment Done') : lc.status === 'Shipment Done';
          if (!lc.etd || isShipmentDone) return false;
          try {
            const etdDateSource = lc.etd;
            let etdDate: Date;
            if (typeof etdDateSource === 'string') {
              etdDate = parseISO(etdDateSource);
            } else if (etdDateSource && typeof (etdDateSource as unknown as Timestamp).toDate === 'function') {
              etdDate = (etdDateSource as unknown as Timestamp).toDate();
            } else { return false; }
            return isValid(etdDate) && (isToday(etdDate) || isFuture(etdDate));
          } catch (e) { return false; }
        })
        .map(lc => {
          let etdDate = new Date(0);
          if (lc.etd) {
            if (typeof lc.etd === 'string') etdDate = parseISO(lc.etd);
            else if (lc.etd && typeof (lc.etd as unknown as Timestamp).toDate === 'function') etdDate = (lc.etd as unknown as Timestamp).toDate();
          }
          let etaDate: Date | undefined = undefined;
          if (lc.eta) {
            if (typeof lc.eta === 'string') etaDate = parseISO(lc.eta);
            else if (lc.eta && typeof (lc.eta as unknown as Timestamp).toDate === 'function') etaDate = (lc.eta as unknown as Timestamp).toDate();
          }
          return {
            id: lc.id, documentaryCreditNumber: lc.documentaryCreditNumber,
            applicantName: lc.applicantName, beneficiaryName: lc.beneficiaryName,
            etdDate: etdDate, etaDate: etaDate,
            currency: lc.currency, amount: lc.amount,
            isFirstShipment: lc.isFirstShipment, isSecondShipment: lc.isSecondShipment, isThirdShipment: lc.isThirdShipment,
            firstShipmentNote: lc.firstShipmentNote,
            secondShipmentNote: lc.secondShipmentNote,
            thirdShipmentNote: lc.thirdShipmentNote,
          };
        })
        .sort((a, b) => compareAsc(a.etdDate, b.etdDate))
        .slice(0, 10);
      setUpcomingEtdShipments(filteredUpcomingEtds);

      const lcIdsForTheYear = new Set(lcEntriesForTheYear.map(lc => lc.id));
      const piCollectionRef = collection(firestore, "proforma_invoices");
      const piQuerySnapshot = await getDocs(piCollectionRef); // TODO: Optimize this for production
      const allProformaInvoices: ProformaInvoiceDocument[] = [];
      piQuerySnapshot.forEach((docSnap) => {
        allProformaInvoices.push({ id: docSnap.id, ...docSnap.data() } as ProformaInvoiceDocument);
      });
      const linkedPIsForTheYear = allProformaInvoices.filter(pi =>
        pi.connectedLcId && lcIdsForTheYear.has(pi.connectedLcId)
      );
      const totalLinkedPIsCount = linkedPIsForTheYear.length;

      setDashboardStats({
        totalLCs: validLcEntriesForStats.length,
        totalLCValue, activeSuppliers: activeSuppliersCount, activeApplicants: activeApplicantsCount, thisMonthLCQty, totalLinkedPIs: totalLinkedPIsCount,
      });

      const yearlyDataPromises = years.map(async chartYearStr => {
        const chartYearNum = parseInt(chartYearStr);
        const yearlyLcQuery = query(lcEntriesRef, where("year", "==", chartYearNum));
        const yearlySnapshot = await getDocs(yearlyLcQuery);
        let yearlyTotalValue = 0;
        let foundDataForYear = false;
        yearlySnapshot.forEach(docSnap => {
          const data = docSnap.data() as LCEntryDocument;
          if (data.amount && typeof data.amount === 'number' && !isNaN(data.amount)) {
            yearlyTotalValue += data.amount;
            foundDataForYear = true;
          }
        });
        return { year: chartYearStr, totalValue: foundDataForYear ? yearlyTotalValue : null };
      });
      const resolvedYearlyData = await Promise.all(yearlyDataPromises);
      setYearlyLcValueData(resolvedYearlyData);

    } catch (error: any) {
      console.error("Dashboard: Detailed error fetching dashboard data: ", error);
      Swal.fire("Dashboard Error", "Could not fetch dashboard data. You may not have permission to view this data. Please check the console for details.", "error");
      setDashboardStats({ totalLCs: 0, totalLCValue: 0, activeSuppliers: 0, activeApplicants: 0, thisMonthLCQty: 0, totalLinkedPIs: 0 });
      setSupplierPieData([]);
      setRecentlyCompletedLCs([]);
      setDraftLCs([]);
      setUpcomingEtdShipments([]);
      setYearlyLcValueData(years.map(y => ({ year: y, totalValue: null })));
    } finally {
      setIsLoading(false);
    }
  }, [authUser, userRole]);

  const fetchMonthlyTxData = useCallback(async (year: number) => {
    const txQuery = query(
      collection(firestore, "petty_cash_transactions")
    );
    const snapshot = await getDocs(txQuery);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData: MonthlyChartData[] = monthNames.map(name => ({ name, debits: 0, credits: 0 }));

    snapshot.docs.forEach(docSnap => {
      const tx = docSnap.data() as PettyCashTransactionDocument;
      if (tx.transactionDate) {
        const txDate = parseISO(tx.transactionDate);
        if (isValid(txDate) && txDate.getFullYear() === year) {
          const monthIndex = getMonth(txDate);
          if (tx.type === 'Debit') {
            monthlyData[monthIndex].debits += tx.amount || 0;
          } else if (tx.type === 'Credit') {
            monthlyData[monthIndex].credits += tx.amount || 0;
          }
        }
      }
    });
    setMonthlyTxData(monthlyData);
  }, []);

  useEffect(() => {
    const fetchNotice = async () => {
      try {
        const noticesSnapshot = await getDocs(query(collection(firestore, 'site_settings'), orderBy('updatedAt', 'desc')));
        const allNotices = noticesSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as (NoticeBoardSettings & { id: string })[];

        const mostRecentActiveNotice = allNotices.find(n =>
          n.isEnabled &&
          n.isPopupEnabled &&
          Array.isArray(n.targetRoles) &&
          n.targetRoles.some(role => userRole?.includes(role))
        );

        setNotice(mostRecentActiveNotice || null);

      } catch (error) {
        console.error("Error fetching notices:", error);
      }
    };

    if (!authLoading && authUser && userRole) {
      fetchDashboardData(selectedYear);
      fetchMonthlyTxData(parseInt(selectedChartYear));
      fetchNotice();
    } else if (!authLoading && !authUser) {
      // Clear data if user logs out
      setDashboardStats({ totalLCs: 0, totalLCValue: 0, activeSuppliers: 0, activeApplicants: 0, thisMonthLCQty: 0, totalLinkedPIs: 0 });
      setSupplierPieData([]);
      setRecentlyCompletedLCs([]);
      setDraftLCs([]);
      setUpcomingEtdShipments([]);
      setYearlyLcValueData(years.map(y => ({ year: y, totalValue: null })));
      setMonthlyTxData([]);
      setIsLoading(false);
    }
  }, [selectedYear, authUser, authLoading, userRole, fetchDashboardData, fetchMonthlyTxData, selectedChartYear]);

  useEffect(() => {
    fetchMonthlyTxData(parseInt(selectedChartYear));
  }, [selectedChartYear, fetchMonthlyTxData]);


  useEffect(() => {
    const cleanupEtdScroll = setupAutoScroll(upcomingEtdScrollRef, upcomingEtdIntervalRef);
    const cleanupDraftScroll = setupAutoScroll(draftLcScrollRef, draftLcIntervalRef);
    const cleanupCompletedScroll = setupAutoScroll(completedLcScrollRef, completedLcIntervalRef);
    return () => {
      cleanupEtdScroll?.();
      cleanupDraftScroll?.();
      cleanupCompletedScroll?.();
    };
  }, [isLoading, upcomingEtdShipments, draftLCs, recentlyCompletedLCs]);

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const userDisplayName = authUser?.displayName || authUser?.email || 'User';

  if (userRole && !userRole.some(r => ['Super Admin', 'Admin', 'Viewer', 'Commercial'].includes(r))) {
    return (
      <div className="flex flex-col gap-8 mx-[10px]">
        {notice && <NoticeBoardDialog notice={notice} />}
        <div className="flex flex-row justify-between items-start gap-4 sm:items-center">
          <div>
            {greeting && authUser && (
              <h2 className="text-base font-semibold text-foreground mb-1 mt-[5px]">
                {greeting}, <span className="text-primary">{userDisplayName}</span>!
              </h2>
            )}
            <h1
              className={cn(
                "font-bold text-lg sm:text-2xl lg:text-3xl",
                "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
              )}
            >
              Welcome
            </h1>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Role-Based Access</CardTitle>
            <CardDescription>
              Your dashboard is tailored to your role. Please use the sidebar to navigate to your assigned modules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground mr-1">You have access to the</span>
              {userRole.map((role, index) => {
                const roleLinks: Record<string, string> = {
                  'HR': '/dashboard/hr/dashboard',
                  'Service': '/dashboard/warranty-management/search',
                  'DemoManager': '/dashboard/demo/demo-machine-search',
                  'Accounts': '/dashboard/petty-cash/dashboard',
                  'Admin': '/dashboard',
                  'Super Admin': '/dashboard',
                  'Commercial': '/dashboard',
                  'Inventory': '/dashboard/inventory',
                };
                const href = roleLinks[role] || '#';
                return (
                  <React.Fragment key={role}>
                    <Link href={href}>
                      <Button variant="default" size="sm" className="font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all">
                        {role}
                      </Button>
                    </Link>
                    {index < userRole.length - 1 && <span className="text-muted-foreground">,</span>}
                  </React.Fragment>
                );
              })}
              <span className="text-sm text-muted-foreground ml-1 mr-2">modules.</span>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <Link href="/dashboard/account-details">
                <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all ml-1">
                  My Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const DashboardSkeleton = () => (
    <>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="shadow-lg">
            <CardContent className="p-6 flex justify-between items-center">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-12 w-12 rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg"><CardContent className="p-6 h-[400px] md:h-[350px]"><Skeleton className="h-full w-full rounded-md" /></CardContent></Card>
        <Card className="shadow-lg"><CardContent className="p-6 h-[400px] md:h-[350px]"><Skeleton className="h-full w-full rounded-md" /></CardContent></Card>
      </div>
      <Card className="shadow-lg"><CardContent className="p-6 h-[350px]"><Skeleton className="h-full w-full rounded-md" /></CardContent></Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg"><CardContent className="p-6 h-[350px]"><Skeleton className="h-full w-full rounded-md" /></CardContent></Card>
        <Card className="shadow-lg"><CardContent className="p-6 h-[350px]"><Skeleton className="h-full w-full rounded-md" /></CardContent></Card>
      </div>
    </>
  );


  return (
    <div className="flex flex-col gap-8 mx-[10px]">
      {notice && <NoticeBoardDialog notice={notice} />}
      <div className="flex flex-row justify-between items-start gap-4 sm:items-center md:px-5">
        <div>
          {greeting && authUser && (
            <h2 className="text-base font-semibold text-foreground mb-1 mt-[5px]">
              {greeting}, <span className="text-primary">{userDisplayName}</span>!
            </h2>
          )}
          <h1
            className={cn(
              "font-bold text-lg sm:text-2xl lg:text-3xl",
              "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
            )}
          >
            Dashboard Overview
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px] sm:w-[100px] bg-card shadow-sm mt-[5px] sm:mt-0">
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
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title={`Total L/Cs Opened (${selectedYear})`}
              value={dashboardStats.totalLCs.toLocaleString()}
              icon={<Package />}
              description={`${dashboardStats.thisMonthLCQty} L/C this month`}
              className="bg-[#4A90E2]"
            />
            <StatCard
              title={`Total L/Cs Value (${selectedYear})`}
              value={`$${(dashboardStats.totalLCValue / 1_000_000).toFixed(2)}M`}
              icon={<DollarSign />}
              description="Total value in USD"
              className="bg-[#50E3C2]"
            />
            <StatCard
              title={`Active Beneficiaries (${selectedYear})`}
              value={dashboardStats.activeSuppliers.toLocaleString()}
              icon={<Truck />}
              description="Unique suppliers"
              className="bg-[#BD10E0]"
            />
            <StatCard
              title={`Active Applicants (${selectedYear})`}
              value={dashboardStats.activeApplicants.toLocaleString()}
              icon={<Factory />}
              description="Unique customers"
              className="bg-[#F5A623]"
            />
            <StatCard
              title={`Linked PIs (${selectedYear})`}
              value={dashboardStats.totalLinkedPIs.toLocaleString()}
              icon={<Layers />}
              description="PIs connected to L/Cs"
              className="bg-[#7ED321]"
            />
            <StatCard
              title="Monthly L/C Quantity"
              value={dashboardStats.thisMonthLCQty.toLocaleString()}
              icon={<TrendingUp />}
              description={`Opened in ${format(new Date(), 'MMMM')}`}
              className="bg-[#9013FE]"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-1 shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="font-bold text-xl lg:text-2xl flex items-center gap-2 bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out">
                  <PieChartIcon className="h-6 w-6 text-primary" />
                  Beneficiary L/Cs Value Distribution
                </CardTitle>
                <CardDescription>
                  Breakdown of T/T and L/C value by beneficiary brand name for {selectedYear}.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] md:h-[350px] w-full">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading chart data...</p>
                  </div>
                ) : supplierPieData.length > 0 ? (
                  <SupplierPieChart data={supplierPieData} />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No L/C data available to display pie chart for {selectedYear}.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="font-bold text-xl lg:text-2xl flex items-center gap-2 bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out">
                    <Ship className="h-6 w-6 text-primary" />
                    Upcoming ETDs
                  </CardTitle>
                  <CardDescription>
                    L/Cs from {selectedYear} nearing ETD (Shipment Arranged).
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="h-[350px] space-y-3">
                {isLoading || upcomingEtdShipments.length === 0 && !isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <p className="text-sm text-muted-foreground text-center">No upcoming ETDs found for {selectedYear}.</p>}
                  </div>
                ) : (
                  <div
                    ref={upcomingEtdScrollRef}
                    className="h-full overflow-y-auto space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    {upcomingEtdShipments.map((shipment) => (
                      <li key={shipment.id} className="text-sm p-3 rounded-md border hover:bg-muted/50 list-none relative">
                        <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                          {[
                            { flag: shipment.isFirstShipment, label: "1st", note: shipment.firstShipmentNote },
                            { flag: shipment.isSecondShipment, label: "2nd", note: shipment.secondShipmentNote },
                            { flag: shipment.isThirdShipment, label: "3rd", note: shipment.thirdShipmentNote }
                          ].map((s, idx) => (
                            s.label && (
                              <TooltipProvider key={idx} delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link href={`/dashboard/total-lc/${shipment.id}/edit`} passHref>
                                      <Button
                                        variant={s.flag ? "default" : "outline"}
                                        size="icon"
                                        className={cn("h-7 w-7 rounded-full p-0 text-xs font-bold", s.flag ? "bg-green-500 hover:bg-green-600 text-white" : "border-destructive text-destructive hover:bg-destructive/10")}
                                      >
                                        {s.label}
                                      </Button>
                                    </Link>
                                  </TooltipTrigger>
                                  {s.note && (
                                    <TooltipContent side="top">
                                      <p className="max-w-xs">{s.note}</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            )
                          ))}
                        </div>
                        <Link href={`/dashboard/total-lc/${shipment.id}/edit`} className="font-medium text-primary hover:underline truncate block pr-24">
                          {shipment.documentaryCreditNumber || 'N/A'}
                        </Link>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          <div>
                            <p className="truncate">Applicant: <span className="font-medium text-foreground">{shipment.applicantName || 'N/A'}</span></p>
                            <p className="truncate">Value: <span className="font-medium text-foreground">{formatCurrencyValue(shipment.currency, shipment.amount)}</span></p>
                            <p className="truncate">ETD: <span className="font-medium text-foreground">{formatDisplayDate(shipment.etdDate)}</span></p>
                          </div>
                          <div>
                            <p className="truncate">Beneficiary: <span className="font-medium text-foreground">{shipment.beneficiaryName || 'N/A'}</span></p>
                            <p className="truncate">ETA: <span className="font-medium text-foreground">{formatDisplayDate(shipment.etaDate)}</span></p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                  <BarChart3 className="h-6 w-6 text-primary" />
                  Total L/C Values by Year
                </CardTitle>
                <CardDescription>
                  Overview of total T/T and L/C values for each year.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] w-full">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading yearly chart data...</p>
                  </div>
                ) : yearlyLcValueData.some(d => d.totalValue !== null && d.totalValue > 0) ? (
                  <YearlyLcValueBarChart data={yearlyLcValueData} />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No data available to display yearly L/C values chart.</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-xl">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                      <BarChart3 className="h-6 w-6 text-primary" />
                      Monthly Transaction Flow
                    </CardTitle>
                    <CardDescription>
                      Total debits and credits for each month in the selected year.
                    </CardDescription>
                  </div>
                  <div className="w-full sm:w-auto">
                    <Label htmlFor="chart-year-select-main" className="sr-only">Select Year</Label>
                    <Select value={selectedChartYear} onValueChange={setSelectedChartYear}>
                      <SelectTrigger id="chart-year-select-main" className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[350px] w-full">
                <MonthlyTransactionBarChart data={monthlyTxData} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                    <FileEdit className="h-6 w-6 text-primary" />
                    Draft L/Cs
                  </CardTitle>
                  <CardDescription>
                    T/T and L/Cs currently in "Draft" status for {selectedYear}, sorted by most recent T/T and L/C open.
                  </CardDescription>
                </div>
                <Button
                  variant="default"
                  className="rounded-full bg-accent text-accent-foreground text-xl font-bold h-8 px-2.5 flex items-center justify-center"
                >
                  {draftLCs.length}
                </Button>
              </CardHeader>
              <CardContent className="h-[350px] space-y-3">
                {isLoading || draftLCs.length === 0 && !isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <p className="text-sm text-muted-foreground text-center">No L/Cs in &quot;Draft&quot; status found for {selectedYear}.</p>}
                  </div>
                ) : (
                  <div ref={draftLcScrollRef} className="h-full overflow-y-auto space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {draftLCs.map((lc) => (
                      <li key={lc.id} className="text-sm p-3 rounded-md border hover:bg-muted/50 list-none">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
                          <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-medium text-primary hover:underline truncate">
                            {lc.documentaryCreditNumber || 'N/A'}
                          </Link>
                          <div className="flex items-center gap-2 mt-1 sm:mt-0">
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(lc.status) ? (
                                lc.status.map(s => (
                                  <Badge
                                    key={s}
                                    variant={getStatusBadgeVariant(s)}
                                    className={s === 'Draft' ? 'bg-primary/20 text-primary border-primary/30' : ''}
                                  >
                                    {s}
                                  </Badge>
                                ))
                              ) : (
                                <Badge
                                  variant={getStatusBadgeVariant(lc.status as LCStatus)}
                                  className={(lc.status as LCStatus) === 'Draft' ? 'bg-primary/20 text-primary border-primary/30' : ''}
                                >
                                  {lc.status}
                                </Badge>
                              )}
                            </div>
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
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className={cn("font-bold text-xl lg:text-2xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    Recently Completed L/Cs
                  </CardTitle>
                  <CardDescription>
                    L/Cs marked as "Shipment Done" in {selectedYear}, sorted by most recent update.
                  </CardDescription>
                </div>
                <Button
                  variant="default"
                  className="rounded-full bg-accent text-accent-foreground text-xl font-bold h-8 px-2.5 flex items-center justify-center"
                >
                  {recentlyCompletedLCs.length}
                </Button>
              </CardHeader>
              <CardContent className="h-[350px] space-y-3">
                {isLoading || recentlyCompletedLCs.length === 0 && !isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <p className="text-sm text-muted-foreground text-center">No L/Cs marked as &quot;Shipment Done&quot; found for {selectedYear}.</p>}
                  </div>
                ) : (
                  <div ref={completedLcScrollRef} className="h-full overflow-y-auto space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {recentlyCompletedLCs.map((lc) => (
                      <li key={lc.id} className="text-sm p-3 rounded-md border hover:bg-muted/50 list-none">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1">
                          <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-medium text-primary hover:underline truncate">
                            {lc.documentaryCreditNumber || 'N/A'}
                          </Link>
                          <div className="flex items-center gap-2 mt-1 sm:mt-0">
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(lc.status) ? (
                                lc.status.map(s => (
                                  <Badge
                                    key={s}
                                    variant={getStatusBadgeVariant(s)}
                                    className={s === 'Shipment Done' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' : ''}
                                  >
                                    {s}
                                  </Badge>
                                ))
                              ) : (
                                <Badge
                                  variant={getStatusBadgeVariant(lc.status as LCStatus)}
                                  className={(lc.status as LCStatus) === 'Shipment Done' ? 'bg-green-600 text-white dark:bg-green-500 dark:text-black' : ''}
                                >
                                  {lc.status}
                                </Badge>
                              )}
                            </div>
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
                  </div>
                )}
              </CardContent>
            </Card>
          </div>


        </>
      )}
    </div>
  );
}






















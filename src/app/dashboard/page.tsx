
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, DollarSign, UsersRound, PieChart as PieChartIcon, CalendarDays, Search, TrendingUp, CalendarIcon, Users, Loader2, CheckCircle2, Ship, FileEdit } from 'lucide-react';
import { SupplierPieChart } from '@/components/dashboard/SupplierPieChart';
import { Separator } from '@/components/ui/separator';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { LCEntryDocument, LCStatus, Currency } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isValid, isFuture, isToday, compareAsc } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const years = ["2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028", "2029", "2030"];

interface DashboardStats {
  totalLCs: number;
  totalLCValue: number;
  activeSuppliers: number;
  activeApplicants: number;
  thisMonthLCQty: number;
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
  updatedAtDate: Date;
  status?: LCStatus;
  currency?: Currency;
  amount?: number;
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
  etdDate: Date;
}


// Predefined fill colors for the pie chart
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
    case 'Shipping pending':
      return 'default';
    case 'Shipping going on':
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


export default function DashboardPage() {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalLCs: 0,
    totalLCValue: 0,
    activeSuppliers: 0,
    activeApplicants: 0,
    thisMonthLCQty: 0,
  });
  const [supplierPieData, setSupplierPieData] = useState<PieChartDataItem[]>([]);
  const [recentlyCompletedLCs, setRecentlyCompletedLCs] = useState<RecentlyCompletedLC[]>([]);
  const [draftLCs, setDraftLCs] = useState<DraftLC[]>([]);
  const [upcomingEtdShipments, setUpcomingEtdShipments] = useState<UpcomingEtdShipment[]>([]);
  const [searchLcNumber, setSearchLcNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);


  const fetchDashboardData = useCallback(async (year: string) => {
    setIsLoading(true);
    try {
      const yearNumber = parseInt(year);
      const lcEntriesRef = collection(firestore, "lc_entries");
      const q = query(lcEntriesRef, where("year", "==", yearNumber));
      const querySnapshot = await getDocs(q);

      const lcEntriesForTheYear: LCEntryDocument[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<LCEntryDocument, 'id'>;

        lcEntriesForTheYear.push({
            id: doc.id,
            ...data,
          } as LCEntryDocument);
      });

      if (lcEntriesForTheYear.length === 0) {
        setDashboardStats({
          totalLCs: 0,
          totalLCValue: 0,
          activeSuppliers: 0,
          activeApplicants: 0,
          thisMonthLCQty: 0,
        });
        setSupplierPieData([]);
        setRecentlyCompletedLCs([]);
        setDraftLCs([]);
        setUpcomingEtdShipments([]);
        setIsLoading(false);
        return;
      }

      const totalLCValue = lcEntriesForTheYear.reduce((sum, lc) => sum + (lc.amount || 0), 0);

      const uniqueBeneficiaryIds = new Set(lcEntriesForTheYear.map(lc => lc.beneficiaryId).filter(id => id));
      const activeSuppliers = uniqueBeneficiaryIds.size;

      const uniqueApplicantIds = new Set(lcEntriesForTheYear.map(lc => lc.applicantId).filter(id => id));
      const activeApplicants = uniqueApplicantIds.size;

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();

      let thisMonthLCQty = 0;
      if (yearNumber === currentYear) {
        const firstDayOfMonth = startOfMonth(currentDate);
        const lastDayOfMonth = endOfMonth(currentDate);

        thisMonthLCQty = lcEntriesForTheYear.filter(lc => {
          if (!lc.lcIssueDate) return false;
          try {
            const issueDate = parseISO(lc.lcIssueDate);
            return isWithinInterval(issueDate, { start: firstDayOfMonth, end: lastDayOfMonth });
          } catch (e) {
            return false;
          }
        }).length;
      }

      setDashboardStats({
        totalLCs: lcEntriesForTheYear.length,
        totalLCValue,
        activeSuppliers,
        activeApplicants,
        thisMonthLCQty,
      });

      // Prepare data for pie chart
      const supplierValueMap: { [key: string]: number } = {};
      lcEntriesForTheYear.forEach(lc => {
        const name = lc.beneficiaryName || 'Unknown Supplier';
        supplierValueMap[name] = (supplierValueMap[name] || 0) + (lc.amount || 0);
      });

      const pieData = Object.entries(supplierValueMap)
        .map(([name, value], index) => ({
          name,
          value,
          fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value);

      setSupplierPieData(pieData);

      // Recently Completed L/Cs
      const completedLCs = lcEntriesForTheYear
        .filter(lc => lc.status === 'Done')
        .map(lc => {
          let updatedAtDate = new Date();
          if (lc.updatedAt) {
            if (typeof (lc.updatedAt as unknown as Timestamp).toDate === 'function') {
              updatedAtDate = (lc.updatedAt as unknown as Timestamp).toDate();
            } else {
              try {
                const parsedDate = parseISO(lc.updatedAt as string);
                if (isValid(parsedDate)) {
                    updatedAtDate = parsedDate;
                } else {
                    updatedAtDate = new Date(0); // Fallback for invalid date string
                }
              } catch {
                updatedAtDate = new Date(0); // Fallback for unparseable string
              }
            }
          }
          return {
            id: lc.id,
            documentaryCreditNumber: lc.documentaryCreditNumber,
            beneficiaryName: lc.beneficiaryName,
            applicantName: lc.applicantName,
            updatedAt: lc.updatedAt,
            updatedAtDate: updatedAtDate,
            status: lc.status,
            currency: lc.currency,
            amount: lc.amount,
          } as RecentlyCompletedLC;
        })
        .sort((a, b) => b.updatedAtDate.getTime() - a.updatedAtDate.getTime())
        .slice(0, 10); 

      setRecentlyCompletedLCs(completedLCs);

      // Draft L/Cs
      const currentDraftLCs = lcEntriesForTheYear
        .filter(lc => lc.status === 'Draft')
        .map(lc => {
          let createdAtDate = new Date(0);
          if (lc.createdAt) {
            if (typeof (lc.createdAt as unknown as Timestamp).toDate === 'function') {
              createdAtDate = (lc.createdAt as unknown as Timestamp).toDate();
            } else {
              try {
                const parsedDate = parseISO(lc.createdAt as string);
                if (isValid(parsedDate)) {
                  createdAtDate = parsedDate;
                }
              } catch {
                // Keep default invalid date if parsing fails
              }
            }
          }
          return {
            id: lc.id,
            documentaryCreditNumber: lc.documentaryCreditNumber,
            beneficiaryName: lc.beneficiaryName,
            applicantName: lc.applicantName,
            createdAtDate: createdAtDate,
            status: lc.status,
            currency: lc.currency,
            amount: lc.amount,
          } as DraftLC;
        })
        .sort((a, b) => b.createdAtDate.getTime() - a.createdAtDate.getTime())
        .slice(0, 10);
      
      setDraftLCs(currentDraftLCs);


      // Upcoming ETDs
      const today = new Date();
      today.setHours(0,0,0,0); // Set to start of today for comparison

      const filteredUpcomingEtds = lcEntriesForTheYear
        .filter(lc => {
            if (!lc.etd || lc.status === 'Done') return false;
            try {
                const etdDate = parseISO(lc.etd);
                return isValid(etdDate) && (isToday(etdDate) || isFuture(etdDate));
            } catch (e) {
                return false;
            }
        })
        .map(lc => ({
            id: lc.id,
            documentaryCreditNumber: lc.documentaryCreditNumber,
            beneficiaryName: lc.beneficiaryName,
            etdDate: parseISO(lc.etd!), // etd is confirmed to exist here
        }))
        .sort((a, b) => compareAsc(a.etdDate, b.etdDate))
        .slice(0, 10); 

      setUpcomingEtdShipments(filteredUpcomingEtds);


    } catch (error) {
      console.error("Error fetching dashboard data: ", error);
      Swal.fire("Error", `Could not fetch dashboard data: ${(error as Error).message}`, "error");
      setDashboardStats({ totalLCs: 0, totalLCValue: 0, activeSuppliers: 0, activeApplicants: 0, thisMonthLCQty: 0 });
      setSupplierPieData([]);
      setRecentlyCompletedLCs([]);
      setDraftLCs([]);
      setUpcomingEtdShipments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(selectedYear);
  }, [selectedYear, fetchDashboardData]);

  const handleSearchLC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchLcNumber.trim()) {
      Swal.fire("Info", "Please enter an L/C number to search.", "info");
      return;
    }
    setIsSearching(true);
    try {
      const lcEntriesRef = collection(firestore, "lc_entries");
      const q = query(lcEntriesRef, where("documentaryCreditNumber", "==", searchLcNumber.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Swal.fire("Not Found", `No L/C found with number: ${searchLcNumber}`, "warning");
      } else {
        const lcDoc = querySnapshot.docs[0];
        Swal.fire({
            title: "L/C Found!",
            text: `Redirecting to details for L/C ${lcDoc.data().documentaryCreditNumber}.`,
            icon: "success",
            timer: 1500,
            showConfirmButton: false,
        });
        router.push(`/dashboard/total-lc/${lcDoc.id}/edit`);
      }
    } catch (error) {
      console.error("Error searching L/C: ", error);
      Swal.fire("Error", `Failed to search L/C: ${(error as Error).message}`, "error");
    } finally {
      setIsSearching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading dashboard data for {selectedYear}...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className={cn("font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>Dashboard Overview</h1>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px] bg-card shadow-sm">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title="Total L/Cs"
          value={dashboardStats.totalLCs.toLocaleString()}
          icon={<Package className="h-7 w-7 text-primary" />}
          description={`For year ${selectedYear}`}
        />
        <StatCard
          title="Total L/C Value"
          value={`$${dashboardStats.totalLCValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-7 w-7 text-primary" />}
          description={`For year ${selectedYear}`}
          className="lg:col-span-2"
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
          title="This Month's L/C Qty"
          value={dashboardStats.thisMonthLCQty.toLocaleString()}
          icon={<TrendingUp className="h-7 w-7 text-primary" />}
          description={`In ${format(new Date(), 'MMMM')}, ${parseInt(selectedYear) === new Date().getFullYear() ? selectedYear : ' (Current Year Only)'}`}
          className="lg:col-start-1"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2 text-xl", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <PieChartIcon className="h-6 w-6 text-primary" />
              Beneficiary L/C Value Distribution
            </CardTitle>
            <CardDescription>
              Breakdown of L/C value by beneficiary for {selectedYear}.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] w-full">
            {supplierPieData.length > 0 ? (
              <SupplierPieChart data={supplierPieData} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No L/C data available to display chart for {selectedYear}.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className={cn("flex items-center gap-2 text-xl", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Search className="h-6 w-6 text-primary" />
                Search L/C
              </CardTitle>
              <CardDescription>
                Find a specific L/C by its number.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchLC} className="flex w-full items-center space-x-2">
                <Input
                    type="text"
                    placeholder="Enter L/C Number..."
                    className="flex-1"
                    value={searchLcNumber}
                    onChange={(e) => setSearchLcNumber(e.target.value)}
                />
                <Button type="submit" variant="outline" disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className={cn("flex items-center gap-2 text-xl", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Ship className="h-6 w-6 text-primary" />
                Upcoming ETDs
              </CardTitle>
              <CardDescription>
                L/Cs from {selectedYear} nearing their Estimated Time of Departure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingEtdShipments.length > 0 ? (
                 <ul className="space-y-2">
                  {upcomingEtdShipments.map((shipment) => (
                    <li key={shipment.id} className="text-sm p-3 rounded-md border hover:bg-muted/50">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 items-center">
                        <Link href={`/dashboard/total-lc/${shipment.id}/edit`} className="font-medium text-primary hover:underline truncate sm:col-span-1">
                          {shipment.documentaryCreditNumber || 'N/A'}
                        </Link>
                        <span className="text-xs text-muted-foreground break-all truncate sm:col-span-1">
                          Beneficiary: {shipment.beneficiaryName || 'N/A'}
                        </span>
                        <span className="font-semibold text-foreground mt-1 sm:mt-0 sm:text-right sm:col-span-1">
                          {format(shipment.etdDate, 'PPP')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming ETDs found for {selectedYear}.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2 text-xl", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <FileEdit className="h-6 w-6 text-primary" /> {/* Icon for Draft L/Cs */}
              Draft L/Cs
            </CardTitle>
            <CardDescription>
              L/Cs currently in &quot;Draft&quot; status for {selectedYear}, sorted by most recent creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {draftLCs.length > 0 ? (
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
                              lc.status === 'Draft' ? 'bg-blue-100 text-blue-700 border-blue-300' : ''
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
                        <p className="truncate">Applicant: <span className="font-medium text-foreground">{lc.applicantName || 'N/A'}</span></p>
                        <p className="truncate">Beneficiary: <span className="font-medium text-foreground">{lc.beneficiaryName || 'N/A'}</span></p>
                        <p>Value: <span className="font-medium text-foreground">{formatCurrencyValue(lc.currency, lc.amount)}</span></p>
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
            <CardTitle className={cn("flex items-center gap-2 text-xl", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <CheckCircle2 className="h-6 w-6 text-primary" />
              Recently Completed L/Cs
            </CardTitle>
            <CardDescription>
              L/Cs marked as &quot;Done&quot; in {selectedYear}, sorted by most recent update.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentlyCompletedLCs.length > 0 ? (
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
                              lc.status === 'Done' ? 'bg-green-600 text-white' : ''
                            }
                          >
                            {lc.status || 'N/A'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                          Completed: {format(lc.updatedAtDate, 'PPP')}
                          </span>
                      </div>
                    </div>
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <p className="truncate">Applicant: <span className="font-medium text-foreground">{lc.applicantName || 'N/A'}</span></p>
                      <p className="truncate">Beneficiary: <span className="font-medium text-foreground">{lc.beneficiaryName || 'N/A'}</span></p>
                      <p>Value: <span className="font-medium text-foreground">{formatCurrencyValue(lc.currency, lc.amount)}</span></p>
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

    </div>
  );
}

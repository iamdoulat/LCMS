
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, DollarSign, UsersRound, PieChart as PieChartIcon, CalendarDays, Search, TrendingUp, CalendarIcon, Users, Loader2, CheckCircle2, Ship } from 'lucide-react';
import { SupplierPieChart } from '@/components/dashboard/SupplierPieChart';
import { Separator } from '@/components/ui/separator';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { LCEntryDocument, LCStatus } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isValid, isFuture, isToday, compareAsc } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';

const years = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

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

interface RecentlyCompletedLC extends Pick<LCEntryDocument, 'id' | 'documentaryCreditNumber' | 'beneficiaryName' | 'updatedAt' | 'status'> {
  updatedAtDate: Date;
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
            updatedAt: lc.updatedAt,
            updatedAtDate: updatedAtDate,
            status: lc.status,
          } as RecentlyCompletedLC;
        })
        .sort((a, b) => b.updatedAtDate.getTime() - a.updatedAtDate.getTime())
        .slice(0, 5);

      setRecentlyCompletedLCs(completedLCs);

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
        .slice(0, 5); // Show top 5

      setUpcomingEtdShipments(filteredUpcomingEtds);


    } catch (error) {
      console.error("Error fetching dashboard data: ", error);
      Swal.fire("Error", `Could not fetch dashboard data: ${(error as Error).message}`, "error");
      setDashboardStats({ totalLCs: 0, totalLCValue: 0, activeSuppliers: 0, activeApplicants: 0, thisMonthLCQty: 0 });
      setSupplierPieData([]);
      setRecentlyCompletedLCs([]);
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
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Dashboard Overview</h1>
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
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
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
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <Search className="h-6 w-6 text-accent" />
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
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <Ship className="h-6 w-6 text-accent" /> {/* Changed icon */}
                Upcoming ETDs
              </CardTitle>
              <CardDescription>
                L/Cs from {selectedYear} nearing their Estimated Time of Departure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingEtdShipments.length > 0 ? (
                <ul className="space-y-3">
                  {upcomingEtdShipments.map((shipment) => (
                    <li key={shipment.id} className="text-sm">
                       <Link href={`/dashboard/total-lc/${shipment.id}/edit`} className="font-medium text-primary hover:underline">
                        {shipment.documentaryCreditNumber || 'N/A'}
                      </Link>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Beneficiary: {shipment.beneficiaryName || 'N/A'}</span>
                        <span className="font-semibold text-foreground">{format(shipment.etdDate, 'PPP')}</span>
                      </div>
                      {upcomingEtdShipments.indexOf(shipment) < upcomingEtdShipments.length - 1 && <Separator className="mt-2" />}
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

      <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
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
                  <div className="flex justify-between items-center mb-1">
                    <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="font-medium text-primary hover:underline">
                      {lc.documentaryCreditNumber || 'N/A'}
                    </Link>
                    <div className="flex items-center gap-2">
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
                  <p className="text-xs text-muted-foreground">
                    Beneficiary: {lc.beneficiaryName || 'N/A'}
                  </p>
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
  );
}

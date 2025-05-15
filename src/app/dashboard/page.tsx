
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, DollarSign, UsersRound, PieChart as PieChartIcon, CalendarDays, Search, TrendingUp, CalendarIcon, Users, Loader2, CheckCircle2 } from 'lucide-react';
import { SupplierPieChart } from '@/components/dashboard/SupplierPieChart';
import { Separator } from '@/components/ui/separator';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { LCEntryDocument } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

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

interface RecentlyCompletedLC extends Pick<LCEntryDocument, 'id' | 'documentaryCreditNumber' | 'beneficiaryName' | 'updatedAt'> {
  updatedAtDate: Date; // For sorting and display
}

// Predefined fill colors for the pie chart
const PIE_CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];


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
        // Ensure updatedAt is converted to a JavaScript Date if it's a Firestore Timestamp
        let updatedAtJSDate;
        if (data.updatedAt && typeof (data.updatedAt as unknown as Timestamp).toDate === 'function') {
          updatedAtJSDate = (data.updatedAt as unknown as Timestamp).toDate();
        } else if (data.updatedAt) {
          // Attempt to parse if it's already a string (less ideal)
          updatedAtJSDate = parseISO(data.updatedAt as string);
        }

        lcEntriesForTheYear.push({ 
            id: doc.id, 
            ...data,
            // For consistent handling, ensure dates are strings or proper Date objects based on LCEntryDocument
            // This spread ensures all fields are present
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
          let updatedAtDate = new Date(); // Default to now if updatedAt is missing or invalid
          if (lc.updatedAt) {
            if (typeof (lc.updatedAt as unknown as Timestamp).toDate === 'function') {
              updatedAtDate = (lc.updatedAt as unknown as Timestamp).toDate();
            } else {
              try {
                updatedAtDate = parseISO(lc.updatedAt as string);
                if (!isValid(updatedAtDate)) updatedAtDate = new Date(0); // Fallback for invalid date string
              } catch {
                updatedAtDate = new Date(0); // Fallback for unparseable string
              }
            }
          }
          return {
            id: lc.id,
            documentaryCreditNumber: lc.documentaryCreditNumber,
            beneficiaryName: lc.beneficiaryName,
            updatedAt: lc.updatedAt, // Keep original for type consistency if needed elsewhere
            updatedAtDate: updatedAtDate,
          } as RecentlyCompletedLC;
        })
        .sort((a, b) => b.updatedAtDate.getTime() - a.updatedAtDate.getTime()) // Sort by date descending
        .slice(0, 5); // Take top 5

      setRecentlyCompletedLCs(completedLCs);

    } catch (error) {
      console.error("Error fetching dashboard data: ", error);
      Swal.fire("Error", `Could not fetch dashboard data: ${(error as Error).message}`, "error");
      setDashboardStats({ totalLCs: 0, totalLCValue: 0, activeSuppliers: 0, activeApplicants: 0, thisMonthLCQty: 0 });
      setSupplierPieData([]);
      setRecentlyCompletedLCs([]);
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
        // Assuming L/C numbers are unique, take the first one
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


  // Placeholder data for upcoming shipments - to be replaced with real data
  const upcomingShipments = [
    { lcNumber: 'LC-00123', supplier: 'Supplier Beta', latestShipmentDate: '2024-08-15' },
    { lcNumber: 'LC-00124', supplier: 'Supplier Alpha', latestShipmentDate: '2024-08-22' },
    { lcNumber: 'LC-00125', supplier: 'Supplier Gamma', latestShipmentDate: '2024-09-01' },
  ];

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
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"> {/* Adjusted for 5 cards */}
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
                <CalendarDays className="h-6 w-6 text-accent" />
                Upcoming Shipments
              </CardTitle>
              <CardDescription>
                Key upcoming latest shipment dates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingShipments.length > 0 ? (
                <ul className="space-y-3">
                  {upcomingShipments.map((shipment, index) => (
                    <li key={index} className="text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-foreground">{shipment.lcNumber}</span>
                        <span className="text-muted-foreground">{new Date(shipment.latestShipmentDate).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Beneficiary: {shipment.supplier}</p>
                      {index < upcomingShipments.length - 1 && <Separator className="mt-2" />}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming shipments scheduled for {selectedYear}.</p>
              )}
            </CardContent>
             <CardFooter>
                <p className="text-xs text-muted-foreground">
                    Displaying placeholder data for upcoming shipments.
                </p>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Recently Completed L/Cs Card */}
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
                    <span className="text-xs text-muted-foreground">
                      Completed: {format(lc.updatedAtDate, 'PPP')}
                    </span>
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

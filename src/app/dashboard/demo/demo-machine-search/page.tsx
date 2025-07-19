
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Search as SearchIcon, Layers, Laptop, CheckCircle2, AlertTriangle, Hourglass, Info, ChevronLeft, ChevronRight, FileEdit, Loader2, BarChart3, CalendarDays } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/dashboard/StatCard';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image'; // Keep for GIF
import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, Timestamp, orderBy as firestoreOrderBy } from 'firebase/firestore';
import type { DemoMachineDocument, DemoMachineStatusOption } from '@/types'; // Import DemoMachineDocument
import { format, parseISO, isValid, getYear } from 'date-fns';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';

const currentSystemYear = new Date().getFullYear();
const yearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];
const ITEMS_PER_PAGE = 10;

// Interface for search result items displayed in the table
interface DemoMachineSearchResultItem extends DemoMachineDocument {}

const getDemoMachineStatusBadgeVariant = (status?: DemoMachineStatusOption): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Available':
      return 'default'; // Greenish or primary
    case 'Allocated':
      return 'secondary'; // Yellowish or secondary
    case 'Maintenance Mode':
      return 'destructive'; // Reddish
    default:
      return 'outline';
  }
};


export default function DemoMachineSearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [displayedSearchTerm, setDisplayedSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>("All Years");

  const [allDemoMachines, setAllDemoMachines] = useState<DemoMachineDocument[]>([]);
  const [searchResults, setSearchResults] = useState<DemoMachineSearchResultItem[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false); // For stats card loading
  const [isFetchingAllMachines, setIsFetchingAllMachines] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [currentSearchPage, setCurrentSearchPage] = useState(1);

  const [demoMachineStats, setDemoMachineStats] = useState({
    totalDemoMachines: 0,
    availableDemoMachines: 0,
    machinesInUse: 0, // For 'Allocated' status
    machinesUnderMaintenance: 0,
  });

  const fetchAllDemoMachinesAndStats = useCallback(async (yearToFilter: string) => {
    setIsLoadingStats(true);
    setIsFetchingAllMachines(true);
    setSearchError(null);

    let fetchedMachines: DemoMachineDocument[] = [];
    try {
      const machinesCollectionRef = collection(firestore, "demo_machines");
      const machinesQuery = query(machinesCollectionRef, firestoreOrderBy("createdAt", "desc"));
      const machinesSnapshot = await getDocs(machinesQuery);
      fetchedMachines = machinesSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        } as DemoMachineDocument;
      });
      setAllDemoMachines(fetchedMachines);
      setIsFetchingAllMachines(false);

      // Calculate Stats based on all fetched machines (or filtered by year if needed later for stats)
      let machinesForStats = fetchedMachines; // For now, stats are global, not year-filtered like dashboard
      // if (yearToFilter !== "All Years") { /* Add year filtering for stats if needed */ }

      let total = machinesForStats.length;
      let available = 0;
      let allocated = 0;
      let maintenance = 0;

      machinesForStats.forEach(machine => {
        if (machine.currentStatus === "Available") available++;
        else if (machine.currentStatus === "Allocated") allocated++;
        else if (machine.currentStatus === "Maintenance Mode") maintenance++;
      });

      setDemoMachineStats({
        totalDemoMachines: total,
        availableDemoMachines: available,
        machinesInUse: allocated,
        machinesUnderMaintenance: maintenance,
      });

    } catch (error: any) {
      console.error("Error fetching demo machines or stats:", error);
      const errorMsg = `Failed to load demo machines or stats: ${error.message}. Check Firestore rules for 'demo_machines'.`;
      Swal.fire("Fetch Error", errorMsg, "error");
      setSearchError(errorMsg);
      setAllDemoMachines([]);
      setIsFetchingAllMachines(false);
      setDemoMachineStats({ totalDemoMachines: 0, availableDemoMachines: 0, machinesInUse: 0, machinesUnderMaintenance: 0 });
    } finally {
      setIsLoadingStats(false);
    }
  }, []); // Empty dependency array because state setters are stable

  useEffect(() => {
    fetchAllDemoMachinesAndStats(selectedYear);
  }, [selectedYear, fetchAllDemoMachinesAndStats]);

  const handleSearchSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const trimmedSearchTerm = searchTerm.trim();
    setDisplayedSearchTerm(trimmedSearchTerm);
    setIsSearching(true);
    setCurrentSearchPage(1); // Reset to first page on new search

    if (!trimmedSearchTerm) {
      setSearchResults(allDemoMachines); // Show all if search term is empty
      setIsSearching(false);
      return;
    }

    const lowerSearchTerm = trimmedSearchTerm.toLowerCase();
    
    const foundMachines = allDemoMachines.filter(machine => {
      const modelMatch = machine.machineModel?.toLowerCase().includes(lowerSearchTerm);
      const serialMatch = machine.machineSerial?.toLowerCase().includes(lowerSearchTerm);
      const brandMatch = machine.machineBrand?.toLowerCase().includes(lowerSearchTerm);
      const ownerMatch = machine.machineOwner?.toLowerCase().includes(lowerSearchTerm);
      const statusMatch = machine.currentStatus?.toLowerCase().includes(lowerSearchTerm);
      const ctlBoxModelMatch = machine.motorOrControlBoxModel?.toLowerCase().includes(lowerSearchTerm);
      const ctlBoxSerialMatch = machine.controlBoxSerialNo?.toLowerCase().includes(lowerSearchTerm);

      return modelMatch || serialMatch || brandMatch || ownerMatch || statusMatch || ctlBoxModelMatch || ctlBoxSerialMatch;
    });

    setSearchResults(foundMachines.map(m => ({ ...m }))); // Map to satisfy DemoMachineSearchResultItem if needed
    setIsSearching(false);
  };

  const totalSearchPages = Math.ceil(searchResults.length / ITEMS_PER_PAGE);
  const indexOfLastSearchItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstSearchItem = indexOfLastSearchItem - ITEMS_PER_PAGE;
  const currentSearchItems = searchResults.slice(indexOfFirstSearchItem, indexOfLastSearchItem);

  const handleSearchPageChange = (pageNumber: number) => {
    setCurrentSearchPage(pageNumber);
  };

  const getSearchPageNumbers = () => {
    const pageNumbers = []; const maxPagesToShow = 5; const halfPagesToShow = Math.floor(maxPagesToShow / 2);
    if (totalSearchPages <= maxPagesToShow + 2) { for (let i = 1; i <= totalSearchPages; i++) pageNumbers.push(i); }
    else {
      pageNumbers.push(1); let startPage = Math.max(2, currentSearchPage - halfPagesToShow); let endPage = Math.min(totalSearchPages - 1, currentSearchPage + halfPagesToShow);
      if (currentSearchPage <= halfPagesToShow + 1) endPage = Math.min(totalSearchPages - 1, maxPagesToShow);
      if (currentSearchPage >= totalSearchPages - halfPagesToShow) startPage = Math.max(2, totalSearchPages - maxPagesToShow + 1);
      if (startPage > 2) pageNumbers.push("...");
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalSearchPages - 1) pageNumbers.push("...");
      pageNumbers.push(totalSearchPages); 
    } return pageNumbers;
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card 
        className="shadow-xl max-w-6xl mx-auto relative overflow-hidden"
      >
        <div className="relative z-10 bg-card/90 dark:bg-card/80 rounded-lg">
            <CardHeader className="text-center">
                <CardTitle className={cn("flex items-center justify-center gap-2 font-bold text-2xl lg:text-3xl text-card-foreground", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                  <Laptop className="h-7 w-7 text-primary" />
                  Demo M/C Search Engine
                </CardTitle>
                <CardDescription className="text-center pt-2 text-card-foreground/80">
                  Search for demo machine information.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleSearchSubmit} className="flex w-full max-w-md mx-auto items-center space-x-2 mb-8">
                <Input
                  type="search"
                  placeholder="Search by Model, Serial, Brand, Owner, Status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                  aria-label="Demo Machine Search Input"
                />
                <Button type="submit" variant="default" disabled={isSearching || isFetchingAllMachines}>
                  {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
                  Search
                </Button>
            </form>

            {isFetchingAllMachines && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <p className="text-card-foreground/80">Loading demo machines...</p>
              </div>
            )}

            {!isFetchingAllMachines && displayedSearchTerm && searchResults.length === 0 && !searchError && (
                <div className="text-center text-card-foreground/70 py-10">
                    <Info className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-lg">No demo machines found matching &quot;{displayedSearchTerm}&quot;.</p>
                </div>
            )}
            {searchError && !isFetchingAllMachines && (
                <div className="text-center text-destructive py-10">
                    <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-lg">{searchError}</p>
                </div>
            )}
            {!displayedSearchTerm && !isFetchingAllMachines && !searchError && (
                 <div className="text-center text-card-foreground/70 py-10">
                     <Image
                        src="https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/search_ani.gif?alt=media&token=cce7e0dd-9ff9-4af9-8e75-254699bd8283"
                        alt="Search Animation"
                        width={150}
                        height={150}
                        className="mx-auto mb-4"
                        unoptimized data-ai-hint="search animation"
                    />
                    <p className="text-lg">
                      Enter terms above to search demo machine information.
                    </p>
                </div>
            )}

            {currentSearchItems.length > 0 && !isFetchingAllMachines && !searchError && (
                <div className="space-y-6 mt-8">
                    <h3 className="text-lg font-semibold text-card-foreground mt-6 mb-2 text-center">
                        Search Results for &quot;{displayedSearchTerm || 'All Demo Machines'}&quot; (Showing {indexOfFirstSearchItem + 1}-{Math.min(indexOfLastSearchItem, searchResults.length)} of {searchResults.length} matching entries):
                    </h3>
                    <div className="rounded-md border">
                        <Table>
                        <TableHeader>
                            <TableRow>
                              <TableHead className="text-card-foreground/90">Machine Model</TableHead>
                              <TableHead className="text-card-foreground/90">Machine S/N</TableHead>
                              <TableHead className="text-card-foreground/90">Brand</TableHead>
                              <TableHead className="text-card-foreground/90">Owner</TableHead>
                              <TableHead className="text-card-foreground/90">Status</TableHead>
                              <TableHead className="text-card-foreground/90">Ctl. Box Model</TableHead>
                              <TableHead className="text-card-foreground/90">Ctl. Box S/N</TableHead>
                              <TableHead className="text-right text-card-foreground/90">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentSearchItems.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="text-card-foreground/80 font-medium">{item.machineModel || 'N/A'}</TableCell>
                                <TableCell className="text-card-foreground/80">{item.machineSerial || 'N/A'}</TableCell>
                                <TableCell className="text-card-foreground/80">{item.machineBrand || 'N/A'}</TableCell>
                                <TableCell className="text-card-foreground/80">{item.machineOwner || 'N/A'}</TableCell>
                                <TableCell className="text-card-foreground/80">
                                  {item.currentStatus && (
                                    <Badge variant={getDemoMachineStatusBadgeVariant(item.currentStatus)} className="text-xs">
                                      {item.currentStatus}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-card-foreground/80">{item.motorOrControlBoxModel || 'N/A'}</TableCell>
                                <TableCell className="text-card-foreground/80">{item.controlBoxSerialNo || 'N/A'}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="outline" size="sm" asChild>
                                    <Link href={`/dashboard/demo/edit-demo-machine/${item.id}`}>
                                      <FileEdit className="mr-1.5 h-3.5 w-3.5" /> Edit
                                    </Link>
                                  </Button>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        <TableCaption className="text-card-foreground/70 py-4">
                            Displaying demo machine search results.
                        </TableCaption>
                        </Table>
                    </div>

                    {totalSearchPages > 1 && (
                        <div className="flex items-center justify-center space-x-2 py-4 mt-4">
                          <Button variant="outline" size="sm" onClick={() => handleSearchPageChange(Math.max(1, currentSearchPage - 1))} disabled={currentSearchPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                          {getSearchPageNumbers().map((page, index) =>
                              typeof page === 'number' ? (
                              <Button key={`search-page-${page}`} variant={currentSearchPage === page ? 'default' : 'outline'} size="sm" onClick={() => handleSearchPageChange(page)} className="w-9 h-9 p-0">{page}</Button>
                              ) : (<span key={`ellipsis-search-${index}`} className="px-2 py-1 text-sm">{page}</span>)
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleSearchPageChange(Math.min(totalSearchPages, currentSearchPage + 1))} disabled={currentSearchPage === totalSearchPages}>Next <ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    )}
                </div>
            )}
            </CardContent>
        </div>
      </Card>

      <Card
        className="shadow-xl max-w-6xl mx-auto"
        style={{
          background: 'linear-gradient(0deg, rgba(203,247,247,0.2) 30%, rgba(232,227,218,0.1) 100%)',
        }}
      >
         <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
           <div className="flex-1 text-center sm:text-left">
            <CardTitle className={cn("flex items-center sm:justify-start justify-center gap-2", "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <BarChart3 className="h-6 w-6 text-primary"/>
                Yearly Demo M/C Statistics
            </CardTitle>
            <CardDescription className="text-card-foreground/80">
                Overview of demo machine status.
                (Selected year: {selectedYear === "All Years" ? "Overall" : selectedYear})
            </CardDescription>
           </div>
           <div className="w-full sm:w-auto">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full sm:w-[180px] bg-card shadow-sm">
                  <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearFilterOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <span className="text-card-foreground/80">Calculating statistics...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Demo Machines"
                    value={demoMachineStats.totalDemoMachines.toLocaleString()}
                    icon={<Layers className="h-6 w-6" />}
                    description="Overall count"
                    className="bg-[#4A90E2]"
                />
                <StatCard
                    title="Available Machines"
                    value={demoMachineStats.availableDemoMachines.toLocaleString()}
                    icon={<CheckCircle2 className="h-6 w-6" />}
                    description="Currently available"
                    className="bg-[#50E3C2]"
                />
                <StatCard
                    title="Machines In Use (Allocated)"
                    value={demoMachineStats.machinesInUse.toLocaleString()}
                    icon={<Hourglass className="h-6 w-6" />}
                    description="Currently allocated"
                    className="bg-[#F5A623]"
                />
                <StatCard
                    title="Machines Under Maintenance"
                    value={demoMachineStats.machinesUnderMaintenance.toLocaleString()}
                    icon={<Laptop className="h-6 w-6" />}
                    description="In maintenance mode"
                    className="bg-[#BD10E0]"
                />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

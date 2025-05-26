
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Search as SearchIcon, BarChart3, CalendarDays, Layers, Laptop, CheckCircle2, AlertTriangle, Hourglass, Info, ChevronLeft, ChevronRight, FileEdit, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/dashboard/StatCard';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
// import { firestore } from '@/lib/firebase/config'; // Assuming you'll fetch from Firestore later
// import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
// import type { InstallationReportDocument, InstallationDetailItem as PageInstallationDetailItemType } from '@/types'; // Assuming similar types or new ones
import { format, parseISO, isValid, getYear, addDays, isBefore, differenceInDays, startOfDay } from 'date-fns';


// Placeholder for actual Demo Machine document type if you define one later
interface DemoMachineSearchResultItem {
  id: string;
  machineName?: string;
  modelNumber?: string;
  serialNumber?: string;
  status?: string; // e.g., "Available", "In Use", "Maintenance"
  location?: string;
  // Add other relevant fields
  // For table display matching warranty search:
  reportId?: string; // To link back to a parent report if applicable
  installDate?: string; // ISO string
  warrantyStatus?: string; // "X days remaining", "Expired", "N/A"
  applicantName?: string; // For context
  beneficiaryName?: string; // For context
}

const currentSystemYear = new Date().getFullYear();
const yearFilterOptions = ["All Years", ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];
const ITEMS_PER_PAGE = 10;

export default function DemoMachineSearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [displayedSearchTerm, setDisplayedSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>("All Years");

  const [allDemoMachines, setAllDemoMachines] = useState<DemoMachineSearchResultItem[]>([]); // Placeholder for all fetched/simulated demo machines
  const [searchResults, setSearchResults] = useState<DemoMachineSearchResultItem[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false); // For stats card loading
  const [isSearching, setIsSearching] = useState(false); // For search results loading
  const [searchError, setSearchError] = useState<string | null>(null);
  const [currentSearchPage, setCurrentSearchPage] = useState(1);

  // Placeholder stats for Demo Machines
  const [demoMachineStats, setDemoMachineStats] = useState({
    totalDemoMachines: 0,
    availableDemoMachines: 0,
    machinesInUse: 0,
    machinesUnderMaintenance: 0,
    overdueDemoMachines: 0, // Example: Demo machines not returned on time
  });

  // Simulate fetching stats based on selectedYear
  const fetchDemoMachineStats = useCallback(async (year: string) => {
    setIsLoadingStats(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    // TODO: Replace with actual Firestore fetching logic for demo machine stats
    // For now, using random placeholder data
    setDemoMachineStats({
      totalDemoMachines: Math.floor(Math.random() * 50) + 10,
      availableDemoMachines: Math.floor(Math.random() * 30) + 5,
      machinesInUse: Math.floor(Math.random() * 15) + 1,
      machinesUnderMaintenance: Math.floor(Math.random() * 5),
      overdueDemoMachines: Math.floor(Math.random() * 3),
    });
    setIsLoadingStats(false);
  }, []); // Empty dependency array, so it runs once on mount or when called directly

  useEffect(() => {
    fetchDemoMachineStats(selectedYear);
  }, [selectedYear, fetchDemoMachineStats]);

  // Simulate fetching all demo machines for client-side search (replace with actual API call)
  useEffect(() => {
    const loadAllDemoMachines = async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 700));
      // TODO: Replace with actual data fetching from Firestore for 'demo_machines' collection
      const mockMachines: DemoMachineSearchResultItem[] = [
        { id: "dm001", reportId: "report1", machineName: "Demo Laser Cutter X1", modelNumber: "LCX1-DM", serialNumber: "DMLCX1001", status: "Available", location: "Showroom A", installDate: "2024-01-15T00:00:00.000Z", applicantName: "Tech Solutions Inc.", beneficiaryName: "LaserSource Co." },
        { id: "dm002", reportId: "report2", machineName: "Demo CNC Mill Pro", modelNumber: "CNCPRO-DM", serialNumber: "DMCNC005", status: "In Use", location: "Client Beta", installDate: "2023-11-20T00:00:00.000Z", applicantName: "Precision Parts Ltd.", beneficiaryName: "MillWorks" },
        { id: "dm003", reportId: "report3", machineName: "Demo 3D Printer Max", modelNumber: "3DMAX-DM", serialNumber: "DM3D0007", status: "Maintenance", location: "Workshop", installDate: "2024-03-10T00:00:00.000Z", applicantName: "Innovate Hub", beneficiaryName: "PrintFuture" },
        { id: "dm004", reportId: "report4", machineName: "Another Demo Laser", modelNumber: "LCX2-DM", serialNumber: "LASERDEMO002", status: "Available", location: "Warehouse B", installDate: "2024-05-01T00:00:00.000Z", applicantName: "Creative Designs", beneficiaryName: "LaserSource Co." },
      ];
      setAllDemoMachines(mockMachines);
    };
    loadAllDemoMachines();
  }, []);

  const handleSearchSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const trimmedSearchTerm = searchTerm.trim();
    setDisplayedSearchTerm(trimmedSearchTerm);
    setIsSearching(true);
    setSearchError(null);
    setCurrentSearchPage(1);
    setSearchResults([]);

    if (!trimmedSearchTerm) {
      setIsSearching(false);
      return;
    }

    // Simulate API call or client-side filtering
    await new Promise(resolve => setTimeout(resolve, 1000));

    const lowerSearchTerm = trimmedSearchTerm.toLowerCase();
    let yearFilteredMachines = allDemoMachines;

    if (selectedYear !== "All Years") {
      const numericYear = parseInt(selectedYear);
      yearFilteredMachines = allDemoMachines.filter(machine => {
        // Assuming 'installDate' is relevant for year filtering for demo machines
        if (machine.installDate) {
          try {
            const installDateObj = parseISO(machine.installDate);
            return isValid(installDateObj) && getYear(installDateObj) === numericYear;
          } catch { return false; }
        }
        return false; // If no installDate, exclude from year-specific search
      });
    }
    
    const foundMachines = yearFilteredMachines.filter(machine => {
      return (
        machine.machineName?.toLowerCase().includes(lowerSearchTerm) ||
        machine.modelNumber?.toLowerCase().includes(lowerSearchTerm) ||
        machine.serialNumber?.toLowerCase().includes(lowerSearchTerm) ||
        machine.status?.toLowerCase().includes(lowerSearchTerm) ||
        machine.location?.toLowerCase().includes(lowerSearchTerm) ||
        machine.applicantName?.toLowerCase().includes(lowerSearchTerm) || // If searching applicant/beneficiary too
        machine.beneficiaryName?.toLowerCase().includes(lowerSearchTerm)
      );
    });

    const today = startOfDay(new Date());
    const resultsWithWarranty = foundMachines.map(machine => {
      let warrantyStatus = "N/A";
      if (machine.installDate && isValid(parseISO(machine.installDate))) {
        const installDateObj = parseISO(machine.installDate);
        const expiryDate = addDays(installDateObj, 365); // Assuming 1 year warranty
        const diff = differenceInDays(expiryDate, today);
        warrantyStatus = isBefore(expiryDate, today) ? "Expired" : `${diff} days remaining`;
      }
      return { ...machine, warrantyStatus };
    });

    setSearchResults(resultsWithWarranty);
    setIsSearching(false);
  };

  const totalSearchPages = Math.ceil(searchResults.length / ITEMS_PER_PAGE);
  const indexOfLastSearchItem = currentSearchPage * ITEMS_PER_PAGE;
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
        // style={{ background: 'radial-gradient(circle, rgba(34,190,195,1) 65%, rgba(191,177,163,1) 100%)' }}
      >
        <div className="relative z-10 bg-card/90 dark:bg-card/80 rounded-lg"> {/* Wrapper for content over GIF */}
            <CardHeader className="text-center">
                <CardTitle className={cn("flex items-center justify-center gap-2 font-bold text-2xl lg:text-3xl", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <Laptop className="h-7 w-7 text-primary" />
                Demo M/C Search Engine
                </CardTitle>
                <CardDescription className="text-center pt-2 text-card-foreground/80">
                Search for demo machine information for year {selectedYear === "All Years" ? "Overall" : selectedYear}.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleSearchSubmit} className="flex w-full max-w-md mx-auto items-center space-x-2 mb-8">
                <Input
                type="search"
                placeholder="Search by Name, Model, Serial, Location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
                aria-label="Demo Machine Search Input"
                />
                <Button type="submit" variant="default" disabled={isSearching}>
                {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
                Search
                </Button>
            </form>

            {isSearching && (
                <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <p className="text-card-foreground/80">Searching demo machines...</p>
                </div>
            )}

            {!isSearching && displayedSearchTerm && searchResults.length === 0 && !searchError && (
                <div className="text-center text-card-foreground/70 py-10">
                    <Info className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-lg">No demo machines found matching &quot;{displayedSearchTerm}&quot; for {selectedYear === "All Years" ? "any year" : selectedYear}.</p>
                </div>
            )}
            {searchError && !isSearching && (
                <div className="text-center text-destructive py-10">
                    <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-lg">{searchError}</p>
                </div>
            )}
            {!displayedSearchTerm && !isSearching && !searchError && (
                 <div className="text-center text-card-foreground/70 py-10">
                     <Image
                        src="https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/search_ani.gif?alt=media&token=cce7e0dd-9ff9-4af9-8e75-254699bd8283"
                        alt="Search Animation"
                        width={150}
                        height={150}
                        className="mx-auto mb-4"
                        unoptimized
                        data-ai-hint="search animation"
                    />
                    <p className="text-lg">
                    Enter terms above to search demo machine information for{' '}
                    {selectedYear === "All Years" ? "all years" : selectedYear}.
                    </p>
                </div>
            )}

            {currentSearchItems.length > 0 && !isSearching && (
                <div className="space-y-6 mt-8">
                    <h3 className="text-lg font-semibold text-card-foreground mt-6 mb-2 text-center">
                        Search Results for &quot;{displayedSearchTerm}&quot; in {selectedYear === "All Years" ? "All Years" : selectedYear} (Showing {indexOfFirstSearchItem + 1}-{Math.min(indexOfLastSearchItem, searchResults.length)} of {searchResults.length} matching entries):
                    </h3>
                    <div className="rounded-md border">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead className="text-card-foreground/90">Machine Name</TableHead>
                            <TableHead className="text-card-foreground/90">Model No.</TableHead>
                            <TableHead className="text-card-foreground/90">Serial No.</TableHead>
                            <TableHead className="text-card-foreground/90">Status</TableHead>
                            <TableHead className="text-card-foreground/90">Location</TableHead>
                            <TableHead className="text-card-foreground/90">Warranty</TableHead> {/* Added for demo machines */}
                            <TableHead className="text-right text-card-foreground/90">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentSearchItems.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="text-card-foreground/80">{item.machineName || 'N/A'}</TableCell>
                                <TableCell className="text-card-foreground/80">{item.modelNumber || 'N/A'}</TableCell>
                                <TableCell className="text-card-foreground/80">{item.serialNumber || 'N/A'}</TableCell>
                                <TableCell className="text-card-foreground/80">
                                    <span className={cn(
                                        "px-2 py-1 rounded-full text-xs font-medium",
                                        item.status === "Available" ? "bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100" :
                                        item.status === "In Use" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-100" :
                                        item.status === "Maintenance" ? "bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100" :
                                        "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100"
                                    )}>
                                        {item.status || 'N/A'}
                                    </span>
                                </TableCell>
                                <TableCell className="truncate max-w-xs text-card-foreground/80">{item.location || 'N/A'}</TableCell>
                                <TableCell
                                  className={cn(
                                    "font-medium text-card-foreground/80",
                                    item.warrantyStatus === "Expired" ? "text-destructive" : "text-green-600"
                                  )}
                                >
                                  {item.warrantyStatus || 'N/A'}
                                </TableCell>
                                <TableCell className="text-right">
                                {/* Placeholder for Edit/View button for Demo Machine */}
                                {/* <Button variant="outline" size="sm" asChild>
                                    <Link href={`/dashboard/demo-machine-management/edit/${item.id}`}> 
                                    <FileEdit className="mr-1.5 h-3.5 w-3.5" /> View/Edit
                                    </Link>
                                </Button> */}
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
          background: 'linear-gradient(0deg, rgba(203, 247, 247, 0.2) 30%, rgba(232, 227, 218, 0.1) 100%)',
        }}
      >
         <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
           <div className="flex-1 text-center sm:text-left">
            <CardTitle className={cn("flex items-center sm:justify-start justify-center gap-2", "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <BarChart3 className="h-6 w-6 text-primary"/>
                Yearly Demo M/C Statistics
            </CardTitle>
            <CardDescription className="text-card-foreground/80">
                Overview of demo machine status for year {selectedYear === "All Years" ? "Overall" : selectedYear}. Data is illustrative.
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                title="Total Demo Machines"
                value={demoMachineStats.totalDemoMachines.toLocaleString()}
                icon={<Layers className="h-6 w-6 text-primary" />}
                description={`For year ${selectedYear === "All Years" ? "Overall" : selectedYear} (illustrative)`}
              />
              <StatCard
                title="Available Demo Machines"
                value={demoMachineStats.availableDemoMachines.toLocaleString()}
                icon={<CheckCircle2 className="h-6 w-6 text-primary" />}
                description={`For year ${selectedYear === "All Years" ? "Overall" : selectedYear} (illustrative)`}
              />
              <StatCard
                title="Machines In Use"
                value={demoMachineStats.machinesInUse.toLocaleString()}
                icon={<Hourglass className="h-6 w-6 text-primary" />}
                description={`For year ${selectedYear === "All Years" ? "Overall" : selectedYear} (illustrative)`}
              />
              <StatCard
                title="Machines Under Maintenance"
                value={demoMachineStats.machinesUnderMaintenance.toLocaleString()}
                icon={<Laptop className="h-6 w-6 text-primary" />}
                description={`For year ${selectedYear === "All Years" ? "Overall" : selectedYear} (illustrative)`}
              />
               <StatCard
                title="Overdue Demo Machines"
                value={demoMachineStats.overdueDemoMachines.toLocaleString()}
                icon={<AlertTriangle className="h-6 w-6 text-primary" />}
                description={`For year ${selectedYear === "All Years" ? "Overall" : selectedYear} (illustrative)`}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Search as SearchIcon, Layers, Laptop, CheckCircle2, AlertTriangle, Hourglass, Info, ChevronLeft, ChevronRight, FileEdit, Loader2, BarChart3 } from 'lucide-react';

import { StatCard } from '@/components/dashboard/StatCard';
import { cn } from '@/lib/utils';
import Link from 'next/link';

import { firestore } from '@/lib/firebase/config';
import { collection, getDocs, query, Timestamp, orderBy as firestoreOrderBy } from 'firebase/firestore';
import type { DemoMachineDocument, DemoMachineStatusOption } from '@/types';

import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';



const ITEMS_PER_PAGE = 10;

interface DemoMachineSearchResultItem extends DemoMachineDocument { }

const getDemoMachineStatusBadgeVariant = (status?: DemoMachineStatusOption): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case 'Available':
      return 'default';
    case 'Allocated':
      return 'secondary';
    case 'Maintenance Mode':
      return 'destructive';
    default:
      return 'outline';
  }
};

const DemoSearchSkeleton = () => (
  <div className="space-y-8">
    <Card className="shadow-xl max-w-6xl mx-auto"><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
    <Card className="shadow-xl max-w-6xl mx-auto">
      <CardHeader><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="shadow-lg"><CardContent className="p-6 flex justify-between items-center"><div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-9 w-24" /></div><Skeleton className="h-12 w-12 rounded-lg" /></CardContent></Card>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);


export default function DemoMachineSearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [displayedSearchTerm, setDisplayedSearchTerm] = useState('');


  const [allDemoMachines, setAllDemoMachines] = useState<DemoMachineDocument[]>([]);
  const [searchResults, setSearchResults] = useState<DemoMachineSearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [currentSearchPage, setCurrentSearchPage] = useState(1);

  const [demoMachineStats, setDemoMachineStats] = useState({
    totalDemoMachines: 0,
    availableDemoMachines: 0,
    machinesInUse: 0,
    machinesUnderMaintenance: 0,
  });

  const fetchAllDemoMachinesAndStats = useCallback(async () => {
    setIsLoading(true);
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

      const machinesForStats = fetchedMachines;
      const total = machinesForStats.length;
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
      setDemoMachineStats({ totalDemoMachines: 0, availableDemoMachines: 0, machinesInUse: 0, machinesUnderMaintenance: 0 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllDemoMachinesAndStats();
  }, [fetchAllDemoMachinesAndStats]);

  const handleSearchSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const trimmedSearchTerm = searchTerm.trim();
    setDisplayedSearchTerm(trimmedSearchTerm);
    setIsSearching(true);
    setCurrentSearchPage(1);

    if (!trimmedSearchTerm) {
      setSearchResults(allDemoMachines);
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

    setSearchResults(foundMachines.map(m => ({ ...m })));
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

  if (isLoading) {
    return <DemoSearchSkeleton />;
  }

  return (
    <div className="m-[10px] p-0 md:container md:mx-auto md:py-8 md:px-5 space-y-8">
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
              <Button type="submit" variant="default" disabled={isSearching || isLoading}>
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
                <p className="text-lg">No demo machines found matching &quot;{displayedSearchTerm}&quot;.</p>
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
                <iframe src="https://lottie.host/embed/1b954d50-dbd6-4e85-a947-9c8fc4fa093c/Jkw6b9BbW1.lottie" style={{ border: 'none', width: '150px', height: '150px', margin: '0 auto 1rem' }}></iframe>
                <p className="text-lg">
                  Enter terms above to search demo machine information.
                </p>
              </div>
            )}

            {currentSearchItems.length > 0 && !isSearching && !searchError && (
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
      >
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex-1 text-center sm:text-left">
            <CardTitle className={cn("flex items-center sm:justify-start justify-center gap-2", "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <BarChart3 className="h-6 w-6 text-primary" />
              Yearly Demo M/C Statistics
            </CardTitle>
            <CardDescription className="text-card-foreground/80">
              Overview of demo machine status.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}

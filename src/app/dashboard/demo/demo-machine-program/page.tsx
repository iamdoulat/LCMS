

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AppWindow, FileCode, Loader2, AlertTriangle, Info, Edit, Trash2, CalendarDays, User, Phone, FileText as NoteIcon, Filter, XCircle, Factory, Laptop, Hash, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, Timestamp, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { DemoMachineApplicationDocument, DemoMachineFactoryDocument, DemoMachineDocument, DemoMachineStatusOption as AppDemoMachineStatus } from '@/types';
import { format, parseISO, isValid, isPast, isFuture, isToday, startOfDay, getYear } from 'date-fns';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

const ITEMS_PER_PAGE = 10;
const ALL_YEARS_VALUE = "__ALL_YEARS_DEMO_PROG__";
const ALL_FACTORIES_VALUE = "__ALL_FACTORIES_DEMO_PROG__";
const ALL_MACHINES_VALUE = "__ALL_MACHINES_DEMO_PROG__";
const ALL_BRANDS_VALUE = "__ALL_BRANDS_DEMO_PROG__";

const currentSystemYear = new Date().getFullYear();
const yearFilterOptions = [ALL_YEARS_VALUE, ...Array.from({ length: (currentSystemYear - 2020 + 11) }, (_, i) => (2020 + i).toString())];


const formatDisplayDate = (dateString?: string | null | Timestamp): string => {
  if (!dateString) return 'N/A';
  let date: Date;
  if (dateString instanceof Timestamp) {
    date = dateString.toDate();
  } else if (typeof dateString === 'string') {
    try {
      const parsed = parseISO(dateString);
      date = isValid(parsed) ? parsed : new Date(0);
    } catch (e) {
      return 'N/A';
    }
  } else {
    return 'N/A';
  }
  return date && isValid(date) && date.getFullYear() > 1 ? format(date, 'PPP') : 'N/A';
};

const formatReportValue = (value: string | number | undefined | null, defaultValue: string = 'N/A'): string => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  return String(value);
};

type DemoAppDisplayStatus = "Upcoming" | "Active" | "Overdue" | "Returned";

const getDemoAppStatus = (app: DemoMachineApplicationDocument): DemoAppDisplayStatus => {
  if (app.machineReturned) return "Returned";
  const delivery = app.deliveryDate ? startOfDay(parseISO(app.deliveryDate)) : null;
  const estReturn = app.estReturnDate ? startOfDay(parseISO(app.estReturnDate)) : null;

  if (!delivery || !estReturn || !isValid(delivery) || !isValid(estReturn)) return "Upcoming";

  if (isPast(estReturn) && !isToday(estReturn)) return "Overdue";
  if ((isToday(delivery) || isPast(delivery)) && (isToday(estReturn) || isFuture(estReturn))) return "Active";
  if (isFuture(delivery)) return "Upcoming";

  return "Upcoming";
};

const getDemoStatusBadgeVariant = (status: DemoAppDisplayStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "Active": return "default";
    case "Overdue": return "destructive";
    case "Returned": return "secondary";
    case "Upcoming": return "outline";
    default: return "outline";
  }
};


export default function DemoMachineProgramPage() {
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const [allApplications, setAllApplications] = useState<DemoMachineApplicationDocument[]>([]);
  const [displayedApplications, setDisplayedApplications] = useState<DemoMachineApplicationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states
  const [filterYear, setFilterYear] = useState<string>(ALL_YEARS_VALUE);
  const [filterFactoryId, setFilterFactoryId] = useState<string>('');
  const [filterMachineModelId, setFilterMachineModelId] = useState<string>(''); // Changed from filterMachineId
  const [filterBrand, setFilterBrand] = useState<string>('');

  const [factoryOptions, setFactoryOptions] = useState<ComboboxOption[]>([]);
  const [machineModelOptions, setMachineModelOptions] = useState<ComboboxOption[]>([]); // Changed from machineOptions
  const [brandOptions, setBrandOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingFactories, setIsLoadingFactories] = useState(true);
  const [isLoadingMachines, setIsLoadingMachines] = useState(true);


  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setIsLoadingFactories(true);
      setIsLoadingMachines(true);
      setFetchError(null);
      try {
        const applicationsCollectionRef = collection(firestore, "demo_machine_applications");
        const appQuery = query(applicationsCollectionRef, orderBy("createdAt", "desc"));
        const appSnapshot = await getDocs(appQuery);
        const fetchedApplications = appSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            deliveryDate: data.deliveryDate instanceof Timestamp ? data.deliveryDate.toDate().toISOString() : data.deliveryDate,
            estReturnDate: data.estReturnDate instanceof Timestamp ? data.estReturnDate.toDate().toISOString() : data.estReturnDate,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          } as DemoMachineApplicationDocument;
        });
        setAllApplications(fetchedApplications);

        // Fetch factories
        const factoriesSnapshot = await getDocs(query(collection(firestore, "demo_machine_factories"), orderBy("factoryName")));
        setFactoryOptions(
          factoriesSnapshot.docs.map(docSnap => ({ value: docSnap.id, label: (docSnap.data() as DemoMachineFactoryDocument).factoryName || 'Unnamed Factory' }))
        );
        setIsLoadingFactories(false);

        // Fetch machines and derive brands
        const machinesSnapshot = await getDocs(query(collection(firestore, "demo_machines"), orderBy("machineModel")));
        const fetchedMachines = machinesSnapshot.docs.map(docSnap => {
          const data = docSnap.data() as DemoMachineDocument;
          return { ...data, id: docSnap.id };
        });

        // For machine model filter, we use the machine ID as value, but label is model name + serial for uniqueness
        setMachineModelOptions(fetchedMachines.map(machine => ({
          value: machine.id, // Use machine ID for filtering actual applications
          label: `${machine.machineModel || 'Unnamed Model'} (S/N: ${machine.machineSerial || 'N/A'})`
        })));

        const uniqueBrands = Array.from(new Set(fetchedMachines.map(m => m.machineBrand).filter(brand => !!brand)));
        setBrandOptions(uniqueBrands.map(brand => ({ value: brand as string, label: brand as string })));
        setIsLoadingMachines(false);

      } catch (error: any) {
        let errorMessage = `Could not fetch data. Please check Firestore rules.`;
        if (error.message?.toLowerCase().includes("index")) {
          errorMessage = `Could not fetch data: A Firestore index might be required. Please check the browser console for a link to create it automatically.`;
        } else if (error.code === 'permission-denied' || error.message?.toLowerCase().includes("permission")) {
          errorMessage = `Could not fetch data: Missing or insufficient permissions. Please check Firestore security rules.`;
        } else if (error.message) {
          errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    let filtered = [...allApplications];

    if (filterYear && filterYear !== ALL_YEARS_VALUE) {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(app => {
        if (app.deliveryDate) {
          try {
            const deliveryDateYear = getYear(parseISO(app.deliveryDate));
            return deliveryDateYear === yearNum;
          } catch { return false; }
        }
        return false;
      });
    }

    if (filterFactoryId && filterFactoryId !== ALL_FACTORIES_VALUE) {
      filtered = filtered.filter(app => app.factoryId === filterFactoryId);
    }

    if (filterMachineModelId && filterMachineModelId !== ALL_MACHINES_VALUE) {
      filtered = filtered.filter(app =>
        app.appliedMachines.some(machine => machine.demoMachineId === filterMachineModelId)
      );
    }

    if (filterBrand && filterBrand !== ALL_BRANDS_VALUE) {
      filtered = filtered.filter(app =>
        app.appliedMachines.some(machine => machine.machineBrand === filterBrand)
      );
    }

    setDisplayedApplications(filtered);
    setCurrentPage(1);
  }, [allApplications, filterYear, filterFactoryId, filterMachineModelId, filterBrand]);


  const handleDeleteApplication = (applicationId: string, identifier?: string) => {
    if (!applicationId) {
      Swal.fire("Error", "Application ID is missing, cannot delete.", "error");
      return;
    }
    Swal.fire({
      title: 'Are you sure?',
      text: `This will permanently delete the demo machine application "${identifier || applicationId}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        const batch = writeBatch(firestore);
        try {
          const appToDelete = allApplications.find(app => app.id === applicationId);

          // Update status of all machines within this application to "Available" if not already returned
          if (appToDelete && appToDelete.appliedMachines) {
            appToDelete.appliedMachines.forEach(appliedMachine => {
              if (appliedMachine.demoMachineId && (appToDelete.machineReturned === false || appToDelete.machineReturned === undefined)) {
                const machineRef = doc(firestore, "demo_machines", appliedMachine.demoMachineId);
                batch.update(machineRef, {
                  currentStatus: "Available" as AppDemoMachineStatus,
                  machineReturned: true, // Explicitly mark machine as returned
                  updatedAt: serverTimestamp(),
                });
              }
            });
          }

          const appDocRef = doc(firestore, "demo_machine_applications", applicationId);
          batch.delete(appDocRef);

          await batch.commit();

          setAllApplications(prev => prev.filter(app => app.id !== applicationId));
          Swal.fire(
            'Deleted!',
            `Demo machine application "${identifier || applicationId}" and associated machine statuses updated.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting demo machine application: ", error);
          Swal.fire(
            'Error!',
            `Could not delete application: ${error.message}`,
            'error'
          );
        }
      }
    });
  };

  const clearFilters = () => {
    setFilterYear(ALL_YEARS_VALUE);
    setFilterFactoryId('');
    setFilterMachineModelId('');
    setFilterBrand('');
    setCurrentPage(1);
  };

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = displayedApplications.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(displayedApplications.length / ITEMS_PER_PAGE);

  const handlePageChange = (pageNumber: number) => setCurrentPage(pageNumber);
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  const getPageNumbers = () => {
    const pageNumbers = []; const maxPagesToShow = 5; const halfPagesToShow = Math.floor(maxPagesToShow / 2);
    if (totalPages <= maxPagesToShow + 2) { for (let i = 1; i <= totalPages; i++) pageNumbers.push(i); }
    else {
      pageNumbers.push(1); let startPage = Math.max(2, currentPage - halfPagesToShow); let endPage = Math.min(totalPages - 1, currentPage + halfPagesToShow);
      if (currentPage <= halfPagesToShow + 1) endPage = Math.min(totalPages - 1, maxPagesToShow);
      if (currentPage >= totalPages - halfPagesToShow) startPage = Math.max(2, totalPages - maxPagesToShow + 1);
      if (startPage > 2) pageNumbers.push("...");
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages - 1) pageNumbers.push("...");
      pageNumbers.push(totalPages);
    } return pageNumbers;
  };


  return (
    <div className="max-w-none mx-[25px] py-8 px-0">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <FileCode className="h-7 w-7 text-primary" />
                Demo Machine Program
              </CardTitle>
              <CardDescription>
                Manage Demo Machine Applications.
                Showing {currentItems.length > 0 ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, displayedApplications.length)} of {displayedApplications.length} entries.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* <Button variant="outline" disabled>
                    <Filter className="mr-2 h-4 w-4" /> Filter: All
                </Button> */}
              <Link href="/dashboard/demo/demo-machine-application" passHref>
                <Button variant="default" disabled={isReadOnly}>
                  <AppWindow className="mr-2 h-4 w-4" />
                  New Demo Application
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <Label htmlFor="yearFilterDemoProg" className="text-sm font-medium flex items-center"><CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />Year (Delivery)</Label>
                  <Select value={filterYear} onValueChange={(value) => setFilterYear(value)}>
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      {yearFilterOptions.map(yearOpt => <SelectItem key={yearOpt} value={yearOpt}>{yearOpt === ALL_YEARS_VALUE ? "All Years" : yearOpt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="factoryFilterDemoProg" className="text-sm font-medium flex items-center"><Factory className="mr-1 h-4 w-4 text-muted-foreground" />Factory</Label>
                  <Combobox
                    options={factoryOptions}
                    value={filterFactoryId || ALL_FACTORIES_VALUE}
                    onValueChange={(value) => setFilterFactoryId(value === ALL_FACTORIES_VALUE ? '' : value)}
                    placeholder="Search Factory..."
                    selectPlaceholder={isLoadingFactories ? "Loading..." : "All Factories"}
                    emptyStateMessage="No factory found."
                    disabled={isLoadingFactories}
                  />
                </div>
                <div>
                  <Label htmlFor="machineModelFilterDemoProg" className="text-sm font-medium flex items-center"><Laptop className="mr-1 h-4 w-4 text-muted-foreground" />Machine Model</Label>
                  <Combobox
                    options={machineModelOptions}
                    value={filterMachineModelId || ALL_MACHINES_VALUE}
                    onValueChange={(value) => setFilterMachineModelId(value === ALL_MACHINES_VALUE ? '' : value)}
                    placeholder="Search Machine Model/S.N..."
                    selectPlaceholder={isLoadingMachines ? "Loading..." : "All Models"}
                    emptyStateMessage="No model found."
                    disabled={isLoadingMachines}
                  />
                </div>
                <div>
                  <Label htmlFor="brandFilterDemoProg" className="text-sm font-medium flex items-center"><Hash className="mr-1 h-4 w-4 text-muted-foreground" />Brand</Label>
                  <Combobox
                    options={brandOptions}
                    value={filterBrand || ALL_BRANDS_VALUE}
                    onValueChange={(value) => setFilterBrand(value === ALL_BRANDS_VALUE ? '' : value)}
                    placeholder="Search Brand..."
                    selectPlaceholder={isLoadingMachines ? "Loading..." : "All Brands"}
                    emptyStateMessage="No brand found."
                    disabled={isLoadingMachines}
                  />
                </div>
                <div className="lg:col-span-4 md:col-span-2">
                  <Button onClick={clearFilters} variant="outline" className="w-full md:w-auto">
                    <XCircle className="mr-2 h-4 w-4" /> Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading demo machine applications...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Applications Found</p>
              <p className="text-sm text-muted-foreground text-center">
                There are no demo machine applications matching your current filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {currentItems.map((app) => {
                const currentStatus = getDemoAppStatus(app);
                const mainMachine = app.appliedMachines?.[0]; // Display first machine for brevity, or handle multiple
                return (
                  <Card key={app.id} className={cn(
                    "p-4 rounded-lg border hover:shadow-md transition-shadow relative",
                    currentStatus === "Overdue" ? "bg-destructive/10 border-destructive/30" :
                      currentStatus === "Active" ? "bg-green-500/10 border-green-500/30" : "bg-card"
                  )}>
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1 z-10">
                      <Badge variant={getDemoStatusBadgeVariant(currentStatus)} className="text-xs px-2 py-0.5">
                        {currentStatus}
                      </Badge>
                      <div className="flex gap-1">
                        <Button variant="default" size="icon" className="h-7 w-7 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                          <Link href={`/dashboard/demo/edit-demo-machine-application/${app.id}`}>
                            <Edit className="h-4 w-4" /> <span className="sr-only">Edit Application</span>
                          </Link>
                        </Button>
                        <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDeleteApplication(app.id, `${app.factoryName} - ${mainMachine?.machineModel || 'Multiple Machines'}`)} disabled={isReadOnly}>
                          <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete Application</span>
                        </Button>
                      </div>
                    </div>
                    <CardHeader className="pb-3 pt-0 px-0 pr-20">
                      <Link href={`/dashboard/demo/edit-demo-machine-application/${app.id}`} passHref>
                        <CardTitle className="text-lg font-semibold text-primary hover:underline mb-1 cursor-pointer">
                          {formatReportValue(app.factoryName)} - {app.appliedMachines.length > 1 ? `${app.appliedMachines.length} Machines` : formatReportValue(mainMachine?.machineModel)}
                        </CardTitle>
                      </Link>
                      <CardDescription className="text-xs text-foreground">
                        {app.appliedMachines.map(m => `${formatReportValue(m.machineModel)} (S/N: ${formatReportValue(m.machineSerial)}, Brand: ${formatReportValue(m.machineBrand)})`).join('; ')}
                        {app.challanNo && ` | Challan: ${formatReportValue(app.challanNo)}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-0 pb-0 pt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
                        <div><span className="text-muted-foreground">Delivery: </span><span className="font-medium text-foreground">{formatDisplayDate(app.deliveryDate)}</span></div>
                        <div><span className="text-muted-foreground">Est. Return: </span><span className="font-medium text-foreground">{formatDisplayDate(app.estReturnDate)}</span></div>
                        <div><span className="text-muted-foreground">Period: </span><span className="font-medium text-foreground">{formatReportValue(app.demoPeriodDays, "0")} Day(s)</span></div>
                        <div><User className="inline-block mr-1 h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Incharge: </span><span className="font-medium text-foreground truncate" title={app.factoryInchargeName}>{formatReportValue(app.factoryInchargeName)}</span></div>
                        <div><Phone className="inline-block mr-1 h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Cell: </span><span className="font-medium text-foreground truncate" title={app.inchargeCell}>{formatReportValue(app.inchargeCell)}</span></div>
                        <div><User className="inline-block mr-1 h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Delivery Person: </span><span className="font-medium text-foreground truncate" title={app.deliveryPersonName}>{formatReportValue(app.deliveryPersonName)}</span></div>
                      </div>
                      {app.notes && app.notes.trim() !== "" && (
                        <div className="mt-3 p-3 rounded-md border bg-muted/30">
                          <p className="text-xs font-medium text-foreground flex items-center"><NoteIcon className="mr-1 h-3.5 w-3.5" />Expected Result/Notes:</p>
                          <p className="text-xs text-foreground whitespace-pre-wrap">{app.notes}</p>
                        </div>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground text-right">
                        Applied: {formatDisplayDate(app.createdAt)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 py-4 mt-4">
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
                    key={`app-page-${page}`}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="w-9 h-9 p-0"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={`ellipsis-app-${index}`} className="px-2 py-1 text-sm">
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





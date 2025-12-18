
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { Laptop as LaptopIcon, ListChecks, FileEdit, Trash2, Loader2, AlertTriangle, Info, FileText as NoteIcon, Cog, Hash, Image as ImageIcon, Filter, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase/config';
import { collection, query, getDocs, orderBy, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import type { DemoMachineDocument, DemoMachineStatusOption } from '@/types';
import { demoMachineOwnerOptions, demoMachineStatusOptions } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import Swal from 'sweetalert2';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const formatDisplayDate = (dateInput?: string | null | Timestamp): string => {
  if (!dateInput) return 'N/A';
  let date: Date;
  if (dateInput instanceof Timestamp) {
    date = dateInput.toDate();
  } else if (typeof dateInput === 'string') {
    try {
      const parsed = parseISO(dateInput);
      date = isValid(parsed) ? parsed : new Date(0);
    } catch (e) {
      return 'N/A';
    }
  } else {
    return 'N/A';
  }
  return date && isValid(date) && date.getFullYear() > 1 ? format(date, 'PPP p') : 'N/A';
};

const formatReportValue = (value: string | number | undefined | null, defaultValue: string = 'N/A'): string => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  return String(value);
};

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


export default function DemoMachineListPage() {
  const { userRole } = useAuth();
  const isReadOnly = userRole?.includes('Viewer');
  const [allDemoMachines, setAllDemoMachines] = useState<DemoMachineDocument[]>([]);
  const [displayedMachines, setDisplayedMachines] = useState<DemoMachineDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter states
  const [filterModel, setFilterModel] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterOwner, setFilterOwner] = useState<string>('All');

  useEffect(() => {
    const fetchDemoMachines = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const machinesCollectionRef = collection(firestore, "demo_machines");
        const q = query(machinesCollectionRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedMachines = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          } as DemoMachineDocument;
        });
        setAllDemoMachines(fetchedMachines);
        setDisplayedMachines(fetchedMachines);
      } catch (error: any) {
        let errorMessage = `Could not fetch data. Please check Firestore rules.`;
        if (error.message?.toLowerCase().includes("index")) {
          errorMessage = `Could not fetch data: A Firestore index might be required. Please check the browser console for a link to create it automatically.`;
        } else if (error.code === 'permission-denied' || error.message?.toLowerCase().includes("permission")) {
          errorMessage = `Could not fetch data: Missing or insufficient permissions for the 'demo_machines' collection. Please check Firestore security rules.`;
        } else if (error.message) {
          errorMessage += ` Error: ${error.message}`;
        }
        setFetchError(errorMessage);
        Swal.fire("Fetch Error", errorMessage, "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDemoMachines();
  }, []);

  useEffect(() => {
    let filtered = allDemoMachines;

    if (filterModel) {
      filtered = filtered.filter(m => m.machineModel?.toLowerCase().includes(filterModel.toLowerCase()));
    }
    if (filterBrand) {
      filtered = filtered.filter(m => m.machineBrand?.toLowerCase().includes(filterBrand.toLowerCase()));
    }
    if (filterStatus && filterStatus !== 'All') {
      filtered = filtered.filter(m => m.currentStatus === filterStatus);
    }
    if (filterOwner && filterOwner !== 'All') {
      filtered = filtered.filter(m => m.machineOwner === filterOwner);
    }

    setDisplayedMachines(filtered);
  }, [filterModel, filterBrand, filterStatus, filterOwner, allDemoMachines]);

  const handleDeleteMachine = (machineId: string, machineModel?: string) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `This will permanently delete the demo machine "${machineModel || machineId}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(firestore, "demo_machines", machineId));
          setAllDemoMachines(prev => prev.filter(app => app.id !== machineId));
          Swal.fire(
            'Deleted!',
            `Demo machine "${machineModel || machineId}" has been removed.`,
            'success'
          );
        } catch (error: any) {
          console.error("Error deleting demo machine: ", error);
          Swal.fire(
            'Error!',
            `Could not delete demo machine: ${error.message}`,
            'error'
          );
        }
      }
    });
  };

  const clearFilters = () => {
    setFilterModel('');
    setFilterBrand('');
    setFilterStatus('All');
    setFilterOwner('All');
  };

  return (
    <div className="container mx-auto py-8 px-5">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <ListChecks className="h-7 w-7 text-primary" />
                Demo Machine List
              </CardTitle>
              <CardDescription>
                View and manage all registered demo machines.
              </CardDescription>
            </div>
            <Link href="/dashboard/demo/add-demo-machine" passHref>
              <Button variant="default" disabled={isReadOnly}>
                <LaptopIcon className="mr-2 h-4 w-4" />
                Add Demo Machine
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Card className="mb-6 shadow-md p-4">
            <CardHeader className="p-2 pb-4">
              <CardTitle className="text-xl flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" /> Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="modelFilter">Model</Label>
                  <Input id="modelFilter" placeholder="Search by Model..." value={filterModel} onChange={e => setFilterModel(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="brandFilter">Brand</Label>
                  <Input id="brandFilter" placeholder="Search by Brand..." value={filterBrand} onChange={e => setFilterBrand(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="statusFilter">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger id="statusFilter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Statuses</SelectItem>
                      {demoMachineStatusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ownerFilter">Owner</Label>
                  <Select value={filterOwner} onValueChange={setFilterOwner}>
                    <SelectTrigger id="ownerFilter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Owners</SelectItem>
                      {demoMachineOwnerOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-1">
                  <Button onClick={clearFilters} variant="outline" className="w-full">
                    <XCircle className="mr-2 h-4 w-4" /> Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading demo machines...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-destructive/30 rounded-lg bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-xl font-semibold text-destructive-foreground mb-2">Error Fetching Data</p>
              <p className="text-sm text-destructive-foreground text-center whitespace-pre-wrap">{fetchError}</p>
            </div>
          ) : displayedMachines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Demo Machines Found</p>
              <p className="text-sm text-muted-foreground text-center">
                {allDemoMachines.length > 0 ? "No machines match your current filters." : 'There are no demo machines in the database. Click "Add Demo Machine" to add one.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {displayedMachines.map((machine) => (
                <Card key={machine.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col relative">
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10">
                    <div className="flex gap-1">
                      <Link href={`/dashboard/demo/edit-demo-machine/${machine.id}`} passHref>
                        <Button variant="default" size="icon" className="h-7 w-7 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                          <span><FileEdit className="h-4 w-4" /> <span className="sr-only">Edit Demo Machine</span></span>
                        </Button>
                      </Link>
                      <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDeleteMachine(machine.id, machine.machineModel)} disabled={isReadOnly}>
                        <Trash2 className="h-4 w-4" /> <span className="sr-only">Delete Demo Machine</span>
                      </Button>
                    </div>
                    {machine.currentStatus && (
                      <Badge variant={getDemoMachineStatusBadgeVariant(machine.currentStatus)} className="text-xs">
                        {machine.currentStatus}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-12 gap-4 p-4 flex-grow">
                    <div className="col-span-12 md:col-span-8 flex flex-col">
                      <CardHeader className="relative p-0 pr-24">
                        <div className="flex items-baseline gap-x-2">
                          <CardTitle className="text-lg font-semibold text-primary mb-0 truncate">
                            {formatReportValue(machine.machineModel)}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5 flex items-center gap-2">
                            <span className="text-muted-foreground">Owner:</span> <span className="font-medium text-foreground">{formatReportValue(machine.machineOwner)}</span>
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 pt-2 flex-grow flex flex-col justify-between">
                        <div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                            <div><span className="text-muted-foreground">Serial: </span><span className="font-medium text-foreground truncate" title={machine.machineSerial}>{formatReportValue(machine.machineSerial)}</span></div>
                            <div><span className="text-muted-foreground">Brand: </span><span className="font-medium text-foreground truncate" title={machine.machineBrand}>{formatReportValue(machine.machineBrand)}</span></div>
                            <div><Cog className="inline-block mr-1 h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Ctl. Box Model: </span><span className="font-medium text-foreground truncate" title={machine.motorOrControlBoxModel}>{formatReportValue(machine.motorOrControlBoxModel)}</span></div>
                            <div className="sm:col-start-1 md:col-start-auto"><Hash className="inline-block mr-1 h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Ctl. Box S/N: </span><span className="font-medium text-foreground truncate" title={machine.controlBoxSerialNo}>{formatReportValue(machine.controlBoxSerialNo)}</span></div>
                          </div>

                          <div className="space-y-2 mt-2">
                            {machine.machineFeatures && (
                              <div className="space-y-1 bg-muted/20 p-3 rounded-md border">
                                <p className="text-xs font-bold text-foreground flex items-center">
                                  <NoteIcon className="mr-1 h-3.5 w-3.5 text-muted-foreground" />Features:
                                </p>
                                <p className="text-xs text-foreground whitespace-pre-wrap">{machine.machineFeatures}</p>
                              </div>
                            )}
                            {machine.note && (
                              <div className="space-y-1 bg-muted/20 p-3 rounded-md border">
                                <p className="text-xs font-bold text-foreground flex items-center">
                                  <NoteIcon className="mr-1 h-3.5 w-3.5 text-muted-foreground" />Note:
                                </p>
                                <p className="text-xs text-foreground whitespace-pre-wrap">{machine.note}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </div>
                    <div className="col-span-12 md:col-span-4 flex items-center justify-center md:mt-24">
                      {machine.imageUrl ? (
                        <Image
                          src={machine.imageUrl}
                          alt={machine.machineModel || 'Demo machine image'}
                          width={128}
                          height={128}
                          className="object-cover rounded-md border shadow-md w-32 h-32"
                          data-ai-hint="sewing machine"
                        />
                      ) : (
                        <div className="w-32 h-32 bg-muted/50 rounded-md flex items-center justify-center border border-dashed">
                          <ImageIcon className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-4 pb-4 mt-auto">
                    <div className="mt-3 text-xs text-muted-foreground border-t pt-2 text-right">
                      Added: {formatDisplayDate(machine.createdAt)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

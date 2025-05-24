
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, Microscope, Package, Wrench, ClipboardList, ShieldCheck, ShieldOff, Layers, CheckCircle2, Hourglass } from 'lucide-react';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';
import { StatCard } from '@/components/dashboard/StatCard'; // Import StatCard

export default function WarrantySearchPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Placeholder stats for the new cards
  const warrantyStats = {
    totalLcMachineries: "0",
    totalInstalledMachines: "0",
    totalPendingMachines: "0",
    machinesUnderWarranty: "0",
    machinesOutOfWarranty: "0",
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedSearchTerm = searchTerm.trim();
    if (trimmedSearchTerm) {
      Swal.fire({
        title: "Search Submitted (Simulated)",
        text: `Search functionality for query: "${trimmedSearchTerm}" is not yet implemented. This page would typically display results based on warranty-related criteria.`,
        icon: "info",
      });
      // In a real implementation, you would navigate to a results page or update results here.
      // For now, we just show an alert.
      // setSearchTerm(''); // Optionally clear search term after submission
    } else {
      Swal.fire({
        title: "Empty Search",
        text: "Please enter a search term.",
        icon: "warning",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card className="shadow-xl max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Microscope className="h-7 w-7 text-primary" />
            Warranty Search
          </CardTitle>
          <CardDescription>
            Search for warranty information, installation reports, or machine details by Serial No, Model No, C.I. No, L/C No, etc.
            (Note: Actual search logic is not yet implemented.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearchSubmit} className="flex w-full items-center space-x-2 mb-8">
            <Input
              type="search"
              placeholder="Enter machine serial, model, C.I. no, etc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
              aria-label="Warranty Search Input"
            />
            <Button type="submit" variant="default">
              <SearchIcon className="mr-2 h-4 w-4" /> Search
            </Button>
          </form>
          {/* Placeholder for search results if any are to be displayed on this page */}
          {!searchTerm && (
            <div className="text-center text-muted-foreground py-10">
              <SearchIcon className="mx-auto h-12 w-12 mb-4" />
              <p className="text-lg">Enter terms above to search warranty-related information.</p>
              <p className="text-sm">Search results will appear here once functionality is implemented.</p>
            </div>
          )}
           {searchTerm && (
            <div className="text-center text-muted-foreground py-10">
              <p className="text-lg">Search results for &quot;{searchTerm}&quot; would appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics Card Section */}
      <Card className="shadow-xl max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
             <BarChart3 className="h-6 w-6 text-primary"/> {/* Using BarChart3 as a generic stats icon */}
            Yearly Warranty Statistics (Placeholder Data)
          </CardTitle>
          <CardDescription>
            Overview of machine warranty status. Data shown is illustrative.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="Total L/C Machineries"
              value={warrantyStats.totalLcMachineries}
              icon={<Layers className="h-6 w-6 text-primary" />}
              description="Total machines from L/Cs (illustrative)"
            />
            <StatCard
              title="Total Installed Machines"
              value={warrantyStats.totalInstalledMachines}
              icon={<Wrench className="h-6 w-6 text-primary" />}
              description="Machines confirmed installed (illustrative)"
            />
            <StatCard
              title="Total Pending Machines"
              value={warrantyStats.totalPendingMachines}
              icon={<Hourglass className="h-6 w-6 text-primary" />}
              description="Machines pending installation (illustrative)"
            />
            <StatCard
              title="Machines Under Warranty"
              value={warrantyStats.machinesUnderWarranty}
              icon={<ShieldCheck className="h-6 w-6 text-primary" />}
              description="Currently under warranty (illustrative)"
            />
            <StatCard
              title="Machines Out of Warranty"
              value={warrantyStats.machinesOutOfWarranty}
              icon={<ShieldOff className="h-6 w-6 text-primary" />}
              description="Warranty period expired (illustrative)"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

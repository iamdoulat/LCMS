
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, Microscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

export default function WarrantySearchPage() {
  const [searchTerm, setSearchTerm] = useState('');

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
      // For now, we just show an alert and clear the input.
      setSearchTerm('');
    } else {
      Swal.fire({
        title: "Empty Search",
        text: "Please enter a search term.",
        icon: "warning",
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Microscope className="h-7 w-7 text-primary" />
            Warranty Search
          </CardTitle>
          <CardDescription>
            Search for warranty information, installation reports, or machine details.
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
          <div className="text-center text-muted-foreground py-10">
            <SearchIcon className="mx-auto h-12 w-12 mb-4" />
            <p className="text-lg">Enter terms above to search warranty-related information.</p>
            <p className="text-sm">Search results will appear here once functionality is implemented.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

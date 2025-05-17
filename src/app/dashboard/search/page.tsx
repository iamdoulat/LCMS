
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, AlertTriangle, FileText, Users, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [displayedQuery, setDisplayedQuery] = useState(initialQuery);

  useEffect(() => {
    // Update searchTerm if the URL query changes (e.g., browser back/forward)
    const queryFromUrl = searchParams.get('q') || '';
    setSearchTerm(queryFromUrl);
    setDisplayedQuery(queryFromUrl);
    if (queryFromUrl) {
      // Here you would typically trigger actual search logic
      console.log(`Searching for: ${queryFromUrl}`);
      // For now, we just update the displayed query.
    }
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedSearchTerm = searchTerm.trim();
    if (trimmedSearchTerm) {
      router.push(`/dashboard/search?q=${encodeURIComponent(trimmedSearchTerm)}`);
    } else {
      router.push('/dashboard/search'); // Navigate to search page without query if input is empty
    }
    // The useEffect above will handle updating displayedQuery based on the new URL
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <SearchIcon className="h-7 w-7 text-primary" />
            Global Search
          </CardTitle>
          <CardDescription>
            Search across L/Cs, Proforma Invoices, Applicants, and Beneficiaries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearchSubmit} className="flex w-full max-w-2xl mx-auto items-center space-x-2 mb-8">
            <Input
              type="search"
              placeholder="Enter L/C No, PI No, Applicant, Beneficiary, Year..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="default">
              <SearchIcon className="mr-2 h-4 w-4" /> Search
            </Button>
          </form>

          {displayedQuery && (
            <div className="mb-6 text-center">
              <p className="text-lg">Search Results for: <span className="font-semibold text-primary">{displayedQuery}</span></p>
            </div>
          )}

          {!displayedQuery && (
            <div className="text-center text-muted-foreground py-10">
                <SearchIcon className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg">Enter a term above to search the system.</p>
            </div>
          )}

          {displayedQuery && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><FileText className="h-5 w-5 text-primary"/>L/C Entries Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">(Backend search logic for L/C entries is pending implementation.)</p>
                  {/* Placeholder for L/C results */}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Users className="h-5 w-5 text-primary"/>Applicants Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">(Backend search logic for Applicants is pending implementation.)</p>
                  {/* Placeholder for Applicant results */}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Building className="h-5 w-5 text-primary"/>Beneficiaries Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">(Backend search logic for Beneficiaries is pending implementation.)</p>
                  {/* Placeholder for Beneficiary results */}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><FileText className="h-5 w-5 text-primary"/>Proforma Invoices Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">(Backend search logic for Proforma Invoices is pending implementation.)</p>
                  {/* Placeholder for PI results */}
                </CardContent>
              </Card>
               <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><SearchIcon className="h-5 w-5 text-primary"/>Entries by Year "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">(Backend search logic for yearly entries is pending implementation. This search would be most effective if "{displayedQuery}" is a year.)</p>
                  {/* Placeholder for Yearly results */}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Wrap the component with Suspense to handle useSearchParams on initial render
export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}

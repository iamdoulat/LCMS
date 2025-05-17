
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, FileText, Users, Building, Layers, CalendarDays, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [displayedQuery, setDisplayedQuery] = useState(initialQuery);

  useEffect(() => {
    const queryFromUrl = searchParams.get('q') || '';
    setSearchTerm(queryFromUrl);
    setDisplayedQuery(queryFromUrl);
    // In a real app, you would trigger a search API call here if queryFromUrl is not empty.
    if (queryFromUrl) {
      console.log(`Simulating search for: ${queryFromUrl}`);
      // Placeholder for actual search logic
    }
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedSearchTerm = searchTerm.trim();
    if (trimmedSearchTerm) {
      router.push(`/dashboard/search?q=${encodeURIComponent(trimmedSearchTerm)}`);
    } else {
      router.push('/dashboard/search');
    }
  };

  // Placeholder data for illustrative links
  const placeholderResults = {
    lcs: [
      { id: 'lc123', number: 'LC-2024-001', applicant: 'Global Trade Co.' },
      { id: 'lc456', number: 'LC-XYZ-789', applicant: 'Imports Inc.' },
    ],
    applicants: [
      { id: 'cust001', name: 'Global Trade Co.' },
      { id: 'cust002', name: 'Mega Corp Appliances' },
    ],
    beneficiaries: [
      { id: 'sup001', name: 'Overseas Electronics Ltd.' },
      { id: 'sup002', name: 'General Goods Exporters' },
    ],
    pis: [
      { id: 'pi777', number: 'PI-2024-A05', applicant: 'Global Trade Co.' },
      { id: 'pi888', number: 'PI-INTL-012', applicant: 'Imports Inc.' },
    ],
    byYear: [
      { year: '2024', description: 'Entries from 2024 matching query' },
      { year: '2023', description: 'Entries from 2023 matching query' },
    ]
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
            Search across L/Cs, Proforma Invoices, Applicants, and Beneficiaries. (Full search logic requires backend implementation)
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
              <p className="text-lg">Showing illustrative results for: <span className="font-semibold text-primary">{displayedQuery}</span></p>
              <p className="text-xs text-muted-foreground">(Actual search results would be dynamically fetched from the database)</p>
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
                  {placeholderResults.lcs.length > 0 ? (
                    <ul className="space-y-2">
                      {placeholderResults.lcs.map(lc => (
                        <li key={lc.id} className="text-sm hover:bg-muted/50 p-2 rounded-md">
                          <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="text-primary hover:underline flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> {lc.number} (Applicant: {lc.applicant})
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">No L/C entries found matching your query. (Illustrative)</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Users className="h-5 w-5 text-primary"/>Applicants Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                   {placeholderResults.applicants.length > 0 ? (
                    <ul className="space-y-2">
                      {placeholderResults.applicants.map(app => (
                        <li key={app.id} className="text-sm hover:bg-muted/50 p-2 rounded-md">
                          <Link href={`/dashboard/customers/${app.id}/edit`} className="text-primary hover:underline flex items-center gap-1">
                             <LinkIcon className="h-3 w-3" /> {app.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">No Applicants found matching your query. (Illustrative)</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Building className="h-5 w-5 text-primary"/>Beneficiaries Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  {placeholderResults.beneficiaries.length > 0 ? (
                    <ul className="space-y-2">
                      {placeholderResults.beneficiaries.map(ben => (
                        <li key={ben.id} className="text-sm hover:bg-muted/50 p-2 rounded-md">
                          <Link href={`/dashboard/suppliers/${ben.id}/edit`} className="text-primary hover:underline flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> {ben.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ): <p className="text-muted-foreground">No Beneficiaries found matching your query. (Illustrative)</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Layers className="h-5 w-5 text-primary"/>Proforma Invoices Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  {placeholderResults.pis.length > 0 ? (
                    <ul className="space-y-2">
                      {placeholderResults.pis.map(pi => (
                        <li key={pi.id} className="text-sm hover:bg-muted/50 p-2 rounded-md">
                          <Link href={`/dashboard/commission-management/edit-pi/${pi.id}`} className="text-primary hover:underline flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> {pi.number} (Applicant: {pi.applicant})
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ): <p className="text-muted-foreground">No Proforma Invoices found matching your query. (Illustrative)</p>}
                </CardContent>
              </Card>
               <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary"/>Entries by Year "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  {placeholderResults.byYear.length > 0 ? (
                     <ul className="space-y-2">
                      {placeholderResults.byYear.map(item => (
                        <li key={item.year} className="text-sm hover:bg-muted/50 p-2 rounded-md">
                          {/* This link would ideally go to a filtered view, e.g., L/C list filtered by this year */}
                          <Link href={`/dashboard/total-lc?year=${item.year}`} className="text-primary hover:underline flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> View L/Cs from {item.year}
                          </Link>
                           <p className="text-xs text-muted-foreground ml-4">{item.description}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">No entries found for year "{displayedQuery}". (Illustrative)</p>}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SearchPage() {
  return (
    // Suspense is crucial for useSearchParams to work correctly during client-side navigation
    <Suspense fallback={<div>Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}


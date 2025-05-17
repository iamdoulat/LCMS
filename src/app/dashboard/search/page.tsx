
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

  // Placeholder data for illustrative links, now more dynamic
  const generatePlaceholderResults = (query: string) => {
    const sanitizedQuery = query.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 10); // Sanitize for use in IDs/names
    return {
      lcs: [
        { id: `lc_match_${sanitizedQuery}_1`, number: `LC-${sanitizedQuery}-001`, applicant: `Applicant for ${sanitizedQuery}` },
        { id: `lc_match_${sanitizedQuery}_2`, number: `LC-${sanitizedQuery}-002`, applicant: `Another Applicant for ${sanitizedQuery}` },
      ],
      applicants: [
        { id: `app_match_${sanitizedQuery}_A`, name: `Applicant matching '${query}' - Alpha` },
        { id: `app_match_${sanitizedQuery}_B`, name: `Applicant matching '${query}' - Beta` },
      ],
      beneficiaries: [
        { id: `ben_match_${sanitizedQuery}_X`, name: `Beneficiary matching '${query}' - Xylia` },
        { id: `ben_match_${sanitizedQuery}_Y`, name: `Beneficiary matching '${query}' - Yarrow` },
      ],
      pis: [
        { id: `pi_match_${sanitizedQuery}_001`, number: `PI-${sanitizedQuery}-A05`, applicant: `Applicant for ${sanitizedQuery}` },
        { id: `pi_match_${sanitizedQuery}_002`, number: `PI-${sanitizedQuery}-B12`, applicant: `Another Applicant for ${sanitizedQuery}` },
      ],
      byYear: query.match(/^\d{4}$/) // Check if query looks like a year
        ? [{ year: query, description: `Entries from ${query} matching query` }]
        : [
            { year: '2024', description: `Entries from 2024 matching '${query}'` },
            { year: '2023', description: `Entries from 2023 matching '${query}'` },
          ]
    };
  };
  
  const placeholderResults = displayedQuery ? generatePlaceholderResults(displayedQuery) : null;


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

          {displayedQuery && placeholderResults && (
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

          {displayedQuery && placeholderResults && (
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
                  ) : <p className="text-muted-foreground">No L/C entries found matching "{displayedQuery}". (Illustrative)</p>}
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
                  ) : <p className="text-muted-foreground">No Applicants found matching "{displayedQuery}". (Illustrative)</p>}
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
                  ): <p className="text-muted-foreground">No Beneficiaries found matching "{displayedQuery}". (Illustrative)</p>}
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
                  ): <p className="text-muted-foreground">No Proforma Invoices found matching "{displayedQuery}". (Illustrative)</p>}
                </CardContent>
              </Card>
               <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary"/>Entries by Year "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  {placeholderResults.byYear.length > 0 && placeholderResults.byYear[0].year === displayedQuery ? ( // Only show if query is a year
                     <ul className="space-y-2">
                      {placeholderResults.byYear.map(item => (
                        <li key={item.year} className="text-sm hover:bg-muted/50 p-2 rounded-md">
                          <Link href={`/dashboard/total-lc?year=${item.year}`} className="text-primary hover:underline flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> View L/Cs from {item.year}
                          </Link>
                           <p className="text-xs text-muted-foreground ml-4">{item.description}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">No entries found for year "{displayedQuery}", or your search term is not a specific year. (Illustrative)</p>}
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


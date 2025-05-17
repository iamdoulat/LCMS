
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, FileText, Users, Building, Layers, CalendarDays, Link as LinkIcon, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { LCEntryDocument } from '@/types'; // Assuming LCEntryDocument is correctly typed

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [displayedQuery, setDisplayedQuery] = useState(initialQuery);

  const [lcResults, setLcResults] = useState<LCEntryDocument[]>([]);
  const [isLoadingLcSearch, setIsLoadingLcSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const queryFromUrl = searchParams.get('q') || '';
    setSearchTerm(queryFromUrl);
    setDisplayedQuery(queryFromUrl);
  }, [searchParams]);

  useEffect(() => {
    const performSearch = async () => {
      if (!displayedQuery.trim()) {
        setLcResults([]);
        setSearchError(null);
        setIsLoadingLcSearch(false);
        return;
      }

      setIsLoadingLcSearch(true);
      setSearchError(null);
      setLcResults([]); // Clear previous results

      try {
        // Search L/C by documentaryCreditNumber
        const lcEntriesRef = collection(firestore, "lc_entries");
        const q = query(lcEntriesRef, where("documentaryCreditNumber", "==", displayedQuery.trim()));
        const querySnapshot = await getDocs(q);
        
        const fetchedLcs: LCEntryDocument[] = [];
        querySnapshot.forEach((doc) => {
          fetchedLcs.push({ id: doc.id, ...doc.data() } as LCEntryDocument);
        });
        setLcResults(fetchedLcs);

      } catch (error: any) {
        console.error("Error searching L/Cs:", error);
        setSearchError(`Failed to search L/Cs: ${error.message}. Check Firestore rules and indexes.`);
      } finally {
        setIsLoadingLcSearch(false);
      }
    };

    performSearch();
  }, [displayedQuery]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedSearchTerm = searchTerm.trim();
    if (trimmedSearchTerm) {
      router.push(`/dashboard/search?q=${encodeURIComponent(trimmedSearchTerm)}`);
    } else {
      router.push('/dashboard/search'); // Clear query if search term is empty
    }
  };

  const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
    } catch (e) {
      return 'N/A';
    }
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
            Enter a search term. Currently, searching by L/C Number is supported.
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
              <p className="text-lg">Showing results for: <span className="font-semibold text-primary">{displayedQuery}</span></p>
            </div>
          )}

          {!displayedQuery && !isLoadingLcSearch && (
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
                  {isLoadingLcSearch ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /> Searching L/Cs...
                    </div>
                  ) : searchError ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Search Error</AlertTitle>
                      <AlertDescription>{searchError}</AlertDescription>
                    </Alert>
                  ) : lcResults.length > 0 ? (
                    <ul className="space-y-3">
                      {lcResults.map(lc => (
                        <li key={lc.id} className="text-sm hover:bg-muted/50 p-3 rounded-md border">
                          <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="text-primary hover:underline font-medium flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> {lc.documentaryCreditNumber}
                          </Link>
                          <div className="text-xs text-muted-foreground mt-1">
                            <p>Applicant: {lc.applicantName || 'N/A'}</p>
                            <p>Beneficiary: {lc.beneficiaryName || 'N/A'}</p>
                            <p>Issue Date: {formatDisplayDate(lc.lcIssueDate)} | Status: {lc.status || 'N/A'}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No L/C entries found matching "{displayedQuery}". Ensure the L/C number is exact.</p>
                  )}
                </CardContent>
              </Card>

              {/* Placeholder sections for other categories - will show "no results" for this L/C number specific search */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Users className="h-5 w-5 text-primary"/>Applicants Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">No direct applicant name matches for L/C# "{displayedQuery}". (Applicant search not yet fully implemented)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Building className="h-5 w-5 text-primary"/>Beneficiaries Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                   <p className="text-muted-foreground">No direct beneficiary name matches for L/C# "{displayedQuery}". (Beneficiary search not yet fully implemented)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Layers className="h-5 w-5 text-primary"/>Proforma Invoices Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">No PI matches for L/C# "{displayedQuery}". (PI search not yet fully implemented)</p>
                </CardContent>
              </Card>

               <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary"/>Entries by Year Matching "{displayedQuery}"</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Year-based search for L/C# "{displayedQuery}" not applicable. (Year search not yet fully implemented for L/C numbers)</p>
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
    // Suspense is important for useSearchParams to work correctly
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><SearchIcon className="h-10 w-10 animate-pulse text-primary" /> Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}

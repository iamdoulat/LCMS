
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
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { LCEntryDocument, CustomerDocument, SupplierDocument } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [displayedQuery, setDisplayedQuery] = useState(initialQuery);

  const [lcResults, setLcResults] = useState<LCEntryDocument[]>([]);
  const [isLoadingLcSearch, setIsLoadingLcSearch] = useState(false);
  const [lcSearchError, setLcSearchError] = useState<string | null>(null);

  const [applicantResults, setApplicantResults] = useState<CustomerDocument[]>([]);
  const [isLoadingApplicantSearch, setIsLoadingApplicantSearch] = useState(false);
  const [applicantSearchError, setApplicantSearchError] = useState<string | null>(null);

  const [beneficiaryResults, setBeneficiaryResults] = useState<SupplierDocument[]>([]);
  const [isLoadingBeneficiarySearch, setIsLoadingBeneficiarySearch] = useState(false);
  const [beneficiarySearchError, setBeneficiarySearchError] = useState<string | null>(null);

  useEffect(() => {
    const queryFromUrl = searchParams.get('q') || '';
    setSearchTerm(queryFromUrl);
    setDisplayedQuery(queryFromUrl);
  }, [searchParams]);

  useEffect(() => {
    const performSearch = async () => {
      if (!displayedQuery.trim()) {
        setLcResults([]);
        setApplicantResults([]);
        setBeneficiaryResults([]);
        setLcSearchError(null);
        setApplicantSearchError(null);
        setBeneficiarySearchError(null);
        setIsLoadingLcSearch(false);
        setIsLoadingApplicantSearch(false);
        setIsLoadingBeneficiarySearch(false);
        return;
      }

      const trimmedQuery = displayedQuery.trim();

      // Reset states for new search
      setIsLoadingLcSearch(true);
      setIsLoadingApplicantSearch(true);
      setIsLoadingBeneficiarySearch(true);
      setLcSearchError(null);
      setApplicantSearchError(null);
      setBeneficiarySearchError(null);
      setLcResults([]);
      setApplicantResults([]);
      setBeneficiaryResults([]);

      try {
        // --- L/C Search (Exact Match) ---
        const lcEntriesRef = collection(firestore, "lc_entries");
        const lcQuery = query(lcEntriesRef, where("documentaryCreditNumber", "==", trimmedQuery));
        const lcQuerySnapshot = await getDocs(lcQuery);
        const fetchedLcs: LCEntryDocument[] = [];
        lcQuerySnapshot.forEach((doc) => {
          fetchedLcs.push({ id: doc.id, ...doc.data() } as LCEntryDocument);
        });
        setLcResults(fetchedLcs);
      } catch (error: any) {
        console.error("Error searching L/Cs:", error);
        setLcSearchError(`Failed to search L/Cs: ${error.message}. Ensure necessary Firestore indexes exist.`);
      } finally {
        setIsLoadingLcSearch(false);
      }

      try {
        // --- Applicant Search (Starts With, Case-Sensitive) ---
        const customersRef = collection(firestore, "customers");
        const applicantNameQuery = query(
          customersRef,
          where("applicantName", ">=", trimmedQuery),
          where("applicantName", "<=", trimmedQuery + "\uf8ff"),
          limit(10) // Limit results for performance
        );
        const applicantQuerySnapshot = await getDocs(applicantNameQuery);
        const fetchedApplicants: CustomerDocument[] = [];
        applicantQuerySnapshot.forEach((doc) => {
          fetchedApplicants.push({ id: doc.id, ...doc.data() } as CustomerDocument);
        });
        setApplicantResults(fetchedApplicants);
      } catch (error: any) {
        console.error("Error searching Applicants:", error);
        setApplicantSearchError(`Failed to search Applicants: ${error.message}. Ensure necessary Firestore indexes exist.`);
      } finally {
        setIsLoadingApplicantSearch(false);
      }

      try {
        // --- Beneficiary Search (Starts With, Case-Sensitive) ---
        const suppliersRef = collection(firestore, "suppliers");
        const beneficiaryNameQuery = query(
          suppliersRef,
          where("beneficiaryName", ">=", trimmedQuery),
          where("beneficiaryName", "<=", trimmedQuery + "\uf8ff"),
          limit(10) // Limit results for performance
        );
        const beneficiaryQuerySnapshot = await getDocs(beneficiaryNameQuery);
        const fetchedBeneficiaries: SupplierDocument[] = [];
        beneficiaryQuerySnapshot.forEach((doc) => {
          fetchedBeneficiaries.push({ id: doc.id, ...doc.data() } as SupplierDocument);
        });
        setBeneficiaryResults(fetchedBeneficiaries);
      } catch (error: any) {
        console.error("Error searching Beneficiaries:", error);
        setBeneficiarySearchError(`Failed to search Beneficiaries: ${error.message}. Ensure necessary Firestore indexes exist.`);
      } finally {
        setIsLoadingBeneficiarySearch(false);
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
      router.push('/dashboard/search');
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

  const renderLCResults = () => {
    if (isLoadingLcSearch) return <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /> Searching L/Cs...</div>;
    if (lcSearchError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>L/C Search Error</AlertTitle><AlertDescription>{lcSearchError}</AlertDescription></Alert>;
    if (lcResults.length > 0) {
      return (
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
      );
    }
    return <p className="text-muted-foreground text-sm">No L/C entries found matching "{displayedQuery}" (exact match).</p>;
  };

  const renderApplicantResults = () => {
    if (isLoadingApplicantSearch) return <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /> Searching Applicants...</div>;
    if (applicantSearchError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Applicant Search Error</AlertTitle><AlertDescription>{applicantSearchError}</AlertDescription></Alert>;
    if (applicantResults.length > 0) {
      return (
        <ul className="space-y-3">
          {applicantResults.map(app => (
            <li key={app.id} className="text-sm hover:bg-muted/50 p-3 rounded-md border">
              <Link href={`/dashboard/customers/${app.id}/edit`} className="text-primary hover:underline font-medium flex items-center gap-1">
                <LinkIcon className="h-3 w-3" /> {app.applicantName}
              </Link>
              <div className="text-xs text-muted-foreground mt-1">
                <p>Email: {app.email || 'N/A'}</p>
                <p>Phone: {app.phone || 'N/A'}</p>
              </div>
            </li>
          ))}
        </ul>
      );
    }
    return <p className="text-muted-foreground text-sm">No Applicants found starting with "{displayedQuery}" (case-sensitive).</p>;
  };

  const renderBeneficiaryResults = () => {
    if (isLoadingBeneficiarySearch) return <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /> Searching Beneficiaries...</div>;
    if (beneficiarySearchError) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Beneficiary Search Error</AlertTitle><AlertDescription>{beneficiarySearchError}</AlertDescription></Alert>;
    if (beneficiaryResults.length > 0) {
      return (
        <ul className="space-y-3">
          {beneficiaryResults.map(ben => (
            <li key={ben.id} className="text-sm hover:bg-muted/50 p-3 rounded-md border">
              <Link href={`/dashboard/suppliers/${ben.id}/edit`} className="text-primary hover:underline font-medium flex items-center gap-1">
                <LinkIcon className="h-3 w-3" /> {ben.beneficiaryName}
              </Link>
              <div className="text-xs text-muted-foreground mt-1">
                <p>Email: {ben.emailId || 'N/A'}</p>
                <p>Brand: {ben.brandName || 'N/A'}</p>
              </div>
            </li>
          ))}
        </ul>
      );
    }
    return <p className="text-muted-foreground text-sm">No Beneficiaries found starting with "{displayedQuery}" (case-sensitive).</p>;
  };

  return (
    <div className="mx-[15px]">
      <div className="container mx-auto py-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-primary">
              <SearchIcon className="h-7 w-7 text-primary" />
              Global Search
            </CardTitle>
            <CardDescription>
              Enter a search term. L/C Number uses exact match. Applicant and Beneficiary names use "starts with" (case-sensitive) matching.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearchSubmit} className="flex w-full max-w-2xl mx-auto items-center space-x-2 mb-8">
              <Input
                type="search"
                placeholder="Enter L/C No, Applicant, Beneficiary..."
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

            {!displayedQuery && !isLoadingLcSearch && !isLoadingApplicantSearch && !isLoadingBeneficiarySearch && (
              <div className="text-center text-muted-foreground py-10">
                <SearchIcon className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg">Enter a term above to search the system.</p>
              </div>
            )}

            {displayedQuery && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />L/C Entries Matching "{displayedQuery}"</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderLCResults()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Applicants Starting With "{displayedQuery}"</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderApplicantResults()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Building className="h-5 w-5 text-primary" />Beneficiaries Starting With "{displayedQuery}"</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderBeneficiaryResults()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />Proforma Invoices Matching "{displayedQuery}"</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">Proforma Invoice search is not yet implemented for this query type.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Entries by Year Matching "{displayedQuery}"</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">Year-based search for this query term is not yet implemented.</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><SearchIcon className="h-10 w-10 animate-pulse text-primary" /> Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}


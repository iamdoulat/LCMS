
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, FileText, Users, Building, Layers, CalendarDays, Link as LinkIcon, Loader2, AlertTriangle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import type { LCEntryDocument, CustomerDocument, SupplierDocument } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MachineryRow {
  model: string;
  applicantName: string;
  qty?: number;
  unitPrice?: number;
  totalPrice?: number;
  year?: number;
  lcNo: string;
  lcId: string;
}

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

  const [machineryRows, setMachineryRows] = useState<MachineryRow[]>([]);
  const [isLoadingMachinery, setIsLoadingMachinery] = useState(false);
  const [machineryError, setMachineryError] = useState<string | null>(null);

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
        setMachineryRows([]);
        setLcSearchError(null);
        setApplicantSearchError(null);
        setBeneficiarySearchError(null);
        setMachineryError(null);
        setIsLoadingLcSearch(false);
        setIsLoadingApplicantSearch(false);
        setIsLoadingBeneficiarySearch(false);
        setIsLoadingMachinery(false);
        return;
      }

      const trimmedQuery = displayedQuery.trim();

      // Reset states for new search
      setIsLoadingLcSearch(true);
      setIsLoadingApplicantSearch(true);
      setIsLoadingBeneficiarySearch(true);
      setIsLoadingMachinery(true);
      setLcSearchError(null);
      setApplicantSearchError(null);
      setBeneficiarySearchError(null);
      setMachineryError(null);
      setLcResults([]);
      setApplicantResults([]);
      setBeneficiaryResults([]);
      setMachineryRows([]);

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
        const fetchedBeneficiaries: SupplierDocument[] = []
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

      // --- PI / Machinery Information Search ---
      // Strategy: fetch LC entries that match applicantName starts-with query,
      // then client-side filter piMachineryInfo rows where model contains the query.
      // Also fetch by applicantName to get all their machinery. We combine both.
      try {
        const lcEntriesRef = collection(firestore, "lc_entries");

        // Fetch LCs by applicantName starts-with
        const lcByApplicantQuery = query(
          lcEntriesRef,
          where("applicantName", ">=", trimmedQuery),
          where("applicantName", "<=", trimmedQuery + "\uf8ff"),
          limit(50)
        );

        // Fetch LCs that match LC number (already done above, reuse below)
        const [byApplicantSnap] = await Promise.all([
          getDocs(lcByApplicantQuery),
        ]);

        const allLcDocs = new Map<string, LCEntryDocument>();

        byApplicantSnap.forEach((doc) => {
          allLcDocs.set(doc.id, { id: doc.id, ...doc.data() } as LCEntryDocument);
        });

        // Also iterate lcResults (from exact LC number match)
        // These will be set once the first fetch completes, so re-fetch here for simplicity
        const lcByExactQuery = query(
          lcEntriesRef,
          where("documentaryCreditNumber", "==", trimmedQuery)
        );
        const lcExactSnap = await getDocs(lcByExactQuery);
        lcExactSnap.forEach((doc) => {
          allLcDocs.set(doc.id, { id: doc.id, ...doc.data() } as LCEntryDocument);
        });

        // Build rows: for each LC with piMachineryInfo, create a row per item
        const rows: MachineryRow[] = [];
        const queryLower = trimmedQuery.toLowerCase();

        allLcDocs.forEach((lc) => {
          if (!lc.piMachineryInfo || lc.piMachineryInfo.length === 0) return;
          lc.piMachineryInfo.forEach((item) => {
            // Include if model, applicantName, or LC number matches the query
            const modelMatch = item.model?.toLowerCase().includes(queryLower);
            const applicantMatch = lc.applicantName?.toLowerCase().includes(queryLower);
            const lcNoMatch = lc.documentaryCreditNumber?.toLowerCase().includes(queryLower);

            if (modelMatch || applicantMatch || lcNoMatch) {
              rows.push({
                model: item.model || '—',
                applicantName: lc.applicantName || '—',
                qty: item.qty,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice ?? ((item.qty ?? 0) * (item.unitPrice ?? 0)),
                year: lc.year,
                lcNo: lc.documentaryCreditNumber || '—',
                lcId: lc.id,
              });
            }
          });
        });

        setMachineryRows(rows);
      } catch (error: any) {
        console.error("Error searching Machinery:", error);
        setMachineryError(`Failed to search Machinery info: ${error.message}`);
      } finally {
        setIsLoadingMachinery(false);
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

  const renderMachineryResults = () => {
    if (isLoadingMachinery) {
      return (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /> Searching Machinery Info...
        </div>
      );
    }
    if (machineryError) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Machinery Search Error</AlertTitle>
          <AlertDescription>{machineryError}</AlertDescription>
        </Alert>
      );
    }
    if (machineryRows.length > 0) {
      const grandTotalQty = machineryRows.reduce((sum, r) => sum + (r.qty ?? 0), 0);
      const grandTotalPrice = machineryRows.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);

      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="px-3 py-2 text-left font-semibold">#</th>
                <th className="px-3 py-2 text-left font-semibold">Model</th>
                <th className="px-3 py-2 text-left font-semibold">Applicant Name</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">U. Price</th>
                <th className="px-3 py-2 text-right font-semibold">T. Price</th>
                <th className="px-3 py-2 text-center font-semibold">Year</th>
                <th className="px-3 py-2 text-left font-semibold">LC No.</th>
              </tr>
            </thead>
            <tbody>
              {machineryRows.map((row, idx) => (
                <tr
                  key={`${row.lcId}-${idx}`}
                  className={cn(
                    "border-t border-border transition-colors",
                    idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                    "hover:bg-primary/5"
                  )}
                >
                  <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {row.model}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.applicantName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.qty != null ? row.qty : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.unitPrice != null
                      ? row.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">
                    {row.totalPrice != null
                      ? row.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                      {row.year ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/total-lc/${row.lcId}/edit`}
                      className="text-primary hover:underline text-xs font-medium flex items-center gap-1"
                    >
                      <LinkIcon className="h-3 w-3 shrink-0" />
                      {row.lcNo}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-semibold text-sm">
                <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground text-xs uppercase tracking-wider">
                  Grand Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {grandTotalQty}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                <td className="px-3 py-2 text-right tabular-nums text-primary font-bold">
                  {grandTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      );
    }
    return (
      <p className="text-muted-foreground text-sm">
        No PI / Machinery information found matching &quot;{displayedQuery}&quot;.
      </p>
    );
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
              Enter a search term. L/C Number uses exact match. Applicant and Beneficiary names use &quot;starts with&quot; (case-sensitive) matching. Machinery search matches model, applicant name, or LC number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearchSubmit} className="flex w-full max-w-2xl mx-auto items-center space-x-2 mb-8">
              <Input
                type="search"
                placeholder="Enter L/C No, Applicant, Beneficiary, Model..."
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
                {/* PI / Machinery Information - shown first as requested */}
                <Card className="border-primary/20 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      PI / Machinery Information
                      {!isLoadingMachinery && machineryRows.length > 0 && (
                        <span className="ml-auto text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {machineryRows.length} item{machineryRows.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderMachineryResults()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />L/C Entries Matching &quot;{displayedQuery}&quot;</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderLCResults()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Applicants Starting With &quot;{displayedQuery}&quot;</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderApplicantResults()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Building className="h-5 w-5 text-primary" />Beneficiaries Starting With &quot;{displayedQuery}&quot;</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderBeneficiaryResults()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />Proforma Invoices Matching &quot;{displayedQuery}&quot;</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">Proforma Invoice search is not yet implemented for this query type.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Entries by Year Matching &quot;{displayedQuery}&quot;</CardTitle>
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


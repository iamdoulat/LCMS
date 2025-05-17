
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, FileText, Users, Building, Layers, CalendarDays, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format } from 'date-fns';

interface PlaceholderLC {
  id: string;
  documentaryCreditNumber: string;
  applicantName: string;
  beneficiaryName: string;
  lcIssueDate: string;
  status: string;
}

interface PlaceholderApplicant {
  id: string;
  applicantName: string;
  email: string;
  contactPerson?: string;
}

interface PlaceholderBeneficiary {
  id: string;
  beneficiaryName: string;
  emailId: string;
  brandName?: string;
}

interface PlaceholderPI {
  id: string;
  piNo: string;
  applicantName: string;
  beneficiaryName: string;
  piDate: string;
}

interface PlaceholderYearResult {
  year: string;
  description: string;
}

interface PlaceholderResults {
  lcs: PlaceholderLC[];
  applicants: PlaceholderApplicant[];
  beneficiaries: PlaceholderBeneficiary[];
  pis: PlaceholderPI[];
  byYear: PlaceholderYearResult[];
}


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

  const generatePlaceholderResults = (query: string): PlaceholderResults => {
    const sanitizedQuery = query.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 15); // Sanitize for use in IDs/names
    const today = new Date();
    const lcDate = format(new Date(today.setDate(today.getDate() - Math.floor(Math.random() * 30))), 'PPP');
    const piDate = format(new Date(today.setDate(today.getDate() - Math.floor(Math.random() * 10))), 'PPP');

    return {
      lcs: [
        { 
          id: `lc_match_${sanitizedQuery}_1`, 
          documentaryCreditNumber: `LC-${sanitizedQuery}-001`, 
          applicantName: `Applicant related to '${query}' Alpha`,
          beneficiaryName: `Beneficiary for '${query}' One`,
          lcIssueDate: lcDate,
          status: "Transmitted"
        },
        { 
          id: `lc_match_${sanitizedQuery}_2`, 
          documentaryCreditNumber: `LC-${sanitizedQuery}-002`, 
          applicantName: `Another Applicant for '${query}'`,
          beneficiaryName: `Beneficiary for '${query}' Two`,
          lcIssueDate: lcDate,
          status: "Shipment Pending"
        },
      ],
      applicants: [
        { id: `app_match_${sanitizedQuery}_A`, applicantName: `Applicant matching '${query}' - Alpha Inc.`, email: `alpha.${sanitizedQuery}@example.com`, contactPerson: `Mr. ${query} Alpha` },
        { id: `app_match_${sanitizedQuery}_B`, applicantName: `Beta Co. (matches '${query}')`, email: `beta.${sanitizedQuery}@example.com` },
      ],
      beneficiaries: [
        { id: `ben_match_${sanitizedQuery}_X`, beneficiaryName: `Beneficiary Xylia for '${query}'`, emailId: `contact@xylia-${sanitizedQuery}.com`, brandName: `Xylia ${query} Brand` },
        { id: `ben_match_${sanitizedQuery}_Y`, beneficiaryName: `Yarrow Supplies (matches '${query}')`, emailId: `sales@yarrow-${sanitizedQuery}.co` },
      ],
      pis: [
        { id: `pi_match_${sanitizedQuery}_001`, piNo: `PI-${sanitizedQuery}-A05`, applicantName: `Applicant for '${query}' Gamma`, beneficiaryName: `Beneficiary Gamma PI for '${query}'`, piDate: piDate },
        { id: `pi_match_${sanitizedQuery}_002`, piNo: `PI-${sanitizedQuery}-B12`, applicantName: `Another Applicant PI ('${query}')`, beneficiaryName: `Delta PI Goods for '${query}'`, piDate: piDate },
      ],
      byYear: query.match(/^\d{4}$/) // Check if query looks like a year
        ? [{ year: query, description: `L/C Entries from year ${query} potentially matching further criteria related to '${query}'` }]
        : [
            { year: '2024', description: `L/C Entries from 2024 matching '${query}'` },
            { year: '2023', description: `L/C Entries from 2023 matching '${query}'` },
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
                    <ul className="space-y-3">
                      {placeholderResults.lcs.map(lc => (
                        <li key={lc.id} className="text-sm hover:bg-muted/50 p-3 rounded-md border">
                          <Link href={`/dashboard/total-lc/${lc.id}/edit`} className="text-primary hover:underline font-medium flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> {lc.documentaryCreditNumber}
                          </Link>
                          <div className="text-xs text-muted-foreground mt-1">
                            <p>Applicant: {lc.applicantName}</p>
                            <p>Beneficiary: {lc.beneficiaryName}</p>
                            <p>Issue Date: {lc.lcIssueDate} | Status: {lc.status}</p>
                          </div>
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
                    <ul className="space-y-3">
                      {placeholderResults.applicants.map(app => (
                        <li key={app.id} className="text-sm hover:bg-muted/50 p-3 rounded-md border">
                          <Link href={`/dashboard/customers/${app.id}/edit`} className="text-primary hover:underline font-medium flex items-center gap-1">
                             <LinkIcon className="h-3 w-3" /> {app.applicantName}
                          </Link>
                           <div className="text-xs text-muted-foreground mt-1">
                            <p>Email: {app.email}</p>
                            {app.contactPerson && <p>Contact: {app.contactPerson}</p>}
                          </div>
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
                    <ul className="space-y-3">
                      {placeholderResults.beneficiaries.map(ben => (
                        <li key={ben.id} className="text-sm hover:bg-muted/50 p-3 rounded-md border">
                          <Link href={`/dashboard/suppliers/${ben.id}/edit`} className="text-primary hover:underline font-medium flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> {ben.beneficiaryName}
                          </Link>
                           <div className="text-xs text-muted-foreground mt-1">
                            <p>Email: {ben.emailId}</p>
                            {ben.brandName && <p>Brand: {ben.brandName}</p>}
                          </div>
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
                    <ul className="space-y-3">
                      {placeholderResults.pis.map(pi => (
                        <li key={pi.id} className="text-sm hover:bg-muted/50 p-3 rounded-md border">
                          <Link href={`/dashboard/commission-management/edit-pi/${pi.id}`} className="text-primary hover:underline font-medium flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> {pi.piNo}
                          </Link>
                           <div className="text-xs text-muted-foreground mt-1">
                            <p>Applicant: {pi.applicantName}</p>
                            <p>Beneficiary: {pi.beneficiaryName}</p>
                            <p>PI Date: {pi.piDate}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ): <p className="text-muted-foreground">No Proforma Invoices found matching "{displayedQuery}". (Illustrative)</p>}
                </CardContent>
              </Card>

               <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary"/>Entries by Year (Illustrative)</CardTitle>
                </CardHeader>
                <CardContent>
                  {placeholderResults.byYear.length > 0 ? (
                     <ul className="space-y-3">
                      {placeholderResults.byYear.map(item => (
                        <li key={item.year} className="text-sm hover:bg-muted/50 p-3 rounded-md border">
                          <Link href={`/dashboard/total-lc?year=${item.year}`} className="text-primary hover:underline font-medium flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> View L/Cs from {item.year}
                          </Link>
                           <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">No specific year search results to show. (Illustrative)</p>}
                   <p className="text-xs text-muted-foreground mt-3">
                    Note: If you search for a specific year (e.g., "2024"), this section would link to a list of L/Cs from that year.
                  </p>
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
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><SearchIcon className="h-10 w-10 animate-pulse text-primary" /> Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}


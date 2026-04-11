"use client";

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search as SearchIcon, 
  ArrowLeft, 
  Cpu, 
  Loader2, 
  AlertTriangle, 
  Download, 
  Copy, 
  ExternalLink,
  ChevronRight,
  User,
  Building,
  Calendar,
  Layers,
  FileText,
  Hash,
  Box,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { LCEntryDocument, CustomerDocument, SupplierDocument } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';

interface MachineryRow {
  model: string;
  applicantName: string;
  qty?: number;
  unitPrice?: number;
  totalPrice?: number;
  year?: number;
  lcNo: string;
  lcId: string;
  finalPIUrl?: string;
}

function MobileSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [displayedQuery, setDisplayedQuery] = useState(initialQuery);
  const [isDownloading, setIsDownloading] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

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

  // Pagination limits
  const [machineryLimit, setMachineryLimit] = useState(10);
  const [lcLimit, setLcLimit] = useState(10);
  const [applicantLimit, setApplicantLimit] = useState(10);

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
        // Reset limits
        setMachineryLimit(10);
        setLcLimit(10);
        setApplicantLimit(10);
        return;
      }

      const trimmedQuery = displayedQuery.trim();
      const queryLower = trimmedQuery.toLowerCase();

      setIsLoadingLcSearch(true);
      setIsLoadingApplicantSearch(true);
      setIsLoadingBeneficiarySearch(true);
      setIsLoadingMachinery(true);

      try {
        // L/C Search
        const lcEntriesRef = collection(firestore, "lc_entries");
        const lcQuery = query(lcEntriesRef, where("documentaryCreditNumber", "==", trimmedQuery));
        const lcSnap = await getDocs(lcQuery);
        const fetchedLcs = lcSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LCEntryDocument));
        setLcResults(fetchedLcs);
      } catch (error: any) {
        setLcSearchError(error.message);
      } finally {
        setIsLoadingLcSearch(false);
      }

      try {
        // Applicant Search
        const customersRef = collection(firestore, "customers");
        const appQuery = query(
          customersRef,
          where("applicantName", ">=", trimmedQuery),
          where("applicantName", "<=", trimmedQuery + "\uf8ff"),
          limit(100) // Support load more
        );
        const appSnap = await getDocs(appQuery);
        setApplicantResults(appSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerDocument)));
      } catch (error: any) {
        setApplicantSearchError(error.message);
      } finally {
        setIsLoadingApplicantSearch(false);
      }

      try {
        // Beneficiary Search
        const suppliersRef = collection(firestore, "suppliers");
        const benQuery = query(
          suppliersRef,
          where("beneficiaryName", ">=", trimmedQuery),
          where("beneficiaryName", "<=", trimmedQuery + "\uf8ff"),
          limit(100) // Support load more
        );
        const benSnap = await getDocs(benQuery);
        setBeneficiaryResults(benSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierDocument)));
      } catch (error: any) {
        setBeneficiarySearchError(error.message);
      } finally {
        setIsLoadingBeneficiarySearch(false);
      }

      try {
        // Machinery Search (Client-side filtered)
        const lcEntriesRef = collection(firestore, "lc_entries");
        const allLcQuery = query(lcEntriesRef, limit(500));
        const allLcSnap = await getDocs(allLcQuery);

        const rows: MachineryRow[] = [];
        allLcSnap.forEach((docSnap) => {
          const lc = { id: docSnap.id, ...docSnap.data() } as LCEntryDocument;
          if (!lc.piMachineryInfo) return;

          lc.piMachineryInfo.forEach((item) => {
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
                finalPIUrl: lc.finalPIUrl || undefined,
              });
            }
          });
        });
        setMachineryRows(rows);
      } catch (error: any) {
        setMachineryError(error.message);
      } finally {
        setIsLoadingMachinery(false);
      }
    };

    performSearch();
  }, [displayedQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchTerm.trim();
    if (trimmed) {
      router.push(`/mobile/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/mobile/search');
    }
  };

  const handleDownloadPDF = async () => {
    if (!resultsRef.current || !displayedQuery) return;
    setIsDownloading(true);
    try {
      const element = resultsRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`search-${displayedQuery.toLowerCase()}.pdf`);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'Failed to generate PDF', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      title: 'Copied!',
      text: `${text} copied to clipboard`,
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  };

  const formatCurrency = (val?: number) => {
    if (val === undefined) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a1e60] overflow-hidden">
      {/* Premium Header */}
      <div className="bg-[#0a1e60] text-white pt-2 pb-10 px-4 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full -ml-24 -mb-24 blur-3xl opacity-30" />
        
        <div className="flex items-center mb-3 relative z-10">
          <button 
            onClick={() => router.back()} 
            className="p-2 -ml-2 rounded-full bg-white/10 shadow-lg shadow-black/20 active:bg-white/20 transition-all active:scale-95 border border-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold ml-2">Machine Search</h1>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative z-10">
          <div className="relative group">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search model, L/C, or company..."
              className="pl-12 h-14 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-2xl focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus:bg-white/20 transition-all font-medium text-base shadow-inner"
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20"
              >
                <XCircle className="h-4 w-4 text-white/60" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Main Content Area with Curved UI */}
      <div className="flex-1 bg-slate-50 relative -mt-4 rounded-t-[40px] shadow-[0_-8px_30px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="h-full overflow-y-auto overscroll-contain px-4 py-8 pb-[200px]">
        {!displayedQuery ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40 select-none">
            <div className="bg-white p-8 rounded-full shadow-sm mb-6 border border-slate-100">
              <Cpu className="h-12 w-12 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Ready to search</h3>
            <p className="text-sm text-slate-500 mt-2 px-10 leading-relaxed">Enter a machine model or credit number to explore detailed records.</p>
          </div>
        ) : (
          <div ref={resultsRef} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Results Header */}
            <div className="flex items-center justify-between px-1">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Results</p>
                <h2 className="text-xl font-extrabold text-[#0a1e60] truncate max-w-[200px]">&quot;{displayedQuery}&quot;</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="rounded-xl border-slate-200 bg-white shadow-sm hover:bg-blue-50 hover:text-blue-600 transition-all gap-2 h-11 px-4"
              >
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span className="font-bold text-xs">PDF</span>
              </Button>
            </div>

            {/* Machinery / PI Info Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                  <Cpu className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-800">Machinery Info</h3>
                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 ml-auto">{machineryRows.length}</Badge>
              </div>

              {isLoadingMachinery ? (
                <div className="bg-white rounded-3xl p-8 flex flex-col items-center justify-center border border-slate-100 shadow-sm border-dashed">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-xs font-semibold text-slate-400 mt-4 uppercase tracking-widest">Scanning Firestore...</p>
                </div>
              ) : machineryRows.length > 0 ? (
                <div className="space-y-4">
                  {machineryRows.slice(0, machineryLimit).map((row, idx) => (
                    <Card key={`${row.lcId}-${idx}`} className="border-none shadow-[0_12px_24px_-8px_rgba(0,0,0,0.06),0_2px_4px_-1px_rgba(0,0,0,0.04)] rounded-[2rem] overflow-hidden group active:scale-[0.98] transition-all bg-white">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1">
                            <h4 className="text-lg font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">{row.model}</h4>
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Building className="h-3.5 w-3.5" />
                              <span className="text-[11px] font-bold uppercase tracking-tight">{row.applicantName}</span>
                            </div>
                          </div>
                          <Link href={`/mobile/total-lc/${row.lcId}`}>
                            <Button size="icon" variant="ghost" className="rounded-full bg-slate-50 text-slate-400">
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </Link>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 mb-4">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Qty</span>
                            <div className="text-sm font-bold text-slate-800">{row.qty || '—'} Units</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Price</span>
                            <div className="text-sm font-bold text-emerald-600">{formatCurrency(row.totalPrice)}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">L/C No</span>
                            <div className="text-sm font-bold text-slate-800 truncate">{row.lcNo}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Year</span>
                            <div className="text-sm font-bold text-slate-800">{row.year || '—'}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {row.finalPIUrl && (
                            <a href={row.finalPIUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                              <Button className="w-full h-11 rounded-xl bg-[#0a1e60] hover:bg-[#0a1e60]/90 font-bold gap-2 text-xs">
                                <FileText className="h-4 w-4" /> Final PI
                              </Button>
                            </a>
                          )}
                          <Button 
                            variant="outline" 
                            className="flex-1 h-11 rounded-xl font-bold gap-2 text-xs border-slate-200"
                            onClick={() => copyToClipboard(row.lcNo)}
                          >
                            <Copy className="h-4 w-4" /> Copy LC
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {machineryRows.length > machineryLimit && (
                    <Button 
                      onClick={() => setMachineryLimit(prev => prev + 10)}
                      variant="ghost" 
                      className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 font-bold hover:bg-white transition-all"
                    >
                      Load More Items ({machineryRows.length - machineryLimit} left)
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic px-1">No machinery items found.</p>
              )}
            </section>

            {/* L/C Results Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="p-1.5 rounded-lg bg-purple-100 text-purple-600">
                  <Hash className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-800">L/C Records</h3>
                <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-purple-100 ml-auto">{lcResults.length}</Badge>
              </div>

              {isLoadingLcSearch ? (
                <div className="h-12 w-full animate-pulse bg-slate-100 rounded-2xl" />
              ) : lcResults.length > 0 ? (
                <div className="space-y-3">
                  {lcResults.slice(0, lcLimit).map(lc => (
                    <Link key={lc.id} href={`/mobile/total-lc/${lc.id}`}>
                      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group active:bg-slate-50 transition-colors">
                        <div className="space-y-1">
                          <p className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600">{lc.documentaryCreditNumber}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{lc.applicantName}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300" />
                      </div>
                    </Link>
                  ))}
                  {lcResults.length > lcLimit && (
                    <Button 
                      onClick={() => setLcLimit(prev => prev + 10)}
                      variant="ghost" 
                      className="w-full h-12 rounded-xl border-2 border-dashed border-slate-100 text-slate-400 font-bold hover:bg-white transition-all text-[10px] uppercase tracking-widest"
                    >
                      Load More Records
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic px-1">No exact L/C matches.</p>
              )}
            </section>

            {/* Applicants Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-800">Applicants</h3>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-100 ml-auto">{applicantResults.length}</Badge>
              </div>

              {isLoadingApplicantSearch ? (
                <div className="h-12 w-full animate-pulse bg-slate-100 rounded-2xl" />
              ) : applicantResults.length > 0 ? (
                <div className="space-y-3">
                  {applicantResults.slice(0, applicantLimit).map(app => (
                    <div key={app.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                        <Building className="h-5 w-5" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-extrabold text-slate-900 truncate">{app.applicantName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{app.address?.split(',')[0]}</p>
                      </div>
                    </div>
                  ))}
                  {applicantResults.length > applicantLimit && (
                    <Button 
                      onClick={() => setApplicantLimit(prev => prev + 10)}
                      variant="ghost" 
                      className="w-full h-12 rounded-xl border-2 border-dashed border-slate-100 text-slate-400 font-bold hover:bg-white transition-all text-[10px] uppercase tracking-widest"
                    >
                      Load More Customers
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic px-1">No customers found.</p>
              )}
            </section>

          </div>
        )}
      </div></div>

      {/* Action Tab Bottom (Optional/Space Filler) */}
      <div className="shrink-0 h-[env(safe-area-inset-bottom)] bg-white" />
    </div>
  );
}

export default function MobileSearchPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Initializing Search...</p>
      </div>
    }>
      <MobileSearchContent />
    </Suspense>
  );
}

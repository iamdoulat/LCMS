

"use client";

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LCEntryDocument, Currency, CompanyProfile } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { collection, getDocs, query, where, doc, documentId, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Swal from 'sweetalert2';

const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const FINANCIAL_SETTINGS_DOC_ID = 'main_settings';
const DEFAULT_COMPANY_NAME = 'SMART SOLUTION PTE LTD';
const DEFAULT_COMPANY_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/Pte%20logo.png?alt=media&token=0f5d579c-c398-41b8-b8a1-048b63aa38bd';
const DEFAULT_ADDRESS = '236A Serangoon Road, #02-236A, Singapore 218084,Tel: +6593218129, Reg. No. 201610840K ';

const formatDisplayDate = (dateString?: string) => {
  if (!dateString || !isValid(parseISO(dateString))) return 'N/A';
  try {
    const date = parseISO(dateString);
    return format(date, 'MM/dd/yy');
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (currency?: Currency | string, amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currency || ''} N/A`;
  return `${currency || ''} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function PrintPageContent() {
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<LCEntryDocument[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const router = useRouter();

  const fetchCompanyProfile = useCallback(async () => {
    try {
      const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, FINANCIAL_SETTINGS_DOC_ID);
      const profileDocSnap = await getDoc(profileDocRef);
      if (profileDocSnap.exists()) {
        setCompanyProfile(profileDocSnap.data() as CompanyProfile);
      } else {
        setCompanyProfile({ companyName: DEFAULT_COMPANY_NAME, invoiceLogoUrl: DEFAULT_COMPANY_LOGO_URL, address: DEFAULT_ADDRESS });
      }
    } catch (e) {
      console.error("Error fetching company profile for print:", e);
      setCompanyProfile({ companyName: DEFAULT_COMPANY_NAME, invoiceLogoUrl: DEFAULT_COMPANY_LOGO_URL, address: DEFAULT_ADDRESS });
    }
  }, []);

  useEffect(() => {
    const fetchReportsForPrint = async () => {
      setIsLoading(true);
      await fetchCompanyProfile();

      const idsParam = searchParams.get('ids');
      if (!idsParam) {
        setIsLoading(false);
        return;
      }
      
      const reportIds = idsParam.split(',');
      const statusLabel = searchParams.get('statusLabel') || 'All';
      setFilterStatus(statusLabel);
      
      const fetchedReports: LCEntryDocument[] = [];
      const BATCH_SIZE = 30; // Firestore 'in' query has a limit of 30

      try {
        for (let i = 0; i < reportIds.length; i += BATCH_SIZE) {
          const batchIds = reportIds.slice(i, i + BATCH_SIZE);
          if (batchIds.length > 0) {
            const q = query(collection(firestore, "lc_entries"), where(documentId(), "in", batchIds));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
              fetchedReports.push({ id: doc.id, ...doc.data() } as LCEntryDocument);
            });
          }
        }
        
        // Ensure the order matches the original list
        const orderedReports = reportIds.map(id => fetchedReports.find(report => report.id === id)).filter(Boolean) as LCEntryDocument[];
        setReports(orderedReports);

      } catch (error) {
        console.error("Error fetching reports for printing:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReportsForPrint();
  }, [searchParams, fetchCompanyProfile]);

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (!isLoading && reports.length > 0) {
      const timer = setTimeout(() => handlePrint(), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, reports]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-gray-600">Generating report...</p>
      </div>
    );
  }

  const displayCompanyName = companyProfile?.companyName || DEFAULT_COMPANY_NAME;
  const displayCompanyAddress = companyProfile?.address || DEFAULT_ADDRESS;

  return (
    <div className="print-container bg-white p-8 font-sans">
      <header className="flex flex-col items-center mb-4 print-header">
        <div className="text-center w-full">
            <h1 className="text-xl font-bold">{displayCompanyName}</h1>
            <p className="text-xs text-gray-600 whitespace-pre-line">{displayCompanyAddress}</p>
        </div>
      </header>
      <hr className="my-4" />
      <h2 className="text-center text-xl font-bold mb-6">
        Report of: {filterStatus} L/Cs
      </h2>

      <div className="space-y-4">
        {reports.length > 0 ? (
          reports.map(lc => (
            <Card key={lc.id} className="shadow-none border border-gray-300 break-inside-avoid">
              <CardHeader className="bg-blue-500/10 p-3">
                  <div className="grid grid-cols-3 gap-x-4">
                      <div>
                          <p className="text-sm font-semibold text-gray-800">L/C or TT No.</p>
                          <p className="text-sm text-gray-800">{lc.documentaryCreditNumber || 'N/A'}</p>
                      </div>
                      <div>
                          <p className="text-sm font-semibold text-gray-800">Beneficiary</p>
                          <p className="text-sm text-gray-600 truncate" title={lc.beneficiaryName || 'N/A'}>{lc.beneficiaryName || 'N/A'}</p>
                      </div>
                      <div>
                          <p className="text-sm font-semibold text-gray-800">Terms of Pay* :</p>
                          <p className="text-sm text-gray-600">{lc.termsOfPay || 'N/A'}</p>
                      </div>
                  </div>
              </CardHeader>
              <CardContent className="p-3">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="align-top">
                      <td className="py-1 pr-2 w-1/3">
                        <p className="font-semibold">Customer Name</p>
                        <p className="text-gray-600">{lc.applicantName || 'N/A'}</p>
                      </td>
                      <td className="py-1 px-2 w-1/3">
                          <p className="font-semibold">Value</p>
                          <p className="text-gray-600">{formatCurrencyValue(lc.currency, lc.amount)}</p>
                      </td>
                      <td className="py-1 pl-2 w-1/3">
                          <p className="font-semibold">Invoice No:</p>
                          <p className="text-gray-600">{lc.proformaInvoiceNumber || 'N/A'}</p>
                      </td>
                    </tr>
                    <tr className="align-top">
                      <td className="py-1 pr-2">
                        <p className="font-semibold">Shipment Date</p>
                        <p className="text-gray-600">ETD: {formatDisplayDate(lc.etd)}</p>
                        <p className="text-gray-600">ETA: {formatDisplayDate(lc.eta)}</p>
                      </td>
                      <td className="py-1 px-2">
                          <p className="font-semibold">Machine Qty:</p>
                          <p className="text-gray-600">{lc.totalMachineQty || 'N/A'}</p>
                      </td>
                      <td className="py-1 pl-2">
                          <p className="font-semibold">Shipment Note</p>
                          <p className="text-xs text-gray-600"><span className="font-semibold">1st:</span> {lc.firstShipmentNote || 'N/A'}</p>
                          <p className="text-xs text-gray-600"><span className="font-semibold">2nd:</span> {lc.secondShipmentNote || 'N/A'}</p>
                          <p className="text-xs text-gray-600"><span className="font-semibold">3rd:</span> {lc.thirdShipmentNote || 'N/A'}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-500">No reports to display.</p>
          </div>
        )}
      </div>

       <div className="text-center mt-8 noprint flex justify-center gap-4">
         <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            PDF View
         </Button>
         <Button onClick={() => router.back()}>Close Preview</Button>
       </div>
    </div>
  );
}

export default function PrintReportsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
            <PrintPageContent />
        </Suspense>
    )
}

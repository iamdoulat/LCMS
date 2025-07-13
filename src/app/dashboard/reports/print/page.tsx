
"use client";

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { LCEntryDocument, LCStatus, Currency, CompanyProfile } from '@/types';
import { format, parseISO, isValid, startOfDay, isAfter, isEqual } from 'date-fns';
import { collection, getDocs, query, orderBy, where, doc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const COMPANY_PROFILE_COLLECTION = 'financial_settings';
const COMPANY_PROFILE_DOC_ID = 'main_settings';
const DEFAULT_COMPANY_NAME = 'Your Company';
const DEFAULT_COMPANY_LOGO_URL = 'https://placehold.co/150x50.png';

const formatDisplayDate = (dateString?: string) => {
  if (!dateString || !isValid(parseISO(dateString))) return 'N/A';
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM do, yyyy');
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

  const fetchCompanyProfile = useCallback(async () => {
    try {
      const profileDocRef = doc(firestore, COMPANY_PROFILE_COLLECTION, COMPANY_PROFILE_DOC_ID);
      const profileDocSnap = await getDoc(profileDocRef);
      if (profileDocSnap.exists()) {
        setCompanyProfile(profileDocSnap.data() as CompanyProfile);
      } else {
        setCompanyProfile({ companyName: DEFAULT_COMPANY_NAME, invoiceLogoUrl: DEFAULT_COMPANY_LOGO_URL });
      }
    } catch (e) {
      console.error("Error fetching company profile for print:", e);
      setCompanyProfile({ companyName: DEFAULT_COMPANY_NAME, invoiceLogoUrl: DEFAULT_COMPANY_LOGO_URL });
    }
  }, []);

  useEffect(() => {
    const fetchReportsForPrint = async () => {
      setIsLoading(true);
      
      const lcNo = searchParams.get('lcNo');
      const applicantId = searchParams.get('applicantId');
      const beneficiaryId = searchParams.get('beneficiaryId');
      const shipmentDate = searchParams.get('shipmentDate');
      const status = searchParams.get('status') as LCStatus | null;
      const year = searchParams.get('year');
      const sortBy = searchParams.get('sortBy') || 'lcIssueDate';
      const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

      setFilterStatus(status || 'All');

      let q = query(collection(firestore, "lc_entries"), orderBy(sortBy, sortOrder));

      if (lcNo) q = query(q, where('documentaryCreditNumber', '>=', lcNo), where('documentaryCreditNumber', '<=', lcNo + '\uf8ff'));
      if (applicantId) q = query(q, where('applicantId', '==', applicantId));
      if (beneficiaryId) q = query(q, where('beneficiaryId', '==', beneficiaryId));
      if (status) q = query(q, where('status', 'array-contains', status));
      if (year && year !== 'All Years') q = query(q, where('year', '==', parseInt(year)));
      if (shipmentDate) q = query(q, where('latestShipmentDate', '>=', shipmentDate));

      try {
        await fetchCompanyProfile();
        const querySnapshot = await getDocs(q);
        const fetchedReports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LCEntryDocument));
        setReports(fetchedReports);
      } catch (error) {
        console.error("Error fetching reports for printing:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReportsForPrint();
  }, [searchParams, fetchCompanyProfile]);

  useEffect(() => {
    if (!isLoading && reports.length > 0) {
      setTimeout(() => window.print(), 500); // Delay to allow rendering
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
  const displayCompanyLogo = companyProfile?.invoiceLogoUrl || companyProfile?.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL;
  const displayCompanyAddress = companyProfile?.address || 'Default Address';

  return (
    <div className="bg-white p-8">
      <header className="flex justify-between items-center mb-6">
        <div>
          {displayCompanyLogo && (
            <Image
              src={displayCompanyLogo}
              alt={`${displayCompanyName} Logo`}
              width={150}
              height={50}
              className="object-contain"
              data-ai-hint="company logo"
            />
          )}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold">{displayCompanyName}</h1>
          <p className="text-xs">{displayCompanyAddress}</p>
        </div>
      </header>
      <hr className="my-4" />
      <h2 className="text-center text-xl font-bold mb-4">
        Report of: {filterStatus} L/Cs
      </h2>

      <div className="grid grid-cols-1 gap-6">
        {reports.map(lc => (
          <Card key={lc.id} className="shadow-none border border-gray-300 break-inside-avoid">
            <CardHeader className="bg-gray-100 p-3">
              <div className="grid grid-cols-3 gap-x-4">
                <div className="text-left">
                  <p className="font-semibold text-gray-800">L/C or TT No.</p>
                  <p className="text-gray-800 text-lg">{lc.documentaryCreditNumber || 'N/A'}</p>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Beneficiary</p>
                  <p className="text-gray-600 truncate" title={lc.beneficiaryName || 'N/A'}>{lc.beneficiaryName || 'N/A'}</p>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Terms of Pay* :</p>
                  <p className="text-gray-600">{lc.termsOfPay || 'N/A'}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-2 align-top">
                      <p className="font-semibold">Customer Name</p>
                      <p className="text-gray-600">{lc.applicantName || 'N/A'}</p>
                    </td>
                    <td className="py-2 px-2 align-top">
                      <p className="font-semibold">Value</p>
                      <p className="text-gray-600">{formatCurrencyValue(lc.currency, lc.amount)}</p>
                    </td>
                    <td className="py-2 pl-2 align-top">
                      <p className="font-semibold">Invoice No:</p>
                      <p className="text-gray-600">{lc.proformaInvoiceNumber || 'N/A'}</p>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-2 align-top">
                      <p className="font-semibold">Shipment Date</p>
                      <p className="text-gray-600"><span className="font-semibold text-gray-800">ETD:</span> {formatDisplayDate(lc.etd)}</p>
                      <p className="text-gray-600"><span className="font-semibold text-gray-800">ETA:</span> {formatDisplayDate(lc.eta)}</p>
                    </td>
                    <td className="py-2 px-2 align-top">
                      <p className="font-semibold">Machine Qty:</p>
                      <p className="text-gray-600">{lc.totalMachineQty || 'N/A'}</p>
                    </td>
                    <td className="py-2 pl-2 align-top">
                      <p className="font-semibold">Shipment Note</p>
                      <p className="text-xs text-gray-600 truncate" title={lc.firstShipmentNote}>
                        <span className="font-semibold text-gray-800">1st:</span> {lc.firstShipmentNote || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-600 truncate" title={lc.secondShipmentNote}>
                        <span className="font-semibold text-gray-800">2nd:</span> {lc.secondShipmentNote || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-600 truncate" title={lc.thirdShipmentNote}>
                        <span className="font-semibold text-gray-800">3rd:</span> {lc.thirdShipmentNote || 'N/A'}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>
       <div className="text-center mt-8 noprint">
         <Button onClick={() => window.close()}>Close Preview</Button>
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


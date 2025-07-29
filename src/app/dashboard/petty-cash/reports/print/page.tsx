
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import type { PettyCashTransactionDocument } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import Image from 'next/image';

const DEFAULT_COMPANY_NAME = 'Your Company Name';
const DEFAULT_COMPANY_LOGO_URL = 'https://placehold.co/400x100.png';

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrencyValue = (amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `BDT N/A`;
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface ReportData {
  transactions: PettyCashTransactionDocument[];
  filters: {
    account: string;
    category: string;
    type: string;
    payee: string;
    dateFrom: string;
    dateTo: string;
  };
  totals: {
    totalDebits: number;
    totalCredits: number;
  };
}

export default function PrintPettyCashReportPage() {
  const router = useRouter();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [companySettings, setCompanySettings] = useState<{ companyName: string; invoiceLogoUrl: string; address?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const dataString = localStorage.getItem('pettyCashReportData');
    if (dataString) {
      try {
        const parsedData: ReportData = JSON.parse(dataString);
        setReportData(parsedData);
      } catch (e) {
        console.error("Error parsing report data from localStorage", e);
      }
    }
    const companyName = localStorage.getItem('appCompanyName') || DEFAULT_COMPANY_NAME;
    const invoiceLogoUrl = localStorage.getItem('appInvoiceLogoUrl') || DEFAULT_COMPANY_LOGO_URL;
    // Assuming address might also be in localStorage or you can fetch it. For now, it's optional.
    setCompanySettings({ companyName, invoiceLogoUrl, address: 'Your Company Address Here' });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading && reportData) {
      setTimeout(() => window.print(), 500);
    }
  }, [isLoading, reportData]);


  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-gray-600">Generating Report...</p>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600 font-semibold">Error Generating Report</p>
        <p className="text-gray-700 text-sm mb-4">No report data found. Please generate the report again.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const { transactions, filters, totals } = reportData;
  const { companyName, invoiceLogoUrl, address } = companySettings || {};

  return (
    <div className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto', padding: '0' }}>
      <div className="p-4 flex flex-col flex-grow">
        <header className="flex justify-between items-center mb-4 print-header">
            <div>
                {invoiceLogoUrl && <Image src={invoiceLogoUrl} alt="Company Logo" width={200} height={50} className="object-contain" data-ai-hint="company logo"/>}
                <h1 className="text-xl font-bold">{companyName}</h1>
                {address && <p className="text-xs">{address}</p>}
            </div>
            <div className="text-right">
                <h2 className="text-2xl font-bold uppercase">Petty Cash Report</h2>
                <p className="text-sm">Date: {format(new Date(), 'dd/MM/yyyy')}</p>
            </div>
        </header>
        
        <div className="mb-4 p-2 border rounded-md text-xs">
            <h3 className="font-semibold text-gray-700 mb-1 uppercase">Report Filters</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                <p><strong>Date Range:</strong> {filters.dateFrom} to {filters.dateTo}</p>
                <p><strong>Account:</strong> {filters.account}</p>
                <p><strong>Category:</strong> {filters.category}</p>
                <p><strong>Type:</strong> {filters.type}</p>
                <p><strong>Payee/Payer:</strong> {filters.payee}</p>
            </div>
        </div>
        
        <div className="flex-grow">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Payee/Payer</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {transactions.map(tx => (
                        <TableRow key={tx.id}>
                            <TableCell className="text-xs">{formatDisplayDate(tx.transactionDate)}</TableCell>
                            <TableCell className="text-xs">{tx.payeeName}</TableCell>
                            <TableCell className="text-xs">{tx.categoryNames?.join(', ')}</TableCell>
                            <TableCell className="text-xs">{tx.accountNames?.join(', ')}</TableCell>
                            <TableCell className="text-right text-xs">{tx.type === 'Debit' ? formatCurrencyValue(tx.amount) : '-'}</TableCell>
                            <TableCell className="text-right text-xs">{tx.type === 'Credit' ? formatCurrencyValue(tx.amount) : '-'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableRow className="bg-gray-100 font-bold">
                    <TableCell colSpan={4} className="text-right">Totals:</TableCell>
                    <TableCell className="text-right">{formatCurrencyValue(totals.totalDebits)}</TableCell>
                    <TableCell className="text-right">{formatCurrencyValue(totals.totalCredits)}</TableCell>
                </TableRow>
                <TableRow className="bg-gray-200 font-bold text-lg">
                    <TableCell colSpan={4} className="text-right">Net Flow:</TableCell>
                    <TableCell colSpan={2} className="text-center">{formatCurrencyValue(totals.totalCredits - totals.totalDebits)}</TableCell>
                </TableRow>
            </Table>
        </div>
      </div>
       <footer className="print-footer pb-4 px-4 mt-auto">
        <section className="flex justify-between items-end mb-2 pt-16">
          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Prepared By</p>
          </div>
          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Checked By</p>
          </div>
          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Authorized Signature</p>
          </div>
        </section>
      </footer>

      <div className="print-only-utility-buttons mt-8 text-center noprint">
        <Button onClick={() => window.print()} variant="default" className="bg-blue-600 hover:bg-blue-700">
          <Printer className="mr-2 h-4 w-4" /> Print Report
        </Button>
        <Button onClick={() => router.back()} variant="outline" className="ml-2">
          Close
        </Button>
      </div>
    </div>
  );
}


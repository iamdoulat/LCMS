

"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { QuoteDocument, CustomerDocument } from '@/types';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';
import QRCode from "react-qr-code";

const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const FINANCIAL_SETTINGS_DOC_ID = 'main_settings';
const DEFAULT_FINANCIAL_COMPANY_NAME = 'Your Company Name';
const DEFAULT_FINANCIAL_ADDRESS = 'Your Company Address';
const DEFAULT_FINANCIAL_EMAIL = 'your@email.com';
const DEFAULT_FINANCIAL_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";

interface FinancialSettingsProfile {
  companyName?: string;
  address?: string;
  emailId?: string;
  cellNumber?: string;
  invoiceLogoUrl?: string;
  hideCompanyName?: boolean;
}

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrency = (amount?: number, currency: string = 'USD') => {
  if (typeof amount !== 'number' || isNaN(amount)) return `N/A`;
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PrintQuotePage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.quoteId as string;

  const [quoteData, setQuoteData] = React.useState<QuoteDocument | null>(null);
  const [customerData, setCustomerData] = React.useState<CustomerDocument | null>(null);
  const [financialSettings, setFinancialSettings] = React.useState<FinancialSettingsProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [qrCodeValue, setQrCodeValue] = React.useState('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setQrCodeValue(window.location.href);
    }
  }, []);

  const fetchFinancialSettings = useCallback(async () => {
    try {
      const settingsDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, FINANCIAL_SETTINGS_DOC_ID);
      const settingsDocSnap = await getDoc(settingsDocRef);
      if (settingsDocSnap.exists()) {
        setFinancialSettings(settingsDocSnap.data() as FinancialSettingsProfile);
      } else {
        setFinancialSettings({
          companyName: DEFAULT_FINANCIAL_COMPANY_NAME,
          address: DEFAULT_FINANCIAL_ADDRESS,
          emailId: DEFAULT_FINANCIAL_EMAIL,
          invoiceLogoUrl: DEFAULT_FINANCIAL_LOGO_URL,
        });
      }
    } catch (e) {
      console.error("Error fetching financial settings for print:", e);
      setFinancialSettings({
          companyName: DEFAULT_FINANCIAL_COMPANY_NAME,
          address: DEFAULT_FINANCIAL_ADDRESS,
          emailId: DEFAULT_FINANCIAL_EMAIL,
          invoiceLogoUrl: DEFAULT_FINANCIAL_LOGO_URL,
      });
    }
  }, []);

  const fetchQuoteData = useCallback(async () => {
    if (!quoteId) {
      setError("No Quote ID provided.");
      return;
    }
    try {
      const quoteDocRef = doc(firestore, "quotes", quoteId);
      const quoteDocSnap = await getDoc(quoteDocRef);

      if (quoteDocSnap.exists()) {
        const quote = { id: quoteDocSnap.id, ...quoteDocSnap.data() } as QuoteDocument;
        setQuoteData(quote);

        if (quote.customerId) {
          const customerDocRef = doc(firestore, "customers", quote.customerId);
          const customerDocSnap = await getDoc(customerDocRef);
          if (customerDocSnap.exists()) {
            setCustomerData({ id: customerDocSnap.id, ...customerDocSnap.data() } as CustomerDocument);
          }
        }
      } else {
        setError("Quote record not found.");
      }
    } catch (err: any) {
      setError(`Failed to fetch quote data: ${err.message}`);
    }
  }, [quoteId]);

  useEffect(() => {
    const loadAllData = async () => {
        setIsLoading(true);
        await Promise.all([fetchFinancialSettings(), fetchQuoteData()]);
        setIsLoading(false);
    }
    loadAllData();
  }, [fetchFinancialSettings, fetchQuoteData]);

   useEffect(() => {
    if (!isLoading && quoteData && financialSettings) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, quoteData, financialSettings]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-gray-600">Loading quote...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600 font-semibold">Error loading quote</p>
        <p className="text-gray-700 text-sm mb-4">{error}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!quoteData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
        <p className="text-gray-700">Quote data could not be loaded.</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const displayCompanyName = financialSettings?.companyName || DEFAULT_FINANCIAL_COMPANY_NAME;
  const displayCompanyLogo = financialSettings?.invoiceLogoUrl || DEFAULT_FINANCIAL_LOGO_URL;
  const displayCompanyAddress = financialSettings?.address || DEFAULT_FINANCIAL_ADDRESS;
  const displayCompanyEmail = financialSettings?.emailId || DEFAULT_FINANCIAL_EMAIL;
  const displayCompanyPhone = financialSettings?.cellNumber || 'N/A';
  const hideCompanyName = financialSettings?.hideCompanyName ?? false;
  
  const showItemCodeColumn = quoteData.showItemCodeColumn ?? false;
  const showDiscountColumn = quoteData.showDiscountColumn ?? false;
  const showTaxColumn = quoteData.showTaxColumn ?? false;

  return (
    <div className="print-layout">
        <div className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col" style={{ width: '210mm', minHeight: '297mm', margin: 'auto' }}>
           <header className="grid grid-cols-12 items-start p-8">
                <div className="col-span-5 pr-4">
                {displayCompanyLogo && (
                    <Image
                    src={displayCompanyLogo}
                    alt={`${displayCompanyName} Logo`}
                    width={298}
                    height={150}
                    className="object-contain mb-2"
                    priority
                    data-ai-hint="company logo"
                    />
                )}
                {!hideCompanyName && (
                    <h1 className="text-xl font-bold text-gray-900">{displayCompanyName}</h1>
                )}
                <p className="text-xs text-gray-600 whitespace-pre-line">{displayCompanyAddress}</p>
                <div className="text-xs text-gray-600">
                    {displayCompanyEmail && <span>Email: {displayCompanyEmail}</span>}
                    {displayCompanyPhone && <span className="ml-2">Phone: {displayCompanyPhone}</span>}
                </div>
                </div>
                 <div className="col-span-2 flex justify-center pt-2">
                    {qrCodeValue && (
                        <div style={{ height: "auto", margin: "0 auto", maxWidth: 80, width: "100%" }}>
                            <QRCode
                                size={256}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                value={qrCodeValue}
                                viewBox={`0 0 256 256`}
                                data-ai-hint="qr code"
                            />
                        </div>
                    )}
                </div>
                <div className="col-span-5 text-right">
                <h2 className="text-3xl font-bold text-gray-800 uppercase tracking-wider">Quotation</h2>
                <div className="mt-2 text-sm">
                    <p><strong className="text-gray-600">Quote Number:</strong> {quoteData.id}</p>
                    <p><strong className="text-gray-600">Date:</strong> {formatDisplayDate(quoteData.quoteDate)}</p>
                    {quoteData.salesperson && <p><strong className="text-gray-600">Sales Person:</strong> {quoteData.salesperson}</p>}
                </div>
                </div>
            </header>

            <main className="flex-grow px-8">
                <div className="grid grid-cols-2 gap-4 my-6">
                    <div className="border p-3 rounded-md text-sm">
                        <h3 className="font-semibold text-gray-700 mb-1 uppercase">Bill To:</h3>
                        <p className="font-medium text-gray-900">{quoteData.customerName || 'N/A'}</p>
                        <p className="text-gray-600 whitespace-pre-line">{quoteData.billingAddress || customerData?.address || 'N/A'}</p>
                        {customerData?.binNo && <p className="text-gray-600">BIN: {customerData.binNo}</p>}
                    </div>
                    <div className="border p-3 rounded-md text-sm">
                        <h3 className="font-semibold text-gray-700 mb-1 uppercase">Deliver To:</h3>
                        <p className="text-gray-600 whitespace-pre-line">{quoteData.shippingAddress || quoteData.billingAddress || customerData?.address || 'N/A'}</p>
                    </div>
                </div>

                {quoteData.subject && (
                <div className="my-4">
                <p className="text-sm font-normal p-2 border rounded-md text-center">{quoteData.subject}</p>
                </div>
            )}
        
            <section className="mt-6">
                <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                    <tr>
                    <th className="p-2 border font-semibold text-left">#</th>
                    <th className="p-2 border font-semibold text-left">Item Description</th>
                    {showItemCodeColumn && <th className="p-2 border font-semibold text-left">Item Code</th>}
                    <th className="p-2 border font-semibold text-center">Qty</th>
                    <th className="p-2 border font-semibold text-right">Unit Price</th>
                    {showDiscountColumn && <th className="p-2 border font-semibold text-right">Discount</th>}
                    {showTaxColumn && <th className="p-2 border font-semibold text-right">Tax</th>}
                    <th className="p-2 border font-semibold text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {quoteData.lineItems.map((item, index) => (
                    <tr key={`${item.itemId}-${index}`} className="border-b">
                        <td className="p-2 border text-center align-top">{index + 1}</td>
                        <td className="p-2 border align-top">
                        <p className="font-medium text-gray-900">{item.itemName}</p>
                        {item.description && item.description !== item.itemName && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{item.description}</p>}
                        </td>
                        {showItemCodeColumn && <td className="p-2 border align-top">{item.itemCode || 'N/A'}</td>}
                        <td className="p-2 border text-center align-top">{item.qty}</td>
                        <td className="p-2 border text-right align-top">{formatCurrency(item.unitPrice)}</td>
                        {showDiscountColumn && <td className="p-2 border text-right align-top">{item.discountPercentage?.toFixed(2) || '0.00'}%</td>}
                        {showTaxColumn && <td className="p-2 border text-right align-top">{item.taxPercentage?.toFixed(2) || '0.00'}%</td>}
                        <td className="p-2 border text-right font-medium align-top">{formatCurrency(item.total)}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </section>
            
            </main>
             <footer className="px-8 py-4 mt-auto">
                <div className="flex justify-between items-end">
                    <div className="w-2/3 pr-4 text-xs">
                        {quoteData.comments && (
                        <div className="space-y-1">
                            <h4 className="font-bold text-gray-800 uppercase tracking-wide">TERMS AND CONDITIONS:</h4>
                            <div className="text-gray-600 whitespace-pre-line">{quoteData.comments}</div>
                        </div>
                        )}
                    </div>
                    <div className="w-1/3 text-sm space-y-1">
                        <div className="flex justify-between"><span className="text-gray-600 font-medium">Subtotal:</span><span className="text-gray-800">{formatCurrency(quoteData.subtotal)}</span></div>
                        {showDiscountColumn && (
                            <div className="flex justify-between"><span className="text-gray-600 font-medium">Total Discount:</span><span className="text-gray-800">(-) {formatCurrency(quoteData.totalDiscountAmount)}</span></div>
                        )}
                        {showTaxColumn && (
                            <div className="flex justify-between"><span className="text-gray-600 font-medium">Total Tax ({quoteData.taxType}):</span><span className="text-gray-800">(+) {formatCurrency(quoteData.totalTaxAmount)}</span></div>
                        )}
                        <Separator className="my-2 border-gray-400" />
                        <div className="flex justify-between text-base font-bold"><span className="text-gray-900">Grand Total (USD):</span><span className="text-gray-900">{formatCurrency(quoteData.totalAmount)}</span></div>
                    </div>
                </div>
            </footer>
        </div>

      <div className="print-only-utility-buttons mt-8 text-center noprint">
        <Button onClick={() => window.print()} variant="default" className="bg-blue-600 hover:bg-blue-700">
          <Printer className="mr-2 h-4 w-4" /> Print Quote
        </Button>
        <Button onClick={() => router.back()} variant="outline" className="ml-2">
          Close
        </Button>
      </div>
    </div>
  );
}

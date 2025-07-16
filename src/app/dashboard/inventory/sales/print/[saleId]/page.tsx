
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { SaleDocument, CustomerDocument, CompanyProfile } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';

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

export default function PrintSaleInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params.saleId as string;

  const [saleData, setSaleData] = useState<SaleDocument | null>(null);
  const [customerData, setCustomerData] = useState<CustomerDocument | null>(null);
  const [financialSettings, setFinancialSettings] = React.useState<FinancialSettingsProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchSaleAndCustomerData = useCallback(async () => {
    if (!saleId) {
      setError("No Sale ID provided.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const saleDocRef = doc(firestore, "sales", saleId);
      const saleDocSnap = await getDoc(saleDocRef);

      if (saleDocSnap.exists()) {
        const sale = { id: saleDocSnap.id, ...saleDocSnap.data() } as SaleDocument;
        setSaleData(sale);

        if (sale.customerId) {
          const customerDocRef = doc(firestore, "customers", sale.customerId);
          const customerDocSnap = await getDoc(customerDocRef);
          if (customerDocSnap.exists()) {
            setCustomerData({ id: customerDocSnap.id, ...customerDocSnap.data() } as CustomerDocument);
          } else {
            console.warn(`Customer with ID ${sale.customerId} not found.`);
          }
        }
      } else {
        setError("Sale record not found.");
      }
    } catch (err: any) {
      setError(`Failed to fetch sale data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    const loadAllData = async () => {
        setIsLoading(true);
        await Promise.all([fetchFinancialSettings(), fetchSaleAndCustomerData()]);
        setIsLoading(false);
    }
    loadAllData();
  }, [fetchFinancialSettings, fetchSaleAndCustomerData]);

  useEffect(() => {
    if (!isLoading && saleData) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, saleData]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-600">Loading invoice...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600 font-semibold">Error loading invoice</p>
        <p className="text-gray-700 text-sm mb-4">{error}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!saleData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <p className="text-gray-700">Sale data could not be loaded.</p>
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

  const showItemCodeColumn = saleData.showItemCodeColumn ?? false; 
  const showDiscountColumn = saleData.showDiscountColumn ?? false;
  const showTaxColumn = saleData.showTaxColumn ?? false;

  return (
    <div className="print-layout">
        <div className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col" style={{ width: '210mm', minHeight: '297mm', margin: 'auto' }}>
            <div className="flex-grow p-4 pb-20">
                <header className="flex justify-between items-start mb-4">
                <div className="w-1/2 pr-4">
                    {displayCompanyLogo && (
                    <Image
                        src={displayCompanyLogo}
                        alt={`${displayCompanyName} Logo`}
                        width={200}
                        height={100}
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
                <div className="w-1/2 text-right">
                    <h2 className="text-3xl font-bold text-gray-800 uppercase tracking-wider">INVOICE</h2>
                    <div className="mt-2 text-sm">
                    <p><strong className="text-gray-600">Invoice No:</strong> {saleData.id}</p>
                    <p><strong className="text-gray-600">Date:</strong> {formatDisplayDate(saleData.saleDate)}</p>
                    {saleData.salesperson && <p><strong className="text-gray-600">Sales Person:</strong> {saleData.salesperson}</p>}
                    </div>
                </div>
                </header>

                <div className="grid grid-cols-2 gap-4 my-6">
                    <div className="border p-3 rounded-md text-sm">
                        <h3 className="font-semibold text-gray-700 mb-1 uppercase">Bill To:</h3>
                        <p className="font-medium text-gray-900">{saleData.customerName || 'N/A'}</p>
                        <p className="text-gray-600 whitespace-pre-line">{saleData.billingAddress || customerData?.address || 'N/A'}</p>
                        {customerData?.binNo && <p className="text-gray-600">BIN: {customerData.binNo}</p>}
                    </div>
                    <div className="border p-3 rounded-md text-sm">
                        <h3 className="font-semibold text-gray-700 mb-1 uppercase">Deliver To:</h3>
                        <p className="text-gray-600 whitespace-pre-line">{saleData.shippingAddress || saleData.billingAddress || customerData?.address || 'N/A'}</p>
                    </div>
                </div>

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
                    {saleData.lineItems.map((item, index) => (
                        <tr key={item.itemId || index} className="border-b">
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
            
                <section className="mt-6">
                    <div className="flex justify-between items-start">
                        <div className="w-2/3 pr-4 text-xs">
                            {saleData.comments && (
                            <div className="space-y-1">
                                <h4 className="font-bold text-gray-800 uppercase tracking-wide">Terms and Conditions:</h4>
                                <div className="text-gray-600 whitespace-pre-line">{saleData.comments}</div>
                            </div>
                            )}
                        </div>
                        <div className="w-auto text-sm space-y-1 min-w-[250px]">
                            <div className="flex justify-between"><span className="text-gray-600 font-medium">Subtotal:</span><span className="text-gray-800">{formatCurrency(saleData.subtotal)}</span></div>
                            {showDiscountColumn && (
                                <div className="flex justify-between"><span className="text-gray-600 font-medium">Total Discount:</span><span className="text-gray-800">(-) {formatCurrency(saleData.totalDiscountAmount)}</span></div>
                            )}
                            {showTaxColumn && (
                                <div className="flex justify-between"><span className="text-gray-600 font-medium">Total Tax ({saleData.taxType}):</span><span className="text-gray-800">(+) {formatCurrency(saleData.totalTaxAmount)}</span></div>
                            )}
                            <Separator className="my-2 border-gray-400" />
                            <div className="flex justify-between text-base font-bold"><span className="text-gray-900">Grand Total (USD):</span><span className="text-gray-900">{formatCurrency(saleData.totalAmount)}</span></div>
                        </div>
                    </div>
                </section>
            </div>
        </div>

      <div className="print-only-utility-buttons mt-8 text-center noprint">
        <Button onClick={() => window.print()} variant="default" className="bg-blue-600 hover:bg-blue-700">
          <Printer className="mr-2 h-4 w-4" /> Print Invoice
        </Button>
        <Button onClick={() => router.back()} variant="outline" className="ml-2">
          Close
        </Button>
      </div>
    </div>
  );
}

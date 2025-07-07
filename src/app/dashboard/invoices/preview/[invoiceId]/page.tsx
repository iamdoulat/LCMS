
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { InvoiceDocument, CustomerDocument } from '@/types';
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

const formatCurrency = (amount?: number, currencySymbol: string = 'USD') => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencySymbol} N/A`;
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PrintInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;

  const [invoiceData, setInvoiceData] = React.useState<InvoiceDocument | null>(null);
  const [customerData, setCustomerData] = React.useState<CustomerDocument | null>(null);
  const [financialSettings, setFinancialSettings] = React.useState<FinancialSettingsProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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

  const fetchInvoiceData = useCallback(async () => {
    if (!invoiceId) {
      setError("No Invoice ID provided.");
      return;
    }
    try {
      const invoiceDocRef = doc(firestore, "invoices", invoiceId);
      const invoiceDocSnap = await getDoc(invoiceDocRef);

      if (invoiceDocSnap.exists()) {
        const invoice = { id: invoiceDocSnap.id, ...invoiceDocSnap.data() } as InvoiceDocument;
        setInvoiceData(invoice);

        if (invoice.customerId) {
          const customerDocRef = doc(firestore, "customers", invoice.customerId);
          const customerDocSnap = await getDoc(customerDocRef);
          if (customerDocSnap.exists()) {
            setCustomerData({ id: customerDocSnap.id, ...customerDocSnap.data() } as CustomerDocument);
          }
        }
      } else {
        setError("Invoice record not found.");
      }
    } catch (err: any) {
      setError(`Failed to fetch invoice data: ${err.message}`);
    }
  }, [invoiceId]);

  useEffect(() => {
    const loadAllData = async () => {
        setIsLoading(true);
        await Promise.all([fetchFinancialSettings(), fetchInvoiceData()]);
        setIsLoading(false);
    }
    loadAllData();
  }, [fetchFinancialSettings, fetchInvoiceData]);

   useEffect(() => {
    if (!isLoading && invoiceData && financialSettings) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, invoiceData, financialSettings]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-600">Loading invoice...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600 font-semibold">Error loading invoice</p>
        <p className="text-gray-700 text-sm mb-4">{error}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
        <p className="text-gray-700">Invoice data could not be loaded.</p>
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
  
  const showItemCodeColumn = invoiceData.showItemCodeColumn ?? false; 
  const showDiscountColumn = invoiceData.showDiscountColumn ?? false;
  const showTaxColumn = invoiceData.showTaxColumn ?? false;

  const qrCodeValue = `INVOICE\nInvoice Number: ${invoiceData.id}\nDate: ${formatDisplayDate(invoiceData.invoiceDate)}\nSales Person: ${invoiceData.salesperson || 'N/A'}\nGrand Total: ${formatCurrency(invoiceData.totalAmount, '')}`;

  return (
    <div className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto' }}>
      <div className="flex-grow p-8">
        <div className="flex justify-between items-start mb-4">
          <div className="w-2/3 pr-8">
            {displayCompanyLogo && (
              <Image
                src={displayCompanyLogo}
                alt={`${displayCompanyName} Logo`}
                width={396}
                height={58}
                className="object-contain mb-2"
                priority
                data-ai-hint="company logo"
              />
            )}
            {!hideCompanyName && (
              <h1 className="text-xl font-bold text-gray-900">{displayCompanyName}</h1>
            )}
            <p className="text-xs text-gray-600 whitespace-pre-line">{displayCompanyAddress}</p>
            {displayCompanyEmail && <p className="text-xs text-gray-600">Email: {displayCompanyEmail}</p>}
            {displayCompanyPhone && <p className="text-xs text-gray-600">Phone: {displayCompanyPhone}</p>}
          </div>

          <div className="text-right">
              <h2 className="text-2xl font-bold underline underline-offset-4 tracking-wider mb-2">INVOICE</h2>
              <div className="flex justify-end items-baseline gap-2 text-sm">
                  <span className="font-semibold">Invoice Number :</span>
                  <span>{invoiceData.id}</span>
              </div>
              <div className="flex justify-end items-baseline gap-2 text-sm">
                  <span className="font-semibold">Date :</span>
                  <span>{formatDisplayDate(invoiceData.invoiceDate)}</span>
              </div>
              {invoiceData.salesperson && (
                  <div className="flex justify-end items-baseline gap-2 text-sm">
                      <span className="font-semibold">Sales Person :</span>
                      <span>{invoiceData.salesperson}</span>
                  </div>
              )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase">Bill To:</h3>
              <p className="font-medium text-gray-900">{invoiceData.customerName || 'N/A'}</p>
              <p className="text-gray-600 whitespace-pre-line">{invoiceData.billingAddress || customerData?.address || 'N/A'}</p>
              {(customerData?.tinNo || customerData?.binNo) && (
                <p className="text-gray-600">
                  {customerData?.tinNo && <span>TIN NO: {customerData.tinNo}</span>}
                  {customerData?.tinNo && customerData?.binNo && <span className="mx-2">|</span>}
                  {customerData?.binNo && <span>BIN: {customerData.binNo}</span>}
                </p>
              )}
          </div>
          <div className="border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase tracking-wide">Deliver To:</h3>
              <p className="text-gray-600 whitespace-pre-line">{invoiceData.shippingAddress || invoiceData.billingAddress || customerData?.address || 'N/A'}</p>
          </div>
        </div>

        {invoiceData.subject && (
          <section className="mb-4 p-2 border rounded-md text-center">
            <p className="text-[12px] font-normal">{invoiceData.subject}</p>
          </section>
        )}
        
        <section>
          <table className="w-full text-sm border-collapse table-fixed">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-2 border border-gray-300 text-left font-semibold w-[5%]">#</th>
                <th className="p-2 border border-gray-300 text-left font-semibold">Item Description</th>
                 {showItemCodeColumn && <th className="p-2 border border-gray-300 text-left font-semibold">Item Code</th>}
                <th className="p-2 border border-gray-300 text-center font-semibold w-[10%]">Qty</th>
                <th className="p-2 border border-gray-300 text-right font-semibold w-[15%]">Unit Price (USD)</th>
                {showDiscountColumn && <th className="p-2 border border-gray-300 text-right font-semibold w-[10%]">Discount (%)</th>}
                {showTaxColumn && <th className="p-2 border border-gray-300 text-right font-semibold w-[10%]">Tax (%)</th>}
                <th className="p-2 border border-gray-300 text-right font-semibold w-[15%]">Total (USD)</th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.lineItems.map((item, index) => (
                <tr key={item.itemId || index} className="border-b border-gray-200">
                  <td className="p-2 border border-gray-300 text-center align-top">{index + 1}</td>
                  <td className="p-2 border border-gray-300 align-top break-words">
                    <p className="font-medium text-gray-900">{item.itemName}</p>
                    {item.description && item.description !== item.itemName && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{item.description}</p>}
                  </td>
                  {showItemCodeColumn && <td className="p-2 border border-gray-300 align-top">{item.itemCode || 'N/A'}</td>}
                  <td className="p-2 border border-gray-300 text-center align-top">{item.qty}</td>
                  <td className="p-2 border border-gray-300 text-right align-top">{formatCurrency(item.unitPrice, '')}</td>
                  {showDiscountColumn && <td className="p-2 border border-gray-300 text-right align-top">{item.discountPercentage?.toFixed(2) || '0.00'}%</td>}
                  {showTaxColumn && <td className="p-2 border border-gray-300 text-right align-top">{item.taxPercentage?.toFixed(2) || '0.00'}%</td>}
                  <td className="p-2 border border-gray-300 text-right font-medium align-top">{formatCurrency(item.total, '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="flex justify-between items-start pt-2">
            <div className="w-1/2 pr-4 text-xs">
                {invoiceData.comments && (
                <div className="space-y-1">
                    <h4 className="font-semibold text-gray-700 uppercase tracking-wide">Terms and Conditions:</h4>
                    <div className="text-gray-600 whitespace-pre-line font-bold">{invoiceData.comments}</div>
                </div>
                )}
            </div>
            <div className="w-auto text-sm space-y-1">
                <div className="grid grid-cols-[auto_1fr] gap-x-4">
                    <span className="text-gray-600 font-medium text-right">Subtotal (USD):</span>
                    <span className="text-gray-800 text-right">{formatCurrency(invoiceData.subtotal, '')}</span>
                </div>
                {showDiscountColumn && (
                    <div className="grid grid-cols-[auto_1fr] gap-x-4">
                        <span className="text-gray-600 font-medium text-right">Total Discount:</span>
                        <span className="text-gray-800 text-right">(-) {formatCurrency(invoiceData.totalDiscountAmount, '')}</span>
                    </div>
                )}
                {showTaxColumn && (
                    <div className="grid grid-cols-[auto_1fr] gap-x-4">
                        <span className="text-gray-600 font-medium text-right">Total Tax ({invoiceData.taxType}):</span>
                        <span className="text-gray-800 text-right">(+) {formatCurrency(invoiceData.totalTaxAmount, '')}</span>
                    </div>
                )}
                <Separator className="my-2 border-gray-300" />
                <div className="grid grid-cols-[auto_1fr] gap-x-4 text-base font-bold">
                    <span className="text-gray-900 text-right">Grand Total (USD):</span>
                    <span className="text-blue-600 text-right">{formatCurrency(invoiceData.totalAmount, '')}</span>
                </div>
            </div>
        </div>
      </div>

      <div className="mt-auto pt-2 px-8 pb-2">
        <section className="flex justify-between items-end mb-2">
          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Buyer Signature</p>
          </div>
          
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="p-1 border">
                <QRCode
                    value={qrCodeValue}
                    size={35}
                    bgColor={"#ffffff"}
                    fgColor={"#000000"}
                    level={"L"}
                />
            </div>
            <p className="text-[8px] text-gray-600">Thank you for your business!</p>
          </div>

          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Seller Signature</p>
          </div>
        </section>
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

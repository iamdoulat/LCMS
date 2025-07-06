

"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { InvoiceDocument, CustomerDocument, CompanyProfile } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Printer, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

const COMPANY_PROFILE_COLLECTION = 'company_profile';
const COMPANY_PROFILE_DOC_ID = 'main_profile';
const DEFAULT_COMPANY_NAME = 'Smart Solution';
const DEFAULT_COMPANY_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";


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


export default function PrintSaleInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;

  const { companyName: contextCompanyName, companyLogoUrl: contextCompanyLogoUrl, invoiceLogoUrl: contextInvoiceLogoUrl } = useAuth();
  const [invoiceData, setInvoiceData] = useState<InvoiceDocument | null>(null);
  const [customerData, setCustomerData] = useState<CustomerDocument | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanyProfile = useCallback(async () => {
    try {
      const profileDocRef = doc(firestore, COMPANY_PROFILE_COLLECTION, COMPANY_PROFILE_DOC_ID);
      const profileDocSnap = await getDoc(profileDocRef);
      if (profileDocSnap.exists()) {
        setCompanyProfile(profileDocSnap.data() as CompanyProfile);
      } else {
        setCompanyProfile({
          companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
          companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          invoiceLogoUrl: contextInvoiceLogoUrl || contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          address: 'House#50, Road#10, Sector#10, Uttara Model Town, Dhaka-1230', // Default address
          emailId: 'info@smartsolution-bd.com', // Default email
        });
      }
    } catch (e) {
      console.error("Error fetching company profile for print:", e);
      setCompanyProfile({ // Fallback on error
          companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
          companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          invoiceLogoUrl: contextInvoiceLogoUrl || contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          address: 'House#50, Road#10, Sector#10, Uttara Model Town, Dhaka-1230',
          emailId: 'info@smartsolution-bd.com',
      });
    }
  }, [contextCompanyName, contextCompanyLogoUrl, contextInvoiceLogoUrl]);

  const fetchSaleAndCustomerData = useCallback(async () => {
    if (!invoiceId) {
      setError("No Invoice ID provided.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const saleDocRef = doc(firestore, "invoices", invoiceId);
      const saleDocSnap = await getDoc(saleDocRef);

      if (saleDocSnap.exists()) {
        const sale = { id: saleDocSnap.id, ...saleDocSnap.data() } as InvoiceDocument;
        setInvoiceData(sale);

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
        setError("Invoice record not found.");
      }
    } catch (err: any) {
      setError(`Failed to fetch invoice data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchCompanyProfile();
    fetchSaleAndCustomerData();
  }, [fetchCompanyProfile, fetchSaleAndCustomerData]);

   useEffect(() => {
    if (!isLoading && invoiceData && companyProfile) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, invoiceData, companyProfile]);

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

  const displayCompanyName = companyProfile?.companyName || contextCompanyName || DEFAULT_COMPANY_NAME;
  const displayCompanyLogo = companyProfile?.invoiceLogoUrl || companyProfile?.companyLogoUrl || contextInvoiceLogoUrl || contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL;
  const displayCompanyAddress = companyProfile?.address || 'Default Company Address, City, Country';
  const displayCompanyEmail = companyProfile?.emailId || 'company@example.com';
  const displayCompanyPhone = companyProfile?.cellNumber || 'N/A';
  
  const showItemCodeColumn = false; // Invoices don't have this field from the user request
  const showDiscountColumn = true; // Assume always shown for invoice
  const showTaxColumn = true; // Assume always shown for invoice


  return (
    <div className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col" style={{ minHeight: 'calc(297mm - 0.6in)' }}>
      <div className="flex-grow">
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
            <h1 className="text-xl font-bold text-gray-900">{displayCompanyName}</h1>
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
        
        <div className="flex gap-4 mb-4">
          <div className="w-1/2 border p-2 rounded-md text-xs">
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
          <div className="w-1/2 border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase tracking-wide">Deliver To:</h3>
              <p className="text-gray-600 whitespace-pre-line">{invoiceData.shippingAddress || invoiceData.billingAddress || customerData?.address || 'N/A'}</p>
          </div>
        </div>
        
        <section className="mb-8">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-2 border border-gray-300 text-left font-semibold w-[5%]">#</th>
                <th className="p-2 border border-gray-300 text-left font-semibold">Item Description</th>
                 {showItemCodeColumn && <th className="p-2 border border-gray-300 text-left font-semibold">Item Code</th>}
                <th className="p-2 border border-gray-300 text-center font-semibold w-[10%]">Qty</th>
                <th className="p-2 border border-gray-300 text-right font-semibold w-[15%]">Unit Price</th>
                {showDiscountColumn && <th className="p-2 border border-gray-300 text-right font-semibold w-[10%]">Discount (%)</th>}
                {showTaxColumn && <th className="p-2 border border-gray-300 text-right font-semibold w-[10%]">Tax (%)</th>}
                <th className="p-2 border border-gray-300 text-right font-semibold w-[15%]">Total</th>
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

        <section className="flex justify-end mb-8">
          <div className="w-full max-w-sm text-sm space-y-1">
            <div className="grid grid-cols-2">
              <span className="text-gray-600 text-right">Subtotal:</span>
              <span className="text-gray-800 text-right">{formatCurrency(invoiceData.subtotal, '')}</span>
            </div>
            {showDiscountColumn && (
                <div className="grid grid-cols-2">
                    <span className="text-gray-600 text-right">Total Discount:</span>
                    <span className="text-gray-800 text-right">(-) {formatCurrency(invoiceData.totalDiscountAmount, '')}</span>
                </div>
            )}
            {showTaxColumn && (
                <div className="grid grid-cols-2">
                    <span className="text-gray-600 text-right">Total Tax ({invoiceData.taxType}):</span>
                    <span className="text-gray-800 text-right">(+) {formatCurrency(invoiceData.totalTaxAmount, '')}</span>
                </div>
            )}
            <Separator className="my-2 border-gray-300" />
            <div className="grid grid-cols-2 text-base font-bold">
              <span className="text-gray-900 text-right">Grand Total:</span>
              <span className="text-blue-600 text-right">{formatCurrency(invoiceData.totalAmount, '')}</span>
            </div>
          </div>
        </section>

        {invoiceData.comments && (
          <section className="mb-8 p-3 border border-gray-200 rounded-md bg-gray-50">
            <h4 className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Terms and Conditions:</h4>
            <p className="text-xs text-gray-600 whitespace-pre-line">{invoiceData.comments}</p>
          </section>
        )}
      </div>

      <div className="mt-auto">
        <section className="flex justify-between pt-16">
          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Buyer Signature</p>
          </div>
          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Seller Signature</p>
          </div>
        </section>

        <footer className="text-center text-xs text-gray-500 pt-8 border-t border-gray-200 mt-8">
            <p>Thank you for your business!</p>
            <p>{displayCompanyName} - {displayCompanyEmail}</p>
        </footer>
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

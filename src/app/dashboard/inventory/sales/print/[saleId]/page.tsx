
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { SaleDocument, CustomerDocument, CompanyProfile } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrency = (amount?: number, currencySymbol: string = 'USD') => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencySymbol} N/A`;
  return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};


export default function PrintSaleInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params.saleId as string;

  const { companyName: contextCompanyName, companyLogoUrl: contextCompanyLogoUrl } = useAuth();
  const [saleData, setSaleData] = useState<SaleDocument | null>(null);
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
        // Fallback to context/defaults if no Firestore profile
        setCompanyProfile({
          companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
          companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          address: 'House#50, Road#10, Sector#10, Uttara Model Town, Dhaka-1230', // Default address
          emailId: 'info@smartsolution-bd.com', // Default email
        });
      }
    } catch (e) {
      console.error("Error fetching company profile for print:", e);
      setCompanyProfile({ // Fallback on error
          companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
          companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          address: 'House#50, Road#10, Sector#10, Uttara Model Town, Dhaka-1230',
          emailId: 'info@smartsolution-bd.com',
      });
    }
  }, [contextCompanyName, contextCompanyLogoUrl]);

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
    fetchCompanyProfile();
    fetchSaleAndCustomerData();
  }, [fetchCompanyProfile, fetchSaleAndCustomerData]);

  useEffect(() => {
    if (!isLoading && saleData && companyProfile) {
      // Slight delay to ensure content is rendered before print dialog
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, saleData, companyProfile]);

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

  const displayCompanyName = companyProfile?.companyName || contextCompanyName || DEFAULT_COMPANY_NAME;
  const displayCompanyLogo = companyProfile?.companyLogoUrl || contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL;
  const displayCompanyAddress = companyProfile?.address || 'Default Company Address, City, Country';
  const displayCompanyEmail = companyProfile?.emailId || 'company@example.com';
  const displayCompanyPhone = companyProfile?.cellNumber || 'N/A';


  return (
    <div className="print-invoice-container bg-white p-8 font-sans text-gray-800" style={{ width: '210mm', minHeight: '297mm', margin: 'auto' }}>
      <header className="flex justify-between items-start mb-8">
        <div>
          {displayCompanyLogo && (
            <Image
              src={displayCompanyLogo}
              alt={`${displayCompanyName} Logo`}
              data-ai-hint="company logo"
              width={120}
              height={60}
              className="object-contain mb-2"
              priority
            />
          )}
          <h1 className="text-3xl font-bold text-gray-900">{displayCompanyName}</h1>
          <p className="text-xs text-gray-600 whitespace-pre-line">{displayCompanyAddress}</p>
          {displayCompanyEmail && <p className="text-xs text-gray-600">Email: {displayCompanyEmail}</p>}
          {displayCompanyPhone && <p className="text-xs text-gray-600">Phone: {displayCompanyPhone}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-semibold text-blue-600 uppercase tracking-wider">Invoice</h2>
          <p className="text-sm"><strong>Invoice No:</strong> {saleData.id.substring(0, 10).toUpperCase()}</p>
          <p className="text-sm"><strong>Date:</strong> {formatDisplayDate(saleData.saleDate)}</p>
        </div>
      </header>

      <Separator className="my-6 border-gray-300" />

      <section className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">Bill To:</h3>
          <p className="font-medium text-gray-900">{saleData.customerName || 'N/A'}</p>
          {customerData?.address && <p className="text-xs text-gray-600 whitespace-pre-line">{customerData.address}</p>}
          {customerData?.email && <p className="text-xs text-gray-600">Email: {customerData.email}</p>}
          {customerData?.phone && <p className="text-xs text-gray-600">Phone: {customerData.phone}</p>}
        </div>
        {saleData.shippingAddress && saleData.shippingAddress !== saleData.billingAddress && (
          <div className="text-right">
            <h3 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">Ship To:</h3>
            <p className="text-xs text-gray-600 whitespace-pre-line">{saleData.shippingAddress}</p>
          </div>
        )}
      </section>

      <section className="mb-8">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-2 border border-gray-300 text-left font-semibold">#</th>
              <th className="p-2 border border-gray-300 text-left font-semibold">Item Description</th>
              <th className="p-2 border border-gray-300 text-center font-semibold">Qty</th>
              <th className="p-2 border border-gray-300 text-right font-semibold">Unit Price</th>
              <th className="p-2 border border-gray-300 text-right font-semibold">Discount (%)</th>
              <th className="p-2 border border-gray-300 text-right font-semibold">Tax (%)</th>
              <th className="p-2 border border-gray-300 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {saleData.lineItems.map((item, index) => (
              <tr key={item.itemId || index} className="border-b border-gray-200">
                <td className="p-2 border border-gray-300 text-center">{index + 1}</td>
                <td className="p-2 border border-gray-300">
                  <p className="font-medium text-gray-900">{item.itemName}</p>
                  {item.itemCode && <p className="text-xs text-gray-500">Code: {item.itemCode}</p>}
                  {item.description && item.description !== item.itemName && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{item.description}</p>}
                </td>
                <td className="p-2 border border-gray-300 text-center">{item.qty}</td>
                <td className="p-2 border border-gray-300 text-right">{formatCurrency(item.unitPrice, '')}</td>
                <td className="p-2 border border-gray-300 text-right">{item.discountPercentage?.toFixed(2) || '0.00'}%</td>
                <td className="p-2 border border-gray-300 text-right">{item.taxPercentage?.toFixed(2) || '0.00'}%</td>
                <td className="p-2 border border-gray-300 text-right font-medium">{formatCurrency(item.total, '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex justify-end mb-8">
        <div className="w-full max-w-xs text-sm">
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Subtotal:</span>
            <span className="text-gray-800">{formatCurrency(saleData.subtotal, '')}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Total Discount:</span>
            <span className="text-gray-800">(-) {formatCurrency(saleData.totalDiscountAmount, '')}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Total Tax ({saleData.taxType}):</span>
            <span className="text-gray-800">(+) {formatCurrency(saleData.totalTaxAmount, '')}</span>
          </div>
          <Separator className="my-2 border-gray-300" />
          <div className="flex justify-between py-1 text-lg font-bold">
            <span className="text-gray-900">Grand Total:</span>
            <span className="text-blue-600">{formatCurrency(saleData.totalAmount, '')}</span>
          </div>
        </div>
      </section>

      {saleData.comments && (
        <section className="mb-8 p-3 border border-gray-200 rounded-md bg-gray-50">
          <h4 className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Comments:</h4>
          <p className="text-xs text-gray-600 whitespace-pre-line">{saleData.comments}</p>
        </section>
      )}

      <footer className="text-center text-xs text-gray-500 pt-8 border-t border-gray-200">
        <p>Thank you for your business!</p>
        <p>{displayCompanyName} - {displayCompanyEmail}</p>
      </footer>

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


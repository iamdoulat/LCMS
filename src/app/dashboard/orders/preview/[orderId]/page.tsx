
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { OrderDocument, SupplierDocument, CompanyProfile } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Printer, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';

const COMPANY_PROFILE_COLLECTION = 'company_profile';
const COMPANY_PROFILE_DOC_ID = 'main_profile';
const DEFAULT_COMPANY_NAME = 'Smart Solution';
const DEFAULT_COMPANY_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const formatCurrency = (amount?: number, currencySymbol: string = 'USD') => {
  if (typeof amount !== 'number' || isNaN(amount)) return `${currencySymbol} N/A`;
  return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PrintOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const { companyName: contextCompanyName, companyLogoUrl: contextCompanyLogoUrl, invoiceLogoUrl: contextInvoiceLogoUrl } = useAuth();
  const [orderData, setOrderData] = useState<OrderDocument | null>(null);
  const [beneficiaryData, setBeneficiaryData] = useState<SupplierDocument | null>(null);
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
          address: 'Default Company Address, City, Country',
          emailId: 'company@example.com',
        });
      }
    } catch (e) {
      console.error("Error fetching company profile for print:", e);
      setCompanyProfile({
          companyName: contextCompanyName || DEFAULT_COMPANY_NAME,
          companyLogoUrl: contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          invoiceLogoUrl: contextInvoiceLogoUrl || contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL,
          address: 'Default Company Address, City, Country',
          emailId: 'company@example.com',
      });
    }
  }, [contextCompanyName, contextCompanyLogoUrl, contextInvoiceLogoUrl]);

  const fetchOrderAndBeneficiaryData = useCallback(async () => {
    if (!orderId) {
      setError("No Order ID provided.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const orderDocRef = doc(firestore, "orders", orderId);
      const orderDocSnap = await getDoc(orderDocRef);

      if (orderDocSnap.exists()) {
        const order = { id: orderDocSnap.id, ...orderDocSnap.data() } as OrderDocument;
        setOrderData(order);

        if (order.beneficiaryId) {
          const beneficiaryDocRef = doc(firestore, "suppliers", order.beneficiaryId);
          const beneficiaryDocSnap = await getDoc(beneficiaryDocRef);
          if (beneficiaryDocSnap.exists()) {
            setBeneficiaryData({ id: beneficiaryDocSnap.id, ...beneficiaryDocSnap.data() } as SupplierDocument);
          } else {
            console.warn(`Beneficiary with ID ${order.beneficiaryId} not found.`);
          }
        }
      } else {
        setError("Order record not found.");
      }
    } catch (err: any) {
      setError(`Failed to fetch order data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchCompanyProfile();
    fetchOrderAndBeneficiaryData();
  }, [fetchCompanyProfile, fetchOrderAndBeneficiaryData]);

   useEffect(() => {
    if (!isLoading && orderData && companyProfile) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, orderData, companyProfile]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-gray-600">Loading order...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600 font-semibold">Error loading order</p>
        <p className="text-gray-700 text-sm mb-4">{error}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <p className="text-gray-700">Order data could not be loaded.</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const displayCompanyName = companyProfile?.companyName || contextCompanyName || DEFAULT_COMPANY_NAME;
  const displayCompanyLogo = companyProfile?.invoiceLogoUrl || companyProfile?.companyLogoUrl || contextInvoiceLogoUrl || contextCompanyLogoUrl || DEFAULT_COMPANY_LOGO_URL;
  const displayCompanyAddress = companyProfile?.address || 'Default Company Address, City, Country';
  const displayCompanyEmail = companyProfile?.emailId || 'company@example.com';
  const displayCompanyPhone = companyProfile?.cellNumber || 'N/A';

  return (
    <div className="print-invoice-container bg-white p-4 font-sans text-gray-800" style={{ width: '210mm', minHeight: '297mm', margin: 'auto' }}>
      <div className="flex justify-between items-start mb-4">
        <div className="w-2/3 pr-8">
          {displayCompanyLogo && (
            <Image
              src={displayCompanyLogo}
              alt={`${displayCompanyName} Logo`}
              width={240}
              height={120}
              className="object-contain mb-2"
              priority
              data-ai-hint="company logo"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{displayCompanyName}</h1>
          <p className="text-xs text-gray-600 whitespace-pre-line">{displayCompanyAddress}</p>
          {displayCompanyEmail && <p className="text-xs text-gray-600">Email: {displayCompanyEmail}</p>}
          {displayCompanyPhone && <p className="text-xs text-gray-600">Phone: {displayCompanyPhone}</p>}
        </div>

        <div className="w-1/3 text-right">
          <h2 className="text-3xl font-semibold text-blue-600 uppercase tracking-wider">Order</h2>
          <p className="text-sm"><strong>Order No:</strong> {orderData.id}</p>
          <p className="text-sm"><strong>Date:</strong> {formatDisplayDate(orderData.orderDate)}</p>
        </div>
      </div>
      
      <Separator className="my-4 border-gray-300" />
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border p-2 rounded-md text-xs">
          <h3 className="font-semibold text-gray-700 mb-1 uppercase tracking-wide">To:</h3>
          <p className="font-medium text-gray-900">{orderData.beneficiaryName || 'N/A'}</p>
          {orderData.shippingAddress && <p className="text-gray-600 whitespace-pre-line">{orderData.shippingAddress}</p>}
        </div>
        <div className="border p-2 rounded-md text-xs">
          <h3 className="font-semibold text-gray-700 mb-1 uppercase tracking-wide">Deliver To:</h3>
          <p className="font-medium text-gray-900">{orderData.beneficiaryName || 'N/A'}</p>
          {orderData.billingAddress && <p className="text-gray-600 whitespace-pre-line">{orderData.billingAddress}</p>}
        </div>
      </div>

      <section className="mb-8">
        <table className="w-full text-sm border-collapse table-fixed">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-2 border border-gray-300 text-left font-semibold w-[5%]">#</th>
              <th className="p-2 border border-gray-300 text-left font-semibold w-[55%]">Item Description</th>
              <th className="p-2 border border-gray-300 text-center font-semibold w-[10%]">Qty</th>
              <th className="p-2 border border-gray-300 text-right font-semibold w-[15%]">Unit Price</th>
              <th className="p-2 border border-gray-300 text-right font-semibold w-[15%]">Total</th>
            </tr>
          </thead>
          <tbody>
            {orderData.lineItems.map((item, index) => (
              <tr key={item.itemId || index} className="border-b border-gray-200">
                <td className="p-2 border border-gray-300 text-center align-top">{index + 1}</td>
                <td className="p-2 border border-gray-300 align-top break-words">
                  <p className="font-medium text-gray-900">{item.itemName}</p>
                  {item.itemCode && <p className="text-xs text-gray-500">Code: {item.itemCode}</p>}
                  {item.description && item.description !== item.itemName && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{item.description}</p>}
                </td>
                <td className="p-2 border border-gray-300 text-center align-top">{item.qty}</td>
                <td className="p-2 border border-gray-300 text-right align-top">{formatCurrency(item.unitPrice, '')}</td>
                <td className="p-2 border border-gray-300 text-right font-medium align-top">{formatCurrency(item.total, '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex justify-end mb-8">
        <div className="w-full max-w-xs text-sm">
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Subtotal:</span>
            <span className="text-gray-800">{formatCurrency(orderData.subtotal, '')}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Total Discount:</span>
            <span className="text-gray-800">(-) {formatCurrency(orderData.totalDiscountAmount, '')}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Total Tax ({orderData.taxType}):</span>
            <span className="text-gray-800">(+) {formatCurrency(orderData.totalTaxAmount, '')}</span>
          </div>
          <Separator className="my-2 border-gray-300" />
          <div className="flex justify-between py-1 text-lg font-bold">
            <span className="text-gray-900">Grand Total:</span>
            <span className="text-blue-600">{formatCurrency(orderData.totalAmount, '')}</span>
          </div>
        </div>
      </section>

      {orderData.comments && (
        <section className="mb-8 p-3 border border-gray-200 rounded-md bg-gray-50">
          <h4 className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">Comments:</h4>
          <p className="text-xs text-gray-600 whitespace-pre-line">{orderData.comments}</p>
        </section>
      )}

      <footer className="text-center text-xs text-gray-500 pt-8 border-t border-gray-200">
        <p>Thank you for your business!</p>
        <p>{displayCompanyName} - {displayCompanyEmail}</p>
      </footer>

      <div className="print-only-utility-buttons mt-8 text-center noprint">
        <Button onClick={() => window.print()} variant="default" className="bg-blue-600 hover:bg-blue-700">
          <Printer className="mr-2 h-4 w-4" /> Print Order
        </Button>
        <Button onClick={() => router.back()} variant="outline" className="ml-2">
          Close
        </Button>
      </div>
    </div>
  );
}


"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { OrderDocument, SupplierDocument } from '@/types';
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

const formatCurrency = (amount?: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `N/A`;
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PrintOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [orderData, setOrderData] = React.useState<OrderDocument | null>(null);
  const [beneficiaryData, setBeneficiaryData] = React.useState<SupplierDocument | null>(null);
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

  const fetchOrderAndBeneficiaryData = useCallback(async () => {
    if (!orderId) {
      setError("No Order ID provided.");
      return;
    }
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
          }
        }
      } else {
        setError("Order record not found.");
      }
    } catch (err: any) {
      setError(`Failed to fetch order data: ${err.message}`);
    }
  }, [orderId]);

  useEffect(() => {
     const loadAllData = async () => {
        setIsLoading(true);
        await Promise.all([fetchFinancialSettings(), fetchOrderAndBeneficiaryData()]);
        setIsLoading(false);
    }
    loadAllData();
  }, [fetchFinancialSettings, fetchOrderAndBeneficiaryData]);

   useEffect(() => {
    if (!isLoading && orderData && financialSettings) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, orderData, financialSettings]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-gray-600">Loading order...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600 font-semibold">Error loading order</p>
        <p className="text-gray-700 text-sm mb-4">{error}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
        <p className="text-gray-700">Order data could not be loaded.</p>
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
  
  const showItemCodeColumn = orderData.showItemCodeColumn ?? true; 
  const showDiscountColumn = orderData.showDiscountColumn ?? true;
  const showTaxColumn = orderData.showTaxColumn ?? true;

  const qrCodeValue = `ORDER\nOrder Number: ${orderData.id}\nDate: ${formatDisplayDate(orderData.orderDate)}\nSales Person: ${orderData.salesperson || 'N/A'}\nGrand Total: ${formatCurrency(orderData.totalAmount)} (USD)`;


  return (
    <div className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto' }}>
      <div className="print-header pt-2 pb-2">
        <div className="px-0">
            <div className="flex justify-between items-start mb-2">
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
                <h2 className="text-2xl font-bold underline underline-offset-4 tracking-wider mb-2">ORDER</h2>
                <div className="flex justify-end items-baseline gap-2 text-sm">
                    <span className="font-semibold">Order Number :</span>
                    <span>{orderData.id}</span>
                </div>
                <div className="flex justify-end items-baseline gap-2 text-sm">
                    <span className="font-semibold">Date :</span>
                    <span>{formatDisplayDate(orderData.orderDate)}</span>
                </div>
                {orderData.salesperson && (
                    <div className="flex justify-end items-baseline gap-2 text-sm">
                        <span className="font-semibold">Sales Person :</span>
                        <span>{orderData.salesperson}</span>
                    </div>
                )}
            </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="border p-2 rounded-md text-xs">
                <h3 className="font-semibold text-gray-700 mb-1 uppercase">Bill To:</h3>
                <p className="text-gray-600 whitespace-pre-line">{orderData.billingAddress || beneficiaryData?.headOfficeAddress || 'N/A'}</p>
            </div>
            <div className="border p-2 rounded-md text-xs">
                <h3 className="font-semibold text-gray-700 mb-1 uppercase">Deliver To:</h3>
                <p className="text-gray-600 whitespace-pre-line">{orderData.shippingAddress || orderData.billingAddress || beneficiaryData?.headOfficeAddress || 'N/A'}</p>
            </div>
            </div>
        </div>
      </div>
      
      <div className="flex-grow flex flex-col">
        <section className="flex-grow">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{width: '5%'}}>#</th>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{width: '45%'}}>Item Description</th>
                {showItemCodeColumn && <th className="p-2 border border-gray-300 text-left font-semibold" style={{width: '12%'}}>Item Code</th>}
                <th className="p-2 border border-gray-300 text-center font-semibold" style={{width: '8%'}}>Qty</th>
                <th className="p-2 border border-gray-300 text-right font-semibold whitespace-nowrap" style={{width: '10%'}}>Unit Price</th>
                {showDiscountColumn && <th className="p-2 border border-gray-300 text-right font-semibold" style={{width: '8%'}}>Discount</th>}
                {showTaxColumn && <th className="p-2 border border-gray-300 text-right font-semibold" style={{width: '8%'}}>Tax</th>}
                <th className="p-2 border border-gray-300 text-right font-semibold" style={{width: '12%'}}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orderData.lineItems.map((item, index) => (
                <tr key={`${item.itemId}-${index}`} className="border-b border-gray-200">
                  <td className="p-2 border border-gray-300 text-center align-top">{index + 1}</td>
                  <td className="p-2 border border-gray-300 align-top break-words">
                    <p className="font-medium text-gray-900">{item.itemName}</p>
                    {item.description && item.description !== item.itemName && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{item.description}</p>}
                  </td>
                  {showItemCodeColumn && <td className="p-2 border border-gray-300 align-top">{item.itemCode || 'N/A'}</td>}
                  <td className="p-2 border border-gray-300 text-center align-top">{item.qty}</td>
                  <td className="p-2 border border-gray-300 text-right align-top">{formatCurrency(item.unitPrice)}</td>
                  {showDiscountColumn && <td className="p-2 border border-gray-300 text-right align-top">{item.discountPercentage?.toFixed(2) || '0.00'}%</td>}
                  {showTaxColumn && <td className="p-2 border border-gray-300 text-right align-top">{item.taxPercentage?.toFixed(2) || '0.00'}%</td>}
                  <td className="p-2 border border-gray-300 text-right font-medium align-top">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        
        <section className="mt-auto">
            <div className="flex justify-between items-start pt-2">
                <div className="w-1/2 pr-4 text-xs">
                    {orderData.comments && (
                    <div className="space-y-1">
                        <h4 className="font-bold text-gray-800 uppercase tracking-wide">TERMS AND CONDITIONS:</h4>
                        <div className="text-gray-600 whitespace-pre-line font-bold">{orderData.comments}</div>
                    </div>
                    )}
                </div>
                <div className="w-auto text-sm space-y-1 min-w-[250px]">
                  <div className="grid grid-cols-2 gap-x-4">
                      <span className="text-gray-600 font-medium text-right">Subtotal:</span>
                      <span className="text-gray-800 text-right">{formatCurrency(orderData.subtotal)}</span>
                  </div>
                  {showDiscountColumn && (
                      <div className="grid grid-cols-2 gap-x-4">
                          <span className="text-gray-600 font-medium text-right">Total Discount:</span>
                          <span className="text-gray-800 text-right">(-) {formatCurrency(orderData.totalDiscountAmount)}</span>
                      </div>
                  )}
                  {showTaxColumn && (
                      <div className="grid grid-cols-2 gap-x-4">
                          <span className="text-gray-600 font-medium text-right">Total Tax ({orderData.taxType}):</span>
                          <span className="text-gray-800 text-right">(+) {formatCurrency(orderData.totalTaxAmount)}</span>
                      </div>
                  )}
                  <Separator className="my-2 border-gray-300" />
                  <div className="grid grid-cols-2 gap-x-4 text-base font-bold">
                      <span className="text-gray-900 text-right">Grand Total (USD):</span>
                      <span className="text-blue-600 text-right">{formatCurrency(orderData.totalAmount)}</span>
                  </div>
              </div>
            </div>
        </section>
      </div>

      <div className="print-footer pb-4">
        <section className="flex justify-between items-end mb-2 pt-16">
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
          <Printer className="mr-2 h-4 w-4" /> Print Order
        </Button>
        <Button onClick={() => router.back()} variant="outline" className="ml-2">
          Close
        </Button>
      </div>
    </div>
  );
}


"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { SaleDocument, CustomerDocument } from '@/types';

import { Loader2, Printer, AlertTriangle, Share2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';
import QRCode from 'react-qr-code';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

export default function PrintSaleInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params.saleId as string;
  const printContainerRef = React.useRef<HTMLDivElement>(null);

  const [saleData, setSaleData] = useState<SaleDocument | null>(null);
  const [customerData, setCustomerData] = useState<CustomerDocument | null>(null);
  const [financialSettings, setFinancialSettings] = React.useState<FinancialSettingsProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      setError(null);
      if (!saleId) {
        setError("No Sale ID provided.");
        setIsLoading(false);
        return;
      }

      try {
        const settingsDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, FINANCIAL_SETTINGS_DOC_ID);
        const saleDocRef = doc(firestore, "sales_invoice", saleId);
        const [settingsSnap, saleSnap] = await Promise.all([getDoc(settingsDocRef), getDoc(saleDocRef)]);

        if (settingsSnap.exists()) {
          setFinancialSettings(settingsSnap.data() as FinancialSettingsProfile);
        } else {
          console.warn("Financial settings not found, using defaults.");
          setFinancialSettings({
            companyName: DEFAULT_FINANCIAL_COMPANY_NAME,
            address: DEFAULT_FINANCIAL_ADDRESS,
            emailId: DEFAULT_FINANCIAL_EMAIL,
            invoiceLogoUrl: DEFAULT_FINANCIAL_LOGO_URL,
          });
        }

        if (saleSnap.exists()) {
          const sale = { id: saleSnap.id, ...saleSnap.data() } as SaleDocument;
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
        setError(`Failed to fetch data: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, [saleId]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${saleData?.id}`,
          text: `Here is the invoice for ${saleData?.customerName}.`,
          url: window.location.href,
        });
      } catch (error) {
        console.error('Error sharing:', error);
        Swal.fire({
          title: "Share Failed",
          text: "Could not share the document. Please try again or copy the link manually.",
          icon: "error",
        });
      }
    } else {
      Swal.fire({
        title: "Share Not Supported",
        text: "Your browser does not support the Web Share API. You can copy the URL to share manually.",
        icon: "info",
      });
    }
  };

  const handleDownloadPdf = async () => {
    const input = printContainerRef.current;
    if (!input) {
      Swal.fire("Error", "Could not find the content to download.", "error");
      return;
    }

    const utilityButtons = input.querySelector('.print-only-utility-buttons') as HTMLElement;
    if (utilityButtons) utilityButtons.style.display = 'none';

    try {
      const canvas = await html2canvas(input, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgHeight / imgWidth;
      const height = pdfWidth * ratio;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, height);
      pdf.save(`Invoice_${saleId}.pdf`);

    } catch (error) {
      console.error("Error generating PDF:", error);
      Swal.fire("Error", "An error occurred while generating the PDF.", "error");
    } finally {
      if (utilityButtons) utilityButtons.style.display = 'flex';
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-600">Loading invoice...</p>
      </div>
    );
  }

  if (error || !saleData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600 font-semibold">Error Loading Invoice</p>
        <p className="text-gray-700 text-sm mb-4">{error || "Sale data could not be loaded."}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
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

  const qrCodeValue = `INVOICE\nInvoice No: ${saleData.id}\nDate: ${formatDisplayDate(saleData.invoiceDate)}\nSales Person: ${saleData.salesperson || 'N/A'}\nGrand Total: ${formatCurrency(saleData.totalAmount)} (BDT)`;

  return (
    <div ref={printContainerRef} className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto', padding: '0' }}>
      <div className="p-4 flex flex-col flex-grow">
        <div className="print-header">
          <div className="flex justify-between items-start mb-2">
            <div className="w-2/3 pr-8">
              {displayCompanyLogo && (
                <Image
                  src={displayCompanyLogo}
                  alt={`${displayCompanyName} Logo`}
                  width={297}
                  height={44}
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
                <span className="font-semibold">Invoice No :</span>
                <span>{saleData.id}</span>
              </div>
              <div className="flex justify-end items-baseline gap-2 text-sm">
                <span className="font-semibold">Date :</span>
                <span>{formatDisplayDate(saleData.invoiceDate)}</span>
              </div>
              {saleData.salesperson && (
                <div className="flex justify-end items-baseline gap-2 text-sm">
                  <span className="font-semibold">Sales Person :</span>
                  <span>{saleData.salesperson}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase">Bill To:</h3>

              <p className="text-gray-600 whitespace-pre-line">{saleData.billingAddress || customerData?.address || 'N/A'}</p>

            </div>
            <div className="border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase tracking-wide">Deliver To:</h3>
              <p className="text-gray-600 whitespace-pre-line">{saleData.shippingAddress || saleData.billingAddress || customerData?.address || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="flex-grow-0">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '5%' }}>#</th>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '45%' }}>Item Description</th>
                {showItemCodeColumn && <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '12%' }}>Item Code</th>}
                <th className="p-2 border border-gray-300 text-center font-semibold" style={{ width: '8%' }}>Qty</th>
                <th className="p-2 border border-gray-300 text-right font-semibold whitespace-nowrap" style={{ width: '10%' }}>Unit Price</th>
                {showDiscountColumn && <th className="p-2 border border-gray-300 text-right font-semibold" style={{ width: '8%' }}>Discount</th>}
                {showTaxColumn && <th className="p-2 border border-gray-300 text-right font-semibold" style={{ width: '8%' }}>Tax</th>}
                <th className="p-2 border border-gray-300 text-right font-semibold" style={{ width: '12%' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {saleData.lineItems.map((item, index) => (
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
        </div>

        <div className="flex justify-between items-start pt-2">
          <div className="w-1/2 pr-4 text-xs">
            {saleData.comments && (
              <div className="space-y-1">
                <h4 className="font-bold text-gray-800 uppercase tracking-wide">TERMS AND CONDITIONS:</h4>
                <div className="text-gray-600 whitespace-pre-line font-bold">{saleData.comments}</div>
              </div>
            )}
          </div>
          <div className="w-auto text-sm space-y-1 min-w-[250px]">
            <div className="grid grid-cols-2 gap-x-4">
              <span className="text-gray-600 font-medium text-right">Subtotal:</span>
              <span className="text-gray-800 text-right">{formatCurrency(saleData.subtotal)}</span>
            </div>
            {showDiscountColumn && (
              <div className="grid grid-cols-2 gap-x-4">
                <span className="text-gray-600 font-medium text-right">Total Discount:</span>
                <span className="text-gray-800 text-right">(-) {formatCurrency(saleData.totalDiscountAmount)}</span>
              </div>
            )}
            {showTaxColumn && (
              <div className="grid grid-cols-2 gap-x-4">
                <span className="text-gray-600 font-medium text-right">Total Tax ({saleData.taxType}):</span>
                <span className="text-gray-800 text-right">(+) {formatCurrency(saleData.totalTaxAmount)}</span>
              </div>
            )}
            <Separator className="my-2 border-gray-300" />
            <div className="grid grid-cols-2 gap-x-4 text-base font-bold">
              <span className="text-gray-900 text-right" style={{ fontSize: '14px' }}>Grand Total (BDT):</span>
              <span className="text-blue-600 text-right" style={{ fontSize: '14px' }}>{formatCurrency(saleData.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="print-footer pb-4 px-4 mt-auto">
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

          </div>

          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Seller Signature</p>
          </div>
        </section>
      </div>

      <div className="print-only-utility-buttons mt-8 text-center noprint flex justify-center items-center gap-2">
        <Button onClick={handleShare} variant="outline">
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
        <Button onClick={handleDownloadPdf} variant="outline">
          <Download className="mr-2 h-4 w-4" /> PDF Download
        </Button>
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







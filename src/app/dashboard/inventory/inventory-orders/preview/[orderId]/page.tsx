
"use client";

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { OrderDocument, SupplierDocument, CompanyProfile } from '@/types';
import { Loader2, Printer, AlertTriangle, Share2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';
import QRCode from "react-qr-code";
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const MAIN_SETTINGS_DOC_ID = 'main_settings';
const DEFAULT_COMPANY_NAME = 'Your Company Name';
const DEFAULT_ADDRESS = 'Your Company Address';
const DEFAULT_EMAIL = 'your@email.com';
const DEFAULT_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";


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
  const printContainerRef = React.useRef<HTMLDivElement>(null);

  const [orderData, setOrderData] = React.useState<OrderDocument | null>(null);
  const [beneficiaryData, setBeneficiaryData] = React.useState<SupplierDocument | null>(null);
  const [settings, setSettings] = React.useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchSettings = React.useCallback(async () => {
    try {
      const settingsDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
      const settingsSnap = await getDoc(settingsDocRef);
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data() as CompanyProfile);
      } else {
        setSettings({
          companyName: DEFAULT_COMPANY_NAME,
          address: DEFAULT_ADDRESS,
          emailId: DEFAULT_EMAIL,
          invoiceLogoUrl: DEFAULT_LOGO_URL,
        });
      }
    } catch (e) {
      console.error("Error fetching settings for print:", e);
      setSettings({
        companyName: DEFAULT_COMPANY_NAME,
        address: DEFAULT_ADDRESS,
        emailId: DEFAULT_EMAIL,
        invoiceLogoUrl: DEFAULT_LOGO_URL,
      });
    }
  }, []);

  const fetchOrderAndBeneficiaryData = React.useCallback(async () => {
    if (!orderId) {
      setError("No Order ID provided.");
      return;
    }
    try {
      const orderDocRef = doc(firestore, "inventory_orders", orderId);
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

  React.useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      await Promise.all([fetchSettings(), fetchOrderAndBeneficiaryData()]);
      setIsLoading(false);
    }
    loadAllData();
  }, [fetchSettings, fetchOrderAndBeneficiaryData]);


  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Order ${orderData?.id}`,
          text: `Here is the order for ${orderData?.beneficiaryName}.`,
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
      pdf.save(`Order_${orderId}.pdf`);

    } catch (error) {
      console.error("Error generating PDF:", error);
      Swal.fire("Error", "An error occurred while generating the PDF.", "error");
    } finally {
      if (utilityButtons) utilityButtons.style.display = 'flex';
    }
  };

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

  const displayCompanyName = settings?.companyName || DEFAULT_COMPANY_NAME;
  const displayCompanyLogo = settings?.invoiceLogoUrl || 'https://placehold.co/400x100.png';
  const displayCompanyAddress = settings?.address || DEFAULT_ADDRESS;
  const displayCompanyEmail = settings?.emailId || DEFAULT_EMAIL;
  const displayCompanyPhone = settings?.cellNumber || 'N/A';
  const hideCompanyName = settings?.hideCompanyName ?? false;
  const displayLogoWidth = settings?.logoWidth || 396;
  const displayLogoHeight = settings?.logoHeight || 58;
  const displayHeaderTitle = settings?.piHeaderTitle || '';

  const showItemCodeColumn = orderData.showItemCodeColumn ?? false;
  const showDiscountColumn = orderData.showDiscountColumn ?? false;
  const showTaxColumn = orderData.showTaxColumn ?? false;

  const qrCodeValue = `ORDER\nOrder Number: ${orderData.id}\nDate: ${formatDisplayDate(orderData.orderDate)}\nSales Person: ${orderData.salesperson || 'N/A'}\nGrand Total: ${formatCurrency(orderData.totalAmount)} (USD)`;

  const grandTotalLabel = `${orderData.shipmentMode} TOTAL (USD):`;

  return (
    <div ref={printContainerRef} className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto', padding: '0' }}>
      <div className="p-4 flex flex-col flex-grow">
        <div className="print-header">
          <div className="flex justify-between items-start mb-2">
            <div className="w-2/3 pr-8">
              <div className="flex items-center gap-4 mb-2">
                {displayCompanyLogo && (
                  <Image
                    src={displayCompanyLogo}
                    alt={`${displayCompanyName} Logo`}
                    width={displayLogoWidth}
                    height={displayLogoHeight}
                    className="object-contain"
                    priority
                    data-ai-hint="company logo"
                  />
                )}
                {displayHeaderTitle && (
                  <h1 className="text-2xl font-bold uppercase text-gray-900 leading-tight">{displayHeaderTitle}</h1>
                )}
              </div>
              {!hideCompanyName && (
                <h2 className="text-xl font-bold text-gray-900">{displayCompanyName}</h2>
              )}
              <p className="text-xs text-gray-600 whitespace-pre-line">{displayCompanyAddress}</p>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                {displayCompanyEmail && <span>Email: {displayCompanyEmail}</span>}
                {displayCompanyPhone && <span>Phone: {displayCompanyPhone}</span>}
              </div>
            </div>

            <div className="text-right">
              <h2 className="text-2xl font-bold underline underline-offset-4 tracking-wider mb-2">PURCHASE ORDER</h2>
              <div className="flex justify-end items-baseline gap-2 text-xs">
                <span className="font-semibold">Order Number :</span>
                <span>{orderData.id}</span>
              </div>
              <div className="flex justify-end items-baseline gap-2 text-xs">
                <span className="font-semibold">Date :</span>
                <span>{formatDisplayDate(orderData.orderDate)}</span>
              </div>
              {orderData.salesperson && (
                <div className="flex justify-end items-baseline gap-2 text-xs">
                  <span className="font-semibold">Sales Person :</span>
                  <span>{orderData.salesperson}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase">SUPPLIER:</h3>
              <p className="font-medium text-gray-900">{beneficiaryData?.beneficiaryName || 'N/A'}</p>
              <p className="text-gray-600 whitespace-pre-line">{orderData.billingAddress || beneficiaryData?.headOfficeAddress || 'N/A'}</p>
            </div>
            <div className="border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase tracking-wide">Deliver To:</h3>
              <p className="text-gray-600 whitespace-pre-line">{orderData.shippingAddress || orderData.billingAddress || beneficiaryData?.headOfficeAddress || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-2 text-xs">
            <div className="border p-2 rounded-md"><span className="font-semibold text-gray-700">Terms of Shipment:</span><p className="font-medium text-gray-900">{orderData.terms || 'N/A'}</p></div>
            <div className="border p-2 rounded-md"><span className="font-semibold text-gray-700">Ship Via:</span><p className="font-medium text-gray-900">{orderData.shipVia || 'N/A'}</p></div>
            <div className="border p-2 rounded-md"><span className="font-semibold text-gray-700">Port of Loading:</span><p className="font-medium text-gray-900">{orderData.portOfLoading || 'N/A'}</p></div>
            <div className="border p-2 rounded-md"><span className="font-semibold text-gray-700">Port of Discharge:</span><p className="font-medium text-gray-900">{orderData.portOfDischarge || 'N/A'}</p></div>
          </div>
        </div>

        <div className="flex-grow-0">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '4%' }}>#</th>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '48%' }}>Item Description</th>
                {showItemCodeColumn && <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '10%' }}>Item Code</th>}
                <th className="p-2 border border-gray-300 text-center font-semibold" style={{ width: '6%' }}>Qty</th>
                <th className="p-2 border border-gray-300 text-right font-semibold whitespace-nowrap" style={{ width: '12%' }}>Unit Price</th>
                {showDiscountColumn && <th className="p-2 border border-gray-300 text-right font-semibold" style={{ width: '8%' }}>Discount</th>}
                {showTaxColumn && <th className="p-2 border border-gray-300 text-right font-semibold" style={{ width: '8%' }}>Tax</th>}
                <th className="p-2 border border-gray-300 text-right font-semibold" style={{ width: '12%' }}>Total</th>
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
        </div>

        <div className="flex justify-between items-start pt-2">
          <div className="w-3/4 pr-4 text-xs">
            {orderData.comments && (
              <div className="space-y-1">
                <h4 className="font-bold text-gray-800 underline uppercase tracking-wide">TERMS AND CONDITIONS:</h4>
                <div className="text-gray-600 whitespace-pre-line font-bold">{orderData.comments}</div>
              </div>
            )}
          </div>
          <div className="w-auto text-sm space-y-1 min-w-[250px]">
            <div className="grid grid-cols-2 gap-x-0">
              <span className="text-gray-600 font-medium text-right">Subtotal:</span>
              <span className="text-gray-800 text-right">{formatCurrency(orderData.subtotal)}</span>
            </div>
            {showDiscountColumn && (
              <div className="grid grid-cols-2 gap-x-0">
                <span className="text-gray-600 font-medium text-right">Total Discount:</span>
                <span className="text-gray-800 text-right">(-) {formatCurrency(orderData.totalDiscountAmount)}</span>
              </div>
            )}
            {showTaxColumn && (
              <div className="grid grid-cols-2 gap-x-0">
                <span className="text-gray-600 font-medium text-right">Total Tax ({orderData.taxType}):</span>
                <span className="text-gray-800 text-right">(+) {formatCurrency(orderData.totalTaxAmount)}</span>
              </div>
            )}
            {(orderData.freightCharges || 0) > 0 && (
              <div className="grid grid-cols-2 gap-x-0">
                <span className="text-gray-600 font-medium text-right">Freight Charges:</span>
                <span className="text-gray-800 text-right">(+) {formatCurrency(orderData.freightCharges)}</span>
              </div>
            )}
            <Separator className="my-2 border-gray-300" />
            <div className="grid grid-cols-2 gap-x-0 text-base font-bold">
              <span className="text-gray-900 text-right" style={{ fontSize: '14px' }}>{grandTotalLabel}</span>
              <span className="text-blue-600 text-right" style={{ fontSize: '14px' }}>{formatCurrency(orderData.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="print-footer pb-4 px-4 mt-auto">
        <section className="flex justify-between items-end mb-2 pt-16">
          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Seller Signature</p>
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
            <p className="pt-2 text-xs font-semibold text-gray-800">Authorized Signature</p>
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
          <Printer className="mr-2 h-4 w-4" /> Print Purchase Order
        </Button>
        <Button onClick={() => router.back()} variant="outline" className="ml-2">
          Close
        </Button>
      </div>
    </div>
  );
}


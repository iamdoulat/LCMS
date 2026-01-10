
"use client";

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { InvoiceDocument, CustomerDocument, CompanyProfile } from '@/types';
import { Loader2, Printer, AlertTriangle, Share2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';
import QRCode from "react-qr-code";
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PI_SETTINGS_COLLECTION = 'pi_layout_settings';
const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const MAIN_SETTINGS_DOC_ID = 'main_settings';

const DEFAULT_COMPANY_NAME = 'Your Company Name';
const DEFAULT_ADDRESS = 'Your Company Address';
const DEFAULT_EMAIL = 'your@email.com';
const DEFAULT_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";

interface CombinedSettingsProfile {
  name?: string; // from pi_layout_settings
  companyName?: string; // from financial_settings
  address?: string;
  email?: string; // from pi_layout_settings
  emailId?: string; // from financial_settings
  phone?: string; // from pi_layout_settings
  cellNumber?: string; // from financial_settings
  invoiceLogoUrl?: string;
  piLogoUrl?: string;
  hideCompanyName?: boolean;
  logoWidth?: number;
  logoHeight?: number;
  piHeaderTitle?: string;
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

export default function PrintInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;
  const printContainerRef = React.useRef<HTMLDivElement>(null);

  const [invoiceData, setInvoiceData] = React.useState<InvoiceDocument | null>(null);
  const [customerData, setCustomerData] = React.useState<CustomerDocument | null>(null);
  const [settings, setSettings] = React.useState<CombinedSettingsProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchSettings = React.useCallback(async () => {
    try {
      const financialSettingsDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);
      const piSettingsDocRef = doc(firestore, PI_SETTINGS_COLLECTION, MAIN_SETTINGS_DOC_ID);

      const [financialSnap, piSnap] = await Promise.all([
        getDoc(financialSettingsDocRef),
        getDoc(piSettingsDocRef)
      ]);

      const financialData = financialSnap.exists() ? financialSnap.data() as Partial<CombinedSettingsProfile> : {};
      const piData = piSnap.exists() ? piSnap.data() as Partial<CombinedSettingsProfile> : {};

      setSettings({
        ...financialData,
        ...piData,
      });

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

  const fetchInvoiceData = React.useCallback(async () => {
    if (!invoiceId) {
      setError("No Invoice ID provided.");
      return;
    }
    try {
      const invoiceDocRef = doc(firestore, "invoices", invoiceId);
      const invoiceDocSnap = await getDoc(invoiceDocRef);

      if (invoiceDocSnap.exists()) {
        const invoice = { id: invoiceDocSnap.id, ...invoiceDocSnap.data() } as InvoiceDocument;

        // Fetch latest images from items
        const itemsWithImages = await Promise.all(invoice.lineItems.map(async (item: any) => {
          if (item.itemId) {
            try {
              const itemRef = doc(firestore, 'items', item.itemId);
              const itemSnap = await getDoc(itemRef);
              if (itemSnap.exists()) {
                const itemData = itemSnap.data();
                return { ...item, imageUrl: itemData.photoURL || itemData.imageUrl || item.imageUrl };
              }
            } catch (err) {
              console.error(`Error fetching image for item ${item.itemId}:`, err);
            }
          }
          return item;
        }));

        setInvoiceData({ ...invoice, lineItems: itemsWithImages });

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

  React.useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      await Promise.all([fetchSettings(), fetchInvoiceData()]);
      setIsLoading(false);
    }
    loadAllData();
  }, [fetchSettings, fetchInvoiceData]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoiceData?.id}`,
          text: `Here is the invoice for ${invoiceData?.customerName}.`,
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
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgHeight / imgWidth;
      const height = pdfWidth * ratio;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, height);
      pdf.save(`Invoice_${invoiceId}.pdf`);

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

  const displayCompanyName = settings?.name || settings?.companyName || DEFAULT_COMPANY_NAME;
  const displayCompanyLogo = settings?.piLogoUrl || settings?.invoiceLogoUrl || DEFAULT_LOGO_URL;
  const displayCompanyAddress = settings?.address || DEFAULT_ADDRESS;
  const displayCompanyEmail = settings?.email || settings?.emailId || DEFAULT_EMAIL;
  const displayCompanyPhone = settings?.phone || settings?.cellNumber || 'N/A';
  const hideCompanyName = settings?.hideCompanyName ?? false;

  const showItemCodeColumn = invoiceData.showItemCodeColumn ?? false;
  const showDiscountColumn = invoiceData.showDiscountColumn ?? false;
  const showTaxColumn = invoiceData.showTaxColumn ?? false;

  const qrCodeValue = `INVOICE\nInvoice Number: ${invoiceData.id}\nDate: ${formatDisplayDate(invoiceData.invoiceDate)}\nSales Person: ${invoiceData.salesperson || 'N/A'}\nGrand Total: ${formatCurrency(invoiceData.totalAmount)} (USD)`;

  const grandTotalLabel = `${invoiceData.shipmentMode} TOTAL (USD):`;

  return (
    <div ref={printContainerRef} className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto', padding: '0' }}>
      <div className="p-4 flex flex-col flex-grow">
        <div className="print-header">
          <div className="flex justify-between items-start mb-2 gap-4">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-3 mb-2">
                {displayCompanyLogo && (
                  <Image
                    src={displayCompanyLogo}
                    alt={`${displayCompanyName} Logo`}
                    width={settings?.logoWidth || 50}
                    height={settings?.logoHeight || 50}
                    className="object-contain"
                    priority
                    data-ai-hint="company logo"
                  />
                )}
                {!hideCompanyName && (
                  <h1 className="text-xl font-bold text-gray-900">{displayCompanyName}</h1>
                )}
              </div>
              <p className="text-xs text-gray-600 whitespace-pre-line">{displayCompanyAddress}</p>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                {displayCompanyEmail && <span>Email: {displayCompanyEmail}</span>}
                {displayCompanyPhone && <span>Phone: {displayCompanyPhone}</span>}
              </div>
            </div>

            <div className="text-right min-w-[40%] flex-shrink-0">
              <h2 className="text-[clamp(1.25rem,4vw,1.875rem)] font-bold underline underline-offset-4 tracking-wider mb-2 whitespace-nowrap uppercase">
                {settings?.piHeaderTitle || 'PROFORMA INVOICE'}
              </h2>
              <div className="flex justify-end items-baseline gap-2 text-[12px] font-bold">
                <span className="font-semibold">Invoice Number :</span>
                <span>{invoiceData.id}</span>
              </div>
              <div className="flex justify-end items-baseline gap-2 text-[12px] font-bold">
                <span className="font-semibold">Date :</span>
                <span>{formatDisplayDate(invoiceData.invoiceDate)}</span>
              </div>
              {invoiceData.salesperson && (
                <div className="flex justify-end items-baseline gap-2 text-[12px] font-bold">
                  <span className="font-semibold">Sales Person :</span>
                  <span>{invoiceData.salesperson}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase underline">Bill To:</h3>
              <p className="text-gray-600 whitespace-pre-line">{invoiceData.billingAddress || customerData?.address || 'N/A'}</p>
              {customerData?.binNo && (
                <p className="text-gray-600">
                  <span>BIN: {customerData.binNo}</span>
                </p>
              )}
            </div>
            <div className="border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase underline tracking-wide">Deliver To:</h3>
              <p className="text-gray-600 whitespace-pre-line">{invoiceData.shippingAddress || invoiceData.billingAddress || customerData?.address || 'N/A'}</p>
            </div>
          </div>
        </div>

        {invoiceData.subject && (
          <div className="mt-2 mb-2">
            <p className="text-[12px] font-normal p-2 border rounded-md text-center">{invoiceData.subject}</p>
          </div>
        )}

        <div className="flex-grow-0">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '4%' }}>#</th>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '15%' }}>Image</th>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '43%' }}>Item Description</th>
                {showItemCodeColumn && <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '10%' }}>Item Code</th>}
                <th className="p-2 border border-gray-300 text-center font-semibold" style={{ width: '5%' }}>Qty</th>
                <th className="p-2 border border-gray-300 text-right font-semibold whitespace-nowrap" style={{ width: '10%' }}>Unit Price</th>
                {showDiscountColumn && <th className="p-2 border border-gray-300 text-right font-semibold" style={{ width: '8%' }}>Discount</th>}
                {showTaxColumn && <th className="p-2 border border-gray-300 text-right font-semibold" style={{ width: '8%' }}>Tax</th>}
                <th className="p-2 border border-gray-300 text-right font-semibold" style={{ width: '13%' }}>Total</th>
              </tr>
            </thead>
            <tbody >
              {invoiceData.lineItems.map((item, index) => (
                <tr key={`${item.itemId}-${index}`} className="border-b border-gray-200">
                  <td className="p-2 border border-gray-300 text-center align-top">{index + 1}</td>
                  <td className="p-2 border border-gray-300 align-middle text-center">
                    {item.imageUrl && (
                      <Image src={item.imageUrl} alt={item.itemName || 'Item image'} width={150} height={150} className="object-contain mx-auto" data-ai-hint="sewing machine" />
                    )}
                  </td>
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
            {invoiceData.comments && (
              <div className="space-y-1">
                <h4 className="underline font-bold text-gray-800 uppercase tracking-wide">TERMS AND CONDITIONS:</h4>
                <div className="text-gray-600 whitespace-pre-line font-bold">{invoiceData.comments}</div>
              </div>
            )}
          </div>
          <div className="w-auto text-sm space-y-1 min-w-[250px]">
            <div className="flex justify-between"><span className="text-gray-600 font-medium text-right">Subtotal:</span><span className="text-gray-800 text-right">{formatCurrency(invoiceData.subtotal)}</span></div>
            {showDiscountColumn && (<div className="flex justify-between"><span className="text-gray-600 font-medium text-right">Total Discount:</span><span className="text-gray-800 text-right">(-) {formatCurrency(invoiceData.totalDiscountAmount)}</span></div>)}
            {showTaxColumn && (<div className="flex justify-between"><span className="text-gray-600 font-medium text-right">Total Tax ({invoiceData.taxType}):</span><span className="text-gray-800 text-right">(+) {formatCurrency(invoiceData.totalTaxAmount)}</span></div>)}
            {(invoiceData.freightCharges || 0) > 0 && (
              <div className="flex justify-between"><span className="text-gray-600 font-medium text-right">Freight Charges:</span><span className="text-gray-800 text-right">(+) {formatCurrency(invoiceData.freightCharges)}</span></div>
            )}
            {(invoiceData.packingCharge || 0) > 0 && (
              <div className="flex justify-between"><span className="text-gray-600 font-medium text-right">Packing Charge:</span><span className="text-gray-800 text-right">(+) {formatCurrency(invoiceData.packingCharge)}</span></div>
            )}
            {(invoiceData.handlingCharge || 0) > 0 && (
              <div className="flex justify-between"><span className="text-gray-600 font-medium text-right">Handling Charge:</span><span className="text-gray-800 text-right">(+) {formatCurrency(invoiceData.handlingCharge)}</span></div>
            )}
            {(invoiceData.otherCharges || 0) > 0 && (
              <div className="flex justify-between"><span className="text-gray-600 font-medium text-right">Other Charges:</span><span className="text-gray-800 text-right">(+) {formatCurrency(invoiceData.otherCharges)}</span></div>
            )}
            <Separator className="my-2 border-gray-300" />
            <div className="flex justify-between text-base font-bold"><span className="text-gray-900 text-right" style={{ fontSize: '14px' }}>{grandTotalLabel}</span><span className="text-blue-600 text-right">{formatCurrency(invoiceData.totalAmount)}</span></div>
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
        <Button onClick={() => router.back()} variant="outline">
          Close
        </Button>
      </div>
    </div>
  );
}



"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { DemoChallanDocument, CompanyProfile, DemoMachineApplicationDocument } from '@/types';

import { Loader2, Printer, AlertTriangle, Share2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';

import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

export default function PrintDemoMachineChallanPage() {
  const params = useParams();
  const router = useRouter();
  const challanId = params.challanId as string;
  const printContainerRef = React.useRef<HTMLDivElement>(null);

  const [challanData, setChallanData] = useState<DemoChallanDocument | null>(null);
  const [applicationData, setApplicationData] = useState<DemoMachineApplicationDocument | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      setError(null);
      if (!challanId) {
        setError("No Challan ID provided.");
        setIsLoading(false);
        return;
      }

      try {
        const settingsDocRef = doc(firestore, 'financial_settings', 'main_settings');
        const challanDocRef = doc(firestore, "demo_machine_challans", challanId);
        const [settingsSnap, challanSnap] = await Promise.all([getDoc(settingsDocRef), getDoc(challanDocRef)]);

        if (settingsSnap.exists()) {
          setCompanySettings(settingsSnap.data() as CompanyProfile);
        } else {
          console.warn("Financial settings not found, using defaults.");
          setCompanySettings({}); // Use empty object if no settings found
        }

        if (challanSnap.exists()) {
          const challan = { id: challanSnap.id, ...challanSnap.data() } as DemoChallanDocument;
          setChallanData(challan);

          if (challan.linkedApplicationId) {
            const appDocRef = doc(firestore, "demo_machine_applications", challan.linkedApplicationId);
            const appDocSnap = await getDoc(appDocRef);
            if (appDocSnap.exists()) {
              setApplicationData(appDocSnap.data() as DemoMachineApplicationDocument);
            }
          }
        } else {
          setError("Demo Machine Challan not found.");
        }

      } catch (err: any) {
        setError(`Failed to fetch data: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, [challanId]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Demo Challan ${challanData?.id}`,
          text: `Here is the demo challan for ${challanData?.factoryName}.`,
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
      pdf.save(`Demo_Challan_${challanId}.pdf`);

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
        <p className="mt-4 text-gray-600">Loading Demo Challan...</p>
      </div>
    );
  }

  if (error || !challanData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600 font-semibold">Error Loading Demo Challan</p>
        <p className="text-gray-700 text-sm mb-4">{error || "Demo challan data could not be loaded."}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const { companyName, address, invoiceLogoUrl, hideCompanyName, emailId, cellNumber } = companySettings || {};
  const displayCompanyName = companyName || 'Your Company Name';
  const displayCompanyLogo = invoiceLogoUrl || 'https://placehold.co/400x100.png';
  const displayCompanyAddress = address || 'Your Company Address';



  return (
    <div ref={printContainerRef} className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto', padding: '0' }}>
      <div className="p-4 flex flex-col flex-grow">
        <div className="print-header">
          <div className="flex justify-between items-center mb-2">
            <div className="w-2/3 pr-8">
              {displayCompanyLogo && (
                <Image
                  src={displayCompanyLogo}
                  alt={`${displayCompanyName} Logo`}
                  width={328.9}
                  height={48.3}
                  className="object-contain mb-2"
                  priority
                  data-ai-hint="company logo"
                />
              )}
              {!hideCompanyName && (
                <h1 className="text-xl font-bold text-gray-900">{displayCompanyName}</h1>
              )}
              <p className="text-xs text-gray-600 whitespace-pre-line">{displayCompanyAddress}</p>
              {emailId && <p className="text-xs text-gray-600">Email: {emailId}</p>}
              {cellNumber && <p className="text-xs text-gray-600">Phone: {cellNumber}</p>}
            </div>

            <div className="text-right w-1/3">
              <h2 className="text-xl font-bold underline underline-offset-4 tracking-wider mb-2 whitespace-nowrap">DEMO M/C CHALLAN</h2>
              <div className="flex justify-end items-baseline gap-2 text-xs">
                <span className="font-semibold">Challan No :</span>
                <span>{challanData.id}</span>
              </div>
              <div className="flex justify-end items-baseline gap-2 text-xs">
                <span className="font-semibold">Date :</span>
                <span>{formatDisplayDate(challanData.challanDate)}</span>
              </div>
              <div className="flex justify-end items-baseline gap-2 text-xs">
                <span className="font-semibold">Application No :</span>
                <span>{challanData.linkedApplicationId || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-2">
            <div className="border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase">M/S:</h3>
              <p className="font-medium text-gray-900">{challanData.factoryName || 'N/A'}</p>
              <p className="text-gray-600 whitespace-pre-line">{challanData.deliveryAddress || 'N/A'}</p>
            </div>
            <div className="border p-2 rounded-md text-xs">
              <h3 className="font-semibold text-gray-700 mb-1 uppercase">DELIVER TO:</h3>
              <p className="font-medium text-gray-900">{challanData.factoryName || 'N/A'}</p>
              <p className="text-gray-600 whitespace-pre-line">{challanData.deliveryAddress || 'N/A'}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-2 text-xs">
            <div className="border p-2 rounded-md">
              <span className="font-semibold text-gray-700">Delivery Person:</span>
              <p className="font-medium text-gray-900">{challanData.deliveryPerson || 'N/A'}</p>
            </div>
            <div className="border p-2 rounded-md">
              <span className="font-semibold text-gray-700">Vehicle No:</span>
              <p className="font-medium text-gray-900">{challanData.vehicleNo || 'N/A'}</p>
            </div>
            {applicationData?.deliveryDate && (
              <div className="border p-2 rounded-md">
                <span className="font-semibold text-gray-700">Delivery Date:</span>
                <p className="font-medium text-gray-900">{formatDisplayDate(applicationData.deliveryDate)}</p>
              </div>
            )}
            {applicationData?.estReturnDate && (
              <div className="border p-2 rounded-md">
                <span className="font-semibold text-gray-700">Est. Return Date:</span>
                <p className="font-medium text-gray-900">{formatDisplayDate(applicationData.estReturnDate)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-grow mt-4">
          <table className="w-full text-sm border-collapse table-fixed">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '6%' }}>#</th>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '60%' }}>Description of Goods</th>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{ width: '12%' }}>Brand</th>
                <th className="p-2 border border-gray-300 text-center font-semibold" style={{ width: '20%' }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {challanData.lineItems.map((item, index) => (
                <tr key={`${item.demoMachineId}-${index}`} className="border-b border-gray-200">
                  <td className="p-2 border border-gray-300 text-center align-top">{index + 1}</td>
                  <td className="p-2 border border-gray-300 align-top break-words">
                    <p className="font-medium text-gray-900">{item.description}</p>
                  </td>
                  <td className="p-2 border border-gray-300 align-top">{applicationData?.appliedMachines.find(m => m.demoMachineId === item.demoMachineId)?.machineBrand || 'N/A'}</td>
                  <td className="p-2 border border-gray-300 text-center align-top">{item.qty}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 15 - challanData.lineItems.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-gray-200 h-9"><td className="p-2 border border-gray-300"></td><td className="p-2 border border-gray-300"></td><td className="p-2 border border-gray-300"></td><td className="p-2 border border-gray-300"></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="print-footer pb-4 px-4 mt-auto">
        <section className="flex justify-between items-end mb-2 pt-2">
          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400 pt-1"></div>
            <p className="pt-1 text-xs font-semibold text-gray-800">Receiver&apos;s Signature</p>
            <p className="pt-1 text-xs text-gray-800">Mobile:</p>
          </div>
          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400 pt-1"></div>
            <p className="pt-1 text-xs font-semibold text-gray-800">Store In-Charge Signature</p>
            <p className="pt-1 text-xs text-gray-800">Mobile:</p>
          </div>
          <div className="w-1/3 text-center">
            <div className="border-t border-dotted border-gray-400 pt-1"></div>
            <p className="pt-1 text-xs font-semibold text-gray-800">Authorized Signature</p>
            <p className="pt-1 text-xs text-gray-800">Mobile:</p>
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
          <Printer className="mr-2 h-4 w-4" /> Print Demo Challan
        </Button>
        <Button onClick={() => router.back()} variant="outline">
          Close
        </Button>
      </div>
    </div>
  );
}

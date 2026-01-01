
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
import { DemoChallanPrintTemplate } from '@/components/print/DemoChallanPrintTemplate';

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
        const piSettingsDocRef = doc(firestore, 'pi_layout_settings', 'main_settings');
        const challanDocRef = doc(firestore, "demo_machine_challans", challanId);
        const [settingsSnap, piSettingsSnap, challanSnap] = await Promise.all([
          getDoc(settingsDocRef),
          getDoc(piSettingsDocRef),
          getDoc(challanDocRef)
        ]);

        if (settingsSnap.exists()) {
          setCompanySettings(settingsSnap.data() as CompanyProfile);
        } else {
          console.warn("Financial settings not found, using defaults.");
          setCompanySettings({}); // Use empty object if no settings found
        }

        let piSettings = { logoWidth: 328.9, logoHeight: 48.3, piName: '' };
        if (piSettingsSnap.exists()) {
          const data = piSettingsSnap.data();
          piSettings = {
            logoWidth: data.logoWidth || 328.9,
            logoHeight: data.logoHeight || 48.3,
            piName: data.name || ''
          };
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

        // Return piSettings to be used in render (hacky since I can't change state definition easily here without full replace)
        return piSettings;

      } catch (err: any) {
        setError(`Failed to fetch data: ${err.message}`);
        return null;
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData().then((piSettings) => {
      if (piSettings) setLocalPiSettings(piSettings);
    });
  }, [challanId]);

  const [localPiSettings, setLocalPiSettings] = useState<{ logoWidth: number, logoHeight: number, piName: string }>({ logoWidth: 328.9, logoHeight: 48.3, piName: '' });

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


  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const autoDownload = searchParams ? searchParams.get('download') === 'true' : false;

  useEffect(() => {
    if (autoDownload && !isLoading && challanData) {
      // Small delay to ensure rendering is complete
      const timer = setTimeout(() => {
        handleDownloadPdf(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, challanData, autoDownload]);

  const handleDownloadPdf = async (shouldClose = false) => {
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

      if (shouldClose) {
        window.close();
      }

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
    <div className="bg-white min-h-screen">
      {/* Template Rendering for Print/Capture */}
      <DemoChallanPrintTemplate
        challanData={challanData}
        applicationData={applicationData}
        companySettings={companySettings}
        piSettings={localPiSettings}
        containerRef={printContainerRef}
      />

      {/* Utility Buttons */}
      <div className="print-only-utility-buttons mt-8 text-center noprint flex justify-center items-center gap-2 pb-8">
        <Button onClick={handleShare} variant="outline">
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
        <Button onClick={() => handleDownloadPdf(false)} variant="outline">
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

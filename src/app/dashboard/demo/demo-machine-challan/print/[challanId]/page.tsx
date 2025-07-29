
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { DemoChallanDocument, CompanyProfile, DemoMachineApplicationDocument } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';
import QRCode from 'react-qr-code';

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

            if(settingsSnap.exists()) {
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

  const { companyName, address, invoiceLogoUrl, hideCompanyName } = companySettings || {};
  const displayCompanyName = companyName || 'Your Company Name';
  const displayCompanyLogo = invoiceLogoUrl || 'https://placehold.co/400x100.png';
  const displayCompanyAddress = address || 'Your Company Address';

  const qrCodeValue = `DEMO M/C CHALLAN\nChallan No: ${challanData.id}\nDate: ${formatDisplayDate(challanData.challanDate)}\nApplication No: ${challanData.linkedApplicationId || 'N/A'}\nCustomer Name: ${challanData.factoryName || 'N/A'}\nAddress: ${challanData.deliveryAddress || 'N/A'}`;

  return (
    <div className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto', padding: '0' }}>
      <div className="p-4 flex flex-col flex-grow">
        <div className="print-header">
            <div className="flex justify-between items-start mb-2">
            <div className="w-2/3 pr-4">
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
            </div>
            
            <div className="p-1 border bg-white">
                <QRCode
                    value={qrCodeValue}
                    size={64}
                    bgColor={"#ffffff"}
                    fgColor={"#000000"}
                    level={"L"}
                />
            </div>

            <div className="text-right w-1/3">
                <h2 className="text-2xl font-bold underline underline-offset-4 tracking-wider mb-2 whitespace-nowrap">DEMO M/C CHALLAN</h2>
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
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{width: '10%'}}>#</th>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{width: '50%'}}>Description of Goods</th>
                <th className="p-2 border border-gray-300 text-left font-semibold" style={{width: '20%'}}>Brand</th>
                <th className="p-2 border border-gray-300 text-center font-semibold" style={{width: '20%'}}>Quantity</th>
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
        <section className="flex justify-between items-end mb-2 pt-16">
          <div className="w-1/3 text-left">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Receiver's Signature</p>
            <p className="pt-1 text-xs text-gray-800">Mobile:</p>
          </div>
          <div className="w-1/3 px-4 text-left">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Store In-Charge Signature</p>
            <p className="pt-1 text-xs text-gray-800">Mobile:</p>
          </div>
          <div className="w-1/3 text-left">
            <div className="border-t border-dotted border-gray-400"></div>
            <p className="pt-2 text-xs font-semibold text-gray-800">Authorized Signature</p>
            <p className="pt-1 text-xs text-gray-800">Mobile:</p>
          </div>
        </section>
      </div>

      <div className="print-only-utility-buttons mt-8 text-center noprint">
        <Button onClick={() => window.print()} variant="default" className="bg-blue-600 hover:bg-blue-700">
          <Printer className="mr-2 h-4 w-4" /> Print Demo Challan
        </Button>
        <Button onClick={() => router.back()} variant="outline" className="ml-2">
          Close
        </Button>
      </div>
    </div>
  );
}


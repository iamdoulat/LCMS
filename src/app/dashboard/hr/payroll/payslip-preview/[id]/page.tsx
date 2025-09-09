
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Loader2, Printer, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { Payslip } from '@/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';

const formatCurrency = (value?: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PayslipPreviewPage({ params }: { params: { id: string } }) {
  const { companyName, companyLogoUrl } = useAuth();
  const printContainerRef = React.useRef<HTMLDivElement>(null);
  
  const { data: payslip, isLoading, error } = useFirestoreQuery<Payslip>(
    doc(firestore, 'payslips', params.id),
    async (docSnap) => {
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Payslip;
        }
        return null;
    },
    ['payslip', params.id]
  );

  const handleDownloadPdf = async () => {
    const input = printContainerRef.current;
    if (!input) {
      Swal.fire("Error", "Could not find the content to download.", "error");
      return;
    }
    
    const utilityButtons = input.querySelector('.noprint') as HTMLElement;
    if (utilityButtons) utilityButtons.style.display = 'none';

    try {
      const canvas = await html2canvas(input, { scale: 3, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = (pdfHeight - imgHeight * ratio) / 2;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`Payslip_${payslip?.employeeName}_${payslip?.payPeriod}.pdf`);

    } catch (error) {
      console.error("Error generating PDF:", error);
      Swal.fire("Error", "An error occurred while generating the PDF.", "error");
    } finally {
        if (utilityButtons) utilityButtons.style.display = 'flex';
    }
  };
  
  if (isLoading) {
    return <div className="container mx-auto py-8 flex justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary"/></div>
  }
  
  if (error || !payslip) {
    return (
        <div className="container mx-auto py-8">
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Payslip</AlertTitle>
                <AlertDescription>{error?.message || "The requested payslip could not be found."}</AlertDescription>
            </Alert>
        </div>
    )
  }

  return (
    <div className="a5-page">
      <div ref={printContainerRef} className="max-w-[148mm] mx-auto bg-white dark:bg-card shadow-lg rounded-lg p-6 print:shadow-none print:border-none print:p-0">
          <header className="flex justify-between items-center pb-4 border-b">
              <div className="flex items-center gap-4">
                  {companyLogoUrl && <Image src={companyLogoUrl} alt="Company Logo" width={60} height={60} className="object-contain" data-ai-hint="company logo"/>}
                  <div>
                      <h1 className="text-xl font-bold text-primary">{companyName}</h1>
                      <p className="text-sm text-muted-foreground">Payslip for {payslip.payPeriod}</p>
                  </div>
              </div>
          </header>
          
          <section className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 text-xs">
              <div><strong>Employee Name:</strong> {payslip.employeeName}</div>
              <div><strong>Designation:</strong> {payslip.designation}</div>
              <div><strong>Employee Code:</strong> {payslip.employeeCode}</div>
              <div><strong>Pay Period:</strong> {payslip.payPeriod}</div>
          </section>
          
          <Separator className="my-4"/>

          <section className="grid grid-cols-2 gap-x-8">
               <div>
                  <h3 className="text-base font-semibold text-green-600 mb-2 underline">Earnings</h3>
                  <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>Basic Salary:</span> <span>{formatCurrency(payslip.basicSalary)}</span></div>
                      <div className="flex justify-between"><span>House Rent:</span> <span>{formatCurrency(payslip.houseRent)}</span></div>
                      <div className="flex justify-between"><span>Medical Allowance:</span> <span>{formatCurrency(payslip.medicalAllowance)}</span></div>
                      {/* Add other earning fields here as they are added to the Payslip type */}
                      <Separator className="my-2"/>
                       <div className="flex justify-between font-bold"><span>Total Earnings:</span> <span>{formatCurrency(payslip.grossSalary)}</span></div>
                  </div>
              </div>
               <div>
                  <h3 className="text-base font-semibold text-red-600 mb-2 underline">Deductions</h3>
                   <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>Tax Deduction:</span> <span>{formatCurrency(payslip.taxDeduction)}</span></div>
                      <div className="flex justify-between"><span>Provident Fund:</span> <span>{formatCurrency(payslip.providentFund)}</span></div>
                      {/* Add other deduction fields here */}
                      <Separator className="my-2"/>
                      <div className="flex justify-between font-bold"><span>Total Deductions:</span> <span>{formatCurrency(payslip.totalDeductions)}</span></div>
                  </div>
              </div>
          </section>

           <section className="mt-6 bg-muted/50 p-3 rounded-lg">
              <div className="flex justify-between items-center text-lg font-bold">
                  <span>Net Salary Payable:</span>
                  <span className="text-primary">{formatCurrency(payslip.netSalary)}</span>
              </div>
           </section>

           <footer className="mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
              <p>This is a computer-generated payslip and does not require a signature.</p>
              <p>{companyName} - {new Date().getFullYear()}</p>
           </footer>
      </div>
       <div className="text-center mt-6 noprint flex justify-center gap-4">
          <Button onClick={handleDownloadPdf}><Download className="mr-2 h-4 w-4"/>Download A5 PDF</Button>
          <Button onClick={() => window.print()} variant="outline"><Printer className="mr-2 h-4 w-4"/>Print</Button>
       </div>
    </div>
  );
}

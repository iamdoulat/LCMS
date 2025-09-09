
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Loader2, Printer, AlertTriangle } from 'lucide-react';
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

const formatCurrency = (value?: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PayslipPreviewPage({ params }: { params: { id: string } }) {
  const { companyName, companyLogoUrl } = useAuth();
  const { data: payslip, isLoading, error } = useFirestoreQuery<Payslip>(
    // This is not a query but a single document fetch. We can adapt the hook or do a direct fetch.
    // For simplicity, a direct fetch is fine for a single doc page. Let's adapt it.
    // The query key needs to be unique for this document.
    doc(firestore, 'payslips', params.id),
    async (docSnap) => {
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Payslip;
        }
        return null;
    },
    ['payslip', params.id]
  );
  
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
    <div className="container mx-auto py-8 bg-gray-100 dark:bg-gray-800 p-4 print:bg-white">
        <div className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg p-8 print:shadow-none print:border-none print:p-0">
            <header className="flex justify-between items-center pb-4 border-b">
                <div className="flex items-center gap-4">
                    {companyLogoUrl && <Image src={companyLogoUrl} alt="Company Logo" width={80} height={80} className="object-contain" data-ai-hint="company logo"/>}
                    <div>
                        <h1 className="text-2xl font-bold text-primary">{companyName}</h1>
                        <p className="text-muted-foreground">Payslip for {payslip.payPeriod}</p>
                    </div>
                </div>
                 <Button onClick={() => window.print()} className="noprint"><Printer className="mr-2 h-4 w-4"/>Print</Button>
            </header>
            
            <section className="grid grid-cols-2 gap-x-8 gap-y-4 mt-6 text-sm">
                <div><strong>Employee Name:</strong> {payslip.employeeName}</div>
                <div><strong>Designation:</strong> {payslip.designation}</div>
                <div><strong>Employee Code:</strong> {payslip.employeeCode}</div>
                <div><strong>Pay Period:</strong> {payslip.payPeriod}</div>
            </section>
            
            <Separator className="my-6"/>

            <section className="grid grid-cols-2 gap-x-16">
                 <div>
                    <h3 className="text-lg font-semibold text-green-600 mb-2">Earnings</h3>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Basic Salary:</span> <span>{formatCurrency(payslip.basicSalary)}</span></div>
                        <div className="flex justify-between"><span>House Rent:</span> <span>{formatCurrency(payslip.houseRent)}</span></div>
                        <div className="flex justify-between"><span>Medical Allowance:</span> <span>{formatCurrency(payslip.medicalAllowance)}</span></div>
                        {/* Add other earning fields here as they are added to the Payslip type */}
                        <Separator className="my-2"/>
                         <div className="flex justify-between font-bold"><span>Total Earnings:</span> <span>{formatCurrency(payslip.grossSalary)}</span></div>
                    </div>
                </div>
                 <div>
                    <h3 className="text-lg font-semibold text-red-600 mb-2">Deductions</h3>
                     <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>Tax Deduction:</span> <span>{formatCurrency(payslip.taxDeduction)}</span></div>
                        <div className="flex justify-between"><span>Provident Fund:</span> <span>{formatCurrency(payslip.providentFund)}</span></div>
                        {/* Add other deduction fields here */}
                        <Separator className="my-2"/>
                        <div className="flex justify-between font-bold"><span>Total Deductions:</span> <span>{formatCurrency(payslip.totalDeductions)}</span></div>
                    </div>
                </div>
            </section>

             <section className="mt-8 bg-muted/50 p-4 rounded-lg">
                <div className="flex justify-between items-center text-xl font-bold">
                    <span>Net Salary Payable:</span>
                    <span className="text-primary">{formatCurrency(payslip.netSalary)}</span>
                </div>
             </section>

             <footer className="mt-12 pt-6 border-t text-xs text-muted-foreground text-center">
                <p>This is a computer-generated payslip and does not require a signature.</p>
                <p>{companyName} - {new Date().getFullYear()}</p>
             </footer>
        </div>
    </div>
  );
}


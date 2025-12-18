
"use client";

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import type { PettyCashTransactionDocument, CompanyProfile } from '@/types';
import { format, parseISO, isValid } from 'date-fns';

import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const FINANCIAL_SETTINGS_DOC_ID = 'main_settings';
const DEFAULT_COMPANY_NAME = 'Your Company Name';
const DEFAULT_COMPANY_LOGO_URL = 'https://placehold.co/400x100.png';
const DEFAULT_ADDRESS = '236A Serangoon Road, #02-236A, Singapore 218084\nTel: +6593218129, Reg. No. 201610840K';

const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'dd/MM/yyyy') : 'N/A';
    } catch (e) {
        return 'N/A';
    }
};

const formatCurrencyValue = (amount?: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return `BDT N/A`;
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface ReportData {
    transactions: PettyCashTransactionDocument[];
    filters: {
        account: string;
        category: string;
        type: string;
        payee: string;
        dateFrom: string;
        dateTo: string;
    };
    totals: {
        totalDebits: number;
        totalCredits: number;
    };
}

function PrintPageContent() {
    const router = useRouter();
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCompanyProfile = useCallback(async () => {
        try {
            const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, FINANCIAL_SETTINGS_DOC_ID);
            const profileDocSnap = await getDoc(profileDocRef);
            if (profileDocSnap.exists()) {
                setCompanyProfile(profileDocSnap.data() as CompanyProfile);
            } else {
                setCompanyProfile({ companyName: DEFAULT_COMPANY_NAME, invoiceLogoUrl: DEFAULT_COMPANY_LOGO_URL, address: DEFAULT_ADDRESS });
            }
        } catch (e) {
            console.error("Error fetching company profile for print:", e);
            setCompanyProfile({ companyName: DEFAULT_COMPANY_NAME, invoiceLogoUrl: DEFAULT_COMPANY_LOGO_URL, address: DEFAULT_ADDRESS });
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await fetchCompanyProfile();
            const dataString = localStorage.getItem('pettyCashReportData');
            if (dataString) {
                try {
                    const parsedData: ReportData = JSON.parse(dataString);
                    setReportData(parsedData);
                } catch (e) {
                    console.error("Error parsing report data from localStorage", e);
                }
            }
            setIsLoading(false);
        };
        loadData();
    }, [fetchCompanyProfile]);

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        if (!isLoading && reportData) {
            const timer = setTimeout(() => handlePrint(), 500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, reportData]);


    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-gray-600">Generating Report...</p>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-white">
                <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-red-600 font-semibold">Error Generating Report</p>
                <p className="text-gray-700 text-sm mb-4">No report data found. Please generate the report again.</p>
                <Button onClick={() => router.back()}>Go Back</Button>
            </div>
        );
    }

    const { transactions, filters, totals } = reportData;
    const { companyName, address } = companyProfile || {};

    return (
        <div className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto', padding: '0' }}>
            <div className="p-4 flex flex-col flex-grow">
                <header className="flex justify-between items-center mb-4 print-header">
                    <div>
                        <h1 className="text-xl font-bold">{companyName || DEFAULT_COMPANY_NAME}</h1>
                        <p className="text-xs text-gray-600 whitespace-pre-line">{address || DEFAULT_ADDRESS}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-bold uppercase">Petty Cash Report</h2>
                        <p className="text-sm">Date: {format(new Date(), 'dd/MM/yyyy')}</p>
                    </div>
                </header>

                <div className="mb-4 p-2 border rounded-md text-xs">
                    <h3 className="font-semibold text-gray-700 mb-1 uppercase">Report Filters</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                        <p><strong>Date Range:</strong> {filters.dateFrom} to {filters.dateTo}</p>
                        <p><strong>Account:</strong> {filters.account}</p>
                        <p><strong>Category:</strong> {filters.category}</p>
                        <p><strong>Type:</strong> {filters.type}</p>
                        <p><strong>Payee/Payer:</strong> {filters.payee}</p>
                    </div>
                </div>

                <div className="flex-grow">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Payee/Payer</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Account</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell className="text-xs">{formatDisplayDate(tx.transactionDate)}</TableCell>
                                    <TableCell className="text-xs">{tx.payeeName}</TableCell>
                                    <TableCell className="text-xs">{tx.categoryNames?.join(', ')}</TableCell>
                                    <TableCell className="text-xs">{tx.accountName || 'N/A'}</TableCell>
                                    <TableCell className="text-right text-xs">{tx.type === 'Debit' ? formatCurrencyValue(tx.amount) : '-'}</TableCell>
                                    <TableCell className="text-right text-xs">{tx.type === 'Credit' ? formatCurrencyValue(tx.amount) : '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableCaption>
                            <div className="grid grid-cols-6 gap-4 font-bold text-sm text-foreground">
                                <div className="col-span-4 text-right">Totals:</div>
                                <div className="text-right text-red-600">{formatCurrencyValue(totals.totalDebits)}</div>
                                <div className="text-right text-green-600">{formatCurrencyValue(totals.totalCredits)}</div>
                            </div>
                            <div className="grid grid-cols-6 gap-4 font-bold text-base mt-2 pt-2 border-t text-foreground">
                                <div className="col-span-4 text-right">Net Flow:</div>
                                <div className="col-span-2 text-center">{formatCurrencyValue(totals.totalCredits - totals.totalDebits)}</div>
                            </div>
                        </TableCaption>
                    </Table>
                </div>
            </div>
            <footer className="print-footer pb-4 px-4 mt-auto">
                <section className="flex justify-between items-end mb-2 pt-16">
                    <div className="w-1/3 text-center">
                        <div className="border-t border-dotted border-gray-400"></div>
                        <p className="pt-2 text-xs font-semibold text-gray-800">Prepared By</p>
                    </div>
                    <div className="w-1/3 text-center">
                        <div className="border-t border-dotted border-gray-400"></div>
                        <p className="pt-2 text-xs font-semibold text-gray-800">Checked By</p>
                    </div>
                    <div className="w-1/3 text-center">
                        <div className="border-t border-dotted border-gray-400"></div>
                        <p className="pt-2 text-xs font-semibold text-gray-800">Authorized Signature</p>
                    </div>
                </section>
            </footer>

            <div className="print-only-utility-buttons mt-8 text-center noprint">
                <Button onClick={handlePrint} variant="default" className="bg-blue-600 hover:bg-blue-700">
                    <Printer className="mr-2 h-4 w-4" /> Print Report
                </Button>
                <Button onClick={() => router.back()} variant="outline" className="ml-2">
                    Close
                </Button>
            </div>
        </div>
    );
}


export default function PrintPettyCashReportPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <PrintPageContent />
        </Suspense>
    )
}

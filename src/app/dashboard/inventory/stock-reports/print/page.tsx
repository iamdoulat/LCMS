"use client";

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Printer, AlertTriangle, Download, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ItemDocument, CompanyProfile } from '@/types';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';

import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const FINANCIAL_SETTINGS_DOC_ID = 'main_settings';
const DEFAULT_COMPANY_NAME = 'Your Company Name';
const DEFAULT_ADDRESS = 'Your Company Address';

interface ReportData {
    items: ItemDocument[];
    filters: {
        category: string;
        section: string;
        brand: string;
        search: string;
        stockLevel: string;
    };
    generatedAt: string;
}

function PrintPageContent() {
    const router = useRouter();
    const printContainerRef = React.useRef<HTMLDivElement>(null);
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
                setCompanyProfile({ companyName: DEFAULT_COMPANY_NAME, address: DEFAULT_ADDRESS });
            }
        } catch (e) {
            console.error("Error fetching company profile for print:", e);
            setCompanyProfile({ companyName: DEFAULT_COMPANY_NAME, address: DEFAULT_ADDRESS });
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await fetchCompanyProfile();
            const dataString = localStorage.getItem('stockReportData');
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

    const handleDownloadPdf = async () => {
        const input = printContainerRef.current;
        if (!input) {
            Swal.fire("Error", "Could not find the content to download.", "error");
            return;
        }

        const utilityButtons = input.querySelector('.noprint') as HTMLElement;
        if (utilityButtons) utilityButtons.style.display = 'none';

        try {
            const canvas = await html2canvas(input, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgRatio = canvas.height / canvas.width;
            const imgHeight = pdfWidth * imgRatio;
            let heightLeft = imgHeight;

            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            pdf.save(`Stock_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            Swal.fire("Error", "An error occurred while generating the PDF.", "error");
        } finally {
            if (utilityButtons) utilityButtons.style.display = 'flex';
        }
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

    const { items, filters } = reportData;
    const { companyName, address } = companyProfile || {};

    return (
        <div ref={printContainerRef} className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto', padding: '0' }}>
            <div className="p-4 flex flex-col flex-grow">
                <header className="flex justify-between items-center mb-4 print-header">
                    <div>
                        <h1 className="text-xl font-bold">{companyName || DEFAULT_COMPANY_NAME}</h1>
                        <p className="text-xs text-gray-600 whitespace-pre-line">{address || DEFAULT_ADDRESS}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-bold uppercase">Stock Report</h2>
                        <p className="text-sm">Date: {format(new Date(), 'dd/MM/yyyy')}</p>
                    </div>
                </header>

                <div className="mb-4 p-2 border rounded-md text-xs">
                    <h3 className="font-semibold text-gray-700 mb-1 uppercase text-sm">Report Filters</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                        <p><strong>Stock Level:</strong> {filters.stockLevel}</p>
                        <p><strong>Category:</strong> {filters.category}</p>
                        <p><strong>Section:</strong> {filters.section}</p>
                        <p><strong>Brand:</strong> {filters.brand}</p>
                        <p><strong>Search:</strong> {filters.search}</p>
                    </div>
                </div>

                <div className="flex-grow">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item Name</TableHead>
                                <TableHead>Item Code</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Brand</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="text-xs font-medium">{item.itemName}</TableCell>
                                    <TableCell className="text-xs">{item.itemCode || 'N/A'}</TableCell>
                                    <TableCell className="text-xs">{item.category}</TableCell>
                                    <TableCell className="text-xs">{item.brandName || 'N/A'}</TableCell>
                                    <TableCell className="text-right text-xs">{item.currentQuantity || 0} {item.unit || ''}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <footer className="print-footer pb-4 px-4 mt-auto">
                <div className="text-xs text-gray-400 text-center mb-8">
                    <p>Total Items in Report: {items.length}</p>
                </div>
                <section className="flex justify-between items-end mb-2 pt-16">
                    <div className="w-1/3 text-center">
                        <div className="border-t border-dotted border-gray-400"></div>
                        <p className="pt-2 text-xs font-semibold text-gray-800">Store Keeper</p>
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

            <div className="print-only-utility-buttons mt-8 text-center noprint flex justify-center gap-4 py-8">
                <Button onClick={handleDownloadPdf} variant="default" className="bg-green-600 hover:bg-green-700">
                    <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
                <Button onClick={handlePrint} variant="default" className="bg-blue-600 hover:bg-blue-700">
                    <Printer className="mr-2 h-4 w-4" /> Print Report
                </Button>
                <Button onClick={() => router.back()} variant="outline">
                    Close
                </Button>
            </div>
        </div>
    );
}


export default function StockReportPrintPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <PrintPageContent />
        </Suspense>
    )
}

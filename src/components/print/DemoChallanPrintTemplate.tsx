
import React from 'react';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';
import type { DemoChallanDocument, CompanyProfile, DemoMachineApplicationDocument } from '@/types';

interface DemoChallanPrintTemplateProps {
    challanData: DemoChallanDocument;
    applicationData: DemoMachineApplicationDocument | null;
    companySettings: CompanyProfile | null;
    piSettings: { logoWidth: number; logoHeight: number; piName: string };
    containerRef?: React.RefObject<HTMLDivElement>;
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

export const DemoChallanPrintTemplate: React.FC<DemoChallanPrintTemplateProps> = ({
    challanData,
    applicationData,
    companySettings,
    piSettings,
    containerRef
}) => {
    const { companyName, address, invoiceLogoUrl, hideCompanyName, emailId, cellNumber } = companySettings || {};
    const displayCompanyName = companyName || 'Your Company Name';
    const displayCompanyLogo = invoiceLogoUrl || 'https://placehold.co/400x100.png';
    const displayCompanyAddress = address || 'Your Company Address';

    return (
        <div ref={containerRef} className="print-invoice-container bg-white font-sans text-gray-800 flex flex-col border" style={{ width: '210mm', minHeight: '297mm', margin: 'auto', padding: '0' }}>
            <div className="p-4 flex flex-col flex-grow">
                <div className="print-header">
                    <div className="flex justify-between items-center mb-2">
                        <div className="w-2/3 pr-8">
                            <div className="flex items-center gap-3 mb-2">
                                {displayCompanyLogo && (
                                    <Image
                                        src={displayCompanyLogo}
                                        alt={`${displayCompanyName} Logo`}
                                        width={piSettings.logoWidth}
                                        height={piSettings.logoHeight}
                                        className="object-contain"
                                        priority
                                        data-ai-hint="company logo"
                                    />
                                )}
                                {piSettings.piName && (
                                    <span className="text-lg font-bold text-gray-900">{piSettings.piName}</span>
                                )}
                            </div>
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
        </div>
    );
};

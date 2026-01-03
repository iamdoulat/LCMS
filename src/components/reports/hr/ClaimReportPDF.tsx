"use client";

import React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { HRClaim, ClaimDetail, CompanyProfile, Employee } from '@/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ClaimReportPDFProps {
    claim: HRClaim;
    employee?: Employee;
    companyProfile?: CompanyProfile;
}

const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'dd-MM-yyyy') : 'Invalid Date';
    } catch (e) {
        return 'N/A';
    }
};

const Header = ({ companyProfile }: { companyProfile?: CompanyProfile }) => (
    <header className="flex justify-between items-start mb-4 border-b pb-2">
        <div className="flex items-center gap-2">
            {companyProfile?.invoiceLogoUrl ? (
                <div className="flex flex-col">
                    <img src={companyProfile.invoiceLogoUrl} alt="Logo" className="h-10 object-contain" />
                </div>
            ) : (
                <div>
                    <h1 className="text-lg font-bold text-primary leading-tight">{companyProfile?.companyName || 'SMART SOLUTION®'}</h1>
                    <p className="text-[8px] uppercase font-semibold text-primary/80">Quality First Service Forever</p>
                </div>
            )}
        </div>
        <div className="text-right max-w-[250px]">
            <h2 className="text-[10px] font-bold uppercase">{companyProfile?.companyName || 'Smart Solution'}</h2>
            <p className="text-[8px] text-gray-600 leading-tight capitalize">
                {companyProfile?.address || 'Living Crystal, House#50/A, 1st Floor (B-1), Road#10, Sector#10, Uttara, Dhaka-1230'}
            </p>
        </div>
    </header>
);

// Compact Layout (for Double Report) - Matches uploaded_image_0
const CompactTemplate = ({ claim, employee, companyProfile, title }: { claim: HRClaim, employee?: Employee, companyProfile?: CompanyProfile, title: string }) => {
    return (
        <div className="bg-white p-6 border-b-2 border-dashed last:border-0 relative" style={{ width: '210mm', minHeight: '148.5mm' }}>
            <div className="absolute top-2 right-6 text-[9px] text-gray-400 italic">{title}</div>
            <Header companyProfile={companyProfile} />

            <h3 className="text-center text-[12px] font-bold uppercase underline mb-3">Claim Details Report</h3>

            <table className="w-full text-[10px] mb-3 border-collapse border border-gray-300">
                <tbody>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50 w-[15%]">Employee Name</td>
                        <td className="border border-gray-300 p-1 w-[35%]">{claim.employeeName}</td>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50 w-[15%]">Employee Code</td>
                        <td className="border border-gray-300 p-1 w-[35%]">{claim.employeeCode || employee?.employeeCode || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Designation</td>
                        <td className="border border-gray-300 p-1">{employee?.designation || 'N/A'}</td>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Join Date</td>
                        <td className="border border-gray-300 p-1">{employee?.joinedDate ? formatDisplayDate(employee.joinedDate) : 'N/A'}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Branch</td>
                        <td className="border border-gray-300 p-1">{claim.branch || employee?.branch || 'N/A'}</td>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Department</td>
                        <td className="border border-gray-300 p-1">{employee?.department || 'N/A'}</td>
                    </tr>
                </tbody>
            </table>

            <table className="w-full text-[10px] mb-8 border-collapse border border-gray-300">
                <tbody>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50 w-[30%]">Claim Number</td>
                        <td className="border border-gray-300 p-1">{claim.claimNo}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Claim Create Date</td>
                        <td className="border border-gray-300 p-1">{formatDisplayDate(claim.claimDate)}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Description</td>
                        <td className="border border-gray-300 p-1">{claim.description || '-'}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Claim Date</td>
                        <td className="border border-gray-300 p-1">{formatDisplayDate(claim.claimDate)}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Categories</td>
                        <td className="border border-gray-300 p-1">{claim.claimCategories?.join(', ')}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Status</td>
                        <td className="border border-gray-300 p-1 font-semibold">{claim.status}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Claim Amount</td>
                        <td className="border border-gray-300 p-1">{claim.claimAmount?.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Sanctioned Amount</td>
                        <td className="border border-gray-300 p-1">{claim.sanctionedAmount?.toFixed(2) || '0.00'}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Advance Amount</td>
                        <td className="border border-gray-300 p-1">{claim.advancedAmount?.toFixed(2) || '0.00'}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Approved By</td>
                        <td className="border border-gray-300 p-1">-</td>
                    </tr>
                </tbody>
            </table>

            <div className="flex justify-between items-end mt-4 px-10 pt-4">
                <div className="text-center w-[120px] pt-1 border-t border-black text-[9px] font-bold">Admin / Accounts</div>
                <div className="text-center w-[120px] pt-1 border-t border-black text-[9px] font-bold">Employee</div>
            </div>

            <div className="mt-4 flex justify-between text-[8px] text-gray-400">
                <p>Printed on {format(new Date(), 'dd-MM-yyyy hh:mm a')}</p>
                <p>Page 1 of 1</p>
            </div>
        </div>
    );
}

// Comprehensive Layout (for Single Report) - Matches uploaded_image_1
const ComprehensiveTemplate = ({ claim, employee, companyProfile }: { claim: HRClaim, employee?: Employee, companyProfile?: CompanyProfile }) => {
    return (
        <div className="bg-white p-6" style={{ width: '148mm', minHeight: '210mm' }}>
            <Header companyProfile={companyProfile} />

            <h3 className="text-center text-[12px] font-bold uppercase underline mb-3">Claim Details Report</h3>

            <table className="w-full text-[9px] mb-3 border-collapse border border-gray-300">
                <tbody>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50 w-[20%]">Employee Name</td>
                        <td className="border border-gray-300 p-1 w-[30%]">{claim.employeeName}</td>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50 w-[20%]">Employee Code</td>
                        <td className="border border-gray-300 p-1 w-[30%]">{claim.employeeCode || employee?.employeeCode || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Designation</td>
                        <td className="border border-gray-300 p-1">{employee?.designation || 'N/A'}</td>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Department</td>
                        <td className="border border-gray-300 p-1">{employee?.department || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Claim Create Date</td>
                        <td className="border border-gray-300 p-1">{formatDisplayDate(claim.claimDate)}</td>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Claim Date</td>
                        <td className="border border-gray-300 p-1">{formatDisplayDate(claim.claimDate)}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Claim Number</td>
                        <td className="border border-gray-300 p-1">{claim.claimNo}</td>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Claim Status</td>
                        <td className="border border-gray-300 p-1 font-semibold text-primary">{claim.status}</td>
                    </tr>
                    <tr>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Claim Amount</td>
                        <td className="border border-gray-300 p-1">{claim.claimAmount?.toFixed(2)}</td>
                        <td className="border border-gray-300 p-1 font-bold bg-gray-50">Description</td>
                        <td className="border border-gray-300 p-1">{claim.description || '-'}</td>
                    </tr>
                </tbody>
            </table>

            <h4 className="text-[10px] font-bold mb-1">Category Wise Claim Info</h4>
            <table className="w-full text-[8px] mb-4 border-collapse border border-gray-300">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="border border-gray-300 p-1 text-left">Category</th>
                        <th className="border border-gray-300 p-1 text-left">Remarks</th>
                        <th className="border border-gray-300 p-1 text-center">From</th>
                        <th className="border border-gray-300 p-1 text-center">To</th>
                        <th className="border border-gray-300 p-1 text-right">Amount</th>
                        <th className="border border-gray-300 p-1 text-right">Appr.</th>
                    </tr>
                </thead>
                <tbody>
                    {claim.details && claim.details.length > 0 ? (
                        claim.details.map((detail, idx) => (
                            <tr key={idx}>
                                <td className="border border-gray-300 p-1 text-[7px]">{detail.categoryName}</td>
                                <td className="border border-gray-300 p-1 text-[7px] text-gray-500 truncate max-w-[80px]">{detail.description || '-'}</td>
                                <td className="border border-gray-300 p-1 text-[7px] text-center whitespace-nowrap">{formatDisplayDate(detail.fromDate)}</td>
                                <td className="border border-gray-300 p-1 text-[7px] text-center whitespace-nowrap">{formatDisplayDate(detail.toDate)}</td>
                                <td className="border border-gray-300 p-1 text-[7px] text-right">{detail.amount.toFixed(2)}</td>
                                <td className="border border-gray-300 p-1 text-[7px] text-right">{detail.approvedAmount?.toFixed(2) || '0.00'}</td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={6} className="border border-gray-300 p-2 text-center text-gray-400">No details available</td></tr>
                    )}
                </tbody>
            </table>

            <div className="flex justify-end mb-6">
                <table className="w-[60%] text-[8px] border-collapse border border-gray-300">
                    <tbody>
                        <tr><td className="border border-gray-300 p-0.5 font-bold bg-gray-50">Total Claim</td><td className="border border-gray-300 p-0.5 text-right font-bold">{claim.claimAmount?.toFixed(2)}</td></tr>
                        <tr><td className="border border-gray-300 p-0.5 font-bold bg-gray-50">Total Appr.</td><td className="border border-gray-300 p-0.5 text-right">{claim.approvedAmount?.toFixed(2) || '0.00'}</td></tr>
                        <tr><td className="border border-gray-300 p-0.5 font-bold bg-gray-50">Sanctioned</td><td className="border border-gray-300 p-0.5 text-right">{claim.sanctionedAmount?.toFixed(2) || '0.00'}</td></tr>
                        <tr><td className="border border-gray-300 p-0.5 font-bold bg-gray-50">Advance</td><td className="border border-gray-300 p-0.5 text-right text-orange-600">{claim.advancedAmount?.toFixed(2) || '0.00'}</td></tr>
                        <tr className="bg-primary/5"><td className="border border-gray-300 p-1 font-bold text-primary">Remaining</td><td className="border border-gray-300 p-1 text-right font-bold text-primary">{claim.remainingAmount?.toFixed(2) || '0.00'}</td></tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-auto pt-10 flex justify-between items-end px-4">
                <div className="text-center w-[120px] pt-1 border-t border-black text-[9px] font-bold">Admin / Accounts</div>
                <div className="text-center w-[120px] pt-1 border-t border-black text-[9px] font-bold">Employee Signature</div>
            </div>

            <div className="flex justify-between items-center text-[7px] text-gray-400 mt-4">
                <p>Printed on {format(new Date(), 'dd-MM-yyyy hh:mm a')}</p>
                <p>Page 1 of 1</p>
            </div>
        </div>
    );
};

export const generateClaimPDF = async (claim: HRClaim, employee?: Employee, companyProfile?: CompanyProfile, isDouble: boolean = false) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const root = (await import('react-dom/client')).createRoot(container);

    return new Promise<void>((resolve) => {
        root.render(
            <div style={{ background: 'white' }}>
                {isDouble ? (
                    <>
                        <CompactTemplate claim={claim} employee={employee} companyProfile={companyProfile} title="Office Copy" />
                        <CompactTemplate claim={claim} employee={employee} companyProfile={companyProfile} title="Employee Copy" />
                    </>
                ) : (
                    <ComprehensiveTemplate claim={claim} employee={employee} companyProfile={companyProfile} />
                )}
            </div>
        );

        setTimeout(async () => {
            try {
                const canvas = await html2canvas(container, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgRatio = canvas.height / canvas.width;
                const imgHeight = pdfWidth * imgRatio;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
                pdf.save(`Claim_${isDouble ? 'Double_' : ''}Report_${claim.claimNo}.pdf`);
                document.body.removeChild(container);
                resolve();
            } catch (error) {
                console.error("PDF Generation Error:", error);
                document.body.removeChild(container);
                resolve();
            }
        }, 1000);
    });
};

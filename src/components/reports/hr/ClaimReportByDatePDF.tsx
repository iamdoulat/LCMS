"use client";

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, isValid } from 'date-fns';
import type { HRClaim, CompanyProfile, Employee } from '@/types';

interface ClaimReportData {
  claims: HRClaim[];
  employee: Employee;
  companyProfile?: CompanyProfile;
  fromDate: Date;
  toDate: Date;
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

export const generateClaimReportByDatePDF = async (data: ClaimReportData) => {
  const { claims, employee, companyProfile, fromDate, toDate } = data;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // ═══════════════════════════════════════════
  // ─── HEADER: Company Left | Report Right ───
  // ═══════════════════════════════════════════

  // Company Name (left)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(30, 58, 138);
  const compName = companyProfile?.companyName || 'Company Name';
  pdf.text(compName, margin, yPos + 2);

  // Report Title (right)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(30, 58, 138);
  pdf.text('Claim Report', pageWidth - margin, yPos + 2, { align: 'right' });

  yPos += 7;

  // Company Address (left)
  if (companyProfile?.address) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);
    // Split long address into lines that fit within half page
    const maxAddrWidth = (pageWidth / 2) - margin - 5;
    const addrLines = pdf.splitTextToSize(companyProfile.address, maxAddrWidth);
    addrLines.forEach((line: string) => {
      pdf.text(line, margin, yPos);
      yPos += 3.5;
    });
  }

  // Date Range (right, aligned below "Claim Report")
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);
  const dateRangeStr = `${format(fromDate, 'dd-MM-yyyy')} to ${format(toDate, 'dd-MM-yyyy')}`;
  // Position this right below the "Claim Report" title
  const dateRangeY = margin + 7;
  pdf.text(dateRangeStr, pageWidth - margin, dateRangeY, { align: 'right' });

  // Claim Generate Date (right, below date range)
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Generated: ${format(new Date(), 'dd-MM-yyyy hh:mm a')}`, pageWidth - margin, dateRangeY + 5, { align: 'right' });

  // Ensure yPos is past the header area
  yPos = Math.max(yPos, margin + 18) + 2;

  // Separator line
  pdf.setDrawColor(30, 58, 138);
  pdf.setLineWidth(0.6);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // ═══════════════════════════════════════════
  // ─── EMPLOYEE INFO TABLE ───────────────────
  // ═══════════════════════════════════════════

  // Draw info box using autoTable for clean alignment
  const leftColX = margin + 4;
  const leftValX = margin + 38;
  const rightColX = pageWidth / 2 + 5;
  const rightValX = pageWidth / 2 + 36;
  const rowH = 6.5;

  // Background box
  const infoBoxH = rowH * 3 + 6;
  pdf.setFillColor(240, 243, 255);
  pdf.setDrawColor(200, 210, 240);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin, yPos, contentWidth, infoBoxH, 2, 2, 'FD');

  const infoStartY = yPos + 5;

  // Helper function for label-value pairs
  const drawInfoRow = (label: string, value: string, x: number, valX: number, y: number) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(30, 58, 138);
    pdf.text(label, x, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(40, 40, 40);
    pdf.text(value, valX, y);
  };

  // Row 1
  drawInfoRow('Employee Name:', employee.fullName || '-', leftColX, leftValX, infoStartY);
  drawInfoRow('Employee ID:', employee.employeeCode || '-', rightColX, rightValX, infoStartY);

  // Row 2
  drawInfoRow('Designation:', employee.designation || '-', leftColX, leftValX, infoStartY + rowH);
  drawInfoRow('Department:', employee.department || '-', rightColX, rightValX, infoStartY + rowH);

  // Row 3
  drawInfoRow('Branch:', employee.branch || '-', leftColX, leftValX, infoStartY + rowH * 2);
  drawInfoRow('Report Date:', format(new Date(), 'dd-MM-yyyy'), rightColX, rightValX, infoStartY + rowH * 2);

  yPos += infoBoxH + 6;

  // ═══════════════════════════════════════════
  // ─── CLAIMS TABLE ──────────────────────────
  // ═══════════════════════════════════════════

  const tableData = claims.map((claim, idx) => [
    claim.claimNo || `CLM-${idx + 1}`,
    formatDisplayDate(claim.claimDate),
    (claim.claimCategories || []).join(', '),
    (claim.advancedAmount || 0).toFixed(2),
    (claim.claimAmount || 0).toFixed(2),
    (claim.approvedAmount || 0).toFixed(2),
  ]);

  // Calculate totals
  const totalAdvAmt = claims.reduce((sum, c) => sum + (c.advancedAmount || 0), 0);
  const totalClaimAmt = claims.reduce((sum, c) => sum + (c.claimAmount || 0), 0);
  const totalApprAmt = claims.reduce((sum, c) => sum + (c.approvedAmount || 0), 0);

  autoTable(pdf, {
    startY: yPos,
    head: [[
      'Claim ID',
      'Claim Date',
      'Claim Categories',
      'Adv. Amt.',
      'Claim Amt.',
      'Appr. Amt.',
    ]],
    body: tableData,
    foot: [[
      '', '', 'Total Claim Amount:',
      totalAdvAmt.toFixed(2),
      totalClaimAmt.toFixed(2),
      totalApprAmt.toFixed(2),
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [50, 50, 50],
    },
    footStyles: {
      fillColor: [235, 240, 255],
      textColor: [30, 58, 138],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'right',
      cellPadding: 3,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 28 },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'left', cellWidth: 'auto' },
      3: { halign: 'right', cellWidth: 22 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 22 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 255],
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data: any) => {
      // Footer on each page
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Printed on ${format(new Date(), 'dd-MM-yyyy hh:mm a')}`,
        margin,
        pageHeight - 8
      );
      pdf.text(
        `Page ${data.pageNumber}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: 'right' }
      );
    },
  });

  // ═══════════════════════════════════════════
  // ─── SIGNATURE SECTION ─────────────────────
  // ═══════════════════════════════════════════

  const finalY = (pdf as any).lastAutoTable?.finalY || yPos + 40;
  let sigY = finalY + 25;

  const pageHeight = pdf.internal.pageSize.getHeight();

  // If not enough space, add a new page
  if (sigY + 20 > pageHeight - 15) {
    pdf.addPage();
    sigY = 40;
  }

  pdf.setDrawColor(60, 60, 60);
  pdf.setLineWidth(0.3);

  // Admin/Accounts signature line
  const leftLineStart = margin + 10;
  const leftLineEnd = margin + 65;
  pdf.line(leftLineStart, sigY, leftLineEnd, sigY);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(40, 40, 40);
  const leftLabel = 'Admin / Accounts';
  const leftLabelWidth = pdf.getTextWidth(leftLabel);
  const leftCenter = leftLineStart + (leftLineEnd - leftLineStart - leftLabelWidth) / 2;
  pdf.text(leftLabel, leftCenter, sigY + 6);

  // Employee signature line
  const rightLineStart = pageWidth - margin - 65;
  const rightLineEnd = pageWidth - margin - 10;
  pdf.line(rightLineStart, sigY, rightLineEnd, sigY);
  const rightLabel = 'Employee';
  const rightLabelWidth = pdf.getTextWidth(rightLabel);
  const rightCenter = rightLineStart + (rightLineEnd - rightLineStart - rightLabelWidth) / 2;
  pdf.text(rightLabel, rightCenter, sigY + 6);

  // Save PDF
  const fileName = `Claim_Report_${employee.employeeCode || 'EMP'}_${format(fromDate, 'ddMMyyyy')}_${format(toDate, 'ddMMyyyy')}.pdf`;
  pdf.save(fileName);
};

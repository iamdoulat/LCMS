/* eslint-disable no-console */
import { admin } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/sender';
import { sendWhatsApp } from '@/lib/whatsapp/sender';
import type { HRClaim } from '@/types';

/**
 * Internal function that executes the actual notification logic.
 * This should ONLY be imported and called on the server to avoid
 * bundling server-only modules (like nodemailer) on the client.
 */
export async function sendClaimStatusNotificationsInternal(claim: HRClaim) {
    try {
        const db = admin.firestore();
        
        if (!claim.employeeId) {
            console.error('sendClaimStatusNotificationsInternal: No employeeId found in claim', claim.id);
            return;
        }

        const status = claim.status;
        let emailSlug = '';
        let waSlug = '';

        if (status === 'Approved') {
            emailSlug = 'claim-approved';
            waSlug = 'claim-approved-whatsapp';
        } else if (status === 'Disbursed') {
            emailSlug = 'claim-disbursed';
            waSlug = 'claim-disbursed-whatsapp';
        } else if (status === 'Claimed') {
            emailSlug = 'claim-reverted';
            waSlug = 'claim-reverted-whatsapp';
        } else {
            console.log(`sendClaimStatusNotificationsInternal: No notification logic for status "${status}"`, claim.id);
            return;
        }

        console.log(`sendClaimStatusNotificationsInternal: Processing ${status} notification for ${claim.claimNo}`, { emailSlug, waSlug });

        // 1. Fetch Employee Details from 'employees' collection (following other templates pattern)
        const empDoc = await db.collection('employees').doc(claim.employeeId).get();
        if (!empDoc.exists) {
            console.error('sendClaimStatusNotificationsInternal: Employee not found in employees collection', claim.employeeId);
            return;
        }

        const employee = empDoc.data();
        const email = employee?.email;
        const phone = employee?.phone;

        console.log(`sendClaimStatusNotificationsInternal: Found employee ${employee?.fullName || employee?.name}`, { email, phone });

        if (!email && !phone) {
            console.warn('sendClaimStatusNotificationsInternal: Employee has no email or phone', claim.employeeId);
            return;
        }

        const approvedAmt = claim.approvedAmount || 0;
        const totalAmt = claim.claimAmount || 0;
        const dueAmt = totalAmt - approvedAmt;

        // Build combined supervisor comment including per-category comments
        const mainComment = claim.supervisorComments || (claim as any).rejectionReason || '';
        const categoryComments: string[] = [];
        if (claim.details && Array.isArray(claim.details)) {
            for (const detail of claim.details) {
                if (detail.supervisorComment && detail.supervisorComment.trim()) {
                    categoryComments.push(`[${detail.categoryName}] ${detail.supervisorComment.trim()}`);
                }
            }
        }

        let combinedComment = mainComment;
        if (categoryComments.length > 0) {
            combinedComment = combinedComment
                ? `${combinedComment}\n${categoryComments.join('\n')}`
                : categoryComments.join('\n');
        }
        if (!combinedComment) {
            combinedComment = 'No comments provided.';
        }

        // Build HTML version for email (with category labels styled)
        let combinedCommentHtml = '';
        if (mainComment) {
            combinedCommentHtml += mainComment;
        }
        if (categoryComments.length > 0) {
            const categoryHtmlParts = (claim.details || [])
                .filter((d: any) => d.supervisorComment && d.supervisorComment.trim())
                .map((d: any) => `<br/><strong style="color:#d97706;text-transform:uppercase;">${d.categoryName}:</strong> ${d.supervisorComment.trim()}`);
            combinedCommentHtml += categoryHtmlParts.join('');
        }
        if (!combinedCommentHtml) {
            combinedCommentHtml = 'No comments provided.';
        }

        const templateData = {
            EmployeeName: employee?.fullName || employee?.name || 'Employee',
            claimNo: claim.claimNo,
            Amount: approvedAmt.toLocaleString(),
            ApprovedAmount: approvedAmt.toLocaleString(),
            DueAmount: dueAmt.toLocaleString(),
            SupervisorComment: combinedCommentHtml,       // HTML version for email
            SupervisorCommentText: combinedComment,        // Plain text for WhatsApp
        };

        // 2. Send Email
        if (email) {
            try {
                console.log(`sendClaimStatusNotificationsInternal: Sending email to ${email} via template ${emailSlug}`);
                await sendEmail({
                    to: email,
                    templateSlug: emailSlug,
                    data: templateData
                });
                console.log(`sendClaimStatusNotificationsInternal: Email sent successfully to ${email}`);
            } catch (emailErr) {
                console.error(`Failed to send claim ${status.toLowerCase()} email to ${email}:`, emailErr);
            }
        }

        // 3. Send WhatsApp
        if (phone) {
            try {
                console.log(`sendClaimStatusNotificationsInternal: Sending WhatsApp to ${phone} via template ${waSlug}`);
                await sendWhatsApp({
                    to: phone,
                    templateSlug: waSlug,
                    data: { ...templateData, SupervisorComment: templateData.SupervisorCommentText }
                });
                console.log(`sendClaimStatusNotificationsInternal: WhatsApp sent successfully to ${phone}`);
            } catch (waErr) {
                console.error(`Failed to send claim ${status.toLowerCase()} WhatsApp to ${phone}:`, waErr);
            }
        }

    } catch (error) {
        console.error('Error in sendClaimApprovalNotificationsInternal:', error);
    }
}

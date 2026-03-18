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
        
        const templateData = {
            EmployeeName: employee?.fullName || employee?.name || 'Employee',
            claimNo: claim.claimNo,
            Amount: approvedAmt.toLocaleString(), // Primarily show approved amount as the main "Amount"
            ApprovedAmount: approvedAmt.toLocaleString(),
            DueAmount: dueAmt.toLocaleString(),
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
                    data: templateData
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

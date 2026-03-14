import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { sendEmail } from '@/lib/email/sender';
import { sendWhatsApp } from '@/lib/whatsapp/sender';
import type { HRClaim, Employee } from '@/types';

/**
 * Internal function that executes the actual notification logic.
 * This should ONLY be imported and called on the server to avoid
 * bundling server-only modules (like nodemailer) on the client.
 */
export async function sendClaimStatusNotificationsInternal(claim: HRClaim) {
    try {
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
            // No notifications for other statuses currently
            return;
        }

        // 1. Fetch Employee Details
        const empDoc = await getDoc(doc(firestore, 'employees', claim.employeeId));
        if (!empDoc.exists()) {
            console.error('sendClaimStatusNotificationsInternal: Employee not found', claim.employeeId);
            return;
        }

        const employee = empDoc.data() as Employee;
        const email = employee.email;
        const phone = employee.phone;

        if (!email && !phone) {
            console.warn('sendClaimStatusNotificationsInternal: Employee has no email or phone', claim.employeeId);
            return;
        }

        const approvedAmt = claim.approvedAmount || 0;
        const totalAmt = claim.claimAmount || 0;
        const dueAmt = totalAmt - approvedAmt;
        
        const templateData = {
            EmployeeName: employee.fullName || 'Employee',
            claimNo: claim.claimNo,
            Amount: approvedAmt.toLocaleString(), // Primarily show approved amount as the main "Amount"
            ApprovedAmount: approvedAmt.toLocaleString(),
            DueAmount: dueAmt.toLocaleString(),
        };

        // 2. Send Email
        if (email) {
            try {
                await sendEmail({
                    to: email,
                    templateSlug: emailSlug,
                    data: templateData
                });
            } catch (emailErr) {
                console.error(`Failed to send claim ${status.toLowerCase()} email:`, emailErr);
            }
        }

        // 3. Send WhatsApp
        if (phone) {
            try {
                await sendWhatsApp({
                    to: phone,
                    templateSlug: waSlug,
                    data: templateData
                });
            } catch (waErr) {
                console.error(`Failed to send claim ${status.toLowerCase()} WhatsApp:`, waErr);
            }
        }

    } catch (error) {
        console.error('Error in sendClaimApprovalNotificationsInternal:', error);
    }
}

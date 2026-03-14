import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';

export async function GET() {
    try {
        const db = admin.firestore();
        
        // 1. Email Template
        const emailTemplate = {
            slug: 'claim-approved',
            name: 'Claim Approved Notification',
            subject: 'Claim Approved: {{claimNo}}',
            body: `<p>Dear {{EmployeeName}},</p>
<p>Your claim <strong>#{{claimNo}}</strong> for <strong>৳{{Amount}}</strong> has been approved.</p>
<p>Please contact the <strong>Accounts Department</strong> to receive your disbursed amount.</p>
<p>Regards,<br>NextSew Team</p>`,
            variables: ['EmployeeName', 'claimNo', 'Amount'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('email_templates').doc('claim-approved').set(emailTemplate, { merge: true });

        // 2. WhatsApp Template
        const whatsappTemplate = {
            slug: 'claim-approved-whatsapp',
            name: 'Claim Approved Notification (WhatsApp)',
            body: 'Hello *{{EmployeeName}}*, Your claim *{{claimNo}}* for *৳{{Amount}}* has been approved. Please contact Accounts for your disbursed payment. Thanks!',
            variables: ['EmployeeName', 'claimNo', 'Amount'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('whatsapp_templates').doc('claim-approved-whatsapp').set(whatsappTemplate, { merge: true });

        // 3. Disbursed Email Template
        const disbursedEmailTemplate = {
            slug: 'claim-disbursed',
            name: 'Claim Disbursed Notification',
            subject: 'Claim Disbursed: {{claimNo}}',
            body: `<p>Dear {{EmployeeName}},</p>
<p>Your claim <strong>#{{claimNo}}</strong> for <strong>৳{{Amount}}</strong> has been disbursed.</p>
<p><strong>Details:</strong></p>
<ul>
    <li>Approved Amount: ৳{{ApprovedAmount}}</li>
    <li>Due Amount: ৳{{DueAmount}}</li>
</ul>
<p>Please check your account or contact the <strong>Accounts Department</strong> for confirmation.</p>
<p>Regards,<br>NextSew Team</p>`,
            variables: ['EmployeeName', 'claimNo', 'Amount', 'ApprovedAmount', 'DueAmount'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('email_templates').doc('claim-disbursed').set(disbursedEmailTemplate, { merge: true });

        // 4. Disbursed WhatsApp Template
        const disbursedWhatsappTemplate = {
            slug: 'claim-disbursed-whatsapp',
            name: 'Claim Disbursed Notification (WhatsApp)',
            body: 'Hello *{{EmployeeName}}*, Your claim *{{claimNo}}* for *৳{{Amount}}* has been disbursed. Approved: *৳{{ApprovedAmount}}*, Due: *৳{{DueAmount}}*. Please check with Accounts for confirmation. Thanks!',
            variables: ['EmployeeName', 'claimNo', 'Amount', 'ApprovedAmount', 'DueAmount'],
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('whatsapp_templates').doc('claim-disbursed-whatsapp').set(disbursedWhatsappTemplate, { merge: true });

        return NextResponse.json({ 
            success: true, 
            message: 'Claim approval and disbursement templates seeded successfully',
            templates: ['claim-approved', 'claim-approved-whatsapp', 'claim-disbursed', 'claim-disbursed-whatsapp']
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

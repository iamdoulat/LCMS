
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env' });

const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: (process.env.FIREBASE_ADMIN_PROJECT_ID || '').trim(),
            clientEmail: (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '').trim(),
            privateKey: privateKey,
        }),
    });
}
const db = admin.firestore();

const templates = [
    {
        slug: 'admin_new_advance_salary_request',
        name: 'Admin: New Advance Salary Request',
        subject: 'New Advance Salary Request: {{employee_name}}',
        body: '<p>A new advance salary request has been submitted by <strong>{{employee_name}}</strong>.</p><p>Amount: {{amount}}</p><p>Reason: {{reason}}</p><p>Date: {{date}}</p><p><a href="{{link}}">View Request</a></p>',
        variables: ['{{employee_name}}', '{{amount}}', '{{reason}}', '{{date}}', '{{link}}']
    },
    {
        slug: 'employee_advance_salary_approved',
        name: 'Employee: Advance Salary Approved',
        subject: 'Advance Salary Request Approved',
        body: '<p>Dear {{employee_name}},</p><p>Your advance salary request for <strong>{{amount}}</strong> has been <strong>APPROVED</strong>.</p>',
        variables: ['{{employee_name}}', '{{amount}}']
    },
    {
        slug: 'employee_advance_salary_rejected',
        name: 'Employee: Advance Salary Rejected',
        subject: 'Advance Salary Request Rejected',
        body: '<p>Dear {{employee_name}},</p><p>Your advance salary request for <strong>{{amount}}</strong> has been <strong>REJECTED</strong>.</p><p><strong>Reason:</strong> {{rejection_reason}}</p>',
        variables: ['{{employee_name}}', '{{amount}}', '{{rejection_reason}}']
    }
];

async function seed() {
    const batch = db.batch();

    for (const t of templates) {
        // Delete existing to ensure clean update
        const q = await db.collection('email_templates').where('slug', '==', t.slug).get();
        q.forEach(d => batch.delete(d.ref));

        const ref = db.collection('email_templates').doc();
        batch.set(ref, {
            ...t,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Queued template: ${t.slug}`);
    }

    await batch.commit();
    console.log('Advance Salary Templates Created/Updated Successfully');
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

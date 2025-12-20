
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env' });
const { Resend } = require('resend');

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

async function debug() {
    console.log('--- Checking Admins ---');
    // Test the query I fixed
    const adminsSnapshot = await db.collection('users')
        .where('role', 'array-contains-any', ['Admin', 'HR', 'Super Admin'])
        .get();

    console.log(`Found ${adminsSnapshot.size} admin/hr/super_admin users.`);
    adminsSnapshot.docs.forEach(d => {
        console.log(`- ${d.id}: ${d.data().email} (Roles: ${JSON.stringify(d.data().role)})`);
    });

    console.log('\n--- Checking Employees ---');
    // Just list first 5 to see structure
    const employeesSnapshot = await db.collection('employees').limit(5).get();
    employeesSnapshot.docs.forEach(d => {
        console.log(`- ${d.id}: ${d.data().email} (Name: ${d.data().fullName})`);
    });

    console.log('\n--- Testing Resend Direct Send ---');
    if (!process.env.RESEND_API_KEY) {
        console.error('MISSING RESEND_API_KEY in .env');
    } else {
        try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const { data, error } = await resend.emails.send({
                from: 'Nextsew <onboarding@resend.dev>', // Default Resend test, or use env var if set
                to: ['mddoulat@gmail.com'], // Using the user's known testing email
                subject: 'Debug Test Email',
                html: '<p>This is a test to verify Resend is working.</p>'
            });

            if (error) {
                console.error('Resend Error:', error);
            } else {
                console.log('Resend Success:', data);
            }
        } catch (e) {
            console.error('Resend Exception:', e);
            console.error(e.message)
        }
    }
}

debug().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

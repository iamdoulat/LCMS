
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env' });

async function seedTemplate() {
    console.log("Seeding Default Email Template...");

    // Initialize Admin SDK
    if (!admin.apps.length) {
        try {
            const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: (process.env.FIREBASE_ADMIN_PROJECT_ID || '').trim(),
                    clientEmail: (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '').trim(),
                    privateKey: privateKey,
                }),
            });
            console.log("Admin SDK initialized.");
        } catch (e) {
            console.error("Failed to initialize Admin SDK:", e);
            process.exit(1);
        }
    }

    const db = admin.firestore();
    const templateSlug = 'account_creation_details';

    const templateData = {
        slug: templateSlug,
        name: 'Account Creation Welcome',
        subject: 'Welcome to {{company_name}} - Your Account Details',
        body: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Welcome, {{name}}!</h2>
        <p>We are excited to have you on board at {{company_name}}.</p>
        <p>Your employee account has been created. Here are your login details:</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Login URL:</strong> <a href="{{login_url}}">{{login_url}}</a></p>
          <p><strong>Username:</strong> {{user_name}}</p>
          <p><strong>Password:</strong> {{password}}</p>
        </div>
        <p>Please login and change your password immediately.</p>
        <p>Best regards,<br/>The HR Team</p>
        <hr/>
        <small style="color: #999;">Generated on {{date}}</small>
      </div>
    `,
        variables: ['{{name}}', '{{company_name}}', '{{login_url}}', '{{user_name}}', '{{password}}', '{{date}}'],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
        const docRef = db.collection('email_templates').doc(); // Auto ID or use slug as ID? 
        // Usually usage queries by 'slug' field, but let's query first to avoid duplicates.
        const snapshot = await db.collection('email_templates').where('slug', '==', templateSlug).get();

        if (!snapshot.empty) {
            console.log(`Template '${templateSlug}' already exists. Skipping.`);
        } else {
            await db.collection('email_templates').add(templateData);
            console.log(`SUCCESS: Template '${templateSlug}' created.`);
        }
    } catch (error) {
        console.error("Error seeding template:", error);
    }
}

seedTemplate();

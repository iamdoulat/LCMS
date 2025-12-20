// Note: In Next.js App Router, we should use Admin SDK for server-side mostly, but if we reuse the client config it might work if rules allow. 
// However, securely reading secrets like passwords should be done with Admin SDK if possible to bypass rules, OR we ensure rules allow the automated system.
// Since we are creating a utility that might run in API route, we can use the same firebase access if authenticated or if rules allow. 
// But SMTP password is sensitive.
// For this task, assuming we use the existing firestore import.

// Import shared types
import { SmtpConfiguration, EmailTemplate } from '@/types/email-settings';

// Import Client SDK (Default)
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

// We need to dynamically import or require these to avoid build errors if not installed yet?
// No, standard is to import.
// Helper to safely import modules without triggering build-time errors if missing
const safeImport = async (moduleName: string) => {
    try {
        // Using a variable prevents Webpack from trying to bundle 'nodemailer' or 'resend' statically
        // This allows the app to build even if these optional dependencies are not installed
        const imp = await import(/* webpackIgnore: true */ moduleName);
        return imp;
    } catch (error) {
        return null;
    }
};

interface SendEmailOptions {
    to: string | string[];
    templateSlug?: string;
    subject?: string;
    body?: string; // HTML content
    data?: Record<string, string>;
}

const getSmtpConfig = async () => {
    // Server-side: Must use Admin SDK for sensitive settings
    if (typeof window === 'undefined') {
        try {
            const { admin } = await import('@/lib/firebase/admin');

            if (!admin.apps.length) {
                // Try to force init if it's missing (though import should have done it)
                console.error("getSmtpConfig: Admin SDK not initialized despite import.");
                throw new Error("Firebase Admin SDK not initialized on server.");
            }

            const snapshot = await admin.firestore().collection('smtp_settings').where('isActive', '==', true).get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                return { ...doc.data(), id: doc.id } as SmtpConfiguration;
            } else {
                throw new Error("No active email configuration found. Please go to Settings > SMTP Settings and ensure one service is marked as 'Active'.");
            }

        } catch (e: any) {
            console.error("getSmtpConfig: Admin SDK Error:", e);
            throw new Error(`Server-side configuration load failed: ${e.message}`);
        }
    } else {
        // Client-side: This should generally not happen for sending system emails, 
        // but if we support client-side triggering (e.g. testing), we use Client SDK via 'call' or rules.
        // But smtp_settings are restricted.
        throw new Error("Cannot load SMTP settings from client-side directly for security.");
    }
}

const getEmailTemplate = async (slug: string) => {
    // Server-side: Must use Admin SDK
    if (typeof window === 'undefined') {
        try {
            const { admin } = await import('@/lib/firebase/admin');

            if (!admin.apps.length) {
                console.error("getEmailTemplate: Admin SDK not initialized.");
                throw new Error("Firebase Admin SDK not initialized on server.");
            }

            const snapshot = await admin.firestore().collection('email_templates').where('slug', '==', slug).get();
            if (!snapshot.empty) {
                return snapshot.docs[0].data() as EmailTemplate;
            } else {
                throw new Error(`Email template '${slug}' not found in database.`);
            }

        } catch (e: any) {
            console.error("getEmailTemplate: Admin SDK Error:", e);
            throw new Error(`Template load failed: ${e.message}`);
        }
    } else {
        // Client-side: If needed, could use Client SDK if rules allow, but for now restricting to match security posture
        // or just let it fall through if we assume authenticated client usage?
        // Given 'email_templates' rules allow read for authenticated, we CAN allow Client SDK here for preview/UI purposes.
        // BUT for the API route issue, we must ensure server path is taken.

        const tempQuery = query(collection(firestore, 'email_templates'), where('slug', '==', slug));
        const tempSnapshot = await getDocs(tempQuery);

        if (tempSnapshot.empty) {
            throw new Error(`Email template '${slug}' not found.`);
        }
        return tempSnapshot.docs[0].data() as EmailTemplate;
    }
}

export async function sendEmail({ to, templateSlug, subject: overrideSubject, body: overrideBody, data }: SendEmailOptions) {
    try {
        // 1. Fetch Active SMTP Config
        const config = await getSmtpConfig();

        let subject = overrideSubject || '';
        let body = overrideBody || '';

        // 2. Fetch Template if slug provided
        if (templateSlug) {
            const template = await getEmailTemplate(templateSlug);
            subject = template.subject;
            body = template.body;
        } else if (!subject || !body) {
            throw new Error('Either templateSlug OR subject and body must be provided.');
        }

        // 3. Process Template Variables
        // Default variables
        const allData: Record<string, any> = {
            ...data,
            company_name: process.env.NEXT_PUBLIC_APP_NAME || 'Nextsew', // Use app name, not SMTP config name
            year: new Date().getFullYear(),
            date: new Date().toLocaleDateString()
        };

        if (allData) {
            Object.keys(allData).forEach(key => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                subject = subject.replace(regex, String(allData[key]));
                body = body.replace(regex, String(allData[key]));
            });
        }

        const toAddresses = Array.isArray(to) ? to : [to];

        // 4. Send Email based on provider
        if (config.serviceProvider === 'resend_api') {
            if (!config.resendApiKey) throw new Error('Resend API Key missing');

            // Use the safe import helper
            const resendModule = await safeImport('resend');
            if (!resendModule) {
                throw new Error('Resend module not found. Please run: npm install resend');
            }

            const { Resend } = resendModule.default || resendModule;
            const resend = new Resend(config.resendApiKey);

            const { data: res, error } = await resend.emails.send({
                from: config.fromEmail,
                to: toAddresses,
                subject: subject,
                html: body,
            });

            if (error) throw error;
            return { success: true, messageId: res?.id };

        } else {
            // SMTP
            const nodemailer = await safeImport('nodemailer');
            if (!nodemailer) {
                throw new Error('Nodemailer module not found. Please run: npm install nodemailer');
            }

            const transporter = nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.port === 465, // true for 465, false for other ports
                auth: {
                    user: config.user,
                    pass: config.pass,
                },
            });

            const info = await transporter.sendMail({
                from: config.fromEmail,
                to: toAddresses.join(','),
                subject: subject,
                html: body,
            });

            return { success: true, messageId: info.messageId };
        }

    } catch (error) {
        console.error('Send Email Error:', error);
        throw error;
    }
}

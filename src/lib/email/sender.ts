/* eslint-disable no-console */
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

// Import logging utility
import { logActivity } from '@/lib/logger';
import { getCompanyName } from '@/lib/settings/company';


interface SendEmailOptions {
    to: string | string[];
    templateSlug?: string;
    subject?: string;
    body?: string; // HTML content
    data?: Record<string, string>;
    attachments?: Array<{
        filename: string;
        content: string; // Base64 string or buffer content
        encoding?: string; // 'base64' | 'utf-8' etc.
    }>;
}


const getSmtpConfig = async () => {
    // Server-side: Must use Admin SDK for sensitive settings
    if (typeof window === 'undefined') {
        try {
            // Import at top level ensures initialization happens
            const { admin } = await import('@/lib/firebase/admin');

            // Wait a moment for initialization to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!admin.apps.length) {
                console.error("getSmtpConfig: Admin SDK not initialized. Environment check:");
                console.error("- FIREBASE_ADMIN_PROJECT_ID:", !!process.env.FIREBASE_ADMIN_PROJECT_ID);
                console.error("- FIREBASE_ADMIN_CLIENT_EMAIL:", !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
                console.error("- FIREBASE_ADMIN_PRIVATE_KEY:", !!process.env.FIREBASE_ADMIN_PRIVATE_KEY);
                throw new Error("Firebase Admin SDK not initialized. Check server logs for credential issues.");
            }

            const snapshot = await admin.firestore().collection('smtp_settings').get();
            const allConfigs = snapshot.docs
                .map(d => ({ ...d.data(), id: d.id } as SmtpConfiguration))
                .filter(c => !c.isDisabled) // Skip permanently disabled ones
                .sort((a, b) => (a.id || '').localeCompare(b.id || '')); // Sort by ID for predictable sequence

            if (allConfigs.length === 0) {
                throw new Error("No available SMTP configuration found. Please ensure at least one service is enabled and configured.");
            }

            // Find the currently active config among the non-disabled ones
            let activeConfig = allConfigs.find(c => c.isActive);

            // Fallback: if none is marked active, pick the first one from our sorted list
            if (!activeConfig) {
                activeConfig = allConfigs[0];
            }

            const { getUsageForConfig } = await import('@/lib/email/usage');
            const usage = await getUsageForConfig(activeConfig);
            const limit = activeConfig.dailyUsageLimit || 0;

            // Trigger rotation if limits are reached
            if (limit > 0 && usage >= limit) {
                console.log(`[SMTP] Active config ${activeConfig.name} reached limit (${usage}/${limit}). Rotating sequentially...`);

                const currentIndex = allConfigs.findIndex(c => c.id === activeConfig!.id);
                let selectedConfig: SmtpConfiguration | null = null;

                // 1. Try to find the next available service UNDER its daily limit
                for (let i = 1; i < allConfigs.length; i++) {
                    const nextIndex = (currentIndex + i) % allConfigs.length;
                    const candidate = allConfigs[nextIndex];

                    const candidateUsage = await getUsageForConfig(candidate);
                    const candidateLimit = candidate.dailyUsageLimit || 0;

                    if (candidateLimit === 0 || candidateUsage < candidateLimit) {
                        selectedConfig = candidate;
                        break;
                    }
                }

                // 2. Load Balancing Fallback: If ALL services are over limit, 
                // move to the very next one in the sequence anyway to balance the load.
                if (!selectedConfig && allConfigs.length > 1) {
                    const nextIndex = (currentIndex + 1) % allConfigs.length;
                    selectedConfig = allConfigs[nextIndex];
                    console.log(`[SMTP] All services are over limit. Balancing load by moving to next in sequence: ${selectedConfig.name}`);
                }

                // If we found a different configuration to switch to
                if (selectedConfig && selectedConfig.id !== activeConfig.id) {
                    console.log(`[SMTP] Auto-rotating sequentially to ${selectedConfig.name} (${selectedConfig.id})`);

                    const batch = admin.firestore().batch();
                    // Mark current as inactive
                    batch.update(admin.firestore().collection('smtp_settings').doc(activeConfig.id!), {
                        isActive: false,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    // Mark next as active
                    batch.update(admin.firestore().collection('smtp_settings').doc(selectedConfig.id!), {
                        isActive: true,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    await batch.commit();

                    await logActivity({
                        type: 'email',
                        action: 'smtp_rotation',
                        status: 'success',
                        message: `SMTP sequentially rotated from ${activeConfig.name} to ${selectedConfig.name} (Load Balancing)`,
                        details: {
                            fromConfigId: activeConfig.id,
                            toConfigId: selectedConfig.id,
                            fromUsage: usage,
                            fromLimit: limit
                        }
                    });

                    return selectedConfig;
                }
            }

            return activeConfig;

        } catch (e: any) {
            console.error("getSmtpConfig: Error:", e);
            throw new Error(`Email configuration error: ${e.message}`);
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

            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!admin.apps.length) {
                console.error("getEmailTemplate: Admin SDK not initialized.");
                throw new Error("Firebase Admin SDK not initialized on server.");
            }

            const snapshot = await admin.firestore().collection('email_templates').where('slug', '==', slug).get();
            if (!snapshot.empty) {
                const template = snapshot.docs[0].data() as EmailTemplate;

                // Check if template is active (default true if not set)
                if (template.isActive === false) {

                    return null; // Return null to indicate skipped
                }

                return template;
            } else {
                return null; // Template not found, skip
            }

        } catch (e: any) {
            console.error("getEmailTemplate: Error:", e);
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

// This function is now imported from @/lib/settings/company

export async function sendEmail({ to, templateSlug, subject: overrideSubject, body: overrideBody, data, attachments }: SendEmailOptions) {
    try {
        // 1. Fetch Active SMTP Config
        const config = await getSmtpConfig();
        const dynamicCompanyName = await getCompanyName();

        let subject = overrideSubject || '';
        let body = overrideBody || '';

        // 2. Fetch Template if slug provided
        if (templateSlug) {
            try {
                const template = await getEmailTemplate(templateSlug);
                if (!template) {

                    await logActivity({
                        type: 'email',
                        action: 'send_email',
                        status: 'warning',
                        message: `Email notification skipped: Template '${templateSlug}' is disabled or not found.`,
                        recipient: Array.isArray(to) ? to.join(', ') : to,
                        details: { template: templateSlug }
                    });
                    return { success: true, status: 'skipped' };
                }
                subject = template.subject;
                body = template.body;
            } catch (err: any) {
                console.error(`Error loading email template ${templateSlug}:`, err);
                throw err;
            }
        } else if (!subject || !body) {
            throw new Error('Either templateSlug OR subject and body must be provided.');
        }

        // 3. Process Template Variables
        const allData: Record<string, any> = {
            ...data,
            company_name: dynamicCompanyName,
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
            const apiKey = config.resendApiKey || process.env.RESEND_API_KEY;
            if (!apiKey) throw new Error('Resend API Key missing in both Firestore and environment variables');
            
            const { Resend } = await import('resend');
            const resend = new Resend(apiKey);

            try {
                // Map attachments for Resend (expects content as Buffer/string)
                const resendAttachments = attachments?.map(att => ({
                    filename: att.filename,
                    content: Buffer.from(att.content, 'base64'),
                }));

                const { data: res, error } = await resend.emails.send({
                    from: `${config.fromName || 'LCMS'} <${config.fromEmail}>`,
                    to: toAddresses,
                    subject: subject,
                    html: body,
                    attachments: resendAttachments
                });

                if (error) throw error;

                // Log success
                await logActivity({
                    type: 'email',
                    action: 'send_email',
                    status: 'success',
                    message: `Email sent via Resend to ${toAddresses.join(', ')}`,
                    recipient: toAddresses.join(', '),
                    details: {
                        template: templateSlug || 'custom',
                        provider: 'resend_api',
                        messageId: res?.id,
                        subject,
                        configId: config.id
                    },
                    relatedId: config.id
                });

                return { success: true, messageId: res?.id };

            } catch (error: any) {
                console.error('Resend API Error:', error);
                await logActivity({
                    type: 'email',
                    action: 'send_email',
                    status: 'failed',
                    message: `Failed to send email via Resend: ${error.message}`,
                    recipient: toAddresses.join(', '),
                    details: { error: error.message, template: templateSlug, provider: 'resend_api' }
                });
                throw error;
            }

        } else {
            // SMTP with Nodemailer
            try {
                const nodemailer = await import('nodemailer');
                const transporter = nodemailer.createTransport({
                    host: config.host,
                    port: config.port,
                    secure: config.port === 465,
                    auth: {
                        user: config.user,
                        pass: config.pass,
                    },
                });

                const info = await transporter.sendMail({
                    from: `"${config.fromName || 'LCMS'}" <${config.fromEmail}>`,
                    to: toAddresses.join(','),
                    subject: subject,
                    html: body,
                    attachments: attachments?.map(att => ({
                        filename: att.filename,
                        content: att.content,
                        encoding: att.encoding || 'base64'
                    }))
                });

                // Log success
                await logActivity({
                    type: 'email',
                    action: 'send_email',
                    status: 'success',
                    message: `Email sent via SMTP to ${toAddresses.join(', ')}`,
                    recipient: toAddresses.join(', '),
                    details: {
                        template: templateSlug || 'custom',
                        provider: 'smtp',
                        messageId: info.messageId,
                        subject,
                        host: config.host,
                        configId: config.id
                    },
                    relatedId: config.id
                });

                return { success: true, messageId: info.messageId };

            } catch (error: any) {
                console.error('SMTP Error:', error);
                await logActivity({
                    type: 'email',
                    action: 'send_email',
                    status: 'failed',
                    message: `Failed to send email via SMTP: ${error.message}`,
                    recipient: toAddresses.join(', '),
                    details: { error: error.message, template: templateSlug, provider: 'smtp' }
                });
                throw error;
            }
        }

    } catch (error: any) {
        console.error('Send Email Error:', error);
        await logActivity({
            type: 'email',
            action: 'send_email_process',
            status: 'failed',
            message: `Critical error in sendEmail process: ${error.message}`,
            details: { error: error.message }
        });
        throw error;
    }
}

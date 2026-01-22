
/* eslint-disable no-console */
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { WhatsAppTemplate } from '@/types/whatsapp-settings';
import { logActivity } from '@/lib/logger';
import { getCompanyName } from '@/lib/settings/company';

interface SendWhatsAppOptions {
    to: string | string[]; // Phone numbers
    templateSlug?: string;
    data?: Record<string, string>;
    message?: string; // Direct message override
}

const getWhatsAppTemplate = async (slug: string) => {
    // Server-side (simplified): using client SDK as we did in email for now if rules allow, 
    // or better, if running in API route we should check environment.
    // Assuming backend usage mostly.

    // We can try to use Admin SDK if available/needed, but client SDK is often imported in shared code here.
    // Let's stick to client SDK for read if we assume authenticated or public read for templates (which might be risky).
    // Actually, `email-settings` used Admin SDK when on server. We should probably accept that pattern.

    if (typeof window === 'undefined') {
        const { admin } = await import('@/lib/firebase/admin');
        const snapshot = await admin.firestore().collection('whatsapp_templates').where('slug', '==', slug).get();
        if (!snapshot.empty) {
            const template = snapshot.docs[0].data() as WhatsAppTemplate;

            // Check if template is active (default true if not set)
            if (template.isActive === false) {

                return null;
            }

            return template;
        }
    } else {
        const q = query(collection(firestore, 'whatsapp_templates'), where('slug', '==', slug));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const template = snapshot.docs[0].data() as WhatsAppTemplate;

            // Check if template is active (default true if not set)
            if (template.isActive === false) {

                return null;
            }

            return template;
        }
    }

    return null;
};

// Helper to fully format message from template
export const formatWhatsAppMessage = async (template: WhatsAppTemplate, data: Record<string, any>) => {
    let subject = template.subject;
    let body = template.body;

    const dynamicCompanyName = await getCompanyName();

    // Standard replacements
    const allData: Record<string, any> = {
        ...data,
        company_name: dynamicCompanyName,
        year: new Date().getFullYear(),
        date: new Date().toLocaleDateString()
    };

    // Variable Replacement
    if (allData) {
        Object.keys(allData).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            // Check if subject has vars
            subject = subject.replace(regex, String(allData[key]));
            body = body.replace(regex, String(allData[key]));
        });
    }

    // Final Formatting
    // *// Subject //*
    // ----------------
    // Body

    let fullMessage = "";
    if (subject) {
        fullMessage += `*// ${subject} //*\n----------------------------------------\n`;
    }
    fullMessage += body;

    return fullMessage;
};

export async function sendWhatsApp({ to, templateSlug, data, message }: SendWhatsAppOptions) {
    try {
        let finalMessage = message || '';

        if (templateSlug) {
            try {
                const template = await getWhatsAppTemplate(templateSlug);
                if (!template) {

                    await logActivity({
                        type: 'whatsapp',
                        action: 'send_whatsapp',
                        status: 'warning',
                        message: `WhatsApp notification skipped: Template '${templateSlug}' is disabled or not found.`,
                        recipient: Array.isArray(to) ? to.join(', ') : to,
                        details: { template: templateSlug }
                    });
                    return { success: true, status: 'skipped' };
                }
                finalMessage = await formatWhatsAppMessage(template, data || {});
            } catch (err: any) {
                console.error(`Error loading template ${templateSlug}:`, err);
                throw err;
            }
        }

        if (!finalMessage) {
            throw new Error("Message content or template is required.");
        }

        const recipients = Array.isArray(to) ? to : [to];
        const results = [];

        // Fetch Active Gateway
        let gateway = null;
        if (typeof window === 'undefined') {
            const { admin } = await import('@/lib/firebase/admin');
            const snap = await admin.firestore().collection('whatsapp_gateways').where('isActive', '==', true).limit(1).get();
            if (!snap.empty) gateway = snap.docs[0].data();
        } else {
            const q = query(collection(firestore, 'whatsapp_gateways'), where('isActive', '==', true));
            const snap = await getDocs(q);
            if (!snap.empty) gateway = snap.docs[0].data();
        }

        if (!gateway) {
            const errorMsg = "No active WhatsApp gateway found.";
            console.error(errorMsg);
            await logActivity({
                type: 'whatsapp',
                action: 'send_whatsapp',
                status: 'failed',
                message: errorMsg,
                details: { recipients },
            });
            return { success: false, error: "No active gateway" };
        }

        for (const phone of recipients) {
            if (!phone) {
                await logActivity({
                    type: 'whatsapp',
                    action: 'send_whatsapp',
                    status: 'warning',
                    message: 'Skipped empty phone number',
                    recipient: 'N/A'
                });
                continue;
            }

            // Send via bipsms WhatsApp API
            const formattedPhone = phone.replace(/\D/g, ''); // Remove all non-digits
            const formData = new FormData();
            formData.append('secret', gateway.apiSecret);
            formData.append('account', gateway.accountUniqueId);
            formData.append('recipient', formattedPhone);
            formData.append('type', 'text');
            formData.append('message', finalMessage);

            try {
                const res = await fetch("https://app.bipsms.com/api/send/whatsapp", {
                    method: 'POST',
                    body: formData,
                });
                const result = await res.json();

                // Check if bipsms returned success (status 200 means success)
                if (res.ok && (result.status === 200 || result.status === 'success')) {
                    results.push({ phone, success: true, result });

                    await logActivity({
                        type: 'whatsapp',
                        action: 'send_whatsapp',
                        status: 'success',
                        message: `Message sent to ${phone}`,
                        recipient: phone,
                        details: {
                            template: templateSlug || 'custom',
                            gateway: gateway.accountUniqueId,
                            apiResult: result
                        }
                    });
                } else {
                    // API call succeeded but bipsms returned an error
                    console.error(`bipsms API error for ${phone}:`, result);
                    results.push({ phone, success: false, error: result.message || 'Provider error' });

                    await logActivity({
                        type: 'whatsapp',
                        action: 'send_whatsapp',
                        status: 'failed',
                        message: `Failed to send to ${phone}: ${result.message || 'Provider error'}`,
                        recipient: phone,
                        details: { error: result.message, apiResult: result, template: templateSlug }
                    });
                }

            } catch (e: any) {
                console.error(`Failed to send WA to ${phone}:`, e);
                results.push({ phone, success: false, error: e.message });

                await logActivity({
                    type: 'whatsapp',
                    action: 'send_whatsapp',
                    status: 'failed',
                    message: `Failed to send to ${phone}: ${e.message}`,
                    recipient: phone,
                    details: { error: e.message, template: templateSlug }
                });
            }
        }

        return { success: true, results };

    } catch (error: any) {
        console.error("sendWhatsApp error:", error);
        await logActivity({
            type: 'whatsapp',
            action: 'send_whatsapp_process',
            status: 'failed',
            message: 'Critical error in sendWhatsApp process',
            details: { error: error.message }
        });
        throw error; // Re-throw to caller
    }
}

// Helper to fetch phone numbers by Role
export async function getPhonesByRole(roles: string[]): Promise<string[]> {
    if (!roles || roles.length === 0) return [];

    let usersPhoneSet = new Set<string>();
    let targetEmails = new Set<string>();

    // 1. Fetch Users with Role
    if (typeof window === 'undefined') {
        const { admin } = await import('@/lib/firebase/admin');
        const usersSnapshot = await admin.firestore().collection('users')
            .where('role', 'array-contains-any', roles)
            .get();

        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.phone) usersPhoneSet.add(data.phone);
            if (data.email) targetEmails.add(data.email);
        });

        // 2. Fetch Employees by Email (if any emails found)
        const emails = Array.from(targetEmails);
        if (emails.length > 0) {
            // Firestore 'in' query supports up to 10 values (or 30 depending on version, generic safety 10)
            const chunkSize = 10;
            const chunks = [];
            for (let i = 0; i < emails.length; i += chunkSize) {
                chunks.push(emails.slice(i, i + chunkSize));
            }

            for (const chunk of chunks) {
                const empSnapshot = await admin.firestore().collection('employees')
                    .where('email', 'in', chunk)
                    .get();

                empSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.phone) usersPhoneSet.add(data.phone);
                });
            }
        }

    } else {
        // Client-side
        const q = query(collection(firestore, 'users'), where('role', 'array-contains-any', roles));
        const snapshot = await getDocs(q);

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.phone) usersPhoneSet.add(data.phone);
            if (data.email) targetEmails.add(data.email);
        });

        const emails = Array.from(targetEmails);
        if (emails.length > 0) {
            const chunkSize = 10;
            const chunks = [];
            for (let i = 0; i < emails.length; i += chunkSize) {
                chunks.push(emails.slice(i, i + chunkSize));
            }

            for (const chunk of chunks) {
                const qEmp = query(collection(firestore, 'employees'), where('email', 'in', chunk));
                const empSnap = await getDocs(qEmp);

                empSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.phone) usersPhoneSet.add(data.phone);
                });
            }
        }
    }

    return Array.from(usersPhoneSet).filter(p => p && typeof p === 'string' && p.trim() !== '');
}

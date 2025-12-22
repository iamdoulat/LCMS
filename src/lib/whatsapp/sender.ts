
import { firestore } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { WhatsAppTemplate } from '@/types/whatsapp-settings';

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
            return snapshot.docs[0].data() as WhatsAppTemplate;
        }
    } else {
        const q = query(collection(firestore, 'whatsapp_templates'), where('slug', '==', slug));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].data() as WhatsAppTemplate;
        }
    }

    throw new Error(`WhatsApp template '${slug}' not found.`);
};

// Helper to fully format message from template
export const formatWhatsAppMessage = (template: WhatsAppTemplate, data: Record<string, any>) => {
    let subject = template.subject;
    let body = template.body;

    // Standard replacements
    const allData: Record<string, any> = {
        ...data,
        company_name: process.env.NEXT_PUBLIC_APP_NAME || 'NextSew',
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
        fullMessage += `*// ${subject} //*\n----------------\n`;
    }
    fullMessage += body;

    return fullMessage;
};

export async function sendWhatsApp({ to, templateSlug, data, message }: SendWhatsAppOptions) {
    try {
        let finalMessage = message || '';

        if (templateSlug) {
            const template = await getWhatsAppTemplate(templateSlug);
            finalMessage = formatWhatsAppMessage(template, data || {});
        }

        if (!finalMessage) {
            throw new Error("Message content or template is required.");
        }

        const recipients = Array.isArray(to) ? to : [to];
        const results = [];

        // We will call the internal API route for sending to reuse the Gateway selection logic
        // Alternatively, we could duplicate the gateway fetch logic here, but calling the API is cleaner if we are already on server?
        // Actually, calling our own API from server code is tricky because of full URL requirement.
        // Better to import the sending logic or Gateway fetch logic.
        // Let's rely on `fetch` with full URL if NEXT_PUBLIC_APP_URL is set, or just duplicate the simple gateway fetch.
        // Duplicating gateway fetch is safer to avoid self-call lag and URL issues.

        // Fetch Active Gateway
        // Using Admin SDK if on server
        let gateway = null;
        if (typeof window === 'undefined') {
            const { admin } = await import('@/lib/firebase/admin');
            const snap = await admin.firestore().collection('whatsapp_gateways').where('isActive', '==', true).limit(1).get();
            if (!snap.empty) gateway = snap.docs[0].data();
        } else {
            // Client side fallback (should not happen for system notifications)
            const q = query(collection(firestore, 'whatsapp_gateways'), where('isActive', '==', true));
            const snap = await getDocs(q);
            if (!snap.empty) gateway = snap.docs[0].data();
        }

        if (!gateway) {
            console.error("No active WhatsApp gateway found.");
            return { success: false, error: "No active gateway" };
        }

        for (const phone of recipients) {
            if (!phone) continue;

            // Send via bipsms
            const apiUrl = `https://bipsms.com/api/bulksms?api_key=${gateway.apiSecret}&sender_id=${gateway.accountUniqueId}&mobile=${phone}&message=${encodeURIComponent(finalMessage)}`;

            try {
                const res = await fetch(apiUrl);
                const result = await res.json();
                results.push({ phone, success: true, result });
            } catch (e: any) {
                console.error(`Failed to send WA to ${phone}:`, e);
                results.push({ phone, success: false, error: e.message });
            }
        }

        return { success: true, results };

    } catch (error) {
        console.error("sendWhatsApp error:", error);
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

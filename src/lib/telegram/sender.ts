
/* eslint-disable no-console */
import { admin } from '@/lib/firebase/admin';
import { logActivity } from '@/lib/logger';

interface SendTelegramOptions {
    message?: string;
    photoUrl?: string;
    templateSlug?: string;
    data?: Record<string, any>;
}

/**
 * Fetches an active Telegram template by slug.
 */
export async function getTelegramTemplate(slug: string) {
    try {
        const snapshot = await admin.firestore().collection('telegram_templates')
            .where('slug', '==', slug)
            .get();

        if (snapshot.empty) return null;

        const template = snapshot.docs[0].data();
        if (template.isActive === false) return null;

        return template;
    } catch (error) {
        console.error(`Error fetching telegram template ${slug}:`, error);
        return null;
    }
}

/**
 * Replaces variables in template body with actual data.
 */
export const formatTelegramMessage = (body: string, data: Record<string, any>) => {
    let formatted = body;
    const allData: Record<string, any> = {
        ...data,
        company_name: process.env.NEXT_PUBLIC_APP_NAME || 'Smart Solution',
        date: new Date().toLocaleDateString(),
    };

    Object.keys(allData).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        formatted = formatted.replace(regex, String(allData[key]));
    });

    return formatted;
};

export async function sendTelegram({ message, photoUrl, templateSlug, data }: SendTelegramOptions) {
    try {
        // 1. Resolve Final Message
        let finalMessage = message || '';

        if (templateSlug) {
            const template = await getTelegramTemplate(templateSlug);
            if (!template) {

                // If message was provided, we continue with it. If not, we skip.
                if (!finalMessage) {
                    await logActivity({
                        type: 'telegram',
                        action: 'send_message',
                        status: 'warning',
                        message: `Telegram notification skipped: Template '${templateSlug}' is disabled or not found.`,
                        details: { templateSlug }
                    });
                    return { success: true, status: 'skipped' };
                }
            } else {
                finalMessage = formatTelegramMessage(template.body, data || {});
            }
        }

        if (!finalMessage) {
            return { success: false, error: 'No message content provided' };
        }

        // 2. Fetch Active Telegram Config
        const snapshot = await admin.firestore().collection('telegram_settings')
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) {

            return { success: false, error: 'No active configuration' };
        }

        const config = snapshot.docs[0].data();
        const { botToken, chatId } = config;

        if (!botToken || !chatId) {
            console.error('Telegram config missing botToken or chatId');
            return { success: false, error: 'Incomplete configuration' };
        }

        // 3. Send via Telegram Bot API
        const endpoint = photoUrl ? 'sendPhoto' : 'sendMessage';
        const body: any = {
            chat_id: chatId,
            parse_mode: 'HTML',
        };

        if (photoUrl) {
            body.photo = photoUrl;
            body.caption = finalMessage;
        } else {
            body.text = finalMessage;
        }

        const response = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const result = await response.json();

        if (response.ok && result.ok) {
            await logActivity({
                type: 'telegram',
                action: 'send_message',
                status: 'success',
                message: `Telegram notification sent successfully`,
                details: { chatId, result }
            });
            return { success: true, result };
        } else {
            console.error('Telegram API error details:', {
                status: response.status,
                statusText: response.statusText,
                body: result,
                config: { chatId, endpoint, photoUrl: (photoUrl ? 'PRESENT' : 'NONE') }
            });
            await logActivity({
                type: 'telegram',
                action: 'send_message',
                status: 'failed',
                message: `Telegram notification failed: ${result.description || 'Unknown error'}`,
                details: { chatId, apiResult: result }
            });
            return { success: false, error: result.description || 'API Error' };
        }

    } catch (error: any) {
        console.error('Error in sendTelegram:', error);
        await logActivity({
            type: 'telegram',
            action: 'send_message',
            status: 'failed',
            message: `Critical error in sendTelegram process: ${error.message}`,
            details: { error: error.message }
        });
        return { success: false, error: error.message };
    }
}

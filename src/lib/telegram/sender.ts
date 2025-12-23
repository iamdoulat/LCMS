
import { admin } from '@/lib/firebase/admin';
import { logActivity } from '@/lib/logger';

interface SendTelegramOptions {
    message: string;
    photoUrl?: string;
}

export async function sendTelegram({ message, photoUrl }: SendTelegramOptions) {
    try {
        // Fetch Active Telegram Config
        const snapshot = await admin.firestore().collection('telegram_settings')
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.log('No active Telegram bot configuration found.');
            return { success: false, error: 'No active configuration' };
        }

        const config = snapshot.docs[0].data();
        const { botToken, chatId } = config;

        if (!botToken || !chatId) {
            console.error('Telegram config missing botToken or chatId');
            return { success: false, error: 'Incomplete configuration' };
        }

        // Send via Telegram Bot API
        // Use sendPhoto if photoUrl is provided, otherwise sendMessage
        const endpoint = photoUrl ? 'sendPhoto' : 'sendMessage';
        const body: any = {
            chat_id: chatId,
            parse_mode: 'HTML',
        };

        if (photoUrl) {
            body.photo = photoUrl;
            body.caption = message;
        } else {
            body.text = message;
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

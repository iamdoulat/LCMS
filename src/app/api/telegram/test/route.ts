import { NextResponse } from 'next/server';
import { getCompanyName } from '@/lib/settings/company';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { botToken, chatId, companyName: nameOverride } = body;

        if (!botToken || !chatId) {
            return NextResponse.json({ error: 'Missing botToken or chatId' }, { status: 400 });
        }

        const companyName = nameOverride || await getCompanyName();
        const testMessage = `<b>Telegram Bot Test</b>\n\nYour ${companyName} Telegram integration is working correctly!\n\nTimestamp: ${new Date().toLocaleString()}`;

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: testMessage,
                parse_mode: 'HTML'
            })
        });

        const result = await response.json();

        if (response.ok && result.ok) {
            return NextResponse.json({ success: true, result });
        } else {
            return NextResponse.json({
                success: false,
                error: result.description || 'Telegram API Error',
                details: result
            }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Telegram Test API Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

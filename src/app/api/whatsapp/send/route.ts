
import { NextResponse } from 'next/server';
import { sendWhatsApp } from '@/lib/whatsapp/sender';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { to, recipient, message } = body;
        const targetNumber = to || recipient;

        if (!targetNumber || !message) {
            return NextResponse.json({ error: 'Missing required fields: to/recipient and message' }, { status: 400 });
        }

        const result = await sendWhatsApp({
            to: targetNumber,
            message: message
        });

        return NextResponse.json({
            success: true,
            ...(result as any)
        });

    } catch (error: any) {
        console.error("WhatsApp API Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/sender';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { to, templateSlug, subject, body: emailBody, data } = body;

        if (!to || (!templateSlug && (!subject || !emailBody))) {
            return NextResponse.json({ error: 'Missing required fields (to, and either templateSlug or subject/body)' }, { status: 400 });
        }

        const result = await sendEmail({
            to,
            templateSlug,
            subject,
            body: emailBody,
            data: data || {}
        });

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("Email API Error:", error);
        return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
    }
}

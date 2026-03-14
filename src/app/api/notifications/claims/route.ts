import { NextResponse } from 'next/server';
import { sendClaimStatusNotificationsInternal } from '@/lib/notifications/claims_server';
import { HRClaim } from '@/types';

export async function POST(request: Request) {
    try {
        const claim = await request.json() as HRClaim;
        
        if (!claim || !claim.id) {
            return NextResponse.json({ error: 'Invalid claim data' }, { status: 400 });
        }

        // Use the internal server-only function
        await sendClaimStatusNotificationsInternal(claim);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('API Error in claim notification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

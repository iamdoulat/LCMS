
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { getUsageForGateway } from '@/lib/whatsapp/usage';
import { WhatsAppGatewayConfig } from '@/types/whatsapp-settings';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Gateway ID is required' }, { status: 400 });
        }

        // Fetch the gateway config to get its unique ID/details if needed for usage matching
        const gatewayDoc = await admin.firestore().collection('whatsapp_gateways').doc(id).get();
        if (!gatewayDoc.exists) {
            return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });
        }

        const config = { id: gatewayDoc.id, ...gatewayDoc.data() } as WhatsAppGatewayConfig;
        const count = await getUsageForGateway(config);

        return NextResponse.json({
            count,
            limit: config.dailyUsageLimit || 0,
            id: config.id
        });

    } catch (error: any) {
        console.error("WhatsApp Usage API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

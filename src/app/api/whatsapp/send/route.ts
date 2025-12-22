
import { NextResponse } from 'next/server';
import { WhatsAppGatewayConfig } from '@/types/whatsapp-settings';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { recipient, message, gatewayId } = body;

        console.log("WhatsApp Send Request:", { recipient, messageLength: message?.length, gatewayId });

        if (!recipient || !message) {
            return NextResponse.json({ error: 'Missing required fields: recipient and message' }, { status: 400 });
        }

        // 1. Get WhatsApp Gateway Configuration
        let config: WhatsAppGatewayConfig | null = null;

        try {
            // Dynamic import of admin SDK to ensure environment variables are ready
            const { admin } = await import('@/lib/firebase/admin');

            // Wait a moment for initialization to complete (following pattern in sender.ts)
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!admin.apps.length) {
                console.error("WhatsApp API: Admin SDK not initialized.");
                throw new Error("Server configuration error: Firebase Admin SDK not initialized.");
            }

            const db = admin.firestore();
            let snapshot;

            if (gatewayId) {
                const doc = await db.collection('whatsapp_gateways').doc(gatewayId).get();
                if (doc.exists) {
                    config = { ...doc.data(), id: doc.id } as WhatsAppGatewayConfig;
                }
            } else {
                // Find active gateway
                snapshot = await db.collection('whatsapp_gateways').where('isActive', '==', true).limit(1).get();
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    config = { ...doc.data(), id: doc.id } as WhatsAppGatewayConfig;
                }
            }

            if (!config) {
                return NextResponse.json({ error: 'No active WhatsApp gateway configuration found.' }, { status: 404 });
            }

        } catch (dbError: any) {
            console.error("WhatsApp API: Database Error:", dbError);
            return NextResponse.json({ error: 'Failed to retrieve gateway settings.' }, { status: 500 });
        }

        // 2. Prepare Form Data for bipsms API
        const formData = new FormData();
        formData.append('secret', config.apiSecret);
        formData.append('account', config.accountUniqueId);
        formData.append('recipient', recipient);
        formData.append('type', 'text');
        formData.append('message', message);

        // 3. Send Request
        // Note: fetch automatically sets the Content-Type header to multipart/form-data with boundary when body is FormData
        const response = await fetch("https://app.bipsms.com/api/send/whatsapp", {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (response.ok && (result.status === 200 || result.status === 'success')) {
            // Handle bipsms specific success response structure if needed
            // The user provided: { "status": 200, "message": "...", "data": { ... } }
            return NextResponse.json({ success: true, apiResponse: result });
        } else {
            console.error("WhatsApp API Provider Error:", result);
            return NextResponse.json({
                error: result.message || 'Failed to send message via provider',
                details: result
            }, { status: response.status });
        }

    } catch (error: any) {
        console.error("WhatsApp API Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

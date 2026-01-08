"use client";

import { useEffect } from 'react';
import { useFcmToken } from '@/hooks/useFcmToken';

export function ServiceWorkerRegistration() {
    const { retrieveToken } = useFcmToken();

    useEffect(() => {
        // Register the main SW for PWA (if using next-pwa) works separately.
        // We also want to register firebase-messaging-sw.js or let Firebase handle it via getToken.
        // The retrieveToken hook handles getToken which automatically registers firebase-messaging-sw.js if needed.
        // But for robust PWA, we usually keep standard registration.

        if ('serviceWorker' in navigator) {
            // We can register standard SW here if it wasn't already registered by next-pwa
            // For now, next-pwa usually handles /sw.js
            // We just ensure token retrieval starts
            retrieveToken();
        }
    }, [retrieveToken]);

    return null;
}

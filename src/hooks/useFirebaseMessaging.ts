import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';

export function useFirebaseMessaging() {
    const { user, companyLogoUrl } = useAuth();
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
    const [fcmToken, setFcmToken] = useState<string | null>(null);

    useEffect(() => {
        if (!user || typeof window === 'undefined' || !messaging) return;

        const initializeMessaging = async () => {
            try {
                // 1. Request notification permission
                const permission = await Notification.requestPermission();
                setNotificationPermission(permission);

                if (permission !== 'granted') {
                    console.warn('Notification permission denied');
                    return;
                }

                // 2. Register service worker if not already registered
                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                        scope: '/'
                    });
                    await navigator.serviceWorker.ready;
                    console.log('[FCM] Service worker registered:', registration);

                    // 3. Send company logo to service worker
                    if (companyLogoUrl && registration.active) {
                        registration.active.postMessage({
                            type: 'SET_COMPANY_LOGO',
                            logoUrl: companyLogoUrl
                        });
                        console.log('[FCM] Company logo sent to SW:', companyLogoUrl);
                    }

                    // 4. Get FCM token
                    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
                    if (!vapidKey) {
                        console.error('[FCM] VAPID key not found in environment variables');
                        return;
                    }

                    const token = await getToken(messaging!, {
                        vapidKey,
                        serviceWorkerRegistration: registration
                    });

                    if (token) {
                        console.log('[FCM] Token obtained:', token.substring(0, 20) + '...');
                        setFcmToken(token);

                        // 5. Save token to user profile
                        try {
                            const userRef = doc(firestore, 'users', user.uid);
                            await updateDoc(userRef, {
                                fcmTokens: arrayUnion(token),
                                lastTokenUpdate: new Date().toISOString()
                            });
                            console.log('[FCM] Token saved to user profile');
                        } catch (error) {
                            console.error('[FCM] Error saving token:', error);
                        }
                    } else {
                        console.warn('[FCM] No token received');
                    }
                } else {
                    console.warn('[FCM] Service workers not supported');
                }
            } catch (error) {
                console.error('[FCM] Initialization error:', error);
            }
        };

        initializeMessaging();
    }, [user, companyLogoUrl]);

    // Handle foreground messages
    useEffect(() => {
        if (!messaging || notificationPermission !== 'granted') return;

        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('[FCM] Foreground message received:', payload);

            // Show notification even when app is open
            if (payload.notification) {
                const { title, body } = payload.notification;

                // Request permission if needed
                if (Notification.permission === 'granted') {
                    const notification = new Notification(title || 'New Notification', {
                        body: body || '',
                        icon: companyLogoUrl || '/icons/icon-192x192.png',
                        badge: '/icons/icon-72x72.png',
                        vibrate: [200, 100, 200] as any, // Type assertion for vibrate
                        tag: 'push-notification',
                        renotify: true
                    });

                    // Handle click
                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                        // Navigate to notifications page
                        window.location.href = '/mobile/notifications';
                    };
                }
            }
        });

        return () => unsubscribe();
    }, [messaging, notificationPermission, companyLogoUrl]);

    return {
        notificationPermission,
        fcmToken,
        isMessagingSupported: !!messaging
    };
}

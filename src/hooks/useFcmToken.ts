import { useEffect, useState, useCallback } from 'react';
import { getMessaging, getToken, onMessage, Unsubscribe } from 'firebase/messaging';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { firestore, messaging } from '@/lib/firebase/config';
import { toast } from '@/components/ui/use-toast';
import Swal from 'sweetalert2';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const useFcmToken = () => {
    const { user } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

    const retrieveToken = useCallback(async () => {
        try {
            if (typeof window !== 'undefined' && 'serviceWorker' in navigator && messaging) {
                // Request notification permission
                const permission = await Notification.requestPermission();
                setNotificationPermission(permission);

                if (permission === 'granted') {
                    const currentToken = await getToken(messaging, {
                        vapidKey: VAPID_KEY,
                    });

                    if (currentToken) {
                        setToken(currentToken);
                        // Save token to user profile
                        if (user?.uid) {
                            await saveTokenToFirestore(user.uid, currentToken);
                        }
                    } else {
                        console.warn('No registration token available. Request permission to generate one.');
                    }
                }
            }
        } catch (error) {
            console.error('An error occurred while retrieving token. ', error);
        }
    }, [user]);

    const saveTokenToFirestore = async (userId: string, token: string) => {
        try {
            const userRef = doc(firestore, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const tokens = userData.fcmTokens || [];

                if (!tokens.includes(token)) {
                    await updateDoc(userRef, {
                        fcmTokens: arrayUnion(token),
                    });
                }
            }
        } catch (error) {
            console.error('Error saving FCM token to Firestore:', error);
        }
    };

    // Listen for foreground messages
    useEffect(() => {
        if (!messaging) return;

        const unsubscribe = onMessage(messaging, (payload) => {
            const { title, body, icon } = payload.notification || {};

            // Show toast or custom UI
            toast({
                title: title || 'New Notification',
                description: body,
            });

            // Update badge if available
            if (payload.data?.badgeCount && navigator.setAppBadge) {
                const count = parseInt(payload.data.badgeCount, 10);
                if (!isNaN(count)) navigator.setAppBadge(count);
            }
        });

        return () => {
            unsubscribe(); // Unsubscribe handler
        };
    }, []);

    useEffect(() => {
        if ('Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
        retrieveToken();
    }, [retrieveToken]);

    return { token, notificationPermission, retrieveToken };
};

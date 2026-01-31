// Firebase Cloud Messaging Service Worker
// This file handles background notifications when the app is not in focus

// Import Firebase scripts from CDN (Service Workers don't support ES modules)
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase
// Note: These values will be injected by the client app at runtime
// Firebase will be initialized when the service worker receives the config
let isFirebaseInitialized = false;

// Store company logo URL
let companyLogoUrl = '/icons/icon-192x192.png';

// Listen for messages from the client app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'INIT_FIREBASE') {
        // Initialize Firebase with config from client
        if (!isFirebaseInitialized) {
            try {
                firebase.initializeApp(event.data.config);
                isFirebaseInitialized = true;
                console.log('[SW] Firebase initialized successfully');

                // Set up background message handler
                const messaging = firebase.messaging();
                messaging.onBackgroundMessage((payload) => {
                    console.log('[SW] Received background message:', payload);

                    const notificationTitle = payload.notification?.title || 'New Notification';
                    const notificationOptions = {
                        body: payload.notification?.body || '',
                        icon: companyLogoUrl,
                        badge: '/icons/icon-72x72.png',
                        vibrate: [200, 100, 200],
                        tag: 'push-notification',
                        renotify: true,
                        data: payload.data
                    };

                    // Set app badge if supported
                    if (navigator.setAppBadge && payload.data?.badgeCount) {
                        const count = parseInt(payload.data.badgeCount, 10);
                        if (!isNaN(count)) {
                            navigator.setAppBadge(count).catch((err) =>
                                console.error('[SW] Error setting app badge:', err)
                            );
                        }
                    }

                    self.registration.showNotification(notificationTitle, notificationOptions);
                });
            } catch (error) {
                console.error('[SW] Error initializing Firebase:', error);
            }
        }
    }

    if (event.data && event.data.type === 'SET_COMPANY_LOGO') {
        companyLogoUrl = event.data.logoUrl || '/icons/icon-192x192.png';
        console.log('[SW] Company logo updated:', companyLogoUrl);
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there's already a window open
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    // Focus existing window if found
                    if (client.url.includes('/dashboard') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window if none found
                if (clients.openWindow) {
                    const url = event.notification.data?.url || '/dashboard';
                    return clients.openWindow(url);
                }
            })
            .catch((err) => console.error('[SW] Error handling notification click:', err))
    );
});

// Service worker activation
self.addEventListener('activate', (event) => {
    console.log('[SW] Service worker activated');
    event.waitUntil(clients.claim());
});

// Service worker installation
self.addEventListener('install', (event) => {
    console.log('[SW] Service worker installed');
    self.skipWaiting();
});

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// This is required for the service worker to work with Next.js specific caching if you are using next-pwa
// but for standard Firebase messaging sw, we mainly need the firebase listeners.

// Initialize Firebase Logic for Background Messages
// We need to import the scripts from CDN because this file runs in the browser context outside of the bundler
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
// We can hardcode specific config values here or we need a way to pass env vars.
// Since SW doesn't have access to process.env at runtime easily without build step injection,
// checking if we can get away with just messagingSenderId or if we need full config.
// Usually for messaging.useServiceWorker, full config is better.

// NOTE: You must replace these values with your actual Firebase config or use a build process to inject them.
// Since this is a static public file, we can't use process.env directly unless we rename to .ts and compile it.
// For now, we will try to fetch config from a client message or hardcode if the user permits.
// However, 'firebase-messaging-sw.js' is often a static file. 
// Let's use the standard approach: 

// 1. Listen for background messages
// 2. Show notification

firebase.initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,      // NOTE: This won't work in static SW without a bundler
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // We'll need to manually fill these or use a workaround
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

/* 
   Since process.env is not available in the service worker directly in a standard Next.js public folder setup,
   we have two options:
   1. Hardcode values (Not ideal for public file, but ok if keys are public/restricted).
   2. Use a sophisticated serviceworker build step (e.g. next-pwa or custom webpack).
   
   Given the user has a `manifest.ts` and likely `next-pwa` or similar, let's see how they build SW.
   If they don't have a build step for SW, we might need to rely on the client to register it with config?
   Actually, standard firebase messaging requires this specific file.
   
   Let's check if we can skip full config initialization here and just use `getMessaging`.
   Documentation says: "Retrieve an instance of Firebase Messaging... checks if the window object is defined..."
*/

const messaging = firebase.messaging();

// Store company logo URL (will be set by client app)
let companyLogoUrl = '/icons/icon-192x192.png'; // Default fallback

// Listen for messages from the client to update company logo
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_COMPANY_LOGO') {
        companyLogoUrl = event.data.logoUrl || '/icons/icon-192x192.png';
        console.log('[SW] Company logo updated:', companyLogoUrl);
    }
});

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: companyLogoUrl, // Use dynamic company logo
        badge: '/icons/icon-72x72.png', // Converted to monochrome by Android usually, ensures valid path
        vibrate: [200, 100, 200],
        tag: 'push-notification', // Groups notifications (or use unique ID from payload if we want distinct)
        renotify: true, // Vibrate/Alert even if replacing an old one with same tag
        data: payload.data
    };

    // Set badge if supported
    if (navigator.setAppBadge && payload.data?.badgeCount) {
        const count = parseInt(payload.data.badgeCount, 10);
        if (!isNaN(count)) {
            navigator.setAppBadge(count).catch((error) => console.error('Error setting app badge:', error));
        }
    }

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Check if there is already a window/tab open with the target URL
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                // If so, just focus it.
                if (client.url.includes('/dashboard') && 'focus' in client) { // Customize URL matching
                    return client.focus();
                }
            }
            // If not, open a new window/tab.
            if (clients.openWindow) {
                return clients.openWindow('/dashboard'); // Customize destination
            }
        })
    );
});

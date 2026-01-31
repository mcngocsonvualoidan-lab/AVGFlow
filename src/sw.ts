/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare let self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: any
}

clientsClaim();

// Precache
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Firebase Config (Must match src/lib/firebase.ts)
const firebaseConfig = {
    apiKey: "AIzaSyDfEtxQTXzxq_4P42VLWgoeZViD1C9Xw-E",
    authDomain: "avgflow-dd822.firebaseapp.com",
    projectId: "avgflow-dd822",
    storageBucket: "avgflow-dd822.firebasestorage.app",
    messagingSenderId: "210885567448",
    appId: "1:210885567448:web:c9b7d5a1471ad06565c8ad",
    measurementId: "G-F705612L4C"
};

// Initialize Firebase in Service Worker
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Optional: Handle background messages specifically to ensure they show
onBackgroundMessage(messaging, (payload) => {
    console.log('[SW] Received background message ', payload);

    // Customize notification
    const title = payload.notification?.title || 'AVGFlow Notification';
    const options: NotificationOptions = {
        body: payload.notification?.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload.data?.url || payload.data?.link || '/',
        requireInteraction: true // Keep notification until user clicks
    };

    self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients: ReadonlyArray<Client>) => {
            const url = event.notification.data || '/';
            // Focus if already open
            for (let client of windowClients) {
                if (client.url.includes(url) && 'focus' in client) {
                    return (client as WindowClient).focus();
                }
            }
            // Open new
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
});


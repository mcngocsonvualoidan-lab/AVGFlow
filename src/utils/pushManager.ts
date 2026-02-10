import { getToken, onMessage, deleteToken } from "firebase/messaging";
import { messaging } from "../lib/firebase";

const PUBLIC_KEY = 'BPXMPe2rJJd7BPjVIEzmaiX74Oo-eVwpd7DcWvg6aWqWnc1IrCbo5xz_MyuUWVOfuxbG-3wE4WjKdFawcbPQhP8';

export async function registerServiceWorker() {
    // TEMPORARILY DISABLED - FCM configuration needed
    console.warn('Push notifications temporarily disabled');
    return null;

    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            // VitePWA registers the SW automatically usually, but we can access the registration
            const swReg = await navigator.serviceWorker.ready;
            console.log('Service Worker is ready', swReg);
            return swReg;
        } catch (error) {
            console.error('Service Worker Error', error);
            return null;
        }
    } else {
        console.warn('Push messaging is not supported');
        return null;
    }
}

export async function askPermission() {
    if (!('Notification' in window)) {
        console.log("This browser does not support desktop notification");
        return 'unsupported';
    }
    const permission = await Notification.requestPermission();
    return permission;
}

export async function subscribeToPush(swReg: ServiceWorkerRegistration) {
    const getKey = () => getToken(messaging, {
        vapidKey: PUBLIC_KEY,
        serviceWorkerRegistration: swReg
    });

    try {
        // Attempt 1
        return await getKey();
    } catch (error: any) {
        console.warn('First token attempt failed, trying to delete token and retry...', error);

        try {
            // Attempt 2: Delete token (clears old corrupt state) and retry
            await deleteToken(messaging);
            return await getKey();
        } catch (retryError: any) {
            console.error('Retry failed', retryError);

            // Debug hints: Check if Key starts with BPXMP (Correct) or BDPoE (Old)
            const keyPrefix = PUBLIC_KEY.substring(0, 5);
            console.error(`Lỗi đăng ký Push (Key: ${keyPrefix}...). Token reset failed.`, retryError);

            return null;
        }
    }
}

export const setupForegroundListener = (callback: (payload: any) => void) => {
    return onMessage(messaging, (payload) => {
        console.log('Foreground Message received. ', payload);
        callback(payload);
    });
};

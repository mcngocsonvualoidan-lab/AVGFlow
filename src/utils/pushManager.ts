export async function registerServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const swReg = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker is registered', swReg);
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
    try {
        const subscription = await swReg.pushManager.subscribe({
            userVisibleOnly: true,
            // Public VAPID Key goes here. For now we just test the flow.
            // applicationServerKey: urlB64ToUint8Array('<YOUR_PUBLIC_VAPID_KEY_HERE>') 
            applicationServerKey: new Uint8Array([
                // Mock key or empty for local testing (might fail depending on browser strictness)
                // In real app, user must generate VAPID keys: npx web-push generate-vapid-keys
            ])
        });
        return subscription;
    } catch (error) {
        console.error('Failed to subscribe the user: ', error);
        return null;
    }
}

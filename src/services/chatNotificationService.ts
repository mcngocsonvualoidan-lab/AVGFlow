/**
 * Chat Notification Service
 * - Tracks unread messages per ticket per user via localStorage
 * - Shows browser notifications when tab is unfocused
 * - Provides utility functions for components
 */

// ── Constants ──
const LS_PREFIX = 'avg_chat_lastRead_';

// System event emojis — these are timeline events, NOT chat messages
const SYSTEM_EMOJIS = ['🔄', '👤', '🎉', '📋', '🔍', '✅', '❌'];

export function isSystemEvent(text: string): boolean {
    return SYSTEM_EMOJIS.some(e => text.startsWith(e));
}

// ── Last Read Tracking ──
function getStorageKey(userEmail: string, ticketId: string): string {
    return `${LS_PREFIX}${userEmail.toLowerCase()}_${ticketId}`;
}

export function getLastReadTimestamp(userEmail: string, ticketId: string): number {
    try {
        const val = localStorage.getItem(getStorageKey(userEmail, ticketId));
        return val ? parseInt(val, 10) : 0;
    } catch {
        return 0;
    }
}

export function markTicketAsRead(userEmail: string, ticketId: string): void {
    try {
        localStorage.setItem(getStorageKey(userEmail, ticketId), Date.now().toString());
    } catch {
        // localStorage full or unavailable
    }
}

/**
 * Count unread messages for a ticket.
 * @param messages Array of messages with createdAt timestamps
 * @param userEmail Current user's email
 * @param ticketId The ticket ID
 * @returns Number of unread non-system messages not sent by the current user
 */
export function countUnread(
    messages: { text: string; senderEmail?: string; createdAt: any }[],
    userEmail: string,
    ticketId: string
): number {
    const lastRead = getLastReadTimestamp(userEmail, ticketId);
    if (!lastRead) {
        // First time — count all non-system messages not from this user
        // But to avoid overwhelming, mark as read if no explicit tracking
        return messages.filter(m => {
            if (isSystemEvent(m.text)) return false;
            if (m.senderEmail?.toLowerCase() === userEmail.toLowerCase()) return false;
            return true;
        }).length;
    }

    return messages.filter(m => {
        if (isSystemEvent(m.text)) return false;
        if (m.senderEmail?.toLowerCase() === userEmail.toLowerCase()) return false;
        const ts = getMessageTimestamp(m.createdAt);
        return ts > lastRead;
    }).length;
}

/**
 * Extract millisecond timestamp from Firestore Timestamp or Date or string
 */
export function getMessageTimestamp(createdAt: any): number {
    if (!createdAt) return 0;
    if (typeof createdAt === 'number') return createdAt;
    if (typeof createdAt?.toMillis === 'function') return createdAt.toMillis();
    if (typeof createdAt?.toDate === 'function') return createdAt.toDate().getTime();
    if (typeof createdAt?.seconds === 'number') return createdAt.seconds * 1000;
    if (typeof createdAt === 'string') return new Date(createdAt).getTime() || 0;
    return 0;
}

/**
 * Get the latest message info for notification display
 */
export function getLatestMessage(
    messages: { text: string; sender: string; senderEmail?: string; createdAt: any }[],
    userEmail: string
): { text: string; sender: string; timestamp: number } | null {
    // Filter out system events and own messages
    const relevant = messages
        .filter(m => !isSystemEvent(m.text) && m.senderEmail?.toLowerCase() !== userEmail.toLowerCase())
        .map(m => ({ ...m, _ts: getMessageTimestamp(m.createdAt) }))
        .sort((a, b) => b._ts - a._ts);

    if (relevant.length === 0) return null;
    return { text: relevant[0].text, sender: relevant[0].sender, timestamp: relevant[0]._ts };
}

// ── Browser Notification ──
export function showBrowserNotification(
    title: string,
    body: string,
    url?: string,
    icon?: string
): void {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    // Only show if tab is not focused
    if (document.hasFocus()) return;

    try {
        const notif = new Notification(title, {
            body,
            icon: icon || '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: `chat-${Date.now()}`, // Prevent duplicate
            requireInteraction: false,
        });

        notif.onclick = () => {
            window.focus();
            if (url) window.location.href = url;
            notif.close();
        };

        // Auto-close after 5s
        setTimeout(() => notif.close(), 5000);
    } catch {
        // Notification API not available in this context
    }
}

// ── Request Notification Permission ──
export async function requestNotificationPermission(): Promise<string> {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.requestPermission();
}

/**
 * ============================================
 * 🔔 Notifications Context
 * ============================================
 * Manages in-app notifications (different from push notifications)
 * Extracted from DataContext for better separation of concerns
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { useAuth } from './AuthContext';

// Types
export interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    type: 'alert' | 'success' | 'info' | 'error';
    userId?: string; // Target user (optional, for filtering)
}

interface NotificationsContextType {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Omit<Notification, 'id' | 'time' | 'read'>) => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    clearAllNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// ============================================
// Provider Component
// ============================================

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Computed: Unread count
    const unreadCount = notifications.filter(n => !n.read).length;

    // Subscribe to Firestore notifications
    useEffect(() => {
        if (!currentUser) return;

        const unsubscribe = onSnapshot(collection(db, 'notifications'), (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Notification[];

            // Sort by time (newest first)
            notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            setNotifications(notifs);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Add a new notification
    const addNotification = useCallback(async (
        notification: Omit<Notification, 'id' | 'time' | 'read'>
    ) => {
        const id = `notif-${Date.now()}`;
        const newNotification: Notification = {
            ...notification,
            id,
            time: new Date().toISOString(),
            read: false
        };

        await setDoc(doc(db, 'notifications', id), newNotification);
    }, []);

    // Mark single notification as read
    const markAsRead = useCallback(async (id: string) => {
        await updateDoc(doc(db, 'notifications', id), { read: true });
    }, []);

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        const batch = writeBatch(db);
        notifications
            .filter(n => !n.read)
            .forEach(n => {
                batch.update(doc(db, 'notifications', n.id), { read: true });
            });
        await batch.commit();
    }, [notifications]);

    // Delete a single notification
    const deleteNotification = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'notifications', id));
    }, []);

    // Clear all notifications
    const clearAllNotifications = useCallback(async () => {
        const batch = writeBatch(db);
        notifications.forEach(n => {
            batch.delete(doc(db, 'notifications', n.id));
        });
        await batch.commit();
    }, [notifications]);

    return (
        <NotificationsContext.Provider value={{
            notifications,
            unreadCount,
            addNotification,
            markAsRead,
            markAllAsRead,
            deleteNotification,
            clearAllNotifications
        }}>
            {children}
        </NotificationsContext.Provider>
    );
};

// ============================================
// Hook
// ============================================

export const useNotifications = (): NotificationsContextType => {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
};

export default NotificationsContext;

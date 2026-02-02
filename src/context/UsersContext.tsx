/**
 * ============================================
 * 👤 Users Context
 * ============================================
 * Manages user data and presence
 * Extracted from DataContext for better separation of concerns
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import type { User, LeaveRecord, UserPermissions } from '@/types';

// Re-export types for convenience
export type { User, LeaveRecord, UserPermissions };

interface UsersContextType {
    users: User[];
    currentAppUser: User | null;
    isLoaded: boolean;

    // CRUD Operations
    addUser: (user: User) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (id: string) => Promise<void>;

    // Leave Management
    addLeaveRecord: (userId: string, leave: LeaveRecord) => Promise<void>;
    removeLeaveRecord: (userId: string, leaveId: string) => Promise<void>;

    // Utilities
    getUserById: (id: string) => User | undefined;
    getUserByEmail: (email: string) => User | undefined;
    getActiveUsers: () => User[];
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

// ============================================
// Provider Component
// ============================================

export const UsersProvider = ({ children }: { children: ReactNode }) => {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const usersRef = useRef<User[]>([]);

    // Sync ref with state
    useEffect(() => {
        usersRef.current = users;
    }, [users]);

    // Current app user (based on Firebase auth email)
    const currentAppUser = users.find(u => u.email === currentUser?.email) || null;

    // Subscribe to Firestore users collection
    useEffect(() => {
        if (!currentUser) return;

        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const userData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as User[];

            setUsers(userData);
            setIsLoaded(true);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Presence heartbeat - update last_seen
    useEffect(() => {
        if (!currentUser || !isLoaded) return;

        const sendHeartbeat = async () => {
            const appUser = usersRef.current.find(u => u.email === currentUser.email);
            if (!appUser) return;

            await supabase
                .from('users')
                .update({ last_seen: new Date().toISOString() })
                .eq('id', appUser.id)
                .then(({ error }) => {
                    if (error) console.warn('Heartbeat fail', error);
                });
        };

        sendHeartbeat();
        const interval = setInterval(sendHeartbeat, 60000); // Every 1 minute

        return () => clearInterval(interval);
    }, [currentUser, isLoaded]);

    // ========================================
    // CRUD Operations
    // ========================================

    const addUser = useCallback(async (user: User) => {
        await setDoc(doc(db, 'users', user.id), user);
    }, []);

    const updateUser = useCallback(async (user: User) => {
        await updateDoc(doc(db, 'users', user.id), { ...user });
    }, []);

    const deleteUser = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'users', id));
    }, []);

    // ========================================
    // Leave Management
    // ========================================

    const addLeaveRecord = useCallback(async (userId: string, leave: LeaveRecord) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const updatedLeaves = [...(user.leaves || []), leave];
        await updateDoc(doc(db, 'users', userId), { leaves: updatedLeaves });
    }, [users]);

    const removeLeaveRecord = useCallback(async (userId: string, leaveId: string) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const updatedLeaves = (user.leaves || []).filter(l => l.id !== leaveId);
        await updateDoc(doc(db, 'users', userId), { leaves: updatedLeaves });
    }, [users]);

    // ========================================
    // Utilities
    // ========================================

    const getUserById = useCallback((id: string) => {
        return users.find(u => u.id === id);
    }, [users]);

    const getUserByEmail = useCallback((email: string) => {
        return users.find(u => u.email === email);
    }, [users]);

    const getActiveUsers = useCallback(() => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        return users.filter(u => {
            if (!u.lastSeen) return false;
            return new Date(u.lastSeen).getTime() > fiveMinutesAgo;
        });
    }, [users]);

    return (
        <UsersContext.Provider value={{
            users,
            currentAppUser,
            isLoaded,
            addUser,
            updateUser,
            deleteUser,
            addLeaveRecord,
            removeLeaveRecord,
            getUserById,
            getUserByEmail,
            getActiveUsers
        }}>
            {children}
        </UsersContext.Provider>
    );
};

// ============================================
// Hook
// ============================================

export const useUsers = (): UsersContextType => {
    const context = useContext(UsersContext);
    if (!context) {
        throw new Error('useUsers must be used within a UsersProvider');
    }
    return context;
};

export default UsersContext;

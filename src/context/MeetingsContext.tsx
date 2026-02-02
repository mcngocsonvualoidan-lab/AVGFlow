/**
 * ============================================
 * 📅 Meetings Context
 * ============================================
 * Manages meeting schedules
 * Extracted from DataContext for better separation of concerns
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import type { Meeting } from '@/types';

// Re-export type
export type { Meeting };

interface MeetingsContextType {
    meetings: Meeting[];
    isLoading: boolean;

    // CRUD Operations
    addMeeting: (meeting: Meeting) => Promise<void>;
    updateMeeting: (meeting: Meeting) => Promise<void>;
    deleteMeeting: (id: string) => Promise<void>;

    // Utilities
    getMeetingById: (id: string) => Meeting | undefined;
    getTodayMeetings: () => Meeting[];
    getUpcomingMeetings: (days?: number) => Meeting[];
    getHighlightedMeetings: () => Meeting[];
}

const MeetingsContext = createContext<MeetingsContextType | undefined>(undefined);

// ============================================
// Provider Component
// ============================================

export const MeetingsProvider = ({ children }: { children: ReactNode }) => {
    const { currentUser } = useAuth();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Subscribe to Firestore meetings collection
    useEffect(() => {
        if (!currentUser) return;

        const unsubscribe = onSnapshot(collection(db, 'meetings'), (snapshot) => {
            const meetingsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Meeting[];

            // Sort by date and time
            meetingsData.sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.startTime.localeCompare(b.startTime);
            });

            setMeetings(meetingsData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // ========================================
    // CRUD Operations
    // ========================================

    const addMeeting = useCallback(async (meeting: Meeting) => {
        await setDoc(doc(db, 'meetings', meeting.id), meeting);
    }, []);

    const updateMeeting = useCallback(async (meeting: Meeting) => {
        await updateDoc(doc(db, 'meetings', meeting.id), { ...meeting });
    }, []);

    const deleteMeeting = useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'meetings', id));
    }, []);

    // ========================================
    // Utilities
    // ========================================

    const getMeetingById = useCallback((id: string) => {
        return meetings.find(m => m.id === id);
    }, [meetings]);

    const getTodayMeetings = useCallback(() => {
        const today = new Date().toISOString().split('T')[0];
        return meetings.filter(m => m.date === today);
    }, [meetings]);

    const getUpcomingMeetings = useCallback((days: number = 7) => {
        const now = new Date();
        const future = new Date();
        future.setDate(future.getDate() + days);

        return meetings.filter(m => {
            const meetingDate = new Date(m.date);
            return meetingDate >= now && meetingDate <= future;
        });
    }, [meetings]);

    const getHighlightedMeetings = useCallback(() => {
        return meetings.filter(m => m.isHighlight);
    }, [meetings]);

    return (
        <MeetingsContext.Provider value={{
            meetings,
            isLoading,
            addMeeting,
            updateMeeting,
            deleteMeeting,
            getMeetingById,
            getTodayMeetings,
            getUpcomingMeetings,
            getHighlightedMeetings
        }}>
            {children}
        </MeetingsContext.Provider>
    );
};

// ============================================
// Hook
// ============================================

export const useMeetings = (): MeetingsContextType => {
    const context = useContext(MeetingsContext);
    if (!context) {
        throw new Error('useMeetings must be used within a MeetingsProvider');
    }
    return context;
};

export default MeetingsContext;

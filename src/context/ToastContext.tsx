/**
 * ============================================
 * 🍞 Toast Context
 * ============================================
 * Manages application-wide toast notifications
 * Extracted from DataContext for better separation of concerns
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Types
export interface Toast {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'alert' | 'error';
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ============================================
// Provider Component
// ============================================

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = { ...toast, id };

        setToasts(prev => [...prev, newToast]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const clearToasts = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
            {children}
        </ToastContext.Provider>
    );
};

// ============================================
// Hook
// ============================================

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// Convenience methods for common toast types
export const useToastHelpers = () => {
    const { addToast } = useToast();

    return {
        showSuccess: (title: string, message: string) =>
            addToast({ title, message, type: 'success' }),
        showError: (title: string, message: string) =>
            addToast({ title, message, type: 'error' }),
        showInfo: (title: string, message: string) =>
            addToast({ title, message, type: 'info' }),
        showAlert: (title: string, message: string) =>
            addToast({ title, message, type: 'alert' }),
    };
};

export default ToastContext;

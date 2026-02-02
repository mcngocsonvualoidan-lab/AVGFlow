/**
 * ============================================
 * 🔄 Contexts - Barrel Export
 * ============================================
 * Central export file for all React Contexts
 */

// Authentication Context
export { AuthProvider, useAuth } from './AuthContext';

// Data Context (main data store - legacy, being split)
export { DataProvider, useData } from './DataContext';
export type {
    User,
    Task,
    OrderLog,
    Notification,
    BirthdayWish,
    ActiveEvent,
    Toast,
    PayrollRecord,
    Meeting,
    LeaveRecord,
    UserPermissions,
    TimelineEvent,
} from './DataContext';

// Toast Context (new - extracted from DataContext)
export { ToastProvider, useToast, useToastHelpers } from './ToastContext';
export type { Toast as ToastType } from './ToastContext';

// Notifications Context (new - extracted from DataContext)
export { NotificationsProvider, useNotifications } from './NotificationsContext';
export type { Notification as NotificationType } from './NotificationsContext';

// Language Context (i18n)
export { LanguageProvider, useLanguage } from './LanguageContext';

// Theme Context
export { ThemeProvider, useTheme } from './ThemeContext';


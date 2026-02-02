/**
 * ============================================
 * 🔄 Contexts - Barrel Export
 * ============================================
 * Central export file for all React Contexts
 */

// Authentication Context
export { AuthProvider, useAuth } from './AuthContext';

// Data Context (main data store)
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

// Language Context (i18n)
export { LanguageProvider, useLanguage } from './LanguageContext';

// Theme Context
export { ThemeProvider, useTheme } from './ThemeContext';

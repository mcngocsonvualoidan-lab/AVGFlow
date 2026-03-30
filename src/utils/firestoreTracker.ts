/**
 * 🔋 Firestore Resource Tracker v2
 * 
 * Theo dõi TOÀN BỘ client-side Firestore operations (reads/writes/deletes)
 * thông qua global interceptor tại firebase.ts level.
 * 
 * TUÂN THỦ HIẾN PHÁP:
 * - 0 Firestore reads (chỉ dùng localStorage + in-memory)
 * - Push notification chỉ gửi cho Admin
 * 
 * FEATURES:
 * - In-memory counters (instant) + debounced localStorage persistence
 * - Daily auto-cleanup + archive (30 ngày)
 * - Browser Push notification khi vượt ngưỡng
 * - Daily summary export cho Admin Dashboard
 */

const STORAGE_KEY = 'avg_resource_tracker';
const HISTORY_KEY = 'avg_resource_history';
const ALERT_KEY = 'avg_resource_alert_sent';

// Firebase Free Tier Quotas
export const QUOTAS = {
    reads: 50000,
    writes: 20000,
    deletes: 20000,
    storage_mb: 1024, // 1 GB
} as const;

// Alert thresholds (%)
export const THRESHOLDS = {
    warning: 70,
    danger: 85,
    critical: 95,
} as const;

export interface DailyUsage {
    date: string; // YYYY-MM-DD
    reads: number;
    writes: number;
    deletes: number;
    lastUpdated: string; // ISO timestamp
}

interface AlertRecord {
    [date: string]: {
        [metric: string]: number;
    };
}

// ====== IN-MEMORY STATE ======
// Use in-memory counters for speed, persist to localStorage periodically
let _memoryUsage: DailyUsage = {
    date: '',
    reads: 0,
    writes: 0,
    deletes: 0,
    lastUpdated: '',
};
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _initialized = false;

// Get today's date string
const getToday = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Initialize from localStorage (cold start)
const ensureInitialized = () => {
    if (_initialized && _memoryUsage.date === getToday()) return;

    const today = getToday();

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data: DailyUsage = JSON.parse(stored);
            if (data.date === today) {
                _memoryUsage = data;
                _initialized = true;
                return;
            }
            // New day — archive old data
            archiveDay(data);
        }
    } catch { /* corrupted data, reset */ }

    // Fresh day
    _memoryUsage = { date: today, reads: 0, writes: 0, deletes: 0, lastUpdated: new Date().toISOString() };
    persistToStorage();
    _initialized = true;
};

// Persist in-memory state to localStorage (debounced)
const schedulePersist = () => {
    if (_saveTimer) return; // Already scheduled
    _saveTimer = setTimeout(() => {
        persistToStorage();
        _saveTimer = null;
    }, 2000); // Save every 2 seconds max
};

const persistToStorage = () => {
    _memoryUsage.lastUpdated = new Date().toISOString();
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_memoryUsage));
    } catch { /* localStorage full — ignore */ }
};

// Archive a day's data into history (last 30 days)
const archiveDay = (dayData: DailyUsage) => {
    try {
        const historyStr = localStorage.getItem(HISTORY_KEY);
        const history: DailyUsage[] = historyStr ? JSON.parse(historyStr) : [];

        // Add if not already archived and has actual data
        if (!history.some(h => h.date === dayData.date) && (dayData.reads + dayData.writes + dayData.deletes > 0)) {
            history.push(dayData);
        }

        // Keep only last 30 days
        const trimmed = history.slice(-30);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));

        // Clean old alert records
        try {
            const alertStr = localStorage.getItem(ALERT_KEY);
            if (alertStr) {
                const alerts: AlertRecord = JSON.parse(alertStr);
                const today = getToday();
                const cleaned: AlertRecord = {};
                if (alerts[today]) cleaned[today] = alerts[today];
                localStorage.setItem(ALERT_KEY, JSON.stringify(cleaned));
            }
        } catch { /* ignore */ }
    } catch { /* ignore */ }
};

// Check and send alert if threshold crossed
const checkThreshold = (metric: 'reads' | 'writes' | 'deletes', value: number) => {
    const quota = QUOTAS[metric];
    const percent = (value / quota) * 100;

    let thresholdCrossed = 0;
    if (percent >= THRESHOLDS.critical) thresholdCrossed = THRESHOLDS.critical;
    else if (percent >= THRESHOLDS.danger) thresholdCrossed = THRESHOLDS.danger;
    else if (percent >= THRESHOLDS.warning) thresholdCrossed = THRESHOLDS.warning;

    if (thresholdCrossed === 0) return;

    try {
        const alertStr = localStorage.getItem(ALERT_KEY);
        const alerts: AlertRecord = alertStr ? JSON.parse(alertStr) : {};
        const today = getToday();

        if (!alerts[today]) alerts[today] = {};
        if (alerts[today][metric] && alerts[today][metric] >= thresholdCrossed) return;

        alerts[today][metric] = thresholdCrossed;
        localStorage.setItem(ALERT_KEY, JSON.stringify(alerts));

        sendBrowserAlert(metric, percent, thresholdCrossed);
    } catch { /* ignore */ }
};

// Send browser push notification
const sendBrowserAlert = (metric: string, percent: number, threshold: number) => {
    const labels: Record<string, string> = {
        reads: 'Firestore Reads',
        writes: 'Firestore Writes',
        deletes: 'Firestore Deletes',
    };

    const icons: Record<number, string> = { 70: '⚠️', 85: '🔴', 95: '🚨' };

    const title = `${icons[threshold] || '⚠️'} AVGFlow: ${labels[metric] || metric} đạt ${Math.round(percent)}%`;
    const body = `Đã sử dụng ${Math.round(percent)}% quota ${labels[metric]}. Ngưỡng cảnh báo: ${threshold}%.`;

    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                tag: `resource-alert-${metric}-${threshold}`,
                requireInteraction: threshold >= THRESHOLDS.critical,
            });
        } catch (e) {
            console.warn('Notification failed:', e);
        }
    }
};

// ====== PUBLIC API ======

/** Track a Firestore read operation */
export const trackRead = (count = 1) => {
    ensureInitialized();
    _memoryUsage.reads += count;
    schedulePersist();
    checkThreshold('reads', _memoryUsage.reads);
};

/** Track a Firestore write operation */
export const trackWrite = (count = 1) => {
    ensureInitialized();
    _memoryUsage.writes += count;
    schedulePersist();
    checkThreshold('writes', _memoryUsage.writes);
};

/** Track a Firestore delete operation */
export const trackDelete = (count = 1) => {
    ensureInitialized();
    _memoryUsage.deletes += count;
    schedulePersist();
    checkThreshold('deletes', _memoryUsage.deletes);
};

/** Track an onSnapshot listener (counts docs as reads) */
export const trackSnapshot = (docCount: number) => {
    if (docCount > 0) trackRead(docCount);
};

/** Get today's usage (for Dashboard display) — from memory, instant */
export const getCurrentUsage = (): DailyUsage => {
    ensureInitialized();
    return { ..._memoryUsage };
};

/** Get usage history (last 30 days) */
export const getUsageHistory = (): DailyUsage[] => {
    ensureInitialized();
    try {
        const historyStr = localStorage.getItem(HISTORY_KEY);
        const history: DailyUsage[] = historyStr ? JSON.parse(historyStr) : [];

        const combined = history.filter(h => h.date !== _memoryUsage.date);
        combined.push({ ..._memoryUsage });

        return combined.sort((a, b) => a.date.localeCompare(b.date));
    } catch {
        return [{ ..._memoryUsage }];
    }
};

/** Get usage percentage for a metric */
export const getUsagePercent = (metric: 'reads' | 'writes' | 'deletes'): number => {
    ensureInitialized();
    return (_memoryUsage[metric] / QUOTAS[metric]) * 100;
};

/** Get alert level for a metric */
export const getAlertLevel = (percent: number): 'safe' | 'warning' | 'danger' | 'critical' => {
    if (percent >= THRESHOLDS.critical) return 'critical';
    if (percent >= THRESHOLDS.danger) return 'danger';
    if (percent >= THRESHOLDS.warning) return 'warning';
    return 'safe';
};

/** Reset today's counters (for testing) */
export const resetTodayUsage = () => {
    _memoryUsage = {
        date: getToday(),
        reads: 0,
        writes: 0,
        deletes: 0,
        lastUpdated: new Date().toISOString(),
    };
    persistToStorage();
};

/** 
 * 🧹 Daily cleanup — call on app mount.
 * Archives old data, cleans stale localStorage keys, resets counters for new day.
 */
export const dailyCleanup = () => {
    ensureInitialized();
    // Force persist current state
    persistToStorage();
    console.log(`[ResourceTracker] 🧹 Daily cleanup done. Today: ${_memoryUsage.date}, Reads: ${_memoryUsage.reads}, Writes: ${_memoryUsage.writes}`);
};

// Auto-persist before tab close
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (_saveTimer) {
            clearTimeout(_saveTimer);
            _saveTimer = null;
        }
        persistToStorage();
    });

    // Also persist on visibility change (tab switching on mobile)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            if (_saveTimer) {
                clearTimeout(_saveTimer);
                _saveTimer = null;
            }
            persistToStorage();
        }
    });
}

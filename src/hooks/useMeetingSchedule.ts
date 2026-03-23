import { useState, useEffect, useCallback } from 'react';
import { type Meeting } from '../services/meetingService';

// Re-export Meeting type from service
export type { Meeting };

export interface MonthArchive {
    month: number;
    year: number;
    label: string;
    gid: string;
}

// Archive list of available months
export const MEETING_ARCHIVES: MonthArchive[] = [
    { month: 3, year: 2026, label: 'Tháng 03/2026', gid: '637878134' },
    { month: 2, year: 2026, label: 'Tháng 02/2026', gid: '896887169' },
    { month: 1, year: 2026, label: 'Tháng 01/2026', gid: '0' },
];

// Default current month
export const CURRENT_MONTH_GID = '637878134'; // March 2026

const SHEET_ID = '11p55tNRLRqVfgwEfrcTWJfxKA6dJQyDJq4CapgZ5o-M';
const CACHE_KEY_PREFIX = 'avgflow_meetings_';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ==================== CACHE ====================
interface CacheEntry {
    data: Meeting[];
    timestamp: number;
    source: 'supabase' | 'csv';
}

function getCachedMeetings(gid: string): CacheEntry | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY_PREFIX + gid);
        if (!raw) return null;
        const entry: CacheEntry = JSON.parse(raw);
        if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
            return entry;
        }
        return null; // Expired
    } catch {
        return null;
    }
}

function setCachedMeetings(gid: string, data: Meeting[], source: 'supabase' | 'csv'): void {
    try {
        const entry: CacheEntry = { data, timestamp: Date.now(), source };
        localStorage.setItem(CACHE_KEY_PREFIX + gid, JSON.stringify(entry));
    } catch {
        // localStorage full or unavailable
    }
}

/**
 * Parse CSV text → Meeting[]
 * Kept as fallback when Supabase is unavailable
 */
function parseCSVToMeetings(responseText: string): Meeting[] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuote = false;

    for (let i = 0; i < responseText.length; i++) {
        const char = responseText[i];
        const nextChar = responseText[i + 1];

        if (char === '"') {
            if (inQuote && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            currentRow.push(currentCell);
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuote) {
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell);
                rows.push(currentRow);
                currentRow = [];
                currentCell = '';
            }
            if (char === '\r' && nextChar === '\n') i++;
        } else {
            currentCell += char;
        }
    }
    if (currentRow.length > 0 || currentCell) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }

    // Clean time values that may contain Excel epoch date prefix
    const cleanTime = (val: string): string => {
        if (!val) return '';
        const epochMatch = val.match(/^30\/12\/1899\s+(\d{1,2}:\d{2})(:\d{2})?$/);
        if (epochMatch) return epochMatch[1];
        const timeOnly = val.match(/^(\d{1,2}:\d{2})(:\d{2})?$/);
        if (timeOnly) return timeOnly[1];
        return val;
    };

    return rows
        .filter(r => r.length > 5 && !r[0].includes('google.visualization') && (r[2] || r[8]))
        .slice(1) // Skip header
        .map((r, idx) => ({
            id: `sheet-${idx}`,
            scope: r[2] || '',
            day: r[3] || '',
            date: r[4] || '',
            startTime: cleanTime(r[5] || ''),
            endTime: cleanTime(r[6] || ''),
            duration: r[7] || '',
            content: r[8] || '',
            pic: r[9] || '',
            participants: r[10] || '',
            secretary: r[11] || '',
            note: r[12] || '',
            link: r[13] || '',
            isHighlight: (r[8] || '').toLowerCase().includes('quan trọng'),
        }));
}

/**
 * Parse Google Visualization JSON response → Meeting[]
 * The response wraps data in google.visualization.Query.setResponse({...})
 */
function parseGVizJSON(responseText: string): Meeting[] {
    // Extract JSON from JSONP wrapper: google.visualization.Query.setResponse({...});
    const jsonMatch = responseText.match(/google\.visualization\.Query\.setResponse\((.+)\);?\s*$/s);
    if (!jsonMatch) {
        console.warn('[MeetingHook] Could not extract JSON from GViz response');
        return [];
    }

    let parsed: any;
    try {
        parsed = JSON.parse(jsonMatch[1]);
    } catch (e) {
        console.warn('[MeetingHook] Failed to parse GViz JSON:', e);
        return [];
    }

    if (!parsed?.table?.rows) return [];

    const rows = parsed.table.rows;

    const extractValue = (cell: any): string => {
        if (!cell) return '';
        // For dates: cell = { v: "Date(2026,2,9)", f: "09/03/2026" }
        // For times: cell = { v: "Date(1899,11,30,9,20,0)", f: "09:20" }
        // Prefer formatted value (f) if available
        if (cell.f) return cell.f;
        if (cell.v === null || cell.v === undefined) return '';
        return String(cell.v);
    };

    const cleanTime = (val: string): string => {
        if (!val) return '';
        // Strip seconds from time values like "09:20:00"
        const epochMatch = val.match(/^30\/12\/1899\s+(\d{1,2}:\d{2})(:\d{2})?$/);
        if (epochMatch) return epochMatch[1];
        const timeOnly = val.match(/^(\d{1,2}:\d{2})(:\d{2})?$/);
        if (timeOnly) return timeOnly[1];
        // Handle "160:00:00" duration format 
        const durationMatch = val.match(/^(\d+:\d{2})(:\d{2})$/);
        if (durationMatch) return durationMatch[1];
        return val;
    };

    // Skip header rows (parsedNumHeaders tells us how many)
    const numHeaders = parsed.table.parsedNumHeaders || 1;
    const dataRows = rows.slice(numHeaders > 1 ? 0 : 0); // GViz already excludes header-ish rows but check

    return dataRows
        .map((row: any, idx: number) => {
            const cells = row.c || [];
            // Column mapping:
            // A(0)=empty, B(1)=STT, C(2)=Phạm vi, D(3)=Thứ, E(4)=Ngày,
            // F(5)=Giờ Bắt đầu, G(6)=Kết thúc, H(7)=Thời lượng,
            // I(8)=Nội dung, J(9)=NĐH, K(10)=Thành phần,
            // L(11)=Thư ký, M(12)=Ghi chú, N(13)=Link
            const content = extractValue(cells[8]);
            const date = extractValue(cells[4]);
            
            // Skip rows with only backtick or empty content
            if (!date && (!content || content === '`')) return null;

            return {
                id: `gviz-${idx}`,
                scope: extractValue(cells[2]),
                day: extractValue(cells[3]),
                date: date,
                startTime: cleanTime(extractValue(cells[5])),
                endTime: cleanTime(extractValue(cells[6])),
                duration: cleanTime(extractValue(cells[7])),
                content: content,
                pic: extractValue(cells[9]),
                participants: extractValue(cells[10]),
                secretary: extractValue(cells[11]),
                note: extractValue(cells[12]),
                link: extractValue(cells[13]),
                isHighlight: content.toLowerCase().includes('quan trọng'),
            };
        })
        .filter((m: Meeting | null): m is Meeting => m !== null && (!!m.date || !!m.content));
}

/**
 * Fetch via JSONP (Google Visualization API) — bypasses CORS completely
 * Then falls back to CSV + CORS proxies if JSONP fails
 */
async function fetchFromGoogleSheets(gid: string): Promise<Meeting[]> {
    // Strategy 1: JSONP via script tag injection (bypasses ALL CORS restrictions)
    try {
        const meetings = await fetchViaJSONP(gid);
        if (meetings.length > 0) {
            console.log(`[MeetingHook] ✅ JSONP loaded: ${meetings.length} meetings`);
            return meetings;
        }
    } catch (e) {
        console.warn('[MeetingHook] JSONP failed:', e);
    }

    // Strategy 2: Direct fetch of GViz JSON (works if sheet is published)
    try {
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
        const res = await fetch(gvizUrl, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
            const text = await res.text();
            const meetings = parseGVizJSON(text);
            if (meetings.length > 0) {
                console.log(`[MeetingHook] ✅ GViz direct fetch loaded: ${meetings.length} meetings`);
                return meetings;
            }
        }
    } catch (e) {
        console.warn('[MeetingHook] GViz direct fetch failed:', e);
    }

    // Strategy 3: CSV via CORS proxies
    const GOOGLE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
    const t = Date.now();
    const proxyUrls = [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(GOOGLE_CSV_URL)}&_t=${t}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(GOOGLE_CSV_URL)}&_t=${t}`,
        `https://corsproxy.io/?${encodeURIComponent(GOOGLE_CSV_URL)}&_t=${t}`,
    ];

    for (let i = 0; i < proxyUrls.length; i++) {
        try {
            const res = await fetch(proxyUrls[i], { signal: AbortSignal.timeout(10000) });
            if (res.ok) {
                const text = await res.text();
                if (text && text.length > 50 && !text.trim().startsWith('<!DOCTYPE') && !text.includes('<html')) {
                    const meetings = parseCSVToMeetings(text);
                    if (meetings.length > 0) {
                        console.log(`[MeetingHook] ✅ CSV proxy ${i} loaded: ${meetings.length} meetings`);
                        return meetings;
                    }
                }
            }
        } catch (e) {
            console.warn(`[MeetingHook] CSV proxy ${i} failed:`, e);
        }
    }

    throw new Error('Không thể kết nối đến Google Sheets (tất cả nguồn thất bại)');
}

/**
 * JSONP-based fetch: Injects a <script> tag to load data from Google Visualization API.
 * This completely bypasses CORS since <script> tags are not subject to same-origin policy.
 */
function fetchViaJSONP(gid: string): Promise<Meeting[]> {
    return new Promise((resolve, reject) => {
        const callbackName = `__gviz_cb_${gid}_${Date.now()}`;
        const timeoutMs = 12000;

        // Set up global callback
        (window as any)[callbackName] = (response: any) => {
            cleanup();
            try {
                if (!response?.table?.rows) {
                    resolve([]);
                    return;
                }
                // Re-wrap response to match parseGVizJSON format
                const fakeText = `google.visualization.Query.setResponse(${JSON.stringify(response)});`;
                const meetings = parseGVizJSON(fakeText);
                resolve(meetings);
            } catch (e) {
                reject(e);
            }
        };

        // Create and inject script tag
        const script = document.createElement('script');
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:${callbackName}&gid=${gid}`;
        script.src = url;
        script.onerror = () => {
            cleanup();
            reject(new Error('JSONP script load failed'));
        };

        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP timeout'));
        }, timeoutMs);

        function cleanup() {
            clearTimeout(timer);
            delete (window as any)[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        }

        document.head.appendChild(script);
    });
}

export const useMeetingSchedule = (gid: string = CURRENT_MONTH_GID, filterMonth?: number, filterYear?: number) => {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const applyMonthFilter = useCallback((data: Meeting[]) => {
        if (filterMonth === undefined || filterYear === undefined) return data;
        return data.filter(meeting => {
            if (!meeting.date) return false;
            const dateParts = meeting.date.split('/');
            if (dateParts.length !== 3) return false;
            const meetingMonth = parseInt(dateParts[1], 10);
            const meetingYear = parseInt(dateParts[2], 10);
            return meetingMonth === filterMonth && meetingYear === filterYear;
        });
    }, [filterMonth, filterYear]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // 1. Try cache FIRST for instant rendering (stale-while-revalidate)
            const cached = getCachedMeetings(gid);
            if (cached) {
                console.log(`[MeetingHook] 📦 Instant from cache (${cached.source}, ${cached.data.length} meetings)`);
                setMeetings(applyMonthFilter(cached.data));
                setLoading(false);

                // 🔋 HYBRID: Background refresh from Google Sheets (not Supabase)
                fetchFromGoogleSheets(gid).then(fresh => {
                    if (fresh && fresh.length > 0) {
                        setCachedMeetings(gid, fresh, 'csv');
                        setMeetings(applyMonthFilter(fresh));
                        console.log(`[MeetingHook] 🔄 Background refresh: ${fresh.length} meetings`);
                    }
                }).catch(() => { });
                return;
            }

            // 2. 🔋 HYBRID MODE: Skip Supabase, go directly to Google Sheets (JSONP → GViz → CSV)
            const result = await fetchFromGoogleSheets(gid);
            setCachedMeetings(gid, result, 'csv');
            console.log(`[MeetingHook] ✅ Google Sheets: ${result.length} meetings`);

            setMeetings(applyMonthFilter(result || []));
        } catch (err: any) {
            console.error('[MeetingHook] All strategies failed:', err);
            setError(err.message || 'Lỗi đồng bộ');
        } finally {
            setLoading(false);
        }
    }, [gid, applyMonthFilter]);

    useEffect(() => {
        fetchData();

        // Realtime disabled in hybrid mode (saves Supabase bandwidth)
        // Auto-refresh every 10 minutes from Google Sheets
        const intervalId = setInterval(fetchData, 10 * 60 * 1000);

        return () => {
            clearInterval(intervalId);
        };
    }, [fetchData]);

    return { meetings, loading, error, refresh: fetchData };
};

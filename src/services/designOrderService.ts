/**
 * =====================================================
 * AVGFlow — Design Order Service
 * =====================================================
 * Centralized service for design order data.
 * Architecture: Sheet → Apps Script → Supabase → App
 * 
 * Features:
 * - Primary: Fetch from Supabase (protected data)
 * - Fallback: Direct CSV from Google Sheets (if Supabase empty)
 * - Cache: LocalStorage with 10-minute TTL
 * - Realtime: Supabase Realtime subscription for instant updates
 */

import { supabase } from '../lib/supabase';

// ==================== CONSTANTS ====================
const SUPABASE_TABLE = 'design_orders';
const CACHE_KEY = 'avgflow_design_orders_cache';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Fallback: Direct Google Sheets CSV
const SHEET_ID = '1mzYT75VEJh-PMYvlwUEQkvVnDIj6p1P2ssS6FXvK5Vs';
const GID = '485384320';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

// ==================== TYPES ====================
export interface DesignOrderRow {
    row_index: number;
    row_content: string[];
}

export interface ParsedDesignOrder {
    id: string;
    time: string;
    person: string;
    brand: string;
    request: string;
    description: string;
    status: string;
    parsedDate: Date | null;
}

// ==================== CACHE ====================
interface CacheEntry {
    data: string[][];
    timestamp: number;
    source: 'supabase' | 'csv';
}

function getCachedOrders(): CacheEntry | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
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

function setCachedOrders(data: string[][], source: 'supabase' | 'csv'): void {
    try {
        const entry: CacheEntry = { data, timestamp: Date.now(), source };
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
        // localStorage full or unavailable
    }
}

// ==================== FETCH FROM SUPABASE ====================

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
        ),
    ]);
}

export async function fetchDesignOrdersFromSupabase(): Promise<string[][]> {
    // Wrap in a real Promise for timeout support
    const fetchPromise = (async () => {
        const { data, error } = await supabase
            .from(SUPABASE_TABLE)
            .select('row_index, row_content')
            .order('row_index', { ascending: true })
            .limit(5000);
        return { data, error };
    })();

    // 5-second timeout to fail fast when Supabase is down/paused
    const { data, error } = await withTimeout(fetchPromise, 5000, 'Supabase');

    if (error) {
        console.error('[DesignOrderService] Supabase fetch error:', error);
        throw error;
    }

    if (!data || data.length === 0) return [];

    const rows = (data as DesignOrderRow[]).map(item => item.row_content);
    setCachedOrders(rows, 'supabase');
    return rows;
}

// ==================== FETCH FROM GOOGLE SHEETS (JSONP + CSV FALLBACK) ====================

/**
 * Parse Google Visualization JSON response → string[][]
 * The response wraps data in google.visualization.Query.setResponse({...})
 */
function parseGVizJSONToRows(responseText: string): string[][] {
    const jsonMatch = responseText.match(/google\.visualization\.Query\.setResponse\((.+)\);?\s*$/s);
    if (!jsonMatch) return [];

    let parsed: any;
    try {
        parsed = JSON.parse(jsonMatch[1]);
    } catch {
        return [];
    }

    if (!parsed?.table?.rows) return [];

    const extractValue = (cell: any): string => {
        if (!cell) return '';
        if (cell.f) return cell.f;
        if (cell.v === null || cell.v === undefined) return '';
        if (typeof cell.v === 'boolean') return cell.v ? 'TRUE' : 'FALSE';
        return String(cell.v);
    };

    // Build header row from column labels
    const headers = (parsed.table.cols || []).map((col: any) => col.label || '');
    const rows: string[][] = [headers];

    for (const row of parsed.table.rows) {
        const cells = row.c || [];
        const rowData = cells.map((cell: any) => extractValue(cell));
        rows.push(rowData);
    }

    return rows;
}

/**
 * JSONP-based fetch: Injects a <script> tag to load data from Google Visualization API.
 * Completely bypasses CORS since <script> tags are not subject to same-origin policy.
 */
function fetchDesignOrdersViaJSONP(): Promise<string[][]> {
    return new Promise((resolve, reject) => {
        const callbackName = `__gviz_design_${Date.now()}`;
        const timeoutMs = 12000;

        (window as any)[callbackName] = (response: any) => {
            cleanup();
            try {
                if (!response?.table?.rows) {
                    resolve([]);
                    return;
                }
                const fakeText = `google.visualization.Query.setResponse(${JSON.stringify(response)});`;
                const rows = parseGVizJSONToRows(fakeText);
                resolve(rows);
            } catch (e) {
                reject(e);
            }
        };

        const script = document.createElement('script');
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:${callbackName}&gid=${GID}`;
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

export async function fetchDesignOrdersFromCSV(): Promise<string[][]> {
    // Strategy 1: JSONP via script tag (bypasses ALL CORS)
    try {
        const rows = await fetchDesignOrdersViaJSONP();
        if (rows.length > 1) {
            console.log(`[DesignOrderService] ✅ JSONP loaded: ${rows.length} rows`);
            setCachedOrders(rows, 'csv');
            return rows;
        }
    } catch (e) {
        console.warn('[DesignOrderService] JSONP failed:', e);
    }

    // Strategy 2: Direct GViz JSON fetch (works if published)
    try {
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;
        const res = await fetch(gvizUrl, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
            const text = await res.text();
            const rows = parseGVizJSONToRows(text);
            if (rows.length > 1) {
                console.log(`[DesignOrderService] ✅ GViz direct loaded: ${rows.length} rows`);
                setCachedOrders(rows, 'csv');
                return rows;
            }
        }
    } catch (e) {
        console.warn('[DesignOrderService] GViz direct failed:', e);
    }

    // Strategy 3: CSV via proxies
    const proxies = [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(CSV_URL)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(CSV_URL)}`,
        `https://corsproxy.io/?${encodeURIComponent(CSV_URL)}`,
    ];

    let lastErr: Error | null = null;
    for (const url of proxies) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) continue;
            const text = await res.text();
            if (!text || text.length < 50) continue;

            const rows = parseCSVText(text);
            if (rows.length > 1) {
                setCachedOrders(rows, 'csv');
                return rows;
            }
        } catch (e: any) {
            lastErr = e;
        }
    }

    throw lastErr || new Error('All data sources failed');
}

// ==================== MAIN FETCH (Cache → Google Sheets — HYBRID MODE) ====================
// 🔋 Hybrid: Google Sheets is PRIMARY to save Supabase bandwidth (free plan quota exceeded)
export async function fetchDesignOrders(): Promise<string[][]> {
    // 1. Try cache FIRST for instant rendering
    const cached = getCachedOrders();
    if (cached) {
        console.log(`[DesignOrderService] 📦 Instant load from cache (source: ${cached.source})`);
        // Background refresh from Google Sheets (not Supabase — saves bandwidth)
        fetchDesignOrdersFromCSV().then(fresh => {
            if (fresh.length > 1) {
                console.log('[DesignOrderService] 🔄 Background refresh from Sheets:', fresh.length, 'rows');
            }
        }).catch(() => {});
        return cached.data;
    }

    // 2. No cache — fetch from Google Sheets (JSONP → GViz → CSV)
    console.log('[DesignOrderService] 📊 Fetching from Google Sheets (hybrid mode)...');
    return fetchDesignOrdersFromCSV();
}

// ==================== PARSE CSV ====================
function parseCSVText(text: string): string[][] {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    const row: string[] = [];

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(current);
                current = '';
            } else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
                row.push(current);
                current = '';
                if (row.length > 0) rows.push([...row]);
                row.length = 0;
            } else {
                current += ch;
            }
        }
    }
    row.push(current);
    if (row.some(c => c.trim())) rows.push(row);
    return rows;
}

// ==================== PARSE ORDERS ====================

// 📅 Cutoff: Chỉ hiển thị đơn hàng từ tháng 1/2025 trở đi
// Dữ liệu trước đó được tạm ẩn trên giao diện (vẫn lưu trong Supabase)
const ORDERS_CUTOFF_DATE = new Date(2025, 0, 1); // January 1, 2025

export function parseDesignOrders(rows: string[][]): ParsedDesignOrder[] {
    if (rows.length < 2) return [];

    const orders: ParsedDesignOrder[] = [];
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        // Column mapping:
        // A(0)=Timestamp, B(1)=Person, C(2)=Brand, D(3)=Request,
        // E(4)=Description, F(5)=Qty, G(6)=DeliveryEst,
        // H(7)=Handler, I(8)=Status
        const time = (cols[0] || '').trim();
        const person = (cols[1] || '').trim();
        const brand = (cols[2] || '').trim();
        const request = (cols[3] || '').trim();
        const description = (cols[4] || '').trim();
        const rawStatus = (cols[8] || '').trim();
        const sTrim = (rawStatus || '').trim();
        const status = (!sTrim || sTrim.toUpperCase() === 'N/A') ? 'Đang xử lý' : sTrim;

        if (!time && !person && !brand && !request) continue;

        const date = parseDate(time);

        // 🔒 Ẩn đơn hàng trước tháng 1/2025
        if (date && date < ORDERS_CUTOFF_DATE) continue;

        const safeId = `row-${i}`;

        orders.push({
            id: safeId,
            time,
            person,
            brand,
            request,
            description,
            status,
            parsedDate: date,
        });
    }
    return orders;
}

function parseDate(dateStr: string): Date | null {
    if (!dateStr || !dateStr.trim()) return null;
    const parts = dateStr.trim().split(' ');
    if (parts.length < 1) return null;
    const dateParts = parts[0].split('/');
    if (dateParts.length !== 3) return null;
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    let hours = 0, minutes = 0, seconds = 0;
    if (parts[1]) {
        const timeParts = parts[1].split(':');
        hours = parseInt(timeParts[0], 10) || 0;
        minutes = parseInt(timeParts[1], 10) || 0;
        seconds = parseInt(timeParts[2], 10) || 0;
    }
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
}

// ==================== SUPABASE REALTIME (DISABLED — Hybrid Mode) ====================
// 🔋 Disabled to save Supabase bandwidth. Data comes from Google Sheets via JSONP.
export type OrderChangeCallback = (rows: string[][]) => void;

export function subscribeToDesignOrderChanges(_callback: OrderChangeCallback) {
    // No-op: Realtime disabled in hybrid mode to save Supabase bandwidth
    console.log('[DesignOrderService] ℹ️ Realtime disabled (hybrid mode — using Google Sheets)');
    return () => {}; // No cleanup needed
}

// ==================== SYNC TO SUPABASE (from App-side, emergency) ====================
export async function syncDesignOrdersToSupabase(data: string[][]): Promise<void> {
    // 1. Delete all existing
    const { error: deleteError } = await supabase
        .from(SUPABASE_TABLE)
        .delete()
        .neq('row_index', -1);
    if (deleteError) console.warn('[DesignOrderService] Delete error:', deleteError);

    // 2. Insert in batches
    const payload = data.map((row, index) => ({
        row_index: index,
        row_content: row,
    }));

    const BATCH_SIZE = 100;
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from(SUPABASE_TABLE).insert(batch);
        if (error) throw error;
    }
}

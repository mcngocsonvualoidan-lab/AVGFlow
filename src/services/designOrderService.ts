/**
 * =====================================================
 * AVGFlow — Design Order Service
 * =====================================================
 * Centralized service for design order data.
 * Architecture: Google Sheets → JSONP/CSV → App (with Firestore cache)
 * 
 * Features:
 * - Primary: Fetch from Google Sheets (JSONP → GViz → CSV proxies)
 * - Cache: LocalStorage with 10-minute TTL
 * - Sync: Firestore backup for data persistence
 */

import { db } from '../lib/firebase';
import { collection, doc, writeBatch, getDocs, query, orderBy, limit } from '@/lib/firestore';

// ==================== CONSTANTS ====================
const FIRESTORE_COLLECTION = 'design_orders';
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
    source: 'firestore' | 'csv';
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

function setCachedOrders(data: string[][], source: 'firestore' | 'csv'): void {
    try {
        const entry: CacheEntry = { data, timestamp: Date.now(), source };
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
        // localStorage full or unavailable
    }
}

// ==================== FETCH FROM FIRESTORE ====================
export async function fetchDesignOrdersFromFirestore(): Promise<string[][]> {
    try {
        const ordersRef = collection(db, FIRESTORE_COLLECTION);
        const q = query(ordersRef, orderBy('row_index', 'asc'), limit(5000));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return [];

        const rows = snapshot.docs.map(d => {
            const data = d.data();
            return data.row_content as string[];
        });

        setCachedOrders(rows, 'firestore');
        console.log(`[DesignOrderService] ✅ Firestore loaded: ${rows.length} rows`);
        return rows;
    } catch (err) {
        console.warn('[DesignOrderService] Firestore fetch failed:', err);
        throw err;
    }
}

import { fetchViaJSONP, parseGVizToRows } from '../lib/jsonpQueue';

export async function fetchDesignOrdersFromCSV(): Promise<string[][]> {
    // Strategy 1: JSONP via shared queue (bypasses ALL CORS)
    try {
        const rows = await fetchViaJSONP(SHEET_ID, GID, parseGVizToRows);
        if (rows.length > 1) {
            console.log(`[DesignOrderService] ✅ JSONP loaded: ${rows.length} rows`);
            setCachedOrders(rows, 'csv');
            return rows;
        }
    } catch (e) {
        console.warn('[DesignOrderService] JSONP failed:', e);
    }

    // Strategy 2: Direct GViz JSON fetch (works if published, may hit CORS)
    try {
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;
        const res = await fetch(gvizUrl, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
            const text = await res.text();
            const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.+)\);?\s*$/s);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    const rows = parseGVizToRows(parsed);
                    if (rows.length > 1) {
                        console.log(`[DesignOrderService] ✅ GViz direct loaded: ${rows.length} rows`);
                        setCachedOrders(rows, 'csv');
                        return rows;
                    }
                } catch { /* parse failed, try next */ }
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
// 🔋 Hybrid: Google Sheets is PRIMARY, Firestore is backup/cache
export async function fetchDesignOrders(): Promise<string[][]> {
    // 1. Try cache FIRST for instant rendering
    const cached = getCachedOrders();
    if (cached) {
        console.log(`[DesignOrderService] 📦 Instant load from cache (source: ${cached.source})`);
        // Background refresh from Google Sheets
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
const ORDERS_CUTOFF_DATE = new Date(2025, 0, 1); // January 1, 2025

export function parseDesignOrders(rows: string[][]): ParsedDesignOrder[] {
    if (rows.length < 2) return [];

    const orders: ParsedDesignOrder[] = [];
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
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

// ==================== REALTIME (DISABLED — Hybrid Mode) ====================
export type OrderChangeCallback = (rows: string[][]) => void;

export function subscribeToDesignOrderChanges(_callback: OrderChangeCallback) {
    console.log('[DesignOrderService] ℹ️ Realtime disabled (hybrid mode — using Google Sheets)');
    return () => {};
}

// ==================== SYNC TO FIRESTORE ====================
export async function syncDesignOrdersToFirestore(data: string[][]): Promise<void> {
    // Firestore batch write (max 500 per batch)
    const BATCH_SIZE = 450; // Leave margin under 500 limit

    // First, delete existing documents
    const existingSnap = await getDocs(collection(db, FIRESTORE_COLLECTION));
    if (!existingSnap.empty) {
        // Delete in batches
        const deleteBatches: ReturnType<typeof writeBatch>[] = [];
        let currentBatch = writeBatch(db);
        let count = 0;
        existingSnap.docs.forEach(d => {
            currentBatch.delete(d.ref);
            count++;
            if (count >= BATCH_SIZE) {
                deleteBatches.push(currentBatch);
                currentBatch = writeBatch(db);
                count = 0;
            }
        });
        if (count > 0) deleteBatches.push(currentBatch);
        await Promise.all(deleteBatches.map(b => b.commit()));
        console.log(`[DesignOrderService] 🗑️ Deleted ${existingSnap.size} existing docs`);
    }

    // Insert new data in batches
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const slice = data.slice(i, i + BATCH_SIZE);
        slice.forEach((row, idx) => {
            const docRef = doc(db, FIRESTORE_COLLECTION, `row_${i + idx}`);
            batch.set(docRef, {
                row_index: i + idx,
                row_content: row,
            });
        });
        await batch.commit();
    }
    console.log(`[DesignOrderService] ✅ Synced ${data.length} rows to Firestore`);
}

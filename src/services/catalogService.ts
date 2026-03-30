/**
 * ============================================================
 *  AVGFlow — Product Catalog Service
 *  🔋 HYBRID MODE: JSONP → Apps Script API → CSV proxy (no Supabase)
 * ============================================================
 */

const MODULE = '[CatalogService]';

// ── Sheet config ──
const CATALOG_SHEET_ID = '1karhpP174qGeQudh3YopY3Zl68f_zXoqlsw8CYd1YhQ';
const CATALOG_CSV_URL = `https://docs.google.com/spreadsheets/d/${CATALOG_SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const CATALOG_API_URL = 'https://script.google.com/macros/s/AKfycbzo7AAGf9FdFJ7zZKYBODo_LcZpmiFosnVjvvPAxTdS7uafydpeBzoyRx9Qnwgh6tKI7g/exec';

export interface CatalogItem {
    chungLoai: string;
    nhanHang: string;
    sku: string;
    tenSanPham: string;
    dvt: string;
    kichThuoc: string;
    chatLieu: string;
}

// ── Cache ──
let _cache: CatalogItem[] | null = null;
let _cacheTs = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 min (increased for hybrid mode)

import { fetchViaJSONP, parseGVizToRows } from '../lib/jsonpQueue';


/**
 * Parse CSV rows → CatalogItem[]
 */
function parseRowsToCatalog(rows: string[][]): CatalogItem[] {
    if (rows.length <= 1) return [];
    const items: CatalogItem[] = [];
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 6) continue;
        // Sheet Kho SP: A=Chủng loại, B=Nhãn hàng, C=Hình ảnh (skip), D=SKU, E=Tên SP, F=ĐVT, G=Trọng lượng/KT, H=Quy cách/Chất liệu
        const item: CatalogItem = {
            chungLoai: (r[0] || '').trim(),
            nhanHang: (r[1] || '').trim(),
            // r[2] = Hình ảnh (bỏ qua)
            sku: (r[3] || '').trim(),
            tenSanPham: (r[4] || '').trim(),
            dvt: (r[5] || '').trim(),
            kichThuoc: (r[6] || '').trim(),
            chatLieu: (r[7] || '').trim(),
        };
        if (item.nhanHang || item.tenSanPham) items.push(item);
    }
    return items;
}

/**
 * Fetch catalog — 🔋 HYBRID: JSONP → API → CSV proxy (no Supabase)
 */
export async function fetchCatalog(): Promise<CatalogItem[]> {
    if (_cache && Date.now() - _cacheTs < CACHE_TTL) {
        return _cache;
    }

    // Strategy 1: JSONP (bypasses CORS)
    try {
        const rows = await fetchViaJSONP(CATALOG_SHEET_ID, '0', parseGVizToRows);
        const items = parseRowsToCatalog(rows);
        if (items.length > 0) {
            console.log(`${MODULE} ✅ JSONP loaded: ${items.length} items`);
            _cache = items;
            _cacheTs = Date.now();
            return items;
        }
    } catch (e) {
        console.warn(`${MODULE} JSONP failed:`, e);
    }

    // Strategy 2: Apps Script API
    try {
        const apiRes = await fetch(`${CATALOG_API_URL}?action=catalog&t=${Date.now()}`, { signal: AbortSignal.timeout(15000) });
        const json = await apiRes.json();
        if (json.success && Array.isArray(json.items)) {
            const items: CatalogItem[] = json.items.map((item: Record<string, string>) => ({
                chungLoai: item.chungLoai || '',
                nhanHang: item.nhanHang || '',
                sku: item.sku || '',
                tenSanPham: item.tenSanPham || '',
                dvt: item.dvt || '',
                kichThuoc: item.kichThuoc || '',
                chatLieu: item.chatLieu || '',
            }));
            console.log(`${MODULE} ✅ API loaded: ${items.length} items`);
            _cache = items;
            _cacheTs = Date.now();
            return items;
        }
    } catch (e) {
        console.warn(`${MODULE} API failed:`, e);
    }

    // Strategy 3: CSV via proxy
    const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(CATALOG_CSV_URL)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(CATALOG_CSV_URL)}`,
    ];
    for (const proxyUrl of proxies) {
        try {
            const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) continue;
            const text = await res.text();
            if (!text || text.length < 50) continue;
            const rows = parseCSV(text);
            const items = parseRowsToCatalog(rows);
            if (items.length > 0) {
                console.log(`${MODULE} ✅ CSV proxy loaded: ${items.length} items`);
                _cache = items;
                _cacheTs = Date.now();
                return items;
            }
        } catch { /* try next */ }
    }

    console.error(`${MODULE} ❌ All strategies failed`);
    return _cache || [];
}

/**
 * Subscribe to Realtime changes
 * 🔋 DISABLED in hybrid mode — data comes from Google Sheets
 */
export function subscribeToCatalogChanges(_onUpdate: () => void): () => void {
    console.log('[CatalogService] ℹ️ Realtime disabled (hybrid mode — using Google Sheets)');
    return () => {};
}

// ── Simple CSV parser ──
function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    const row: string[] = [];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') { current += '"'; i++; }
                else inQuotes = false;
            } else current += ch;
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') { row.push(current.trim()); current = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
                row.push(current.trim()); current = '';
                if (row.length > 0 && row.some(c => c)) rows.push([...row]);
                row.length = 0;
            } else current += ch;
        }
    }
    row.push(current.trim());
    if (row.some(c => c)) rows.push(row);
    return rows;
}

/**
 * ============================================================
 *  AVGFlow — Product Catalog Service
 *  Supabase-first → Apps Script API fallback → CSV fallback
 * ============================================================
 */
import { supabase } from '../lib/supabase';

const MODULE = '[CatalogService]';

// ── Sheet config (fallback) ──
const CATALOG_SHEET_ID = '1karhpP174qGeQudh3YopY3Zl68f_zXoqlsw8CYd1YhQ';
const CATALOG_CSV_URL = `https://docs.google.com/spreadsheets/d/${CATALOG_SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const CATALOG_API_URL = 'https://script.google.com/macros/s/AKfycbzo7AAGf9FdFJ7zZKYBODo_LcZpmiFosnVjvvPAxTdS7uafydpeBzoyRx9Qnwgh6tKI7g/exec';

const SUPABASE_TABLE = 'product_catalog';

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
const CACHE_TTL = 5 * 60 * 1000; // 5 min

/**
 * Parse raw Supabase rows → CatalogItem[]
 * Column mapping: A=chungLoai, B=nhanHang, C=sku, D=tenSanPham, E=dvt, F=kichThuoc, G=chatLieu
 */
function parseFromSupabase(rows: any[]): CatalogItem[] {
    return rows.map(r => {
        const c: string[] = r.row_content || [];
        // Sheet columns: A=chungLoai, B=nhanHang, C=image(skip), D=sku, E=tenSanPham, F=dvt, ..., I=kichThuoc, J=chatLieu
        return {
            chungLoai: (c[0] || '').trim(),
            nhanHang: (c[1] || '').trim(),
            sku: (c[3] || '').trim(),       // Col D (skip C = Hình ảnh)
            tenSanPham: (c[4] || '').trim(), // Col E
            dvt: (c[5] || '').trim(),        // Col F
            kichThuoc: (c[8] || '').trim(),  // Col I
            chatLieu: (c[9] || '').trim(),   // Col J
        };
    }).filter(item => item.nhanHang || item.tenSanPham);
}

/**
 * Fetch catalog — Supabase first, then API, then CSV
 */
export async function fetchCatalog(): Promise<CatalogItem[]> {
    // Cache hit
    if (_cache && Date.now() - _cacheTs < CACHE_TTL) {
        return _cache;
    }

    // Strategy 1: Supabase
    try {
        const { data, error } = await supabase
            .from(SUPABASE_TABLE)
            .select('row_index, row_content')
            .order('row_index', { ascending: true });

        if (!error && data && data.length > 0) {
            const items = parseFromSupabase(data);
            console.log(`${MODULE} ✅ Loaded from Supabase: ${items.length} items`);
            _cache = items;
            _cacheTs = Date.now();
            return items;
        }
        if (error) console.warn(`${MODULE} Supabase error:`, error.message);
    } catch (e) {
        console.warn(`${MODULE} Supabase fetch failed:`, e);
    }

    // Strategy 2: Apps Script API
    try {
        const apiRes = await fetch(`${CATALOG_API_URL}?action=catalog&t=${Date.now()}`);
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
            console.log(`${MODULE} ✅ Loaded from API: ${items.length} items`);
            _cache = items;
            _cacheTs = Date.now();
            return items;
        }
    } catch (e) {
        console.warn(`${MODULE} API fetch failed:`, e);
    }

    // Strategy 3: CSV fallback
    try {
        const res = await fetch(CATALOG_CSV_URL);
        const text = await res.text();
        const rows = parseCSV(text);
        if (rows.length <= 1) return [];

        const items: CatalogItem[] = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (r.length < 6) continue;
            items.push({
                chungLoai: (r[0] || '').trim(),
                nhanHang: (r[1] || '').trim(),
                sku: (r[2] || '').trim(),
                tenSanPham: (r[3] || '').trim(),
                dvt: (r[4] || '').trim(),
                kichThuoc: (r[5] || '').trim(),
                chatLieu: (r[6] || '').trim(),
            });
        }
        console.log(`${MODULE} ✅ Loaded from CSV: ${items.length} items`);
        _cache = items;
        _cacheTs = Date.now();
        return items;
    } catch (e) {
        console.error(`${MODULE} ❌ All strategies failed:`, e);
        return _cache || [];
    }
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

/**
 * =====================================================
 * AVGFlow — Print Order Service
 * =====================================================
 * Centralized service for print order data.
 * Architecture: Sheet → Apps Script → Supabase → App (Realtime)
 * 
 * COLUMN MAPPING (0-indexed from CSV/Supabase row_content):
 * [0]  = Thời gian (timestamp)
 * [1]  = Người đặt hàng (person)
 * [2]  = Chủng loại (category)
 * [3]  = Nhãn hàng (brand)
 * [4]  = SKU
 * [5]  = Tên sản phẩm (productName)
 * [6]  = Kích thước (size)
 * [7]  = ĐVT (unit)
 * [8]  = Chất liệu (material)
 * [9]  = SL đặt in (quantity)
 * [10] = SL giao (deliveryQuantity)
 * [11] = Ngày cần giao (deliveryDate)
 * [12] = Dự kiến giao (expectedDelivery)
 * [13] = Ghi chú (note)
 * [14] = Đơn giá (unitPrice)
 * [15] = Thành tiền (totalPrice)
 * [16] = Trạng thái (status)
 * [17] = Lý do hủy (cancelReason)
 * [18] = Người xử lý (updatedBy)
 * [19] = Thời gian xử lý (updatedAt)
 * =====================================================
 */

import { supabase } from '../lib/supabase';

const SUPABASE_TABLE = 'print_orders';
const PRINT_SHEET_ID = '16GLyiZLdBknve7P_JO9ly-Luy5vIgdizNmQH985zPeo';
const CSV_FALLBACK_URL = `https://docs.google.com/spreadsheets/d/${PRINT_SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

// Cache
let cachedRows: string[][] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30 seconds

export interface PrintOrder {
    id: string;
    rowIndex: number;
    timestamp: string;
    person: string;
    category: string;
    brand: string;
    sku: string;
    productName: string;
    size: string;
    unit: string;
    material: string;
    quantity: string;
    deliveryQuantity: string;
    deliveryDate: string;
    expectedDelivery: string;
    note: string;
    unitPrice: number;
    totalPrice: number;
    status: string;
    cancelReason: string;
    updatedBy: string;
    updatedAt: string;
}

/**
 * Fetch raw rows from Supabase, fallback to CSV
 */
export async function fetchPrintOrderRows(): Promise<string[][]> {
    // Check cache
    if (cachedRows && (Date.now() - cacheTimestamp) < CACHE_TTL) {
        console.log('[PrintOrderService] ✅ Cache hit:', cachedRows.length, 'rows');
        return cachedRows;
    }

    try {
        // 1. Primary: Supabase
        const { data, error } = await supabase
            .from(SUPABASE_TABLE)
            .select('row_index, row_content')
            .order('row_index', { ascending: true })
            .limit(5000);

        if (!error && data && data.length > 0) {
            const rows = data.map((item: { row_content: string[] }) => item.row_content);
            cachedRows = rows;
            cacheTimestamp = Date.now();
            console.log('[PrintOrderService] ✅ Loaded from Supabase:', rows.length, 'rows');
            return rows;
        }

        console.warn('[PrintOrderService] ⚠️ Supabase empty/error, falling back to CSV...');
    } catch (err) {
        console.warn('[PrintOrderService] ⚠️ Supabase fetch error, falling back to CSV...', err);
    }

    // 2. Fallback: Google Sheets CSV
    const res = await fetch(CSV_FALLBACK_URL);
    const text = await res.text();
    const rows = parseCSV(text);
    cachedRows = rows;
    cacheTimestamp = Date.now();
    console.log('[PrintOrderService] 📄 Loaded from CSV fallback:', rows.length, 'rows');
    return rows;
}

/**
 * Parse raw rows into PrintOrder objects
 */
export function parsePrintOrders(rows: string[][]): PrintOrder[] {
    if (rows.length < 2) return [];

    const parsed: PrintOrder[] = [];
    for (let i = 1; i < rows.length; i++) {
        const c = rows[i];
        if (!c[0] && !c[1] && !c[3]) continue;

        parsed.push({
            id: `po-${i}`,
            rowIndex: i + 1, // 1-based, row 1 = header
            timestamp: (c[0] || '').trim(),
            person: (c[1] || '').trim(),
            category: (c[2] || '').trim(),
            brand: (c[3] || '').trim(),
            sku: (c[4] || '').trim(),
            productName: (c[5] || '').trim(),
            size: (c[6] || '').trim(),
            unit: (c[7] || '').trim(),
            material: (c[8] || '').trim(),
            quantity: (c[9] || '').trim(),
            deliveryQuantity: (c[10] || '').trim(),
            deliveryDate: (c[11] || '').trim(),
            expectedDelivery: (c[12] || '').trim(),
            note: (c[13] || '').trim(),
            unitPrice: parseFloat((c[14] || '0').replace(/[.,\s]/g, '')) || 0,
            totalPrice: parseFloat((c[15] || '0').replace(/[.,\s]/g, '')) || 0,
            status: (c[16] || 'Chưa xử lý').trim(),
            cancelReason: (c[17] || '').trim(),
            updatedBy: (c[18] || '').trim(),
            updatedAt: (c[19] || '').trim(),
        });
    }

    // Auto-fix: deliveryQuantity looks like a date → swap to deliveryDate
    const datePattern = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}/;
    for (const order of parsed) {
        if (order.deliveryQuantity && datePattern.test(order.deliveryQuantity) && !order.deliveryDate) {
            order.deliveryDate = order.deliveryQuantity;
            order.deliveryQuantity = '';
        }
    }

    return parsed;
}

/**
 * Fetch + parse print orders (convenience)
 */
export async function fetchPrintOrders(): Promise<PrintOrder[]> {
    const rows = await fetchPrintOrderRows();
    return parsePrintOrders(rows);
}

/**
 * Subscribe to Supabase Realtime changes on print_orders
 */
export function subscribeToPrintOrderChanges(callback: () => void): () => void {
    const channel = supabase
        .channel('print_orders_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: SUPABASE_TABLE }, () => {
            console.log('[PrintOrderService] 🔔 Realtime update detected');
            cachedRows = null; // Invalidate cache
            callback();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Invalidate cache (useful after manual updates)
 */
export function invalidateCache(): void {
    cachedRows = null;
    cacheTimestamp = 0;
}

// ─── CSV Parser ───────────────────────────────────────────────
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

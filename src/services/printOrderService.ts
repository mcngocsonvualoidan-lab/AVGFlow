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


// 🔋 HYBRID MODE: Supabase disabled, using Google Sheets directly
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
 * Extract cell value from GViz cell object
 */
function extractGVizCellValue(cell: any): string {
    if (!cell) return '';
    if (cell.f) return cell.f;
    if (cell.v === null || cell.v === undefined) return '';
    if (typeof cell.v === 'boolean') return cell.v ? 'TRUE' : 'FALSE';
    return String(cell.v);
}

/**
 * Parse GViz response OBJECT to string[][] (used by JSONP callback)
 */
function parseGVizObject(data: any): string[][] {
    if (!data?.table?.rows) return [];
    const headers = (data.table.cols || []).map((col: any) => col.label || '');
    const rows: string[][] = [headers];
    for (const row of data.table.rows) {
        rows.push((row.c || []).map((cell: any) => extractGVizCellValue(cell)));
    }
    return rows;
}




/**
 * JSONP fetch for print orders (bypasses CORS)
 * Uses default google.visualization.Query.setResponse callback
 */
function fetchPrintOrdersViaJSONP(): Promise<string[][]> {
    return new Promise((resolve, reject) => {
        const uid = `print_${Date.now()}`;
        const scriptId = `__gviz_script_${uid}`;

        // Temporarily override the default callback
        const origSetResponse = (window as any).google?.visualization?.Query?.setResponse;

        // Ensure the namespace exists
        if (!(window as any).google) (window as any).google = {};
        if (!(window as any).google.visualization) (window as any).google.visualization = {};
        if (!(window as any).google.visualization.Query) (window as any).google.visualization.Query = {};

        (window as any).google.visualization.Query.setResponse = (response: any) => {
            cleanup();
            try {
                const rows = parseGVizObject(response);
                resolve(rows);
            } catch (e) { reject(e); }
        };

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://docs.google.com/spreadsheets/d/${PRINT_SHEET_ID}/gviz/tq?tqx=out:json&gid=0`;
        script.onerror = () => { cleanup(); reject(new Error('JSONP failed')); };
        const timer = setTimeout(() => { cleanup(); reject(new Error('JSONP timeout')); }, 15000);

        function cleanup() {
            clearTimeout(timer);
            // Restore original callback
            if (origSetResponse) {
                (window as any).google.visualization.Query.setResponse = origSetResponse;
            }
            const el = document.getElementById(scriptId);
            if (el) el.remove();
        }
        document.head.appendChild(script);
    });
}

/**
 * Fetch raw rows — 🔋 HYBRID: Google Sheets first (JSONP → CSV), skip Supabase
 */
export async function fetchPrintOrderRows(): Promise<string[][]> {
    // Check cache
    if (cachedRows && (Date.now() - cacheTimestamp) < CACHE_TTL) {
        console.log('[PrintOrderService] ✅ Cache hit:', cachedRows.length, 'rows');
        return cachedRows;
    }

    // Strategy 1: JSONP (bypasses CORS)
    try {
        const rows = await fetchPrintOrdersViaJSONP();
        if (rows.length > 1) {
            cachedRows = rows;
            cacheTimestamp = Date.now();
            console.log('[PrintOrderService] ✅ JSONP loaded:', rows.length, 'rows');
            return rows;
        }
    } catch (e) {
        console.warn('[PrintOrderService] JSONP failed:', e);
    }

    // Strategy 2: CSV via proxy
    const proxies = [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(CSV_FALLBACK_URL)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(CSV_FALLBACK_URL)}`,
    ];
    for (const url of proxies) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) continue;
            const text = await res.text();
            if (!text || text.length < 50) continue;
            const rows = parseCSV(text);
            if (rows.length > 1) {
                cachedRows = rows;
                cacheTimestamp = Date.now();
                console.log('[PrintOrderService] ✅ CSV proxy loaded:', rows.length, 'rows');
                return rows;
            }
        } catch { /* try next */ }
    }

    throw new Error('All print order data sources failed');
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
 * 🔋 DISABLED in hybrid mode — data comes from Google Sheets
 */
export function subscribeToPrintOrderChanges(_callback: () => void): () => void {
    console.log('[PrintOrderService] ℹ️ Realtime disabled (hybrid mode — using Google Sheets)');
    return () => {};
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

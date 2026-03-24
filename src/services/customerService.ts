/**
 * ============================================================
 *  AVGFlow — Customer Service
 *  🔋 HYBRID MODE: Google Sheets (JSONP) primary — saves Supabase bandwidth
 * ============================================================
 */

const MODULE = '[CustomerService]';

// ── Sheet config ──
const CUSTOMER_SHEET_ID = '1ZtqPNzUupl57Z2806sohQGNqj4W8GnzXOAGA3kbAqIQ';
const CUSTOMER_GID = '1450599696';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${CUSTOMER_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${CUSTOMER_GID}`;

export interface CustomerContact {
    company: string;
    department: string;
    position: string;
    name: string;
    address: string;
    phone: string;
    email: string;
}

// ── Cache ──
let _cache: CustomerContact[] | null = null;
let _cacheTs = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 min (increased from 5 for hybrid mode)

import { fetchViaJSONP, parseGVizToRows } from '../lib/jsonpQueue';


/**
 * Parse rows → CustomerContact[]
 */
function parseRowsToCustomers(rows: string[][]): CustomerContact[] {
    if (rows.length <= 1) return [];
    const items: CustomerContact[] = [];
    let lastCompany = '';
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const company = (r[1] || '').trim();
        const department = (r[2] || '').trim();
        const position = (r[3] || '').trim();
        const name = (r[4] || '').trim();
        const address = (r[5] || '').trim();
        const phone = (r[6] || '').trim();
        const email = (r[7] || '').trim();
        if (!name) continue;
        if (company && company !== '-') lastCompany = company;
        items.push({ company: lastCompany, department, position, name, address, phone, email });
    }
    return items;
}

/**
 * Fetch customers — 🔋 HYBRID: JSONP → CSV proxy (no Supabase)
 */
export async function fetchCustomers(): Promise<CustomerContact[]> {
    if (_cache && Date.now() - _cacheTs < CACHE_TTL) {
        return _cache;
    }

    // Strategy 1: JSONP (bypasses CORS)
    try {
        const rows = await fetchViaJSONP(CUSTOMER_SHEET_ID, CUSTOMER_GID, parseGVizToRows);
        const items = parseRowsToCustomers(rows);
        if (items.length > 0) {
            console.log(`${MODULE} ✅ JSONP loaded: ${items.length} contacts`);
            _cache = items;
            _cacheTs = Date.now();
            return items;
        }
    } catch (e) {
        console.warn(`${MODULE} JSONP failed:`, e);
    }

    // Strategy 2: CSV via proxy
    const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(CSV_URL)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(CSV_URL)}`,
    ];
    for (const proxyUrl of proxies) {
        try {
            const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) continue;
            const text = await res.text();
            if (!text || text.length < 50) continue;
            const rows = parseCSV(text);
            const items = parseRowsToCustomers(rows);
            if (items.length > 0) {
                console.log(`${MODULE} ✅ CSV proxy loaded: ${items.length} contacts`);
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
export function subscribeToCustomerChanges(_onUpdate: () => void): () => void {
    console.log('[CustomerService] ℹ️ Realtime disabled (hybrid mode — using Google Sheets)');
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

/**
 * Find a customer by email (case-insensitive)
 * Returns null if not found
 */
export async function findCustomerByEmail(email: string): Promise<CustomerContact | null> {
    const customers = await fetchCustomers();
    const normalized = email.toLowerCase().trim();
    return customers.find(c => c.email.toLowerCase().trim() === normalized) || null;
}

/**
 * Check if an email belongs to a known customer
 */
export async function isCustomerEmail(email: string): Promise<boolean> {
    const customer = await findCustomerByEmail(email);
    return customer !== null;
}

/**
 * Get unique company/unit names from column B
 * Returns sorted, deduplicated list
 */
export async function fetchCompanyNames(): Promise<string[]> {
    const customers = await fetchCustomers();
    const names = new Set<string>();
    customers.forEach(c => {
        if (c.company) names.add(c.company);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'vi'));
}

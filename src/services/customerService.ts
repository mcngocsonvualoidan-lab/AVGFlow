/**
 * ============================================================
 *  AVGFlow — Customer Service
 *  Supabase-first → CSV fallback
 * ============================================================
 */
import { supabase } from '../lib/supabase';

const MODULE = '[CustomerService]';

// ── Sheet config (fallback) ──
const CUSTOMER_SHEET_ID = '1ZtqPNzUupl57Z2806sohQGNqj4W8GnzXOAGA3kbAqIQ';
const CUSTOMER_GID = '1450599696';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${CUSTOMER_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${CUSTOMER_GID}`;

const SUPABASE_TABLE = 'customers';

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
const CACHE_TTL = 5 * 60 * 1000; // 5 min

/**
 * Parse raw Supabase rows → CustomerContact[]
 * Sheet columns: A(0)=STT/Company, B(1)=Company, C(2)=Bộ phận, D(3)=Chức vụ, E(4)=Tên, F(5)=Địa chỉ, G(6)=SĐT, H(7)=Email
 * Note: company may be empty for sub-rows — we carry forward the last known company
 */
function parseFromSupabase(rows: any[]): CustomerContact[] {
    let lastCompany = '';
    return rows.map(r => {
        const c: string[] = r.row_content || [];
        const company = (c[1] || '').trim();     // Col B
        const department = (c[2] || '').trim();  // Col C - Bộ phận
        const position = (c[3] || '').trim();    // Col D - Chức vụ
        const name = (c[4] || '').trim();        // Col E - Tên đối tác AV
        const address = (c[5] || '').trim();     // Col F - Địa chỉ
        const phone = (c[6] || '').trim();       // Col G - SĐT
        const email = (c[7] || '').trim();       // Col H - Email
        if (!name) return null;
        if (company && company !== '-') lastCompany = company;
        return { company: lastCompany, department, position, name, address, phone, email };
    }).filter((item): item is CustomerContact => item !== null);
}

/**
 * Fetch customers — Supabase first, then CSV
 */
export async function fetchCustomers(): Promise<CustomerContact[]> {
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
            console.log(`${MODULE} ✅ Loaded from Supabase: ${items.length} contacts`);
            _cache = items;
            _cacheTs = Date.now();
            return items;
        }
        if (error) console.warn(`${MODULE} Supabase error:`, error.message);
    } catch (e) {
        console.warn(`${MODULE} Supabase fetch failed:`, e);
    }

    // Strategy 2: CSV fallback
    try {
        const res = await fetch(CSV_URL);
        const text = await res.text();
        const rows = parseCSV(text);
        if (rows.length <= 1) return [];

        const items: CustomerContact[] = [];
        let lastCompany = '';
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            const company = (r[1] || '').trim();     // Col B
            const department = (r[2] || '').trim();  // Col C - Bộ phận
            const position = (r[3] || '').trim();    // Col D - Chức vụ
            const name = (r[4] || '').trim();        // Col E
            const address = (r[5] || '').trim();     // Col F
            const phone = (r[6] || '').trim();       // Col G
            const email = (r[7] || '').trim();       // Col H
            if (!name) continue;
            if (company && company !== '-') lastCompany = company;
            items.push({ company: lastCompany, department, position, name, address, phone, email });
        }
        console.log(`${MODULE} ✅ Loaded from CSV: ${items.length} contacts`);
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
 */
export function subscribeToCustomerChanges(onUpdate: () => void): () => void {
    const channel = supabase
        .channel('customer-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: SUPABASE_TABLE }, () => {
            _cache = null;
            onUpdate();
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
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

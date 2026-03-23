
import { supabase } from '../lib/supabase';

// ==================== LOCAL CACHE LAYER ====================
const CACHE_KEY = 'avgflow_directives_cache';
const CACHE_META_KEY = 'avgflow_directives_cache_meta';
const CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

interface CacheMeta {
    timestamp: number;
    rowCount: number;
    source: 'supabase' | 'sheet';
}

export const getCachedDirectives = (): { data: string[][] | null; meta: CacheMeta | null } => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        const metaRaw = localStorage.getItem(CACHE_META_KEY);
        if (!raw) return { data: null, meta: null };
        const data = JSON.parse(raw) as string[][];
        const meta = metaRaw ? JSON.parse(metaRaw) as CacheMeta : null;
        return { data, meta };
    } catch {
        return { data: null, meta: null };
    }
};

export const setCachedDirectives = (data: string[][], source: 'supabase' | 'sheet'): void => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_META_KEY, JSON.stringify({
            timestamp: Date.now(),
            rowCount: data.length,
            source,
        } as CacheMeta));
    } catch (e) {
        console.warn('Cache write failed (storage full?):', e);
    }
};

export const isCacheStale = (): boolean => {
    const { meta } = getCachedDirectives();
    if (!meta) return true;
    return Date.now() - meta.timestamp > CACHE_MAX_AGE_MS;
};

// Helper to fetch from Google Sheets (Legacy Source)
export const fetchFromGoogleSheet = async (): Promise<string[][]> => {
    const SOURCES = [
        // { id: '1YMauwbe9R8YprQGo3p4OjRA4y7hUqZ3kPpBasGWujGQ', gid: '80028445', year: 2025 },
        { id: '13cN2ert23B1W4wlySPXXVbCj-UgICEef5UQb7FI2vSA', gid: '318384172', year: 2026 }
    ];

    const PROXIES = [
        (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
    ];

    const allRows: string[][] = [];

    for (const source of SOURCES) {
        const TARGET_URLS = [
            `https://docs.google.com/spreadsheets/d/${source.id}/export?format=csv&gid=${source.gid}`,
            `https://docs.google.com/spreadsheets/d/${source.id}/gviz/tq?tqx=out:csv&gid=${source.gid}`
        ];

        let sourceText: string | null = null;

        outerProxyLoop:
        for (const targetUrl of TARGET_URLS) {
            for (const proxyGen of PROXIES) {
                try {
                    const proxyUrl = proxyGen(targetUrl);
                    const res = await fetch(proxyUrl);
                    if (res.ok) {
                        const text = await res.text();
                        if (!text.trim().startsWith('<!DOCTYPE') && !text.includes('<html') && text.length > 50) {
                            sourceText = text;
                            break outerProxyLoop;
                        }
                    }
                } catch (e) {
                    console.warn(`Fetch failed for ${source.year}: ${targetUrl} via proxy`, e);
                }
            }
        }

        if (sourceText) {
            // CSV Parsing for this source
            const rows: string[][] = [];
            let currentRow: string[] = [];
            let currentCell = '';
            let inQuote = false;

            for (let i = 0; i < sourceText.length; i++) {
                const char = sourceText[i];
                const nextChar = sourceText[i + 1];

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

            // --- SMART MERGE LOGIC ---
            // 1. Identify Header Row
            let headerIdx = -1;
            // Scan first 10 rows for Header Keywords
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const rowStr = rows[i].join(' ').toLowerCase();
                if (
                    (rowStr.includes('ngày') && rowStr.includes('nội dung')) ||
                    (rowStr.includes('date') && rowStr.includes('content')) ||
                    rowStr.includes('chủ thể') ||
                    rowStr.includes('đầu mối') ||
                    rowStr.includes('pic')
                ) {
                    headerIdx = i;
                    break;
                }
            }

            // Fallback: If no header found, assume row 0 is header (better than raw append)
            if (headerIdx === -1) {
                console.warn(`No explicit header found for year ${source.year}, assuming row 0.`);
                headerIdx = 0;
            }

            const sourceHeaders = rows[headerIdx];
            const sourceBody = rows.slice(headerIdx + 1).filter(r => r.length > 1 && !r[0].includes('google.visualization'));

            console.log(`Source ${source.year} parsed. Header at ${headerIdx}. Body size: ${sourceBody.length}`);

            // 1.5 Deduplicate Source Headers (Critical for Sheets with repeated column names like "Lỗi", "Khác")
            const uniqueSourceHeaders = [...sourceHeaders];
            const headerCounts: Record<string, number> = {};

            for (let i = 0; i < uniqueSourceHeaders.length; i++) {
                const h = uniqueSourceHeaders[i];
                if (headerCounts[h]) {
                    headerCounts[h]++;
                    uniqueSourceHeaders[i] = `${h}_${headerCounts[h]}`;
                } else {
                    headerCounts[h] = 1;
                }
            }
            // Use unique headers for mapping
            const headersToUse = uniqueSourceHeaders;

            // 2. If this is the FIRST valid source, set it as Master
            if (allRows.length === 0) {
                // Use headers directly
                // const headersWithYear = ["Source_Year", ...headersToUse];
                allRows.push(headersToUse);

                // Use body directly
                // const bodyWithYear = sourceBody.map(r => [source.year.toString(), ...r]);
                allRows.push(...sourceBody);
            } else {
                // 3. Align subsequent source to Master Header (row 0 of allRows)
                let masterHeaders = allRows[0];

                // --- DYNAMIC HEADER EXPANSION ---
                // identifying which source columns are NEW and need to be added to Master
                const newColIndices: number[] = [];
                const mapSourceToMaster: number[] = new Array(headersToUse.length).fill(-1);

                // Helper to find column index in a list of headers
                const findIndexInHeaders = (headers: string[], name: string) => {
                    return headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim());
                };

                // Semantic Indices in Master (Recalculate as we go if needed, but for now fixed)
                // Note: masterHeaders[0] is Source_Year.

                headersToUse.forEach((sHeader, sIdx) => {
                    // 1. Try Semantic Match first
                    const sLow = sHeader.toLowerCase();
                    if (['ngay', 'ngày', 'date', 'time', 'timeline'].some(k => sLow.includes(k))) {
                        const mIdx = masterHeaders.findIndex(h => ['ngay', 'ngày', 'date', 'time', 'timeline'].some(k => h.toLowerCase().includes(k)));
                        if (mIdx !== -1) { mapSourceToMaster[sIdx] = mIdx; return; }
                    }
                    if (['noi dung', 'nội dung', 'content', 'chi tiết'].some(k => sLow.includes(k))) {
                        const mIdx = masterHeaders.findIndex(h => ['noi dung', 'nội dung', 'content', 'chi tiết'].some(k => h.toLowerCase().includes(k)));
                        if (mIdx !== -1) { mapSourceToMaster[sIdx] = mIdx; return; }
                    }
                    if (['chu the', 'chủ thể', 'đầu mối', 'pic', 'phụ trách'].some(k => sLow.includes(k))) {
                        const mIdx = masterHeaders.findIndex(h => ['chu the', 'chủ thể', 'đầu mối', 'pic', 'phụ trách'].some(k => h.toLowerCase().includes(k)));
                        if (mIdx !== -1) { mapSourceToMaster[sIdx] = mIdx; return; }
                    }

                    // 2. Try Exact Name Match
                    const exactIdx = findIndexInHeaders(masterHeaders, sHeader);
                    if (exactIdx !== -1) {
                        mapSourceToMaster[sIdx] = exactIdx;
                    } else {
                        // 3. New Column!
                        newColIndices.push(sIdx);
                        // We will append this to master
                        // The new index in master will be current length + (position in newColIndices)
                        mapSourceToMaster[sIdx] = masterHeaders.length + newColIndices.length - 1;
                    }
                });

                // Update Master Headers if new columns found
                if (newColIndices.length > 0) {
                    const newHeaders = newColIndices.map(i => headersToUse[i]);
                    // Mutate the master header row in allRows
                    allRows[0] = [...masterHeaders, ...newHeaders];
                    masterHeaders = allRows[0]; // refresh reference

                    // Backfill existing rows with empty strings
                    for (let i = 1; i < allRows.length; i++) {
                        // Push empty strings for each new column
                        const padding = new Array(newColIndices.length).fill('');
                        allRows[i].push(...padding);
                    }
                }

                const alignedBody = sourceBody.map(row => {
                    const newRow = new Array(masterHeaders.length).fill('');
                    newRow[0] = source.year.toString(); // Source Year

                    row.forEach((cell, sIdx) => {
                        const mIdx = mapSourceToMaster[sIdx];
                        if (mIdx !== -1) {
                            newRow[mIdx] = cell;
                        }
                    });

                    return newRow;
                });
                allRows.push(...alignedBody);
            }
        }
    }

    if (allRows.length === 0) throw new Error("ALL_PROXIES_FAILED");

    return allRows;
};

const TABLE_NAME = 'executive_directives';

// Sync Data to Supabase (Overwrite)
export const syncToSupabase = async (data: string[][]): Promise<void> => {
    // 1. Delete all existing records
    const { error: deleteError } = await supabase.from(TABLE_NAME).delete().neq('row_index', -1);
    if (deleteError) {
        // If table doesn't exist, this might fail, but let's assume it exists or use handle
        console.warn("Delete error (might be first run):", deleteError);
    }

    // 2. Prepare Insert Payload
    const payload = data.map((row, index) => ({
        row_index: index,
        row_content: row // JSONB array
    }));

    // 3. Insert in batches (Supabase max 1000 usually, but let's be safe with 100)
    const BATCH_SIZE = 100;
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from(TABLE_NAME).insert(batch);
        if (insertError) throw insertError;
    }
};

// Fetch from Supabase (Optimized: parallel pagination)
export const fetchFromSupabase = async (): Promise<string[][]> => {
    // First, get the count to know how many pages we need
    const { count, error: countErr } = await supabase
        .from(TABLE_NAME)
        .select('*', { count: 'exact', head: true });

    if (countErr) {
        console.error('Supabase count error:', countErr);
        throw countErr;
    }

    if (!count || count === 0) return [];

    const PAGE_SIZE = 1000;
    const numPages = Math.ceil(count / PAGE_SIZE);

    // Fetch all pages in parallel for max speed
    const pagePromises = Array.from({ length: numPages }, (_, page) =>
        supabase
            .from(TABLE_NAME)
            .select('row_index, row_content')
            .order('row_index', { ascending: true })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    );

    const results = await Promise.all(pagePromises);

    const allData: any[] = [];
    for (const result of results) {
        if (result.error) {
            console.error('Supabase page error:', result.error);
            throw result.error;
        }
        if (result.data) allData.push(...result.data);
    }

    if (allData.length === 0) return [];

    const rows = allData.map((item: any) => item.row_content);
    // Cache the result
    setCachedDirectives(rows, 'supabase');
    return rows;
};

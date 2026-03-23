/**
 * Quick one-time sync: Customer Sheet → Supabase
 * Run: node scripts/sync-customers.mjs
 */

const SUPABASE_URL = 'https://hbcfslgxosdzlfuljxxn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RZmqGM8T25niehlC2NgIqg_oTrtnOcR';
const SHEET_ID = '1ZtqPNzUupl57Z2806sohQGNqj4W8GnzXOAGA3kbAqIQ';
const SHEET_GID = '1450599696';
const TABLE = 'customers';
const BACKUP_TABLE = 'customers_backup';

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

// ── CSV parser ──
function parseCSV(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    const row = [];
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

// ── Supabase helper ──
async function supabaseRequest(method, table, queryOrBody) {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    };

    const options = { method, headers };

    if (method === 'GET') {
        url += (queryOrBody || '');
    } else if (method === 'POST') {
        options.body = JSON.stringify(queryOrBody);
    } else if (method === 'DELETE') {
        url += (queryOrBody || '');
    }

    const resp = await fetch(url, options);
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text}`);
    }
    if (method === 'GET') return resp.json();
    return null;
}

async function main() {
    console.log('📥 Fetching customer sheet CSV...');
    const res = await fetch(CSV_URL);
    const text = await res.text();
    const csvRows = parseCSV(text);
    console.log(`  📊 CSV: ${csvRows.length} total rows (incl. header)`);

    if (csvRows.length <= 1) {
        console.log('⚠️ No data rows found!');
        return;
    }

    // Build records (skip header row)
    const rows = [];
    for (let i = 1; i < csvRows.length; i++) {
        const r = csvRows[i];
        // Skip completely empty rows
        if (r.every(c => !c.trim())) continue;
        rows.push({
            row_index: i + 1,
            row_content: r,
            synced_at: new Date().toISOString(),
        });
    }
    console.log(`  📋 ${rows.length} data rows to sync`);

    // Backup existing data
    console.log('💾 Creating backup...');
    try {
        await supabaseRequest('DELETE', BACKUP_TABLE, '?row_index=gt.0');
        for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100);
            await supabaseRequest('POST', BACKUP_TABLE, batch);
        }
        console.log(`  ✅ Backup: ${rows.length} rows`);
    } catch (e) {
        console.warn(`  ⚠️ Backup failed: ${e.message}`);
    }

    // Delete old data
    console.log('🗑️  Clearing old data...');
    await supabaseRequest('DELETE', TABLE, '?row_index=gt.0');

    // Insert new data
    console.log('⬆️  Inserting new data...');
    let syncCount = 0;
    for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        await supabaseRequest('POST', TABLE, batch);
        syncCount += batch.length;
        console.log(`  📦 Batch ${Math.floor(i / 100) + 1}: ${syncCount}/${rows.length}`);
    }

    console.log(`\n✅ DONE! Synced ${syncCount} customer rows to Supabase.`);

    // Verify
    console.log('\n🔍 Verifying...');
    const check = await supabaseRequest('GET', TABLE, '?select=row_index,row_content&limit=5&order=row_index.asc');
    console.log(`  First ${check.length} rows:`);
    for (const r of check) {
        const content = r.row_content;
        console.log(`    Row ${r.row_index}: Company="${content[1] || '-'}", Name="${content[4] || '-'}", Email="${content[7] || '-'}"`);
    }
}

main().catch(e => {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
});

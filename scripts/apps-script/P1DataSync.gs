/**
 * ============================================================
 *  AVGFlow — P1 Data Sync: Catalog + Customers + Meetings
 *  Google Sheet → Supabase (READ-ONLY sync, no Web App)
 * ============================================================
 *  
 *  CÁC BẢNG SYNC:
 *  1. Product Catalog (1karhpP174qGeQudh3YopY3Zl68f_zXoqlsw8CYd1YhQ)
 *     - Sheet: "Danh mục SP" → Supabase: product_catalog
 *  2. Customers (1ZtqPNzUupl57Z2806sohQGNqj4W8GnzXOAGA3kbAqIQ, gid=1450599696)
 *     - Sheet: "DSKH" → Supabase: customers
 *  3. Meeting Schedule (11p55tNRLRqVfgwEfrcTWJfxKA6dJQyDJq4CapgZ5o-M)
 *     - Multiple sheets (monthly GIDs) → Supabase: meeting_schedule
 *
 *  LƯU Ý: Script này dùng để sync READ-ONLY data.
 *  Mỗi bảng dữ liệu nằm trên một Google Sheet riêng biệt,
 *  nhưng đều sync vào cùng 1 Supabase project.
 *
 *  SETUP:
 *  1. Tạo 1 Google Apps Script project mới (standalone)
 *  2. Dán code này vào
 *  3. Chạy setupTriggers() 1 lần
 *  4. Chạy syncAll() để sync lần đầu
 * ============================================================
 */

// ─── CONFIG ───
var CONFIG = {
    SUPABASE_URL: 'https://hbcfslgxosdzlfuljxxn.supabase.co',
    SUPABASE_KEY: 'sb_publishable_RZmqGM8T25niehlC2NgIqg_oTrtnOcR',

    // Sheet IDs
    CATALOG_SHEET_ID: '1karhpP174qGeQudh3YopY3Zl68f_zXoqlsw8CYd1YhQ',
    CUSTOMER_SHEET_ID: '1ZtqPNzUupl57Z2806sohQGNqj4W8GnzXOAGA3kbAqIQ',
    MEETING_SHEET_ID: '11p55tNRLRqVfgwEfrcTWJfxKA6dJQyDJq4CapgZ5o-M',

    // Sheet names / GIDs
    CATALOG_SHEET_GID: 0,  // GID of first tab (reliable, doesn't depend on name)
    CUSTOMER_SHEET_GID: 1450599696,
    MEETING_GIDS: [
        { gid: '637878134', label: 'Tháng 03/2026' },
        { gid: '896887169', label: 'Tháng 02/2026' },
        { gid: '0', label: 'Tháng 01/2026' },
    ],

    // Supabase tables
    CATALOG_TABLE: 'product_catalog',
    CATALOG_BACKUP: 'product_catalog_backup',
    CUSTOMER_TABLE: 'customers',
    CUSTOMER_BACKUP: 'customers_backup',
    MEETING_TABLE: 'meeting_schedule',
    MEETING_BACKUP: 'meeting_schedule_backup',
};

// ─── SUPABASE HELPER ───
function supabaseRequest(method, table, queryOrBody) {
    var url = CONFIG.SUPABASE_URL + '/rest/v1/' + table;
    var options = {
        method: method,
        headers: {
            'apikey': CONFIG.SUPABASE_KEY,
            'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': method === 'POST' ? 'return=minimal' : 'return=minimal',
        },
        muteHttpExceptions: true,
    };

    if (method === 'GET') {
        url += (queryOrBody || '');
    } else if (method === 'POST') {
        options.payload = JSON.stringify(queryOrBody);
    } else if (method === 'DELETE') {
        url += (queryOrBody || '');
    }

    var resp = UrlFetchApp.fetch(url, options);
    var code = resp.getResponseCode();
    if (code >= 400) {
        return { error: 'HTTP ' + code + ': ' + resp.getContentText() };
    }
    if (method === 'GET') {
        try { return { data: JSON.parse(resp.getContentText()) }; }
        catch (_e) { return { data: [] }; }
    }
    return { success: true };
}

// ─── GENERIC SHEET → SUPABASE SYNC ───
function syncSheetToSupabase(sheetId, sheetNameOrGid, tableName, backupTable, extraFields) {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet;

    if (typeof sheetNameOrGid === 'string' && isNaN(parseInt(sheetNameOrGid))) {
        // It's a sheet name
        sheet = ss.getSheetByName(sheetNameOrGid);
    } else {
        // It's a GID — find sheet by GID
        var sheets = ss.getSheets();
        for (var s = 0; s < sheets.length; s++) {
            if (sheets[s].getSheetId() == sheetNameOrGid) {
                sheet = sheets[s];
                break;
            }
        }
    }

    if (!sheet) {
        Logger.log('❌ Sheet not found: ' + sheetNameOrGid);
        return { error: 'Sheet not found' };
    }

    var data = sheet.getDataRange().getValues();
    Logger.log('📊 ' + sheet.getName() + ': ' + data.length + ' rows');

    // Skip header row
    var rows = [];
    for (var i = 1; i < data.length; i++) {
        var row = data[i].map(function (cell) {
            if (cell instanceof Date) {
                // Google Sheets stores time-only values as Date with base date 30/12/1899.
                // Detect this and format as HH:mm instead of full datetime.
                var year = cell.getFullYear();
                var month = cell.getMonth(); // 0-based
                var day = cell.getDate();
                var hours = cell.getHours();
                var minutes = cell.getMinutes();
                var seconds = cell.getSeconds();
                
                // Time-only: date part is 1899-12-30 (Excel epoch for time-only values)
                if (year === 1899 && month === 11 && day === 30) {
                    return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'HH:mm');
                }
                
                // Date-only: no meaningful time component
                if (hours === 0 && minutes === 0 && seconds === 0) {
                    return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'dd/MM/yyyy');
                }
                
                // Full datetime
                return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
            }
            return String(cell || '');
        });

        // Skip empty rows
        if (row.every(function (c) { return !c.trim(); })) continue;

        var record = {
            row_index: i + 1,
            row_content: row,
            synced_at: new Date().toISOString(),
        };

        // Add extra fields (e.g., gid for meetings)
        if (extraFields) {
            for (var key in extraFields) {
                record[key] = extraFields[key];
            }
        }

        rows.push(record);
    }

    if (rows.length === 0) {
        Logger.log('⚠️ No data to sync');
        return { count: 0 };
    }

    // Backup
    var deleteQuery = extraFields && extraFields.gid
        ? '?gid=eq.' + extraFields.gid
        : '?row_index=gt.0';
    supabaseRequest('DELETE', backupTable, deleteQuery);

    // Copy to backup in batches
    var batchSize = 100;
    var backupCount = 0;
    for (var b = 0; b < rows.length; b += batchSize) {
        var batch = rows.slice(b, b + batchSize);
        var result = supabaseRequest('POST', backupTable, batch);
        if (!result.error) backupCount += batch.length;
    }
    Logger.log('💾 Backup: ' + backupCount + '/' + rows.length);

    // Delete old data
    supabaseRequest('DELETE', tableName, deleteQuery);

    // Insert new data in batches
    var syncCount = 0;
    var startTime = Date.now();
    for (var b2 = 0; b2 < rows.length; b2 += batchSize) {
        var batch2 = rows.slice(b2, b2 + batchSize);
        var r = supabaseRequest('POST', tableName, batch2);
        if (!r.error) syncCount += batch2.length;
        else Logger.log('❌ Batch error: ' + r.error);
    }

    var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    Logger.log('✅ ' + tableName + ': ' + syncCount + '/' + rows.length + ' rows in ' + elapsed + 's');

    return { count: syncCount, elapsed: elapsed };
}

// ─── SYNC FUNCTIONS ───

function syncCatalog() {
    Logger.log('🔄 Sync Product Catalog...');
    return syncSheetToSupabase(
        CONFIG.CATALOG_SHEET_ID,
        CONFIG.CATALOG_SHEET_GID,
        CONFIG.CATALOG_TABLE,
        CONFIG.CATALOG_BACKUP
    );
}

function syncCustomers() {
    Logger.log('🔄 Sync Customers...');
    return syncSheetToSupabase(
        CONFIG.CUSTOMER_SHEET_ID,
        CONFIG.CUSTOMER_SHEET_GID,
        CONFIG.CUSTOMER_TABLE,
        CONFIG.CUSTOMER_BACKUP
    );
}

function syncMeetings() {
    Logger.log('🔄 Sync Meeting Schedule...');
    var totalCount = 0;
    for (var m = 0; m < CONFIG.MEETING_GIDS.length; m++) {
        var mg = CONFIG.MEETING_GIDS[m];
        Logger.log('  📅 ' + mg.label + ' (gid=' + mg.gid + ')');
        var result = syncSheetToSupabase(
            CONFIG.MEETING_SHEET_ID,
            mg.gid,
            CONFIG.MEETING_TABLE,
            CONFIG.MEETING_BACKUP,
            { gid: mg.gid }
        );
        if (result && result.count) totalCount += result.count;
    }
    Logger.log('✅ Total meetings synced: ' + totalCount);
    return { count: totalCount };
}

/** Sync everything */
function syncAll() {
    Logger.log('🚀 === FULL P1 SYNC START ===');
    var start = Date.now();

    syncCatalog();
    syncCustomers();
    syncMeetings();

    var elapsed = ((Date.now() - start) / 1000).toFixed(1);
    Logger.log('🏁 === FULL P1 SYNC COMPLETE in ' + elapsed + 's ===');
}

// ─── TRIGGERS ───
function setupTriggers() {
    // Remove old triggers
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
        ScriptApp.deleteTrigger(triggers[i]);
    }

    // Periodic sync every 30 minutes (these are reference data, less frequent OK)
    ScriptApp.newTrigger('syncAll')
        .timeBased()
        .everyMinutes(30)
        .create();

    Logger.log('✅ Triggers set: syncAll every 30 minutes');
}

// ─── TEST ───
function testConnection() {
    try {
        var result = supabaseRequest('GET', CONFIG.CATALOG_TABLE, '?select=count&limit=1');
        if (result.error) throw new Error(result.error);

        Logger.log('✅ Kết nối Supabase OK!');
        Logger.log('Tables: ' + CONFIG.CATALOG_TABLE + ', ' + CONFIG.CUSTOMER_TABLE + ', ' + CONFIG.MEETING_TABLE);
    } catch (err) {
        Logger.log('❌ Lỗi: ' + err.message);
    }
}

/**
 * ============================================================
 *  AVGFlow — Print Order Sync v3
 *  Sheet ↔ Supabase + Web App Endpoints
 * ============================================================
 *
 *  KIẾN TRÚC:
 *  ┌─────────────┐  onChange   ┌─────────────┐  Realtime  ┌─────────┐
 *  │ Google Sheet │ ─────────→ │  Supabase   │ ─────────→ │   App   │
 *  └─────────────┘  (5s deb)  └─────────────┘            └─────────┘
 *        ↑                                                     │
 *        └──── doGet (update row) ─────────────────────────────┘
 *
 *  COLUMN MAPPING (1-indexed):
 *  A(1) = Thời gian              K(11) = SL giao
 *  B(2) = Người đặt hàng         L(12) = Ngày cần giao
 *  C(3) = Chủng loại             M(13) = Dự kiến giao
 *  D(4) = Nhãn hàng              N(14) = Ghi chú
 *  E(5) = SKU                    O(15) = Đơn giá
 *  F(6) = Tên sản phẩm           P(16) = Thành tiền
 *  G(7) = Kích thước             Q(17) = Trạng thái
 *  H(8) = ĐVT                   R(18) = Lý do hủy
 *  I(9) = Chất liệu             S(19) = Người xử lý
 *  J(10)= SL đặt in             T(20) = Thời gian xử lý
 *
 *  SETUP:
 *  1. Mở Google Sheet Đơn hàng In → Extensions → Apps Script
 *  2. Dán toàn bộ code này vào (thay thế toàn bộ code cũ)
 *  3. Chạy hàm setupTriggers() 1 lần
 *  4. Deploy → Manage deployments → Edit → New version → Deploy
 * ============================================================
 */

// ─── CONFIG ───────────────────────────────────────────────────
var CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://hbcfslgxosdzlfuljxxn.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_RZmqGM8T25niehlC2NgIqg_oTrtnOcR',
  TABLE_NAME: 'print_orders',
  BACKUP_TABLE_NAME: 'print_orders_backup',

  // Sheet
  SHEET_GID: 0,              // GID of first sheet (default)
  HEADER_ROW: 1,
  DATA_START_ROW: 2,

  // Sync settings
  BATCH_SIZE: 100,
  DEBOUNCE_SECONDS: 5,
  MIN_ROWS_TO_SYNC: 3,

  // Column mapping (1-indexed)
  COL: {
    TIMESTAMP: 1,          // A: Thời gian
    PERSON: 2,             // B: Người đặt hàng
    CATEGORY: 3,           // C: Chủng loại
    BRAND: 4,              // D: Nhãn hàng
    SKU: 5,                // E: SKU
    PRODUCT_NAME: 6,       // F: Tên sản phẩm
    SIZE: 7,               // G: Kích thước
    UNIT: 8,               // H: ĐVT
    MATERIAL: 9,           // I: Chất liệu
    QUANTITY: 10,          // J: SL đặt in
    DELIVERY_QTY: 11,      // K: SL giao
    DELIVERY_DATE: 12,     // L: Ngày cần giao
    EXPECTED_DELIVERY: 13, // M: Dự kiến giao
    NOTE: 14,              // N: Ghi chú
    UNIT_PRICE: 15,        // O: Đơn giá
    TOTAL_PRICE: 16,       // P: Thành tiền
    STATUS: 17,            // Q: Trạng thái
    CANCEL_REASON: 18,     // R: Lý do hủy
    UPDATED_BY: 19,        // S: Người xử lý
    UPDATED_AT: 20,        // T: Thời gian xử lý
  },
};


// ════════════════════════════════════════════════════════════════
//  PHẦN 1: SUPABASE SYNC (Sheet → Supabase)
// ════════════════════════════════════════════════════════════════

function supabaseRequest(method, query, body, tableName) {
  var table = tableName || CONFIG.TABLE_NAME;
  var url = CONFIG.SUPABASE_URL + '/rest/v1/' + table + (query || '');

  var options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY,
      'Prefer': method === 'POST' ? 'return=minimal' : 'return=representation',
    },
    muteHttpExceptions: true,
  };

  if (body) {
    options.payload = JSON.stringify(body);
  }

  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();

    if (code >= 200 && code < 300) {
      return { data: response.getContentText(), error: null };
    } else {
      return { data: null, error: { code: code, message: response.getContentText() } };
    }
  } catch (err) {
    return { data: null, error: { code: 0, message: err.message } };
  }
}

function shouldSync() {
  var cache = CacheService.getScriptCache();
  var lastSync = cache.get('last_sync_time');
  if (lastSync) {
    var elapsed = (Date.now() - parseInt(lastSync)) / 1000;
    if (elapsed < CONFIG.DEBOUNCE_SECONDS) {
      Logger.log('⏳ Debounce: ' + elapsed.toFixed(0) + 's. Bỏ qua.');
      return false;
    }
  }
  cache.put('last_sync_time', Date.now().toString(), 300);
  return true;
}

function getTargetSheet() {
  var ss = SpreadsheetApp.getActive();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === CONFIG.SHEET_GID) {
      return sheets[i];
    }
  }
  Logger.log('⚠️ Không tìm thấy GID ' + CONFIG.SHEET_GID + '. Dùng sheet: ' + sheets[0].getName());
  return sheets[0];
}

function syncSheetToSupabase() {
  var startTime = Date.now();
  var targetSheet = getTargetSheet();
  var data = targetSheet.getDataRange().getValues();

  if (data.length === 0) {
    Logger.log('🛡️ BẢO VỆ: Sheet trống! Từ chối sync.');
    return 0;
  }

  if (data.length < CONFIG.MIN_ROWS_TO_SYNC) {
    Logger.log('🛡️ BẢO VỆ: Chỉ ' + data.length + ' dòng (min: ' + CONFIG.MIN_ROWS_TO_SYNC + '). Từ chối!');
    return 0;
  }

  var rows = data.map(function(row) {
    return row.map(function(cell) {
      if (cell === null || cell === undefined) return '';
      if (cell instanceof Date) return formatDateVN(cell);
      return String(cell);
    });
  });

  Logger.log('📊 Đọc được ' + rows.length + ' dòng từ "' + targetSheet.getName() + '"');

  // Backup trước khi ghi đè
  backupCurrentData();

  // Xoá data cũ
  supabaseRequest('DELETE', '?row_index=neq.-1');

  // Insert theo batch
  var payload = rows.map(function(row, index) {
    return { row_index: index, row_content: row };
  });

  var insertedCount = 0;
  for (var i = 0; i < payload.length; i += CONFIG.BATCH_SIZE) {
    var batch = payload.slice(i, i + CONFIG.BATCH_SIZE);
    var result = supabaseRequest('POST', '', batch);
    if (result.error) {
      Logger.log('❌ Lỗi batch ' + (Math.floor(i / CONFIG.BATCH_SIZE) + 1) + ': ' + JSON.stringify(result.error));
    } else {
      insertedCount += batch.length;
    }
  }

  var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  Logger.log('✅ Supabase sync: ' + insertedCount + '/' + rows.length + ' dòng trong ' + elapsed + 's');
  return insertedCount;
}

function backupCurrentData() {
  var getResult = supabaseRequest('GET', '?select=row_index,row_content&order=row_index.asc&limit=5000');
  if (getResult.error || !getResult.data) return;

  var currentData;
  try { currentData = JSON.parse(getResult.data); } catch (e) { return; }
  if (!currentData || currentData.length === 0) return;

  supabaseRequest('DELETE', '?row_index=neq.-1', null, CONFIG.BACKUP_TABLE_NAME);

  var payload = currentData.map(function(item) {
    return { row_index: item.row_index, row_content: item.row_content };
  });

  var backedUp = 0;
  for (var i = 0; i < payload.length; i += CONFIG.BATCH_SIZE) {
    var batch = payload.slice(i, i + CONFIG.BATCH_SIZE);
    var result = supabaseRequest('POST', '', batch, CONFIG.BACKUP_TABLE_NAME);
    if (!result.error) backedUp += batch.length;
  }

  Logger.log('💾 Backup: ' + backedUp + '/' + currentData.length + ' dòng');
}

function restoreFromBackup() {
  Logger.log('🔄 Khôi phục từ backup...');
  var getResult = supabaseRequest('GET', '?select=row_index,row_content&order=row_index.asc&limit=5000', null, CONFIG.BACKUP_TABLE_NAME);
  if (getResult.error || !getResult.data) { Logger.log('❌ Không đọc được backup'); return; }

  var backupData;
  try { backupData = JSON.parse(getResult.data); } catch (e) { Logger.log('❌ Parse error'); return; }
  if (!backupData || backupData.length === 0) { Logger.log('❌ Backup trống'); return; }

  supabaseRequest('DELETE', '?row_index=neq.-1');

  var restored = 0;
  for (var i = 0; i < backupData.length; i += CONFIG.BATCH_SIZE) {
    var batch = backupData.slice(i, i + CONFIG.BATCH_SIZE).map(function(item) {
      return { row_index: item.row_index, row_content: item.row_content };
    });
    var result = supabaseRequest('POST', '', batch);
    if (!result.error) restored += batch.length;
  }

  Logger.log('✅ Khôi phục: ' + restored + '/' + backupData.length + ' dòng');
}


// ════════════════════════════════════════════════════════════════
//  PHẦN 2: WEB APP ENDPOINTS (App → Sheet)
// ════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var result = routeAction(body);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var params = e.parameter || {};
    var result = routeAction(params);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function routeAction(params) {
  var action = params.action || 'health';

  switch (action) {
    case 'update':
      return handleUpdateRow(params);
    case 'syncToSupabase':
      var count = syncSheetToSupabase();
      return { success: true, synced: count };
    case 'health':
      return {
        success: true,
        message: 'AVGFlow Print Order Sync v3 (Supabase)',
        timestamp: new Date().toISOString(),
        version: 'v3-supabase'
      };
    default:
      return { success: false, error: 'Unknown action: ' + action };
  }
}

/**
 * Update a row based on params from the web app.
 * The app sends: rowIndex, status, unitPrice, totalPrice, expectedDelivery,
 *                deliveryQuantity, cancelReason, updatedBy, updatedAt
 */
function handleUpdateRow(params) {
  var rowIndex = parseInt(params.rowIndex, 10);
  if (!rowIndex || rowIndex < CONFIG.DATA_START_ROW) {
    return { success: false, error: 'Invalid rowIndex: ' + params.rowIndex };
  }

  var sheet = getTargetSheet();
  var lastRow = sheet.getLastRow();
  if (rowIndex > lastRow) {
    return { success: false, error: 'rowIndex ' + rowIndex + ' exceeds lastRow ' + lastRow };
  }

  // Apply each update field
  if (params.status !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.STATUS).setValue(params.status);
  }
  if (params.unitPrice !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.UNIT_PRICE).setValue(params.unitPrice === '' ? '' : params.unitPrice);
  }
  if (params.totalPrice !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.TOTAL_PRICE).setValue(params.totalPrice === '' ? '' : params.totalPrice);
  }
  if (params.expectedDelivery !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.EXPECTED_DELIVERY).setValue(params.expectedDelivery);
  }
  if (params.deliveryQuantity !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.DELIVERY_QTY).setValue(params.deliveryQuantity);
  }
  if (params.cancelReason !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.CANCEL_REASON).setValue(params.cancelReason);
  }
  if (params.updatedBy !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.UPDATED_BY).setValue(params.updatedBy);
  }
  if (params.updatedAt !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.UPDATED_AT).setValue(params.updatedAt);
  }

  Logger.log('✅ Updated row ' + rowIndex + ': ' + JSON.stringify(params));

  // Trigger delayed Supabase sync
  triggerDelayedSync();

  return { success: true, rowIndex: rowIndex };
}


// ════════════════════════════════════════════════════════════════
//  PHẦN 3: TRIGGERS & AUTOMATION
// ════════════════════════════════════════════════════════════════

function setupTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();

  ScriptApp.newTrigger('periodicSync')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('✅ Đã cài đặt triggers!');
  Logger.log('  1. onChange → syncSheetToSupabase (debounce ' + CONFIG.DEBOUNCE_SECONDS + 's)');
  Logger.log('  2. Mỗi 10 phút → periodicSync');
}

function onSheetChange(e) {
  try {
    if (e && e.changeType && !['EDIT', 'INSERT_ROW', 'INSERT_COLUMN', 'REMOVE_ROW', 'REMOVE_COLUMN', 'OTHER'].includes(e.changeType)) {
      return;
    }
    if (!shouldSync()) return;
    syncSheetToSupabase();
  } catch (err) {
    Logger.log('❌ onSheetChange error: ' + err.message);
  }
}

function periodicSync() {
  Logger.log('🔄 Periodic sync...');
  syncSheetToSupabase();
}

function triggerDelayedSync() {
  var cache = CacheService.getScriptCache();
  cache.put('pending_sync', 'true', 10);
}


// ════════════════════════════════════════════════════════════════
//  PHẦN 4: UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════

function formatDateVN(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  try {
    var d = new Date(date);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    if (y < 2000) {
      var hours = d.getHours();
      var minutes = d.getMinutes();
      if (hours > 0 || minutes > 0) {
        return hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
      }
      return '';
    }
    var dd = d.getDate().toString().padStart(2, '0');
    var mm = (d.getMonth() + 1).toString().padStart(2, '0');
    var hh = d.getHours().toString().padStart(2, '0');
    var mi = d.getMinutes().toString().padStart(2, '0');
    var ss = d.getSeconds().toString().padStart(2, '0');
    return dd + '/' + mm + '/' + y + ' ' + hh + ':' + mi + ':' + ss;
  } catch (e) {
    return String(date);
  }
}


// ════════════════════════════════════════════════════════════════
//  PHẦN 5: CUSTOM MENU & MANUAL OPERATIONS
// ════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔄 AVGFlow Sync')
    .addItem('📤 Sync → Supabase', 'manualSync')
    .addItem('🔁 Full Sync (backup + sync)', 'fullSync')
    .addSeparator()
    .addItem('💾 Xem Backup', 'checkBackup')
    .addItem('🔄 Khôi phục từ Backup', 'restoreFromBackup')
    .addSeparator()
    .addItem('⚙️ Cài Triggers', 'setupTriggers')
    .addItem('🔍 Check Triggers', 'checkTriggerStatus')
    .addItem('🗑️ Xoá Triggers', 'removeAllTriggers')
    .addSeparator()
    .addItem('🧪 Test Supabase', 'testSupabaseConnection')
    .addToUi();
}

function manualSync() {
  Logger.log('🔄 Manual sync → Supabase...');
  syncSheetToSupabase();
}

function fullSync() {
  Logger.log('=== FULL SYNC v3 ===');
  var pushed = syncSheetToSupabase();
  Logger.log('Pushed to Supabase: ' + pushed + ' rows');
}

function checkBackup() {
  var countResult = supabaseRequest('GET', '?select=row_index', null, CONFIG.BACKUP_TABLE_NAME);
  if (countResult.error) {
    Logger.log('❌ Không đọc được backup: ' + JSON.stringify(countResult.error));
    return;
  }
  var data;
  try { data = JSON.parse(countResult.data); } catch(e) { data = []; }
  Logger.log('💾 Backup có ' + (data ? data.length : 0) + ' dòng');
}

function checkTriggerStatus() {
  var triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    Logger.log('❌ Chưa có trigger! Chạy setupTriggers()');
    return;
  }
  Logger.log('✅ Có ' + triggers.length + ' trigger:');
  triggers.forEach(function(t, i) {
    Logger.log('  ' + (i + 1) + '. ' + t.getEventType() + ' → ' + t.getHandlerFunction());
  });
}

function removeAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });
  Logger.log('🗑️ Đã xoá ' + triggers.length + ' trigger(s)');
}

function testSupabaseConnection() {
  var ui = SpreadsheetApp.getUi();
  try {
    var testPayload = [{ row_index: -999, row_content: ['test', new Date().toISOString()] }];
    var writeResult = supabaseRequest('POST', '', testPayload);
    if (writeResult.error) {
      ui.alert('❌ Lỗi ghi', JSON.stringify(writeResult.error), ui.ButtonSet.OK);
      return;
    }

    var readResult = supabaseRequest('GET', '?row_index=eq.-999');
    if (readResult.error) {
      ui.alert('❌ Lỗi đọc', JSON.stringify(readResult.error), ui.ButtonSet.OK);
      return;
    }

    supabaseRequest('DELETE', '?row_index=eq.-999');

    ui.alert('✅ Kết nối Supabase OK!',
      'Bảng: ' + CONFIG.TABLE_NAME + '\n' +
      'URL: ' + CONFIG.SUPABASE_URL + '\n' +
      'Version: v3-supabase',
      ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('❌ Lỗi', err.message, ui.ButtonSet.OK);
  }
}

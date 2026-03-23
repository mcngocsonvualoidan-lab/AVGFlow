/**
 * ============================================================
 *  AVGFlow — Design Order Sync v3
 *  Sheet ↔ Supabase + Web App Endpoints
 * ============================================================
 *
 *  KIẾN TRÚC:
 *  ┌─────────────┐  onChange   ┌─────────────┐  Realtime  ┌─────────┐
 *  │ Google Sheet │ ─────────→ │  Supabase   │ ─────────→ │   App   │
 *  └─────────────┘  (5s deb)  └─────────────┘            └─────────┘
 *        ↑                                                     │
 *        └──── doGet (updateStatus/updateDelivery) ────────────┘
 *
 *  THAY THẾ: Script Firebase RTDB cũ (v2) bị timeout
 *  MỚI: Supabase batch sync, nhanh hơn 10x
 *
 *  COLUMN MAPPING (1-indexed):
 *  A(1) = Dấu thời gian        G(7) = Dự kiến giao hàng
 *  B(2) = Bạn là ai?            H(8) = Người xử lý
 *  C(3) = Tên thương hiệu      I(9) = Trạng thái
 *  D(4) = Yêu cầu              J(10)= Hoàn thành (Leader check)
 *  E(5) = Mô tả, Ghi chú       K(11)= Thời gian hoàn thành
 *  F(6) = Số lượng thực nhận
 *
 *  SETUP:
 *  1. Mở Google Sheet Đơn hàng thiết kế → Extensions → Apps Script
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
  TABLE_NAME: 'design_orders',
  BACKUP_TABLE_NAME: 'design_orders_backup',

  // Sheet
  SHEET_GID: 485384320,       // GID of "Phản hồi biểu mẫu" tab
  HEADER_ROW: 1,
  DATA_START_ROW: 2,

  // Sync settings
  BATCH_SIZE: 100,
  DEBOUNCE_SECONDS: 5,
  MIN_ROWS_TO_SYNC: 3,

  // Column mapping (1-indexed)
  COL: {
    TIMESTAMP: 1,        // A: Dấu thời gian
    PERSON: 2,           // B: Bạn là ai?
    BRAND: 3,            // C: Tên thương hiệu
    REQUEST: 4,          // D: Yêu cầu
    DESCRIPTION: 5,      // E: Mô tả, Ghi chú
    QUANTITY: 6,          // F: Số lượng thực nhận
    DELIVERY_EST: 7,     // G: Dự kiến giao hàng
    HANDLER: 8,          // H: Người xử lý
    STATUS: 9,           // I: Trạng thái
    LEADER_CHECK: 10,    // J: Hoàn thành (Leader check)
    COMPLETION_TIME: 11, // K: Thời gian hoàn thành
  },
};


// ════════════════════════════════════════════════════════════════
//  PHẦN 1: SUPABASE SYNC (Sheet → Supabase)
// ════════════════════════════════════════════════════════════════

// ─── SUPABASE API HELPER ──────────────────────────────────────

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

// ─── DEBOUNCE ─────────────────────────────────────────────────

function shouldSync() {
  var cache = CacheService.getScriptCache();
  var lastSync = cache.get('last_sync_time');

  if (lastSync) {
    var elapsed = (Date.now() - parseInt(lastSync)) / 1000;
    if (elapsed < CONFIG.DEBOUNCE_SECONDS) {
      Logger.log('⏳ Debounce: Chỉ mới ' + elapsed.toFixed(0) + 's. Bỏ qua.');
      return false;
    }
  }

  cache.put('last_sync_time', Date.now().toString(), 300);
  return true;
}

// ─── GET TARGET SHEET ─────────────────────────────────────────

function getTargetSheet() {
  var ss = SpreadsheetApp.getActive();
  var sheets = ss.getSheets();

  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === CONFIG.SHEET_GID) {
      return sheets[i];
    }
  }

  // Fallback: sheet đầu tiên
  Logger.log('⚠️ Không tìm thấy GID ' + CONFIG.SHEET_GID + '. Dùng sheet: ' + sheets[0].getName());
  return sheets[0];
}

// ─── CORE SYNC: Sheet → Supabase ──────────────────────────────

function syncSheetToSupabase() {
  var startTime = Date.now();
  var targetSheet = getTargetSheet();

  // 1. Đọc toàn bộ dữ liệu
  var data = targetSheet.getDataRange().getValues();

  if (data.length === 0) {
    Logger.log('🛡️ BẢO VỆ: Sheet trống! Từ chối sync.');
    return 0;
  }

  // 🛡️ BẢO VỆ: Kiểm tra số dòng tối thiểu
  if (data.length < CONFIG.MIN_ROWS_TO_SYNC) {
    Logger.log('🛡️ BẢO VỆ: Sheet chỉ có ' + data.length + ' dòng (min: ' + CONFIG.MIN_ROWS_TO_SYNC + '). Từ chối sync!');
    return 0;
  }

  // 2. Chuyển đổi thành string[][]
  var rows = data.map(function(row) {
    return row.map(function(cell) {
      if (cell === null || cell === undefined) return '';
      if (cell instanceof Date) {
        return formatDateVN(cell);
      }
      return String(cell);
    });
  });

  Logger.log('📊 Đọc được ' + rows.length + ' dòng từ "' + targetSheet.getName() + '"');

  // 🛡️ Backup trước khi ghi đè
  backupCurrentData();

  // 3. Xoá data cũ
  supabaseRequest('DELETE', '?row_index=neq.-1');

  // 4. Insert data mới theo batch
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

// ─── BACKUP & RESTORE ────────────────────────────────────────

function backupCurrentData() {
  var getResult = supabaseRequest('GET', '?select=row_index,row_content&order=row_index.asc&limit=5000', null, CONFIG.TABLE_NAME);
  if (getResult.error || !getResult.data) return;

  var currentData;
  try { currentData = JSON.parse(getResult.data); } catch (e) { return; }
  if (!currentData || currentData.length === 0) return;

  // Xoá backup cũ
  supabaseRequest('DELETE', '?row_index=neq.-1', null, CONFIG.BACKUP_TABLE_NAME);

  // Insert vào backup
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
    Logger.log('doPost error: ' + err.message);
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
    case 'updateStatus':
      return handleUpdateStatus(params.orderId, params.status, params.updatedBy);
    case 'updateDelivery':
      return handleUpdateDelivery(params.orderId, params.deliveryDate, params.updatedBy);
    case 'updateBoth':
      return handleUpdateBoth(params.orderId, params.status, params.deliveryDate, params.updatedBy);
    case 'syncToSupabase':
      var count = syncSheetToSupabase();
      return { success: true, synced: count };
    case 'getOrders':
      return getAllOrdersAsJSON();
    case 'health':
      return {
        success: true,
        message: 'AVGFlow Design Order Sync v3 (Supabase)',
        timestamp: new Date().toISOString(),
        version: 'v3-supabase'
      };
    default:
      return { success: false, error: 'Unknown action: ' + action };
  }
}

// ─── HANDLER FUNCTIONS (Ghi từ App → Sheet → Supabase) ───────

function handleUpdateStatus(orderId, newStatus, updatedBy) {
  var rowIndex = findRowByOrderId(orderId);
  if (!rowIndex) {
    return { success: false, error: 'Order not found: ' + orderId };
  }

  var sheet = getTargetSheet();

  // Ghi trạng thái vào cột I
  sheet.getRange(rowIndex, CONFIG.COL.STATUS).setValue(newStatus);

  // Cập nhật handler (cột H) nếu trống
  var currentHandler = sheet.getRange(rowIndex, CONFIG.COL.HANDLER).getValue();
  if ((!currentHandler || currentHandler.toString().trim() === '') && updatedBy) {
    sheet.getRange(rowIndex, CONFIG.COL.HANDLER).setValue(updatedBy);
  }

  // Nếu hoàn thành → ghi thời gian vào cột K
  if (newStatus.toLowerCase().indexOf('hoàn thành') !== -1) {
    sheet.getRange(rowIndex, CONFIG.COL.COMPLETION_TIME).setValue(formatDateVN(new Date()));
  }

  Logger.log('✅ Trạng thái đơn ' + orderId + ' → ' + newStatus);

  // Auto-sync → Supabase (debounced)
  triggerDelayedSync();

  return { success: true, orderId: orderId, status: newStatus };
}

function handleUpdateDelivery(orderId, deliveryDate, updatedBy) {
  var rowIndex = findRowByOrderId(orderId);
  if (!rowIndex) {
    return { success: false, error: 'Order not found: ' + orderId };
  }

  var sheet = getTargetSheet();
  var formatted = formatISOtoVN(deliveryDate);
  sheet.getRange(rowIndex, CONFIG.COL.DELIVERY_EST).setValue(formatted);

  Logger.log('✅ Dự kiến giao đơn ' + orderId + ' → ' + formatted);

  triggerDelayedSync();
  return { success: true, orderId: orderId, deliveryDate: formatted };
}

function handleUpdateBoth(orderId, newStatus, deliveryDate, updatedBy) {
  var rowIndex = findRowByOrderId(orderId);
  if (!rowIndex) {
    return { success: false, error: 'Order not found: ' + orderId };
  }

  var sheet = getTargetSheet();

  if (newStatus) {
    sheet.getRange(rowIndex, CONFIG.COL.STATUS).setValue(newStatus);
    if (newStatus.toLowerCase().indexOf('hoàn thành') !== -1) {
      sheet.getRange(rowIndex, CONFIG.COL.COMPLETION_TIME).setValue(formatDateVN(new Date()));
    }
  }

  if (deliveryDate) {
    sheet.getRange(rowIndex, CONFIG.COL.DELIVERY_EST).setValue(formatISOtoVN(deliveryDate));
  }

  var currentHandler = sheet.getRange(rowIndex, CONFIG.COL.HANDLER).getValue();
  if ((!currentHandler || currentHandler.toString().trim() === '') && updatedBy) {
    sheet.getRange(rowIndex, CONFIG.COL.HANDLER).setValue(updatedBy);
  }

  Logger.log('✅ Cập nhật đơn ' + orderId + ': status=' + newStatus + ', delivery=' + deliveryDate);

  triggerDelayedSync();
  return { success: true, orderId: orderId };
}


// ════════════════════════════════════════════════════════════════
//  PHẦN 3: TRIGGERS & AUTOMATION
// ════════════════════════════════════════════════════════════════

function setupTriggers() {
  // Xoá tất cả trigger cũ
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // 1. onChange: Sheet thay đổi → sync Supabase (debounce 5s)
  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();

  // 2. Periodic: Mỗi 10 phút sync toàn bộ (safety net)
  ScriptApp.newTrigger('periodicSync')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('✅ Đã cài đặt triggers!');
  Logger.log('  1. onChange → syncSheetToSupabase (debounce ' + CONFIG.DEBOUNCE_SECONDS + 's)');
  Logger.log('  2. Mỗi 10 phút → periodicSync');
  Logger.log('  Column mapping: A=Time B=Person C=Brand D=Request E=Desc F=Qty G=Delivery H=Handler I=Status J=LeaderCheck K=CompletionTime');
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

/**
 * Trigger Supabase sync sau 3 giây (cho Web App handlers).
 * Dùng ScriptProperties thay vì Utilities.sleep() để không block response.
 */
function triggerDelayedSync() {
  var cache = CacheService.getScriptCache();
  cache.put('pending_sync', 'true', 10);
  // onChange trigger sẽ bắt thay đổi Sheet và sync
  // Nếu không, periodicSync sẽ bắt sau ≤ 10 phút
}


// ════════════════════════════════════════════════════════════════
//  PHẦN 4: UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════

function findRowByOrderId(orderId) {
  if (!orderId) return null;

  // orderId format: "row-X" where X is 1-based data row index
  if (orderId.indexOf('row-') === 0) {
    var dataIndex = parseInt(orderId.split('-')[1], 10);
    var rowNum = CONFIG.DATA_START_ROW + dataIndex - 1; // row-1 → row 2
    var lastRow = getTargetSheet().getLastRow();
    if (rowNum >= CONFIG.DATA_START_ROW && rowNum <= lastRow) {
      return rowNum;
    }
  }

  return null;
}

function formatDateVN(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  try {
    var d = new Date(date);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    if (y < 2000) {
      // Excel epoch — time-only value
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

function formatISOtoVN(isoString) {
  if (!isoString) return '';
  try {
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    var dd = d.getDate().toString().padStart(2, '0');
    var mm = (d.getMonth() + 1).toString().padStart(2, '0');
    var yyyy = d.getFullYear();
    var hh = d.getHours().toString().padStart(2, '0');
    var mi = d.getMinutes().toString().padStart(2, '0');
    return dd + '/' + mm + '/' + yyyy + ' • ' + hh + ':' + mi;
  } catch (e) {
    return isoString;
  }
}

function getAllOrdersAsJSON() {
  var sheet = getTargetSheet();
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(11, sheet.getLastColumn());

  if (lastRow < CONFIG.DATA_START_ROW) {
    return { success: true, orders: [], count: 0 };
  }

  var values = sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, lastCol).getValues();
  var orders = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var timestamp = row[CONFIG.COL.TIMESTAMP - 1];
    var person = row[CONFIG.COL.PERSON - 1];
    var brand = row[CONFIG.COL.BRAND - 1];

    if (!timestamp && !person && !brand) continue;

    orders.push({
      id: 'row-' + (i + 1),
      time: formatDateVN(timestamp),
      person: (person || '').toString().trim(),
      brand: (brand || '').toString().trim(),
      request: (row[CONFIG.COL.REQUEST - 1] || '').toString().trim(),
      description: (row[CONFIG.COL.DESCRIPTION - 1] || '').toString().trim(),
      quantity: (row[CONFIG.COL.QUANTITY - 1] || '').toString().trim(),
      deliveryEst: formatDateVN(row[CONFIG.COL.DELIVERY_EST - 1]),
      handler: (row[CONFIG.COL.HANDLER - 1] || '').toString().trim(),
      status: (row[CONFIG.COL.STATUS - 1] || 'Đang xử lý').toString().trim(),
    });
  }

  return { success: true, orders: orders, count: orders.length };
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
  var getResult = supabaseRequest('GET', '?select=row_index&order=row_index.asc&limit=1', null, CONFIG.BACKUP_TABLE_NAME);
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
    // Test write
    var testPayload = [{ row_index: -999, row_content: ['test', new Date().toISOString()] }];
    var writeResult = supabaseRequest('POST', '', testPayload);

    if (writeResult.error) {
      ui.alert('❌ Lỗi ghi', 'Không thể ghi vào Supabase:\n' + JSON.stringify(writeResult.error), ui.ButtonSet.OK);
      return;
    }

    // Test read
    var readResult = supabaseRequest('GET', '?row_index=eq.-999');
    if (readResult.error) {
      ui.alert('❌ Lỗi đọc', JSON.stringify(readResult.error), ui.ButtonSet.OK);
      return;
    }

    // Cleanup
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

function forceSyncIgnoreProtection() {
  Logger.log('⚠️ FORCE SYNC: Bỏ qua MIN_ROWS check');
  var orig = CONFIG.MIN_ROWS_TO_SYNC;
  CONFIG.MIN_ROWS_TO_SYNC = 0;
  syncSheetToSupabase();
  CONFIG.MIN_ROWS_TO_SYNC = orig;
}

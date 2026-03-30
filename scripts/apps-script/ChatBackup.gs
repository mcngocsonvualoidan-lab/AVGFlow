/**
 * ============================================================
 *  AVGFlow — Chat Backup: Supabase → Google Sheet
 * ============================================================
 *
 *  Backup tin nhắn chat từ Supabase (ticket_messages)
 *  sang tab "ChatLog" trên Google Sheet.
 *
 *  ┌──────────────┐  REST API   ┌──────────────┐
 *  │   Supabase   │ ──────────→ │ Google Sheet  │
 *  │ ticket_msgs  │  mỗi 6 giờ  │  "ChatLog"   │
 *  └──────────────┘             └──────────────┘
 *
 *  ✅ Incremental: Chỉ backup messages MỚI (chưa có trên Sheet)
 *  ✅ Safe: Không bao giờ xóa data trên Sheet
 *  ✅ Auto: Time-based trigger mỗi 6 giờ
 *  ✅ Idempotent: Chạy lại không tạo duplicate
 *
 *  COLUMNS (tab "ChatLog"):
 *  A = id (Supabase UUID)
 *  B = ticket_id
 *  C = ticket_code
 *  D = sender
 *  E = sender_role
 *  F = sender_email
 *  G = text
 *  H = image_url
 *  I = created_at
 *  J = backed_up_at
 *
 *  SETUP:
 *  1. Mở Google Sheet "Đơn hàng Thiết kế"
 *  2. Extensions → Apps Script → Tạo file ChatBackup.gs
 *  3. Paste code này
 *  4. Chạy setupChatBackupTrigger() 1 lần
 *  5. Hoặc chạy backupChatMessages() để test
 * ============================================================
 */

// ══════════════════════════════════════════════════════════
//  CẤU HÌNH
// ══════════════════════════════════════════════════════════

var CHAT_CONFIG = {
  // Supabase connection
  SUPABASE_URL: 'https://hqekfvfarxscxozpxouh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_GfeGsFqVLwQ4_DPuJaB4sA_B-ZHqcrz',
  TABLE: 'ticket_messages',

  // Google Sheet
  SPREADSHEET_ID: '1-_jf-mMurVvw8o7uRX214nKIfw9x4BOXtke3U5t3VYc',
  SHEET_NAME: 'ChatLog',

  // Limits
  BATCH_SIZE: 1000,     // Max messages per sync run
  TRIGGER_HOURS: 6,     // Backup every N hours
};

// Headers cho tab ChatLog
var CHAT_HEADERS = [
  'id', 'ticket_id', 'ticket_code', 'sender', 'sender_role',
  'sender_email', 'text', 'image_url', 'created_at', 'backed_up_at',
];


// ══════════════════════════════════════════════════════════
//  SHEET HELPERS
// ══════════════════════════════════════════════════════════

/**
 * Lấy/tạo tab "ChatLog"
 */
function getChatLogSheet() {
  var ss = SpreadsheetApp.openById(CHAT_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CHAT_CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CHAT_CONFIG.SHEET_NAME);
    sheet.getRange(1, 1, 1, CHAT_HEADERS.length).setValues([CHAT_HEADERS]);
    sheet.getRange(1, 1, 1, CHAT_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#e3f2fd');
    sheet.setFrozenRows(1);
    Logger.log('✅ Đã tạo tab "ChatLog" với header');
  }

  return sheet;
}

/**
 * Lấy danh sách message IDs đã backup (để tránh duplicate)
 */
function getExistingMessageIds(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var idSet = {};
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0]) idSet[ids[i][0]] = true;
  }
  return idSet;
}

/**
 * Tìm timestamp mới nhất đã backup (để chỉ query messages mới hơn)
 */
function getLastBackupTimestamp(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  // Cột I (9) = created_at — lấy giá trị cuối cùng
  var timestamps = sheet.getRange(2, 9, lastRow - 1, 1).getValues();
  var latest = null;

  for (var i = 0; i < timestamps.length; i++) {
    var ts = timestamps[i][0];
    if (ts && (!latest || ts > latest)) {
      latest = ts;
    }
  }

  return latest;
}


// ══════════════════════════════════════════════════════════
//  SUPABASE REST API
// ══════════════════════════════════════════════════════════

/**
 * Đọc messages từ Supabase REST API
 * @param {string|null} sinceTimestamp - Chỉ lấy messages sau timestamp này
 * @returns {Array} Danh sách messages
 */
function fetchMessagesFromSupabase(sinceTimestamp) {
  var url = CHAT_CONFIG.SUPABASE_URL + '/rest/v1/' + CHAT_CONFIG.TABLE;
  url += '?select=id,ticket_id,ticket_code,sender,sender_role,sender_email,text,image_url,created_at';
  url += '&order=created_at.asc';
  url += '&limit=' + CHAT_CONFIG.BATCH_SIZE;

  // Incremental: chỉ lấy messages mới hơn timestamp cuối
  if (sinceTimestamp) {
    url += '&created_at=gt.' + sinceTimestamp;
  }

  var options = {
    method: 'GET',
    headers: {
      'apikey': CHAT_CONFIG.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + CHAT_CONFIG.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    Logger.log('❌ Supabase API error: ' + code + ' — ' + response.getContentText());
    throw new Error('Supabase API error: HTTP ' + code);
  }

  var messages = JSON.parse(response.getContentText());
  Logger.log('📨 Fetched ' + messages.length + ' messages from Supabase' +
    (sinceTimestamp ? ' (since ' + sinceTimestamp + ')' : ' (all)'));

  return messages;
}


// ══════════════════════════════════════════════════════════
//  MAIN: BACKUP FUNCTION
// ══════════════════════════════════════════════════════════

/**
 * Backup chat messages từ Supabase → Sheet
 * Incremental: chỉ backup messages chưa có trên Sheet
 */
function backupChatMessages() {
  Logger.log('🔄 === Chat Backup bắt đầu ===');
  var startTime = new Date();

  try {
    var sheet = getChatLogSheet();

    // Bước 1: Tìm timestamp mới nhất đã backup
    var lastTimestamp = getLastBackupTimestamp(sheet);
    Logger.log('📅 Last backup timestamp: ' + (lastTimestamp || '(first run)'));

    // Bước 2: Fetch messages mới từ Supabase
    var messages = fetchMessagesFromSupabase(lastTimestamp);

    if (messages.length === 0) {
      Logger.log('✅ Không có messages mới cần backup');
      return;
    }

    // Bước 3: Filter ra messages đã có trên Sheet (idempotent)
    var existingIds = getExistingMessageIds(sheet);
    var newMessages = [];
    for (var i = 0; i < messages.length; i++) {
      if (!existingIds[messages[i].id]) {
        newMessages.push(messages[i]);
      }
    }

    if (newMessages.length === 0) {
      Logger.log('✅ Tất cả messages đã có trên Sheet (no duplicates)');
      return;
    }

    // Bước 4: Ghi vào Sheet
    var now = new Date().toISOString();
    var rows = [];
    for (var j = 0; j < newMessages.length; j++) {
      var m = newMessages[j];
      rows.push([
        m.id || '',
        m.ticket_id || '',
        m.ticket_code || '',
        m.sender || '',
        m.sender_role || '',
        m.sender_email || '',
        m.text || '',
        m.image_url || '',
        m.created_at || '',
        now, // backed_up_at
      ]);
    }

    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, CHAT_HEADERS.length).setValues(rows);
    SpreadsheetApp.flush();

    var elapsed = ((new Date() - startTime) / 1000).toFixed(1);
    Logger.log('✅ Backup hoàn tất: ' + newMessages.length + ' messages mới → Sheet (' + elapsed + 's)');
    Logger.log('📊 Tổng messages trên Sheet: ' + (lastRow - 1 + newMessages.length));

  } catch (err) {
    Logger.log('❌ Chat Backup error: ' + err.message);
    Logger.log('Stack: ' + err.stack);
  }
}


// ══════════════════════════════════════════════════════════
//  TRIGGER SETUP
// ══════════════════════════════════════════════════════════

/**
 * Cài đặt trigger tự động chạy mỗi 6 giờ
 * ⚠️ CHỈ CẦN CHẠY 1 LẦN
 */
function setupChatBackupTrigger() {
  // Xóa trigger cũ (nếu có)
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'backupChatMessages') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('🗑️ Đã xóa trigger cũ');
    }
  }

  // Tạo trigger mới
  ScriptApp.newTrigger('backupChatMessages')
    .timeBased()
    .everyHours(CHAT_CONFIG.TRIGGER_HOURS)
    .create();

  Logger.log('✅ Trigger đã được cài: backupChatMessages mỗi ' + CHAT_CONFIG.TRIGGER_HOURS + ' giờ');
}

/**
 * Xóa trigger (nếu cần dừng backup)
 */
function removeChatBackupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'backupChatMessages') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log('🗑️ Đã xóa ' + removed + ' trigger(s)');
}


// ══════════════════════════════════════════════════════════
//  MENU & UTILITIES
// ══════════════════════════════════════════════════════════

/**
 * Thêm menu vào Sheet (gọi từ onOpen hoặc chạy riêng)
 */
function addChatBackupMenu() {
  SpreadsheetApp.getUi().createMenu('💬 Chat Backup')
    .addItem('🔄 Backup ngay', 'backupChatMessages')
    .addItem('📊 Thống kê', 'chatBackupStats')
    .addSeparator()
    .addItem('⚙️ Cài trigger tự động (6h)', 'setupChatBackupTrigger')
    .addItem('🗑️ Xóa trigger', 'removeChatBackupTrigger')
    .addToUi();
}

/**
 * Thống kê backup
 */
function chatBackupStats() {
  var sheet = getChatLogSheet();
  var lastRow = sheet.getLastRow();
  var totalMessages = Math.max(0, lastRow - 1);

  var msg = '💬 Chat Backup Stats\n\n';
  msg += 'Tổng messages đã backup: ' + totalMessages + '\n';

  if (totalMessages > 0) {
    // Tìm ticket codes unique
    var codes = sheet.getRange(2, 3, totalMessages, 1).getValues();
    var uniqueCodes = {};
    for (var i = 0; i < codes.length; i++) {
      if (codes[i][0]) uniqueCodes[codes[i][0]] = true;
    }
    msg += 'Số tickets có chat: ' + Object.keys(uniqueCodes).length + '\n';

    // Timestamp mới nhất / cũ nhất
    var timestamps = sheet.getRange(2, 9, totalMessages, 1).getValues();
    var oldest = timestamps[0][0] || 'N/A';
    var newest = timestamps[totalMessages - 1][0] || 'N/A';
    msg += '\nMessage cũ nhất: ' + oldest + '\n';
    msg += 'Message mới nhất: ' + newest + '\n';

    // Khi nào backup lần cuối
    var backupTimes = sheet.getRange(2, 10, totalMessages, 1).getValues();
    var lastBackup = backupTimes[totalMessages - 1][0] || 'N/A';
    msg += '\nLần backup cuối: ' + lastBackup;
  }

  SpreadsheetApp.getUi().alert(msg);
}

/**
 * Full re-sync: Xóa ChatLog và backup lại từ đầu
 * ⚠️ Chỉ dùng khi cần reset
 */
function fullResyncChat() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    'Full Re-sync',
    '⚠️ Sẽ xóa toàn bộ tab ChatLog và backup lại từ đầu.\nBạn có chắc?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) {
    Logger.log('Cancelled');
    return;
  }

  // Xóa tab cũ
  var ss = SpreadsheetApp.openById(CHAT_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CHAT_CONFIG.SHEET_NAME);
  if (sheet) {
    ss.deleteSheet(sheet);
    Logger.log('🗑️ Đã xóa tab ChatLog cũ');
  }

  // Chạy backup lại từ đầu
  backupChatMessages();
  ui.alert('✅ Full re-sync hoàn tất!');
}

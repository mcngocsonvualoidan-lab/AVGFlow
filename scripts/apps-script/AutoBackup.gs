/**
 * ============================================================
 *  AVGFlow — Auto Backup: Account A → Account B
 * ============================================================
 *  Mỗi sheet nguồn (Account A) → backup sang 1 spreadsheet riêng (Account B).
 *  
 *  ✅ Không ghi đè: Mỗi lần backup tạo tab mới với timestamp
 *  ✅ Auto chạy: Time-based trigger (mỗi ngày / mỗi giờ)
 *  ✅ Giữ lịch sử: Tối đa N bản backup (tự xóa bản cũ nhất)
 *  
 *  ── HƯỚNG DẪN CÀI ĐẶT ──
 *  1. Đăng nhập tài khoản B (backup)
 *  2. Tạo 5 Google Spreadsheet mới (1 cho mỗi nguồn)
 *  3. Mở 1 spreadsheet bất kỳ → Extensions → Apps Script → Paste code
 *  4. Cập nhật backupId trong SOURCE_SHEETS bên dưới
 *  5. Đảm bảo tài khoản A đã share các sheet nguồn cho tài khoản B
 *  6. Chạy runBackupAll() để test
 *  7. Chạy setupAutoBackup() để cài trigger tự động
 * ============================================================
 */

// ══════════════════════════════════════════════════════════
//  CẤU HÌNH
// ══════════════════════════════════════════════════════════

/**
 * Số bản backup tối đa giữ lại cho mỗi nguồn.
 */
const MAX_BACKUPS = 30; // 30 bản ≈ 1 tháng (nếu backup mỗi ngày)

/**
 * Danh sách nguồn → đích backup.
 * 
 * - sourceId:  Sheet ID của tài khoản A (nguồn)
 * - sourceGid: Tab ID trong sheet nguồn (0 = tab đầu tiên)
 * - backupId:  Sheet ID của tài khoản B (đích backup) ← CẦN CẬP NHẬT
 * - name:      Tên ngắn gọn
 */
const SOURCE_SHEETS = [
  {
    sourceId:  '1mzYT75VEJh-PMYvlwUEQkvVnDIj6p1P2ssS6FXvK5Vs',
    sourceGid: 'ALL',
    backupId:  '1Ecrlj1qLlqY3ZXkPgJ3v0ZrzU5rZN3IWnBeJuG6i8IA',
    name:      'Đơn hàng Thiết kế',
  },
  {
    sourceId:  '16GLyiZLdBknve7P_JO9ly-Luy5vIgdizNmQH985zPeo',
    sourceGid: 'ALL',
    backupId:  '1wM0jjcuVnL1al6uV__jgJvNrM-w6BF9An39e3A9OJ4U',
    name:      'Đơn hàng In ấn',
  },
  {
    sourceId:  '11p55tNRLRqVfgwEfrcTWJfxKA6dJQyDJq4CapgZ5o-M',
    sourceGid: 'ALL',
    backupId:  '17_ux4lIqQDq1nw8R2oQc4AXXjxaW8iiDAGH3R6rKSq4',
    name:      'Lịch Trao đổi',
  },
  {
    sourceId:  '1ZtqPNzUupl57Z2806sohQGNqj4W8GnzXOAGA3kbAqIQ',
    sourceGid: 'ALL',
    backupId:  '1LjBNg3NGzGjZcdc59_B1O41lo_DvV1uAPW37Lx7ZGsU',
    name:      'Danh bạ Khách hàng',
  },
  {
    sourceId:  '1karhpP174qGeQudh3YopY3Zl68f_zXoqlsw8CYd1YhQ',
    sourceGid: 'ALL',
    backupId:  '1JzCUNukS8TxxpjGdXCrPCwpKyt4L8Ju5Outs5LOw37E',
    name:      'Kho Sản phẩm',
  },
  {
    sourceId:  '13cN2ert23B1W4wlySPXXVbCj-UgICEef5UQb7FI2vSA',
    sourceGid: 'ALL',
    backupId:  '1lTgsgsgmkp1Cw6q6t7F3HAyvFyPAmKZyJdxQOAWri6Q',
    name:      'Thông điệp điều hành 2026',
  },
];


// ══════════════════════════════════════════════════════════
//  BACKUP FUNCTIONS
// ══════════════════════════════════════════════════════════

/**
 * 🔄 Backup TẤT CẢ — mỗi nguồn → spreadsheet backup riêng
 */
function runBackupAll() {
  var timestamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd_HH:mm');
  Logger.log('═══ AVGFlow Backup Started: ' + timestamp + ' ═══');

  for (var s = 0; s < SOURCE_SHEETS.length; s++) {
    var source = SOURCE_SHEETS[s];
    try {
      // Bỏ qua nếu chưa cấu hình backupId
      if (!source.backupId || source.backupId.startsWith('PASTE_ID')) {
        Logger.log('⏭️ ' + source.name + ': Chưa cấu hình backupId — bỏ qua');
        continue;
      }

      if (source.sourceGid === 'ALL') {
        // Backup TOÀN BỘ các tab
        var results = backupAllTabs(source, timestamp);
        Logger.log('✅ ' + source.name + ': ' + results.length + ' tab → backup xong');
      } else {
        // Backup 1 tab cụ thể
        var result = backupOneSheet(source, timestamp);
        Logger.log('✅ ' + source.name + ': ' + result.rows + ' dòng → ' + result.tab);
      }
    } catch (error) {
      Logger.log('❌ ' + source.name + ': ' + (error.message || error));
    }
  }

  Logger.log('═══ AVGFlow Backup Completed ═══');
}

/**
 * Backup 1 tab cụ thể → spreadsheet backup riêng
 * Sử dụng copyTo() để giữ nguyên cấu trúc, format, merge, màu sắc, v.v.
 */
function backupOneSheet(source, timestamp) {
  // 1. Mở sheet NGUỒN
  var sourceSS = SpreadsheetApp.openById(source.sourceId);
  var sourceSheet = null;
  
  var allSheets = sourceSS.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    if (String(allSheets[i].getSheetId()) === String(source.sourceGid)) {
      sourceSheet = allSheets[i];
      break;
    }
  }
  if (!sourceSheet && (source.sourceGid === '0' || source.sourceGid === 0)) {
    sourceSheet = allSheets[0];
  }
  if (!sourceSheet) throw new Error('Không tìm thấy tab GID=' + source.sourceGid);

  // 2. Mở spreadsheet BACKUP (Account B)
  var backupSS = SpreadsheetApp.openById(source.backupId);

  // 3. Copy nguyên bản sheet
  var copiedSheet = sourceSheet.copyTo(backupSS);

  // 4. Đổi tên tab backup với timestamp
  var tabName = 'BK_' + timestamp;
  try {
    copiedSheet.setName(tabName);
  } catch (e) {
    copiedSheet.setName(tabName + '_' + Date.now());
  }

  // 5. Bảo vệ tab (warning only)
  try {
    copiedSheet.protect().setDescription('Auto Backup').setWarningOnly(true);
  } catch (e) { /* ignore */ }

  // 6. Dọn dẹp bản cũ
  cleanupOldBackups(backupSS);

  var rows = copiedSheet.getLastRow();
  var cols = copiedSheet.getLastColumn();
  return { rows: rows, cols: cols, tab: copiedSheet.getName() };
}

/**
 * Backup TOÀN BỘ các tab trong 1 spreadsheet → spreadsheet backup riêng
 * Mỗi tab nguồn sẽ được copy với tên: BK_timestamp_TênTab
 */
function backupAllTabs(source, timestamp) {
  // 1. Mở spreadsheet NGUỒN
  var sourceSS = SpreadsheetApp.openById(source.sourceId);
  var allSourceSheets = sourceSS.getSheets();

  // 2. Mở spreadsheet BACKUP
  var backupSS = SpreadsheetApp.openById(source.backupId);

  var results = [];

  for (var i = 0; i < allSourceSheets.length; i++) {
    var sheet = allSourceSheets[i];
    var sheetName = sheet.getName();

    // Bỏ qua tab ẩn
    if (sheet.isSheetHidden()) {
      Logger.log('  ⏭️ Bỏ qua tab ẩn: ' + sheetName);
      continue;
    }

    try {
      // Copy nguyên bản
      var copiedSheet = sheet.copyTo(backupSS);

      // Đặt tên: BK_2026-03-24_11:00_TênTab
      var tabName = 'BK_' + timestamp + '_' + sheetName;
      // Giới hạn tên tab tối đa 100 ký tự (Google Sheets limit)
      if (tabName.length > 100) tabName = tabName.substring(0, 100);
      try {
        copiedSheet.setName(tabName);
      } catch (e) {
        copiedSheet.setName('BK_' + timestamp + '_Tab' + i);
      }

      // Bảo vệ tab
      try {
        copiedSheet.protect().setDescription('Auto Backup').setWarningOnly(true);
      } catch (e) { /* ignore */ }

      Logger.log('  📋 ' + sheetName + ' → ' + copiedSheet.getName());
      results.push({ sheet: sheetName, tab: copiedSheet.getName() });
    } catch (e) {
      Logger.log('  ❌ ' + sheetName + ': ' + e.message);
    }
  }

  // Dọn dẹp bản cũ
  cleanupOldBackups(backupSS);

  return results;
}


// ══════════════════════════════════════════════════════════
//  CLEANUP — Xóa bản backup cũ
// ══════════════════════════════════════════════════════════

function cleanupOldBackups(backupSS) {
  const allSheets = backupSS.getSheets()
    .filter(function(s) { return s.getName().startsWith('BK_'); })
    .sort(function(a, b) { return a.getName().localeCompare(b.getName()); });

  var toRemove = allSheets.length - MAX_BACKUPS;
  for (var i = 0; i < toRemove; i++) {
    Logger.log('🗑️ Xóa bản cũ: ' + allSheets[i].getName());
    backupSS.deleteSheet(allSheets[i]);
  }
}


// ══════════════════════════════════════════════════════════
//  TRIGGER — Cài tự động
// ══════════════════════════════════════════════════════════

/** Backup mỗi ngày lúc 2:00 AM */
function setupAutoBackup() {
  removeTriggers_();
  ScriptApp.newTrigger('runBackupAll')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .inTimezone('Asia/Ho_Chi_Minh')
    .create();
  Logger.log('✅ Trigger: Mỗi ngày lúc 2:00 AM');
}

/** Backup mỗi giờ */
function setupHourlyBackup() {
  removeTriggers_();
  ScriptApp.newTrigger('runBackupAll')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('✅ Trigger: Mỗi giờ');
}

/** Backup mỗi 12 giờ */
function setup12HourBackup() {
  removeTriggers_();
  ScriptApp.newTrigger('runBackupAll')
    .timeBased()
    .everyHours(12)
    .create();
  Logger.log('✅ Trigger: Mỗi 12 giờ');
}

/** Backup mỗi tuần (Chủ nhật) */
function setupWeeklyBackup() {
  removeTriggers_();
  ScriptApp.newTrigger('runBackupAll')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(2)
    .inTimezone('Asia/Ho_Chi_Minh')
    .create();
  Logger.log('✅ Trigger: Mỗi Chủ nhật 2:00 AM');
}

/** Xóa tất cả trigger */
function removeAllTriggers() {
  var count = removeTriggers_();
  Logger.log('🗑️ Đã xóa ' + count + ' trigger');
}

function removeTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runBackupAll') {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  return count;
}


// ══════════════════════════════════════════════════════════
//  TEST & MENU
// ══════════════════════════════════════════════════════════

/** Test backup sheet đầu tiên đã cấu hình */
function testBackupFirst() {
  var timestamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd_HH:mm');
  
  for (var i = 0; i < SOURCE_SHEETS.length; i++) {
    var source = SOURCE_SHEETS[i];
    if (source.backupId && !source.backupId.startsWith('PASTE_ID')) {
      try {
        var result = backupOneSheet(source, timestamp);
        Logger.log('✅ Test OK: ' + source.name + ' — ' + result.rows + ' dòng → ' + result.tab);
      } catch (error) {
        Logger.log('❌ Test FAIL: ' + source.name + ' — ' + error.message);
      }
      return;
    }
  }
  Logger.log('⚠️ Chưa có sheet nào được cấu hình backupId!');
}

/** Menu trong Google Sheets */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🔄 Backup')
    .addItem('▶️ Backup ngay', 'runBackupAll')
    .addItem('🧪 Test 1 sheet', 'testBackupFirst')
    .addSeparator()
    .addItem('⏰ Auto: Mỗi ngày', 'setupAutoBackup')
    .addItem('⏰ Auto: Mỗi 12 giờ', 'setup12HourBackup')
    .addItem('⏰ Auto: Mỗi giờ', 'setupHourlyBackup')
    .addItem('⏰ Auto: Mỗi tuần', 'setupWeeklyBackup')
    .addItem('🗑️ Xóa trigger', 'removeAllTriggers')
    .addToUi();
}

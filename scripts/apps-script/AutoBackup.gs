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
    sourceGid: '485384320',
    backupId:  'PASTE_ID_BACKUP_ĐH_THIẾT_KẾ',   // ← Tạo sheet mới ở Account B, paste ID vào
    name:      'Đơn hàng Thiết kế',
  },
  {
    sourceId:  '16GLyiZLdBknve7P_JO9ly-Luy5vIgdizNmQH985zPeo',
    sourceGid: '0',
    backupId:  'PASTE_ID_BACKUP_ĐH_IN_ẤN',       // ← Tạo sheet mới ở Account B, paste ID vào
    name:      'Đơn hàng In ấn',
  },
  {
    sourceId:  '11p55tNRLRqVfgwEfrcTWJfxKA6dJQyDJq4CapgZ5o-M',
    sourceGid: '637878134',
    backupId:  'PASTE_ID_BACKUP_LỊCH_TRAO_ĐỔI',  // ← Tạo sheet mới ở Account B, paste ID vào
    name:      'Lịch Trao đổi',
  },
  {
    sourceId:  '1ZtqPNzUupl57Z2806sohQGNqj4W8GnzXOAGA3kbAqIQ',
    sourceGid: '1450599696',
    backupId:  'PASTE_ID_BACKUP_DANH_BẠ_KH',     // ← Tạo sheet mới ở Account B, paste ID vào
    name:      'Danh bạ Khách hàng',
  },
  {
    sourceId:  '1karhpP174qGeQudh3YopY3Zl68f_zXoqlsw8CYd1YhQ',
    sourceGid: '0',
    backupId:  'PASTE_ID_BACKUP_KHO_SP',          // ← Tạo sheet mới ở Account B, paste ID vào
    name:      'Kho Sản phẩm',
  },
];


// ══════════════════════════════════════════════════════════
//  BACKUP FUNCTIONS
// ══════════════════════════════════════════════════════════

/**
 * 🔄 Backup TẤT CẢ — mỗi nguồn → spreadsheet backup riêng
 */
function runBackupAll() {
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd_HH:mm');
  Logger.log('═══ AVGFlow Backup Started: ' + timestamp + ' ═══');

  for (const source of SOURCE_SHEETS) {
    try {
      // Bỏ qua nếu chưa cấu hình backupId
      if (!source.backupId || source.backupId.startsWith('PASTE_ID')) {
        Logger.log('⏭️ ' + source.name + ': Chưa cấu hình backupId — bỏ qua');
        continue;
      }

      const result = backupOneSheet(source, timestamp);
      Logger.log('✅ ' + source.name + ': ' + result.rows + ' dòng → ' + result.tab);
    } catch (error) {
      Logger.log('❌ ' + source.name + ': ' + (error.message || error));
    }
  }

  Logger.log('═══ AVGFlow Backup Completed ═══');
}

/**
 * Backup 1 sheet nguồn → spreadsheet backup riêng
 */
function backupOneSheet(source, timestamp) {
  // 1. Mở sheet NGUỒN (Account A đã share cho Account B)
  const sourceSS = SpreadsheetApp.openById(source.sourceId);
  let sourceSheet = null;
  
  for (const sheet of sourceSS.getSheets()) {
    if (String(sheet.getSheetId()) === String(source.sourceGid)) {
      sourceSheet = sheet;
      break;
    }
  }
  if (!sourceSheet) {
    sourceSheet = (source.sourceGid === '0') ? sourceSS.getSheets()[0] : null;
  }
  if (!sourceSheet) throw new Error('Không tìm thấy tab GID=' + source.sourceGid);

  // 2. Đọc dữ liệu
  const data = sourceSheet.getDataRange().getValues();
  if (!data || data.length === 0) throw new Error('Sheet nguồn rỗng');

  // 3. Mở spreadsheet BACKUP (Account B)
  const backupSS = SpreadsheetApp.openById(source.backupId);

  // 4. Tạo tab mới với timestamp (không ghi đè)
  const tabName = 'BK_' + timestamp;
  let newSheet;
  try {
    newSheet = backupSS.insertSheet(tabName);
  } catch (e) {
    newSheet = backupSS.insertSheet(tabName + '_' + Date.now());
  }

  // 5. Ghi dữ liệu
  newSheet.getRange(1, 1, data.length, data[0].length).setValues(data);

  // 6. Format header
  const headerRange = newSheet.getRange(1, 1, 1, data[0].length);
  headerRange.setBackground('#1a237e');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');

  // 7. Ghi metadata ở cuối
  const metaRow = data.length + 2;
  newSheet.getRange(metaRow, 1, 3, 2).setValues([
    ['Nguồn:', source.name],
    ['Thời điểm:', timestamp],
    ['Tổng dòng:', data.length],
  ]);

  // 8. Bảo vệ tab (warning only)
  try {
    newSheet.protect().setDescription('Auto Backup').setWarningOnly(true);
  } catch (e) { /* ignore */ }

  // 9. Dọn dẹp bản cũ
  cleanupOldBackups(backupSS);

  return { rows: data.length, cols: data[0].length, tab: tabName };
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
    .addItem('⏰ Auto: Mỗi giờ', 'setupHourlyBackup')
    .addItem('⏰ Auto: Mỗi tuần', 'setupWeeklyBackup')
    .addItem('🗑️ Xóa trigger', 'removeAllTriggers')
    .addToUi();
}

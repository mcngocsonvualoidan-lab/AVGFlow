/**
 * ============================================================
 *  AVGFlow — Print Order Sync (Google Apps Script)
 * ============================================================
 *  Deployed as Web App to handle read/write from AVGFlow App.
 *  
 *  ── CHỨC NĂNG ──
 *  1. doPost():  Nhận đơn hàng mới từ App → ghi vào Sheet
 *  2. doGet():   App đọc dữ liệu Sheet (JSON API)
 *  3. onEdit():  Khi Sheet thay đổi → tự động ghi log
 *  
 *  ── CÀI ĐẶT ──
 *  1. Mở Sheet In ấn → Extensions → Apps Script
 *  2. Paste code này
 *  3. Deploy → New deployment → Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  4. Copy URL → cập nhật SHEET_SCRIPT_URL trong PrintOrderForm.tsx
 * ============================================================
 */

// ══════════════════════════════════════════════════════════
//  CẤU HÌNH
// ══════════════════════════════════════════════════════════

var SHEET_ID = '16GLyiZLdBknve7P_JO9ly-Luy5vIgdizNmQH985zPeo';
var SHEET_NAME = 'In ấn'; // Tên tab chính chứa đơn hàng

/**
 * Lấy sheet chính
 */
function getMainSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0];
  return sheet;
}


// ══════════════════════════════════════════════════════════
//  doPost — NHẬN ĐƠN HÀNG MỚI TỪ APP
// ══════════════════════════════════════════════════════════

/**
 * Nhận dữ liệu từ App (PrintOrderForm.tsx)
 * 
 * Payload format:
 * {
 *   action: "add" | "batchUpdate",
 *   person: "Ngọc Bích",
 *   rowData: [["timestamp", "person", ...], ...]     // cho action=add
 *   updates: [{row, col, value}, ...]                // cho action=batchUpdate
 * }
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getMainSheet();
    var action = (data.action || 'add').toLowerCase();
    
    if (action === 'batchupdate') {
      return handleBatchUpdate(sheet, data.updates);
    }
    
    // Default: add rows
    var rows = data.rowData || [];
    
    if (rows.length === 0) {
      return jsonResponse({ status: 'error', message: 'Không có dữ liệu' });
    }
    
    for (var i = 0; i < rows.length; i++) {
      sheet.appendRow(rows[i]);
    }
    
    SpreadsheetApp.flush();
    
    Logger.log('✅ Ghi ' + rows.length + ' đơn mới từ: ' + (data.person || 'unknown'));
    
    return jsonResponse({
      status: 'success',
      message: 'Đã ghi ' + rows.length + ' đơn hàng',
      rowsAdded: rows.length,
      totalRows: sheet.getLastRow()
    });
    
  } catch (err) {
    Logger.log('❌ doPost error: ' + err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}


// ══════════════════════════════════════════════════════════
//  doGet — ĐỌC DỮ LIỆU / CẬP NHẬT Ô
// ══════════════════════════════════════════════════════════

/**
 * ?action=read          → Đọc tất cả dữ liệu (JSON)
 * ?action=read&from=100 → Đọc từ dòng 100
 * ?action=count         → Chỉ trả số dòng
 * ?action=status        → Health check
 * ?action=update&row=5&col=17&value=Hoàn thành  → Cập nhật 1 ô
 */
function doGet(e) {
  try {
    var action = (e.parameter.action || 'read').toLowerCase();
    var sheet = getMainSheet();
    
    switch (action) {
      case 'read':
        return handleRead(sheet, e.parameter);
      
      case 'count':
        return jsonResponse({ 
          status: 'success', 
          totalRows: sheet.getLastRow(),
          totalCols: sheet.getLastColumn()
        });
      
      case 'status':
        return jsonResponse({ 
          status: 'success', 
          message: 'AVGFlow Print Order Sync đang hoạt động',
          sheetName: sheet.getName(),
          totalRows: sheet.getLastRow(),
          timestamp: new Date().toISOString()
        });
      
      case 'update':
        return handleUpdate(sheet, e.parameter);
      
      default:
        return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
    }
    
  } catch (err) {
    Logger.log('❌ doGet error: ' + err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}


// ══════════════════════════════════════════════════════════
//  HANDLERS
// ══════════════════════════════════════════════════════════

/**
 * Đọc dữ liệu → JSON (giữ nguyên format hiển thị)
 */
function handleRead(sheet, params) {
  var fromRow = parseInt(params.from) || 1;
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  
  if (lastRow < 1 || lastCol < 1) {
    return jsonResponse({ status: 'success', data: [], totalRows: 0 });
  }
  
  var numRows = Math.min(lastRow - fromRow + 1, 5000);
  if (numRows <= 0) {
    return jsonResponse({ status: 'success', data: [], totalRows: lastRow });
  }
  
  // getDisplayValues() giữ nguyên format ngày tháng, số tiền...
  var data = sheet.getRange(fromRow, 1, numRows, lastCol).getDisplayValues();
  
  return jsonResponse({
    status: 'success',
    data: data,
    totalRows: lastRow,
    fromRow: fromRow,
    returnedRows: data.length
  });
}

/**
 * Cập nhật 1 ô (row + col, 1-based)
 */
function handleUpdate(sheet, params) {
  var row = parseInt(params.row);
  var col = parseInt(params.col);
  var value = params.value || '';
  
  if (!row || !col) {
    return jsonResponse({ status: 'error', message: 'Missing row or col' });
  }
  
  if (row < 1 || row > sheet.getLastRow() + 1 || col < 1 || col > 26) {
    return jsonResponse({ status: 'error', message: 'Out of bounds' });
  }
  
  sheet.getRange(row, col).setValue(value);
  SpreadsheetApp.flush();
  
  Logger.log('✅ Updated R' + row + 'C' + col + ' = "' + value + '"');
  
  return jsonResponse({
    status: 'success',
    row: row,
    col: col,
    value: value
  });
}

/**
 * Batch update nhiều ô: [{row, col, value}, ...]
 */
function handleBatchUpdate(sheet, updates) {
  if (!updates || updates.length === 0) {
    return jsonResponse({ status: 'error', message: 'No updates' });
  }
  
  var count = 0;
  for (var i = 0; i < updates.length; i++) {
    var u = updates[i];
    if (u.row && u.col) {
      sheet.getRange(u.row, u.col).setValue(u.value || '');
      count++;
    }
  }
  
  SpreadsheetApp.flush();
  Logger.log('✅ Batch updated ' + count + ' cells');
  
  return jsonResponse({
    status: 'success',
    updatedCells: count
  });
}


// ══════════════════════════════════════════════════════════
//  onEdit — TỰ ĐỘNG GHI LOG KHI SHEET THAY ĐỔI
// ══════════════════════════════════════════════════════════

/**
 * Khi cột Trạng thái (Q = col 17) thay đổi:
 * → Tự động ghi thời gian cập nhật vào cột T (col 20)
 */
function onEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();
    if (sheet.getName() !== SHEET_NAME) return;
    
    var range = e.range;
    var row = range.getRow();
    var col = range.getColumn();
    
    // Cột trạng thái = Q = col 17
    if (col === 17 && row > 1) {
      var now = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
      sheet.getRange(row, 20).setValue(now); // Cột T = thời gian xử lý
      Logger.log('📝 Status → Row ' + row + ': "' + range.getValue() + '" at ' + now);
    }
  } catch (err) {
    // silent
  }
}


// ══════════════════════════════════════════════════════════
//  UTILITIES & MENU
// ══════════════════════════════════════════════════════════

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚙️ AVGFlow Sync')
    .addItem('📊 Trạng thái', 'checkStatus')
    .addItem('🔢 Đếm dòng', 'countRows')
    .addToUi();
}

function checkStatus() {
  var sheet = getMainSheet();
  SpreadsheetApp.getUi().alert(
    'AVGFlow Print Order Sync\n\n' +
    '📊 Sheet: ' + sheet.getName() + '\n' +
    '📝 Tổng dòng: ' + sheet.getLastRow() + '\n' +
    '📅 ' + new Date().toLocaleString('vi-VN')
  );
}

function countRows() {
  var sheet = getMainSheet();
  SpreadsheetApp.getUi().alert('Tổng đơn hàng: ' + (sheet.getLastRow() - 1));
}

/**
 * ============================================================
 *  AVGFlow — Design Ticket Sync (Hybrid Architecture)
 *  Google Sheet "Tickets" tab ↔ Web App (REST API)
 * ============================================================
 *
 *  KIẾN TRÚC HYBRID:
 *  ┌─────────────┐  JSONP/POST  ┌─────────┐  📋 Tickets
 *  │ Google Sheet │ ←──────────→ │   App   │
 *  │ "Tickets"   │  Apps Script │ (React) │
 *  └─────────────┘              └────┬────┘
 *                                    │ Realtime
 *                                    ▼
 *                           ┌──────────────┐  💬 Chat only
 *                           │   Supabase   │
 *                           │ ticket_msgs  │
 *                           └──────────────┘
 *
 *  Sheet giữ ticket CRUD, Supabase chỉ giữ chat messages.
 *  ticketCode (TK-NB-XXXX) là key chung liên kết 2 nguồn.
 *
 *  ENDPOINTS:
 *  GET  ?action=getTickets              → Tất cả tickets      
 *  GET  ?action=getTicket&code=TK-xxx   → 1 ticket
 *  GET  ?action=health                  → Health check
 *  POST {action:"createTicket",...}     → Tạo ticket mới
 *  POST {action:"updateTicket",...}     → Cập nhật ticket
 *
 *  COLUMN MAPPING (1-indexed):
 *  A(1)  = ticketCode       J(10) = formData (JSON)
 *  B(2)  = category         K(11) = imageUrls (JSON)
 *  C(3)  = action           L(12) = status
 *  D(4)  = brandName        M(13) = assignedTo
 *  E(5)  = contactName      N(14) = revisionRound
 *  F(6)  = contactPhone     O(15) = createdAt (ISO)
 *  G(7)  = contactEmail     P(16) = updatedAt (ISO)
 *  H(8)  = contactAddress   Q(17) = completedAt (ISO)
 *  I(9)  = description
 *
 *  SETUP:
 *  1. Mở Google Sheet "Đơn hàng Thiết kế"
 *  2. Tạo tab mới tên "Tickets" (nếu chưa có)
 *  3. Dán header row: ticketCode, category, action, ...
 *  4. Extensions → Apps Script → Dán code này
 *  5. Deploy → New deployment → Web app → Anyone
 *  6. Copy URL → cập nhật trong frontend service
 * ============================================================
 */

// ══════════════════════════════════════════════════════════
//  CẤU HÌNH
// ══════════════════════════════════════════════════════════

var CONFIG = {
  // Sheet — cùng spreadsheet với Design Orders
  SPREADSHEET_ID: '1-_jf-mMurVvw8o7uRX214nKIfw9x4BOXtke3U5t3VYc',
  SHEET_NAME: 'Tickets',  // Tab name
  HEADER_ROW: 1,
  DATA_START_ROW: 2,

  // Column mapping (1-indexed)
  COL: {
    TICKET_CODE:     1,  // A
    CATEGORY:        2,  // B
    ACTION:          3,  // C
    BRAND_NAME:      4,  // D
    CONTACT_NAME:    5,  // E
    CONTACT_PHONE:   6,  // F
    CONTACT_EMAIL:   7,  // G
    CONTACT_ADDRESS: 8,  // H
    DESCRIPTION:     9,  // I
    FORM_DATA:       10, // J (JSON string)
    IMAGE_URLS:      11, // K (JSON array string)
    STATUS:          12, // L
    ASSIGNED_TO:     13, // M
    REVISION_ROUND:  14, // N
    CREATED_AT:      15, // O (ISO timestamp)
    UPDATED_AT:      16, // P (ISO timestamp)
    COMPLETED_AT:    17, // Q (ISO timestamp)
  },

  TOTAL_COLUMNS: 17,

  // Ticket code prefixes
  PREFIXES: {
    'label-bag': 'TK-NB',
    'carton':    'TK-CT',
    'social':    'TK-SC',
  },
};

// Header row values
var HEADERS = [
  'ticketCode', 'category', 'action', 'brandName', 'contactName',
  'contactPhone', 'contactEmail', 'contactAddress', 'description',
  'formData', 'imageUrls', 'status', 'assignedTo', 'revisionRound',
  'createdAt', 'updatedAt', 'completedAt',
];


// ══════════════════════════════════════════════════════════
//  SHEET HELPERS
// ══════════════════════════════════════════════════════════

/**
 * Lấy sheet "Tickets" — tạo mới nếu chưa có
 */
function getTicketsSheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    // Tạo tab mới + header
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#e8eaf6');
    sheet.setFrozenRows(1);
    Logger.log('✅ Đã tạo tab "Tickets" với header');
  }

  return sheet;
}

/**
 * Tạo ticket code unique: TK-NB-XXXX
 */
function generateTicketCode(category) {
  var prefix = CONFIG.PREFIXES[category] || 'TK';
  var timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  var random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return prefix + '-' + timestamp + random;
}

/**
 * Tìm row index theo ticketCode
 */
function findRowByTicketCode(sheet, ticketCode) {
  if (!ticketCode) return -1;

  var lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) return -1;

  var codes = sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.TICKET_CODE, lastRow - CONFIG.DATA_START_ROW + 1, 1).getValues();

  for (var i = 0; i < codes.length; i++) {
    if (codes[i][0] === ticketCode) {
      return CONFIG.DATA_START_ROW + i;
    }
  }

  return -1;
}

/**
 * Đổi 1 row data thành object ticket
 */
function rowToTicket(row) {
  var formData = {};
  var imageUrls = [];

  try { formData = JSON.parse(row[CONFIG.COL.FORM_DATA - 1] || '{}'); } catch (e) { }
  try { imageUrls = JSON.parse(row[CONFIG.COL.IMAGE_URLS - 1] || '[]'); } catch (e) { }

  return {
    ticketCode:     row[CONFIG.COL.TICKET_CODE - 1]     || '',
    category:       row[CONFIG.COL.CATEGORY - 1]        || '',
    action:         row[CONFIG.COL.ACTION - 1]           || '',
    brandName:      row[CONFIG.COL.BRAND_NAME - 1]       || '',
    contactName:    row[CONFIG.COL.CONTACT_NAME - 1]     || '',
    contactPhone:   row[CONFIG.COL.CONTACT_PHONE - 1]    || '',
    contactEmail:   row[CONFIG.COL.CONTACT_EMAIL - 1]    || '',
    contactAddress: row[CONFIG.COL.CONTACT_ADDRESS - 1]  || '',
    description:    row[CONFIG.COL.DESCRIPTION - 1]      || '',
    formData:       formData,
    imageUrls:      imageUrls,
    status:         row[CONFIG.COL.STATUS - 1]           || 'open',
    assignedTo:     row[CONFIG.COL.ASSIGNED_TO - 1]      || '',
    revisionRound:  parseInt(row[CONFIG.COL.REVISION_ROUND - 1]) || 0,
    createdAt:      row[CONFIG.COL.CREATED_AT - 1]       || '',
    updatedAt:      row[CONFIG.COL.UPDATED_AT - 1]       || '',
    completedAt:    row[CONFIG.COL.COMPLETED_AT - 1]     || '',
  };
}

/**
 * Đổi ticket object thành row array
 */
function ticketToRow(ticket) {
  var row = [];
  row[CONFIG.COL.TICKET_CODE - 1]     = ticket.ticketCode     || '';
  row[CONFIG.COL.CATEGORY - 1]        = ticket.category       || '';
  row[CONFIG.COL.ACTION - 1]          = ticket.action         || '';
  row[CONFIG.COL.BRAND_NAME - 1]      = ticket.brandName      || '';
  row[CONFIG.COL.CONTACT_NAME - 1]    = ticket.contactName    || '';
  row[CONFIG.COL.CONTACT_PHONE - 1]   = ticket.contactPhone   || '';
  row[CONFIG.COL.CONTACT_EMAIL - 1]   = ticket.contactEmail   || '';
  row[CONFIG.COL.CONTACT_ADDRESS - 1] = ticket.contactAddress || '';
  row[CONFIG.COL.DESCRIPTION - 1]     = ticket.description    || '';
  row[CONFIG.COL.FORM_DATA - 1]       = typeof ticket.formData === 'string' ? ticket.formData : JSON.stringify(ticket.formData || {});
  row[CONFIG.COL.IMAGE_URLS - 1]      = typeof ticket.imageUrls === 'string' ? ticket.imageUrls : JSON.stringify(ticket.imageUrls || []);
  row[CONFIG.COL.STATUS - 1]          = ticket.status         || 'open';
  row[CONFIG.COL.ASSIGNED_TO - 1]     = ticket.assignedTo     || '';
  row[CONFIG.COL.REVISION_ROUND - 1]  = ticket.revisionRound  || 0;
  row[CONFIG.COL.CREATED_AT - 1]      = ticket.createdAt      || '';
  row[CONFIG.COL.UPDATED_AT - 1]      = ticket.updatedAt      || '';
  row[CONFIG.COL.COMPLETED_AT - 1]    = ticket.completedAt    || '';
  return row;
}


// ══════════════════════════════════════════════════════════
//  WEB APP ENDPOINTS
// ══════════════════════════════════════════════════════════

function doGet(e) {
  try {
    var params = e.parameter || {};
    var action = params.action || 'health';
    var result;

    switch (action) {
      case 'getTickets':
        result = handleGetTickets(params);
        break;
      case 'getTicket':
        result = handleGetTicket(params.code);
        break;
      case 'health':
        result = {
          success: true,
          message: 'AVGFlow Design Ticket Sync (Hybrid)',
          timestamp: new Date().toISOString(),
          version: 'v1-hybrid',
        };
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    // JSONP support
    var output = JSON.stringify(result);
    if (params.callback) {
      return ContentService.createTextOutput(params.callback + '(' + output + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';
    var result;

    switch (action) {
      case 'createTicket':
        result = handleCreateTicket(body);
        break;
      case 'updateTicket':
        result = handleUpdateTicket(body);
        break;
      case 'batchUpdate':
        result = handleBatchUpdate(body.updates || []);
        break;
      default:
        result = { success: false, error: 'Unknown POST action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


// ══════════════════════════════════════════════════════════
//  HANDLER: Đọc tất cả tickets
// ══════════════════════════════════════════════════════════

function handleGetTickets(params) {
  var sheet = getTicketsSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow < CONFIG.DATA_START_ROW) {
    return { success: true, tickets: [], count: 0 };
  }

  var numRows = lastRow - CONFIG.DATA_START_ROW + 1;
  var data = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, CONFIG.TOTAL_COLUMNS).getValues();

  var tickets = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    // Bỏ qua dòng trống
    if (!row[0] && !row[3] && !row[4]) continue;
    tickets.push(rowToTicket(row));
  }

  // Filter by status nếu có
  if (params && params.status && params.status !== 'all') {
    tickets = tickets.filter(function(t) { return t.status === params.status; });
  }

  // Filter by category nếu có
  if (params && params.category && params.category !== 'all') {
    tickets = tickets.filter(function(t) { return t.category === params.category; });
  }

  return {
    success: true,
    tickets: tickets,
    count: tickets.length,
    total: data.length,
  };
}


// ══════════════════════════════════════════════════════════
//  HANDLER: Đọc 1 ticket theo ticketCode
// ══════════════════════════════════════════════════════════

function handleGetTicket(ticketCode) {
  if (!ticketCode) {
    return { success: false, error: 'Missing ticketCode' };
  }

  var sheet = getTicketsSheet();
  var rowIndex = findRowByTicketCode(sheet, ticketCode);

  if (rowIndex < 0) {
    return { success: false, error: 'Ticket not found: ' + ticketCode };
  }

  var rowData = sheet.getRange(rowIndex, 1, 1, CONFIG.TOTAL_COLUMNS).getValues()[0];
  return {
    success: true,
    ticket: rowToTicket(rowData),
  };
}


// ══════════════════════════════════════════════════════════
//  HANDLER: Tạo ticket mới
// ══════════════════════════════════════════════════════════

function handleCreateTicket(body) {
  var sheet = getTicketsSheet();
  var now = new Date().toISOString();

  var ticketCode = body.ticketCode || generateTicketCode(body.category || 'label-bag');

  var ticket = {
    ticketCode:     ticketCode,
    category:       body.category       || 'label-bag',
    action:         body.ticketAction   || body.action || 'new',
    brandName:      body.brandName      || '',
    contactName:    body.contactName    || '',
    contactPhone:   body.contactPhone   || '',
    contactEmail:   body.contactEmail   || '',
    contactAddress: body.contactAddress || '',
    description:    body.description    || '',
    formData:       body.formData       || {},
    imageUrls:      body.imageUrls      || [],
    status:         'open',
    assignedTo:     '',
    revisionRound:  0,
    createdAt:      now,
    updatedAt:      now,
    completedAt:    '',
  };

  var row = ticketToRow(ticket);
  sheet.appendRow(row);
  SpreadsheetApp.flush();

  Logger.log('✅ Ticket created: ' + ticketCode + ' — ' + (body.brandName || 'N/A'));

  return {
    success: true,
    ticket: ticket,
    message: 'Ticket created: ' + ticketCode,
  };
}


// ══════════════════════════════════════════════════════════
//  HANDLER: Cập nhật ticket
// ══════════════════════════════════════════════════════════

function handleUpdateTicket(body) {
  var ticketCode = body.ticketCode || body.code;
  if (!ticketCode) {
    return { success: false, error: 'Missing ticketCode' };
  }

  var sheet = getTicketsSheet();
  var rowIndex = findRowByTicketCode(sheet, ticketCode);

  if (rowIndex < 0) {
    return { success: false, error: 'Ticket not found: ' + ticketCode };
  }

  var now = new Date().toISOString();
  var updated = [];

  // Cập nhật status
  if (body.status !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.STATUS).setValue(body.status);
    updated.push('status=' + body.status);

    // Auto ghi completedAt khi hoàn thành
    if (body.status === 'completed') {
      sheet.getRange(rowIndex, CONFIG.COL.COMPLETED_AT).setValue(now);
      updated.push('completedAt');
    }

    // Auto tăng revisionRound khi revision
    if (body.status === 'revision') {
      var currentRound = parseInt(sheet.getRange(rowIndex, CONFIG.COL.REVISION_ROUND).getValue()) || 0;
      sheet.getRange(rowIndex, CONFIG.COL.REVISION_ROUND).setValue(currentRound + 1);
      updated.push('revisionRound=' + (currentRound + 1));
    }
  }

  // Cập nhật assignedTo
  if (body.assignedTo !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.ASSIGNED_TO).setValue(body.assignedTo);
    updated.push('assignedTo=' + body.assignedTo);
  }

  // Cập nhật description
  if (body.description !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.DESCRIPTION).setValue(body.description);
    updated.push('description');
  }

  // Cập nhật brandName
  if (body.brandName !== undefined) {
    sheet.getRange(rowIndex, CONFIG.COL.BRAND_NAME).setValue(body.brandName);
    updated.push('brandName');
  }

  // Cập nhật imageUrls
  if (body.imageUrls !== undefined) {
    var urlsStr = typeof body.imageUrls === 'string' ? body.imageUrls : JSON.stringify(body.imageUrls);
    sheet.getRange(rowIndex, CONFIG.COL.IMAGE_URLS).setValue(urlsStr);
    updated.push('imageUrls');
  }

  // Cập nhật formData
  if (body.formData !== undefined) {
    var formStr = typeof body.formData === 'string' ? body.formData : JSON.stringify(body.formData);
    sheet.getRange(rowIndex, CONFIG.COL.FORM_DATA).setValue(formStr);
    updated.push('formData');
  }

  // Luôn cập nhật updatedAt
  sheet.getRange(rowIndex, CONFIG.COL.UPDATED_AT).setValue(now);
  SpreadsheetApp.flush();

  Logger.log('✅ Ticket updated: ' + ticketCode + ' → ' + updated.join(', '));

  // Đọc lại data mới
  var rowData = sheet.getRange(rowIndex, 1, 1, CONFIG.TOTAL_COLUMNS).getValues()[0];

  return {
    success: true,
    ticket: rowToTicket(rowData),
    updated: updated,
    message: 'Updated: ' + updated.join(', '),
  };
}


// ══════════════════════════════════════════════════════════
//  HANDLER: Batch update nhiều tickets
// ══════════════════════════════════════════════════════════

function handleBatchUpdate(updates) {
  if (!updates || updates.length === 0) {
    return { success: false, error: 'No updates provided' };
  }

  var sheet = getTicketsSheet();
  var results = [];

  for (var i = 0; i < updates.length; i++) {
    var u = updates[i];
    try {
      var result = handleUpdateTicket({
        ticketCode: u.ticketCode || u.code,
        status: u.status,
        assignedTo: u.assignedTo,
        description: u.description,
      });
      results.push({ ticketCode: u.ticketCode, success: result.success });
    } catch (err) {
      results.push({ ticketCode: u.ticketCode, success: false, error: err.message });
    }
  }

  return {
    success: true,
    results: results,
    updatedCount: results.filter(function(r) { return r.success; }).length,
  };
}


// ══════════════════════════════════════════════════════════
//  MENU & UTILITIES
// ══════════════════════════════════════════════════════════

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🎫 Tickets')
    .addItem('📊 Đếm tickets', 'countTickets')
    .addItem('🔍 Kiểm tra tab Tickets', 'checkTicketsTab')
    .addSeparator()
    .addItem('📋 Tạo/Kiểm tra header', 'ensureHeaders')
    .addItem('🧪 Test API', 'testApiResponse')
    .addToUi();

  // Chat Backup menu (nếu hàm addChatBackupMenu tồn tại)
  try { addChatBackupMenu(); } catch(e) { /* ChatBackup.gs chưa được thêm */ }
}

function countTickets() {
  var sheet = getTicketsSheet();
  var lastRow = sheet.getLastRow();
  var count = Math.max(0, lastRow - CONFIG.HEADER_ROW);

  var statusCounts = {};
  if (count > 0) {
    var statuses = sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.STATUS, count, 1).getValues();
    for (var i = 0; i < statuses.length; i++) {
      var s = statuses[i][0] || 'unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
  }

  var msg = '🎫 Tổng tickets: ' + count + '\n\n';
  for (var status in statusCounts) {
    msg += '  • ' + status + ': ' + statusCounts[status] + '\n';
  }

  SpreadsheetApp.getUi().alert(msg);
}

function checkTicketsTab() {
  var sheet = getTicketsSheet();
  var headers = sheet.getRange(1, 1, 1, CONFIG.TOTAL_COLUMNS).getValues()[0];
  var msg = '✅ Tab "Tickets" OK\n\nHeaders:\n';
  for (var i = 0; i < headers.length; i++) {
    msg += '  ' + String.fromCharCode(65 + i) + ': ' + headers[i] + '\n';
  }
  SpreadsheetApp.getUi().alert(msg);
}

function ensureHeaders() {
  var sheet = getTicketsSheet();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#e8eaf6');
  sheet.setFrozenRows(1);
  SpreadsheetApp.getUi().alert('✅ Headers đã được cập nhật!');
}

function testApiResponse() {
  var result = handleGetTickets({});
  Logger.log(JSON.stringify(result));
  SpreadsheetApp.getUi().alert(
    '✅ API Test\n\n' +
    'Tickets: ' + result.count + '\n' +
    'Total rows: ' + result.total
  );
}

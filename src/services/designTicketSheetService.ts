/**
 * ============================================================
 *  Design Ticket Sheet Service (Hybrid Architecture)
 *  Frontend ↔ Google Apps Script Web App
 * ============================================================
 *
 *  Thay thế Supabase cho ticket CRUD.
 *  Chat vẫn dùng Supabase (ticket_messages).
 *  ticketCode là key chung liên kết 2 nguồn.
 */

// ── CONFIG ──
// TODO: Sau khi deploy Apps Script Web App, paste URL tại đây
const TICKET_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzPcnS3oTeym1I69DyIDjBIvj8YxgsLqYIzmt62HFcCoKmCCGp1dS0rD3x31pbrtvcQEw/exec';

// ── Types ──
export interface SheetDesignTicket {
  ticketCode: string;
  category: 'label-bag' | 'carton' | 'social';
  action: 'edit' | 'new';
  brandName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  description: string;
  formData: Record<string, string>;
  imageUrls: string[];
  status: 'open' | 'in-review' | 'revision' | 'approved' | 'completed' | 'cancelled';
  assignedTo: string;
  revisionRound: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  message?: string;
  ticket?: SheetDesignTicket;
  tickets?: SheetDesignTicket[];
  count?: number;
  total?: number;
  updated?: string[];
  data?: T;
}

// ── JSONP helper (for GET requests to avoid CORS with Apps Script) ──
let jsonpCounter = 0;

function jsonpGet<T = any>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const callbackName = `__avgflow_jsonp_${Date.now()}_${jsonpCounter++}`;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP request timed out'));
    }, 30000);

    function cleanup() {
      clearTimeout(timeout);
      delete (window as any)[callbackName];
      const script = document.getElementById(callbackName);
      if (script) script.remove();
    }

    (window as any)[callbackName] = (data: T) => {
      cleanup();
      resolve(data);
    };

    const script = document.createElement('script');
    script.id = callbackName;
    script.src = `${url}&callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP script load failed'));
    };
    document.head.appendChild(script);
  });
}

// ── POST helper ──
async function postToScript<T = ApiResponse>(body: any): Promise<T> {
  if (!TICKET_SCRIPT_URL) {
    throw new Error('TICKET_SCRIPT_URL chưa được cấu hình. Deploy Apps Script trước.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(TICKET_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script requires text/plain for CORS
      body: JSON.stringify(body),
      redirect: 'follow', // Apps Script redirects after deploy
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ══════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════

/**
 * Đọc tất cả tickets từ Google Sheet
 */
export async function fetchAllTickets(filters?: {
  status?: string;
  category?: string;
}): Promise<SheetDesignTicket[]> {
  if (!TICKET_SCRIPT_URL) {
    console.warn('[TicketSheetService] TICKET_SCRIPT_URL chưa cấu hình');
    return [];
  }

  let url = `${TICKET_SCRIPT_URL}?action=getTickets`;
  if (filters?.status && filters.status !== 'all') {
    url += `&status=${encodeURIComponent(filters.status)}`;
  }
  if (filters?.category && filters.category !== 'all') {
    url += `&category=${encodeURIComponent(filters.category)}`;
  }

  const result = await jsonpGet<ApiResponse>(url);

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch tickets');
  }

  return result.tickets || [];
}

/**
 * Đọc 1 ticket theo ticketCode
 */
export async function fetchTicketByCode(ticketCode: string): Promise<SheetDesignTicket | null> {
  if (!TICKET_SCRIPT_URL || !ticketCode) return null;

  const url = `${TICKET_SCRIPT_URL}?action=getTicket&code=${encodeURIComponent(ticketCode)}`;
  const result = await jsonpGet<ApiResponse>(url);

  if (!result.success) return null;
  return result.ticket || null;
}

/**
 * Tạo ticket mới
 */
export async function createTicket(data: {
  category: string;
  action: string;
  brandName: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  contactAddress?: string;
  description?: string;
  formData?: Record<string, string>;
  imageUrls?: string[];
}): Promise<SheetDesignTicket> {
  const { action: ticketAction, ...restData } = data;
  const result = await postToScript<ApiResponse>({
    action: 'createTicket',
    ticketAction,
    ...restData,
  });

  if (!result.success || !result.ticket) {
    throw new Error(result.error || 'Failed to create ticket');
  }

  return result.ticket;
}

/**
 * Cập nhật status của ticket
 */
export async function updateTicketStatus(
  ticketCode: string,
  newStatus: string,
): Promise<SheetDesignTicket> {
  const result = await postToScript<ApiResponse>({
    action: 'updateTicket',
    ticketCode,
    status: newStatus,
  });

  if (!result.success || !result.ticket) {
    throw new Error(result.error || 'Failed to update status');
  }

  return result.ticket;
}

/**
 * Giao ticket cho người xử lý
 */
export async function updateTicketAssignment(
  ticketCode: string,
  assignedTo: string,
): Promise<SheetDesignTicket> {
  const result = await postToScript<ApiResponse>({
    action: 'updateTicket',
    ticketCode,
    assignedTo,
  });

  if (!result.success || !result.ticket) {
    throw new Error(result.error || 'Failed to assign ticket');
  }

  return result.ticket;
}

/**
 * Cập nhật nhiều fields cùng lúc
 */
export async function updateTicket(
  ticketCode: string,
  updates: Partial<{
    status: string;
    assignedTo: string;
    description: string;
    brandName: string;
    imageUrls: string[];
    formData: Record<string, string>;
  }>,
): Promise<SheetDesignTicket> {
  const result = await postToScript<ApiResponse>({
    action: 'updateTicket',
    ticketCode,
    ...updates,
  });

  if (!result.success || !result.ticket) {
    throw new Error(result.error || 'Failed to update ticket');
  }

  return result.ticket;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  if (!TICKET_SCRIPT_URL) return false;

  try {
    const url = `${TICKET_SCRIPT_URL}?action=health`;
    const result = await jsonpGet<ApiResponse>(url);
    return result.success === true;
  } catch {
    return false;
  }
}

/**
 * Kiểm tra service đã cấu hình chưa
 */
export function isConfigured(): boolean {
  return !!TICKET_SCRIPT_URL;
}

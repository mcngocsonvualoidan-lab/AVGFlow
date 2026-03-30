-- ============================================================
-- AVGFlow — Migration: Add ticket_code to ticket_messages
-- ============================================================
-- Phương án Hybrid: ticket CRUD on Sheet, chat on Supabase.
-- ticket_code (VD: TK-NB-XXXX) là key chung liên kết 2 nguồn.
--
-- Bước 1: Thêm cột ticket_code vào ticket_messages
-- Bước 2: Populate ticket_code từ design_tickets join  
-- Bước 3: Tạo index cho tìm kiếm nhanh
-- ============================================================

-- Bước 1: Thêm cột ticket_code
ALTER TABLE ticket_messages 
ADD COLUMN IF NOT EXISTS ticket_code text;

-- Bước 2: Populate ticket_code từ design_tickets
UPDATE ticket_messages tm
SET ticket_code = dt.ticket_code
FROM design_tickets dt
WHERE tm.ticket_id = dt.id::text
  AND tm.ticket_code IS NULL;

-- Bước 3: Index cho lookup nhanh theo ticket_code
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_code 
ON ticket_messages(ticket_code);

-- Bước 4: Đảm bảo Realtime vẫn hoạt động
-- (ticket_messages đã có realtime enabled, chỉ cần filter thêm ticket_code)

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Kiểm tra sau khi chạy:
-- SELECT ticket_code, COUNT(*) FROM ticket_messages GROUP BY ticket_code;

-- =====================================================
-- AVGFlow — Supabase Schema: Design Orders Protection
-- =====================================================
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- Project: hbcfslgxosdzlfuljxxn

-- 1. Main table: design_orders
CREATE TABLE IF NOT EXISTS design_orders (
    id BIGSERIAL PRIMARY KEY,
    row_index INTEGER NOT NULL UNIQUE,
    row_content JSONB NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE design_orders ENABLE ROW LEVEL SECURITY;

-- Public read policy (app needs to read)
CREATE POLICY "Allow public read on design_orders" 
    ON design_orders FOR SELECT 
    USING (true);

-- Service role insert/update/delete (for Apps Script sync)
CREATE POLICY "Allow anon insert on design_orders" 
    ON design_orders FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow anon update on design_orders" 
    ON design_orders FOR UPDATE 
    USING (true);

CREATE POLICY "Allow anon delete on design_orders" 
    ON design_orders FOR DELETE 
    USING (true);

-- Index for fast ordered queries
CREATE INDEX IF NOT EXISTS idx_design_orders_row ON design_orders(row_index);

-- 2. Backup table: design_orders_backup
CREATE TABLE IF NOT EXISTS design_orders_backup (
    id BIGSERIAL PRIMARY KEY,
    row_index INTEGER NOT NULL UNIQUE,
    row_content JSONB NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE design_orders_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on design_orders_backup" 
    ON design_orders_backup FOR SELECT 
    USING (true);

CREATE POLICY "Allow anon insert on design_orders_backup" 
    ON design_orders_backup FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow anon update on design_orders_backup" 
    ON design_orders_backup FOR UPDATE 
    USING (true);

CREATE POLICY "Allow anon delete on design_orders_backup" 
    ON design_orders_backup FOR DELETE 
    USING (true);

CREATE INDEX IF NOT EXISTS idx_design_orders_backup_row ON design_orders_backup(row_index);

-- 3. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE design_orders;

-- DONE! Now go to Google Sheet → Extensions → Apps Script 
-- and paste the SyncToSupabase.gs with SYNC_TARGET = 'design_orders'

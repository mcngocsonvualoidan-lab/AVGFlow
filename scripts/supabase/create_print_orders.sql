-- =====================================================
-- AVGFlow — Supabase Schema: Print Orders Protection
-- =====================================================
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- Project: hbcfslgxosdzlfuljxxn
-- =====================================================

-- 1. Main table
CREATE TABLE IF NOT EXISTS print_orders (
    id BIGSERIAL PRIMARY KEY,
    row_index INT NOT NULL,
    row_content JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Backup table (auto-created before each sync)
CREATE TABLE IF NOT EXISTS print_orders_backup (
    id BIGSERIAL PRIMARY KEY,
    row_index INT NOT NULL,
    row_content JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_print_orders_row ON print_orders(row_index);
CREATE INDEX IF NOT EXISTS idx_print_orders_backup_row ON print_orders_backup(row_index);

-- 4. Enable Row Level Security
ALTER TABLE print_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_orders_backup ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — allow anon key full CRUD (Apps Script uses anon key)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'print_orders_select' AND tablename = 'print_orders') THEN
        CREATE POLICY print_orders_select ON print_orders FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'print_orders_insert' AND tablename = 'print_orders') THEN
        CREATE POLICY print_orders_insert ON print_orders FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'print_orders_update' AND tablename = 'print_orders') THEN
        CREATE POLICY print_orders_update ON print_orders FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'print_orders_delete' AND tablename = 'print_orders') THEN
        CREATE POLICY print_orders_delete ON print_orders FOR DELETE USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'print_orders_backup_select' AND tablename = 'print_orders_backup') THEN
        CREATE POLICY print_orders_backup_select ON print_orders_backup FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'print_orders_backup_insert' AND tablename = 'print_orders_backup') THEN
        CREATE POLICY print_orders_backup_insert ON print_orders_backup FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'print_orders_backup_update' AND tablename = 'print_orders_backup') THEN
        CREATE POLICY print_orders_backup_update ON print_orders_backup FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'print_orders_backup_delete' AND tablename = 'print_orders_backup') THEN
        CREATE POLICY print_orders_backup_delete ON print_orders_backup FOR DELETE USING (true);
    END IF;
END $$;

-- 6. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE print_orders;

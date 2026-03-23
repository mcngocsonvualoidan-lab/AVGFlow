-- =====================================================
-- AVGFlow — Supabase Schema: Product Catalog
-- =====================================================

CREATE TABLE IF NOT EXISTS product_catalog (
    id BIGSERIAL PRIMARY KEY,
    row_index INT NOT NULL,
    row_content JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_catalog_backup (
    id BIGSERIAL PRIMARY KEY,
    row_index INT NOT NULL,
    row_content JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_row ON product_catalog(row_index);
CREATE INDEX IF NOT EXISTS idx_product_catalog_backup_row ON product_catalog_backup(row_index);

ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalog_backup ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_catalog_select' AND tablename = 'product_catalog') THEN
        CREATE POLICY product_catalog_select ON product_catalog FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_catalog_insert' AND tablename = 'product_catalog') THEN
        CREATE POLICY product_catalog_insert ON product_catalog FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_catalog_update' AND tablename = 'product_catalog') THEN
        CREATE POLICY product_catalog_update ON product_catalog FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_catalog_delete' AND tablename = 'product_catalog') THEN
        CREATE POLICY product_catalog_delete ON product_catalog FOR DELETE USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_catalog_backup_select' AND tablename = 'product_catalog_backup') THEN
        CREATE POLICY product_catalog_backup_select ON product_catalog_backup FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_catalog_backup_insert' AND tablename = 'product_catalog_backup') THEN
        CREATE POLICY product_catalog_backup_insert ON product_catalog_backup FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_catalog_backup_update' AND tablename = 'product_catalog_backup') THEN
        CREATE POLICY product_catalog_backup_update ON product_catalog_backup FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_catalog_backup_delete' AND tablename = 'product_catalog_backup') THEN
        CREATE POLICY product_catalog_backup_delete ON product_catalog_backup FOR DELETE USING (true);
    END IF;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE product_catalog;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- Customers Table
-- =====================================================

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    row_index INT NOT NULL,
    row_content JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers_backup (
    id BIGSERIAL PRIMARY KEY,
    row_index INT NOT NULL,
    row_content JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_row ON customers(row_index);
CREATE INDEX IF NOT EXISTS idx_customers_backup_row ON customers_backup(row_index);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers_backup ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_select' AND tablename = 'customers') THEN
        CREATE POLICY customers_select ON customers FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_insert' AND tablename = 'customers') THEN
        CREATE POLICY customers_insert ON customers FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_update' AND tablename = 'customers') THEN
        CREATE POLICY customers_update ON customers FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_delete' AND tablename = 'customers') THEN
        CREATE POLICY customers_delete ON customers FOR DELETE USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_backup_select' AND tablename = 'customers_backup') THEN
        CREATE POLICY customers_backup_select ON customers_backup FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_backup_insert' AND tablename = 'customers_backup') THEN
        CREATE POLICY customers_backup_insert ON customers_backup FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_backup_update' AND tablename = 'customers_backup') THEN
        CREATE POLICY customers_backup_update ON customers_backup FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_backup_delete' AND tablename = 'customers_backup') THEN
        CREATE POLICY customers_backup_delete ON customers_backup FOR DELETE USING (true);
    END IF;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE customers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- Meeting Schedule Table
-- =====================================================

CREATE TABLE IF NOT EXISTS meeting_schedule (
    id BIGSERIAL PRIMARY KEY,
    row_index INT NOT NULL,
    row_content JSONB NOT NULL DEFAULT '[]'::jsonb,
    gid TEXT NOT NULL DEFAULT '0',
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_schedule_backup (
    id BIGSERIAL PRIMARY KEY,
    row_index INT NOT NULL,
    row_content JSONB NOT NULL DEFAULT '[]'::jsonb,
    gid TEXT NOT NULL DEFAULT '0',
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_schedule_row ON meeting_schedule(row_index);
CREATE INDEX IF NOT EXISTS idx_meeting_schedule_gid ON meeting_schedule(gid);
CREATE INDEX IF NOT EXISTS idx_meeting_schedule_backup_row ON meeting_schedule_backup(row_index);

ALTER TABLE meeting_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_schedule_backup ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meeting_schedule_select' AND tablename = 'meeting_schedule') THEN
        CREATE POLICY meeting_schedule_select ON meeting_schedule FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meeting_schedule_insert' AND tablename = 'meeting_schedule') THEN
        CREATE POLICY meeting_schedule_insert ON meeting_schedule FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meeting_schedule_update' AND tablename = 'meeting_schedule') THEN
        CREATE POLICY meeting_schedule_update ON meeting_schedule FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meeting_schedule_delete' AND tablename = 'meeting_schedule') THEN
        CREATE POLICY meeting_schedule_delete ON meeting_schedule FOR DELETE USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meeting_schedule_backup_select' AND tablename = 'meeting_schedule_backup') THEN
        CREATE POLICY meeting_schedule_backup_select ON meeting_schedule_backup FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meeting_schedule_backup_insert' AND tablename = 'meeting_schedule_backup') THEN
        CREATE POLICY meeting_schedule_backup_insert ON meeting_schedule_backup FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meeting_schedule_backup_update' AND tablename = 'meeting_schedule_backup') THEN
        CREATE POLICY meeting_schedule_backup_update ON meeting_schedule_backup FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meeting_schedule_backup_delete' AND tablename = 'meeting_schedule_backup') THEN
        CREATE POLICY meeting_schedule_backup_delete ON meeting_schedule_backup FOR DELETE USING (true);
    END IF;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE meeting_schedule;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

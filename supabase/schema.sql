-- =============================================
-- AVGFlow Design Tickets — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Design Tickets table
CREATE TABLE IF NOT EXISTS design_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    brand_name TEXT DEFAULT '',
    contact_name TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    contact_email TEXT DEFAULT '',
    contact_address TEXT DEFAULT '',
    form_data JSONB DEFAULT '{}',
    image_urls TEXT[] DEFAULT '{}',
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'review', 'revision', 'completed', 'cancelled')),
    revision_round INTEGER DEFAULT 0,
    assigned_to TEXT,
    cancel_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 2. Ticket Messages table (replaces Firestore subcollection)
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES design_tickets(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sender TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'admin')),
    sender_email TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON design_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON design_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_code ON design_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON ticket_messages(created_at ASC);

-- 4. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_design_tickets ON design_tickets;
CREATE TRIGGER trigger_update_design_tickets
    BEFORE UPDATE ON design_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Enable Row Level Security (public access for orders page)
ALTER TABLE design_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (same as current Firestore rules: allow read, write: if true)
DROP POLICY IF EXISTS "Public access design_tickets" ON design_tickets;
CREATE POLICY "Public access design_tickets" ON design_tickets
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access ticket_messages" ON ticket_messages;
CREATE POLICY "Public access ticket_messages" ON ticket_messages
    FOR ALL USING (true) WITH CHECK (true);

-- 6. Enable Realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE design_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_messages;

-- ✅ Done! Tables are ready for use.

-- Create table for Executive Directives Storage
CREATE TABLE IF NOT EXISTS public.executive_directives (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    row_index INT NOT NULL,
    row_content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.executive_directives ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public Read" ON public.executive_directives
    FOR SELECT
    USING (true);

-- Allow public insert/update/delete (For Migration Sync - Secure this in production!)
CREATE POLICY "Public Write" ON public.executive_directives
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public Delete" ON public.executive_directives
    FOR DELETE
    USING (true);

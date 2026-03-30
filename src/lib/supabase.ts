import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqekfvfarxscxozpxouh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GfeGsFqVLwQ4_DPuJaB4sA_B-ZHqcrz';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
        params: {
            eventsPerSecond: 2, // Reduced from 40 to save bandwidth (free plan)
        },
        heartbeatIntervalMs: 60000, // 60s heartbeat (was 15s) — saves ~75% realtime egress
        timeout: 10000,
    },
});

// Types matching our Supabase tables
export interface SupabaseDesignTicket {
    id: string;
    ticket_code: string;
    category: string;
    action: string;
    brand_name: string;
    contact_name: string;
    contact_phone: string;
    contact_email: string;
    contact_address: string;
    form_data: Record<string, string>;
    image_urls: string[];
    description: string;
    status: 'open' | 'in-progress' | 'review' | 'revision' | 'completed' | 'cancelled';
    revision_round: number;
    assigned_to: string | null;
    cancel_reason: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

export interface SupabaseTicketMessage {
    id: string;
    ticket_id: string;
    ticket_code: string | null; // Hybrid: ticketCode liên kết Chat ↔ Sheet Ticket
    text: string;
    sender: string;
    sender_role: 'customer' | 'admin';
    sender_email: string | null;
    image_url: string | null;
    created_at: string;
}

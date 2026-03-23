/**
 * ============================================================
 *  AVGFlow — Meeting Schedule Service
 *  Supabase-first → Proxy/CSV fallback
 * ============================================================
 */
import { supabase } from '../lib/supabase';

const MODULE = '[MeetingService]';

const SUPABASE_TABLE = 'meeting_schedule';

export interface Meeting {
    id: string;
    scope: string;
    day: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: string;
    content: string;
    pic: string;
    participants: string;
    secretary: string;
    note: string;
    link: string;
    isHighlight?: boolean;
}

/**
 * Parse raw Supabase rows → Meeting[]
 * 
 * Apps Script syncs getDataRange() → row_content stores ALL columns from A.
 * Sheet layout:
 *   A(0)=STT, B(1)=Tuần, C(2)=Phạm vi, D(3)=Thứ, E(4)=Ngày,
 *   F(5)=Bắt đầu, G(6)=Kết thúc, H(7)=Thời lượng,
 *   I(8)=Nội dung, J(9)=NĐH, K(10)=Thành phần,
 *   L(11)=Thư ký, M(12)=Ghi chú, N(13)=Link
 * 
 * This matches the CSV hook which uses r[2] for scope, r[3] for day, etc.
 */
/**
 * Clean time values that may contain the Excel epoch date prefix.
 * e.g. "30/12/1899 14:00:00" → "14:00"
 */
function cleanTimeValue(raw: string): string {
    if (!raw) return '';
    // Pattern: "30/12/1899 HH:mm:ss" or "30/12/1899 HH:mm"
    const epochMatch = raw.match(/^30\/12\/1899\s+(\d{1,2}:\d{2})(:\d{2})?$/);
    if (epochMatch) {
        return epochMatch[1]; // Return just "HH:mm"
    }
    // Already clean (e.g. "14:00" or "14:00:00") — strip seconds if present
    const timeOnly = raw.match(/^(\d{1,2}:\d{2})(:\d{2})?$/);
    if (timeOnly) {
        return timeOnly[1]; // Return just "HH:mm"
    }
    return raw;
}

function parseFromSupabase(rows: any[]): Meeting[] {
    return rows.map((r, idx) => {
        const c: string[] = r.row_content || [];
        return {
            id: `sb-${r.row_index || idx}`,
            scope: (c[2] || '').trim(),         // Col C
            day: (c[3] || '').trim(),            // Col D
            date: (c[4] || '').trim(),           // Col E
            startTime: cleanTimeValue((c[5] || '').trim()),  // Col F
            endTime: cleanTimeValue((c[6] || '').trim()),    // Col G
            duration: (c[7] || '').trim(),       // Col H
            content: (c[8] || '').trim(),        // Col I
            pic: (c[9] || '').trim(),            // Col J
            participants: (c[10] || '').trim(),  // Col K
            secretary: (c[11] || '').trim(),     // Col L
            note: (c[12] || '').trim(),          // Col M
            link: (c[13] || '').trim(),          // Col N
            isHighlight: (c[8] || '').toLowerCase().includes('quan trọng'),
        };
    }).filter(m => m.date || m.content);
}

/**
 * Fetch meetings for a specific GID (month) from Supabase
 * Returns null if Supabase fails (to signal fallback needed)
 */
export async function fetchMeetings(gid: string): Promise<Meeting[] | null> {
    try {
        const { data, error } = await supabase
            .from(SUPABASE_TABLE)
            .select('row_index, row_content')
            .eq('gid', gid)
            .order('row_index', { ascending: true });

        if (!error && data && data.length > 0) {
            const meetings = parseFromSupabase(data);
            console.log(`${MODULE} ✅ Loaded from Supabase (gid=${gid}): ${meetings.length} meetings`);
            return meetings;
        }
        if (error) console.warn(`${MODULE} Supabase error:`, error.message);
    } catch (e) {
        console.warn(`${MODULE} Supabase fetch failed:`, e);
    }

    // Return null to signal fallback needed
    return null;
}

/**
 * Subscribe to Realtime changes for meeting schedule
 * 🔋 DISABLED in hybrid mode — data comes from Google Sheets
 */
export function subscribeToMeetingChanges(_onUpdate: () => void): () => void {
    console.log('[MeetingService] ℹ️ Realtime disabled (hybrid mode — using Google Sheets)');
    return () => {};
}

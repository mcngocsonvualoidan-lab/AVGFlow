import { useState, useEffect, useCallback } from 'react';

export interface Meeting {
    id: string;
    scope: string; // PHẠM VI
    day: string; // THỨ
    date: string; // NGÀY
    startTime: string; // BẮT ĐẦU
    endTime: string; // KẾT THÚC
    duration: string; // THỜI LƯỢNG
    content: string; // NỘI DUNG
    pic: string; // NĐH
    participants: string; // THÀNH PHẦN
    secretary: string; // THƯ KÝ
    note: string; // GHI CHÚ
    link: string; // LINK
    isHighlight?: boolean;
}

export const useMeetingSchedule = () => {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSheetData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const SHEET_ID = '11p55tNRLRqVfgwEfrcTWJfxKA6dJQyDJq4CapgZ5o-M';
            const GID = '0';
            const GOOGLE_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

            let responseText: string | null = null;

            // Timestamp for cache busting
            const t = Date.now();

            // Attempt 1: CodeTabs
            try {
                const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(GOOGLE_URL)}&_t=${t}`);
                if (res.ok) responseText = await res.text();
            } catch (e) {
                console.warn("CodeTabs failed", e);
            }

            // Attempt 2: AllOrigins
            if (!responseText) {
                try {
                    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(GOOGLE_URL)}&_t=${t}`);
                    if (res.ok) responseText = await res.text();
                } catch (e) {
                    console.warn("AllOrigins failed", e);
                }
            }
            // Attempt 3: CorsProxy.io
            if (!responseText) {
                try {
                    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(GOOGLE_URL)}&_t=${t}`);
                    if (res.ok) responseText = await res.text();
                } catch (e) {
                    console.warn("CorsProxy failed", e);
                }
            }

            if (!responseText) throw new Error("Không thể kết nối đến Google Sheets (Proxy Error)");

            if (responseText.trim().startsWith('<!DOCTYPE html') || responseText.includes('<html')) {
                throw new Error('Không có quyền truy cập (Permission Denied)');
            }

            // GVIZ CSV Parsing
            const rows: string[][] = [];
            let currentRow: string[] = [];
            let currentCell = '';
            let inQuote = false;

            for (let i = 0; i < responseText.length; i++) {
                const char = responseText[i];
                const nextChar = responseText[i + 1];

                if (char === '"') {
                    if (inQuote && nextChar === '"') {
                        currentCell += '"';
                        i++;
                    } else {
                        inQuote = !inQuote;
                    }
                } else if (char === ',' && !inQuote) {
                    currentRow.push(currentCell);
                    currentCell = '';
                } else if ((char === '\r' || char === '\n') && !inQuote) {
                    if (currentCell || currentRow.length > 0) {
                        currentRow.push(currentCell);
                        rows.push(currentRow);
                        currentRow = [];
                        currentCell = '';
                    }
                    if (char === '\r' && nextChar === '\n') i++;
                } else {
                    currentCell += char;
                }
            }
            if (currentRow.length > 0 || currentCell) {
                currentRow.push(currentCell);
                rows.push(currentRow);
            }

            const mappedData: Meeting[] = rows
                .filter(r => r.length > 5 && !r[0].includes('google.visualization') && (r[2] || r[8]))
                .slice(1) // Skip likely header
                .map((r, idx) => {
                    return {
                        id: `sheet-${idx}`,
                        scope: r[2] || '',
                        day: r[3] || '',
                        date: r[4] || '',
                        startTime: r[5] || '',
                        endTime: r[6] || '',
                        duration: r[7] || '',
                        content: r[8] || '',
                        pic: r[9] || '',
                        participants: r[10] || '',
                        secretary: r[11] || '',
                        note: r[12] || '',
                        link: r[13] || '',
                        isHighlight: (r[8] || '').toLowerCase().includes('quan trọng')
                    };
                });

            setMeetings(mappedData);
        } catch (err: any) {
            console.error("Sync error:", err);
            setError(err.message || "Lỗi đồng bộ");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSheetData();

        // Auto-refresh every 5 minutes
        const intervalId = setInterval(fetchSheetData, 5 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [fetchSheetData]);

    return { meetings, loading, error, refresh: fetchSheetData };
};

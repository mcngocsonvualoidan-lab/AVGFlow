import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Calendar, Clock, Database, /* Download, */ FileText, LayoutDashboard, Maximize2, Search, Sparkles, Users, X, /* Zap, */ Minimize2, Eye, ArrowLeftRight, ZoomIn, ZoomOut, Download, Printer, RefreshCcw } from 'lucide-react';
import HeroBanner from '../../components/HeroBanner';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, ComposedChart, Line, LabelList, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
// import * as XLSX from 'xlsx';
import { fetchFromSupabase, fetchFromGoogleSheet, syncToSupabase } from '../../services/directiveService';

const REQUIREMENTS = [
    {
        phase: 'Giai đoạn 1: Chuẩn hóa & Kết nối (Tuần 1)',
        items: [
            'Thiết lập kết nối API giữa Antigravity AI và Google Sheet',
            'Xây dựng cấu trúc Database lưu trữ lịch sử điều hành',
            'Thiết kế Dashboard cơ bản'
        ],
        status: 'done'
    },
    {
        phase: 'Giai đoạn 2: Phân tích thông minh (Tuần 2)',
        items: [
            'Huấn luyện AI nhận diện thực thể (Người, Ngày, Địa điểm)',
            'Logic tự động gán nhãn (Tagging) cho thông điệp'
        ],
        status: 'pending'
    },
    {
        phase: 'Giai đoạn 3: Thông báo & Tương tác (Tuần 3)',
        items: [
            'Tích hợp nhắc lịch (Reminders) theo mốc thời gian',
            'Bộ lọc thông điệp theo từng Sếp điều hành'
        ],
        status: 'pending'
    },
    {
        phase: 'Giai đoạn 4: Kiểm thử & Triển khai (Tuần 4)',
        items: [
            'Nạp dữ liệu thực tế để test AI',
            'Phân quyền truy cập (Lãnh đạo/Nhân viên)'
        ],
        status: 'pending'
    }
];


const ExecutiveDirectives: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'plan'>('dashboard');
    const [directives, setDirectives] = useState<string[][]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dataSource, setDataSource] = useState<'supabase' | 'sheet'>('supabase');
    const [selectedYear, setSelectedYear] = useState<number>(2026);




    // Filter & Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline'); // Default to Timeline
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<{ row: string[], headers: string[] } | null>(null);
    const [filterStatus, setFilterStatus] = useState<'all' | 'direct' | 'indirect' | 'unconfirmed' | 'order'>('all');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');


    // Time Filter State
    const [timeFilter, setTimeFilter] = useState<{ type: 'year' | 'quarter' | 'month', value: number } | null>(null);
    // Expand states for Sidebar
    const [expandedYear, setExpandedYear] = useState(false);
    const [expandedQuarters, setExpandedQuarters] = useState<number[]>([1, 2, 3, 4]);

    // Hover Tooltip State
    const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; content: string } | null>(null);


    // Document Preview State
    const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isDocLoading, setIsDocLoading] = useState(false);

    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    /*
    const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
    */

    const loadData = async (forceSync = false, background = false) => {
        if (!background) {
            setLoading(true);
            setError(null);
        } else {
            // setIsBackgroundUpdating(true);
        }

        try {
            let data: string[][] = [];

            // 1. Try Loading from Supabase first (unless forcing sync)
            if (!forceSync) {
                try {
                    data = await fetchFromSupabase();
                    if (data.length > 0) {
                        setDataSource('supabase');
                        setDirectives(data);
                        // If we loaded from Supabase, trigger a background refresh right away
                        if (!background) {
                            loadData(true, true);
                        }
                    }
                } catch (e) {
                    console.warn("Supabase fetch failed", e);
                }
            }

            // 2. If no data or forcing sync (background or otherwise), fetch from Google Sheet
            if (forceSync || data.length === 0) {
                if (forceSync && !background) console.log("Force sync...");

                const sheetData = await fetchFromGoogleSheet();

                // Only update if we got data
                if (sheetData.length > 0) {
                    setDirectives(sheetData);
                    setDataSource('sheet');
                    setLastUpdated(new Date());

                    // 3. Sync back to Supabase for next time
                    syncToSupabase(sheetData).catch(err => console.error("Background sync failed:", err));
                }
            }
        } catch (err: any) {
            console.error("Data load error:", err);
            if (!background) {
                setError(err.message === 'ALL_PROXIES_FAILED' ? "Không thể kết nối Google Sheets." : "Lỗi tải dữ liệu.");
            }
        } finally {
            if (!background) setLoading(false);
            // setIsBackgroundUpdating(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'dashboard') {
            loadData(false);
        }
    }, [activeTab]);

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.5 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    // --- Process Data ---
    // Advanced: Detect Header Row Index (Scan first 10 rows for keywords like "STT", "Ngày", "Chủ thể")
    const headerRowIndex = useMemo(() => {
        if (directives.length === 0) return -1;
        for (let i = 0; i < Math.min(directives.length, 10); i++) {
            const rowStr = directives[i].join(' ').toLowerCase();
            if (
                (rowStr.includes('stt') && rowStr.includes('ngày')) ||
                rowStr.includes('chủ thể') ||
                rowStr.includes('đầu mối') ||
                (rowStr.includes('thứ') && rowStr.includes('ngày') && rowStr.includes('giờ'))
            ) {
                return i;
            }
        }
        return 0; // Fallback to first row
    }, [directives]);

    const headers = headerRowIndex !== -1 ? directives[headerRowIndex] : [];
    const rawBody = headerRowIndex !== -1 ? directives.slice(headerRowIndex + 1) : [];

    // Helper: Find Date Column
    const dateColIndex = useMemo(() => {
        // 1. Try Header Search
        const idx = headers.findIndex(h => {
            const lower = h.toLowerCase();
            return lower.includes('ngày') || lower.includes('thời gian') || lower.includes('timeline') || lower.includes('date') || lower.includes('time');
        });
        if (idx !== -1) return idx;

        // 2. Fallback: Sniff Data to find a Date Column (Score-based)
        if (rawBody.length > 0) {
            const numCols = rawBody[0].length;
            const sampleRows = rawBody.slice(0, 100); // Check first 100 rows for better accuracy
            let bestCol = -1;
            let maxScore = 0;

            for (let c = 0; c < numCols; c++) {
                let matchCount = 0;
                for (const row of sampleRows) {
                    if (row[c] && /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.test(row[c])) {
                        matchCount++;
                    }
                }
                // Score must be significant (lowered threshold to catch sparse data)
                if (matchCount >= 1 && matchCount > maxScore) {
                    maxScore = matchCount;
                    bestCol = c;
                }
            }
            return bestCol;
        }
        return -1;
    }, [headers, rawBody]);

    // Normalize Body: Forward-fill missing dates
    const normalizedBody = useMemo(() => {
        if (dateColIndex === -1 || rawBody.length === 0) return rawBody;

        let lastSeenDate = '';
        return rawBody.map(row => {
            const cell = row[dateColIndex];
            if (cell && cell.trim() !== '') {
                lastSeenDate = cell;
                return row;
            }
            // If empty date, but row has content, fill it
            if (row.some(c => c && c.trim() !== '')) {
                const newRow = [...row];
                newRow[dateColIndex] = lastSeenDate;
                return newRow;
            }
            return row;
        });
    }, [rawBody, dateColIndex]);

    // Helper: Parse Date from row
    const getRowDate = (row: string[]) => {
        if (dateColIndex === -1) return null;
        const cell = row[dateColIndex];
        if (!cell) return null;

        // formats: dd/mm/yyyy, d/m/yyyy, yyyy-mm-dd
        // simple regex for dd/mm/yyyy or d/m/yyyy (search ANYWHERE in string)
        const dmy = cell.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dmy) {
            return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
        }
        // check iso
        const iso = cell.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (iso) {
            return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
        }
        return null; // Invalid date format
    };

    // 1. Filter Data (Search + Time)
    const filteredData = useMemo(() => {
        let result = normalizedBody;

        // A. Filter by SOURCE YEAR (Metadata - Index 0)
        // Note: normalizedBody includes the metadata column at index 0
        if (selectedYear) {
            result = result.filter(row => {
                const sourceYear = parseInt(row[0]);
                // If sourceYear is logical, use it
                if (!isNaN(sourceYear) && sourceYear > 2000) {
                    return sourceYear === selectedYear;
                }
                // Fallback to Date Parsing if metadata missing (legacy)
                const date = getRowDate(row);
                if (date) return date.getFullYear() === selectedYear;
                return false;
            });
        }

        // B. Specific Time Filter (Quarter/Month)
        if (timeFilter) {
            result = result.filter(row => {
                const date = getRowDate(row);
                if (!date) return false;

                if (timeFilter.type === 'quarter') {
                    const q = Math.floor(date.getMonth() / 3) + 1;
                    return q === timeFilter.value;
                }
                if (timeFilter.type === 'month') {
                    // timeFilter.value is 1-12
                    return (date.getMonth() + 1) === timeFilter.value;
                }
                return true;
            });
        }

        // B. Search Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(row => row.some(cell => String(cell).toLowerCase().includes(lowerTerm)));
        }

        return result;
    }, [rawBody, searchTerm, timeFilter, dateColIndex]);

    // Calculate Active Columns (Hide empty columns IN FILTERED DATA)
    const activeColumnIndices = useMemo(() => {
        if (headers.length === 0) return [];
        const indices = new Set<number>();

        headers.forEach((_, idx) => {
            // Check if column has data in the CURRENT filtered set
            const hasData = filteredData.some(row => row[idx] && row[idx].trim() !== '');
            if (hasData) indices.add(idx);
        });
        return Array.from(indices).sort((a, b) => a - b);
    }, [headers, filteredData]);

    // 2. Chart Data (Identify "Chủ thể đầu mối")
    const chartData = useMemo(() => {
        if (headers.length === 0) return [];

        let targetIndex = headers.findIndex(h => {
            const lower = h.toLowerCase();
            return lower.includes('đầu mối') ||
                lower.includes('chủ thể') ||
                lower.includes('phụ trách') ||
                lower.includes('pic') ||
                lower.includes('người') ||
                lower.includes('cán bộ') ||
                lower.includes('bộ phận') ||
                lower.includes('nhân sự');
        });

        // Fallback: Avoid the date column if one was detected
        if (targetIndex === -1 && headers.length > 1) {
            targetIndex = (dateColIndex === 1) ? 2 : 1;
            // Additional safety: if column 1 is "Thứ", skip it
            if (headers[targetIndex] && (headers[targetIndex].toLowerCase().includes('thứ') || headers[targetIndex].toLowerCase().includes('ngày'))) {
                targetIndex += 1;
            }
        }

        if (targetIndex === -1) return [];

        const counts: Record<string, number> = {};
        const aliasMap: Record<string, string> = {};
        const displayMap: Record<string, string> = {};

        // Pass 1: Build Alias Map from rows containing ";"
        filteredData.forEach(row => {
            const val = row[targetIndex]?.trim();
            if (val && val.includes(';')) {
                const parts = val.split(';').map(p => p.trim()).filter(p => p);
                if (parts.length > 0) {
                    const main = parts[0];
                    const aliases = parts.slice(1);

                    // Map aliases to main
                    aliases.forEach(a => {
                        aliasMap[a] = main;
                    });
                    aliasMap[main] = main;

                    // Store display name
                    if (!displayMap[main]) {
                        displayMap[main] = `${main} (${aliases.join('; ')})`;
                    }
                }
            }
        });

        // Pass 2: Count
        filteredData.forEach(row => {
            const val = row[targetIndex]?.trim();
            if (val) {
                let key = val;

                // Normalization
                if (val.includes(';')) {
                    const parts = val.split(';').map(p => p.trim()).filter(p => p);
                    if (parts.length > 0) key = parts[0];
                } else if (aliasMap[val]) {
                    key = aliasMap[val];
                }

                counts[key] = (counts[key] || 0) + 1;
            }
        });

        return Object.entries(counts)
            .map(([key, count]) => ({
                name: displayMap[key] || key,
                count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [filteredData, headers, dateColIndex]);

    // 2.5 Identify Columns for Timeline (Updated for 2026 Structure)
    const colIndices = useMemo(() => {
        if (selectedYear === 2026) {
            const lowerHeaders = headers.map(h => h.trim().toLowerCase());
            const findExact = (name: string) => lowerHeaders.findIndex(h => h === name.toLowerCase());
            const findApprox = (name: string) => lowerHeaders.findIndex(h => h.includes(name.toLowerCase()));

            const result = {
                is2026: true,
                stt: findApprox('stt') === -1 ? findApprox('#') : findApprox('stt'),
                time: findApprox('thời gian') === -1 ? findApprox('giờ') : findApprox('thời gian'),
                date: dateColIndex,
                pic: findApprox('chủ thể') === -1 ? findApprox('đầu mối') : findApprox('chủ thể'),

                // Columns: G=6, H=7, I=8 (Direct), K=10, L=11, M=12 (Indirect), O=14, P=15, Q=16 (Unconfirmed)
                direct: {
                    error: 6,    // G
                    other: 7,    // H
                    forward: 8   // I
                },
                indirect: {
                    error: 10,   // K
                    other: 11,   // L
                    forward: 12  // M
                },
                unconfirmed: {
                    error: 14,   // O
                    other: 15,   // P
                    forward: 16  // Q
                },

                order: {
                    title: findApprox('đơn hàng'),
                    issue: findApprox('vấn đề'),
                    cause: findApprox('nguyên nhân'),
                    solution: findApprox('giải pháp'),
                    purpose: findApprox('để làm gì')
                },

                deadline: {
                    title: findApprox('deadline') === -1 ? findApprox('hạn chót') : findApprox('deadline'),
                    received: findApprox('đã tiếp nhận'),
                    processing: findApprox('đang xử lý'),
                    completed: findApprox('hoàn thành'),
                    overdue: findApprox('trễ hạn'),
                    note: findApprox('ghi chú')
                },

                // Legacy variables for compatibility
                timeColIndex: findApprox('giờ'),
                directContentColIndex: findExact('lỗi'),
                indirectContentColIndex: findExact('lỗi_2'),
                unconfirmedContentColIndex: findExact('lỗi_3'),
                generalContentColIndex: -1,
                picColIndex: findApprox('chủ thể') === -1 ? findApprox('đầu mối') : findApprox('chủ thể'),
                related: findApprox('người liên quan') === -1 ? (findApprox('liên quan') === -1 ? findApprox('trực tiếp') : findApprox('liên quan')) : findApprox('người liên quan'),
                sttColIndex: findApprox('stt')
            };

            // Log column mappings for verification (development only)
            const getExcelColumn = (index: number) => {
                if (index === -1) return 'N/A';
                let column = '';
                let temp = index;
                while (temp >= 0) {
                    column = String.fromCharCode(65 + (temp % 26)) + column;
                    temp = Math.floor(temp / 26) - 1;
                }
                return column;
            };
            console.log('🔍 Column Mappings (2026):');
            console.log('Direct (should be G,H,I):', {
                error: getExcelColumn(result.direct.error),
                other: getExcelColumn(result.direct.other),
                forward: getExcelColumn(result.direct.forward)
            });
            console.log('Indirect (should be K,L,M):', {
                error: getExcelColumn(result.indirect.error),
                other: getExcelColumn(result.indirect.other),
                forward: getExcelColumn(result.indirect.forward)
            });
            console.log('Unconfirmed (should be O,P,Q):', {
                error: getExcelColumn(result.unconfirmed.error),
                other: getExcelColumn(result.unconfirmed.other),
                forward: getExcelColumn(result.unconfirmed.forward)
            });

            return result;
        }

        // Legacy 2025 Logic
        const find = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k)));
        return {
            is2026: false,
            stt: headers.findIndex(h => h.toLowerCase() === 'stt' || h.toLowerCase() === '#' || h.toLowerCase() === 'số'),
            time: find(['giờ', 'time', 'thời điểm']),
            date: dateColIndex,
            pic: find(['người', 'cán bộ', 'chủ thể', 'đầu mối', 'liên quan', 'pic']),
            related: -1,

            direct: { error: find(['trực tiếp', 'nội dung']), other: -1, forward: -1 },
            indirect: { error: find(['gián tiếp']), other: -1, forward: -1 },
            unconfirmed: { error: find(['thông tin khác']), other: -1, forward: -1 },
            order: { title: -1, issue: -1, cause: -1, solution: -1, purpose: -1 },
            deadline: { title: -1, received: -1, processing: -1, completed: -1, overdue: -1, note: -1 },

            // Legacy variables
            timeColIndex: find(['giờ', 'time', 'thời điểm']),
            directContentColIndex: find(['trực tiếp']),
            indirectContentColIndex: find(['gián tiếp']),
            unconfirmedContentColIndex: find(['thông tin khác', 'chưa xác nhận']),
            generalContentColIndex: find(['nội dung', 'chi tiết', 'thông điệp', 'điều hành']),
            picColIndex: find(['người', 'cán bộ', 'chủ thể', 'đầu mối', 'liên quan', 'pic']),
            sttColIndex: headers.findIndex(h => h.toLowerCase() === 'stt' || h.toLowerCase() === '#' || h.toLowerCase() === 'số')
        };
    }, [headers, selectedYear, dateColIndex]);

    // Destructure legacy variables for compatibility

    // 2.7 Process Data by Status Filter
    const processedData = useMemo(() => {
        if (filterStatus === 'all') return filteredData;

        return filteredData.filter(row => {
            // Filter by "Order" (Rows that have order info)
            if (filterStatus === 'order') {
                return (colIndices.order.issue !== -1 && row[colIndices.order.issue]?.trim()) ||
                    (colIndices.order.title !== -1 && row[colIndices.order.title]?.trim());
            }

            // Filter by Badge Type
            // Note: A row might have multiple types, we show the row if it has the selected type
            // The card filtering logic in renderTimeline will handle showing only the relevant card
            if (filterStatus === 'direct') {
                return (colIndices.direct.error !== -1 && row[colIndices.direct.error]?.trim()) ||
                    (colIndices.direct.other !== -1 && row[colIndices.direct.other]?.trim()) ||
                    (colIndices.direct.forward !== -1 && row[colIndices.direct.forward]?.trim());
            }
            if (filterStatus === 'indirect') {
                return (colIndices.indirect.error !== -1 && row[colIndices.indirect.error]?.trim()) ||
                    (colIndices.indirect.other !== -1 && row[colIndices.indirect.other]?.trim()) ||
                    (colIndices.indirect.forward !== -1 && row[colIndices.indirect.forward]?.trim());
            }
            if (filterStatus === 'unconfirmed') {
                return (colIndices.unconfirmed.error !== -1 && row[colIndices.unconfirmed.error]?.trim()) ||
                    (colIndices.unconfirmed.other !== -1 && row[colIndices.unconfirmed.other]?.trim()) ||
                    (colIndices.unconfirmed.forward !== -1 && row[colIndices.unconfirmed.forward]?.trim());
            }

            return true;
        });
    }, [filteredData, filterStatus, colIndices]);    // 2.8 Calculate Type Statistics
    const typeStats = useMemo(() => {
        let direct = 0, indirect = 0, unconfirmed = 0;
        processedData.forEach(row => {
            // Check direct
            if ((colIndices.direct.error !== -1 && row[colIndices.direct.error]?.trim()) ||
                (colIndices.direct.other !== -1 && row[colIndices.direct.other]?.trim()) ||
                (colIndices.direct.forward !== -1 && row[colIndices.direct.forward]?.trim())) {
                direct++;
            }

            // Check indirect
            if ((colIndices.indirect.error !== -1 && row[colIndices.indirect.error]?.trim()) ||
                (colIndices.indirect.other !== -1 && row[colIndices.indirect.other]?.trim()) ||
                (colIndices.indirect.forward !== -1 && row[colIndices.indirect.forward]?.trim())) {
                indirect++;
            }

            // Check unconfirmed
            if ((colIndices.unconfirmed.error !== -1 && row[colIndices.unconfirmed.error]?.trim()) ||
                (colIndices.unconfirmed.other !== -1 && row[colIndices.unconfirmed.other]?.trim()) ||
                (colIndices.unconfirmed.forward !== -1 && row[colIndices.unconfirmed.forward]?.trim())) {
                unconfirmed++;
            }
        });

        return [
            { name: 'Trực tiếp', count: direct, color: '#059669' },     // emerald-600
            { name: 'Gián tiếp', count: indirect, color: '#2563eb' },   // blue-600
            { name: 'Chưa xác nhận', count: unconfirmed, color: '#d97706' } // amber-600
        ];
    }, [processedData, colIndices]);

    const totalDirectIndirect = useMemo(() => {
        const direct = typeStats.find(t => t.name === 'Trực tiếp')?.count || 0;
        const indirect = typeStats.find(t => t.name === 'Gián tiếp')?.count || 0;
        return direct + indirect;
    }, [typeStats]);

    // 3. Handlers
    /*
    const handleExport = () => {
        if (filteredData.length === 0) return;

        const wb = XLSX.utils.book_new();
        // Export only VISIBLE columns + data
        const visibleHeaders = activeColumnIndices.map(i => headers[i]);
        const visibleRows = filteredData.map(row => activeColumnIndices.map(i => row[i] || ''));

        const wsData = [visibleHeaders, ...visibleRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Directives");
        XLSX.writeFile(wb, "ThongDiepDieuHanh_Export.xlsx");
    };
    */

    // Tooltip Handlers
    const handleMouseEnter = (e: React.MouseEvent, content: string) => {
        if (!content || content.length < 50) return;
        setHoverTooltip({
            x: e.clientX,
            y: e.clientY,
            content
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (hoverTooltip) {
            setHoverTooltip(prev => prev ? ({ ...prev, x: e.clientX, y: e.clientY }) : null);
        }
    };

    const handleMouseLeave = () => {
        setHoverTooltip(null);
    };



    // --- SIDEBAR COMPONENT ---
    const toggleQuarter = (q: number) => {
        setExpandedQuarters(prev => prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q]);
    };

    const renderDesktopTimeFilter = () => (
        <div className="hidden lg:block space-y-4 mt-4">
            {[2026, 2025].map(year => (
                <div key={year} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm dark:shadow-none">
                    <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-3 flex justify-between items-center cursor-pointer"
                        onClick={() => {
                            if (selectedYear !== year) {
                                setSelectedYear(year);
                                setTimeFilter(null);
                            }
                            setExpandedYear(!expandedYear);
                        }}>
                        <span className={clsx(selectedYear === year && "text-indigo-600 dark:text-indigo-400")}>Năm {year}</span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded transition-transform">
                            {selectedYear === year && expandedYear ? '▼' : '▶'}
                        </span>
                    </h3>

                    {selectedYear === year && expandedYear && (
                        <div className="space-y-3 pl-1 max-h-[50vh] overflow-y-auto no-scrollbar pr-2">
                            <button
                                onClick={() => setTimeFilter(null)}
                                className={clsx("w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex items-center justify-between", !timeFilter ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold" : "text-slate-500 dark:text-slate-400")}
                            >
                                Tất cả {year}
                            </button>

                            {[1, 2, 3, 4].map(q => (
                                <div key={q} className="space-y-1">
                                    <div className="flex items-center gap-1 group">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleQuarter(q); }}
                                            className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-white"
                                        >
                                            <span className="text-[10px]">{expandedQuarters.includes(q) ? '▼' : '▶'}</span>
                                        </button>
                                        <button
                                            onClick={() => setTimeFilter({ type: 'quarter', value: q })}
                                            className={clsx("flex-1 text-left text-xs py-1 rounded transition-colors", timeFilter?.type === 'quarter' && timeFilter.value === q ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-600 dark:text-slate-300 group-hover:text-indigo-500 dark:group-hover:text-white")}
                                        >
                                            Quý {q}
                                        </button>
                                    </div>

                                    {expandedQuarters.includes(q) && (
                                        <div className="ml-5 border-l border-white/10 pl-2 space-y-1">
                                            {[1, 2, 3].map(mOffset => {
                                                const month = (q - 1) * 3 + mOffset;
                                                return (
                                                    <button
                                                        key={month}
                                                        onClick={() => setTimeFilter({ type: 'month', value: month })}
                                                        className={clsx(
                                                            "w-full text-left text-[11px] px-2 py-1 rounded transition-colors block",
                                                            timeFilter?.type === 'month' && timeFilter.value === month
                                                                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold"
                                                                : "text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-slate-200 hover:bg-indigo-50 dark:hover:bg-white/5"
                                                        )}
                                                    >
                                                        Tháng {month}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    const renderMobileTimeFilter = () => (
        <div className="lg:hidden mt-2 space-y-3 animate-in fade-in slide-in-from-top-2">
            {/* Year Selection */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {[2026, 2025].map(year => (
                    <button
                        key={year}
                        onClick={() => {
                            setSelectedYear(year);
                            setTimeFilter(null);
                        }}
                        className={clsx(
                            "px-4 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all",
                            selectedYear === year
                                ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/20"
                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10"
                        )}
                    >
                        Năm {year}
                    </button>
                ))}
            </div>

            {/* Quarter Selection */}
            <div className="flex overflow-x-auto custom-scrollbar gap-2 pb-1 no-scrollbar border-t border-slate-200 dark:border-white/5 pt-2">
                {[1, 2, 3, 4].map(q => (
                    <button
                        key={q}
                        onClick={() => setTimeFilter({ type: 'quarter', value: q })}
                        className={clsx(
                            "px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all flex-shrink-0",
                            timeFilter?.type === 'quarter' && timeFilter.value === q
                                ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                                : timeFilter?.type === 'month' && Math.ceil(timeFilter.value / 3) === q
                                    ? "bg-slate-700 text-white border-white/20"
                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10"
                        )}
                    >
                        Quý {q}
                    </button>
                ))}
            </div>

            {/* Month Selection */}
            {(timeFilter?.type === 'quarter' || timeFilter?.type === 'month') && (
                <div className="flex overflow-x-auto custom-scrollbar gap-2 py-1 border-t border-slate-200 dark:border-white/5 pt-2 no-scrollbar">
                    {(() => {
                        const currentQ = timeFilter.type === 'quarter'
                            ? timeFilter.value
                            : Math.ceil(timeFilter.value / 3);

                        return [1, 2, 3].map(mOffset => {
                            const month = (currentQ - 1) * 3 + mOffset;
                            return (
                                <button
                                    key={month}
                                    onClick={() => setTimeFilter({ type: 'month', value: month })}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all flex items-center gap-1 flex-shrink-0",
                                        timeFilter?.type === 'month' && timeFilter.value === month
                                            ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                                            : "bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    )}
                                >
                                    <Calendar size={10} /> Tháng {month}
                                </button>
                            );
                        });
                    })()}
                </div>
            )}
        </div>
    );

    // Helper: Render Toolbar
    const renderToolbar = (isFull: boolean) => (
        <motion.div variants={itemVariants} className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-3 rounded-2xl border border-white/60 dark:border-white/5 flex gap-4 items-center shadow-lg">
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Hiển thị</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Hiển thị {totalDirectIndirect} sự kiện</span>
            </div>
            <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Tìm kiếm nội dung, người phụ trách..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400"
                />
            </div>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-white/5">
                <button
                    onClick={() => setViewMode('timeline')}
                    className={clsx("p-1.5 rounded-lg transition-all", viewMode === 'timeline' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600")}
                    title="Xem dạng Timeline"
                >
                    <Clock size={16} />
                </button>
                <button
                    onClick={() => setViewMode('table')}
                    className={clsx("p-1.5 rounded-lg transition-all", viewMode === 'table' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600")}
                    title="Xem dạng Bảng"
                >
                    <Database size={16} />
                </button>
            </div>
            <button
                onClick={() => setIsFullScreen(!isFull)}
                className={clsx(
                    "p-2 rounded-lg transition-all duration-300 border",
                    isFull
                        ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        : "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 hover:scale-105 hover:shadow-indigo-500/50"
                )}
                title={isFull ? "Thu gọn" : "Toàn màn hình"}
            >
                {isFull ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
        </motion.div>
    );

    // Helper: Render Table
    const renderTable = (isFull: boolean) => (
        <motion.div variants={itemVariants} className={clsx(
            "bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/60 dark:border-white/5 rounded-3xl overflow-hidden flex flex-col relative transition-all duration-300 shadow-xl",
            isFull ? "flex-1 h-full w-full" : "w-full min-h-[500px] mb-12"
        )}>
            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-2"></div>
                    <div>Đang tải dữ liệu...</div>
                </div>
            ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center text-red-400 p-8 text-center">
                    <p className="font-bold mb-2">Không thể tải dữ liệu</p>
                    <p className="text-sm opacity-80">{error}</p>
                    <button onClick={() => loadData(true)} className="mt-4 text-indigo-400 hover:text-indigo-300 underline">Thử lại (Sync)</button>
                </div>
            ) : (
                <div className={clsx("flex-1 overflow-auto custom-scrollbar", isFull ? "h-full" : "h-[500px] max-h-[60vh]")}>
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-indigo-50/80 dark:bg-slate-800/80 backdrop-blur-md sticky top-0 z-30 shadow-sm">
                            <tr>
                                <th className="p-4 w-16 text-center border-b border-indigo-100 dark:border-white/10 font-bold text-indigo-900 dark:text-slate-400 sticky left-0 z-40 bg-indigo-50/80 dark:bg-slate-800/80 backdrop-blur-md shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                    Xem
                                </th>
                                {activeColumnIndices.map(i => {
                                    // Skip Metadata Column 0 if we are using it
                                    if (i === 0) return null;

                                    // HACK: Hide first 2 columns (index 1 & 2) for Year 2026 as per user request
                                    if (selectedYear === 2026 && (i === 1 || i === 2)) return null;

                                    const h = headers[i].toLowerCase();
                                    // Additional HACK: Hide specific long header column
                                    if (selectedYear === 2026 && h.includes('đây là thông tin khác')) return null;

                                    const isCenter = h.includes('stt') || h.includes('thứ') || h.includes('ngày') || h.includes('giờ');
                                    return (
                                        <th key={i} className={clsx(
                                            "p-4 text-xs font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 whitespace-nowrap",
                                            isCenter ? "text-center" : "text-left"
                                        )}>
                                            {headers[i]}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={activeColumnIndices.length + 1} className="p-12 text-center text-slate-500 italic">
                                        {timeFilter ? `Không có dữ liệu cho thời gian này.` : `Không tìm thấy dữ liệu phù hợp.`}
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-white/60 dark:hover:bg-indigo-500/10 even:bg-white/30 dark:even:bg-white/[0.02] transition-colors group text-[14px] leading-relaxed border-b border-white/40 dark:border-white/5">
                                        <td className="p-3 text-center sticky left-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-indigo-50 dark:border-white/5 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                            <button
                                                onClick={() => setSelectedDetail({ row, headers })}
                                                className="p-2 hover:bg-indigo-500/30 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors"
                                                title="Xem chi tiết"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                        {activeColumnIndices.map(cIdx => {
                                            if (cIdx === 0) return null; // Skip Metadata

                                            // HACK: Hide first 2 columns (index 1 & 2) for Year 2026 as per user request
                                            if (selectedYear === 2026 && (cIdx === 1 || cIdx === 2)) return null;

                                            const h = headers[cIdx].toLowerCase();
                                            // Additional HACK: Hide specific long header column
                                            if (selectedYear === 2026 && h.includes('đây là thông tin khác')) return null;

                                            const isCenter = h.includes('stt') || h.includes('thứ') || h.includes('ngày') || h.includes('giờ');
                                            const isContent = h.includes('nội dung') || h.includes('chi tiết') || h.includes('thông điệp');

                                            let widthClass = "min-w-[140px] max-w-[250px]";
                                            if (isCenter) widthClass = "w-[80px] min-w-[80px]";
                                            if (isContent) widthClass = "min-w-[300px] max-w-[500px] text-slate-900 dark:text-white font-medium";

                                            return (
                                                <td
                                                    key={cIdx}
                                                    className={clsx(
                                                        "p-4 border-r border-slate-200 dark:border-white/5 last:border-0 cursor-pointer relative text-slate-700 dark:text-slate-200",
                                                        widthClass,
                                                        isCenter ? "text-center" : "text-left"
                                                    )}
                                                    onMouseEnter={(e) => handleMouseEnter(e, row[cIdx])}
                                                    onMouseMove={handleMouseMove}
                                                    onMouseLeave={handleMouseLeave}
                                                >
                                                    <div className={clsx("line-clamp-2", isCenter && "font-mono text-slate-500 dark:text-slate-400")}>{row[cIdx]}</div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </motion.div>
    );

    // Helper: Render Timeline
    const renderTimeline = () => {
        // Group by Date
        const groupedData = useMemo(() => {
            if (dateColIndex === -1) return [];
            const groups: { date: string, items: string[][] }[] = [];
            let currentGroup: { date: string, items: string[][] } | null = null;

            processedData.forEach(row => {
                const dateVal = row[dateColIndex];
                if (!currentGroup || currentGroup.date !== dateVal) {
                    currentGroup = { date: dateVal, items: [] };
                    groups.push(currentGroup);
                }
                currentGroup.items.push(row);
            });

            // Sort groups based on user preference
            groups.sort((a, b) => {
                const dateA = getRowDate(a.items[0])?.getTime() || 0;
                const dateB = getRowDate(b.items[0])?.getTime() || 0;
                // Desc: Newest first (largest timestamp first). Asc: Oldest first
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            });

            return groups;
        }, [processedData, dateColIndex, sortOrder]);

        if (loading) return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-2"></div>
                <div>Đang tải timeline...</div>
            </div>
        );

        if (processedData.length === 0) return (
            <div className="p-12 text-center text-slate-500 italic border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50">
                {timeFilter ? `Không có thông điệp nào trong khoảng thời gian này.` : `Không có dữ liệu.`}
            </div>
        );

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
                {groupedData.map((group, gIdx) => {
                    const dateObj = getRowDate(group.items[0]);
                    const now = new Date();
                    const diff = dateObj ? now.getTime() - dateObj.getTime() : -1;

                    let timeTag = '';
                    if (diff > 0) {
                        if (diff < 86400000) timeTag = 'Hôm nay';
                        else if (diff < 172800000) timeTag = 'Hôm qua';
                    }

                    const dayName = dateObj ? (dateObj.getDay() === 0 ? 'Chủ Nhật' : `Thứ ${dateObj.getDay() + 1}`) : group.date.split(/[\/-]/)[0];
                    const monthName = dateObj ? `Tháng ${dateObj.getMonth() + 1}` : (group.date.split(/[\/-]/)[1] ? `Tháng ${group.date.split(/[\/-]/)[1]}` : 'Tháng --');
                    const fullDate = dateObj ? `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}` : group.date;

                    const displayDay = (timeTag === 'Hôm nay' || timeTag === 'Hôm qua') ? timeTag : dayName;
                    const secondaryTag = (timeTag && timeTag !== 'Hôm nay' && timeTag !== 'Hôm qua') ? timeTag : null;


                    return (
                        <div key={gIdx} className="relative flex flex-col md:flex-row gap-8">
                            {/* Date Header: Fixed Width on Desktop, Block on Mobile */}
                            <div className="md:w-48 text-left md:text-right flex-shrink-0 relative z-0 md:z-10">
                                <div className="md:sticky md:top-24 inline-flex flex-col items-start md:items-end bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-2 rounded-xl">
                                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                                        {monthName}
                                    </span>
                                    <span className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400 leading-tight">
                                        {displayDay}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500 mt-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-slate-200 dark:border-white/5">
                                        {secondaryTag && <span className="text-indigo-600 dark:text-indigo-400 font-bold">{secondaryTag}</span>}
                                        {secondaryTag && <span className="opacity-40 select-none">•</span>}
                                        {fullDate}
                                    </span>
                                </div>
                            </div>

                            {/* Timeline Line (Absolute relative to the flex container) */}
                            <div className="absolute left-6 md:left-[13rem] top-2 bottom-0 w-px bg-gradient-to-b from-indigo-500 via-indigo-200 to-transparent dark:from-indigo-400 dark:via-indigo-900 dark:to-transparent z-0 hidden md:block"></div>

                            {/* Items Container */}
                            <div className="flex-1 space-y-6 min-w-0">
                                {group.items.map((row, rIdx) => {
                                    const time = colIndices.time !== -1 ? row[colIndices.time] : '';
                                    const pic = colIndices.pic !== -1 ? row[colIndices.pic] : '';

                                    // Render separate cards for Direct / Indirect / Unconfirmed if they have data
                                    const variants = [
                                        { type: 'direct', config: colIndices.direct, color: 'emerald', label: 'Trực tiếp' },
                                        { type: 'indirect', config: colIndices.indirect, color: 'indigo', label: 'Gián tiếp' },
                                        { type: 'unconfirmed', config: colIndices.unconfirmed, color: 'amber', label: 'Chưa xác nhận' }
                                    ] as const;

                                    // Gather valid cards from this row
                                    const validCards = variants.filter(v => {
                                        // 1. Filter Check: If specific badge filter is active, only allow that type
                                        if (filterStatus !== 'all' && filterStatus !== 'order' && v.type !== filterStatus) {
                                            return false;
                                        }

                                        // 2. Content Check: Check if any FIELD in this variant has content
                                        const hasError = v.config.error !== -1 && row[v.config.error]?.trim();
                                        const hasOther = v.config.other !== -1 && row[v.config.other]?.trim();
                                        const hasForward = v.config.forward !== -1 && row[v.config.forward]?.trim();
                                        return hasError || hasOther || hasForward;
                                    });

                                    // Fallback for 2025 legacy data (Active if no strict 2026 matches)
                                    let finalCards: any[] = validCards;
                                    if (finalCards.length === 0 && !colIndices.is2026) {
                                        // Try legacy logic
                                        const content = row[colIndices.directContentColIndex] || row[colIndices.indirectContentColIndex] || row[colIndices.unconfirmedContentColIndex] || row[colIndices.generalContentColIndex];
                                        if (content && content.trim() !== '') {
                                            // Auto-detect type
                                            let type = 'general';
                                            let color = 'indigo';
                                            if (row[colIndices.directContentColIndex]) { type = 'direct'; color = 'emerald'; }
                                            else if (row[colIndices.indirectContentColIndex]) { type = 'indirect'; color = 'blue'; }
                                            else if (row[colIndices.unconfirmedContentColIndex]) { type = 'unconfirmed'; color = 'amber'; }

                                            // Push a "Fake" config for legacy rendering
                                            finalCards.push({
                                                type, color,
                                                label: type.toUpperCase(),
                                                legacyContent: content
                                            });
                                        }
                                    }

                                    if (finalCards.length === 0) return null;

                                    // const itemIdBase = `${gIdx}-${rIdx}`;

                                    return (
                                        <div key={rIdx} className="space-y-4">
                                            {finalCards.map((card, cIdx) => {

                                                const isExpanded = true; // expandedItems[itemId] !== false;
                                                // Let's default to collapsed to save space, but user said "visualize like image". Image shows content.

                                                // Check fields content
                                                const errorContent = !card.legacyContent && card.config.error !== -1 ? row[card.config.error] : '';
                                                const otherContent = !card.legacyContent && card.config.other !== -1 ? row[card.config.other] : '';
                                                const forwardContent = !card.legacyContent && card.config.forward !== -1 ? row[card.config.forward] : '';
                                                const contentToDisplay = card.legacyContent || errorContent || otherContent || forwardContent;

                                                // Footer Data (Order/Deadline) - Attach to ALL cards? Or just first? 
                                                // Attach to all for completeness.
                                                const hasOrder = (colIndices.order.issue !== -1 && row[colIndices.order.issue]?.trim()) || (colIndices.order.title !== -1 && row[colIndices.order.title]?.trim());
                                                const hasDeadline = (colIndices.deadline.received !== -1 && row[colIndices.deadline.received]?.trim()) || (colIndices.deadline.title !== -1 && row[colIndices.deadline.title]?.trim());

                                                return (
                                                    <div key={cIdx} className="relative group">
                                                        {/* Dot */}
                                                        <div className={clsx(
                                                            "absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 shadow-md z-0 transition-transform",
                                                            `bg-${card.color}-500 border-white dark:border-slate-900`,
                                                            isExpanded && "scale-125"
                                                        )}></div>

                                                        <div className={clsx(
                                                            "backdrop-blur-sm border rounded-xl p-4 shadow-sm hover:shadow-lg transition-all relative overflow-hidden ml-4 sm:ml-5 md:ml-8",
                                                            `bg-${card.color}-50/50 dark:bg-${card.color}-900/10 border-${card.color}-100 dark:border-${card.color}-500/20 hover:border-${card.color}-300 dark:hover:border-${card.color}-400/50`
                                                        )}>
                                                            {/* Header: Time & PIC & Type Badge */}
                                                            {/* Header: Time & PIC & Label */}
                                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-black/5 dark:border-white/5">
                                                                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                                                                    {time && (
                                                                        <span className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg shadow-sm" style={{ backgroundColor: '#eef2ff', color: '#0061fe' }}>
                                                                            {time}
                                                                        </span>
                                                                    )}

                                                                    {/* LEAD & RELATED */}
                                                                    {(pic || (colIndices.is2026 && colIndices.related !== -1 && row[colIndices.related])) && (
                                                                        <div className="flex items-center gap-2 text-sm font-medium">
                                                                            {pic && (
                                                                                <span className="px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 font-bold whitespace-nowrap" style={{ backgroundColor: '#fff1e3', color: '#f15a24' }}>
                                                                                    {pic}
                                                                                </span>
                                                                            )}

                                                                            {pic && (colIndices.is2026 && colIndices.related !== -1 && row[colIndices.related]) && (
                                                                                <RefreshCcw size={14} style={{ color: '#f15a24' }} className="shrink-0" />
                                                                            )}

                                                                            {(colIndices.is2026 && colIndices.related !== -1 && row[colIndices.related]) && (
                                                                                <span className="px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 font-bold whitespace-nowrap" style={{ backgroundColor: '#f3fcf9', color: '#10b981' }}>
                                                                                    {row[colIndices.related]}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Label / Expand Affordance */}
                                                                <div className="flex items-center gap-2 ml-auto">
                                                                    <span className={clsx("hidden lg:inline-block text-[10px] sm:text-xs font-bold px-2 py-1 rounded uppercase tracking-wider", `bg-${card.color}-100 text-${card.color}-700 dark:bg-${card.color}-500/20 dark:text-${card.color}-300`)}>
                                                                        {card.label}
                                                                    </span>
                                                                    {/* Hidden "Nhấn để xem" as per request */}
                                                                </div>
                                                            </div>

                                                            {/* BODY: Sections */}
                                                            <div className="space-y-4 mb-2 break-words">
                                                                {card.legacyContent ? (
                                                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">{contentToDisplay}</div>
                                                                ) : (
                                                                    <>
                                                                        {(() => {
                                                                            // Helper to confirm if text is purely a URL
                                                                            const isUrl = (text: string) => /^(http|https):\/\/[^ "]+$/.test(text);

                                                                            const renderContentWithLinks = (content: string) => {
                                                                                if (!content) return null;

                                                                                // Split by whitespace to check for standalone URLs
                                                                                const parts = content.split(/(\s+)/);

                                                                                return parts.map((part, i) => {
                                                                                    if (isUrl(part)) {
                                                                                        // 1. Check for Google Drive / Docs / Sheets
                                                                                        if (part.includes('drive.google.com') || part.includes('docs.google.com')) {
                                                                                            return (
                                                                                                <span key={i} className="inline-block align-middle mx-1">
                                                                                                    <button
                                                                                                        onClick={(e) => {
                                                                                                            e.preventDefault();
                                                                                                            e.stopPropagation();
                                                                                                            // Convert to preview URL
                                                                                                            let previewUrl = part;
                                                                                                            if (part.includes('/view')) previewUrl = part.replace('/view', '/preview');
                                                                                                            else if (part.includes('/edit')) previewUrl = part.replace('/edit', '/preview');
                                                                                                            else if (!part.includes('/preview')) previewUrl = `${part}/preview`;

                                                                                                            setPreviewDocUrl(previewUrl);
                                                                                                        }}
                                                                                                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/30 inline-flex items-center gap-1.5 text-xs transition-all hover:shadow-sm"
                                                                                                    >
                                                                                                        <Eye size={12} />
                                                                                                        Xem tài liệu
                                                                                                    </button>
                                                                                                </span>
                                                                                            );
                                                                                        }

                                                                                        // 2. Check for Generic Documents (PDF, Office)
                                                                                        if (/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i.test(part)) {
                                                                                            return (
                                                                                                <span key={i} className="inline-block align-middle mx-1">
                                                                                                    <button
                                                                                                        onClick={(e) => {
                                                                                                            e.preventDefault();
                                                                                                            e.stopPropagation();
                                                                                                            // Use Google Docs Viewer for external files
                                                                                                            setPreviewDocUrl(`https://docs.google.com/gview?url=${encodeURIComponent(part)}&embedded=true`);
                                                                                                        }}
                                                                                                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/30 inline-flex items-center gap-1.5 text-xs transition-all hover:shadow-sm"
                                                                                                    >
                                                                                                        <FileText size={12} />
                                                                                                        Xem tài liệu
                                                                                                    </button>
                                                                                                </span>
                                                                                            );
                                                                                        }

                                                                                        // 3. Image URL
                                                                                        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(part)) {
                                                                                            return (
                                                                                                <div key={i} className="my-2 block">
                                                                                                    <a href={part} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                                                                                        <img src={part} alt="Attachment" className="max-h-48 rounded border border-slate-200 dark:border-slate-700 shadow-sm hover:opacity-90 transition-opacity" />
                                                                                                    </a>
                                                                                                </div>
                                                                                            );
                                                                                        }

                                                                                        // 4. Normal Link
                                                                                        return (
                                                                                            <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline break-all" onClick={e => e.stopPropagation()}>
                                                                                                {part}
                                                                                            </a>
                                                                                        );
                                                                                    }
                                                                                    return part;
                                                                                });
                                                                            };

                                                                            return (
                                                                                <>
                                                                                    {(errorContent?.trim() || otherContent?.trim() || forwardContent?.trim()) && (
                                                                                        <div
                                                                                            className="w-full rounded-2xl p-4 sm:p-5 shadow-sm space-y-2 mt-2 break-words"
                                                                                            style={{
                                                                                                backgroundColor: card.color === 'emerald' ? '#f3fcf9' : card.color === 'indigo' ? '#eef2ff' : '#fffbeb',
                                                                                                color: card.color === 'emerald' ? '#10b981' : card.color === 'indigo' ? '#3730a3' : '#b45309'
                                                                                            }}
                                                                                        >
                                                                                            <h4 className="font-bold mb-3 text-sm sm:text-base">Thông điệp điều hành {card.label.toLowerCase()}:</h4>
                                                                                            <ul className="space-y-2 text-sm list-disc pl-5 opacity-90 font-medium whitespace-pre-wrap break-words">
                                                                                                {errorContent?.trim() && <li><span className="font-bold">Lỗi:</span> {renderContentWithLinks(errorContent)}</li>}
                                                                                                {otherContent?.trim() && <li><span className="font-bold">Khác:</span> {renderContentWithLinks(otherContent)}</li>}
                                                                                                {forwardContent?.trim() && <li><span className="font-bold">Chuyển tiếp:</span> {renderContentWithLinks(forwardContent)}</li>}
                                                                                            </ul>
                                                                                        </div>
                                                                                    )}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* FOOTER: Order & Deadline */}
                                                            {((hasOrder || hasDeadline) && colIndices.is2026) && (
                                                                <div className="mt-4">
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                                                        {/* Order Section */}
                                                                        {hasOrder && (
                                                                            <div className="rounded-2xl p-4 sm:p-5 shadow-sm" style={{ backgroundColor: '#fff3ff', color: '#93278f' }}>
                                                                                {row[colIndices.order.title]?.trim() && (
                                                                                    <div className="mb-3 font-bold text-sm sm:text-base">
                                                                                        Đơn hàng: <span className="font-semibold opacity-90">{row[colIndices.order.title]}</span>
                                                                                    </div>
                                                                                )}
                                                                                <ul className="space-y-2 text-sm list-disc pl-5 opacity-90 font-medium">
                                                                                    {row[colIndices.order.issue]?.trim() && <li><span className="font-bold">Vấn đề:</span> {row[colIndices.order.issue]}</li>}
                                                                                    {row[colIndices.order.cause]?.trim() && <li><span className="font-bold">Nguyên nhân:</span> {row[colIndices.order.cause]}</li>}
                                                                                    {row[colIndices.order.solution]?.trim() && <li><span className="font-bold">Giải pháp:</span> {row[colIndices.order.solution]}</li>}
                                                                                    {row[colIndices.order.purpose]?.trim() && <li><span className="font-bold">Để làm gì:</span> {row[colIndices.order.purpose]}</li>}
                                                                                </ul>
                                                                            </div>
                                                                        )}

                                                                        {/* Deadline Section */}
                                                                        {hasDeadline && (
                                                                            <div className="rounded-2xl p-4 sm:p-5 shadow-sm" style={{ backgroundColor: '#fff3ff', color: '#93278f' }}>
                                                                                {row[colIndices.deadline.title]?.trim() && (
                                                                                    <div className="mb-3 font-bold text-sm sm:text-base">
                                                                                        Deadline: <span className="font-semibold opacity-90">{row[colIndices.deadline.title]}</span>
                                                                                    </div>
                                                                                )}
                                                                                <ul className="space-y-2 text-sm list-disc pl-5 opacity-90 font-medium">
                                                                                    {row[colIndices.deadline.received]?.trim() && <li><span className="font-bold">Đã tiếp nhận:</span> {row[colIndices.deadline.received]}</li>}
                                                                                    {row[colIndices.deadline.processing]?.trim() && <li><span className="font-bold">Đang xử lý:</span> {row[colIndices.deadline.processing]}</li>}
                                                                                    {row[colIndices.deadline.completed]?.trim() && <li><span className="font-bold">Hoàn thành:</span> {row[colIndices.deadline.completed]}</li>}
                                                                                    {row[colIndices.deadline.overdue]?.trim() && <li><span className="font-bold">Trễ hạn:</span> {row[colIndices.deadline.overdue]}</li>}
                                                                                    {row[colIndices.deadline.note]?.trim() && <li><span className="font-bold">Ghi chú:</span> {row[colIndices.deadline.note]}</li>}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })
                }
            </div >
        );
    };

    const fullScreenView = isFullScreen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl flex overflow-hidden">
            <div className="w-80 bg-white dark:bg-slate-900/50 border-r border-slate-200 dark:border-white/10 p-6 flex flex-col gap-4 overflow-y-auto">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="text-indigo-600 dark:text-indigo-400" />
                    Điều Hành
                </h2>
                {renderDesktopTimeFilter()}
            </div>
            <div className="flex-1 flex flex-col p-6 gap-6 min-w-0">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chế độ Toàn màn hình</h1>
                    {renderToolbar(true)}
                </div>
                {/* Dynamically render content based on viewMode */}
                <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-200 dark:border-white/5 p-6">
                    {viewMode === 'timeline' ? renderTimeline() : renderTable(true)}
                </div>
            </div>
        </div>,
        document.body
    );

    return (
        <div className="flex flex-col gap-6 p-2 pb-20">
            {/* 1. Hero Banner (Top Frame) */}
            {activeTab === 'dashboard' && (
                <HeroBanner
                    icon={BarChart3}
                    title="Thông điệp điều hành"
                    subtitle="Executive Dashboard"
                    description="Hệ thống theo dõi chỉ đạo và kết luận cuộc họp, tự động cập nhật và phân tích dữ liệu từ Google Sheets & Supabase theo thời gian thực."
                    badge="Directive Management"
                    badgeIcon={Sparkles}
                    secondBadge={dataSource === 'sheet' ? 'Live Sheet' : undefined}
                    stats={[
                        { icon: FileText, label: 'Thông điệp', value: totalDirectIndirect, color: 'from-blue-400 to-indigo-500' },
                        { icon: Users, label: 'Đầu mối', value: chartData.length, color: 'from-emerald-400 to-green-500' },
                        { icon: Clock, label: 'Cập nhật', value: lastUpdated ? lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--', color: 'from-purple-400 to-pink-500' },
                    ]}
                    gradientFrom="from-violet-600"
                    gradientVia="via-indigo-600"
                    gradientTo="to-blue-600"
                    accentColor="indigo"
                />
            )}

            {/* Top Section: Sidebar + Main Stats */}
            <div className="flex flex-col lg:flex-row gap-4">
                {/* Sidebar Navigation */}
                <div className="w-full lg:w-64 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-white/5 rounded-2xl p-4 flex flex-col gap-2 shrink-0 no-scrollbar shadow-xl">
                    <div className="mb-4 lg:mb-6 px-2 flex justify-between lg:block items-center">
                        <div>
                            <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-600 dark:from-indigo-400 dark:to-cyan-400 flex items-center gap-2">
                                <BarChart3 className="text-indigo-500" />
                                ĐIỀU HÀNH
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Executive Directives</p>
                        </div>
                    </div>

                    <nav className="space-y-1 grid grid-cols-2 lg:block gap-2 lg:gap-0">
                        <button onClick={() => setActiveTab('dashboard')} className={clsx("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all", activeTab === 'dashboard' ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-indigo-600")}>
                            <LayoutDashboard size={18} /> Dashboard
                        </button>
                        {/* HIDDEN PLAN BUTTON
                        <button onClick={() => setActiveTab('plan')} className={clsx("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all", activeTab === 'plan' ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-indigo-600")}>
                            <FileText size={18} /> Kế hoạch
                        </button>
                        */}
                    </nav>

                    {/* Date Filter Panel */}
                    {activeTab === 'dashboard' && (
                        <div className="mt-2 pt-4 border-t border-indigo-100/50 dark:border-white/5">
                            {renderDesktopTimeFilter()}
                            {renderMobileTimeFilter()}
                        </div>
                    )}
                </div>

                {/* Main Content (Charts & Toolbar) */}
                <div className="flex-1 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-white/5 rounded-2xl shadow-xl p-4 relative">
                    {activeTab === 'dashboard' && (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="max-w-7xl mx-auto flex flex-col gap-6"
                        >

                            {/* 1. Hero Banner: REMOVED */}

                            {/* 2. Action Toolbar: MOVED TO TIMELINE HEADER */}


                            {/* Chart Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                {/* Subject Chart */}
                                <motion.div variants={itemVariants} className="lg:col-span-2 flex flex-col justify-center bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-white/50 dark:border-white/5 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-400 uppercase mb-4 flex items-center gap-2">
                                        <BarChart3 size={16} /> Thống kê theo Chủ thể
                                    </h3>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} horizontal={false} />
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} interval={0} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                                                    itemStyle={{ color: '#f1f5f9' }}
                                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                />
                                                <Bar
                                                    dataKey="count"
                                                    name="Số lượng"
                                                    radius={[0, 4, 4, 0]}
                                                    barSize={20}
                                                >
                                                    {chartData.map((_entry, index) => {
                                                        const PASTEL_COLORS = [
                                                            '#ff6b6b', '#ffa502', '#f6e58d', '#badc58', '#6ab04c',
                                                            '#7ed6df', '#22a6b3', '#686de0', '#be2edd', '#ff7979'
                                                        ];
                                                        return <Cell key={`cell-${index}`} fill={PASTEL_COLORS[index % PASTEL_COLORS.length]} />;
                                                    })}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </motion.div>

                                {/* Type Stats Chart */}
                                <motion.div variants={itemVariants} className="lg:col-span-1 flex flex-col justify-center bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-white/50 dark:border-white/5 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-400 uppercase mb-4 flex items-center gap-2">
                                        <Sparkles size={16} /> Phân loại Thông điệp
                                    </h3>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={typeStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                <defs>
                                                    <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.9} />
                                                        <stop offset="95%" stopColor="#059669" stopOpacity={0.9} />
                                                    </linearGradient>
                                                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.9} />
                                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.9} />
                                                    </linearGradient>
                                                    <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.9} />
                                                        <stop offset="95%" stopColor="#d97706" stopOpacity={0.9} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
                                                <YAxis hide />
                                                <Bar dataKey="count" name="Số lượng" radius={[6, 6, 0, 0]} barSize={40} isAnimationActive={false}>
                                                    {typeStats.map((_entry, index) => {
                                                        const fills = ['url(#emeraldGradient)', 'url(#blueGradient)', 'url(#amberGradient)'];
                                                        return <Cell key={`cell-${index}`} fill={fills[index % 3]} />;
                                                    })}
                                                </Bar>
                                                <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} isAnimationActive={false}>
                                                    <LabelList dataKey="count" position="top" offset={10} style={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                                                </Line>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </motion.div>

                            </div>


                            {/* Toolbar: Search */}
                            {/* Toolbar: Search (Removed) */}

                            {/* Data View - Only Table here, Timeline moved to bottom */}
                            {viewMode === 'table' && renderTable(false)}

                            {/* Full Screen Portal */}
                            {fullScreenView}

                            {/* Tooltip Portal */}
                            {hoverTooltip && createPortal(
                                <div
                                    className="fixed z-[10000] p-4 bg-slate-900 border border-white/10 shadow-2xl rounded-xl text-sm text-slate-200 pointer-events-none max-w-sm backdrop-blur-md"
                                    style={{
                                        top: hoverTooltip.y + 10,
                                        left: hoverTooltip.x + 10,
                                    }}
                                >
                                    {hoverTooltip.content}
                                </div>,
                                document.body
                            )}

                        </motion.div>
                    )}

                    {
                        activeTab === 'plan' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Thông điệp điều hành - Kế hoạch</h1>
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Ứng dụng thống kê và theo dõi chỉ đạo từ Ban lãnh đạo, tích hợp AI để phân loại và nhắc việc.
                                    </p>
                                </div>
                                <div className="grid gap-8">
                                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm dark:shadow-none">
                                        <h3 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mb-4 flex items-center gap-2">
                                            <Database size={20} /> 1. Phân tích dữ liệu
                                        </h3>
                                        <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                                            <li className="flex gap-2">
                                                <Clock size={16} className="text-slate-400 shrink-0 mt-0.5" />
                                                <span><strong>Thời gian:</strong> Thứ, Ngày, Giờ (Theo dõi tiến độ realtime).</span>
                                            </li>
                                            <li className="flex gap-2">
                                                <Users size={16} className="text-slate-400 shrink-0 mt-0.5" />
                                                <span><strong>Nhân sự:</strong> Người điều hành & Người liên quan.</span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm dark:shadow-none">
                                        <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
                                            <Calendar size={20} /> 2. Lộ trình triển khai
                                        </h3>
                                        <div className="space-y-4">
                                            {REQUIREMENTS.map((req, idx) => (
                                                <div key={idx} className="flex gap-4">
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-white/10 flex items-center justify-center text-xs font-bold font-mono text-slate-700 dark:text-white">
                                                            {idx + 1}
                                                        </div>
                                                        {idx < REQUIREMENTS.length - 1 && <div className="w-px h-full bg-slate-200 dark:bg-white/10 my-1" />}
                                                    </div>
                                                    <div className="pb-4">
                                                        <h4 className="font-bold text-slate-900 dark:text-white">{req.phase}</h4>
                                                        <ul className="mt-2 text-sm text-slate-500 dark:text-slate-400 space-y-1">
                                                            {req.items.map((item, i) => (
                                                                <li key={i} className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" />
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    }
                </div >

                {/* Modal Detail Portal */}
                <AnimatePresence>
                    {
                        selectedDetail && (
                            <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDetail(null)}>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    onClick={e => e.stopPropagation()}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                                >
                                    <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-white/10">
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <FileText className="text-indigo-600 dark:text-indigo-400" /> Chi tiết Thông điệp
                                        </h2>
                                        <button onClick={() => setSelectedDetail(null)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                                            <X size={24} />
                                        </button>
                                    </div>
                                    <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                                        {selectedDetail.headers.map((header, i) => {
                                            const value = selectedDetail.row[i];
                                            if (!value || String(value).trim() === '') return null;

                                            const lowerHeader = header.toLowerCase();
                                            // Filter out metadata that is usually redundant in detail view
                                            if (lowerHeader.includes('stt') || lowerHeader === '#' || lowerHeader.includes('thứ') || lowerHeader.includes('người liên quan')) return null;

                                            // Determine Color Scheme based on Header
                                            let colorClass = "bg-indigo-500"; // Default
                                            let bgClass = "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5";

                                            if (lowerHeader.includes('trực tiếp')) {
                                                colorClass = "bg-emerald-500";
                                                bgClass = "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-500/20";
                                            } else if (lowerHeader.includes('gián tiếp')) {
                                                colorClass = "bg-blue-500";
                                                bgClass = "bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-500/20";
                                            } else if (lowerHeader.includes('khác') || lowerHeader.includes('chưa xác nhận')) {
                                                colorClass = "bg-amber-500";
                                                bgClass = "bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-500/20";
                                            }

                                            return (
                                                <div key={i} className="space-y-2">
                                                    <label className="text-xs uppercase font-bold text-slate-500 tracking-wider flex items-center gap-2">
                                                        <div className={`w-1 h-3 rounded-full ${colorClass}`}></div>
                                                        {header}
                                                    </label>
                                                    <div className={`rounded-lg p-4 text-slate-700 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap border ${bgClass}`}>
                                                        {value}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="p-6 border-t border-slate-200 dark:border-white/10 flex justify-end">
                                        <button onClick={() => setSelectedDetail(null)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors">
                                            Đóng
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )
                    }
                </AnimatePresence >
            </div>

            {/* Bottom Section: Timeline (Separate Frame) */}
            {activeTab === 'dashboard' && viewMode === 'timeline' && (
                <>
                    {/* Sticky Header - outside motion.div for true flush sticking */}
                    <div className="px-6 py-4 border-b border-indigo-100 dark:border-white/5 bg-white dark:bg-slate-900 flex flex-col xl:flex-row justify-between items-center sticky top-0 z-20 gap-4 rounded-t-xl shadow-sm backdrop-blur-md">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 w-full xl:w-auto">
                            <div className="flex flex-col gap-0.5 sm:gap-1">
                                <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg uppercase tracking-wider">
                                    <Clock size={18} className="text-indigo-500 shrink-0" /> <span className="line-clamp-1">Dòng sự kiện</span>
                                </h3>
                                <div className="text-[10px] sm:text-xs text-slate-500 font-medium ml-5 sm:ml-7">
                                    Hiển thị {processedData.length} sự kiện
                                </div>
                            </div>

                            <button
                                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                className="ml-5 sm:ml-0 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm shrink-0"
                                title="Đảo chiều trình tự thời gian"
                            >
                                <ArrowLeftRight size={14} className="rotate-90 text-indigo-500" />
                                {sortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước'}
                            </button>
                        </div>

                        {/* Integrated Toolbar */}
                        <div className="flex flex-col xl:flex-row items-center gap-3 sm:gap-4 w-full xl:w-auto">
                            {/* Filter Buttons - Modern & Responsive - Mobile Optimized */}
                            <div className="flex flex-nowrap sm:flex-wrap justify-start items-center gap-2 w-full sm:w-auto overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 px-1 pr-12 sm:pr-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] scroll-smooth snap-x">
                                {/* Button: Direct */}
                                <button
                                    onClick={() => setFilterStatus(prev => prev === 'direct' ? 'all' : 'direct')}
                                    className={clsx(
                                        "relative group flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border transition-all duration-300 outline-none select-none snap-start whitespace-nowrap",
                                        "text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                                        filterStatus === 'direct'
                                            ? "bg-emerald-600 text-white border-emerald-600 shadow-md sm:shadow-lg shadow-emerald-500/30 scale-100 sm:scale-105"
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-sm sm:hover:shadow-md hover:-translate-y-0.5 text-slate-500 dark:text-slate-400"
                                    )}
                                >
                                    <div className={clsx("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-300", filterStatus === 'direct' ? "bg-white animate-pulse" : "bg-emerald-500")}></div>
                                    <span className={clsx("transition-colors", filterStatus === 'direct' ? "text-white" : "text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400")}>Trực tiếp</span>
                                    {filterStatus === 'direct' && <div className="absolute inset-x-0 top-0 h-[50%] bg-gradient-to-b from-white/20 to-transparent rounded-t-full pointer-events-none" />}
                                </button>

                                {/* Button: Indirect */}
                                <button
                                    onClick={() => setFilterStatus(prev => prev === 'indirect' ? 'all' : 'indirect')}
                                    className={clsx(
                                        "relative group flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border transition-all duration-300 outline-none select-none snap-start whitespace-nowrap",
                                        "text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                                        filterStatus === 'indirect'
                                            ? "bg-blue-600 text-white border-blue-600 shadow-md sm:shadow-lg shadow-blue-500/30 scale-100 sm:scale-105"
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-sm sm:hover:shadow-md hover:-translate-y-0.5 text-slate-500 dark:text-slate-400"
                                    )}
                                >
                                    <div className={clsx("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-300", filterStatus === 'indirect' ? "bg-white animate-pulse" : "bg-blue-500")}></div>
                                    <span className={clsx("transition-colors", filterStatus === 'indirect' ? "text-white" : "text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400")}>Gián tiếp</span>
                                    {filterStatus === 'indirect' && <div className="absolute inset-x-0 top-0 h-[50%] bg-gradient-to-b from-white/20 to-transparent rounded-t-full pointer-events-none" />}
                                </button>

                                {/* Button: Unconfirmed */}
                                <button
                                    onClick={() => setFilterStatus(prev => prev === 'unconfirmed' ? 'all' : 'unconfirmed')}
                                    className={clsx(
                                        "relative group flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border transition-all duration-300 outline-none select-none snap-start whitespace-nowrap",
                                        "text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                                        filterStatus === 'unconfirmed'
                                            ? "bg-amber-500 text-white border-amber-500 shadow-md sm:shadow-lg shadow-amber-500/30 scale-100 sm:scale-105"
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-sm sm:hover:shadow-md hover:-translate-y-0.5 text-slate-500 dark:text-slate-400"
                                    )}
                                >
                                    <div className={clsx("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-300", filterStatus === 'unconfirmed' ? "bg-white animate-pulse" : "bg-amber-500")}></div>
                                    <span className={clsx("transition-colors", filterStatus === 'unconfirmed' ? "text-white" : "text-slate-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400")}>Chưa xác nhận</span>
                                    {filterStatus === 'unconfirmed' && <div className="absolute inset-x-0 top-0 h-[50%] bg-gradient-to-b from-white/20 to-transparent rounded-t-full pointer-events-none" />}
                                </button>

                                {/* Button: Order */}
                                <button
                                    onClick={() => setFilterStatus(prev => prev === 'order' ? 'all' : 'order')}
                                    className={clsx(
                                        "relative group flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border transition-all duration-300 outline-none select-none snap-start whitespace-nowrap",
                                        "text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                                        filterStatus === 'order'
                                            ? "bg-pink-600 text-white border-pink-600 shadow-md sm:shadow-lg shadow-pink-500/30 scale-100 sm:scale-105"
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-pink-300 dark:hover:border-pink-500/50 hover:shadow-sm sm:hover:shadow-md hover:-translate-y-0.5 text-slate-500 dark:text-slate-400"
                                    )}
                                >
                                    <div className={clsx("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-300", filterStatus === 'order' ? "bg-white animate-pulse" : "bg-pink-500")}></div>
                                    <span className={clsx("transition-colors", filterStatus === 'order' ? "text-white" : "text-slate-700 dark:text-slate-300 group-hover:text-pink-600 dark:group-hover:text-pink-400")}>Đơn hàng</span>
                                    {filterStatus === 'order' && <div className="absolute inset-x-0 top-0 h-[50%] bg-gradient-to-b from-white/20 to-transparent rounded-t-full pointer-events-none" />}
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative w-full sm:w-auto flex-1 md:w-64 group">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-inner"
                                />
                            </div>
                        </div>      {/* Actions */}
                        {/* HIDDEN ACTIONS
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => loadData(true)}
                                    disabled={loading}
                                    title="Làm mới dữ liệu"
                                    className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-white/10"
                                >
                                    <Zap size={18} className={loading || isBackgroundUpdating ? "animate-spin text-indigo-500" : "text-slate-400"} />
                                </button>
                                <button
                                    onClick={handleExport}
                                    title="Xuất Excel"
                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 hover:scale-105"
                                >
                                    <Download size={16} /> <span className="hidden sm:inline">Excel</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsFullScreen(!isFullScreen);
                                    }}
                                    title={isFullScreen ? "Thu gọn" : "Toàn màn hình"}
                                    className={clsx(
                                        "p-2 rounded-xl transition-all shadow-md hover:scale-105",
                                        isFullScreen
                                            ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 shadow-slate-500/20"
                                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20"
                                    )}
                                >
                                    {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                            </div>
                            */}
                    </div>

                    {/* Timeline Content Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-white/5 border-t-0 rounded-b-2xl shadow-xl flex flex-col"
                    >
                        <div className="px-6 pb-6 pt-0 bg-slate-50/50 dark:bg-slate-900/20">
                            {renderTimeline()}
                        </div>
                    </motion.div>
                </>
            )
            }
            {/* Scroll To Top Button */}
            {/* DOCUMENT PREVIEW MODAL */}
            <AnimatePresence>
                {previewDocUrl && (
                    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-0 md:p-6 print:hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setPreviewDocUrl(null)}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full md:max-w-6xl h-[100dvh] md:h-[95vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden relative z-10"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-3 md:p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 truncate pr-4">
                                    <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                                    <span className="truncate">Xem tài liệu</span>
                                </h3>
                                <div className="flex items-center gap-2 shrink-0">
                                    {/* Action Buttons */}
                                    <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-1 mr-2 gap-1 print:hidden">
                                        <button
                                            onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500"
                                            title="Thu nhỏ"
                                        >
                                            <ZoomOut size={18} />
                                        </button>
                                        <span className="text-xs font-mono w-12 text-center text-slate-500">{Math.round(zoomLevel * 100)}%</span>
                                        <button
                                            onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500"
                                            title="Phóng to"
                                        >
                                            <ZoomIn size={18} />
                                        </button>
                                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>



                                        <button
                                            onClick={() => window.open(previewDocUrl || '', '_blank')}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500"
                                            title="Tải xuống / Mở gốc"
                                        >
                                            <Download size={18} />
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (!previewDocUrl) return;

                                                // 1. Google Docs/Sheets/Slides - Try to export as PDF (effectively printing)
                                                if (previewDocUrl.includes('docs.google.com') || previewDocUrl.includes('drive.google.com')) {
                                                    let printUrl = previewDocUrl;
                                                    // Replace /view, /edit, /preview with /export?format=pdf
                                                    if (/\/view|\/edit|\/preview/.test(printUrl)) {
                                                        printUrl = printUrl.replace(/\/view.*|\/edit.*|\/preview.*/, '/export?format=pdf');
                                                    } else {
                                                        // Fallback or append if none exists
                                                        printUrl += '/export?format=pdf';
                                                    }
                                                    window.open(printUrl, '_blank');
                                                    return;
                                                }

                                                // 2. Google Docs Viewer (gview) - extracting the actual URL
                                                if (previewDocUrl.includes('docs.google.com/gview')) {
                                                    const urlParams = new URLSearchParams(new URL(previewDocUrl).search);
                                                    const originalUrl = urlParams.get('url');
                                                    if (originalUrl) {
                                                        window.open(originalUrl, '_blank'); // Open the file directly
                                                        return;
                                                    }
                                                }

                                                // 3. Fallback: Open current URL in new tab
                                                window.open(previewDocUrl, '_blank');
                                            }}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500 hidden md:block"
                                            title="In tài liệu (PDF)"
                                        >
                                            <Printer size={18} />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => window.open(previewDocUrl || '', '_blank')}
                                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors hidden sm:flex"
                                        title="Mở trong tab mới"
                                    >
                                        <Maximize2 className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setPreviewDocUrl(null)}
                                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 rounded-lg text-slate-500 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 bg-slate-100 dark:bg-black/50 relative overflow-auto flex items-start justify-start p-0 md:p-4 touch-pan-x touch-pan-y">
                                {isDocLoading && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-slate-900 z-20 pointer-events-none">
                                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-500 mb-4 shadow-sm"></div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">Đang tải tài liệu...</p>
                                    </div>
                                )}

                                {/* Zoom Wrapper Container */}
                                <div
                                    className="relative transition-all duration-200 ease-out origin-top-left"
                                    style={{
                                        width: zoomLevel === 1 ? '100%' : `${zoomLevel * 100}%`,
                                        height: zoomLevel === 1 ? '100%' : `${zoomLevel * 100}%`,
                                        overflow: 'hidden' // Hide internal scrollbars of the scaler, rely on Parent
                                    }}
                                >
                                    <iframe
                                        src={previewDocUrl || ''}
                                        className={clsx("border-0 shadow-sm bg-white", isDocLoading ? 'opacity-0' : 'opacity-100')}
                                        style={{
                                            width: zoomLevel === 1 ? '100%' : `${100 / zoomLevel}%`,
                                            height: zoomLevel === 1 ? '100%' : `${100 / zoomLevel}%`,
                                            transform: zoomLevel === 1 ? 'none' : `scale(${zoomLevel})`,
                                            transformOrigin: 'top left'
                                        }}
                                        allow="autoplay"
                                        title="Document Preview"
                                        onLoad={() => setIsDocLoading(false)}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default ExecutiveDirectives;

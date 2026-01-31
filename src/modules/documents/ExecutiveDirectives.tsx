import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    LayoutDashboard, Database, Zap,
    Clock, Users, FileText,
    BarChart3, Calendar,
    Search, Download, Eye, X, Maximize2, Minimize2
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import * as XLSX from 'xlsx';
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
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<{ row: string[], headers: string[] } | null>(null);

    // Time Filter State
    const [timeFilter, setTimeFilter] = useState<{ type: 'year' | 'quarter' | 'month', value: number } | null>(null);
    // Expand states for Sidebar
    const [expandedYear, setExpandedYear] = useState(true);
    const [expandedQuarters, setExpandedQuarters] = useState<number[]>([1, 2, 3, 4]);

    // Hover Tooltip State
    const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
    const [activeChartIndex, setActiveChartIndex] = useState<number | null>(null);

    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);

    const loadData = async (forceSync = false, background = false) => {
        if (!background) {
            setLoading(true);
            setError(null);
        } else {
            setIsBackgroundUpdating(true);
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
            setIsBackgroundUpdating(false);
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
        return headers.findIndex(h => {
            const lower = h.toLowerCase();
            return lower.includes('ngày') || lower.includes('thời gian') || lower.includes('timeline') || lower.includes('date');
        });
    }, [headers]);

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
        // simple regex for dd/mm/yyyy or d/m/yyyy
        const dmy = cell.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dmy) {
            return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
        }
        // check iso
        const iso = cell.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
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

        // HACK: Hide top 3 rows for Year 2026 (Artifacts/Junk data)
        if (selectedYear === 2026) {
            result = result.slice(3);
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

    // 3. Handlers
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
        <div className="space-y-4 mt-4">
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
                            selectedYear === year ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/20" : "bg-slate-800 text-slate-400 border-white/10"
                        )}
                    >
                        Năm {year}
                    </button>
                ))}
            </div>

            {/* Quarter Selection */}
            <div className="flex overflow-x-auto custom-scrollbar gap-2 pb-1 no-scrollbar border-t border-white/5 pt-2">
                <button
                    onClick={() => setTimeFilter(null)}
                    className={clsx(
                        "px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all flex-shrink-0",
                        !timeFilter ? "bg-indigo-500 text-white border-indigo-400 shadow-md shadow-indigo-500/20" : "bg-slate-800 text-slate-400 border-white/10"
                    )}
                >
                    Tất cả {selectedYear}
                </button>
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
                                    : "bg-slate-800 text-slate-400 border-white/10"
                        )}
                    >
                        Quý {q}
                    </button>
                ))}
            </div>

            {/* Month Selection */}
            {(timeFilter?.type === 'quarter' || timeFilter?.type === 'month') && (
                <div className="flex overflow-x-auto custom-scrollbar gap-2 py-1 border-t border-white/5 pt-2 no-scrollbar">
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
                                            : "bg-slate-800/50 text-slate-400 border-white/5 hover:bg-slate-800"
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
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{filteredData.length} dòng</span>
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

    const fullScreenView = isFullScreen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl flex overflow-hidden">
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
                {renderTable(true)}
            </div>
        </div>,
        document.body
    );

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] bg-gradient-to-br from-indigo-50/50 via-white to-cyan-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 rounded-3xl overflow-hidden border border-white/50 dark:border-white/5 shadow-2xl relative text-slate-900 dark:text-slate-200 p-4 gap-4">
            {/* Sidebar Navigation */}
            <div className="w-full lg:w-64 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-white/5 rounded-2xl p-4 flex flex-col gap-2 shrink-0 lg:h-full lg:overflow-y-auto no-scrollbar shadow-xl">
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
                    <button onClick={() => setActiveTab('plan')} className={clsx("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all", activeTab === 'plan' ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-indigo-600")}>
                        <FileText size={18} /> Kế hoạch
                    </button>
                </nav>

                {/* Date Filter Panel */}
                {activeTab === 'dashboard' && (
                    <div className="mt-2 pt-4 border-t border-indigo-100/50 dark:border-white/5">
                        {renderDesktopTimeFilter()}
                        {renderMobileTimeFilter()}
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent p-0 pr-2">
                {activeTab === 'dashboard' && (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="max-w-7xl mx-auto flex flex-col gap-6"
                    >

                        {/* HERO HEADER */}
                        <motion.div variants={itemVariants} className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-20 w-40 h-40 bg-pink-500/20 rounded-full blur-2xl pointer-events-none"></div>

                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10">
                                            Executive Dashboard
                                        </span>
                                        {dataSource === 'sheet' && (
                                            <span className="bg-emerald-400/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30 text-emerald-100 flex items-center gap-1">
                                                <Zap size={10} className="fill-current" /> Live Sheet
                                            </span>
                                        )}
                                    </div>
                                    <h1 className="text-4xl font-black mb-2 tracking-tight">Văn bản & Kết luận</h1>
                                    <p className="text-indigo-100 opacity-90 max-w-xl text-sm leading-relaxed">
                                        Hệ thống theo dõi chỉ đạo và kết luận cuộc họp, tự động cập nhật và phân tích dữ liệu từ Google Sheets & Supabase theo thời gian thực.
                                    </p>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider mb-1">Cập nhật lần cuối</div>
                                        <div className="font-mono text-xl font-bold">
                                            {lastUpdated ? lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Actions Toolbar */}
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                {/* Optional Left Side Actions */}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => loadData(true)} disabled={loading} className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm border border-slate-200">
                                <Zap size={16} className={loading || isBackgroundUpdating ? "animate-spin text-indigo-500" : "text-slate-400"} />
                                {loading ? "Đang tải..." : isBackgroundUpdating ? "Đang đồng bộ..." : "Làm mới"}
                            </button>
                            <button onClick={handleExport} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/30">
                                <Download size={16} /> Xuất Excel
                            </button>
                        </div>


                        {/* Chart Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Summary Cards */}
                            <motion.div variants={itemVariants} className="lg:col-span-1 flex flex-col gap-4">
                                <div className="flex-1 bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600/40 dark:to-indigo-900/40 rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-blue-500/20 group cursor-pointer transition-transform hover:scale-[1.02]">
                                    <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full blur-2xl -mr-4 -mt-4 pointer-events-none"></div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white shadow-lg"><FileText size={24} /></div>
                                            <span className="bg-white/20 backdrop-blur-md text-[10px] font-bold text-white px-2 py-1 rounded-lg">TOTAL</span>
                                        </div>
                                        <div className="text-4xl font-black text-white mb-1">{filteredData.length}</div>
                                        <div className="text-xs text-blue-100 font-bold uppercase tracking-wider opacity-80">Thông điệp chỉ đạo</div>
                                    </div>
                                </div>
                                <div className="flex-1 bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-600/40 dark:to-teal-900/40 rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-emerald-500/20 group cursor-pointer transition-transform hover:scale-[1.02]">
                                    <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full blur-2xl -mr-4 -mt-4 pointer-events-none"></div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white shadow-lg"><Users size={24} /></div>
                                            <span className="bg-white/20 backdrop-blur-md text-[10px] font-bold text-white px-2 py-1 rounded-lg">ACTIVE</span>
                                        </div>
                                        <div className="text-4xl font-black text-white mb-1">{chartData.length}</div>
                                        <div className="text-xs text-emerald-100 font-bold uppercase tracking-wider opacity-80">Đầu mối phụ trách</div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Chart */}
                            <motion.div variants={itemVariants} className="lg:col-span-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/60 dark:border-white/5 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-center shadow-xl">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-400 uppercase mb-2 flex items-center gap-2 px-2">
                                    <BarChart3 size={16} /> Thống kê theo Chủ thể
                                </h3>
                                <div className="h-[240px] w-full -ml-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} horizontal={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} interval={0} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
                                                itemStyle={{ color: '#f1f5f9' }}
                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            />
                                            <Bar
                                                dataKey="count"
                                                name="Số lượng"
                                                radius={[0, 4, 4, 0]}
                                                barSize={24}
                                                onMouseMove={(state: any) => {
                                                    if (state && state.activeTooltipIndex !== undefined) {
                                                        setActiveChartIndex(state.activeTooltipIndex);
                                                    }
                                                }}
                                                onMouseLeave={() => setActiveChartIndex(null)}
                                            >
                                                {chartData.map((_entry, index) => {
                                                    const PASTEL_COLORS = [
                                                        '#ff6b6b', // Red
                                                        '#ffa502', // Orange
                                                        '#f6e58d', // Yellow
                                                        '#badc58', // Light Green
                                                        '#6ab04c', // Green
                                                        '#7ed6df', // Light Blue
                                                        '#22a6b3', // Teal
                                                        '#686de0', // Blurple
                                                        '#be2edd', // Purple
                                                        '#ff7979'  // Pinkish
                                                    ];
                                                    const color = PASTEL_COLORS[index % PASTEL_COLORS.length];
                                                    const isActive = activeChartIndex === index;

                                                    return (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={color}
                                                            fillOpacity={1}
                                                            stroke="none"
                                                            style={{
                                                                transition: 'all 0.3s ease',
                                                                filter: isActive ? `drop-shadow(0 0 8px ${color})` : 'none',
                                                                cursor: 'pointer'
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </motion.div>
                        </div>

                        {/* Toolbar: Search */}
                        {renderToolbar(false)}

                        {/* Data Table */}
                        {renderTable(false)}

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

                                        return (
                                            <div key={i} className="space-y-2">
                                                <label className="text-xs uppercase font-bold text-slate-500 tracking-wider flex items-center gap-2">
                                                    <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                                                    {header}
                                                </label>
                                                <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-4 text-slate-700 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap border border-slate-200 dark:border-white/5">
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
        </div >
    );
};

export default ExecutiveDirectives;

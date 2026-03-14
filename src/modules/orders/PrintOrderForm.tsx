import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Send, CheckCircle2, AlertCircle, Loader2, RotateCcw, User, Printer, Package, X, Search, Calendar, ChevronLeft, ChevronRight, Maximize2, Minimize2, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// ===== CONFIG =====
const PERSON_OPTIONS = ['Ngọc Bích', 'Ánh Mây', 'Thanh Tuyền', 'Đỗ Chiều', 'Trà My'];

// Google Apps Script Web App URL — đẩy dữ liệu vào Google Sheet Đặt hàng In
const SHEET_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyt_spuMfPA4iQ7qvOe-KH7xoh9AehAOD9e_OH3hdvlfQZSUpq2_0NUNbiLnkAZaY2Q/exec';

// Google Sheet Danh mục sản phẩm (để gợi ý tự động)
const CATALOG_SHEET_ID = '1karhpP174qGeQudh3YopY3Zl68f_zXoqlsw8CYd1YhQ';
const CATALOG_CSV_URL = `https://docs.google.com/spreadsheets/d/${CATALOG_SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

// ===== TYPES =====
interface PrintRow {
    chungLoai: string;
    nhanHang: string;
    sku: string;
    tenSanPham: string;
    kichThuoc: string;
    dvt: string;
    slDatIn: string;
    ngayCanGiao: string;
    ghiChu: string;
    chatLieu: string;
}

interface CatalogItem {
    chungLoai: string;
    nhanHang: string;
    sku: string;
    tenSanPham: string;
    dvt: string;
    kichThuoc: string;
    chatLieu: string;
}

const createEmptyRow = (): PrintRow => ({
    chungLoai: '',
    nhanHang: '',
    sku: '',
    tenSanPham: '',
    kichThuoc: '',
    dvt: '',
    chatLieu: '',
    slDatIn: '',
    ngayCanGiao: '',
    ghiChu: '',
});

const COLUMNS: { key: keyof PrintRow; label: string; width: string; type: 'text' | 'number' | 'date'; placeholder: string }[] = [
    { key: 'nhanHang', label: 'Nhãn hàng', width: 'w-28', type: 'text', placeholder: 'Nhập để tìm...' },
    { key: 'chungLoai', label: 'Chủng loại', width: 'w-24', type: 'text', placeholder: 'VD: Nhãn...' },
    { key: 'sku', label: 'SKU', width: 'w-24', type: 'text', placeholder: 'Mã SKU' },
    { key: 'tenSanPham', label: 'Tên sản phẩm', width: 'w-full', type: 'text', placeholder: 'Tên SP...' },
    { key: 'kichThuoc', label: 'Kích thước', width: 'w-24', type: 'text', placeholder: 'VD: A4' },
    { key: 'dvt', label: 'ĐVT', width: 'w-20', type: 'text', placeholder: 'Cuộn, Tờ' },
    { key: 'chatLieu', label: 'Chất liệu', width: 'w-28', type: 'text', placeholder: 'VD: Decal...' },
    { key: 'slDatIn', label: 'SL đặt in', width: 'w-20', type: 'number', placeholder: '0' },
    { key: 'ngayCanGiao', label: 'Ngày cần giao', width: 'w-32', type: 'date', placeholder: 'dd/mm/yyyy' },
    { key: 'ghiChu', label: 'Ghi chú', width: 'w-full', type: 'text', placeholder: 'Ghi chú...' },
];

// ===== CSV PARSER =====
function parseFullCSV(text: string): string[][] {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    const row: string[] = [];

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(current.trim());
                current = '';
            } else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
                row.push(current.trim());
                current = '';
                if (row.length > 0 && row.some(c => c)) rows.push([...row]);
                row.length = 0;
            } else {
                current += ch;
            }
        }
    }
    row.push(current.trim());
    if (row.some(c => c)) rows.push(row);
    return rows;
}

// ===== SUGGESTION DROPDOWN COMPONENT =====
interface SuggestionDropdownProps {
    query: string;
    catalog: CatalogItem[];
    visible: boolean;
    onSelect: (item: CatalogItem) => void;
    onClose: () => void;
    anchorEl: HTMLInputElement | null;
}

const SuggestionDropdown: React.FC<SuggestionDropdownProps> = ({ query, catalog, visible, onSelect, onClose, anchorEl }) => {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 420 });
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                anchorEl && !anchorEl.contains(e.target as Node)) {
                onClose();
            }
        };
        if (visible) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [visible, onClose, anchorEl]);

    useEffect(() => {
        const updatePosition = () => {
            if (visible && anchorEl && !isMobile) {
                const rect = anchorEl.getBoundingClientRect();
                const maxH = 380;
                const spaceBelow = window.innerHeight - rect.bottom - 8;
                const spaceAbove = rect.top - 8;
                const dropWidth = Math.max(420, rect.width);

                if (spaceBelow >= maxH || spaceBelow >= spaceAbove) {
                    setPos({ top: rect.bottom + 4, left: rect.left, width: dropWidth });
                } else {
                    const estimatedH = Math.min(maxH, spaceAbove);
                    setPos({ top: rect.top - estimatedH - 4, left: rect.left, width: dropWidth });
                }
            }
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [visible, anchorEl, query, isMobile]);


    if (!visible || !query) return null;

    const q = query.toLowerCase();
    const matches = catalog.filter(item =>
        item.nhanHang.toLowerCase().includes(q) ||
        item.tenSanPham.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.chungLoai.toLowerCase().includes(q)
    ).slice(0, 12);

    if (matches.length === 0) return null;

    const dropdownContent = (
        <>
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <Search size={11} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{matches.length} kết quả</span>
            </div>
            {matches.map((item, idx) => (
                <button
                    key={`${item.sku}-${idx}`}
                    type="button"
                    onClick={() => { onSelect(item); onClose(); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0 group"
                >
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">{item.nhanHang}</span>
                        <span className="text-[10px] font-mono text-slate-400">{item.sku}</span>
                        <span className={clsx(
                            "ml-auto text-[10px] px-1.5 py-0.5 rounded font-bold",
                            item.chungLoai === 'Thùng'
                                ? "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-300"
                                : item.chungLoai === 'Nhãn'
                                    ? "bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300"
                                    : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                        )}>{item.chungLoai}</span>
                    </div>
                    <p className={clsx("text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-cyan-700 dark:group-hover:text-cyan-300", !isMobile && "truncate")}>{item.tenSanPham}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">ĐVT: {item.dvt} • KT: {item.kichThuoc || '—'}</p>
                </button>
            ))}
        </>
    );

    if (isMobile) {
        const anchorRect = anchorEl?.getBoundingClientRect();
        return createPortal(
            <div
                ref={dropdownRef}
                className="absolute z-[9999] max-h-[380px] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-900/20"
                style={{
                    left: 8,
                    right: 8,
                    top: anchorRect ? anchorRect.bottom + window.scrollY + 4 : 100,
                }}
            >
                {dropdownContent}
            </div>,
            document.body
        );
    }

    return createPortal(
        <div
            ref={dropdownRef}
            className="fixed z-[9999] max-h-[380px] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-900/20"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
            {dropdownContent}
        </div>,
        document.body
    );
};

// ===== MINI CALENDAR COMPONENT =====
const DAYS_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTHS_VI = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

interface MiniCalendarProps {
    value: string; // dd/mm/yyyy or yyyy-mm-dd
    onChange: (val: string) => void;
    onClose: () => void;
    anchorEl: HTMLElement | null;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ value, onChange, onClose, anchorEl }) => {
    const calRef = useRef<HTMLDivElement>(null);
    const today = new Date();

    // Parse value
    const parseDate = (v: string): Date => {
        if (!v) return today;
        // Try dd/mm/yyyy
        const parts = v.split('/');
        if (parts.length === 3) {
            const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
            if (!isNaN(d.getTime())) return d;
        }
        // Try yyyy-mm-dd
        const d2 = new Date(v);
        return isNaN(d2.getTime()) ? today : d2;
    };

    const selected = parseDate(value);
    const [viewMonth, setViewMonth] = useState(selected.getMonth());
    const [viewYear, setViewYear] = useState(selected.getFullYear());
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        const updatePosition = () => {
            if (anchorEl) {
                const rect = anchorEl.getBoundingClientRect();
                const calW = 280, calH = 340;
                let top = rect.bottom + 6;
                let left = rect.left;
                // Keep within viewport
                if (top + calH > window.innerHeight) top = rect.top - calH - 6;
                if (left + calW > window.innerWidth) left = window.innerWidth - calW - 12;
                setPos({ top, left: Math.max(8, left) });
            }
        };
        
        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [anchorEl]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (calRef.current && !calRef.current.contains(e.target as Node) &&
                anchorEl && !anchorEl.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose, anchorEl]);

    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const selectDay = (day: number) => {
        const dd = String(day).padStart(2, '0');
        const mm = String(viewMonth + 1).padStart(2, '0');
        onChange(`${viewYear}-${mm}-${dd}`);
        onClose();
    };

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const isToday = (day: number) => day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
    const isSelected = (day: number) => day === selected.getDate() && viewMonth === selected.getMonth() && viewYear === selected.getFullYear();
    const isPast = (day: number) => {
        const cellDate = new Date(viewYear, viewMonth, day);
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return cellDate < todayStart;
    };

    return createPortal(
        <div ref={calRef} className="fixed z-[9999] w-[280px] rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xl shadow-slate-900/20" style={{ top: pos.top, left: pos.left }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500 to-sky-500 rounded-t-2xl">
                <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-white/20 transition text-white"><ChevronLeft size={16} /></button>
                <span className="text-sm font-bold text-white">{MONTHS_VI[viewMonth]} {viewYear}</span>
                <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-white/20 transition text-white"><ChevronRight size={16} /></button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0 px-3 pt-3 pb-1">
                {DAYS_VI.map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{d}</div>
                ))}
            </div>
            {/* Days */}
            <div className="grid grid-cols-7 gap-0.5 px-3 pb-2">
                {cells.map((day, idx) => (
                    <div key={idx} className="flex items-center justify-center">
                        {day ? (
                            <button
                                type="button"
                                onClick={() => !isPast(day) && selectDay(day)}
                                disabled={isPast(day)}
                                className={clsx(
                                    "w-8 h-8 rounded-lg text-xs font-semibold transition-all",
                                    isPast(day)
                                        ? "text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40"
                                        : isSelected(day)
                                            ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 scale-110"
                                            : isToday(day)
                                                ? "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-300 dark:ring-cyan-500/30"
                                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                )}
                            >
                                {day}
                            </button>
                        ) : <div className="w-8 h-8" />}
                    </div>
                ))}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 rounded-b-2xl bg-slate-50/50 dark:bg-slate-900/30">
                <button type="button" onClick={() => { onChange(''); onClose(); }} className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition">
                    <X size={11} className="inline mr-1" />Xóa
                </button>
                <button type="button" onClick={() => { selectDay(today.getDate()); setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); }} className="text-[11px] font-bold text-cyan-500 hover:text-cyan-600 transition">
                    Hôm nay
                </button>
            </div>
        </div>,
        document.body
    );
};

// ===== COMPONENT =====
const PrintOrderForm: React.FC = () => {
    const [person, setPerson] = useState('');
    const [personOther, setPersonOther] = useState('');
    const [rows, setRows] = useState<PrintRow[]>([createEmptyRow()]);
    const [phase, setPhase] = useState<'form' | 'confirm' | 'submitting' | 'success'>('form');
    const [error, setError] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Catalog state
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [activeCalendar, setActiveCalendar] = useState<number | null>(null);
    const nhanHangInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const calendarAnchorRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const [tableExpanded, setTableExpanded] = useState(false);
    const [isMobileForm, setIsMobileForm] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const h = () => setIsMobileForm(window.innerWidth <= 768);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    const selectedPerson = person === '__other__' ? personOther.trim() : person;

    // ===== FETCH CATALOG FROM GOOGLE SHEET =====
    const fetchCatalog = useCallback(async () => {
        try {
            setCatalogLoading(true);
            const res = await fetch(CATALOG_CSV_URL);
            const text = await res.text();
            const allRows = parseFullCSV(text);
            if (allRows.length <= 1) { setCatalogLoading(false); return; }

            // Skip header row (row 0)
            const items: CatalogItem[] = [];
            for (let i = 1; i < allRows.length; i++) {
                const r = allRows[i];
                if (r.length < 6) continue;
                const item: CatalogItem = {
                    chungLoai: r[0] || '',   // Col A
                    nhanHang: r[1] || '',     // Col B
                    sku: r[3] || '',          // Col D (skip C = Hình ảnh)
                    tenSanPham: r[4] || '',   // Col E
                    dvt: r[5] || '',          // Col F
                    kichThuoc: r[8] || '',    // Col I = Kích thước
                    chatLieu: r[9] || '',     // Col J = Chất liệu
                };
                if (item.nhanHang || item.tenSanPham) items.push(item);
            }
            setCatalog(items);
        } catch (err) {
            console.warn('Failed to load catalog:', err);
        } finally {
            setCatalogLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCatalog();
        // Auto-refresh every 5 minutes
        const interval = setInterval(fetchCatalog, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchCatalog]);

    const updateRow = (index: number, field: keyof PrintRow, value: string) => {
        setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
        // Show dropdown when typing in nhanHang
        if (field === 'nhanHang' && value.length > 0) {
            setActiveDropdown(index);
        } else if (field === 'nhanHang' && value.length === 0) {
            setActiveDropdown(null);
        }
    };

    const handleSelectCatalogItem = (rowIndex: number, item: CatalogItem) => {
        setRows(prev => prev.map((r, i) => i === rowIndex ? {
            ...r,
            chungLoai: item.chungLoai,
            nhanHang: item.nhanHang,
            sku: item.sku,
            tenSanPham: item.tenSanPham,
            dvt: item.dvt,
            kichThuoc: item.kichThuoc,
            chatLieu: item.chatLieu,
        } : r));
        setActiveDropdown(null);
    };

    const addRow = () => {
        setRows(prev => [...prev, createEmptyRow()]);
        setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 100);
    };

    const removeRow = (index: number) => {
        if (rows.length <= 1) return;
        setRows(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        if (!selectedPerson) {
            setError('Vui lòng chọn người đặt hàng');
            return;
        }
        const validRows = rows.filter(r => r.tenSanPham || r.nhanHang || r.sku);
        if (validRows.length === 0) {
            setError('Vui lòng nhập ít nhất một sản phẩm (Tên SP hoặc Nhãn hàng)');
            return;
        }
        setError('');
        setPhase('confirm');
    };

    const handleEditAgain = () => {
        setPhase('form');
    };

    const handleConfirmSend = async () => {
        setPhase('submitting');
        try {
            const validRows = rows.filter(r => r.tenSanPham || r.nhanHang || r.sku);
            const payload = {
                person: selectedPerson,
                items: validRows,
                createdAt: new Date().toISOString(),
            };

            // Helper: wrap a promise with a timeout
            const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
                Promise.race([
                    promise,
                    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
                ]);

            let sheetOk = false;
            let firestoreOk = false;

            // 1. Push to Google Sheet (primary) — 15s timeout
            try {
                await withTimeout(
                    fetch(SHEET_SCRIPT_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'text/plain' },
                        body: JSON.stringify(payload),
                    }),
                    15000
                );
                sheetOk = true;
            } catch (sheetErr) {
                console.warn('Sheet sync failed:', sheetErr);
            }

            // 2. Save to Firestore (secondary) — 10s timeout
            try {
                await withTimeout(
                    addDoc(collection(db, 'print_orders'), {
                        ...payload,
                        serverCreatedAt: serverTimestamp(),
                        status: 'pending',
                    }),
                    10000
                );
                firestoreOk = true;
            } catch (fsErr) {
                console.warn('Firestore save failed:', fsErr);
            }

            if (sheetOk || firestoreOk) {
                setPhase('success');
            } else {
                setError('Gửi thất bại. Vui lòng kiểm tra kết nối mạng và thử lại.');
                setPhase('form');
            }
        } catch (err) {
            console.error('Submit failed:', err);
            setError('Gửi thất bại. Vui lòng thử lại.');
            setPhase('form');
        }
    };

    const handleReset = () => {
        setPerson('');
        setPersonOther('');
        setRows([createEmptyRow()]);
        setPhase('form');
        setError('');
    };

    // ========== RENDER: SUCCESS ==========
    if (phase === 'success') {
        return (
            <div className="font-sans relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl p-8 sm:p-14 text-center">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/10 via-sky-400/10 to-blue-400/10 rounded-[2rem] blur-xl" />
                <div className="relative z-10">
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30 mb-6 animate-bounce">
                        <CheckCircle2 size={40} className="text-white" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Gửi yêu cầu thành công! 🎉</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
                        Yêu cầu in ấn đã được ghi nhận vào hệ thống và Google Sheet.
                        <br />Bộ phận In ấn sẽ xử lý sớm nhất!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={handleReset}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-bold text-sm shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                        >
                            <Printer size={14} /> Tạo yêu cầu mới
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ========== RENDER: CONFIRM DIALOG ==========
    if (phase === 'confirm' || phase === 'submitting') {
        const validRows = rows.filter(r => r.tenSanPham || r.nhanHang || r.sku);
        return (
            <div className="font-sans relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl p-6 sm:p-10">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/5 via-sky-400/5 to-blue-400/5 rounded-[2rem] blur-xl" />
                <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 shadow-lg shadow-cyan-500/30">
                            <Package size={22} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Xác nhận yêu cầu in ấn</h3>
                            <p className="text-xs text-slate-400 font-semibold">Người đặt: <span className="text-cyan-600 dark:text-cyan-400">{selectedPerson}</span> • {validRows.length} sản phẩm</p>
                        </div>
                    </div>

                    {/* Summary Table */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-white/10 mb-6">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-800/80">
                                    <th className="text-left px-3 py-2.5 font-black text-slate-400 uppercase tracking-wider text-[10px]">STT</th>
                                    <th className="text-left px-3 py-2.5 font-black text-slate-400 uppercase tracking-wider text-[10px]">Nhãn hàng</th>
                                    <th className="text-left px-3 py-2.5 font-black text-slate-400 uppercase tracking-wider text-[10px]">Sản phẩm</th>
                                    <th className="text-left px-3 py-2.5 font-black text-slate-400 uppercase tracking-wider text-[10px]">SKU</th>
                                    <th className="text-left px-3 py-2.5 font-black text-slate-400 uppercase tracking-wider text-[10px]">SL</th>
                                    <th className="text-left px-3 py-2.5 font-black text-slate-400 uppercase tracking-wider text-[10px]">Ngày giao</th>
                                </tr>
                            </thead>
                            <tbody>
                                {validRows.map((r, i) => (
                                    <tr key={i} className="border-t border-slate-100 dark:border-white/5">
                                        <td className="px-3 py-2 text-slate-400 font-mono font-bold">{i + 1}</td>
                                        <td className="px-3 py-2"><span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-black text-[10px]">{r.nhanHang || '—'}</span></td>
                                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">{r.tenSanPham || '—'}</td>
                                        <td className="px-3 py-2 text-slate-500 font-mono">{r.sku || '—'}</td>
                                        <td className="px-3 py-2 font-bold text-cyan-600 dark:text-cyan-400">{r.slDatIn || '—'}</td>
                                        <td className="px-3 py-2 text-slate-500">{r.ngayCanGiao || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Confirmation Question */}
                    <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-500/10 dark:to-orange-500/5 border border-amber-200/60 dark:border-amber-500/20 rounded-2xl p-5 mb-6">
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300 text-center">
                            Bạn có muốn thay đổi yêu cầu không?
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={handleEditAgain}
                            disabled={phase === 'submitting'}
                            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
                        >
                            <RotateCcw size={14} /> Có, sửa lại
                        </button>
                        <button
                            onClick={handleConfirmSend}
                            disabled={phase === 'submitting'}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 text-white font-bold text-sm shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:scale-105 transition-all disabled:opacity-70 disabled:scale-100"
                        >
                            {phase === 'submitting' ? (
                                <><Loader2 size={14} className="animate-spin" /> Đang gửi...</>
                            ) : (
                                <><Send size={14} /> Không, gửi luôn</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ========== RENDER: FORM ==========
    return (
        <div className="space-y-5 font-sans">
            <div className="relative rounded-2xl bg-white/50 dark:bg-slate-800/40 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-lg overflow-hidden">
                <div className="absolute -top-12 -right-12 w-28 h-28 bg-gradient-to-br from-cyan-400/10 to-violet-400/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-gradient-to-br from-sky-400/15 to-blue-400/15 rounded-full blur-2xl pointer-events-none" />

                {/* ===== PERSON SELECTOR ===== */}
                <div className="relative z-10 px-4 pt-4 pb-3 border-b border-slate-200/50 dark:border-slate-700/50">
                    {/* Header row */}
                    <div className="flex items-center gap-1.5 mb-3">
                        <User size={12} className="text-cyan-600 dark:text-cyan-400" />
                        <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">Người đặt hàng</p>
                    </div>
                    {/* Person chips */}
                    <div className="flex flex-wrap gap-1.5">
                        {PERSON_OPTIONS.map((name) => {
                            const isSelected = person === name;
                            const avatarColorMap: Record<string, string> = {
                                'Ngọc Bích': 'from-violet-500 to-purple-600',
                                'Ánh Mây': 'from-cyan-500 to-blue-600',
                                'Thanh Tuyền': 'from-amber-500 to-orange-600',
                                'Đỗ Chiều': 'from-emerald-500 to-teal-600',
                                'Trà My': 'from-pink-500 to-rose-600',
                            };
                            const avatarGradient = avatarColorMap[name] || 'from-slate-500 to-slate-600';
                            const parts = name.trim().split(/\s+/);
                            const initial = parts[parts.length - 1].charAt(0);
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => { setPerson(name); setPersonOther(''); setError(''); }}
                                    className={clsx(
                                        "flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-xs font-bold transition-all duration-300",
                                        isSelected
                                            ? "border-cyan-400 dark:border-cyan-500/50 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 shadow-md shadow-cyan-500/10 scale-[1.02]"
                                            : "border-slate-200/80 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:border-cyan-300 dark:hover:border-cyan-500/30 hover:shadow-sm"
                                    )}
                                >
                                    <span className={clsx(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 transition-all",
                                        isSelected
                                            ? `bg-gradient-to-br ${avatarGradient} shadow-sm`
                                            : "bg-slate-300 dark:bg-slate-600"
                                    )}>
                                        {initial}
                                    </span>
                                    <span className="whitespace-nowrap">{name}</span>
                                    {isSelected && <CheckCircle2 size={12} className="text-cyan-500 ml-0.5 shrink-0" />}
                                </button>
                            );
                        })}
                        {/* "Khác" button */}
                        <button
                            type="button"
                            onClick={() => { setPerson('__other__'); setError(''); }}
                            className={clsx(
                                "flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border border-dashed text-xs font-bold transition-all duration-300",
                                person === '__other__'
                                    ? "border-cyan-400 dark:border-cyan-500/50 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 shadow-md"
                                    : "border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-cyan-300 hover:text-cyan-500"
                            )}
                        >
                            <span className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-[11px] shrink-0">+</span>
                            <span>Khác</span>
                        </button>
                        {/* "Khác" input — inline on PC, full-width on mobile */}
                        {person === '__other__' && (
                            <input
                                type="text"
                                value={personOther}
                                onChange={e => setPersonOther(e.target.value)}
                                placeholder="Nhập tên của bạn..."
                                className="w-full sm:w-auto sm:flex-1 sm:max-w-xs px-3 py-1.5 rounded-full bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-cyan-300 dark:border-cyan-500/30 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/30 outline-none transition-all"
                                autoFocus
                            />
                        )}
                    </div>
                </div>

            {/* ===== SPREADSHEET TABLE ===== */}
            {(() => {
                const tableInner = (
                    <>
                        {/* Table header info */}
                        <div className="relative z-10 flex flex-wrap items-center gap-2 px-4 pt-4 pb-2">
                            <div className="flex items-center gap-1.5">
                                <Printer size={13} className="text-cyan-600 dark:text-cyan-400" />
                                <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">Thông tin đặt in</p>
                            </div>
                            <div className="flex items-center gap-1.5 ml-auto">
                                {catalogLoading ? (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                        <Loader2 size={10} className="animate-spin" /> Tải...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                                        <CheckCircle2 size={10} /> {catalog.length} SP
                                    </span>
                                )}
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                    {rows.length} dòng
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setTableExpanded(!tableExpanded)}
                                    className={clsx(
                                        "p-1.5 rounded-lg transition-all border",
                                        tableExpanded
                                            ? "bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-500/30"
                                            : "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 hover:text-cyan-600 hover:border-cyan-300 dark:hover:bg-cyan-500/20 dark:hover:text-cyan-300 shadow-sm shadow-cyan-500/10 animate-[subtlePulse_2.5s_ease-in-out_infinite]"
                                    )}
                                    title={tableExpanded ? 'Thu nhỏ' : 'Mở rộng toàn màn hình'}
                                >
                                    {tableExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                                </button>
                            </div>
                        </div>

                        {/* Scrollable table or mobile cards */}
                        <div ref={scrollRef} className={clsx("relative z-10 px-3 pb-3", tableExpanded && "flex-1", !isMobileForm && "overflow-x-auto")}>
                            {isMobileForm ? (
                                /* === MOBILE CARD LAYOUT === */
                                <div className="space-y-3">
                                    {rows.map((row, i) => (
                                        <div key={i} className="rounded-xl bg-white/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 p-3 space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-black border border-cyan-200/50 dark:border-cyan-500/20">
                                                    {i + 1}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeRow(i)}
                                                    disabled={rows.length <= 1}
                                                    className={clsx(
                                                        "p-1.5 rounded-lg transition-all",
                                                        rows.length > 1
                                                            ? "text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                                                            : "text-slate-200 dark:text-slate-700 opacity-50 cursor-not-allowed"
                                                    )}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            {COLUMNS.map(col => (
                                                <div key={col.key}>
                                                    <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1 block">
                                                        {col.label}
                                                        {col.key === 'nhanHang' && catalog.length > 0 && (
                                                            <Search size={9} className="inline ml-1 text-cyan-500" />
                                                        )}
                                                    </label>
                                                    {col.type === 'date' ? (
                                                        <div ref={(el: HTMLDivElement | null) => { calendarAnchorRefs.current[i] = el; }} className="relative">
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                value={row[col.key] ? (() => {
                                                                    const d = new Date(row[col.key]);
                                                                    return isNaN(d.getTime()) ? row[col.key] : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                                                })() : ''}
                                                                onClick={() => setActiveCalendar(activeCalendar === i ? null : i)}
                                                                placeholder={col.placeholder}
                                                                className={clsx(
                                                                    "w-full px-3 py-2.5 pr-8 rounded-lg bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-medium dark:placeholder:text-slate-500 outline-none transition-all cursor-pointer",
                                                                    activeCalendar === i && "ring-2 ring-cyan-500/30 border-cyan-400"
                                                                )}
                                                            />
                                                            <button type="button" onClick={() => setActiveCalendar(activeCalendar === i ? null : i)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-500 transition">
                                                                <Calendar size={14} />
                                                            </button>
                                                            {activeCalendar === i && (
                                                                <MiniCalendar value={row[col.key]} onChange={(val) => updateRow(i, col.key, val)} onClose={() => setActiveCalendar(null)} anchorEl={calendarAnchorRefs.current[i] || null} />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <input
                                                                ref={col.key === 'nhanHang' ? (el: HTMLInputElement | null) => { nhanHangInputRefs.current[i] = el; } : undefined}
                                                                type={col.type}
                                                                value={row[col.key]}
                                                                onChange={e => updateRow(i, col.key, e.target.value)}
                                                                onFocus={() => { if (col.key === 'nhanHang' && row.nhanHang.length > 0) setActiveDropdown(i); }}
                                                                placeholder={col.placeholder}
                                                                className={clsx(
                                                                    "w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-medium dark:placeholder:text-slate-500 outline-none transition-all",
                                                                    "focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 focus:bg-white dark:focus:bg-slate-800/60",
                                                                    col.key === 'nhanHang' && activeDropdown === i && "ring-2 ring-cyan-500/30 border-cyan-400"
                                                                )}
                                                                autoComplete="off"
                                                            />
                                                            {col.key === 'nhanHang' && (
                                                                <SuggestionDropdown query={row.nhanHang} catalog={catalog} visible={activeDropdown === i} onSelect={(item) => handleSelectCatalogItem(i, item)} onClose={() => setActiveDropdown(null)} anchorEl={nhanHangInputRefs.current[i] || null} />
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* === DESKTOP TABLE LAYOUT === */
                                <table className="w-full table-fixed border-separate border-spacing-y-1.5" style={{ minWidth: '1100px' }}>
                                    <thead>
                                        <tr>
                                            <th className="text-center px-1 py-2 text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide w-8">STT</th>
                                            {COLUMNS.map(col => (
                                                <th key={col.key} className={clsx("text-left px-1 py-2 text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide", col.width)}>
                                                    <span className="flex items-center gap-1">
                                                        {col.label}
                                                        {col.key === 'nhanHang' && catalog.length > 0 && (
                                                            <Search size={9} className="text-cyan-500" />
                                                        )}
                                                    </span>
                                                </th>
                                            ))}
                                            <th className="w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, i) => (
                                            <tr key={i} className="group">
                                                <td className="text-center">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-black border border-cyan-200/50 dark:border-cyan-500/20">
                                                        {i + 1}
                                                    </span>
                                                </td>
                                                {COLUMNS.map(col => (
                                                    <td key={col.key} className={clsx("px-1", col.key === 'nhanHang' && "relative")}>
                                                        {col.type === 'date' ? (
                                                            <div ref={(el: HTMLDivElement | null) => { calendarAnchorRefs.current[i] = el; }} className="relative">
                                                                <input
                                                                    type="text"
                                                                    readOnly
                                                                    value={row[col.key] ? (() => {
                                                                        const d = new Date(row[col.key]);
                                                                        return isNaN(d.getTime()) ? row[col.key] : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                                                    })() : ''}
                                                                    onClick={() => setActiveCalendar(activeCalendar === i ? null : i)}
                                                                    placeholder={col.placeholder}
                                                                    className={clsx(
                                                                        "w-full px-2.5 py-2 pr-8 rounded-lg bg-white/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 text-[11px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px] placeholder:font-medium dark:placeholder:text-slate-500 outline-none transition-all cursor-pointer",
                                                                        "hover:border-cyan-300/60 dark:hover:border-cyan-500/20",
                                                                        activeCalendar === i && "ring-2 ring-cyan-500/30 border-cyan-400"
                                                                    )}
                                                                />
                                                                <button type="button" onClick={() => setActiveCalendar(activeCalendar === i ? null : i)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-500 transition">
                                                                    <Calendar size={13} />
                                                                </button>
                                                                {activeCalendar === i && (
                                                                    <MiniCalendar value={row[col.key]} onChange={(val) => updateRow(i, col.key, val)} onClose={() => setActiveCalendar(null)} anchorEl={calendarAnchorRefs.current[i] || null} />
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <input
                                                                    ref={col.key === 'nhanHang' ? (el: HTMLInputElement | null) => { nhanHangInputRefs.current[i] = el; } : undefined}
                                                                    type={col.type}
                                                                    value={row[col.key]}
                                                                    onChange={e => updateRow(i, col.key, e.target.value)}
                                                                    onFocus={() => { if (col.key === 'nhanHang' && row.nhanHang.length > 0) setActiveDropdown(i); }}
                                                                    placeholder={col.placeholder}
                                                                    className={clsx(
                                                                        "w-full px-2.5 py-2 rounded-lg bg-white/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 text-[11px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px] placeholder:font-medium dark:placeholder:text-slate-500 outline-none transition-all",
                                                                        "focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 focus:bg-white dark:focus:bg-slate-800/60",
                                                                        "hover:border-cyan-300/60 dark:hover:border-cyan-500/20",
                                                                        col.key === 'nhanHang' && activeDropdown === i && "ring-2 ring-cyan-500/30 border-cyan-400"
                                                                    )}
                                                                    autoComplete="off"
                                                                />
                                                                {col.key === 'nhanHang' && (
                                                                    <SuggestionDropdown query={row.nhanHang} catalog={catalog} visible={activeDropdown === i} onSelect={(item) => handleSelectCatalogItem(i, item)} onClose={() => setActiveDropdown(null)} anchorEl={nhanHangInputRefs.current[i] || null} />
                                                                )}
                                                            </>
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeRow(i)}
                                                        disabled={rows.length <= 1}
                                                        className={clsx(
                                                            "p-1.5 rounded-lg transition-all",
                                                            rows.length > 1
                                                                ? "text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                                                                : "text-slate-200 dark:text-slate-700 opacity-50 cursor-not-allowed"
                                                        )}
                                                        title="Xóa dòng"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Add Row Button */}
                        <div className="relative z-10 px-5 pb-5">
                            <button
                                type="button"
                                onClick={addRow}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-cyan-300/50 dark:border-cyan-500/20 bg-cyan-50/30 dark:bg-cyan-500/5 text-cyan-600 dark:text-cyan-400 text-xs font-bold hover:bg-cyan-50 dark:hover:bg-cyan-500/10 hover:border-cyan-400/80 dark:hover:border-cyan-400/30 transition-all group"
                            >
                                <Plus size={14} className="group-hover:scale-125 transition-transform" />
                                Thêm sản phẩm
                            </button>
                        </div>
                    </>
                );

                return tableExpanded
                    ? createPortal(
                        <div className="fixed inset-0 z-[9990] flex flex-col">
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setTableExpanded(false)} />
                            <div className="relative z-10 m-3 flex-1 flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
                                {tableInner}
                            </div>
                        </div>,
                        document.body
                    )
                    : (
                        <div className="relative">
                            {tableInner}
                        </div>
                    );
            })()}
            </div>

            {/* ===== ERROR MESSAGE ===== */}
            {error && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                    <AlertCircle size={18} className="text-red-500 shrink-0" />
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
                    <button onClick={() => setError('')} className="ml-auto text-red-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                </div>
            )}

            {/* ===== DELIVERY NOTE ===== */}
            <div className="bg-sky-50 dark:bg-sky-500/5 border border-sky-100 dark:border-sky-500/10 rounded-2xl p-4 sm:p-5 mt-4 sm:mt-6 mb-4 sm:mb-6 shadow-sm">
                <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-500/20 flex items-center justify-center shrink-0 shadow-inner">
                        <Info size={20} className="text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-sky-800 dark:text-sky-300 mb-2">Thời gian giao hàng dự kiến từ nhà in:</h4>
                        <ul className="space-y-1.5 text-sm text-sky-700 dark:text-sky-200/80 mb-4 list-disc pl-4 marker:text-sky-400">
                            <li><strong className="text-sky-800 dark:text-sky-100 font-semibold">Với đặt in nhãn:</strong> sau 5-7 ngày kể từ khi chốt MQ và đơn hàng.</li>
                            <li><strong className="text-sky-800 dark:text-sky-100 font-semibold">Với đặt in thùng:</strong> sau 7-10 ngày kể từ khi chốt MQ và đơn hàng.</li>
                            <li><strong className="text-sky-800 dark:text-sky-100 font-semibold">Với đặt in vỏ túi:</strong> sau 20-25 ngày kể từ khi chốt MQ và đơn hàng.</li>
                        </ul>
                        <div className="flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3.5 py-2.5 rounded-xl border border-amber-200/60 dark:border-amber-500/20">
                            <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-500 dark:text-amber-400" />
                            <p className="font-medium leading-relaxed">
                                <strong className="font-bold uppercase tracking-wide">Lưu ý: </strong> 
                                Trường hợp cần gấp, vui lòng thiết lập rõ <b>Ngày cần giao</b> và liên hệ trực tiếp <strong className="font-bold text-amber-800 dark:text-amber-300">Ms. Nguyệt - 033.630.8512</strong> để phối hợp với nhà in xử lý!
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== SUBMIT BUTTON ===== */}
            <button
                type="button"
                onClick={handleSubmit}
                className="w-full sm:w-1/3 sm:mx-auto py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-cyan-600 bg-[length:200%_100%] hover:bg-right text-white font-black text-sm uppercase tracking-widest shadow-[0_10px_40px_-10px_rgba(6,182,212,0.5)] border border-white/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_50px_-10px_rgba(6,182,212,0.4)] relative group overflow-hidden flex items-center justify-center gap-3"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                <Send size={16} className="relative z-10" />
                <span className="relative z-10">Gửi yêu cầu in ấn</span>
            </button>
        </div>
    );
};

export default PrintOrderForm;

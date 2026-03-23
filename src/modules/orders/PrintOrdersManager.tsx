import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Tag, Layers, Hash, FileText, Ruler, Scale, Package, DollarSign, Calculator, CalendarClock, StickyNote, CheckCircle2, PenLine, XCircle, ShoppingCart, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader2, AlertCircle, Printer, LayoutGrid, Table, Calendar, Maximize2, Minimize2, BarChart3, Users, Truck, Filter, X, Coins } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { fetchPrintOrders, subscribeToPrintOrderChanges, type PrintOrder } from '../../services/printOrderService';

// ===== CONFIG =====
const PRINT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx0a0oYMbGcwUBaKB6kV-WHgyw30JwP4WJqM8fZlNcATivnuXxW_ZyjZVdt56_z06UE/exec';

const ALLOWED_EDITOR_EMAILS = [
    'mcngocsonvualoidan@gmail.com',
    'ccmartech.com@gmail.com',
    'lenguyet011@gmail.com',
];

// Soft color palette for person tags (synced with PublicOrders)
const personColorPalette = [
    { text: 'text-pink-700 dark:text-pink-300', bg: 'bg-pink-50 dark:bg-pink-500/10', border: 'border-pink-200/60 dark:border-pink-500/20' },
    { text: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200/60 dark:border-violet-500/20' },
    { text: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-200/60 dark:border-sky-500/20' },
    { text: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-200/60 dark:border-teal-500/20' },
    { text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200/60 dark:border-amber-500/20' },
    { text: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-200/60 dark:border-rose-500/20' },
    { text: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-200/60 dark:border-indigo-500/20' },
    { text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200/60 dark:border-emerald-500/20' },
    { text: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200/60 dark:border-orange-500/20' },
    { text: 'text-cyan-700 dark:text-cyan-300', bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-200/60 dark:border-cyan-500/20' },
];

const personColorOverrides: Record<string, { text: string; bg: string; border: string }> = {
    'Ngọc Bích': { text: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200/60 dark:border-violet-500/20' },
    'Ánh Mây': { text: 'text-cyan-700 dark:text-cyan-300', bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-200/60 dark:border-cyan-500/20' },
    'Mây Nguyễn': { text: 'text-cyan-700 dark:text-cyan-300', bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-200/60 dark:border-cyan-500/20' },
    'Thanh Tuyền': { text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200/60 dark:border-amber-500/20' },
    'Đỗ Chiều': { text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200/60 dark:border-emerald-500/20' },
    'Trà My': { text: 'text-pink-700 dark:text-pink-300', bg: 'bg-pink-50 dark:bg-pink-500/10', border: 'border-pink-200/60 dark:border-pink-500/20' },
};

function getPersonColor(name: string) {
    if (!name) return personColorPalette[0];
    const trimmed = name.trim();
    if (personColorOverrides[trimmed]) return personColorOverrides[trimmed];
    let hash = 0;
    for (let i = 0; i < trimmed.length; i++) {
        hash = trimmed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return personColorPalette[Math.abs(hash) % personColorPalette.length];
}

// ===== MINI CALENDAR COMPONENT =====
const VIET_MONTHS = ['Tháng Một', 'Tháng Hai', 'Tháng Ba', 'Tháng Tư', 'Tháng Năm', 'Tháng Sáu', 'Tháng Bảy', 'Tháng Tám', 'Tháng Chín', 'Tháng Mười', 'Tháng M. Một', 'Tháng M. Hai'];
const DAY_HEADERS = ['H', 'B', 'T', 'N', 'S', 'B', 'C'];

interface MiniCalendarProps {
    value: string; // YYYY-MM-DD
    onChange: (val: string) => void;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLDivElement | null>;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ value, onChange, onClose, anchorRef }) => {
    const today = new Date();
    const parsed = value ? new Date(value + 'T00:00:00') : today;
    const [viewYear, setViewYear] = useState(parsed.getFullYear());
    const [viewMonth, setViewMonth] = useState(parsed.getMonth());
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    // Position calculation
    useEffect(() => {
        const calcPos = () => {
            if (!anchorRef.current) return;
            const rect = anchorRef.current.getBoundingClientRect();
            const calH = 380; // approx calendar height
            const calW = 288;
            let top = rect.bottom + 4 + window.scrollY;
            let left = rect.left + rect.width / 2 - calW / 2 + window.scrollX;
            // Flip above if not enough space below
            if (rect.bottom + calH > window.innerHeight) {
                top = rect.top - calH - 4 + window.scrollY;
            }
            // Clamp left
            if (left < 8) left = 8;
            if (left + calW > window.innerWidth - 8) left = window.innerWidth - calW - 8;
            setPos({ top, left });
        };
        calcPos();
        window.addEventListener('resize', calcPos);
        window.addEventListener('scroll', calcPos, true);
        return () => {
            window.removeEventListener('resize', calcPos);
            window.removeEventListener('scroll', calcPos, true);
        };
    }, [anchorRef]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node) &&
                anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose, anchorRef]);

    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; inMonth: boolean; date: Date }[] = [];
    for (let i = startDow - 1; i >= 0; i--) {
        const d = prevMonthDays - i;
        cells.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth - 1, d) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, inMonth: true, date: new Date(viewYear, viewMonth, d) });
    }
    const remain = 7 - (cells.length % 7);
    if (remain < 7) {
        for (let d = 1; d <= remain; d++) {
            cells.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth + 1, d) });
        }
    }

    const isToday = (d: Date) => d.toDateString() === today.toDateString();
    const isSelected = (d: Date) => value && d.toISOString().slice(0, 10) === value;
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const prevMonthFn = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonthFn = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    return ReactDOM.createPortal(
        <div
            ref={ref}
            className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/50 border border-slate-200 dark:border-slate-700 p-3 w-[288px]"
            style={{ top: pos.top, left: pos.left, position: 'absolute' }}
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <button onClick={prevMonthFn} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {VIET_MONTHS[viewMonth]} {viewYear}
                </span>
                <button onClick={nextMonthFn} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                    <ChevronRight size={16} />
                </button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
                {DAY_HEADERS.map((d, i) => (
                    <div key={i} className={clsx('text-center text-[11px] font-bold py-1', i >= 5 ? 'text-red-400' : 'text-slate-400 dark:text-slate-500')}>{d}</div>
                ))}
            </div>
            {/* Day grid */}
            <div className="grid grid-cols-7">
                {cells.map((cell, i) => {
                    const isPast = cell.date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    return (
                    <button
                        key={i}
                        disabled={isPast}
                        onClick={() => { if (!isPast) { onChange(fmt(cell.date)); onClose(); } }}
                        className={clsx(
                            'w-[38px] h-[38px] rounded-xl text-[13px] font-medium flex items-center justify-center transition-all duration-150 mx-auto',
                            isPast && 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed line-through',
                            !isPast && !cell.inMonth && 'text-slate-300 dark:text-slate-600',
                            !isPast && cell.inMonth && !isSelected(cell.date) && !isToday(cell.date) && 'text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-500/10',
                            !isPast && isToday(cell.date) && !isSelected(cell.date) && 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold ring-1 ring-blue-200 dark:ring-blue-500/30',
                            isSelected(cell.date) && !isPast && 'bg-gradient-to-br from-orange-500 to-amber-500 text-white font-bold shadow-md shadow-orange-500/30',
                        )}
                    >
                        {cell.day}
                    </button>
                    );
                })}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                    onClick={() => { onChange(''); onClose(); }}
                    className="text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                    Xóa
                </button>
                <button
                    onClick={() => {
                        const t = new Date();
                        setViewYear(t.getFullYear());
                        setViewMonth(t.getMonth());
                        onChange(fmt(t));
                        onClose();
                    }}
                    className="text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                >
                    Hôm nay
                </button>
            </div>
        </div>,
        document.body
    );
};

// PrintOrder type imported from printOrderService

function formatVNDateTime(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

function formatCurrency(n: number): string {
    if (!n || isNaN(n)) return '—';
    return n.toLocaleString('vi-VN') + ' ₫';
}

const PrintOrdersManager: React.FC = () => {
    const { currentUser, isAdminView } = useAuth();
    const { users } = useData();
    const [printOrders, setPrintOrders] = useState<PrintOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedPrintOrder, setExpandedPrintOrder] = useState<string | null>(null);
    const [inlineUnitPrices, setInlineUnitPrices] = useState<Record<string, string>>({});
    const [inlineDeliveryDates, setInlineDeliveryDates] = useState<Record<string, string>>({});
    const [showMobileActions, setShowMobileActions] = useState<string | null>(null);
    const [showDesktopActions, setShowDesktopActions] = useState<string | null>(null);
    const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
    const [openCalendarId, setOpenCalendarId] = useState<string | null>(null);
    const calendarAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [isTableFullscreen, setIsTableFullscreen] = useState(false);
    const [enteringDeliveryQty, setEnteringDeliveryQty] = useState<string | null>(null);
    const [inlineDeliveryQty, setInlineDeliveryQty] = useState<Record<string, string>>({});
    // Table filters
    const [tableFilterDateFrom, setTableFilterDateFrom] = useState('');
    const [tableFilterDateTo, setTableFilterDateTo] = useState('');
    const [tableFilterBrand, setTableFilterBrand] = useState('');
    const [tableFilterSku, setTableFilterSku] = useState('');
    const [tableFilterPerson, setTableFilterPerson] = useState('');
    const [showTableFilters, setShowTableFilters] = useState(false);
    // Custom dropdown open states
    const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
    const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);
    const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
    const brandDropdownRef = useRef<HTMLDivElement>(null);
    const skuDropdownRef = useRef<HTMLDivElement>(null);
    const personDropdownRef = useRef<HTMLDivElement>(null);
    // Custom date picker states
    const [dateFromPickerOpen, setDateFromPickerOpen] = useState(false);
    const [dateToPickerOpen, setDateToPickerOpen] = useState(false);
    const [dateFromViewMonth, setDateFromViewMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [dateToViewMonth, setDateToViewMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const dateFromPickerRef = useRef<HTMLDivElement>(null);
    const dateToPickerRef = useRef<HTMLDivElement>(null);
    // Table action popup (Đặt in / SL giao)
    const [tableActionPopup, setTableActionPopup] = useState<{ id: string; type: 'datIn' | 'slGiao' } | null>(null);
    const [tableActionValues, setTableActionValues] = useState<Record<string, { unitPrice: string; expectedDelivery: string; deliveryQty: string }>>({});
    const [popupCalMonth, setPopupCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    // Checkbox selection for table
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    // Print preview modal
    const [printPreviewModal, setPrintPreviewModal] = useState<{ title: string; html: string } | null>(null);
    const printPreviewRef = useRef<HTMLDivElement>(null);

    const canEdit = useMemo(() => {
        if (!currentUser?.email) return false;
        if (!isAdminView) return false;
        return ALLOWED_EDITOR_EMAILS.includes(currentUser.email.toLowerCase());
    }, [currentUser, isAdminView]);

    // Parse DD/MM/YYYY to Date for comparison
    const parseDMY = useCallback((dateStr: string): Date | null => {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        return null;
    }, []);

    // Unique brands & SKUs for filter dropdowns
    const uniqueBrands = useMemo(() => {
        const set = new Set<string>();
        printOrders.forEach(po => { if (po.brand?.trim()) set.add(po.brand.trim()); });
        return Array.from(set).sort();
    }, [printOrders]);

    const uniqueSkus = useMemo(() => {
        const set = new Set<string>();
        printOrders.forEach(po => { if (po.sku?.trim()) set.add(po.sku.trim()); });
        return Array.from(set).sort();
    }, [printOrders]);

    const uniquePersons = useMemo(() => {
        const set = new Set<string>();
        printOrders.forEach(po => { if (po.person?.trim()) set.add(po.person.trim()); });
        return Array.from(set).sort();
    }, [printOrders]);

    // Filtered orders for table view
    const filteredTableOrders = useMemo(() => {
        let result = printOrders;
        // Filter by person
        if (tableFilterPerson) {
            result = result.filter(po => po.person?.trim() === tableFilterPerson);
        }
        // Filter by brand
        if (tableFilterBrand) {
            result = result.filter(po => po.brand?.trim() === tableFilterBrand);
        }
        // Filter by SKU
        if (tableFilterSku) {
            result = result.filter(po => po.sku?.trim() === tableFilterSku);
        }
        // Filter by date range
        if (tableFilterDateFrom || tableFilterDateTo) {
            result = result.filter(po => {
                const dateStr = po.timestamp?.split(' ')[0]; // DD/MM/YYYY
                const orderDate = parseDMY(dateStr || '');
                if (!orderDate) return false;
                if (tableFilterDateFrom) {
                    const from = new Date(tableFilterDateFrom); // YYYY-MM-DD from input
                    from.setHours(0, 0, 0, 0);
                    if (orderDate < from) return false;
                }
                if (tableFilterDateTo) {
                    const to = new Date(tableFilterDateTo);
                    to.setHours(23, 59, 59, 999);
                    if (orderDate > to) return false;
                }
                return true;
            });
        }
        return result;
    }, [printOrders, tableFilterBrand, tableFilterSku, tableFilterPerson, tableFilterDateFrom, tableFilterDateTo, parseDMY]);

    // Summary row aggregation
    const tableSummary = useMemo(() => {
        const orders = filteredTableOrders;
        const n = orders.length;
        const persons = new Set(orders.map(o => o.person).filter(Boolean));
        const brands = new Set(orders.map(o => o.brand).filter(Boolean));
        const skus = new Set(orders.map(o => o.sku).filter(Boolean));
        const products = new Set(orders.map(o => o.productName).filter(Boolean));
        const categories = new Set(orders.map(o => o.category).filter(Boolean));
        const materials = new Set(orders.map(o => o.material).filter(Boolean));
        let sumQty = 0, sumDeliveryQty = 0, sumTotal = 0;
        for (const o of orders) {
            const q = parseInt(o.quantity, 10);
            if (!isNaN(q)) sumQty += q;
            const dq = parseInt(o.deliveryQuantity, 10);
            if (!isNaN(dq)) sumDeliveryQty += dq;
            if (o.totalPrice && !isNaN(o.totalPrice)) sumTotal += o.totalPrice;
        }
        return { n, persons: persons.size, brands: brands.size, skus: skus.size, products: products.size, categories: categories.size, materials: materials.size, sumQty, sumDeliveryQty, sumTotal };
    }, [filteredTableOrders]);

    const hasActiveTableFilters = tableFilterDateFrom || tableFilterDateTo || tableFilterBrand || tableFilterSku || tableFilterPerson;
    const clearAllTableFilters = () => { setTableFilterDateFrom(''); setTableFilterDateTo(''); setTableFilterBrand(''); setTableFilterSku(''); setTableFilterPerson(''); };

    // Derived checkbox state (must be after filteredTableOrders)
    const isAllSelected = filteredTableOrders.length > 0 && selectedRows.size === filteredTableOrders.length;
    const isSomeSelected = selectedRows.size > 0 && selectedRows.size < filteredTableOrders.length;
    const toggleSelectAll = () => {
        if (isAllSelected) { setSelectedRows(new Set()); }
        else { setSelectedRows(new Set(filteredTableOrders.map(po => po.id))); }
    };
    const toggleSelectRow = (id: string) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Click outside to close custom dropdowns
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target as Node)) setBrandDropdownOpen(false);
            if (skuDropdownRef.current && !skuDropdownRef.current.contains(e.target as Node)) setSkuDropdownOpen(false);
            if (dateFromPickerRef.current && !dateFromPickerRef.current.contains(e.target as Node)) setDateFromPickerOpen(false);
            if (dateToPickerRef.current && !dateToPickerRef.current.contains(e.target as Node)) setDateToPickerOpen(false);
            if (personDropdownRef.current && !personDropdownRef.current.contains(e.target as Node)) setPersonDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadPrintOrders = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // 🛡️ Supabase-first fetch (protected data)
            const parsed = await fetchPrintOrders();
            setPrintOrders(parsed.reverse()); // newest first
        } catch (e: any) {
            setError(e.message || 'Lỗi tải dữ liệu đơn in');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPrintOrders();
        // 🔔 Subscribe to Realtime updates
        const unsubscribe = subscribeToPrintOrderChanges(() => {
            loadPrintOrders();
        });
        return () => unsubscribe();
    }, [loadPrintOrders]);

    const getPrintStatusInfo = (status: string) => {
        const s = (status || '').toLowerCase().trim();
        if (s.includes('đã đặt in') || s.includes('đã xử lý')) return { color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20', label: 'Đã đặt in' };
        if (s.includes('hoàn thành')) return { color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/20', label: 'Hoàn thành' };
        if (s.includes('hủy')) return { color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', label: 'Đã hủy' };
        return { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', label: 'Chưa xử lý' };
    };

    const handleUpdatePrintOrder = async (po: PrintOrder, updates: { unitPrice?: number; totalPrice?: number; status?: string; expectedDelivery?: string; note?: string; cancelReason?: string; deliveryQuantity?: string }) => {
        const isCancelling = updates.status === 'Đã hủy';
        // When cancelling, auto-clear pricing info
        if (isCancelling) {
            updates.unitPrice = 0;
            updates.totalPrice = 0;
        }

        const updatedBy = users.find(u => u.email === currentUser?.email)?.name || currentUser?.email || 'Unknown';
        const updatedAt = formatVNDateTime(new Date());

        // Optimistic update
        setPrintOrders(prev => prev.map(p => p.id === po.id ? { ...p, ...updates, updatedBy, updatedAt } : p));
        setExpandedPrintOrder(null);
        setCancelConfirmId(null);
        setCancelReason('');

        // Build params for GET request (avoid POST body-loss on 302 redirect)
        const params: Record<string, string> = {
            action: 'update',
            rowIndex: String(po.rowIndex),
            updatedBy,
            updatedAt,
        };
        if (updates.status !== undefined) params.status = updates.status;
        if (updates.unitPrice !== undefined) params.unitPrice = String(isCancelling ? '' : updates.unitPrice);
        if (updates.totalPrice !== undefined) params.totalPrice = String(isCancelling ? '' : updates.totalPrice);
        if (updates.expectedDelivery !== undefined) params.expectedDelivery = updates.expectedDelivery;
        if (updates.deliveryQuantity !== undefined) params.deliveryQuantity = updates.deliveryQuantity;
        if (updates.cancelReason !== undefined) params.cancelReason = updates.cancelReason;

        try {
            const qs = new URLSearchParams(params).toString();
            const url = `${PRINT_SCRIPT_URL}?${qs}`;
            // GET with no-cors: fire-and-forget (avoids POST 302 redirect body-loss)
            await fetch(url, { mode: 'no-cors', redirect: 'follow' });
            console.log('[PrintSync] ✅ GET request sent:', params);
        } catch (err: any) {
            console.error('[PrintSync] ❌ Error:', err);
        }
    };

    // ===== Delivery date formatting =====
    const formatDeliveryDate = (d: string) => {
        if (!d) return null;
        // YYYY-MM-DD -> DD/MM/YYYY
        const isoMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        // Already DD/MM/YYYY
        const parts = d.split('/');
        if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}`;
        return d;
    };

    // ===== CHART DATA COMPUTATION =====
    const [showCharts, setShowCharts] = useState(() => {
        try { const v = localStorage.getItem('printOrders_showCharts'); return v !== null ? v === 'true' : true; } catch { return true; }
    });
    const toggleCharts = () => setShowCharts(prev => { const next = !prev; try { localStorage.setItem('printOrders_showCharts', String(next)); } catch {} return next; });

    const monthlyChartData = useMemo(() => {
        const monthMap = new Map<string, number>();
        const vnMonths = ['Th01', 'Th02', 'Th03', 'Th04', 'Th05', 'Th06', 'Th07', 'Th08', 'Th09', 'Th10', 'Th11', 'Th12'];
        printOrders.forEach(po => {
            if (!po.timestamp) return;
            // timestamp format: 14/03/2026 16:32:42
            const parts = po.timestamp.split(' ')[0]?.split('/');
            if (parts && parts.length === 3) {
                const monthIdx = parseInt(parts[1], 10) - 1;
                const year = parts[2];
                const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
                if (!monthMap.has(key)) monthMap.set(key, 0);
                monthMap.set(key, (monthMap.get(key) || 0) + 1);
            }
        });
        return Array.from(monthMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, count]) => {
                const [y, m] = key.split('-');
                const mIdx = parseInt(m, 10) - 1;
                return { month: `${vnMonths[mIdx]}/${y.slice(2)}`, count, sortKey: key };
            });
    }, [printOrders]);

    const PERSON_CHART_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

    const personChartData = useMemo(() => {
        const personMap = new Map<string, number>();
        printOrders.forEach(po => {
            const person = po.person?.trim() || 'Không rõ';
            personMap.set(person, (personMap.get(person) || 0) + 1);
        });
        return Array.from(personMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [printOrders]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-16 text-slate-500">
            <Loader2 className="animate-spin h-8 w-8 text-cyan-500 mb-3" />
            <span className="text-sm font-medium">Đang tải đơn đặt in...</span>
        </div>
    );

    if (error) return (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400">
            <AlertCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Header - View mode toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Printer size={18} className="text-cyan-500" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">
                        Đơn đặt in ({printOrders.length})
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {/* View Toggle - Prominent */}
                    <div className="flex gap-1 p-1 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-md">
                        <button
                            onClick={() => setViewMode('card')}
                            className={clsx("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                                viewMode === 'card'
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10'
                            )}
                        >
                            <LayoutGrid size={14} /> Thẻ
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={clsx("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                                viewMode === 'table'
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10'
                            )}
                        >
                            <Table size={14} /> Bảng
                        </button>
                    </div>
                    {/* Phóng to button - only in table mode */}
                    {viewMode === 'table' && !isTableFullscreen && (
                        <button
                            onClick={() => { setIsTableFullscreen(true); setShowTableFilters(true); }}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 hover:shadow-md hover:shadow-cyan-500/15 text-xs font-bold transition-all duration-200"
                        >
                            <Maximize2 size={13} /> Phóng to
                        </button>
                    )}
                </div>
            </div>

            {/* ===== CHARTS SECTION (only in card view) ===== */}
            {printOrders.length > 0 && viewMode === 'card' && (
                <div className="space-y-3">
                    <button
                        onClick={toggleCharts}
                        className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                    >
                        <BarChart3 size={15} />
                        Thống kê đơn đặt in
                        {showCharts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showCharts && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Monthly Orders Chart */}
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl shadow-lg p-4 sm:p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                                        <CalendarClock size={15} className="text-white" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Đơn đặt in theo tháng</h4>
                                        <p className="text-[10px] text-slate-400">Số lượng đơn hàng mỗi tháng</p>
                                    </div>
                                </div>
                                {monthlyChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                                            <XAxis
                                                dataKey="month"
                                                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                axisLine={false}
                                                tickLine={false}
                                                allowDecimals={false}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'rgba(15,23,42,0.9)',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    padding: '8px 14px',
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                                    fontFamily: "'Be Vietnam Pro', sans-serif",
                                                }}
                                                itemStyle={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}
                                                labelStyle={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}
                                                formatter={(value: any) => [`${value} đơn`, 'Số lượng']}
                                                cursor={{ fill: 'rgba(6,182,212,0.08)' }}
                                            />
                                            <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={40}>
                                                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#06b6d4' }} />
                                                {monthlyChartData.map((_entry, index) => (
                                                    <Cell key={`cell-m-${index}`} fill={`url(#monthGradient)`} />
                                                ))}
                                            </Bar>
                                            <defs>
                                                <linearGradient id="monthGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                                                </linearGradient>
                                            </defs>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">Chưa có dữ liệu</div>
                                )}
                            </div>

                            {/* Person Orders Chart */}
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl shadow-lg p-4 sm:p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                        <Users size={15} className="text-white" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Đơn đặt in theo người đặt</h4>
                                        <p className="text-[10px] text-slate-400">Phân bổ số đơn cho từng người</p>
                                    </div>
                                </div>
                                {personChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={Math.max(220, personChartData.length * 42)}>
                                        <BarChart data={personChartData} layout="vertical" margin={{ top: 5, right: 40, left: 5, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                                            <XAxis
                                                type="number"
                                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                axisLine={false}
                                                tickLine={false}
                                                allowDecimals={false}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                                width={100}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'rgba(15,23,42,0.9)',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    padding: '8px 14px',
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                                    fontFamily: "'Be Vietnam Pro', sans-serif",
                                                }}
                                                itemStyle={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}
                                                labelStyle={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}
                                                formatter={(value: any) => [`${value} đơn`, 'Số lượng']}
                                                cursor={{ fill: 'rgba(139,92,246,0.08)' }}
                                            />
                                            <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={28}>
                                                <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 700, fill: '#8b5cf6' }} />
                                                {personChartData.map((_entry, index) => (
                                                    <Cell key={`cell-p-${index}`} fill={PERSON_CHART_COLORS[index % PERSON_CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">Chưa có dữ liệu</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {viewMode === 'table' ? (
                /* ===== TABLE VIEW ===== */
                <>
                {/* Fullscreen overlay backdrop */}
                {isTableFullscreen && (
                    <div className="fixed inset-0 z-[99] bg-black/50 backdrop-blur-sm" onClick={() => setIsTableFullscreen(false)} />
                )}
                <div className={clsx(
                    "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl shadow-lg transition-all duration-300",
                    isTableFullscreen && "!fixed !z-[100] !rounded-2xl !border !border-slate-200 !bg-white !shadow-2xl flex flex-col"
                )} style={{
                    fontFamily: "'Be Vietnam Pro', sans-serif",
                    ...(isTableFullscreen ? { top: '5%', left: '5%', width: '90%', height: '90%' } : {})
                }}>
                    {/* Fullscreen toolbar */}
                    {isTableFullscreen && (
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shrink-0 rounded-t-2xl">
                            <div className="flex items-center gap-2">
                                <Printer size={16} className="text-cyan-500" />
                                <span className="text-sm font-bold text-slate-800">Đơn đặt in ({filteredTableOrders.length}{hasActiveTableFilters ? ` / ${printOrders.length}` : ''})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowTableFilters(!showTableFilters)}
                                    className={clsx(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                        showTableFilters || hasActiveTableFilters
                                            ? "bg-cyan-50 text-cyan-600 border border-cyan-200"
                                            : "bg-slate-100 text-slate-600 hover:bg-cyan-50 hover:text-cyan-600"
                                    )}
                                >
                                    <Filter size={13} />
                                    Lọc
                                    {hasActiveTableFilters && (
                                        <span className="ml-1 w-4 h-4 rounded-full bg-cyan-500 text-white text-[9px] flex items-center justify-center font-black">
                                            {[tableFilterDateFrom, tableFilterDateTo, tableFilterBrand, tableFilterSku, tableFilterPerson].filter(Boolean).length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setIsTableFullscreen(false)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500 text-xs font-bold transition-all"
                                >
                                    <Minimize2 size={14} /> Thu nhỏ
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Filter bar - Glassmorphism style */}
                    {(showTableFilters || !isTableFullscreen) && (
                        <div className={clsx(
                            "relative z-30 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 border-b shrink-0",
                            isTableFullscreen
                                ? "border-cyan-200/40 bg-gradient-to-r from-cyan-50 via-white/80 to-indigo-50 backdrop-blur-xl"
                                : "border-cyan-200/30 dark:border-slate-600/30 bg-gradient-to-r from-cyan-50/80 via-white/60 to-indigo-50/80 dark:from-cyan-900/30 dark:via-slate-800/50 dark:to-indigo-900/30 backdrop-blur-xl rounded-t-2xl"
                        )} style={{ boxShadow: '0 4px 30px rgba(6,182,212,0.08), 0 1px 3px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)' }}>

                            {/* ── Mobile Row 1: LỌC + Xóa lọc + Count ── */}
                            <div className="flex items-center gap-2 sm:contents w-full sm:w-auto">
                            {/* Filter icon label */}
                            <div className={clsx(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all",
                                hasActiveTableFilters
                                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/25"
                                    : "bg-white/60 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 border-white/50 dark:border-slate-600/50"
                            )} style={hasActiveTableFilters ? {} : { backdropFilter: 'blur(8px)' }}>
                                <Filter size={13} className={hasActiveTableFilters ? "animate-pulse" : ""} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Lọc</span>
                            </div>
                            {/* Clear filters + Results counter — pushed right on desktop, in Row 1 on mobile */}
                            <div className="flex items-center gap-2 ml-auto sm:ml-auto sm:order-last">
                            {hasActiveTableFilters && (
                                <button
                                    onClick={clearAllTableFilters}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 text-red-500 dark:text-red-400 text-[10px] font-bold border border-red-200/60 dark:border-red-500/30 hover:from-red-100 hover:to-pink-100 dark:hover:from-red-900/30 dark:hover:to-pink-900/30 hover:shadow-sm hover:shadow-red-500/10 transition-all duration-200"
                                >
                                    <X size={11} /> Xóa lọc
                                </button>
                            )}
                            {/* Results counter */}
                            <div className="flex items-center gap-2">
                                {hasActiveTableFilters ? (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/15 dark:to-blue-500/15 border border-cyan-200/50 dark:border-cyan-500/30" style={{ backdropFilter: 'blur(8px)' }}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                        <span className="text-[11px] font-black text-cyan-600 dark:text-cyan-400">
                                            {filteredTableOrders.length}
                                        </span>
                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                            / {printOrders.length} đơn
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-[10px] font-bold text-slate-400/70 dark:text-slate-500/70">
                                        {printOrders.length} đơn
                                    </span>
                                )}
                            </div>
                            </div>{/* end clear+counter group */}
                            </div>{/* end mobile row 1 */}

                            {/* ── Mobile Row 2: Date pickers ── */}
                            <div className="flex items-center gap-2 sm:contents w-full sm:w-auto">
                            {/* Date from - Custom date picker */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Từ</span>
                                <div className="relative" ref={dateFromPickerRef}>
                                    <button
                                        onClick={() => { setDateFromPickerOpen(!dateFromPickerOpen); setDateToPickerOpen(false); setBrandDropdownOpen(false); setSkuDropdownOpen(false); }}
                                        className={clsx(
                                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer",
                                            tableFilterDateFrom
                                                ? "border-cyan-300/80 bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 dark:from-cyan-900/30 dark:to-blue-900/30 dark:text-cyan-300 dark:border-cyan-500/50 shadow-md shadow-cyan-500/15"
                                                : dateFromPickerOpen
                                                    ? "border-cyan-300 bg-white/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-200 shadow-md shadow-cyan-500/10"
                                                    : "border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-cyan-200 dark:hover:border-cyan-600/50 hover:shadow-sm"
                                        )}
                                        style={{ backdropFilter: 'blur(12px)' }}
                                    >
                                        <Calendar size={12} className={tableFilterDateFrom ? "text-cyan-500" : "text-slate-400"} />
                                        <span>{tableFilterDateFrom ? new Date(tableFilterDateFrom + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/yyyy'}</span>
                                        <ChevronDown size={11} className={clsx("transition-transform duration-200", dateFromPickerOpen && "rotate-180")} />
                                    </button>
                                    {dateFromPickerOpen && (() => {
                                        const vm = dateFromViewMonth;
                                        const year = vm.getFullYear(); const month = vm.getMonth();
                                        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
                                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                                        const offset = (firstDay + 6) % 7; // shift to Mon=0
                                        const today = new Date(); today.setHours(0,0,0,0);
                                        const selectedDate = tableFilterDateFrom ? new Date(tableFilterDateFrom + 'T00:00:00') : null;
                                        const MONTHS_VI = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
                                        const cells: (number | null)[] = [];
                                        for (let i = 0; i < offset; i++) cells.push(null);
                                        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                                        while (cells.length < 42) cells.push(null);
                                        return (
                                            <div className="absolute top-full left-0 mt-1.5 z-50 w-[280px] rounded-2xl border border-white/40 dark:border-slate-600/40 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,249,255,0.97) 50%, rgba(238,242,255,0.95) 100%)', backdropFilter: 'blur(24px) saturate(180%)', boxShadow: '0 20px 60px -12px rgba(0,0,0,0.18), 0 8px 20px -8px rgba(6,182,212,0.15), inset 0 1px 0 rgba(255,255,255,0.9)' }}>
                                                {/* Header */}
                                                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                                                    <button onClick={() => setDateFromViewMonth(new Date(year, month - 1, 1))} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 transition-all"><ChevronLeft size={15} /></button>
                                                    <span className="text-xs font-bold text-slate-700">{MONTHS_VI[month]} {year}</span>
                                                    <button onClick={() => setDateFromViewMonth(new Date(year, month + 1, 1))} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 transition-all"><ChevronRight size={15} /></button>
                                                </div>
                                                {/* Weekdays */}
                                                <div className="grid grid-cols-7 gap-0 px-3 pb-1">
                                                    {['T2','T3','T4','T5','T6','T7','CN'].map(d => <div key={d} className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider py-1">{d}</div>)}
                                                </div>
                                                {/* Days */}
                                                <div className="grid grid-cols-7 gap-0.5 px-3 pb-2">
                                                    {cells.map((day, i) => {
                                                        if (day === null) return <div key={`e-${i}`} className="w-8 h-8" />;
                                                        const cellDate = new Date(year, month, day);
                                                        const isToday = cellDate.getTime() === today.getTime();
                                                        const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime();
                                                        const maxDate = tableFilterDateTo ? new Date(tableFilterDateTo + 'T00:00:00') : null;
                                                        const isDisabled = maxDate ? cellDate.getTime() > maxDate.getTime() : false;
                                                        return (
                                                            <button key={`d-${day}`} disabled={isDisabled} onClick={() => {
                                                                const m = String(month + 1).padStart(2, '0'); const dd = String(day).padStart(2, '0');
                                                                setTableFilterDateFrom(`${year}-${m}-${dd}`); setDateFromPickerOpen(false);
                                                            }} className={clsx(
                                                                "w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all duration-150",
                                                                isDisabled ? "text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40" :
                                                                isSelected ? "bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/30 scale-110" :
                                                                isToday ? "bg-cyan-100/80 text-cyan-700 font-bold ring-1 ring-cyan-300/50" :
                                                                "text-slate-600 hover:bg-cyan-50/80 hover:text-cyan-700"
                                                            )}>{day}</button>
                                                        );
                                                    })}
                                                </div>
                                                {/* Footer */}
                                                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100/80">
                                                    <button onClick={() => { setTableFilterDateFrom(''); setDateFromPickerOpen(false); }} className="text-[10px] font-bold text-red-400 hover:text-red-500 transition-colors">Xóa</button>
                                                    <button onClick={() => { const t = new Date(); setTableFilterDateFrom(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`); setDateFromPickerOpen(false); }} className="text-[10px] font-bold text-cyan-500 hover:text-cyan-600 transition-colors">Hôm nay</button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Date to - Custom date picker */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Đến</span>
                                <div className="relative" ref={dateToPickerRef}>
                                    <button
                                        onClick={() => { setDateToPickerOpen(!dateToPickerOpen); setDateFromPickerOpen(false); setBrandDropdownOpen(false); setSkuDropdownOpen(false); }}
                                        className={clsx(
                                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer",
                                            tableFilterDateTo
                                                ? "border-cyan-300/80 bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 dark:from-cyan-900/30 dark:to-blue-900/30 dark:text-cyan-300 dark:border-cyan-500/50 shadow-md shadow-cyan-500/15"
                                                : dateToPickerOpen
                                                    ? "border-cyan-300 bg-white/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-200 shadow-md shadow-cyan-500/10"
                                                    : "border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-cyan-200 dark:hover:border-cyan-600/50 hover:shadow-sm"
                                        )}
                                        style={{ backdropFilter: 'blur(12px)' }}
                                    >
                                        <Calendar size={12} className={tableFilterDateTo ? "text-cyan-500" : "text-slate-400"} />
                                        <span>{tableFilterDateTo ? new Date(tableFilterDateTo + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/yyyy'}</span>
                                        <ChevronDown size={11} className={clsx("transition-transform duration-200", dateToPickerOpen && "rotate-180")} />
                                    </button>
                                    {dateToPickerOpen && (() => {
                                        const vm = dateToViewMonth;
                                        const year = vm.getFullYear(); const month = vm.getMonth();
                                        const firstDay = new Date(year, month, 1).getDay();
                                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                                        const offset = (firstDay + 6) % 7;
                                        const today = new Date(); today.setHours(0,0,0,0);
                                        const selectedDate = tableFilterDateTo ? new Date(tableFilterDateTo + 'T00:00:00') : null;
                                        const MONTHS_VI = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
                                        const cells: (number | null)[] = [];
                                        for (let i = 0; i < offset; i++) cells.push(null);
                                        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                                        while (cells.length < 42) cells.push(null);
                                        return (
                                            <div className="absolute top-full left-0 mt-1.5 z-50 w-[280px] rounded-2xl border border-white/40 dark:border-slate-600/40 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,249,255,0.97) 50%, rgba(238,242,255,0.95) 100%)', backdropFilter: 'blur(24px) saturate(180%)', boxShadow: '0 20px 60px -12px rgba(0,0,0,0.18), 0 8px 20px -8px rgba(6,182,212,0.15), inset 0 1px 0 rgba(255,255,255,0.9)' }}>
                                                {/* Header */}
                                                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                                                    <button onClick={() => setDateToViewMonth(new Date(year, month - 1, 1))} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 transition-all"><ChevronLeft size={15} /></button>
                                                    <span className="text-xs font-bold text-slate-700">{MONTHS_VI[month]} {year}</span>
                                                    {(() => { const now = new Date(); const isCurrentOrFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth()); return (
                                                    <button disabled={isCurrentOrFutureMonth} onClick={() => setDateToViewMonth(new Date(year, month + 1, 1))} className={clsx("w-7 h-7 rounded-lg flex items-center justify-center transition-all", isCurrentOrFutureMonth ? "text-slate-200 cursor-not-allowed" : "hover:bg-cyan-50 text-slate-400 hover:text-cyan-600")}><ChevronRight size={15} /></button>
                                                    ); })()}
                                                </div>
                                                {/* Weekdays */}
                                                <div className="grid grid-cols-7 gap-0 px-3 pb-1">
                                                    {['T2','T3','T4','T5','T6','T7','CN'].map(d => <div key={d} className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider py-1">{d}</div>)}
                                                </div>
                                                {/* Days */}
                                                <div className="grid grid-cols-7 gap-0.5 px-3 pb-2">
                                                    {cells.map((day, i) => {
                                                        if (day === null) return <div key={`e-${i}`} className="w-8 h-8" />;
                                                        const cellDate = new Date(year, month, day);
                                                        const isToday = cellDate.getTime() === today.getTime();
                                                        const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime();
                                                        const minDate = tableFilterDateFrom ? new Date(tableFilterDateFrom + 'T00:00:00') : null;
                                                        const isFuture = cellDate.getTime() > today.getTime();
                                                        const isDisabled = isFuture || (minDate ? cellDate.getTime() < minDate.getTime() : false);
                                                        return (
                                                            <button key={`d-${day}`} disabled={isDisabled} onClick={() => {
                                                                const m = String(month + 1).padStart(2, '0'); const dd = String(day).padStart(2, '0');
                                                                setTableFilterDateTo(`${year}-${m}-${dd}`); setDateToPickerOpen(false);
                                                            }} className={clsx(
                                                                "w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all duration-150",
                                                                isDisabled ? "text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40" :
                                                                isSelected ? "bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/30 scale-110" :
                                                                isToday ? "bg-cyan-100/80 text-cyan-700 font-bold ring-1 ring-cyan-300/50" :
                                                                "text-slate-600 hover:bg-cyan-50/80 hover:text-cyan-700"
                                                            )}>{day}</button>
                                                        );
                                                    })}
                                                </div>
                                                {/* Footer */}
                                                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100/80">
                                                    <button onClick={() => { setTableFilterDateTo(''); setDateToPickerOpen(false); }} className="text-[10px] font-bold text-red-400 hover:text-red-500 transition-colors">Xóa</button>
                                                    <button onClick={() => { const t = new Date(); setTableFilterDateTo(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`); setDateToPickerOpen(false); }} className="text-[10px] font-bold text-cyan-500 hover:text-cyan-600 transition-colors">Hôm nay</button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            </div>{/* end mobile row 2 */}

                            {/* Separator - desktop only */}
                            <div className="hidden sm:block w-px h-6 bg-gradient-to-b from-transparent via-slate-300/60 dark:via-slate-600/60 to-transparent order-5" />

                            {/* ── Mobile Row 3: Dropdowns ── */}
                            <div className="flex items-center gap-2 sm:contents order-6 w-full sm:w-auto">
                            {/* Brand dropdown - Custom glassmorphism */}
                            <div className="relative" ref={brandDropdownRef}>
                                <button
                                    onClick={() => { setBrandDropdownOpen(!brandDropdownOpen); setSkuDropdownOpen(false); }}
                                    className={clsx(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer",
                                        tableFilterBrand
                                            ? "border-cyan-300/80 bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 dark:from-cyan-900/30 dark:to-blue-900/30 dark:text-cyan-300 dark:border-cyan-500/50 shadow-md shadow-cyan-500/15"
                                            : brandDropdownOpen
                                                ? "border-cyan-300 bg-white/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-200 shadow-md shadow-cyan-500/10"
                                                : "border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-cyan-200 dark:hover:border-cyan-600/50 hover:shadow-sm"
                                    )}
                                    style={{ backdropFilter: 'blur(12px)' }}
                                >
                                    <Tag size={12} className={tableFilterBrand ? "text-cyan-500" : "text-slate-400"} />
                                    <span className="max-w-[100px] truncate">{tableFilterBrand || 'Nhãn hàng'}</span>
                                    <ChevronDown size={13} className={clsx("transition-transform duration-200", brandDropdownOpen && "rotate-180")} />
                                </button>
                                {/* Dropdown panel */}
                                {brandDropdownOpen && (
                                    <div
                                        className="absolute top-full left-0 mt-1.5 z-50 min-w-[180px] py-1.5 rounded-2xl border border-white/40 dark:border-slate-600/40 overflow-hidden"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(240,249,255,0.95) 50%, rgba(238,242,255,0.92) 100%)',
                                            backdropFilter: 'blur(20px) saturate(180%)',
                                            boxShadow: '0 20px 60px -12px rgba(0,0,0,0.15), 0 8px 20px -8px rgba(6,182,212,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
                                        }}
                                    >
                                        <div className="max-h-[240px] overflow-y-auto overscroll-contain px-1.5">
                                            {/* All option */}
                                            <button
                                                onClick={() => { setTableFilterBrand(''); setBrandDropdownOpen(false); }}
                                                className={clsx(
                                                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                                                    !tableFilterBrand
                                                        ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-700"
                                                        : "text-slate-500 hover:bg-white/80 hover:text-slate-700"
                                                )}
                                            >
                                                <div className={clsx("w-4 h-4 rounded-md flex items-center justify-center text-[9px]", !tableFilterBrand ? "bg-cyan-500 text-white" : "bg-slate-200/60")}>
                                                    {!tableFilterBrand && '✓'}
                                                </div>
                                                Tất cả nhãn hàng
                                            </button>
                                            {/* Divider */}
                                            <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent" />
                                            {uniqueBrands.map(b => (
                                                <button
                                                    key={b}
                                                    onClick={() => { setTableFilterBrand(b); setBrandDropdownOpen(false); }}
                                                    className={clsx(
                                                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                                                        tableFilterBrand === b
                                                            ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-700 dark:text-cyan-300"
                                                            : "text-slate-600 dark:text-slate-300 hover:bg-gradient-to-r hover:from-cyan-50/80 hover:to-blue-50/80 hover:text-cyan-700"
                                                    )}
                                                >
                                                    <div className={clsx("w-4 h-4 rounded-md flex items-center justify-center text-[9px] shrink-0", tableFilterBrand === b ? "bg-cyan-500 text-white shadow-sm shadow-cyan-500/30" : "bg-slate-200/60 dark:bg-slate-600/40")}>
                                                        {tableFilterBrand === b && '✓'}
                                                    </div>
                                                    <span className="truncate">{b}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SKU dropdown - Custom glassmorphism */}
                            <div className="relative" ref={skuDropdownRef}>
                                <button
                                    onClick={() => { setSkuDropdownOpen(!skuDropdownOpen); setBrandDropdownOpen(false); }}
                                    className={clsx(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer",
                                        tableFilterSku
                                            ? "border-cyan-300/80 bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 dark:from-cyan-900/30 dark:to-blue-900/30 dark:text-cyan-300 dark:border-cyan-500/50 shadow-md shadow-cyan-500/15"
                                            : skuDropdownOpen
                                                ? "border-cyan-300 bg-white/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-200 shadow-md shadow-cyan-500/10"
                                                : "border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-cyan-200 dark:hover:border-cyan-600/50 hover:shadow-sm"
                                    )}
                                    style={{ backdropFilter: 'blur(12px)' }}
                                >
                                    <Package size={12} className={tableFilterSku ? "text-cyan-500" : "text-slate-400"} />
                                    <span className="max-w-[140px] truncate">{tableFilterSku || 'SKU'}</span>
                                    <ChevronDown size={13} className={clsx("transition-transform duration-200", skuDropdownOpen && "rotate-180")} />
                                </button>
                                {/* Dropdown panel */}
                                {skuDropdownOpen && (
                                    <div
                                        className="absolute top-full left-0 mt-1.5 z-50 min-w-[220px] py-1.5 rounded-2xl border border-white/40 dark:border-slate-600/40 overflow-hidden"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(240,249,255,0.95) 50%, rgba(238,242,255,0.92) 100%)',
                                            backdropFilter: 'blur(20px) saturate(180%)',
                                            boxShadow: '0 20px 60px -12px rgba(0,0,0,0.15), 0 8px 20px -8px rgba(6,182,212,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
                                        }}
                                    >
                                        <div className="max-h-[240px] overflow-y-auto overscroll-contain px-1.5">
                                            {/* All option */}
                                            <button
                                                onClick={() => { setTableFilterSku(''); setSkuDropdownOpen(false); }}
                                                className={clsx(
                                                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                                                    !tableFilterSku
                                                        ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-700"
                                                        : "text-slate-500 hover:bg-white/80 hover:text-slate-700"
                                                )}
                                            >
                                                <div className={clsx("w-4 h-4 rounded-md flex items-center justify-center text-[9px]", !tableFilterSku ? "bg-cyan-500 text-white" : "bg-slate-200/60")}>
                                                    {!tableFilterSku && '✓'}
                                                </div>
                                                Tất cả SKU
                                            </button>
                                            {/* Divider */}
                                            <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent" />
                                            {uniqueSkus.map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => { setTableFilterSku(s); setSkuDropdownOpen(false); }}
                                                    className={clsx(
                                                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-150",
                                                        tableFilterSku === s
                                                            ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-700 dark:text-cyan-300 font-bold"
                                                            : "text-slate-600 dark:text-slate-300 font-medium hover:bg-gradient-to-r hover:from-cyan-50/80 hover:to-blue-50/80 hover:text-cyan-700 hover:font-semibold"
                                                    )}
                                                >
                                                    <div className={clsx("w-4 h-4 rounded-md flex items-center justify-center text-[9px] shrink-0", tableFilterSku === s ? "bg-cyan-500 text-white shadow-sm shadow-cyan-500/30" : "bg-slate-200/60 dark:bg-slate-600/40")}>
                                                        {tableFilterSku === s && '✓'}
                                                    </div>
                                                    <span className="font-mono text-[11px] truncate">{s}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Person dropdown - Custom glassmorphism */}
                            <div className="relative" ref={personDropdownRef}>
                                <button
                                    onClick={() => { setPersonDropdownOpen(!personDropdownOpen); setBrandDropdownOpen(false); setSkuDropdownOpen(false); setDateFromPickerOpen(false); setDateToPickerOpen(false); }}
                                    className={clsx(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer",
                                        tableFilterPerson
                                            ? "border-cyan-300/80 bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 dark:from-cyan-900/30 dark:to-blue-900/30 dark:text-cyan-300 dark:border-cyan-500/50 shadow-md shadow-cyan-500/15"
                                            : personDropdownOpen
                                                ? "border-cyan-300 bg-white/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-200 shadow-md shadow-cyan-500/10"
                                                : "border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-cyan-200 dark:hover:border-cyan-600/50 hover:shadow-sm"
                                    )}
                                    style={{ backdropFilter: 'blur(12px)' }}
                                >
                                    <Users size={12} className={tableFilterPerson ? "text-cyan-500" : "text-slate-400"} />
                                    <span className="max-w-[100px] truncate">{tableFilterPerson || 'Người đặt'}</span>
                                    <ChevronDown size={13} className={clsx("transition-transform duration-200", personDropdownOpen && "rotate-180")} />
                                </button>
                                {personDropdownOpen && (
                                    <div
                                        className="absolute top-full left-0 mt-1.5 z-50 min-w-[180px] py-1.5 rounded-2xl border border-white/40 dark:border-slate-600/40 overflow-hidden"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(240,249,255,0.95) 50%, rgba(238,242,255,0.92) 100%)',
                                            backdropFilter: 'blur(20px) saturate(180%)',
                                            boxShadow: '0 20px 60px -12px rgba(0,0,0,0.15), 0 8px 20px -8px rgba(6,182,212,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
                                        }}
                                    >
                                        <div className="max-h-[240px] overflow-y-auto overscroll-contain px-1.5">
                                            <button
                                                onClick={() => { setTableFilterPerson(''); setPersonDropdownOpen(false); }}
                                                className={clsx(
                                                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                                                    !tableFilterPerson
                                                        ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-700"
                                                        : "text-slate-500 hover:bg-white/80 hover:text-slate-700"
                                                )}
                                            >
                                                <div className={clsx("w-4 h-4 rounded-md flex items-center justify-center text-[9px]", !tableFilterPerson ? "bg-cyan-500 text-white" : "bg-slate-200/60")}>
                                                    {!tableFilterPerson && '\u2713'}
                                                </div>
                                                Tất cả người đặt
                                            </button>
                                            <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent" />
                                            {uniquePersons.map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => { setTableFilterPerson(p); setPersonDropdownOpen(false); }}
                                                    className={clsx(
                                                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                                                        tableFilterPerson === p
                                                            ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-700 dark:text-cyan-300"
                                                            : "text-slate-600 dark:text-slate-300 hover:bg-gradient-to-r hover:from-cyan-50/80 hover:to-blue-50/80 hover:text-cyan-700"
                                                    )}
                                                >
                                                    <div className={clsx("w-4 h-4 rounded-md flex items-center justify-center text-[9px] shrink-0", tableFilterPerson === p ? "bg-cyan-500 text-white shadow-sm shadow-cyan-500/30" : "bg-slate-200/60 dark:bg-slate-600/40")}>
                                                        {tableFilterPerson === p && '\u2713'}
                                                    </div>
                                                    <span className="truncate">{p}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            </div>{/* end mobile row 3 */}
                        </div>
                    )}

                    {/* Action toolbar - always visible */}
                    <div className="relative z-10 flex flex-wrap items-center gap-3 px-5 py-2 border-b shrink-0 bg-gradient-to-r from-slate-50/90 via-white/70 to-slate-50/90 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-800/60 backdrop-blur-xl border-slate-200/40 dark:border-slate-700/30" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' }}>
                            {selectedRows.size > 0 && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center text-[9px] font-black shadow-sm shadow-indigo-500/30">{selectedRows.size}</div>
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">đơn đã chọn</span>
                                    </div>
                                    <div className="w-px h-5 bg-slate-200/60 dark:bg-slate-600/30" />
                                </>
                            )}
                            <button
                                onClick={() => {
                                    const rows = filteredTableOrders.filter(po => selectedRows.has(po.id));
                                    const csv = ['Mã đơn,Ngày tạo,Người đặt,Nhãn hàng,Chủng loại,SKU,Tên sản phẩm,Kích thước,ĐVT,Chất liệu,SL đặt in,SL giao,Đơn giá,Thành tiền,Trạng thái'];
                                    rows.forEach(po => {
                                        csv.push([`DH${String(po.rowIndex-1).padStart(4,'0')}`, po.timestamp?.split(' ')[0]||'', po.person||'', po.brand||'', po.category||'', po.sku||'', `"${(po.productName||'').replace(/"/g,'""')}"`, po.size||'', po.unit||'', po.material||'', po.quantity||'', po.deliveryQuantity||'', po.unitPrice?.toString()||'', po.totalPrice?.toString()||'', po.status||''].join(','));
                                    });
                                    const blob = new Blob(['\uFEFF'+csv.join('\n')], {type:'text/csv;charset=utf-8;'});
                                    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`bao_cao_don_in_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 border-indigo-200/60 dark:border-indigo-500/30 bg-white/80 dark:bg-slate-800/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:shadow-sm"
                                style={{ backdropFilter: 'blur(8px)' }}
                            >
                                <BarChart3 size={12} /> Xuất báo cáo
                            </button>
                            <button
                                onClick={() => {
                                    const rows = filteredTableOrders.filter(po => selectedRows.has(po.id));
                                    let html = `<h2 style="text-align:center;color:#0e7490;margin-bottom:4px">PHIẾU XUẤT KHO</h2><p style="text-align:center;color:#666;font-size:12px">Ngày: ${new Date().toLocaleDateString('vi-VN')}</p>`;
                                    html += '<table style="width:100%;border-collapse:collapse;margin-top:12px"><tr><th style="border:1px solid #ddd;padding:8px;background:#f0f9ff;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">STT</th><th style="border:1px solid #ddd;padding:8px;background:#f0f9ff;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">Mã đơn</th><th style="border:1px solid #ddd;padding:8px;background:#f0f9ff;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">SKU</th><th style="border:1px solid #ddd;padding:8px;background:#f0f9ff;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">Tên sản phẩm</th><th style="border:1px solid #ddd;padding:8px;background:#f0f9ff;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">ĐVT</th><th style="border:1px solid #ddd;padding:8px;background:#f0f9ff;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">SL đặt in</th><th style="border:1px solid #ddd;padding:8px;background:#f0f9ff;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">SL giao</th><th style="border:1px solid #ddd;padding:8px;background:#f0f9ff;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">Ghi chú</th></tr>';
                                    rows.forEach((po,i) => {
                                        html += `<tr><td style="border:1px solid #ddd;padding:8px;font-size:12px">${i+1}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">DH${String(po.rowIndex-1).padStart(4,'0')}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.sku||''}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.productName||''}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.unit||''}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.quantity||''}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.deliveryQuantity||''}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.note||''}</td></tr>`;
                                    });
                                    html += '</table><div style="display:flex;justify-content:space-between;margin-top:50px"><div style="text-align:center"><strong>Người lập phiếu</strong><br><br><br><br>_______________</div><div style="text-align:center"><strong>Thủ kho</strong><br><br><br><br>_______________</div><div style="text-align:center"><strong>Người nhận</strong><br><br><br><br>_______________</div></div>';
                                    setPrintPreviewModal({ title: 'Phiếu xuất kho', html });
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 border-emerald-200/60 dark:border-emerald-500/30 bg-white/80 dark:bg-slate-800/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:shadow-sm"
                                style={{ backdropFilter: 'blur(8px)' }}
                            >
                                <Truck size={12} /> Phiếu xuất kho
                            </button>
                            <button
                                onClick={() => {
                                    const rows = filteredTableOrders.filter(po => selectedRows.has(po.id));
                                    let html = `<h2 style="text-align:center;color:#a16207;margin-bottom:4px">PHIẾU NHẬP KHO</h2><p style="text-align:center;color:#666;font-size:12px">Ngày: ${new Date().toLocaleDateString('vi-VN')}</p>`;
                                    html += '<table style="width:100%;border-collapse:collapse;margin-top:12px"><tr><th style="border:1px solid #ddd;padding:8px;background:#fefce8;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">STT</th><th style="border:1px solid #ddd;padding:8px;background:#fefce8;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">Mã đơn</th><th style="border:1px solid #ddd;padding:8px;background:#fefce8;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">SKU</th><th style="border:1px solid #ddd;padding:8px;background:#fefce8;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">Tên sản phẩm</th><th style="border:1px solid #ddd;padding:8px;background:#fefce8;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">ĐVT</th><th style="border:1px solid #ddd;padding:8px;background:#fefce8;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">SL nhập</th><th style="border:1px solid #ddd;padding:8px;background:#fefce8;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">Nhãn hàng</th><th style="border:1px solid #ddd;padding:8px;background:#fefce8;font-weight:700;text-transform:uppercase;font-size:10px;text-align:left">Ghi chú</th></tr>';
                                    rows.forEach((po,i) => {
                                        html += `<tr><td style="border:1px solid #ddd;padding:8px;font-size:12px">${i+1}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">DH${String(po.rowIndex-1).padStart(4,'0')}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.sku||''}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.productName||''}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.unit||''}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.deliveryQuantity||po.quantity||''}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.brand||''}</td><td style="border:1px solid #ddd;padding:8px;font-size:12px">${po.note||''}</td></tr>`;
                                    });
                                    html += '</table><div style="display:flex;justify-content:space-between;margin-top:50px"><div style="text-align:center"><strong>Người lập phiếu</strong><br><br><br><br>_______________</div><div style="text-align:center"><strong>Thủ kho</strong><br><br><br><br>_______________</div><div style="text-align:center"><strong>Người giao</strong><br><br><br><br>_______________</div></div>';
                                    setPrintPreviewModal({ title: 'Phiếu nhập kho', html });
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 border-amber-200/60 dark:border-amber-500/30 bg-white/80 dark:bg-slate-800/60 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:shadow-sm"
                                style={{ backdropFilter: 'blur(8px)' }}
                            >
                                <ShoppingCart size={12} /> Phiếu nhập kho
                            </button>
                            <button
                                onClick={() => {
                                    const rows = filteredTableOrders.filter(po => selectedRows.has(po.id));
                                    let html = `<h3 style="text-align:center;margin-bottom:4px">DANH SÁCH ĐƠN ĐẶT IN</h3><p style="text-align:center;font-size:11px;color:#666">Ngày in: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}</p>`;
                                    html += '<table style="width:100%;border-collapse:collapse;margin-top:12px"><tr><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:0.5px;text-align:left">STT</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:left">Mã</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:left">Ngày</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:left">Người đặt</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:left">Nhãn hàng</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:left">SKU</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:left">Sản phẩm</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:right">SL đặt</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:right">SL giao</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:right">Đơn giá</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:right">Thành tiền</th><th style="border:1px solid #ccc;padding:6px 8px;background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:9px;text-align:left">Trạng thái</th></tr>';
                                    rows.forEach((po,i) => {
                                        const bgRow = i % 2 === 1 ? ' background:#fafafa;' : '';
                                        html += `<tr><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;${bgRow}">${i+1}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;${bgRow}">DH${String(po.rowIndex-1).padStart(4,'0')}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;${bgRow}">${po.timestamp?.split(' ')[0]||''}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;${bgRow}">${po.person||''}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;${bgRow}">${po.brand||''}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;${bgRow}">${po.sku||''}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;${bgRow}">${po.productName||''}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;text-align:right;${bgRow}">${po.quantity||''}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;text-align:right;${bgRow}">${po.deliveryQuantity||''}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;text-align:right;${bgRow}">${po.unitPrice||''}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;text-align:right;${bgRow}">${po.totalPrice||''}</td><td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;${bgRow}">${po.status||''}</td></tr>`;
                                    });
                                    html += '</table>';
                                    setPrintPreviewModal({ title: 'In đơn hàng', html });
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 border-cyan-200/60 dark:border-cyan-500/30 bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/30 hover:from-cyan-600 hover:to-blue-600"
                            >
                                <Printer size={12} /> In
                            </button>
                            {selectedRows.size > 0 && (
                                <div className="ml-auto">
                                    <button onClick={() => setSelectedRows(new Set())} className="text-[10px] font-bold text-slate-400 hover:text-red-400 transition-colors">Bỏ chọn tất cả</button>
                                </div>
                            )}
                        </div>

                    {/* Print Preview Modal */}
                    {printPreviewModal && ReactDOM.createPortal(
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setPrintPreviewModal(null)}>
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                            <div
                                className="relative w-[90vw] max-w-[900px] max-h-[90vh] flex flex-col rounded-2xl border border-white/30 overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.98) 100%)',
                                    boxShadow: '0 25px 80px -12px rgba(0,0,0,0.3), 0 10px 30px -10px rgba(6,182,212,0.15), inset 0 1px 0 rgba(255,255,255,0.9)',
                                }}
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-cyan-50/50 shrink-0">
                                    <h3 className="text-sm font-black text-slate-700">{printPreviewModal.title}</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const iframe = document.createElement('iframe');
                                                iframe.style.position = 'fixed';
                                                iframe.style.right = '0';
                                                iframe.style.bottom = '0';
                                                iframe.style.width = '0';
                                                iframe.style.height = '0';
                                                iframe.style.border = 'none';
                                                iframe.style.opacity = '0';
                                                document.body.appendChild(iframe);
                                                const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
                                                if (!iDoc) { document.body.removeChild(iframe); return; }
                                                iDoc.open();
                                                iDoc.write(`<html><head><title>${printPreviewModal.title}</title><style>body{font-family:'Be Vietnam Pro',sans-serif;padding:30px;margin:0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:6px 10px;text-align:left;font-size:12px}th{background:#f1f5f9;font-weight:700}h2{margin:0}p{margin:4px 0}@page{margin:15mm}</style></head><body>${printPreviewModal.html}</body></html>`);
                                                iDoc.close();
                                                iframe.onload = () => {
                                                    setTimeout(() => {
                                                        iframe.contentWindow?.focus();
                                                        iframe.contentWindow?.print();
                                                        setTimeout(() => { document.body.removeChild(iframe); }, 1000);
                                                    }, 300);
                                                };
                                                // Fallback for browsers that don't fire onload for about:blank iframes
                                                setTimeout(() => {
                                                    try {
                                                        iframe.contentWindow?.focus();
                                                        iframe.contentWindow?.print();
                                                    } catch (e) { /* ignore */ }
                                                    setTimeout(() => { try { document.body.removeChild(iframe); } catch(e) { /* ignore */ } }, 1000);
                                                }, 500);
                                            }}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 hover:shadow-lg hover:from-cyan-600 hover:to-blue-600 transition-all"
                                        >
                                            <Printer size={13} /> In
                                        </button>
                                        <button
                                            onClick={() => setPrintPreviewModal(null)}
                                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                                {/* Content */}
                                <div className="flex-1 overflow-auto p-6" ref={printPreviewRef}>
                                    <div style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }} dangerouslySetInnerHTML={{ __html: printPreviewModal.html }} />
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    <div className={clsx("overflow-auto", isTableFullscreen && "flex-1")}>
                        <table className="w-full text-sm" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                            <thead className="sticky top-0 z-10">
                                <tr className={clsx(
                                    "border-b border-slate-200",
                                    isTableFullscreen
                                        ? "bg-slate-50"
                                        : "bg-slate-50/95 dark:bg-slate-900/95 dark:border-slate-700 backdrop-blur-sm"
                                )}>
                                    {/* Checkbox column - sticky */}
                                    <th className={clsx(
                                        "px-3 py-3 w-10 text-center sticky left-0 z-20",
                                        isTableFullscreen ? "bg-slate-50" : "bg-slate-50 dark:bg-slate-900"
                                    )} style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.06)' }}>
                                        <label className="cursor-pointer inline-flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={isAllSelected}
                                                ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                                                onChange={toggleSelectAll}
                                                className="w-3.5 h-3.5 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400/50 cursor-pointer accent-cyan-500"
                                            />
                                        </label>
                                    </th>
                                    {['Mã đơn', 'Ngày tạo', 'Người đặt', 'Nhãn hàng', 'Chủng loại', 'SKU', 'Tên sản phẩm', 'Kích thước', 'ĐVT', 'Chất liệu', 'SL đặt in', 'SL giao', 'Ngày cần giao', 'Dự kiến giao', 'Ghi chú', 'Đơn giá', 'Thành tiền', 'Trạng thái', 'Lý do hủy', 'Cập nhật bởi', 'Cập nhật lúc'].map(h => (
                                        <th key={h} className={clsx(
                                            "px-3 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap",
                                            (h === 'Đơn giá' || h === 'Thành tiền') ? 'text-right' : 'text-left',
                                            isTableFullscreen ? "text-slate-500" : "text-slate-500"
                                        )}>{h}</th>
                                    ))}
                                    {canEdit && (
                                        <th className={clsx(
                                            "px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider whitespace-nowrap sticky right-0",
                                            isTableFullscreen ? "text-slate-500 bg-slate-50" : "text-slate-500 bg-slate-50/95 dark:bg-slate-900/95"
                                        )} style={{ boxShadow: '-4px 0 8px -2px rgba(0,0,0,0.06)' }}>Thao tác</th>
                                    )}
                                </tr>
                                {/* Summary / Totals row */}
                                <tr className={clsx(
                                    "border-b-2",
                                    isTableFullscreen
                                        ? "bg-gradient-to-r from-cyan-50/80 via-blue-50/50 to-indigo-50/80 border-cyan-200/60"
                                        : "bg-gradient-to-r from-cyan-50/60 via-blue-50/40 to-indigo-50/60 dark:from-cyan-950/30 dark:via-blue-950/20 dark:to-indigo-950/30 border-cyan-200/40 dark:border-cyan-700/30"
                                )}>
                                    {/* Checkbox col */}
                                    <td className={clsx(
                                        "px-3 py-1.5 text-center sticky left-0 z-20 text-[10px] font-black",
                                        isTableFullscreen ? "bg-cyan-50/90 text-cyan-600" : "bg-cyan-50/90 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400"
                                    )} style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.06)' }}>
                                        Σ
                                    </td>
                                    {/* Mã đơn → count */}
                                    <td className={clsx("px-3 py-1.5 text-[10px] font-extrabold whitespace-nowrap", isTableFullscreen ? "text-slate-600" : "text-slate-600 dark:text-slate-300")}>
                                        {tableSummary.n} đơn
                                    </td>
                                    {/* Ngày tạo */}
                                    <td className="px-3 py-1.5 text-[10px] text-slate-400">—</td>
                                    {/* Người đặt */}
                                    <td className={clsx("px-3 py-1.5 text-[10px] font-bold whitespace-nowrap", isTableFullscreen ? "text-violet-600" : "text-violet-600 dark:text-violet-400")}>
                                        {tableSummary.persons > 0 ? `${tableSummary.persons} người` : '—'}
                                    </td>
                                    {/* Nhãn hàng */}
                                    <td className={clsx("px-3 py-1.5 text-[10px] font-bold whitespace-nowrap", isTableFullscreen ? "text-slate-700" : "text-slate-700 dark:text-slate-300")}>
                                        {tableSummary.brands > 0 ? `${tableSummary.brands} nhãn` : '—'}
                                    </td>
                                    {/* Chủng loại */}
                                    <td className={clsx("px-3 py-1.5 text-[10px] font-bold whitespace-nowrap", isTableFullscreen ? "text-slate-600" : "text-slate-600 dark:text-slate-400")}>
                                        {tableSummary.categories > 0 ? `${tableSummary.categories} loại` : '—'}
                                    </td>
                                    {/* SKU */}
                                    <td className={clsx("px-3 py-1.5 text-[10px] font-bold whitespace-nowrap", isTableFullscreen ? "text-slate-500" : "text-slate-500 dark:text-slate-400")}>
                                        {tableSummary.skus > 0 ? `${tableSummary.skus} SKU` : '—'}
                                    </td>
                                    {/* Tên sản phẩm */}
                                    <td className={clsx("px-3 py-1.5 text-[10px] font-bold whitespace-nowrap", isTableFullscreen ? "text-slate-600" : "text-slate-600 dark:text-slate-300")}>
                                        {tableSummary.products > 0 ? `${tableSummary.products} SP` : '—'}
                                    </td>
                                    {/* Kích thước */}
                                    <td className="px-3 py-1.5 text-[10px] text-slate-400">—</td>
                                    {/* ĐVT */}
                                    <td className="px-3 py-1.5 text-[10px] text-slate-400">—</td>
                                    {/* Chất liệu */}
                                    <td className={clsx("px-3 py-1.5 text-[10px] font-bold whitespace-nowrap", isTableFullscreen ? "text-slate-500" : "text-slate-500 dark:text-slate-400")}>
                                        {tableSummary.materials > 0 ? `${tableSummary.materials} loại` : '—'}
                                    </td>
                                    {/* SL đặt in → SUM */}
                                    <td className={clsx("px-3 py-1.5 text-[11px] font-black whitespace-nowrap", isTableFullscreen ? "text-cyan-700" : "text-cyan-700 dark:text-cyan-300")}>
                                        {tableSummary.sumQty > 0 ? tableSummary.sumQty.toLocaleString('vi-VN') : '—'}
                                    </td>
                                    {/* SL giao → SUM */}
                                    <td className={clsx("px-3 py-1.5 text-[11px] font-black whitespace-nowrap", isTableFullscreen ? "text-green-700" : "text-green-700 dark:text-green-300")}>
                                        {tableSummary.sumDeliveryQty > 0 ? tableSummary.sumDeliveryQty.toLocaleString('vi-VN') : '—'}
                                    </td>
                                    {/* Ngày cần giao */}
                                    <td className="px-3 py-1.5 text-[10px] text-slate-400">—</td>
                                    {/* Dự kiến giao */}
                                    <td className="px-3 py-1.5 text-[10px] text-slate-400">—</td>
                                    {/* Ghi chú */}
                                    <td className="px-3 py-1.5 text-[10px] text-slate-400">—</td>
                                    {/* Đơn giá */}
                                    <td className="px-3 py-1.5 text-[10px] text-right text-slate-400">—</td>
                                    {/* Thành tiền → SUM */}
                                    <td className={clsx("px-3 py-1.5 text-[11px] font-black whitespace-nowrap text-right", isTableFullscreen ? "text-indigo-700" : "text-indigo-700 dark:text-indigo-300")}>
                                        {tableSummary.sumTotal > 0 ? formatCurrency(tableSummary.sumTotal) : '—'}
                                    </td>
                                    {/* Trạng thái */}
                                    <td className="px-3 py-1.5 text-[10px] text-slate-400">—</td>
                                    {/* Lý do hủy */}
                                    <td className="px-3 py-1.5 text-[10px] text-slate-400">—</td>
                                    {/* Cập nhật bởi */}
                                    <td className="px-3 py-1.5 text-[10px] text-slate-400">—</td>
                                    {/* Cập nhật lúc */}
                                    <td className="px-3 py-1.5 text-[10px] text-slate-400">—</td>
                                    {/* Thao tác */}
                                    {canEdit && (
                                        <td className={clsx(
                                            "px-3 py-1.5 sticky right-0 z-20",
                                            isTableFullscreen ? "bg-cyan-50/90" : "bg-cyan-50/90 dark:bg-cyan-950/60"
                                        )} style={{ boxShadow: '-4px 0 8px -2px rgba(0,0,0,0.06)' }}></td>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTableOrders.map((po) => {
                                    const si = getPrintStatusInfo(po.status);
                                    const personColor = getPersonColor(po.person);
                                    return (
                                        <tr key={po.id} className={clsx(
                                            "border-b transition-colors",
                                            po.status === 'Đã hủy'
                                                ? isTableFullscreen
                                                    ? "border-red-200 bg-red-50/70 hover:bg-red-100/70"
                                                    : "border-red-200 dark:border-red-500/20 bg-red-50/60 dark:bg-red-500/8 hover:bg-red-100/60 dark:hover:bg-red-500/12"
                                            : po.status === 'Hoàn thành'
                                                ? isTableFullscreen
                                                    ? "border-green-200 bg-green-50/60 hover:bg-green-100/60"
                                                    : "border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-500/5 hover:bg-green-100/50"
                                            : po.status === 'Đã đặt in'
                                                ? isTableFullscreen
                                                    ? "border-blue-200 bg-blue-50/60 hover:bg-blue-100/60"
                                                    : "border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 hover:bg-blue-100/50"
                                            : (!po.status || po.status === 'Chưa xử lý')
                                                ? isTableFullscreen
                                                    ? "border-amber-200 bg-amber-50/80 hover:bg-amber-100/80"
                                                    : "border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 hover:bg-amber-100/70 dark:hover:bg-amber-500/10"
                                            : isTableFullscreen
                                                ? "border-slate-100 bg-white hover:bg-slate-50/80"
                                                : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                                        )}>
                                            {/* Checkbox - sticky */}
                                            <td className={clsx(
                                                "px-3 py-2.5 w-10 text-center sticky left-0 z-[5]",
                                                selectedRows.has(po.id)
                                                    ? isTableFullscreen ? "bg-cyan-50" : "bg-cyan-50 dark:bg-cyan-900/30"
                                                    : po.status === 'Đã hủy'
                                                        ? isTableFullscreen ? "bg-red-50" : "bg-red-50 dark:bg-red-950/40"
                                                    : po.status === 'Hoàn thành'
                                                        ? isTableFullscreen ? "bg-green-50" : "bg-green-50 dark:bg-green-950/40"
                                                    : po.status === 'Đã đặt in'
                                                        ? isTableFullscreen ? "bg-blue-50" : "bg-blue-50 dark:bg-blue-950/40"
                                                    : (!po.status || po.status === 'Chưa xử lý')
                                                        ? isTableFullscreen ? "bg-amber-50" : "bg-amber-50 dark:bg-amber-950/40"
                                                        : isTableFullscreen ? "bg-white" : "bg-white dark:bg-slate-900"
                                            )} style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.06)' }}>
                                                <label className="cursor-pointer inline-flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRows.has(po.id)}
                                                        onChange={() => toggleSelectRow(po.id)}
                                                        className="w-3.5 h-3.5 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400/50 cursor-pointer accent-cyan-500"
                                                    />
                                                </label>
                                            </td>
                                            <td className={clsx("px-3 py-2.5 text-xs font-bold whitespace-nowrap", isTableFullscreen ? "text-slate-400" : "text-slate-400")}>DH{String(po.rowIndex - 1).padStart(4, '0')}</td>
                                            <td className={clsx("px-3 py-2.5 text-xs whitespace-nowrap", isTableFullscreen ? "text-slate-500" : "text-slate-400")}>{po.timestamp ? po.timestamp.split(' ')[0] : '—'}</td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <span className={clsx('px-2 py-0.5 rounded-lg text-[11px] font-bold border', personColor.bg, personColor.text, personColor.border)}>
                                                    {po.person || '—'}
                                                </span>
                                            </td>
                                            <td className={clsx("px-3 py-2.5 text-sm font-bold whitespace-nowrap", isTableFullscreen ? "text-slate-800" : "text-slate-800 dark:text-white")}>{po.brand || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-sm whitespace-nowrap", isTableFullscreen ? "text-slate-600" : "text-slate-600 dark:text-slate-300")}>{po.category || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-xs font-mono whitespace-nowrap", isTableFullscreen ? "text-slate-500" : "text-slate-500")}>{po.sku || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-sm font-semibold whitespace-nowrap", isTableFullscreen ? "text-slate-700" : "text-slate-700 dark:text-slate-200")}>{po.productName || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-sm whitespace-nowrap", isTableFullscreen ? "text-slate-600" : "text-slate-600 dark:text-slate-300")}>{po.size || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-sm whitespace-nowrap", isTableFullscreen ? "text-slate-500" : "text-slate-500")}>{po.unit || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-sm whitespace-nowrap", isTableFullscreen ? "text-slate-600" : "text-slate-600 dark:text-slate-300")}>{po.material || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-sm font-bold whitespace-nowrap", isTableFullscreen ? "text-cyan-600" : "text-cyan-600 dark:text-cyan-400")}>{po.quantity || '—'}</td>
                                            {/* SL giao */}
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <span className={clsx("text-sm font-bold", isTableFullscreen ? "text-green-600" : "text-green-600 dark:text-green-400")}>
                                                    {po.deliveryQuantity || '—'}
                                                </span>
                                            </td>
                                            <td className={clsx("px-3 py-2.5 text-sm whitespace-nowrap", isTableFullscreen ? "text-emerald-600" : "text-emerald-600 dark:text-emerald-400")}>{formatDeliveryDate(po.deliveryDate) || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-sm whitespace-nowrap", isTableFullscreen ? "text-orange-600" : "text-orange-600 dark:text-orange-400")}>{formatDeliveryDate(po.expectedDelivery) || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-sm whitespace-nowrap", isTableFullscreen ? "text-amber-600" : "text-amber-600 dark:text-amber-400")}>{po.note || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-right", isTableFullscreen ? "text-emerald-600" : "text-emerald-600 dark:text-emerald-400")}>{formatCurrency(po.unitPrice)}</td>
                                            <td className={clsx("px-3 py-2.5 text-sm font-bold whitespace-nowrap text-right", isTableFullscreen ? "text-indigo-600" : "text-indigo-600 dark:text-indigo-400")}>{formatCurrency(po.totalPrice)}</td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <span className={clsx("px-2 py-1 rounded-lg text-[11px] font-bold border", si.bg, si.color, si.border)}>{si.label}</span>
                                            </td>
                                            <td className={clsx("px-3 py-2.5 text-xs whitespace-nowrap", isTableFullscreen ? "text-red-500" : "text-red-500 dark:text-red-400")}>{po.cancelReason || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-xs whitespace-nowrap", isTableFullscreen ? "text-slate-500" : "text-slate-400")}>{po.updatedBy || '—'}</td>
                                            <td className={clsx("px-3 py-2.5 text-xs whitespace-nowrap", isTableFullscreen ? "text-slate-500" : "text-slate-400")}>{po.updatedAt ? po.updatedAt.split(' ')[0] : '—'}</td>
                                            {/* Actions column */}
                                            {canEdit && (() => {
                                                const isPopupOpen = tableActionPopup?.id === po.id;
                                                const popupType = tableActionPopup?.type;
                                                const vals = tableActionValues[po.id] || { unitPrice: '', expectedDelivery: '', deliveryQty: '' };
                                                const normalizedSt = (po.status || '').trim().toLowerCase();
                                                const isChuaXuLy = !po.status || normalizedSt === 'chưa xử lý';
                                                const isDaDatIn = normalizedSt.includes('đã đặt in') || normalizedSt.includes('đã xử lý');
                                                const isHoanThanh = normalizedSt.includes('hoàn thành');
                                                const isDaHuy = normalizedSt.includes('hủy');

                                                return (
                                                    <td className={clsx(
                                                        "px-2 py-2 whitespace-nowrap sticky right-0 z-[12]",
                                                        isTableFullscreen
                                                            ? po.status === 'Đã hủy' ? "bg-red-50/95" : isHoanThanh ? "bg-green-50/95" : po.status === 'Đã đặt in' ? "bg-blue-50/95" : isChuaXuLy ? "bg-amber-50/95" : "bg-white/95"
                                                            : po.status === 'Đã hủy' ? "bg-red-50/95 dark:bg-red-900/30" : isHoanThanh ? "bg-green-50/95 dark:bg-green-900/30" : po.status === 'Đã đặt in' ? "bg-blue-50/95 dark:bg-blue-900/30" : isChuaXuLy ? "bg-amber-50/95 dark:bg-amber-900/20" : "bg-white/95 dark:bg-slate-800/95"
                                                    )} style={{ boxShadow: '-4px 0 8px -2px rgba(0,0,0,0.06)' }}>
                                                        <div className="relative">
                                                            <div className="flex items-center gap-1">
                                                                {/* Chưa xử lý → nút Đặt in */}
                                                                {isChuaXuLy && (
                                                                    <button
                                                                        data-popup-trigger={po.id}
                                                                        onClick={() => {
                                                                            setTableActionPopup({ id: po.id, type: 'datIn' });
                                                                            setTableActionValues(prev => ({ ...prev, [po.id]: { unitPrice: '', expectedDelivery: '', deliveryQty: '' } }));
                                                                        }}
                                                                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold border border-blue-200 transition-all whitespace-nowrap"
                                                                    >
                                                                        <Printer size={11} className="inline mr-0.5" />Đặt in
                                                                    </button>
                                                                )}
                                                                {/* Đã đặt in → nút SL giao */}
                                                                {isDaDatIn && (
                                                                    <button
                                                                        data-popup-trigger={po.id}
                                                                        onClick={() => {
                                                                            setTableActionPopup({ id: po.id, type: 'slGiao' });
                                                                            setTableActionValues(prev => ({ ...prev, [po.id]: { unitPrice: '', expectedDelivery: '', deliveryQty: po.deliveryQuantity || '' } }));
                                                                        }}
                                                                        className="px-2 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 text-[10px] font-bold border border-green-200 transition-all whitespace-nowrap"
                                                                    >
                                                                        <Truck size={11} className="inline mr-0.5" />SL giao
                                                                    </button>
                                                                )}
                                                                {isHoanThanh && (
                                                                    <span className="px-2 py-1 rounded-lg bg-green-100 text-green-600 text-[10px] font-bold border border-green-200">
                                                                        <CheckCircle2 size={11} className="inline mr-0.5" />Đã xong
                                                                    </span>
                                                                )}
                                                                {isDaHuy && (
                                                                    <span className="px-2 py-1 rounded-lg bg-red-50 text-red-500 text-[10px] font-bold border border-red-200">
                                                                        <XCircle size={11} className="inline mr-0.5" />Đã hủy
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* ── POPUP FORM (via Portal) ── */}
                                                            {isPopupOpen && ReactDOM.createPortal(
                                                                <>
                                                                    {/* Overlay */}
                                                                    <div className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[2px]" onClick={() => setTableActionPopup(null)} />
                                                                    <div
                                                                        className="fixed z-[9999] w-[calc(100vw-32px)] sm:w-80 rounded-2xl overflow-hidden flex flex-col"
                                                                        style={{
                                                                            maxHeight: window.innerWidth < 640 ? '85vh' : `${Math.min(520, window.innerHeight - 16)}px`,
                                                                            top: (() => {
                                                                                // On mobile: center vertically
                                                                                if (window.innerWidth < 640) return '50%';
                                                                                const btn = document.querySelector(`[data-popup-trigger="${po.id}"]`);
                                                                                if (!btn) return '50%';
                                                                                const rect = btn.getBoundingClientRect();
                                                                                const popupH = popupType === 'datIn' ? 520 : 200;
                                                                                const maxTop = window.innerHeight - popupH - 8;
                                                                                // Try below the button first
                                                                                let t = rect.bottom + 8;
                                                                                // If it would overflow bottom, try above
                                                                                if (t + popupH > window.innerHeight) {
                                                                                    t = rect.top - popupH - 8;
                                                                                }
                                                                                // Clamp to viewport bounds
                                                                                return `${Math.max(8, Math.min(t, maxTop))}px`;
                                                                            })(),
                                                                            left: window.innerWidth < 640 ? '50%' : 'auto',
                                                                            right: (() => {
                                                                                if (window.innerWidth < 640) return 'auto';
                                                                                const btn = document.querySelector(`[data-popup-trigger="${po.id}"]`);
                                                                                if (!btn) return '16px';
                                                                                const rect = btn.getBoundingClientRect();
                                                                                const r = window.innerWidth - rect.right;
                                                                                return `${Math.max(8, Math.min(r, window.innerWidth - 328))}px`;
                                                                            })(),
                                                                            transform: window.innerWidth < 640 ? 'translate(-50%, -50%)' : 'none',
                                                                            boxShadow: '0 25px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)',
                                                                        }}
                                                                    >
                                                                        {/* ── Gradient Header ── */}
                                                                        <div className={clsx(
                                                                            "px-4 py-3 flex items-center justify-between",
                                                                            popupType === 'datIn'
                                                                                ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600"
                                                                                : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
                                                                        )}>
                                                                            {/* Status color bar */}
                                                                            <div className={clsx(
                                                                                "absolute bottom-0 left-0 right-0 h-0.5",
                                                                                popupType === 'datIn' ? "bg-blue-300/50" : "bg-emerald-300/50"
                                                                            )} />
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                                                                                    {popupType === 'datIn' ? <Printer size={14} className="text-white" /> : <Truck size={14} className="text-white" />}
                                                                                </div>
                                                                                <div>
                                                                                    <h4 className="text-sm font-black text-white tracking-wide">
                                                                                        {popupType === 'datIn' ? 'Đặt in' : 'Nhập SL giao'}
                                                                                    </h4>
                                                                                    <p className="text-[10px] text-white/70 font-medium">{po.productName?.substring(0, 32) || 'Sản phẩm'}{(po.productName?.length || 0) > 32 ? '...' : ''}</p>
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => setTableActionPopup(null)}
                                                                                className="w-7 h-7 rounded-lg bg-white/15 backdrop-blur hover:bg-white/30 flex items-center justify-center transition-all"
                                                                            >
                                                                                <X size={14} className="text-white" />
                                                                            </button>
                                                                        </div>

                                                                        {/* ── Body ── */}
                                                                        <div className={clsx(
                                                                            "p-4 overflow-y-auto flex-1 min-h-0",
                                                                            isTableFullscreen ? "bg-white" : "bg-white dark:bg-slate-800"
                                                                        )}>
                                                                            {/* ══ ĐẶT IN FORM ══ */}
                                                                            {popupType === 'datIn' && (() => {
                                                                                const rawPrice = vals.unitPrice || '';
                                                                                const priceNum = parseFloat(rawPrice.replace(/[.,\s]/g, '')) || 0;
                                                                                const qtyNum = parseInt(po.quantity, 10) || 0;
                                                                                const totalNum = qtyNum * priceNum;
                                                                                const isValid = priceNum > 0 && vals.expectedDelivery !== '';
                                                                                const today = new Date(); today.setHours(0,0,0,0);

                                                                                // Calendar helpers
                                                                                const calYear = popupCalMonth.getFullYear();
                                                                                const calMon = popupCalMonth.getMonth();
                                                                                const firstDay = new Date(calYear, calMon, 1).getDay();
                                                                                const daysInMonth = new Date(calYear, calMon + 1, 0).getDate();
                                                                                const startOffset = (firstDay === 0 ? 6 : firstDay - 1); // Monday start
                                                                                const calDays: (number | null)[] = [];
                                                                                for (let i = 0; i < startOffset; i++) calDays.push(null);
                                                                                for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

                                                                                const selectedDateStr = vals.expectedDelivery; // yyyy-MM-dd
                                                                                const selectedDate = selectedDateStr ? new Date(selectedDateStr + 'T00:00:00') : null;

                                                                                const formatDisplayPrice = (v: string) => {
                                                                                    const n = parseFloat(v.replace(/[.,\s]/g, ''));
                                                                                    return isNaN(n) ? v : n.toLocaleString('vi-VN');
                                                                                };

                                                                                return (
                                                                                    <div className="space-y-4">
                                                                                        {/* ── Price Input ── */}
                                                                                        <div>
                                                                                            <label className={clsx("flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mb-1.5", isTableFullscreen ? "text-slate-400" : "text-slate-400 dark:text-slate-500")}>
                                                                                                <Coins size={10} />Đơn giá
                                                                                            </label>
                                                                                            <div className="relative">
                                                                                                <input
                                                                                                    type="text"
                                                                                                    autoFocus
                                                                                                    value={vals.unitPrice}
                                                                                                    onChange={e => {
                                                                                                        const v = e.target.value.replace(/[^0-9]/g, '');
                                                                                                        setTableActionValues(prev => ({ ...prev, [po.id]: { ...prev[po.id], unitPrice: v } }));
                                                                                                    }}
                                                                                                    placeholder="Nhập đơn giá..."
                                                                                                    className={clsx(
                                                                                                        "w-full pl-3 pr-10 py-2.5 text-sm font-bold rounded-xl border-2 focus:outline-none transition-all",
                                                                                                        isTableFullscreen
                                                                                                            ? "border-slate-200 bg-slate-50/80 focus:border-blue-400 focus:bg-white text-slate-800"
                                                                                                            : "border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/50 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-white"
                                                                                                    )}
                                                                                                />
                                                                                                <span className={clsx("absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold", isTableFullscreen ? "text-slate-400" : "text-slate-400 dark:text-slate-500")}>₫</span>
                                                                                            </div>
                                                                                            {priceNum > 0 && (
                                                                                                <p className={clsx("mt-1 text-[10px] font-medium", isTableFullscreen ? "text-slate-400" : "text-slate-400 dark:text-slate-500")}>
                                                                                                    = {formatDisplayPrice(rawPrice)} ₫/đơn vị
                                                                                                </p>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* ── Thành tiền (Total) ── */}
                                                                                        {priceNum > 0 && qtyNum > 0 && (
                                                                                            <div className={clsx(
                                                                                                "rounded-xl p-2.5 flex items-center justify-between",
                                                                                                isTableFullscreen ? "bg-indigo-50 border border-indigo-100" : "bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20"
                                                                                            )}>
                                                                                                <div className="flex items-center gap-1.5">
                                                                                                    <span className={clsx("text-[10px] font-bold uppercase tracking-wider", isTableFullscreen ? "text-indigo-400" : "text-indigo-400 dark:text-indigo-500")}>Thành tiền</span>
                                                                                                    <span className={clsx("text-[10px] font-medium", isTableFullscreen ? "text-slate-400" : "text-slate-400 dark:text-slate-500")}>
                                                                                                        ({formatDisplayPrice(rawPrice)} × {qtyNum})
                                                                                                    </span>
                                                                                                </div>
                                                                                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                                                                                    {totalNum.toLocaleString('vi-VN')} ₫
                                                                                                </span>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* ── Calendar Date Picker ── */}
                                                                                        <div>
                                                                                            <label className={clsx("flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mb-1.5", isTableFullscreen ? "text-slate-400" : "text-slate-400 dark:text-slate-500")}>
                                                                                                <CalendarClock size={10} />Dự kiến giao
                                                                                            </label>

                                                                                            {/* Selected date display */}
                                                                                            {selectedDate && (
                                                                                                <div className={clsx(
                                                                                                    "mb-2 px-3 py-1.5 rounded-xl flex items-center justify-between",
                                                                                                    isTableFullscreen ? "bg-blue-50 border border-blue-200" : "bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30"
                                                                                                )}>
                                                                                                    <span className="text-xs font-bold text-blue-600">
                                                                                                        <Calendar size={11} className="inline mr-1" />
                                                                                                        {selectedDate.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                                                    </span>
                                                                                                    <button onClick={() => setTableActionValues(prev => ({ ...prev, [po.id]: { ...prev[po.id], expectedDelivery: '' } }))} className="text-blue-400 hover:text-blue-600 transition-colors">
                                                                                                        <X size={12} />
                                                                                                    </button>
                                                                                                </div>
                                                                                            )}

                                                                                            {/* Calendar */}
                                                                                            <div className={clsx(
                                                                                                "rounded-xl border overflow-hidden",
                                                                                                isTableFullscreen ? "border-slate-200" : "border-slate-200 dark:border-slate-700"
                                                                                            )}>
                                                                                                {/* Month nav */}
                                                                                                <div className={clsx(
                                                                                                    "flex items-center justify-between px-3 py-2",
                                                                                                    isTableFullscreen ? "bg-slate-50" : "bg-slate-50 dark:bg-slate-900/50"
                                                                                                )}>
                                                                                                    <button
                                                                                                        onClick={() => {
                                                                                                            const prev = new Date(calYear, calMon - 1, 1);
                                                                                                            // Don't go before current month
                                                                                                            if (prev.getFullYear() > today.getFullYear() || (prev.getFullYear() === today.getFullYear() && prev.getMonth() >= today.getMonth())) {
                                                                                                                setPopupCalMonth(prev);
                                                                                                            }
                                                                                                        }}
                                                                                                        className={clsx(
                                                                                                            "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                                                                                                            (calYear === today.getFullYear() && calMon <= today.getMonth())
                                                                                                                ? "text-slate-300 cursor-not-allowed"
                                                                                                                : isTableFullscreen
                                                                                                                    ? "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                                                                                                                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                                                                                        )}
                                                                                                        disabled={calYear === today.getFullYear() && calMon <= today.getMonth()}
                                                                                                    >
                                                                                                        <ChevronLeft size={14} />
                                                                                                    </button>
                                                                                                    <span className={clsx("text-xs font-black tracking-wide", isTableFullscreen ? "text-slate-700" : "text-slate-700 dark:text-slate-200")}>
                                                                                                        {popupCalMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}
                                                                                                    </span>
                                                                                                    <button
                                                                                                        onClick={() => setPopupCalMonth(new Date(calYear, calMon + 1, 1))}
                                                                                                        className={clsx(
                                                                                                            "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                                                                                                            isTableFullscreen
                                                                                                                ? "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                                                                                                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                                                                                        )}
                                                                                                    >
                                                                                                        <ChevronRight size={14} />
                                                                                                    </button>
                                                                                                </div>

                                                                                                {/* Day headers */}
                                                                                                <div className="grid grid-cols-7 gap-0">
                                                                                                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
                                                                                                        <div key={d} className={clsx(
                                                                                                            "text-center text-[9px] font-bold py-1 uppercase tracking-wider",
                                                                                                            d === 'CN'
                                                                                                                ? "text-red-400"
                                                                                                                : d === 'T7'
                                                                                                                    ? "text-orange-400"
                                                                                                                    : isTableFullscreen ? "text-slate-400" : "text-slate-400 dark:text-slate-500"
                                                                                                        )}>
                                                                                                            {d}
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>

                                                                                                {/* Day cells */}
                                                                                                <div className={clsx("grid grid-cols-7 gap-0 p-1", isTableFullscreen ? "bg-white" : "bg-white dark:bg-slate-800")}>
                                                                                                    {calDays.map((day, i) => {
                                                                                                        if (day === null) return <div key={`e-${i}`} className="aspect-square" />;
                                                                                                        const date = new Date(calYear, calMon, day);
                                                                                                        date.setHours(0,0,0,0);
                                                                                                        const isPast = date < today;
                                                                                                        const isToday = date.getTime() === today.getTime();
                                                                                                        const isSelected = selectedDate && date.getTime() === selectedDate.getTime();
                                                                                                        const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
                                                                                                        const isSun = dayOfWeek === 0;
                                                                                                        const isSat = dayOfWeek === 6;

                                                                                                        return (
                                                                                                            <button
                                                                                                                key={day}
                                                                                                                disabled={isPast}
                                                                                                                onClick={() => {
                                                                                                                    const yyyy = calYear.toString();
                                                                                                                    const mm = (calMon + 1).toString().padStart(2, '0');
                                                                                                                    const dd = day.toString().padStart(2, '0');
                                                                                                                    setTableActionValues(prev => ({ ...prev, [po.id]: { ...prev[po.id], expectedDelivery: `${yyyy}-${mm}-${dd}` } }));
                                                                                                                }}
                                                                                                                className={clsx(
                                                                                                                    "aspect-square rounded-lg text-[11px] font-bold flex items-center justify-center transition-all relative",
                                                                                                                    isPast
                                                                                                                        ? "text-slate-300 dark:text-slate-600 cursor-not-allowed line-through"
                                                                                                                        : isSelected
                                                                                                                            ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-110"
                                                                                                                            : isToday
                                                                                                                                ? isTableFullscreen
                                                                                                                                    ? "bg-blue-50 text-blue-600 ring-2 ring-blue-300 font-black"
                                                                                                                                    : "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-2 ring-blue-300 dark:ring-blue-500/40 font-black"
                                                                                                                                : isSun
                                                                                                                                    ? isTableFullscreen
                                                                                                                                        ? "text-red-400 hover:bg-red-50"
                                                                                                                                        : "text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                                                                                                                    : isSat
                                                                                                                                        ? isTableFullscreen
                                                                                                                                            ? "text-orange-400 hover:bg-orange-50"
                                                                                                                                            : "text-orange-400 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                                                                                                                                        : isTableFullscreen
                                                                                                                                            ? "text-slate-700 hover:bg-slate-100"
                                                                                                                                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                                                                                )}
                                                                                                            >
                                                                                                                {day}
                                                                                                            </button>
                                                                                                        );
                                                                                                    })}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* ── Actions ── */}
                                                                                        <div className={clsx(
                                                                                            "rounded-xl p-3 space-y-2",
                                                                                            isTableFullscreen ? "bg-slate-50" : "bg-slate-50 dark:bg-slate-900/50"
                                                                                        )}>
                                                                                            <div className="flex gap-2">
                                                                                                <button
                                                                                                    onClick={() => setTableActionPopup(null)}
                                                                                                    className={clsx(
                                                                                                        "flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                                                                                                        isTableFullscreen
                                                                                                            ? "bg-white border border-slate-200 text-slate-500 hover:bg-slate-100"
                                                                                                            : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600"
                                                                                                    )}
                                                                                                >
                                                                                                    Hủy
                                                                                                </button>
                                                                                                <button
                                                                                                    disabled={!isValid}
                                                                                                    onClick={() => {
                                                                                                        if (!isValid) return;
                                                                                                        handleUpdatePrintOrder(po, { unitPrice: priceNum, totalPrice: totalNum, status: 'Đã đặt in', expectedDelivery: vals.expectedDelivery });
                                                                                                        setTableActionPopup(null);
                                                                                                    }}
                                                                                                    className={clsx(
                                                                                                        "flex-[2] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1",
                                                                                                        isValid
                                                                                                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                                                                                                            : isTableFullscreen
                                                                                                                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                                                                                                : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                                                                                    )}
                                                                                                >
                                                                                                    <CheckCircle2 size={12} />Xác nhận đặt in
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })()}

                                                                            {/* ══ SL GIAO FORM ══ */}
                                                                            {popupType === 'slGiao' && (() => {
                                                                                const qty = vals.deliveryQty || '';
                                                                                const isValid = qty !== '' && !isNaN(Number(qty)) && Number(qty) > 0;
                                                                                return (
                                                                                    <div className="space-y-4">
                                                                                        <div>
                                                                                            <label className={clsx("flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mb-1.5", isTableFullscreen ? "text-slate-400" : "text-slate-400 dark:text-slate-500")}>
                                                                                                <Package size={10} />Số lượng giao
                                                                                            </label>
                                                                                            <div className="relative">
                                                                                                <input
                                                                                                    type="number"
                                                                                                    min="0"
                                                                                                    autoFocus
                                                                                                    value={vals.deliveryQty}
                                                                                                    onChange={e => setTableActionValues(prev => ({ ...prev, [po.id]: { ...prev[po.id], deliveryQty: e.target.value } }))}
                                                                                                    placeholder={`SL đặt: ${po.quantity || '?'}`}
                                                                                                    className={clsx(
                                                                                                        "w-full pl-3 pr-14 py-2.5 text-sm font-bold rounded-xl border-2 focus:outline-none transition-all",
                                                                                                        isTableFullscreen
                                                                                                            ? "border-emerald-200 bg-emerald-50/50 focus:border-emerald-400 focus:bg-white text-emerald-700"
                                                                                                            : "border-emerald-200 dark:border-emerald-600/50 bg-emerald-50/50 dark:bg-emerald-900/20 focus:border-emerald-400 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 text-emerald-700 dark:text-emerald-300"
                                                                                                    )}
                                                                                                />
                                                                                                <span className={clsx("absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold", isTableFullscreen ? "text-slate-400" : "text-slate-400 dark:text-slate-500")}>/ {po.quantity || '?'}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex gap-2">
                                                                                            <button
                                                                                                onClick={() => setTableActionPopup(null)}
                                                                                                className={clsx(
                                                                                                    "flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                                                                                                    isTableFullscreen
                                                                                                        ? "bg-white border border-slate-200 text-slate-500 hover:bg-slate-100"
                                                                                                        : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600"
                                                                                                )}
                                                                                            >
                                                                                                Hủy
                                                                                            </button>
                                                                                            <button
                                                                                                disabled={!isValid}
                                                                                                onClick={() => {
                                                                                                    if (!isValid) return;
                                                                                                    handleUpdatePrintOrder(po, { status: 'Hoàn thành', deliveryQuantity: qty });
                                                                                                    setTableActionPopup(null);
                                                                                                }}
                                                                                                className={clsx(
                                                                                                    "flex-[2] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1",
                                                                                                    isValid
                                                                                                        ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                                                                                                        : isTableFullscreen
                                                                                                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                                                                                            : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                                                                                )}
                                                                                            >
                                                                                                <CheckCircle2 size={12} />Hoàn thành
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                </>,
                                                                document.body
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })()}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                </div>
                </>
            ) : (
                /* ===== CARD VIEW ===== */
                <div className="space-y-5">
                    {printOrders.map((po) => {
                        const effectivePrintStatus = po.status || 'Chưa xử lý';
                        const si = getPrintStatusInfo(effectivePrintStatus);
                        const normalizedStatus = si.label; // Use normalized label for all comparisons
                        const deliveryFormatted = formatDeliveryDate(po.deliveryDate);
                        const isEditing = expandedPrintOrder === po.id;

                        return (
                            <div key={po.id} className={clsx(
                                "relative backdrop-blur-xl rounded-2xl border shadow-sm transition-all duration-300 overflow-hidden",
                                normalizedStatus === 'Chưa xử lý'
                                    ? 'bg-amber-50/60 dark:bg-amber-900/10 border-l-4 border-l-amber-400 border-t-amber-200/60 border-r-amber-200/60 border-b-amber-200/60 dark:border-l-amber-500 dark:border-t-amber-500/20 dark:border-r-amber-500/20 dark:border-b-amber-500/20 hover:border-amber-400 dark:hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/10'
                                : normalizedStatus === 'Đã đặt in'
                                    ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-blue-400 border-t-blue-200/50 border-r-blue-200/50 border-b-blue-200/50 dark:border-l-blue-500 dark:border-t-blue-500/20 dark:border-r-blue-500/20 dark:border-b-blue-500/20 hover:border-blue-400 dark:hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/10'
                                : normalizedStatus === 'Hoàn thành'
                                    ? 'bg-green-50/60 dark:bg-green-900/10 border-l-4 border-l-green-400 border-t-green-200/60 border-r-green-200/60 border-b-green-200/60 dark:border-l-green-500 dark:border-t-green-500/20 dark:border-r-green-500/20 dark:border-b-green-500/20 hover:border-green-400 dark:hover:border-green-500/40 hover:shadow-xl hover:shadow-green-500/10'
                                : normalizedStatus === 'Đã hủy'
                                    ? 'bg-red-50/50 dark:bg-red-900/10 border-l-4 border-l-red-400 border-t-red-200/50 border-r-red-200/50 border-b-red-200/50 dark:border-l-red-500 dark:border-t-red-500/20 dark:border-r-red-500/20 dark:border-b-red-500/20 hover:border-red-400 dark:hover:border-red-500/40 hover:shadow-xl hover:shadow-red-500/10'
                                    : 'bg-white/60 dark:bg-slate-800/60 border-white/50 dark:border-white/10 hover:border-cyan-300 dark:hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/10'
                            )}>
                                {/* Shimmer */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent dark:from-white/5 pointer-events-none rounded-2xl" />

                                {/* Card Header - Status + Person */}
                                <div className="relative flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">DH{String(po.rowIndex - 1).padStart(4, '0')}</span>
                                        {(() => { const pc = getPersonColor(po.person); return (
                                            <span className={clsx('text-[11px] font-bold px-2 py-0.5 rounded-lg border', pc.text, pc.bg, pc.border)}>{po.person || 'N/A'}</span>
                                        ); })()}
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{po.timestamp}</span>
                                    </div>
                                    <span className={clsx("px-2.5 py-1 rounded-xl text-[11px] font-bold border", si.bg, si.color, si.border)}>
                                        {si.label}
                                    </span>
                                </div>

                                {/* ===== DESKTOP CARD BODY (sm+) — 2-row layout ===== */}
                                <div className="hidden sm:block px-5 py-4 space-y-2">
                                    {/* Row 1: Product info */}
                                    <div className="flex flex-row flex-nowrap gap-2 overflow-hidden">
                                        {/* Nhãn hàng */}
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 shrink-0">
                                            <Tag size={12} className="text-indigo-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhãn hàng</p>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[100px]" title={po.brand || 'N/A'}>{po.brand || 'N/A'}</p>
                                            </div>
                                        </div>
                                        {/* Chủng loại */}
                                        {po.category && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 shrink-0">
                                                <Layers size={12} className="text-violet-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chủng loại</p>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[80px]" title={po.category}>{po.category}</p>
                                                </div>
                                            </div>
                                        )}
                                        {/* SKU */}
                                        {po.sku && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 min-w-0 shrink">
                                                <Hash size={12} className="text-cyan-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SKU</p>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]" title={po.sku}>{po.sku}</p>
                                                </div>
                                            </div>
                                        )}
                                        {/* Tên sản phẩm */}
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 min-w-0 flex-1">
                                            <FileText size={12} className="text-slate-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên sản phẩm</p>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate" title={po.productName || 'N/A'}>{po.productName || 'N/A'}</p>
                                            </div>
                                        </div>
                                        {/* Kích thước */}
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 min-w-0 shrink">
                                            <Ruler size={12} className="text-orange-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kích thước</p>
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[130px]" title={po.size || '—'}>{po.size || '—'}</p>
                                            </div>
                                        </div>
                                        {/* Chất liệu */}
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 min-w-0 shrink">
                                            <Scale size={12} className="text-teal-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chất liệu</p>
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]" title={po.material || '—'}>{po.material || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Order/pricing details + Action buttons */}
                                    <div className="flex flex-row flex-nowrap gap-2 items-center overflow-hidden">
                                        {/* SL đặt in */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-50/70 dark:bg-sky-500/5 border border-sky-200/50 dark:border-sky-500/15 shrink-0">
                                            <Package size={12} className="text-sky-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">SL đặt in</p>
                                                <p className="text-sm font-bold text-sky-700 dark:text-sky-300">{po.quantity || '—'}</p>
                                            </div>
                                        </div>
                                        {/* SL giao — input mode or display */}
                                        {enteringDeliveryQty === po.id ? (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green-50/70 dark:bg-green-500/5 border-2 border-green-400 dark:border-green-500/30 shrink-0 animate-in fade-in slide-in-from-left-2 duration-200">
                                                <Truck size={12} className="text-green-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">SL giao</p>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={inlineDeliveryQty[po.id] || ''}
                                                        onChange={e => setInlineDeliveryQty(prev => ({ ...prev, [po.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                                                        className="text-sm font-bold text-green-700 dark:text-green-300 bg-transparent border-none outline-none w-24 placeholder:text-green-300"
                                                        placeholder="Nhập SL..."
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                        ) : (po.deliveryQuantity || normalizedStatus === 'Hoàn thành') ? (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green-50/70 dark:bg-green-500/5 border border-green-200/50 dark:border-green-500/15 shrink-0">
                                                <Truck size={12} className="text-green-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">SL giao</p>
                                                    <p className="text-sm font-bold text-green-700 dark:text-green-300">{po.deliveryQuantity || '—'}</p>
                                                </div>
                                            </div>
                                        ) : null}
                                        {/* ĐVT */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-50/50 dark:bg-cyan-500/5 border border-cyan-200/40 dark:border-cyan-500/15 shrink-0">
                                            <Layers size={12} className="text-cyan-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">ĐVT</p>
                                                <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300">{po.unit || '—'}</p>
                                            </div>
                                        </div>
                                        {/* Đơn giá / Thành tiền */}
                                        {isEditing ? (
                                            <>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-50/70 dark:bg-violet-500/5 border border-violet-200/50 dark:border-violet-500/15 shrink-0">
                                                    <DollarSign size={12} className="text-violet-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Đơn giá</p>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            value={inlineUnitPrices[po.id] || ''}
                                                            onChange={e => setInlineUnitPrices(prev => ({ ...prev, [po.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                                                            className="text-sm font-bold text-violet-700 dark:text-violet-300 bg-transparent border-none outline-none w-24 placeholder:text-violet-300"
                                                            placeholder="Nhập giá..."
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-200/40 dark:border-indigo-500/15 shrink-0">
                                                    <Calculator size={12} className="text-indigo-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Thành tiền</p>
                                                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                                                            {(() => {
                                                                const price = parseFloat((inlineUnitPrices[po.id] || '0').replace(/[.,\s]/g, '')) || 0;
                                                                const qty = parseFloat((po.quantity || '0').replace(/[.,\s]/g, '')) || 0;
                                                                return price > 0 ? formatCurrency(price * qty) : '—';
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>
                                                {deliveryFormatted && (
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/15 shrink-0">
                                                        <CalendarClock size={12} className="text-emerald-500 shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Ngày cần giao</p>
                                                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{deliveryFormatted}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div ref={el => { calendarAnchorRefs.current[po.id] = el; }} className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-50/70 dark:bg-orange-500/5 border border-orange-200/50 dark:border-orange-500/15 shrink-0 cursor-pointer"
                                                    onClick={() => setOpenCalendarId(prev => prev === po.id ? null : po.id)}
                                                >
                                                    <CalendarClock size={12} className="text-orange-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Dự kiến giao</p>
                                                        <p className="text-sm font-bold text-orange-700 dark:text-orange-300">
                                                            {inlineDeliveryDates[po.id]
                                                                ? formatDeliveryDate(inlineDeliveryDates[po.id]) || inlineDeliveryDates[po.id]
                                                                : <span className="text-orange-300 dark:text-orange-500/50">Chọn ngày...</span>}
                                                        </p>
                                                    </div>
                                                    <Calendar size={14} className="text-orange-400 ml-1" />
                                                    {openCalendarId === po.id && (
                                                        <MiniCalendar
                                                            value={inlineDeliveryDates[po.id] || ''}
                                                            onChange={val => setInlineDeliveryDates(prev => ({ ...prev, [po.id]: val }))}
                                                            onClose={() => setOpenCalendarId(null)}
                                                            anchorRef={{ current: calendarAnchorRefs.current[po.id] }}
                                                        />
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-50/50 dark:bg-violet-500/5 border border-violet-200/40 dark:border-violet-500/15 shrink-0">
                                                    <DollarSign size={12} className="text-violet-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Đơn giá</p>
                                                        <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{formatCurrency(po.unitPrice)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-200/40 dark:border-indigo-500/15 shrink-0">
                                                    <Calculator size={12} className="text-indigo-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Thành tiền</p>
                                                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300" title={formatCurrency(po.totalPrice)}>{formatCurrency(po.totalPrice)}</p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        {/* Ngày cần giao — only show outside editing block since editing block has its own */}
                                        {!isEditing && deliveryFormatted && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/15 shrink-0">
                                                <CalendarClock size={12} className="text-emerald-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Ngày cần giao</p>
                                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{deliveryFormatted}</p>
                                                </div>
                                            </div>
                                        )}
                                        {/* Dự kiến giao (read-only, non-editing) */}
                                        {!isEditing && po.expectedDelivery && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-50/70 dark:bg-orange-500/5 border border-orange-200/50 dark:border-orange-500/15 shrink-0">
                                                <CalendarClock size={12} className="text-orange-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Dự kiến giao</p>
                                                    <p className="text-sm font-bold text-orange-700 dark:text-orange-300">{formatDeliveryDate(po.expectedDelivery) || po.expectedDelivery}</p>
                                                </div>
                                            </div>
                                        )}
                                        {/* Ghi chú */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/40 dark:border-amber-500/15 min-w-0 shrink">
                                            <StickyNote size={12} className="text-amber-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Ghi chú</p>
                                                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 truncate max-w-[100px]" title={po.note || '—'}>{po.note || '—'}</p>
                                            </div>
                                        </div>
                                        {/* Lý do hủy — only for cancelled orders */}
                                        {po.status?.trim() === 'Đã hủy' && po.cancelReason && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-50/60 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/15 min-w-0 shrink">
                                                <XCircle size={12} className="text-red-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Lý do hủy</p>
                                                    <p className="text-sm font-medium text-red-700 dark:text-red-300 truncate max-w-[200px]" title={po.cancelReason}>{po.cancelReason}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action buttons — pushed to end */}
                                        {canEdit && (
                                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                {/* Hoàn thành (when editing) */}
                                                {isEditing && (() => {
                                                    const rawPrice = inlineUnitPrices[po.id] || '';
                                                    const priceNum = parseFloat(rawPrice.replace(/[.,\s]/g, '')) || 0;
                                                    const qtyNum = parseInt(po.quantity, 10) || 0;
                                                    const totalNum = qtyNum * priceNum;
                                                    const expectedDelivery = inlineDeliveryDates[po.id] || '';
                                                    const isValid = priceNum > 0 && expectedDelivery !== '';
                                                    return (
                                                        <button
                                                            onClick={() => isValid && handleUpdatePrintOrder(po, { unitPrice: priceNum, totalPrice: totalNum, status: 'Đã đặt in', expectedDelivery })}
                                                            disabled={!isValid}
                                                            title={!isValid ? 'Vui lòng nhập Đơn giá và chọn Dự kiến giao' : 'Hoàn thành đơn hàng'}
                                                            className={clsx(
                                                                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 shrink-0',
                                                                isValid
                                                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                            )}
                                                        >
                                                            <CheckCircle2 size={13} />
                                                            Hoàn thành
                                                        </button>
                                                    );
                                                })()}
                                                {/* Nhập SL giao + Hoàn thành (Đã đặt in, entering delivery qty) */}
                                                {normalizedStatus === 'Đã đặt in' && enteringDeliveryQty === po.id && (() => {
                                                    const qtyVal = inlineDeliveryQty[po.id] || '';
                                                    const isValid = qtyVal.length > 0 && parseInt(qtyVal, 10) > 0;
                                                    return (
                                                        <button
                                                            onClick={() => {
                                                                if (!isValid) return;
                                                                handleUpdatePrintOrder(po, { status: 'Hoàn thành', deliveryQuantity: qtyVal });
                                                                setEnteringDeliveryQty(null);
                                                            }}
                                                            disabled={!isValid}
                                                            className={clsx(
                                                                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all duration-200 shrink-0',
                                                                isValid
                                                                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                            )}
                                                        >
                                                            <CheckCircle2 size={13} />
                                                            Hoàn thành
                                                        </button>
                                                    );
                                                })()}
                                                {/* Chỉnh sửa + Nhập SL giao + Hủy (Đã đặt in) - hidden behind toggle arrow */}
                                                {normalizedStatus === 'Đã đặt in' && !isEditing && enteringDeliveryQty !== po.id && (
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            onClick={() => setShowDesktopActions(prev => prev === po.id ? null : po.id)}
                                                            className={clsx(
                                                                'flex items-center justify-center w-8 h-8 rounded-xl border transition-all duration-200 shrink-0',
                                                                showDesktopActions === po.id
                                                                    ? 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 border-slate-300 dark:border-slate-500'
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300'
                                                            )}
                                                        >
                                                            {showDesktopActions === po.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </button>
                                                        {showDesktopActions === po.id && (
                                                            <>
                                                                <button
                                                                    onClick={() => { setEnteringDeliveryQty(po.id); setInlineDeliveryQty(prev => ({ ...prev, [po.id]: po.deliveryQuantity || '' })); setShowDesktopActions(null); }}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-bold border border-green-200 dark:border-green-500/20 hover:bg-green-100 hover:shadow-md transition-all shrink-0 animate-in fade-in slide-in-from-left-2 duration-200"
                                                                >
                                                                    <Truck size={12} /> Nhập SL giao
                                                                </button>
                                                                <button
                                                                    onClick={() => { setExpandedPrintOrder(po.id); setInlineUnitPrices(prev => ({ ...prev, [po.id]: po.unitPrice ? po.unitPrice.toString() : '' })); setShowDesktopActions(null); }}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-sm font-bold border border-violet-200 dark:border-violet-500/20 hover:bg-violet-100 hover:shadow-md transition-all shrink-0 animate-in fade-in slide-in-from-left-2 duration-200"
                                                                >
                                                                    <PenLine size={12} /> Chỉnh sửa
                                                                </button>
                                                                <button
                                                                    onClick={() => { setCancelConfirmId(po.id); setShowDesktopActions(null); }}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-bold border border-red-200 dark:border-red-500/20 hover:bg-red-100 hover:shadow-md transition-all shrink-0 animate-in fade-in slide-in-from-left-2 duration-200"
                                                                >
                                                                    <XCircle size={12} /> Hủy đặt in
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                {/* Lên đơn hàng (Chưa xử lý) */}
                                                {(normalizedStatus === 'Chưa xử lý' || normalizedStatus === 'Đã hủy') && !isEditing && (
                                                    <button
                                                        onClick={() => { setExpandedPrintOrder(po.id); setInlineUnitPrices(prev => ({ ...prev, [po.id]: '' })); }}
                                                        className={clsx(
                                                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shrink-0',
                                                            normalizedStatus === 'Đã hủy'
                                                                ? 'bg-slate-400 dark:bg-slate-600 text-white shadow-slate-400/25 hover:shadow-slate-400/40'
                                                                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/25 hover:shadow-cyan-500/40'
                                                        )}
                                                    >
                                                        <ShoppingCart size={13} />
                                                        {normalizedStatus === 'Đã hủy' ? 'Đặt in lại' : 'Lên đơn hàng'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ===== MOBILE CARD BODY (below sm) ===== */}
                                <div className="sm:hidden px-4 py-3 space-y-2">
                                    {/* Nhãn hàng (full-width) */}
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                        <Tag size={12} className="text-indigo-500 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhãn hàng</p>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{po.brand || 'N/A'}</p>
                                        </div>
                                    </div>
                                    {/* Tên sản phẩm (full-width) */}
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                        <FileText size={12} className="text-slate-400 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên sản phẩm</p>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">{po.productName || 'N/A'}</p>
                                        </div>
                                    </div>
                                    {/* 2-column grid */}
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {po.category && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                                <Layers size={11} className="text-violet-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chủng loại</p>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{po.category}</p>
                                                </div>
                                            </div>
                                        )}
                                        {po.sku && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                                <Hash size={11} className="text-cyan-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SKU</p>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{po.sku}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                            <Ruler size={11} className="text-orange-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kích thước</p>
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{po.size || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                            <Scale size={11} className="text-teal-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chất liệu</p>
                                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{po.material || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-50/70 dark:bg-sky-500/5 border border-sky-200/50 dark:border-sky-500/15">
                                            <Package size={11} className="text-sky-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">SL đặt in</p>
                                                <p className="text-sm font-bold text-sky-700 dark:text-sky-300">{po.quantity || '—'}</p>
                                            </div>
                                        </div>
                                        {/* SL giao — mobile input/display */}
                                        {enteringDeliveryQty === po.id ? (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green-50/70 dark:bg-green-500/5 border-2 border-green-400 dark:border-green-500/30 animate-in fade-in slide-in-from-left-2 duration-200">
                                                <Truck size={11} className="text-green-500 shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">SL giao</p>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={inlineDeliveryQty[po.id] || ''}
                                                        onChange={e => setInlineDeliveryQty(prev => ({ ...prev, [po.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                                                        className="text-sm font-bold text-green-700 dark:text-green-300 bg-transparent border-none outline-none w-full placeholder:text-green-300"
                                                        placeholder="Nhập SL..."
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                        ) : (po.deliveryQuantity || normalizedStatus === 'Hoàn thành') ? (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green-50/70 dark:bg-green-500/5 border border-green-200/50 dark:border-green-500/15">
                                                <Truck size={11} className="text-green-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">SL giao</p>
                                                    <p className="text-sm font-bold text-green-700 dark:text-green-300">{po.deliveryQuantity || '—'}</p>
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-50/50 dark:bg-cyan-500/5 border border-cyan-200/40 dark:border-cyan-500/15">
                                            <Layers size={11} className="text-cyan-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">ĐVT</p>
                                                <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300">{po.unit || '—'}</p>
                                            </div>
                                        </div>
                                        {/* Đơn giá / Thành tiền */}
                                        {isEditing ? (
                                            <>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-50/70 dark:bg-violet-500/5 border border-violet-200/50 dark:border-violet-500/15">
                                                    <DollarSign size={11} className="text-violet-500 shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Đơn giá</p>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            value={inlineUnitPrices[po.id] || ''}
                                                            onChange={e => setInlineUnitPrices(prev => ({ ...prev, [po.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                                                            className="text-sm font-bold text-violet-700 dark:text-violet-300 bg-transparent border-none outline-none w-full placeholder:text-violet-300"
                                                            placeholder="Nhập giá..."
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-200/40 dark:border-indigo-500/15">
                                                    <Calculator size={11} className="text-indigo-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Thành tiền</p>
                                                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                                                            {(() => {
                                                                const price = parseFloat((inlineUnitPrices[po.id] || '0').replace(/[.,\s]/g, '')) || 0;
                                                                const qty = parseFloat((po.quantity || '0').replace(/[.,\s]/g, '')) || 0;
                                                                return price > 0 ? formatCurrency(price * qty) : '—';
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-50/50 dark:bg-violet-500/5 border border-violet-200/40 dark:border-violet-500/15">
                                                    <DollarSign size={11} className="text-violet-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Đơn giá</p>
                                                        <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{formatCurrency(po.unitPrice)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-200/40 dark:border-indigo-500/15">
                                                    <Calculator size={11} className="text-indigo-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Thành tiền</p>
                                                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(po.totalPrice)}</p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/15">
                                            <CalendarClock size={11} className="text-emerald-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Ngày cần giao</p>
                                                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{deliveryFormatted || '—'}</p>
                                            </div>
                                        </div>
                                        {isEditing ? (
                                            <div ref={el => { calendarAnchorRefs.current['m_' + po.id] = el; }} className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-50/70 dark:bg-orange-500/5 border border-orange-200/50 dark:border-orange-500/15 cursor-pointer"
                                                onClick={() => setOpenCalendarId(prev => prev === ('m_' + po.id) ? null : ('m_' + po.id))}
                                            >
                                                <CalendarClock size={11} className="text-orange-500 shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Dự kiến giao</p>
                                                    <p className="text-sm font-bold text-orange-700 dark:text-orange-300">
                                                        {inlineDeliveryDates[po.id]
                                                            ? formatDeliveryDate(inlineDeliveryDates[po.id]) || inlineDeliveryDates[po.id]
                                                            : <span className="text-orange-300 dark:text-orange-500/50">Chọn ngày...</span>}
                                                    </p>
                                                </div>
                                                <Calendar size={14} className="text-orange-400 ml-auto" />
                                                {openCalendarId === ('m_' + po.id) && (
                                                    <MiniCalendar
                                                        value={inlineDeliveryDates[po.id] || ''}
                                                        onChange={val => setInlineDeliveryDates(prev => ({ ...prev, [po.id]: val }))}
                                                        onClose={() => setOpenCalendarId(null)}
                                                        anchorRef={{ current: calendarAnchorRefs.current['m_' + po.id] }}
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-50/70 dark:bg-orange-500/5 border border-orange-200/50 dark:border-orange-500/15">
                                                <CalendarClock size={11} className="text-orange-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Dự kiến giao</p>
                                                    <p className="text-sm font-bold text-orange-700 dark:text-orange-300">{po.expectedDelivery ? (formatDeliveryDate(po.expectedDelivery) || po.expectedDelivery) : '—'}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className={`${po.status?.trim() === 'Đã hủy' && po.cancelReason ? '' : 'col-span-2'} flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/40 dark:border-amber-500/15 min-w-0`}>
                                            <StickyNote size={11} className="text-amber-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Ghi chú</p>
                                                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 truncate">{po.note || '—'}</p>
                                            </div>
                                        </div>
                                        {/* Lý do hủy — only for cancelled orders */}
                                        {po.status?.trim() === 'Đã hủy' && po.cancelReason && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-50/60 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/15 min-w-0">
                                                <XCircle size={11} className="text-red-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Lý do hủy</p>
                                                    <p className="text-sm font-medium text-red-700 dark:text-red-300 truncate">{po.cancelReason}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Toggle arrow for action buttons — for Đã đặt in, Đã hủy, and editing */}
                                    {canEdit && (normalizedStatus !== 'Hoàn thành') && (normalizedStatus !== 'Chưa xử lý' || isEditing) && enteringDeliveryQty !== po.id && (
                                        <>
                                            <div className="flex justify-center pt-1">
                                                <button
                                                    onClick={() => setShowMobileActions(prev => prev === po.id ? null : po.id)}
                                                    className="flex items-center gap-1 px-4 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-200 border border-slate-200/60 dark:border-slate-700"
                                                >
                                                    {showMobileActions === po.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                            </div>

                                            {/* Action buttons — collapsible */}
                                            {showMobileActions === po.id && (
                                                <div className="flex justify-center gap-2 pt-1 animate-in slide-in-from-top-2 duration-200">
                                                    {/* Hoàn thành button (editing mode) */}
                                                    {isEditing && (() => {
                                                        const rawPrice = inlineUnitPrices[po.id] || '';
                                                        const priceNum = parseFloat(rawPrice.replace(/[.,\s]/g, '')) || 0;
                                                        const qtyNum = parseInt(po.quantity, 10) || 0;
                                                        const totalNum = qtyNum * priceNum;
                                                        const expectedDelivery = inlineDeliveryDates[po.id] || '';
                                                        const isValid = priceNum > 0 && expectedDelivery !== '';
                                                        return (
                                                            <button
                                                                onClick={() => isValid && handleUpdatePrintOrder(po, { unitPrice: priceNum, totalPrice: totalNum, status: 'Đã đặt in', expectedDelivery })}
                                                                disabled={!isValid}
                                                                title={!isValid ? 'Vui lòng nhập Đơn giá và chọn Dự kiến giao' : 'Hoàn thành đơn hàng'}
                                                                className={clsx(
                                                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0',
                                                                    isValid
                                                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl cursor-pointer'
                                                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                                )}
                                                            >
                                                                <CheckCircle2 size={13} /> Hoàn thành
                                                            </button>
                                                        );
                                                    })()}
                                                    {/* Nhập SL giao + Chỉnh sửa + Hủy (Đã đặt in, not editing) */}
                                                    {normalizedStatus === 'Đã đặt in' && !isEditing && (
                                                        <>
                                                            <button
                                                                onClick={() => { setEnteringDeliveryQty(po.id); setInlineDeliveryQty(prev => ({ ...prev, [po.id]: po.deliveryQuantity || '' })); setShowMobileActions(null); }}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-[11px] font-bold border border-green-200 dark:border-green-500/20 hover:bg-green-100 transition-all shrink-0"
                                                            >
                                                                <Truck size={12} /> Nhập SL giao
                                                            </button>
                                                            <button
                                                                onClick={() => { setExpandedPrintOrder(po.id); setInlineUnitPrices(prev => ({ ...prev, [po.id]: po.unitPrice ? po.unitPrice.toString() : '' })); }}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] font-bold border border-violet-200 dark:border-violet-500/20 hover:bg-violet-100 transition-all shrink-0"
                                                            >
                                                                <PenLine size={12} /> Chỉnh sửa
                                                            </button>
                                                            <button
                                                                onClick={() => setCancelConfirmId(po.id)}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold border border-red-200 dark:border-red-500/20 hover:bg-red-100 transition-all shrink-0"
                                                            >
                                                                <XCircle size={12} /> Hủy đặt in
                                                            </button>
                                                        </>
                                                    )}
                                                    {/* Đặt in lại (Đã hủy) */}
                                                    {normalizedStatus === 'Đã hủy' && !isEditing && (
                                                        <button
                                                            onClick={() => { setExpandedPrintOrder(po.id); setInlineUnitPrices(prev => ({ ...prev, [po.id]: '' })); }}
                                                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[12px] font-bold shadow-lg transition-all shrink-0 bg-slate-400 dark:bg-slate-600 shadow-slate-400/25"
                                                        >
                                                            <ShoppingCart size={14} />
                                                            Đặt in lại
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {/* Hoàn thành button — visible when entering delivery qty (mobile) */}
                                    {canEdit && enteringDeliveryQty === po.id && (() => {
                                        const qtyVal = inlineDeliveryQty[po.id] || '';
                                        const isValid = qtyVal.length > 0 && parseInt(qtyVal, 10) > 0;
                                        return (
                                            <div className="flex justify-center pt-2 pb-1">
                                                <button
                                                    onClick={() => {
                                                        if (!isValid) return;
                                                        handleUpdatePrintOrder(po, { status: 'Hoàn thành', deliveryQuantity: qtyVal });
                                                        setEnteringDeliveryQty(null);
                                                    }}
                                                    disabled={!isValid}
                                                    className={clsx(
                                                        'flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold shadow-lg transition-all shrink-0',
                                                        isValid
                                                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/40'
                                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                    )}
                                                >
                                                    <CheckCircle2 size={14} />
                                                    Hoàn thành
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {/* 'Lên đơn hàng' — auto-visible for Chưa xử lý */}
                                    {canEdit && normalizedStatus === 'Chưa xử lý' && !isEditing && (
                                        <div className="flex justify-center pt-2 pb-1">
                                            <button
                                                onClick={() => { setExpandedPrintOrder(po.id); setInlineUnitPrices(prev => ({ ...prev, [po.id]: '' })); setShowMobileActions(po.id); }}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[12px] font-bold shadow-lg transition-all shrink-0 bg-gradient-to-r from-cyan-500 to-blue-600 shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/40"
                                            >
                                                <ShoppingCart size={14} />
                                                Lên đơn hàng
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Cancel Confirmation — inline on PC, full-screen modal on mobile */}
                                {cancelConfirmId === po.id && (
                                    <>
                                        {/* === MOBILE: full-screen overlay modal === */}
                                        <div className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => { setCancelConfirmId(null); setCancelReason(''); }}>
                                            <div
                                                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm space-y-4 animate-in zoom-in-95 fade-in duration-200"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <div className="text-center space-y-1">
                                                    <XCircle size={40} className="text-red-500 mx-auto" />
                                                    <p className="text-base font-bold text-slate-800 dark:text-white">Xác nhận hủy đặt in?</p>
                                                    <p className="text-xs text-slate-500">Đơn <span className="font-bold">DH{String(po.rowIndex - 1).padStart(4, '0')}</span> — {po.productName || po.brand || 'N/A'}</p>
                                                    <p className="text-xs text-slate-400">Hành động này sẽ đổi trạng thái thành "Đã hủy"</p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Lý do hủy</label>
                                                    <textarea
                                                        value={cancelReason}
                                                        onChange={e => setCancelReason(e.target.value)}
                                                        placeholder="Nhập lý do hủy đơn hàng..."
                                                        rows={3}
                                                        autoFocus
                                                        className="w-full px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-400 outline-none transition-all resize-none"
                                                    />
                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => { setCancelConfirmId(null); setCancelReason(''); }}
                                                        className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                                    >
                                                        Quay lại
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const reason = cancelReason.trim() || undefined;
                                                            handleUpdatePrintOrder(po, { status: 'Đã hủy', ...(reason && { cancelReason: reason }) });
                                                        }}
                                                        className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 shadow-lg shadow-red-500/25 transition-all"
                                                    >
                                                        Xác nhận hủy
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* === PC: inline horizontal bar within card === */}
                                        <div className="hidden md:flex absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl z-50 items-center px-6 gap-4 animate-in fade-in duration-200">
                                            <div className="flex items-center gap-3 shrink-0">
                                                <XCircle size={28} className="text-red-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white whitespace-nowrap">Hủy đơn DH{String(po.rowIndex - 1).padStart(4, '0')}</p>
                                                    <p className="text-xs text-slate-400 truncate">{po.productName || po.brand || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <input
                                                    type="text"
                                                    value={cancelReason}
                                                    onChange={e => setCancelReason(e.target.value)}
                                                    placeholder="Nhập lý do hủy..."
                                                    autoFocus
                                                    className="w-full px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-400 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => { setCancelConfirmId(null); setCancelReason(''); }}
                                                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all whitespace-nowrap"
                                                >
                                                    Quay lại
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const reason = cancelReason.trim() || undefined;
                                                        handleUpdatePrintOrder(po, { status: 'Đã hủy', ...(reason && { cancelReason: reason }) });
                                                    }}
                                                    className="px-3.5 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 shadow-lg shadow-red-500/25 transition-all whitespace-nowrap"
                                                >
                                                    Xác nhận hủy
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {printOrders.length === 0 && (
                        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                            <Printer size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">Chưa có đơn đặt in nào</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PrintOrdersManager;

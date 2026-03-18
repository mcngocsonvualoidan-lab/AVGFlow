import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, Clock, User, Tag, FileText, Filter, Search, ArrowUpDown, ChevronDown, AlertCircle, CheckCircle2, Loader2, Truck, XCircle, BarChart as BarChartIcon, Calendar, CalendarClock, Shield, Eye, PenLine, ClipboardList, Sparkles, ShoppingBag, Users, Printer, Palette, Scale, Coins, Megaphone, MousePointerClick, ListChecks, Send } from 'lucide-react';
import { clsx } from 'clsx';
import HeroBanner from '../../components/HeroBanner';
import PrintOrderForm from './PrintOrderForm';
import DesignOrderForm from './DesignOrderForm';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import { db } from '../../lib/firebase';
import { onSnapshot, collection } from 'firebase/firestore';

const SHEET_ID = '1mzYT75VEJh-PMYvlwUEQkvVnDIj6p1P2ssS6FXvK5Vs';
const GID = '485384320';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

interface Order {
    id: string;
    time: string;
    person: string;
    brand: string;
    request: string;
    description: string;
    status: string;
    parsedDate: Date | null;
}

interface OrderMeta {
    statusOverride?: string;
    deliveryDate?: string;
    updatedBy?: string;
    updatedAt?: string;
}



/** Parse full CSV text into rows, correctly handling multi-line quoted fields */
function parseCSV(text: string): string[][] {
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
                row.push(current);
                current = '';
            } else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
                    i++;
                }
                row.push(current);
                current = '';
                if (row.length > 0) {
                    rows.push([...row]);
                }
                row.length = 0;
            } else {
                current += ch;
            }
        }
    }
    row.push(current);
    if (row.some(c => c.trim())) {
        rows.push(row);
    }
    return rows;
}

function parseDate(dateStr: string): Date | null {
    if (!dateStr || !dateStr.trim()) return null;
    const parts = dateStr.trim().split(' ');
    if (parts.length < 1) return null;
    const dateParts = parts[0].split('/');
    if (dateParts.length !== 3) return null;
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    let hours = 0, minutes = 0, seconds = 0;
    if (parts[1]) {
        const timeParts = parts[1].split(':');
        hours = parseInt(timeParts[0], 10) || 0;
        minutes = parseInt(timeParts[1], 10) || 0;
        seconds = parseInt(timeParts[2], 10) || 0;
    }
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
}

function getStatusInfo(status: string): { color: string; bg: string; border: string; icon: React.FC<any>; label: string } {
    const s = (status || '').toLowerCase().trim();
    if (s.includes('hoàn thành') || s === 'done' || s === 'completed') {
        return { color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/20', icon: CheckCircle2, label: 'Hoàn thành' };
    }
    if (s.includes('hủy') || s === 'cancel' || s === 'cancelled') {
        return { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', icon: XCircle, label: 'Đã hủy' };
    }
    if (s.includes('đặt in') || s.includes('in ấn') || s === 'printing') {
        return { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20', icon: Truck, label: 'Đã đặt in' };
    }
    return { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', icon: AlertCircle, label: 'Đang xử lý' };
}

const normalizeBrandName = (name: string): string => {
    if (!name) return 'KHAC';
    return name.trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
};

// Soft color palette for person tags
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

const GOOGLE_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLScjG9Nw8r20dFgtBl8tKdjReXpdirFRAIokL1gsiqF4rppe9w/formResponse';
const FORM_ENTRY_IDS = {
    person: 'entry.2067254262',
    brand: 'entry.1076750714',
    request: 'entry.985973838',
    description: 'entry.1764511618',
    loveDesigner: 'entry.1776940923',
};

const PERSON_OPTIONS = ['Mây Nguyễn', 'Trà My', 'Thanh Tuyền', 'Ngọc Bích', 'Đỗ Chiều'];
const REQUEST_OPTIONS = ['Thiết kế nhãn, thùng mới', 'Chỉnh sửa nhãn, thùng', 'Đặt in nhãn, thùng', 'Thiết kế banner sản phẩm, truyền thông'];
const LOVE_OPTIONS = ['Thương', 'Rất thương'];

interface FormData { person: string; personOther: string; brand: string; request: string; requestOther: string; description: string; loveDesigner: string; }
const initialFormData: FormData = { person: '', personOther: '', brand: '', request: '', requestOther: '', description: '', loveDesigner: '' };

const PublicOrders: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedYear, setSelectedYear] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [sortNewestFirst, setSortNewestFirst] = useState(true);
    const [activeTab, setActiveTab] = useState<'orders' | 'form' | 'products' | 'customers'>('orders');
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [formError, setFormError] = useState('');
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    // Order metadata from Firestore (status overrides + delivery dates)
    const [orderMetas, setOrderMetas] = useState<Record<string, OrderMeta>>({});

    // Subscribe to order_metas collection in Firestore
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'order_metas'), (snap) => {
            const metas: Record<string, OrderMeta> = {};
            snap.docs.forEach(d => {
                metas[d.id] = d.data() as OrderMeta;
            });
            setOrderMetas(metas);
        });
        return () => unsub();
    }, []);

    // Apply/remove dark class on document element
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(CSV_URL);
            const text = await res.text();
            const rows = parseCSV(text);
            if (rows.length < 2) throw new Error('Không có dữ liệu');

            const parsedOrders: Order[] = [];
            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i];
                // Column mapping (matches Orders.tsx):
                // A(0)=Timestamp, B(1)=Person, C(2)=Brand, D(3)=Request,
                // E(4)=Description, F(5)=Qty, G(6)=DeliveryEst,
                // H(7)=Handler, I(8)=Status
                const time = (cols[0] || '').trim();
                const person = (cols[1] || '').trim();
                const brand = (cols[2] || '').trim();
                const request = (cols[3] || '').trim();
                const description = (cols[4] || '').trim();
                const rawStatus = (cols[8] || '').trim();
                const sTrim = (rawStatus || '').trim();
                const status = (!sTrim || sTrim.toUpperCase() === 'N/A') ? 'Đang xử lý' : sTrim;

                if (!time && !person && !brand && !request) continue;

                // Match ID format from Orders.tsx for Firestore order_metas consistency
                const safeId = `row-${i}`;

                parsedOrders.push({
                    id: safeId,
                    time,
                    person,
                    brand,
                    request,
                    description,
                    status,
                    parsedDate: parseDate(time),
                });
            }
            setOrders(parsedOrders);
        } catch (e: any) {
            setError(e.message || 'Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Unique statuses
    const uniqueStatuses = useMemo(() => {
        const set = new Set(orders.map(o => o.status).filter(Boolean));
        return Array.from(set);
    }, [orders]);

    // Helper: get effective status (considering overrides)
    const getEffectiveStatus = useCallback((order: Order): string => {
        const meta = orderMetas[order.id];
        return meta?.statusOverride || order.status;
    }, [orderMetas]);

    // Filtered and sorted
    const filteredOrders = useMemo(() => {
        let result = [...orders];

        if (statusFilter !== 'all') {
            result = result.filter(o => {
                const effective = getEffectiveStatus(o);
                return effective === statusFilter;
            });
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(o =>
                o.brand.toLowerCase().includes(q) ||
                o.person.toLowerCase().includes(q) ||
                o.request.toLowerCase().includes(q) ||
                o.description.toLowerCase().includes(q) ||
                o.time.toLowerCase().includes(q)
            );
        }

        if (selectedMonth) {
            result = result.filter(o => {
                if (!o.parsedDate) return false;
                const m = `${o.parsedDate.getFullYear()}-${String(o.parsedDate.getMonth() + 1).padStart(2, '0')}`;
                return m === selectedMonth;
            });
        }

        if (selectedBrand) {
            result = result.filter(o => normalizeBrandName(o.brand) === selectedBrand);
        }

        result.sort((a, b) => {
            if (!a.parsedDate && !b.parsedDate) return 0;
            if (!a.parsedDate) return 1;
            if (!b.parsedDate) return -1;

            const timeDiff = sortNewestFirst
                ? b.parsedDate.getTime() - a.parsedDate.getTime()
                : a.parsedDate.getTime() - b.parsedDate.getTime();

            if (timeDiff !== 0) return timeDiff;

            const aRow = a.id.startsWith('row-') ? parseInt(a.id.split('-')[1], 10) : 0;
            const bRow = b.id.startsWith('row-') ? parseInt(b.id.split('-')[1], 10) : 0;
            return sortNewestFirst ? bRow - aRow : aRow - bRow;
        });

        return result;
    }, [orders, statusFilter, searchQuery, sortNewestFirst, selectedMonth, selectedBrand, getEffectiveStatus]);

    // Stats (uses effective status)
    const stats = useMemo(() => {
        const getStatus = (o: Order) => getEffectiveStatus(o).toLowerCase();
        const isCompleted = (s: string) => s.includes('hoàn thành');
        const isCancelled = (s: string) => s.includes('hủy');
        const isPrinting = (s: string) => s.includes('đặt in') || s.includes('in ấn');
        return {
            total: orders.length,
            completed: orders.filter(o => isCompleted(getStatus(o))).length,
            printing: orders.filter(o => isPrinting(getStatus(o))).length,
            pending: orders.filter(o => { const s = getStatus(o); return !isCompleted(s) && !isPrinting(s) && !isCancelled(s); }).length,
            cancelled: orders.filter(o => isCancelled(getStatus(o))).length,
        };
    }, [orders, getEffectiveStatus]);

    const availableYears = useMemo(() => {
        const years = new Set(
            orders
                .map(o => o.parsedDate?.getFullYear()?.toString())
                .filter(Boolean) as string[]
        );
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [orders]);

    // Monthly stats for chart
    const monthlyStats = useMemo(() => {
        const counts: Record<string, number> = {};
        orders.forEach(o => {
            if (o.parsedDate) {
                const year = o.parsedDate.getFullYear().toString();
                if (selectedYear === 'all' || year === selectedYear) {
                    const month = `${year}-${String(o.parsedDate.getMonth() + 1).padStart(2, '0')}`;
                    counts[month] = (counts[month] || 0) + 1;
                }
            }
        });

        const data = Object.keys(counts).map(monthStr => {
            const [year, m] = monthStr.split('-');
            return {
                name: `${m}/${year}`,
                fullMonth: monthStr,
                total: counts[monthStr],
                lineTotal: counts[monthStr] + 3.5
            };
        }).sort((a, b) => a.fullMonth.localeCompare(b.fullMonth));
        return data;
    }, [orders, selectedYear]);

    const brandStats = useMemo(() => {
        const groups: Record<string, { count: number; originalNames: Record<string, number> }> = {};

        orders.forEach(o => {
            const b = (o.brand || 'Khác').trim();
            const normalized = normalizeBrandName(b);

            if (!groups[normalized]) {
                groups[normalized] = { count: 0, originalNames: {} };
            }
            groups[normalized].count += 1;
            groups[normalized].originalNames[b] = (groups[normalized].originalNames[b] || 0) + 1;
        });

        const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16'];

        return Object.keys(groups)
            .map((normalized, index) => {
                const group = groups[normalized];
                const originalNames = group.originalNames;
                const keys = Object.keys(originalNames);
                const displayName = keys.length > 0
                    ? keys.reduce((a, b) => (originalNames[a] || 0) > (originalNames[b] || 0) ? a : b)
                    : (normalized || 'Khác');

                return {
                    name: displayName,
                    normalized,
                    value: group.count,
                    color: COLORS[index % COLORS.length]
                };
            })
            .sort((a, b) => b.value - a.value);
    }, [orders]);

    const formatTimeAgo = (date: Date | null) => {
        if (!date) return '';
        const now = new Date();

        const todayAtZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dateAtZero = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        const diffMs = todayAtZero.getTime() - dateAtZero.getTime();
        const calendarDiffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (calendarDiffDays === 0) return 'Hôm nay';
        if (calendarDiffDays === 1) return 'Hôm qua';
        if (calendarDiffDays < 7) return `${calendarDiffDays} ngày trước`;
        if (calendarDiffDays < 30) return `${Math.floor(calendarDiffDays / 7)} tuần trước`;
        if (calendarDiffDays < 365) return `${Math.floor(calendarDiffDays / 30)} tháng trước`;
        return `${Math.floor(calendarDiffDays / 365)} năm trước`;
    };

    // Clear month filter if it's no longer in the current visible year
    useEffect(() => {
        if (selectedMonth && !monthlyStats.some(s => s.fullMonth === selectedMonth)) {
            setSelectedMonth(null);
        }
    }, [selectedYear, monthlyStats, selectedMonth]);
    // Form submit handler
    const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const personVal = formData.person === '__other__' ? formData.personOther : formData.person;
        const requestVal = formData.request === '__other__' ? formData.requestOther : formData.request;
        if (!personVal || !formData.brand || !requestVal || !formData.description || !formData.loveDesigner) {
            setFormError('Vui lòng điền đầy đủ tất cả các trường bắt buộc');
            return;
        }
        setFormSubmitting(true); setFormError('');
        try {
            const params = new URLSearchParams();
            params.append(FORM_ENTRY_IDS.person, personVal);
            params.append(FORM_ENTRY_IDS.brand, formData.brand);
            params.append(FORM_ENTRY_IDS.request, requestVal);
            params.append(FORM_ENTRY_IDS.description, formData.description);
            params.append(FORM_ENTRY_IDS.loveDesigner, formData.loveDesigner);

            // Method 1: fetch with no-cors (most reliable)
            try {
                await fetch(GOOGLE_FORM_ACTION, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
            } catch {
                // Method 2: Fallback to hidden iframe if fetch fails
                const iframe = document.createElement('iframe');
                iframe.name = 'hidden_form_iframe_' + Date.now();
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = GOOGLE_FORM_ACTION;
                form.target = iframe.name;
                params.forEach((value, key) => {
                    const input = document.createElement('input');
                    input.type = 'hidden'; input.name = key; input.value = value;
                    form.appendChild(input);
                });
                document.body.appendChild(form);
                form.submit();
                await new Promise(resolve => setTimeout(resolve, 2000));
                try { document.body.removeChild(form); } catch { }
                try { document.body.removeChild(iframe); } catch { }
            }

            setFormSubmitted(true);
            setFormData(initialFormData);
            setCurrentStep(0);
        } catch { setFormError('Có lỗi xảy ra, vui lòng thử lại'); }
        finally { setFormSubmitting(false); }
    }, [formData]);


    return (
        <div className={clsx("min-h-screen transition-colors duration-300", isDark ? "dark bg-slate-950" : "bg-gradient-to-br from-slate-50 via-white to-violet-50/30")}>
            {/* ===== PUBLIC HEADER ===== */}
            <header className="sticky top-0 z-50 backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-white/10 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <Package size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                Đơn hàng
                            </h1>
                            <p className="text-[10px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                AVG Flow • Chế độ xem đối tác
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Public Badge */}
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
                            <Eye size={14} className="text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Chỉ xem</span>
                        </div>
                        {/* Dark Mode Toggle */}
                        <button
                            onClick={() => setIsDark(!isDark)}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            title="Chuyển đổi giao diện"
                        >
                            {isDark ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* ===== HERO BANNER (matching Đơn hàng style) ===== */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <HeroBanner
                    icon={Package}
                    title="Đơn đặt hàng"
                    subtitle="QUẢN LÝ ĐƠN HÀNG"
                    description="Theo dõi &amp; quản lý đơn đặt hàng vật tư, in ấn cho các thương hiệu."
                    badge="AVG Flow AI Active"
                    stats={[
                        { label: 'TỔNG ĐƠN', value: stats.total.toString(), icon: Package, color: 'from-violet-400 to-purple-500' },
                        { label: 'HOÀN THÀNH', value: stats.completed.toString(), icon: CheckCircle2, color: 'from-green-400 to-emerald-500' },
                        { label: 'ĐÃ ĐẶT IN', value: stats.printing.toString(), icon: Truck, color: 'from-blue-400 to-indigo-500' },
                        { label: 'ĐÃ HỦY', value: stats.cancelled.toString(), icon: XCircle, color: 'from-red-400 to-rose-500' },
                        { label: 'ĐANG XỬ LÝ', value: stats.pending.toString(), icon: Clock, color: 'from-amber-400 to-orange-500' },
                    ]}
                    gradientFrom="from-violet-600"
                    gradientVia="via-purple-600"
                    gradientTo="to-indigo-700"
                />
            </div>

            {/* ===== TAB NAVIGATION (Desktop - top) ===== */}
            {(() => {
                const tabs = [
                    { key: 'orders' as const, label: 'Đơn hàng', icon: ClipboardList, activeGradient: 'from-violet-500 to-indigo-600', activeShadow: 'shadow-violet-500/25', inactiveBg: 'bg-violet-50 dark:bg-violet-500/10', inactiveText: 'text-violet-600 dark:text-violet-400', inactiveBorder: 'border-violet-200/60 dark:border-violet-500/20', badge: stats.pending > 0 ? stats.pending : null },
                    { key: 'form' as const, label: 'Tạo yêu cầu', icon: PenLine, activeGradient: 'from-emerald-500 to-teal-600', activeShadow: 'shadow-emerald-500/25', inactiveBg: 'bg-emerald-50 dark:bg-emerald-500/10', inactiveText: 'text-emerald-600 dark:text-emerald-400', inactiveBorder: 'border-emerald-200/60 dark:border-emerald-500/20', badge: null },
                    { key: 'products' as const, label: 'Hàng hóa', icon: ShoppingBag, activeGradient: 'from-amber-500 to-orange-600', activeShadow: 'shadow-amber-500/25', inactiveBg: 'bg-amber-50 dark:bg-amber-500/10', inactiveText: 'text-amber-600 dark:text-amber-400', inactiveBorder: 'border-amber-200/60 dark:border-amber-500/20', badge: null },
                    { key: 'customers' as const, label: 'Khách hàng', icon: Users, activeGradient: 'from-rose-500 to-pink-600', activeShadow: 'shadow-rose-500/25', inactiveBg: 'bg-rose-50 dark:bg-rose-500/10', inactiveText: 'text-rose-600 dark:text-rose-400', inactiveBorder: 'border-rose-200/60 dark:border-rose-500/20', badge: null },
                ];

                return (
                    <>
                        {/* Desktop tab bar */}
                        <div className="hidden sm:block max-w-7xl mx-auto px-4 sm:px-6 mt-4 relative z-10 mb-6">
                            <div className="flex gap-2 p-1.5 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-xl shadow-slate-900/5">
                                {tabs.map(tab => {
                                    const TabIcon = tab.icon;
                                    const isActive = activeTab === tab.key;
                                    return (
                                        <button key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={clsx(
                                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-300",
                                                isActive
                                                    ? `bg-gradient-to-r ${tab.activeGradient} text-white shadow-lg ${tab.activeShadow}`
                                                    : `${tab.inactiveBg} ${tab.inactiveText} border ${tab.inactiveBorder} hover:opacity-80`
                                            )}
                                        >
                                            <TabIcon size={16} className={clsx(isActive && "drop-shadow-sm")} />
                                            <span className="hidden lg:inline">{tab.label}</span>
                                            <span className="lg:hidden">{tab.label}</span>
                                            {tab.badge && !isActive && (
                                                <span className="px-1.5 py-0.5 rounded-full bg-amber-400/90 text-[9px] font-black text-amber-900 min-w-[18px] text-center animate-pulse">
                                                    {tab.badge}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Mobile bottom bar */}
                        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200/60 dark:border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-2 py-2 safe-area-inset-bottom">
                            <div className="flex gap-1">
                                {tabs.map(tab => {
                                    const TabIcon = tab.icon;
                                    const isActive = activeTab === tab.key;
                                    return (
                                        <button key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={clsx(
                                                "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl font-bold transition-all duration-300 relative",
                                                isActive
                                                    ? `bg-gradient-to-r ${tab.activeGradient} text-white shadow-lg ${tab.activeShadow}`
                                                    : `${tab.inactiveText}`
                                            )}
                                        >
                                            <TabIcon size={18} />
                                            <span className="text-[9px] leading-tight">{tab.label}</span>
                                            {tab.badge && !isActive && (
                                                <span className="absolute -top-0.5 right-1/4 px-1 py-0 rounded-full bg-amber-400/90 text-[8px] font-black text-amber-900 min-w-[14px] text-center animate-pulse">
                                                    {tab.badge}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* ===== TAB: ORDERS ===== */}
            {activeTab === 'orders' && (
                <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8 space-y-6">


                    {/* Charts Section */}
                    {monthlyStats && monthlyStats.length > 0 && (
                        <div className="grid grid-cols-1 gap-6">
                            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-white/50 dark:border-white/10 shadow-lg shadow-violet-500/5 transition-all">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/20 text-violet-600 dark:text-violet-400 rounded-xl shadow-inner border border-white/50 dark:border-white/5">
                                            <BarChartIcon size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Thống kê theo tháng</h3>
                                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Số lượng đơn hàng phát sinh trong mỗi tháng</p>
                                        </div>
                                    </div>
                                    {availableYears.length > 0 && (
                                        <div className="relative w-fit">
                                            <select
                                                value={selectedYear}
                                                onChange={(e) => setSelectedYear(e.target.value)}
                                                className="appearance-none pl-4 pr-10 py-2 rounded-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-violet-100 dark:border-violet-500/10 text-sm font-semibold text-violet-700 dark:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-all"
                                            >
                                                <option value="all">Tất cả {availableYears.length > 1 ? `(${availableYears[availableYears.length - 1]}-${availableYears[0]})` : ''}</option>
                                                {availableYears.map(year => (
                                                    <option key={year} value={year}>Năm {year}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
                                        </div>
                                    )}
                                </div>

                                <div className="h-80 mt-4 relative w-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
                                    <div style={{ minWidth: `${Math.max(100, monthlyStats.length * 40)}px`, height: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={monthlyStats} margin={{ top: 30, right: 10, left: -25, bottom: 45 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-white/5" />
                                                <XAxis
                                                    dataKey="name"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 9, fontWeight: 600, dy: 8 }}
                                                    angle={35}
                                                    textAnchor="start"
                                                    interval={0}
                                                    height={65}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }}
                                                    formatter={(value: any, name?: string) => {
                                                        if (name === "lineTotal" || !name) return [null, null] as any;
                                                        return [value, name];
                                                    }}
                                                    contentStyle={{
                                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                        backdropFilter: 'blur(12px)',
                                                        border: '1px solid rgba(139, 92, 246, 0.2)',
                                                        borderRadius: '16px',
                                                        boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.15)',
                                                        color: '#0f172a',
                                                        fontWeight: 600,
                                                        padding: '12px'
                                                    }}
                                                    itemStyle={{ color: '#8b5cf6', fontWeight: 800 }}
                                                />
                                                <defs>
                                                    <linearGradient id="colorTotalPublic" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.5} />
                                                    </linearGradient>
                                                </defs>
                                                <Bar
                                                    dataKey="total"
                                                    name="Tổng đơn"
                                                    radius={[6, 6, 6, 6]}
                                                    barSize={32}
                                                    onClick={(data: any) => {
                                                        if (data && data.fullMonth) {
                                                            const fm = data.fullMonth as string;
                                                            setSelectedMonth(prev => prev === fm ? null : fm);
                                                        }
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    {monthlyStats.map((entry: any, index: number) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={entry.fullMonth === selectedMonth ? '#4f46e5' : 'url(#colorTotalPublic)'}
                                                            fillOpacity={selectedMonth && entry.fullMonth !== selectedMonth ? 0.4 : 1}
                                                            stroke={entry.fullMonth === selectedMonth ? '#818cf8' : 'none'}
                                                            strokeWidth={entry.fullMonth === selectedMonth ? 2 : 0}
                                                        />
                                                    ))}
                                                </Bar>
                                                <Line
                                                    type="monotone"
                                                    dataKey="lineTotal"
                                                    name="lineTotal"
                                                    stroke="#8b5cf6"
                                                    strokeWidth={3}
                                                    dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                                                    activeDot={false}
                                                    tooltipType="none"
                                                    animationDuration={2000}
                                                >
                                                    <LabelList dataKey="total" position="top" offset={12} style={{ fill: '#8b5cf6', fontSize: 11, fontWeight: 800 }} />
                                                </Line>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm theo thương hiệu, người đặt, yêu cầu..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="appearance-none pl-9 pr-8 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer shadow-sm"
                                >
                                    <option value="all">Tất cả trạng thái</option>
                                    {uniqueStatuses.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            <button
                                onClick={() => setSortNewestFirst(!sortNewestFirst)}
                                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm whitespace-nowrap"
                                title={sortNewestFirst ? 'Mới nhất trước' : 'Cũ nhất trước'}
                            >
                                <ArrowUpDown size={14} />
                                <span className="hidden sm:inline">{sortNewestFirst ? 'Mới nhất' : 'Cũ nhất'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Results count & Month Filter Indicator */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <div>
                            Hiển thị {filteredOrders.length} / {orders.length} đơn hàng
                        </div>
                        {(selectedMonth || selectedBrand) && (
                            <div className="flex items-center gap-2">
                                {selectedMonth && (
                                    <span className="bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-3 py-1 rounded-full border border-violet-200 dark:border-violet-500/30 flex items-center gap-1.5 shadow-sm">
                                        <Calendar size={12} />
                                        Tháng {selectedMonth.split('-')[1]}/{selectedMonth.split('-')[0]}
                                        <button
                                            onClick={() => setSelectedMonth(null)}
                                            className="hover:text-violet-900 dark:hover:text-white transition-colors"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </span>
                                )}
                                {selectedBrand && (
                                    <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-500/30 flex items-center gap-1.5 shadow-sm">
                                        <Tag size={12} />
                                        {brandStats && brandStats.find(b => b.normalized === selectedBrand)?.name || selectedBrand}
                                        <button
                                            onClick={() => setSelectedBrand(null)}
                                            className="hover:text-blue-900 dark:hover:text-white transition-colors"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </span>
                                )}
                                <button
                                    onClick={() => { setSelectedMonth(null); setSelectedBrand(null); }}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline text-[10px]"
                                >
                                    Xóa tất cả lọc
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center p-16 text-slate-500">
                            <Loader2 className="animate-spin h-8 w-8 text-violet-500 mb-3" />
                            <span className="text-sm font-medium">Đang tải đơn hàng...</span>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400">
                            <AlertCircle size={20} />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}

                    {/* Orders List */}
                    {!loading && !error && (
                        <div className="space-y-3">
                            {filteredOrders.map((order, idx) => {
                                const effectiveStatus = getEffectiveStatus(order);
                                const statusInfo = getStatusInfo(effectiveStatus);
                                const StatusIcon = statusInfo.icon;
                                const timeAgo = formatTimeAgo(order.parsedDate);
                                const meta = orderMetas[order.id] || {};

                                return (
                                    <div
                                        key={order.id || idx}
                                        className={clsx(
                                            "group relative flex flex-col sm:flex-row bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl transition-all duration-300 z-10 hover:z-20",
                                            statusInfo.label === 'Đang xử lý'
                                                ? "border-2 border-amber-300 dark:border-amber-500/60 shadow-[0_8px_30px_rgb(251,191,36,0.15)] ring-1 ring-amber-400/20"
                                                : "border border-slate-200 dark:border-slate-600/50 hover:border-violet-400 dark:hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/10 shadow-sm",
                                        )}
                                    >
                                        {/* Glassmorphism shimmer */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />

                                        {/* Smart Date Block (Left Side) */}
                                        <div className="relative flex sm:flex-col items-center justify-between sm:justify-center p-4 sm:p-5 sm:w-32 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-3xl sm:rounded-tr-none sm:rounded-l-3xl">
                                            <div className="flex items-center sm:flex-col sm:items-center gap-3 sm:gap-1.5 w-full justify-center">
                                                {/* ID Badge */}
                                                <div className="hidden sm:flex flex-col items-center">
                                                    <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                                                        ID: #{idx + 1}
                                                    </span>
                                                </div>

                                                <div className="sm:hidden text-[9px] font-bold text-slate-400 px-1 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                    #{idx + 1}
                                                </div>

                                                {/* Clock/Time */}
                                                <div className="text-[10px] sm:text-xs font-semibold text-violet-500 dark:text-violet-400 text-center flex items-center justify-center gap-1 mt-1">
                                                    <Clock size={10} />
                                                    {order.parsedDate ? order.parsedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                </div>

                                                {/* Date Big Number */}
                                                <div className="text-3xl sm:text-4xl font-black text-slate-700 dark:text-slate-200 tracking-tighter text-center leading-none mt-1">
                                                    {order.parsedDate ? String(order.parsedDate.getDate()).padStart(2, '0') : '--'}
                                                </div>
                                                <div className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                                                    {order.parsedDate ? order.parsedDate.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }) : '---'}
                                                </div>
                                            </div>
                                            {statusInfo.label === 'Đang xử lý' && (
                                                <div className="absolute top-4 right-4 sm:top-1/2 sm:-right-1.5 sm:-translate-y-1/2 w-3 h-3 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-pulse" />
                                            )}
                                        </div>

                                        {/* Main Content Area */}
                                        <div className="relative flex-1 p-4 sm:p-5 flex flex-col justify-between min-w-0">

                                            <div className="flex flex-col justify-between items-start gap-4 mb-4">
                                                <div className="flex-1 min-w-0 w-full">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        {/* Person Badge */}
                                                        {(() => {
                                                            const pc = getPersonColor(order.person);
                                                            return (
                                                                <div className={clsx(
                                                                    "flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] sm:text-[11px] font-bold shadow-xs transition-all",
                                                                    pc.text, pc.bg, pc.border
                                                                )}>
                                                                    <User size={10} className="shrink-0" />
                                                                    <span className="truncate max-w-[120px]">{order.person || 'Chưa p/c'}</span>
                                                                </div>
                                                            );
                                                        })()}

                                                        {timeAgo && (
                                                            <span className={clsx(
                                                                "text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md border",
                                                                timeAgo.includes('Hôm nay') || timeAgo.includes('Hôm qua')
                                                                    ? "text-rose-500 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20"
                                                                    : "text-violet-500 bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20"
                                                            )}>
                                                                {timeAgo}
                                                            </span>
                                                        )}

                                                        {/* Status Badge (Read-only) */}
                                                        <div
                                                            className={clsx(
                                                                "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold border shadow-sm shrink-0",
                                                                statusInfo.bg, statusInfo.color, statusInfo.border
                                                            )}
                                                        >
                                                            <StatusIcon size={14} />
                                                            <span>{effectiveStatus || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col lg:flex-row gap-4 lg:items-start w-full">
                                                        <div className="w-full xl:w-[260px] lg:w-[200px] shrink-0 min-w-0">
                                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight break-words pr-2">
                                                                {order.brand || 'Khách hàng ẩn danh'}
                                                            </h3>
                                                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-2 flex items-start gap-2 max-w-2xl leading-relaxed">
                                                                <Tag size={16} className="text-slate-400 shrink-0 mt-0.5" />
                                                                {order.request || 'Chưa ghi chú yêu cầu'}
                                                            </p>
                                                        </div>

                                                        {/* Description Box */}
                                                        {order.description && (() => {
                                                            const isLongDescription = order.description.length > 150 || (order.description.match(/\n/g) || []).length >= 3;
                                                            return (
                                                                <div className="flex-1 min-w-0 flex gap-3 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative group">
                                                                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
                                                                        <FileText size={16} className="text-violet-600 dark:text-violet-400" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 pr-2">
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between pr-4">
                                                                            <span>Mô tả & Ghi chú</span>
                                                                            {isLongDescription && (
                                                                                <span className="text-[9px] lowercase bg-violet-100/50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400 px-1.5 py-0.5 rounded opacity-100 group-hover:opacity-0 transition-opacity duration-300 pointer-events-none select-none">
                                                                                    hiện thêm ▾
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                        <div className="relative">
                                                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all leading-relaxed line-clamp-3 group-hover:line-clamp-none group-hover:max-h-[400px] group-hover:overflow-y-auto custom-scrollbar pr-2 transition-all duration-500 ease-in-out">
                                                                                {order.description}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Delivery Date Section (Read-only) */}
                                                        {meta.deliveryDate && (
                                                            <div className="w-full lg:w-[260px] shrink-0 flex flex-col gap-3">
                                                                <div className="flex gap-3 bg-emerald-50/50 dark:bg-emerald-500/5 p-3 rounded-2xl border border-emerald-200/50 dark:border-emerald-500/20 shadow-sm">
                                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                                        <CalendarClock size={16} className="text-emerald-600 dark:text-emerald-400" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mb-1">Dự kiến giao hàng</p>
                                                                        <p className="text-[13px] font-bold text-emerald-700 dark:text-emerald-300">
                                                                            {new Date(meta.deliveryDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                            {' • '}
                                                                            {new Date(meta.deliveryDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredOrders.length === 0 && !loading && (
                                <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                                    <Package size={48} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-medium">Không tìm thấy đơn hàng phù hợp</p>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            )}



            {/* ===== TAB: TIMELINE FORM ===== */}
            {
                activeTab === 'form' && (
                    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">
                        {/* ===== CATEGORY FILTER BUTTONS (Glassmorphism) ===== */}
                        {(() => {
                            const categories = [
                                { key: 'in-an', label: 'In ấn', icon: Printer, color: { inactive: 'bg-cyan-400/10 dark:bg-cyan-400/5 border-cyan-300/40 dark:border-cyan-500/15 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-400/20 dark:hover:bg-cyan-400/10 hover:border-cyan-400/60 dark:hover:border-cyan-400/30 hover:shadow-cyan-500/10', active: 'bg-gradient-to-r from-cyan-500 to-sky-600 border-transparent text-white shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-400/30' } },
                                { key: 'thiet-ke', label: 'Thiết kế', icon: Palette, color: { inactive: 'bg-violet-400/10 dark:bg-violet-400/5 border-violet-300/40 dark:border-violet-500/15 text-violet-600 dark:text-violet-400 hover:bg-violet-400/20 dark:hover:bg-violet-400/10 hover:border-violet-400/60 dark:hover:border-violet-400/30 hover:shadow-violet-500/10', active: 'bg-gradient-to-r from-violet-500 to-purple-600 border-transparent text-white shadow-lg shadow-violet-500/30 ring-2 ring-violet-400/30' } },
                                { key: 'phap-ly', label: 'Pháp lý', icon: Scale, color: { inactive: 'bg-amber-400/10 dark:bg-amber-400/5 border-amber-300/40 dark:border-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-400/20 dark:hover:bg-amber-400/10 hover:border-amber-400/60 dark:hover:border-amber-400/30 hover:shadow-amber-500/10', active: 'bg-gradient-to-r from-amber-500 to-orange-600 border-transparent text-white shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/30' } },
                                { key: 'tai-chinh', label: 'Tài chính', icon: Coins, color: { inactive: 'bg-emerald-400/10 dark:bg-emerald-400/5 border-emerald-300/40 dark:border-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-400/20 dark:hover:bg-emerald-400/10 hover:border-emerald-400/60 dark:hover:border-emerald-400/30 hover:shadow-emerald-500/10', active: 'bg-gradient-to-r from-emerald-500 to-teal-600 border-transparent text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/30' } },
                                { key: 'truyen-thong', label: 'Truyền thông', icon: Megaphone, color: { inactive: 'bg-rose-400/10 dark:bg-rose-400/5 border-rose-300/40 dark:border-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-400/20 dark:hover:bg-rose-400/10 hover:border-rose-400/60 dark:hover:border-rose-400/30 hover:shadow-rose-500/10', active: 'bg-gradient-to-r from-rose-500 to-pink-600 border-transparent text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400/30' } },
                            ];
                            return (
                                <div className="mb-6 relative">
                                    {/* Frosted glass container */}
                                    <div className="relative overflow-hidden rounded-2xl bg-white/40 dark:bg-slate-800/30 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-xl shadow-slate-900/5 p-4">
                                        {/* Background glow effects */}
                                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-violet-400/15 to-cyan-400/15 rounded-full blur-2xl pointer-events-none" />
                                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-rose-400/15 to-amber-400/15 rounded-full blur-2xl pointer-events-none" />
                                        
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 pl-1">Phân loại yêu cầu</p>
                                        <div className="grid grid-cols-5 gap-2">
                                            {categories.map(cat => {
                                                const CatIcon = cat.icon;
                                                const isActive = selectedCategory === cat.key;
                                                return (
                                                    <button
                                                        key={cat.key}
                                                        type="button"
                                                        onClick={() => setSelectedCategory(isActive ? null : cat.key)}
                                                        className={clsx(
                                                            "relative flex flex-col items-center gap-1.5 sm:gap-2 py-3 sm:py-4 rounded-xl border backdrop-blur-xl font-bold text-xs sm:text-sm transition-all duration-300 overflow-hidden group",
                                                            isActive
                                                                ? cat.color.active
                                                                : cat.color.inactive
                                                        )}
                                                    >
                                                        {/* Glassmorphism shine overlay */}
                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent dark:from-white/10 pointer-events-none rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                        {isActive && (
                                                            <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/10 pointer-events-none rounded-xl" />
                                                        )}
                                                        <CatIcon size={18} className={clsx("relative z-10 transition-transform duration-300", isActive ? "scale-110 drop-shadow-lg" : "group-hover:scale-110")} />
                                                        <span className="relative z-10 truncate max-w-full px-1">{cat.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        {/* ===== CONDITIONAL FORM RENDERING ===== */}
                        {!selectedCategory ? (
                            <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl p-8 sm:p-12 text-center mt-4">
                                <div className="absolute -inset-1 bg-gradient-to-r from-violet-400/10 via-cyan-400/10 to-blue-400/10 rounded-[2rem] blur-xl" />
                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-8 animate-[bounce_4s_infinite]">
                                        <Sparkles size={40} className="text-white drop-shadow-md sm:w-12 sm:h-12" />
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Chào mừng bạn đến với AVG Flow 👋</h2>
                                    <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                                        Hệ thống tiếp nhận yêu cầu tự động. Để bắt đầu, vui lòng chọn một <strong className="text-indigo-600 dark:text-indigo-400">Phân loại yêu cầu</strong> ở phía trên để hệ thống nạp đúng biểu mẫu xử lý cho bạn nhé.
                                    </p>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
                                        <div className="bg-white/50 dark:bg-slate-700/50 rounded-2xl p-5 border border-white/40 dark:border-slate-600/40 shadow-sm text-left">
                                            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center mb-3">
                                                <MousePointerClick size={20} className="text-cyan-600 dark:text-cyan-400" />
                                            </div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">1. Chọn loại</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Chọn đúng loại yêu cầu (in ấn, thiết kế...) ở thanh menu trên</p>
                                        </div>
                                        <div className="bg-white/50 dark:bg-slate-700/50 rounded-2xl p-5 border border-white/40 dark:border-slate-600/40 shadow-sm text-left">
                                            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-3">
                                                <ListChecks size={20} className="text-violet-600 dark:text-violet-400" />
                                            </div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">2. Điền thông tin</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Cung cấp đầy đủ nội dung theo các bước của biểu mẫu</p>
                                        </div>
                                        <div className="bg-white/50 dark:bg-slate-700/50 rounded-2xl p-5 border border-white/40 dark:border-slate-600/40 shadow-sm text-left">
                                            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
                                                <Send size={20} className="text-orange-600 dark:text-orange-400" />
                                            </div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">3. Gửi yêu cầu</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Kiểm tra lại thông tin và xác nhận gửi cho Team</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : selectedCategory === 'in-an' ? (
                            <PrintOrderForm />
                        ) : selectedCategory === 'thiet-ke' ? (
                            <DesignOrderForm />
                        ) : selectedCategory === 'phap-ly' || selectedCategory === 'tai-chinh' || selectedCategory === 'truyen-thong' ? (() => {
                            const comingSoonMeta = {
                                'phap-ly':       { label: 'Pháp lý',      icon: Scale,     gradient: 'from-amber-400 to-orange-500',   glow: 'from-amber-400/10 via-orange-400/10 to-yellow-400/10',   shadow: 'shadow-amber-500/30',   text: 'text-amber-600 dark:text-amber-400' },
                                'tai-chinh':     { label: 'Tài chính',    icon: Coins,     gradient: 'from-emerald-400 to-teal-500',   glow: 'from-emerald-400/10 via-green-400/10 to-teal-400/10',    shadow: 'shadow-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' },
                                'truyen-thong':  { label: 'Truyền thông', icon: Megaphone, gradient: 'from-rose-400 to-pink-500',      glow: 'from-rose-400/10 via-pink-400/10 to-fuchsia-400/10',     shadow: 'shadow-rose-500/30',    text: 'text-rose-600 dark:text-rose-400' },
                            }[selectedCategory]!;
                            const MetaIcon = comingSoonMeta.icon;
                            return (
                                <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl p-10 sm:p-16 text-center">
                                    <div className={`absolute -inset-1 bg-gradient-to-r ${comingSoonMeta.glow} rounded-[2rem] blur-xl`} />
                                    <div className="relative z-10">
                                        <div className={`w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br ${comingSoonMeta.gradient} flex items-center justify-center shadow-2xl ${comingSoonMeta.shadow} mb-6`}>
                                            <MetaIcon size={36} className="text-white" />
                                        </div>
                                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">Form đang cập nhật 🚧</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                            Tính năng <span className={`font-bold ${comingSoonMeta.text}`}>{comingSoonMeta.label}</span> đang được phát triển. Vui lòng quay lại sau!
                                        </p>
                                    </div>
                                </div>
                            );
                        })() : formSubmitted ? (
                            <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl p-10 sm:p-16 text-center">
                                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400/10 via-green-400/10 to-teal-400/10 rounded-[2rem] blur-xl" />
                                <div className="relative z-10">
                                    <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-6 animate-bounce">
                                        <CheckCircle2 size={40} className="text-white" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Gửi yêu cầu thành công! 🎉</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">Team Design & Media đã nhận được yêu cầu. Chúng tôi sẽ xử lý sớm nhất!</p>
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <button onClick={() => { setFormSubmitted(false); setCurrentStep(0); setFormData(initialFormData); setSelectedCategory(null); setFormError(''); }} className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-violet-500/30 hover:shadow-xl hover:scale-105 transition-all">
                                            <PenLine size={14} className="inline mr-2" />Tạo yêu cầu mới
                                        </button>
                                        <button onClick={() => setActiveTab('orders')} className="px-6 py-3 rounded-xl bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-600 transition-all">
                                            <ClipboardList size={14} className="inline mr-2" />Xem đơn hàng
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (() => {
                            const STEPS = [
                                { key: 'person', label: 'Bạn là ai?', icon: User, color: 'violet', emoji: '👤' },
                                { key: 'brand', label: 'Thương hiệu', icon: Tag, color: 'blue', emoji: '🏷️' },
                                { key: 'request', label: 'Yêu cầu', icon: FileText, color: 'emerald', emoji: '📋' },
                                { key: 'description', label: 'Mô tả chi tiết', icon: FileText, color: 'amber', emoji: '✏️' },
                                { key: 'love', label: 'Gửi yêu cầu', icon: CheckCircle2, color: 'pink', emoji: '💖' },
                            ];
                            const isStepDone = (i: number) => {
                                if (i === 0) return !!formData.person && (formData.person !== '__other__' || !!formData.personOther);
                                if (i === 1) return !!formData.brand;
                                if (i === 2) return !!formData.request && (formData.request !== '__other__' || !!formData.requestOther);
                                if (i === 3) return !!formData.description;
                                if (i === 4) return !!formData.loveDesigner;
                                return false;
                            };
                            const colorMap: Record<string, { bg: string; border: string; text: string; ring: string; gradient: string }> = {
                                violet: { bg: 'bg-violet-500', border: 'border-violet-500', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-500/40', gradient: 'from-violet-500 to-purple-600' },
                                blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/40', gradient: 'from-blue-500 to-indigo-600' },
                                emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/40', gradient: 'from-emerald-500 to-teal-600' },
                                amber: { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/40', gradient: 'from-amber-500 to-orange-600' },
                                pink: { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-600 dark:text-pink-400', ring: 'ring-pink-500/40', gradient: 'from-pink-500 to-rose-600' },
                            };
                            const sc = colorMap[STEPS[currentStep].color];

                            // ========== STEP CONTENT RENDERER ==========
                            const renderStepContent = (stepIdx: number) => {
                                if (stepIdx === 0) return (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Chọn tên của bạn để chúng tôi biết ai gửi yêu cầu:</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                            {PERSON_OPTIONS.map(name => (
                                                <button type="button" key={name} onClick={() => setFormData(p => ({ ...p, person: name, personOther: '' }))}
                                                    className={clsx("relative p-3.5 rounded-2xl border-2 text-left transition-all duration-300 group",
                                                        formData.person === name
                                                            ? "border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 shadow-xl shadow-violet-500/15 scale-[1.03]"
                                                            : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:border-violet-300 hover:shadow-md"
                                                    )}>
                                                    {formData.person === name && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shadow-lg"><CheckCircle2 size={12} className="text-white" /></div>}
                                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-500/20 dark:to-purple-500/20 flex items-center justify-center mb-1.5 text-sm font-black group-hover:scale-110 transition-transform">
                                                        {name.charAt(0)}
                                                    </div>
                                                    <span className="text-xs sm:text-sm font-bold block">{name}</span>
                                                </button>
                                            ))}
                                            <button type="button" onClick={() => setFormData(p => ({ ...p, person: '__other__' }))}
                                                className={clsx("p-3.5 rounded-2xl border-2 border-dashed text-left transition-all duration-300",
                                                    formData.person === '__other__'
                                                        ? "border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 shadow-xl"
                                                        : "border-slate-300 dark:border-slate-600 text-slate-500 hover:border-violet-300"
                                                )}>
                                                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-1.5 text-sm">+</div>
                                                <span className="text-xs sm:text-sm font-bold block">Khác</span>
                                            </button>
                                        </div>
                                        {formData.person === '__other__' && (
                                            <input type="text" value={formData.personOther} onChange={e => setFormData(p => ({ ...p, personOther: e.target.value }))} placeholder="Nhập tên của bạn..."
                                                className="w-full px-4 py-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-violet-300 dark:border-violet-500/30 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500/40 outline-none transition-all" />
                                        )}
                                    </div>
                                );
                                if (stepIdx === 1) return (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Nhập tên thương hiệu hoặc nhãn hàng cần thiết kế:</p>
                                        <input type="text" value={formData.brand} onChange={e => setFormData(p => ({ ...p, brand: e.target.value }))} placeholder="VD: ABC Cosmetics, XYZ Foods..."
                                            className="w-full px-5 py-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-2 border-blue-200 dark:border-blue-500/30 text-base text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all shadow-sm" />
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400"><Tag size={12} />Tên này sẽ được dùng để gắn nhãn cho yêu cầu</div>
                                    </div>
                                );
                                if (stepIdx === 2) return (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Chọn loại yêu cầu phù hợp:</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {REQUEST_OPTIONS.map(opt => (
                                                <button type="button" key={opt} onClick={() => setFormData(p => ({ ...p, request: opt, requestOther: '' }))}
                                                    className={clsx("flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-300",
                                                        formData.request === opt
                                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 shadow-xl shadow-emerald-500/10 scale-[1.02]"
                                                            : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:border-emerald-300 hover:shadow-md"
                                                    )}>
                                                    <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                                        formData.request === opt ? "border-emerald-500 bg-emerald-500" : "border-slate-300 dark:border-slate-600")}>
                                                        {formData.request === opt && <CheckCircle2 size={12} className="text-white" />}
                                                    </div>
                                                    <span className={clsx("text-sm font-bold", formData.request === opt ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-400")}>{opt}</span>
                                                </button>
                                            ))}
                                            <button type="button" onClick={() => setFormData(p => ({ ...p, request: '__other__' }))}
                                                className={clsx("flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed text-left transition-all duration-300",
                                                    formData.request === '__other__' ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15" : "border-slate-300 dark:border-slate-600 hover:border-emerald-300")}>
                                                <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0", formData.request === '__other__' ? "border-emerald-500 bg-emerald-500" : "border-slate-300 dark:border-slate-600")}>
                                                    {formData.request === '__other__' && <CheckCircle2 size={12} className="text-white" />}
                                                </div>
                                                <span className="text-sm font-bold text-slate-500">Mục khác</span>
                                            </button>
                                        </div>
                                        {formData.request === '__other__' && (
                                            <input type="text" value={formData.requestOther} onChange={e => setFormData(p => ({ ...p, requestOther: e.target.value }))} placeholder="Mô tả yêu cầu khác..."
                                                className="w-full px-4 py-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 border-2 border-emerald-300 dark:border-emerald-500/30 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/40 outline-none transition-all" />
                                        )}
                                    </div>
                                );
                                if (stepIdx === 3) return (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Mô tả chi tiết yêu cầu (Số lượng nhãn, Phân loại, Lô date...):</p>
                                        <textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Mô tả chi tiết yêu cầu công việc..." rows={5}
                                            className="w-full px-5 py-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-2 border-amber-200 dark:border-amber-500/30 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none transition-all resize-none shadow-sm leading-relaxed" />
                                    </div>
                                );
                                if (stepIdx === 4) return (
                                    <div className="space-y-5">
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Cuối cùng — bạn có thương Designer không? 💕</p>
                                        <div className="flex gap-3">
                                            {LOVE_OPTIONS.map(opt => (
                                                <button type="button" key={opt} onClick={() => setFormData(p => ({ ...p, loveDesigner: opt }))}
                                                    className={clsx("flex-1 py-5 rounded-2xl border-2 text-center font-black text-sm transition-all duration-300",
                                                        formData.loveDesigner === opt
                                                            ? "border-pink-400 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-500/15 dark:to-rose-500/15 text-pink-600 dark:text-pink-300 shadow-2xl shadow-pink-500/15 scale-105"
                                                            : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-slate-400 hover:border-pink-300 hover:scale-[1.02]"
                                                    )}>
                                                    <span className="text-2xl block mb-1.5">{opt === 'Rất thương' ? '❤️‍🔥' : '💕'}</span>
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                                return null;
                            };

                            // ========== MOBILE: SCROLLABLE TIMELINE ==========
                            const mobileTimeline = (
                                <form onSubmit={handleFormSubmit} className="lg:hidden space-y-0">
                                    {/* Sticky progress top bar */}
                                    <div className="sticky top-0 z-30 -mx-4 px-4 pb-3 pt-1 bg-gradient-to-b from-slate-50 via-slate-50/95 to-transparent dark:from-slate-900 dark:via-slate-900/95">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiến trình</p>
                                            <p className="text-[10px] font-bold text-slate-400">{STEPS.filter((_, i) => isStepDone(i)).length}/{STEPS.length} bước</p>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {STEPS.map((step, i) => {
                                                const c = colorMap[step.color];
                                                return (
                                                    <div key={i} className={clsx("h-1.5 rounded-full flex-1 transition-all duration-500", isStepDone(i) ? `bg-gradient-to-r ${c.gradient}` : "bg-slate-200 dark:bg-slate-700")} />
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Timeline sections */}
                                    <div className="relative pl-10 space-y-6 pb-4">
                                        {/* Timeline vertical line */}
                                        <div className="absolute left-[17px] top-4 bottom-8 w-0.5 bg-gradient-to-b from-violet-300 via-emerald-300 to-pink-300 dark:from-violet-500/30 dark:via-emerald-500/30 dark:to-pink-500/30 rounded-full z-0" />

                                        {STEPS.map((step, i) => {
                                            const done = isStepDone(i);
                                            const c = colorMap[step.color];
                                            return (
                                                <div key={i} className="relative">
                                                    {/* Timeline dot */}
                                                    <div className={clsx("absolute -left-10 top-5 w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black transition-all duration-500 z-10 shadow-lg",
                                                        done ? `bg-gradient-to-br ${c.gradient} shadow-lg` : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 shadow-none"
                                                    )}>
                                                        {done ? <CheckCircle2 size={16} /> : <span>{i + 1}</span>}
                                                    </div>

                                                    {/* Card */}
                                                    <div className={clsx("relative overflow-hidden rounded-2xl transition-all duration-300",
                                                        done
                                                            ? "bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-lg"
                                                            : "bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-white/5 shadow-sm"
                                                    )}>
                                                        {/* Step header */}
                                                        <div className={clsx("flex items-center gap-3 px-5 py-3.5 border-b transition-colors",
                                                            done ? "border-slate-200/30 dark:border-white/5" : "border-slate-100/50 dark:border-white/[0.02]"
                                                        )}>
                                                            <span className="text-lg">{step.emoji}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={clsx("text-[10px] font-black uppercase tracking-widest", done ? c.text : "text-slate-400 dark:text-slate-500")}>Bước {i + 1}</p>
                                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{step.label}</p>
                                                            </div>
                                                            {done && <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 size={14} className="text-emerald-500" /></div>}
                                                        </div>

                                                        {/* Step body */}
                                                        <div className="p-5">
                                                            {renderStepContent(i)}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    </div>

                                    {/* Submit section - outside timeline container to avoid line overlap */}
                                    <div className="relative pt-2">
                                        {/* Summary card */}
                                        {STEPS.every((_, i) => isStepDone(i)) && (
                                            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-slate-50/80 to-violet-50/50 dark:from-slate-800/60 dark:to-violet-900/20 border border-slate-200/50 dark:border-white/5 space-y-2.5">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📋 Tóm tắt yêu cầu</p>
                                                <div className="grid grid-cols-2 gap-2.5 text-xs">
                                                    <div><span className="text-slate-400">Người gửi:</span><p className="font-bold text-slate-700 dark:text-slate-200">{formData.person === '__other__' ? formData.personOther : formData.person}</p></div>
                                                    <div><span className="text-slate-400">Thương hiệu:</span><p className="font-bold text-slate-700 dark:text-slate-200">{formData.brand}</p></div>
                                                    <div><span className="text-slate-400">Yêu cầu:</span><p className="font-bold text-slate-700 dark:text-slate-200">{formData.request === '__other__' ? formData.requestOther : formData.request}</p></div>
                                                    <div><span className="text-slate-400">Designer:</span><p className="font-bold text-pink-600">{formData.loveDesigner} ❤️</p></div>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2"><span className="text-slate-400">Mô tả: </span>{formData.description}</p>
                                            </div>
                                        )}

                                        {formError && (
                                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 mb-4">
                                                <AlertCircle size={18} className="text-red-500 shrink-0" />
                                                <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formError}</p>
                                            </div>
                                        )}

                                        <button type="submit" disabled={formSubmitting || !STEPS.every((_, i) => isStepDone(i))}
                                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-600 text-white font-black text-base shadow-xl shadow-violet-500/30 hover:shadow-2xl active:scale-[0.98] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5">
                                            {formSubmitting ? <><Loader2 size={20} className="animate-spin" />Đang gửi...</> : <><Sparkles size={20} />Gửi yêu cầu ngay</>}
                                        </button>
                                        <div className="text-center flex items-center justify-center gap-2 text-[11px] text-slate-400 mt-3">
                                            <Shield size={12} className="text-emerald-500" />
                                            <span>Dữ liệu được gửi an toàn đến Google Forms</span>
                                        </div>
                                    </div>
                                </form>
                            );

                            // ========== DESKTOP: VERTICAL SCROLL TIMELINE ==========
                            const desktopSteps = (
                                <form onSubmit={handleFormSubmit} className="hidden lg:block space-y-0">
                                    {/* Sticky progress top bar */}
                                    <div className="sticky top-0 z-30 -mx-4 px-4 pb-4 pt-2 bg-gradient-to-b from-slate-50 via-slate-50/95 to-transparent dark:from-slate-900 dark:via-slate-900/95">
                                        <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 p-4 shadow-xl">
                                            <div className="flex items-center justify-between mb-2.5">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiến trình</p>
                                                <p className={clsx("text-[10px] font-black", sc.text)}>{STEPS.filter((_, i) => isStepDone(i)).length}/{STEPS.length} bước</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {STEPS.map((step, i) => {
                                                    const c = colorMap[step.color];
                                                    return (
                                                        <div key={i} className={clsx("h-2 rounded-full flex-1 transition-all duration-500", isStepDone(i) ? `bg-gradient-to-r ${c.gradient}` : "bg-slate-200 dark:bg-slate-700")} />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline sections */}
                                    <div className="relative pl-14 space-y-8 pb-4">
                                        {/* Timeline vertical line */}
                                        <div className="absolute left-[21px] top-4 bottom-8 w-0.5 bg-gradient-to-b from-violet-300 via-emerald-300 to-pink-300 dark:from-violet-500/30 dark:via-emerald-500/30 dark:to-pink-500/30 rounded-full z-0" />

                                        {STEPS.map((step, i) => {
                                            const done = isStepDone(i);
                                            const c = colorMap[step.color];
                                            return (
                                                <div key={i} className="relative">
                                                    {/* Timeline dot */}
                                                    <div className={clsx("absolute -left-14 top-6 w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black transition-all duration-500 z-10 shadow-lg",
                                                        done ? `bg-gradient-to-br ${c.gradient} shadow-lg` : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 shadow-none"
                                                    )}>
                                                        {done ? <CheckCircle2 size={18} /> : <span>{i + 1}</span>}
                                                    </div>

                                                    {/* Card */}
                                                    <div className={clsx("relative overflow-hidden rounded-3xl transition-all duration-300",
                                                        done
                                                            ? "bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-xl"
                                                            : "bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-white/5 shadow-md"
                                                    )}>
                                                        {/* Step header */}
                                                        <div className={clsx("relative overflow-hidden flex items-center gap-4 px-6 py-4 border-b transition-colors",
                                                            done ? `bg-gradient-to-r ${c.gradient}` : "bg-slate-50/80 dark:bg-slate-900/50 border-slate-100/50 dark:border-white/[0.02]"
                                                        )}>
                                                            {done && <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />}
                                                            <div className={clsx("relative z-10 w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-md",
                                                                done ? "bg-white/20 backdrop-blur-xl" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                                            )}>
                                                                {step.emoji}
                                                            </div>
                                                            <div className="relative z-10 flex-1 min-w-0">
                                                                <p className={clsx("text-[10px] font-black uppercase tracking-widest",
                                                                    done ? "text-white/70" : "text-slate-400 dark:text-slate-500"
                                                                )}>Bước {i + 1}</p>
                                                                <p className={clsx("text-sm font-bold truncate",
                                                                    done ? "text-white" : "text-slate-800 dark:text-slate-200"
                                                                )}>{step.label}</p>
                                                            </div>
                                                            {done && (
                                                                <div className="relative z-10 w-7 h-7 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center">
                                                                    <CheckCircle2 size={16} className="text-white" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Step body */}
                                                        <div className="p-6">
                                                            {renderStepContent(i)}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    </div>

                                    {/* Submit section - outside timeline container to avoid line overlap */}
                                    <div className="relative pt-2">
                                        {/* Summary card */}
                                        {STEPS.every((_, i) => isStepDone(i)) && (
                                            <div className="mb-5 p-5 rounded-3xl bg-gradient-to-br from-slate-50/80 to-violet-50/50 dark:from-slate-800/60 dark:to-violet-900/20 border border-slate-200/50 dark:border-white/5 space-y-3 shadow-lg">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📋 Tóm tắt yêu cầu</p>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                                    <div><span className="text-slate-400">Người gửi:</span><p className="font-bold text-slate-700 dark:text-slate-200">{formData.person === '__other__' ? formData.personOther : formData.person}</p></div>
                                                    <div><span className="text-slate-400">Thương hiệu:</span><p className="font-bold text-slate-700 dark:text-slate-200">{formData.brand}</p></div>
                                                    <div><span className="text-slate-400">Yêu cầu:</span><p className="font-bold text-slate-700 dark:text-slate-200">{formData.request === '__other__' ? formData.requestOther : formData.request}</p></div>
                                                    <div><span className="text-slate-400">Designer:</span><p className="font-bold text-pink-600">{formData.loveDesigner} ❤️</p></div>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2"><span className="text-slate-400">Mô tả: </span>{formData.description}</p>
                                            </div>
                                        )}

                                        {formError && (
                                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 mb-4">
                                                <AlertCircle size={18} className="text-red-500 shrink-0" />
                                                <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formError}</p>
                                            </div>
                                        )}

                                        <button type="submit" disabled={formSubmitting || !STEPS.every((_, i) => isStepDone(i))}
                                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-600 text-white font-black text-base shadow-xl shadow-violet-500/30 hover:shadow-2xl active:scale-[0.98] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5">
                                            {formSubmitting ? <><Loader2 size={20} className="animate-spin" />Đang gửi...</> : <><Sparkles size={20} />Gửi yêu cầu ngay</>}
                                        </button>
                                        <div className="text-center flex items-center justify-center gap-2 text-[11px] text-slate-400 mt-3">
                                            <Shield size={12} className="text-emerald-500" />
                                            <span>Dữ liệu được gửi an toàn đến Google Forms</span>
                                        </div>
                                    </div>
                                </form>
                            );

                            return (
                                <>
                                    {mobileTimeline}
                                    {desktopSteps}
                                </>
                            );
                        })()}
                    </main>
                )
            }

            {/* ===== TAB: PRODUCTS ===== */}
            {activeTab === 'products' && (
                <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">
                    <div className="rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-xl p-8 sm:p-12 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/10 dark:to-orange-500/10 flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <ShoppingBag size={36} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">Dữ liệu Hàng hóa</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                            Quản lý danh mục sản phẩm, hàng hóa, vật tư cho các thương hiệu. Theo dõi tồn kho và lịch sử đặt hàng.
                        </p>
                        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm font-bold">
                            <Clock size={16} />
                            <span>Đang phát triển...</span>
                        </div>
                    </div>
                </main>
            )}

            {/* ===== TAB: CUSTOMERS ===== */}
            {activeTab === 'customers' && (
                <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">
                    <div className="rounded-3xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-xl p-8 sm:p-12 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-500/10 dark:to-pink-500/10 flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <Users size={36} className="text-rose-600 dark:text-rose-400" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">Dữ liệu Khách hàng</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                            Quản lý thông tin khách hàng, đối tác và lịch sử giao dịch. Phân tích dữ liệu khách hàng theo thương hiệu.
                        </p>
                        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-sm font-bold">
                            <Clock size={16} />
                            <span>Đang phát triển...</span>
                        </div>
                    </div>
                </main>
            )}


            {/* Footer */}
            <footer className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 pt-6 mt-8 border-t border-slate-200/50 dark:border-white/10">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-400 dark:text-slate-500 font-mono">
                    <div className="flex items-center gap-2">
                        <Shield size={14} className="text-violet-400" />
                        <span>© 2026 <span className="text-violet-600 dark:text-violet-400 font-bold">AVGFlow System</span> • Chế độ xem công khai cho đối tác</span>
                    </div>
                    <div className="flex gap-4">
                        <span>v2.5.0</span>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <span>Dữ liệu cập nhật realtime</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PublicOrders;

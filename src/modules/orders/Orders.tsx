import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, Clock, User, Tag, FileText, Filter, Search, ArrowUpDown, ChevronDown, AlertCircle, CheckCircle2, Loader2, Truck, XCircle, BarChart as BarChartIcon, Calendar, CalendarClock, Copy, Printer, PenLine } from 'lucide-react';
import PrintOrdersManager from './PrintOrdersManager';
import DesignOrdersManager from './DesignOrdersManager';
import { clsx } from 'clsx';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import HeroBanner from '../../components/HeroBanner';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { db } from '../../lib/firebase';
import { doc, setDoc, onSnapshot, collection } from '@/lib/firestore';
import { GlassDatePicker } from '../../components/ui/GlassDatePicker';

import { fetchDesignOrders, parseDesignOrders, subscribeToDesignOrderChanges } from '../../services/designOrderService';
import { fetchPrintOrders as fetchPrintOrdersService, subscribeToPrintOrderChanges } from '../../services/printOrderService';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx9KkabbjikHf61xfeXfxgNlbjRn4TozZu58xGrF58Ys8swvyA7lG-QpEfPms9C9TvF/exec';

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
    deliveryDate?: string; // ISO string
    updatedBy?: string;
    updatedAt?: string;
}

// Allowed emails for editing order status/delivery
const ALLOWED_EDITOR_EMAILS = [
    'mcngocsonvualoidan@gmail.com',  // Admin
    'ccmartech.com@gmail.com',         // Admin
    'lenguyet011@gmail.com',            // Lê Thị Ánh Nguyệt
];

const STATUS_OPTIONS = [
    'Đang xử lý',
    'Đã đặt in',
    'Hoàn thành',
    'Đã hủy',
];




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
    // Default: Đang xử lý
    return { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', icon: AlertCircle, label: 'Đang xử lý' };
}

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

// Fixed color assignments for specific people
// Normalization for brand names to group similar ones (e.g. BIO-ATV and BIO ATV)
const normalizeBrandName = (name: string): string => {
    if (!name) return 'KHAC';
    // Remove accents, symbols, spaces and convert to uppercase
    return name.trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-zA-Z0-9]/g, '') // remove symbols/spaces
        .toUpperCase();
};

const personColorOverrides: Record<string, { text: string; bg: string; border: string }> = {
    'Ngọc Bích': { text: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-200/60 dark:border-teal-500/20' },
    'Mây Nguyễn': { text: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-200/60 dark:border-sky-500/20' },
};

function getPersonColor(name: string) {
    if (!name) return personColorPalette[0];
    // Check for specific override first
    const trimmed = name.trim();
    if (personColorOverrides[trimmed]) return personColorOverrides[trimmed];
    // Fallback to hash-based color
    let hash = 0;
    for (let i = 0; i < trimmed.length; i++) {
        hash = trimmed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return personColorPalette[Math.abs(hash) % personColorPalette.length];
}

const Orders: React.FC = () => {
    const { currentUser, isAdminView } = useAuth();
    const { users } = useData();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedYear, setSelectedYear] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [sortNewestFirst, setSortNewestFirst] = useState(true);

    // Order metadata from Firestore (status overrides + delivery dates)
    const [orderMetas, setOrderMetas] = useState<Record<string, OrderMeta>>({});
    const [savingMeta, setSavingMeta] = useState<string | null>(null);
    const [editingStatus, setEditingStatus] = useState<string | null>(null);
    const [editingDelivery, setEditingDelivery] = useState<string | null>(null);
    const [tempDeliveryDate, setTempDeliveryDate] = useState<Date>(new Date());
    const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const activeTab = (tabParam === 'print' ? 'print' : tabParam === 'design' ? 'design' : 'orders') as 'orders' | 'print' | 'design';
    const setActiveTab = useCallback((tab: 'orders' | 'print' | 'design') => {
        setSearchParams((prev: URLSearchParams) => {
            const next = new URLSearchParams(prev);
            if (tab === 'orders') next.delete('tab'); else next.set('tab', tab);
            return next;
        }, { replace: true });
    }, [setSearchParams]);
    const [printProcessingCount, setPrintProcessingCount] = useState(0);

    // Fetch print orders count (only 'Chưa xử lý') — from Supabase
    useEffect(() => {
        const fetchPrintCount = async () => {
            try {
                // 🛡️ Supabase-first fetch (protected data)
                const orders = await fetchPrintOrdersService();
                let count = 0;
                for (const o of orders) {
                    const status = (o.status || 'Chưa xử lý').trim().toLowerCase();
                    if (status === 'chưa xử lý' || status === '') count++;
                }
                setPrintProcessingCount(count);
            } catch { /* silent */ }
        };
        fetchPrintCount();
        // 🔔 Realtime subscription for auto-count updates
        const unsubscribe = subscribeToPrintOrderChanges(() => {
            fetchPrintCount();
        });
        return () => unsubscribe();
    }, []);

    // Fetch design tickets pending count from Firestore
    const [designPendingCount, setDesignPendingCount] = useState(0);
    useEffect(() => {
        const ticketsRef = collection(db, 'design_tickets');
        const unsubscribe = onSnapshot(ticketsRef, (snapshot) => {
            let count = 0;
            snapshot.docs.forEach(d => {
                const status = d.data().status;
                if (['open', 'in-review', 'revision'].includes(status)) count++;
            });
            setDesignPendingCount(count);
        });
        return () => unsubscribe();
    }, []);

    // Check if current user can edit orders
    const canEdit = useMemo(() => {
        if (!currentUser?.email) return false;
        // If simulation mode is GUEST, nobody can edit (view-only)
        if (!isAdminView) return false;

        return ALLOWED_EDITOR_EMAILS.includes(currentUser.email.toLowerCase());
    }, [currentUser, isAdminView]);


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

    // Sync to Google Sheet via Apps Script (fire-and-forget)
    // NOTE: POST body bị mất do Google 302 redirect (POST→GET), nên dùng GET với URL params
    const syncToSheet = useCallback((action: string, payload: Record<string, string>) => {
        const params = new URLSearchParams({ action, ...payload });
        const url = `${APPS_SCRIPT_URL}?${params.toString()}`;
        
        // Primary: GET with no-cors (fire-and-forget, luôn hoạt động)
        fetch(url, { mode: 'no-cors', redirect: 'follow' })
            .then(() => console.log('[SheetSync] ✅ GET request sent:', action, payload))
            .catch(err => console.warn('[SheetSync] ❌ GET error:', err));
    }, []);

    // Save order meta to Firestore + sync to Sheet
    const saveOrderMeta = useCallback(async (orderId: string, data: Partial<OrderMeta>) => {
        if (!canEdit || !orderId) return;
        setSavingMeta(orderId);
        try {
            const currentAppUser = users.find(u => u.email === currentUser?.email);
            const updatedBy = currentAppUser?.name || currentUser?.email || 'Unknown';
            
            // 1. Save to Firestore (fire-and-forget for instant UI)
            setDoc(doc(db, 'order_metas', orderId), {
                ...orderMetas[orderId],
                ...data,
                updatedBy,
                updatedAt: new Date().toISOString(),
            }, { merge: true }).catch(err => console.warn('[Firestore] Write error:', err));

            // 2. Sync to Google Sheet via Apps Script
            if (data.statusOverride && data.deliveryDate) {
                syncToSheet('updateBoth', { orderId, status: data.statusOverride, deliveryDate: data.deliveryDate, updatedBy });
            } else if (data.statusOverride) {
                syncToSheet('updateStatus', { orderId, status: data.statusOverride, updatedBy });
            } else if (data.deliveryDate) {
                syncToSheet('updateDelivery', { orderId, deliveryDate: data.deliveryDate, updatedBy });
            }
        } catch (err) {
            console.error('Error saving order meta:', err);
        } finally {
            setSavingMeta(null);
        }
    }, [canEdit, currentUser, users, orderMetas, syncToSheet]);

    const handleStatusChange = useCallback(async (orderId: string, newStatus: string) => {
        await saveOrderMeta(orderId, { statusOverride: newStatus });
        setEditingStatus(null);
    }, [saveOrderMeta]);

    const handleDeliverySave = useCallback(async (orderId: string) => {
        if (!orderId) return;
        const baseDate = tempDeliveryDate || new Date();

        await saveOrderMeta(orderId, { deliveryDate: baseDate.toISOString() });
        setEditingDelivery(null);
    }, [tempDeliveryDate, saveOrderMeta]);

    const openDeliveryPicker = useCallback((orderId: string, existingDate?: string) => {
        const d = existingDate ? new Date(existingDate) : new Date();
        if (isNaN(d.getTime())) {
            const now = new Date();
            setTempDeliveryDate(now);
        } else {
            setTempDeliveryDate(d);
        }
        setEditingDelivery(orderId);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            // 🛡️ Supabase-first fetch (protected data)
            const rows = await fetchDesignOrders();
            if (rows.length < 2) throw new Error('Không có dữ liệu');
            const parsedOrders = parseDesignOrders(rows);
            setOrders(parsedOrders);
        } catch (e: any) {
            setError(e.message || 'Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // 🔄 Realtime subscription for auto-updates
        const unsubRealtime = subscribeToDesignOrderChanges((rows) => {
            const parsedOrders = parseDesignOrders(rows);
            setOrders(parsedOrders);
        });
        return () => unsubRealtime();
    }, []);



    // Unique statuses
    const uniqueStatuses = useMemo(() => {
        const set = new Set(orders.map(o => o.status).filter(Boolean));
        return Array.from(set);
    }, [orders]);

    // Filtered and sorted
    const filteredOrders = useMemo(() => {
        let result = [...orders];

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(o => o.status === statusFilter);
        }

        // Search
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

        // Month filter
        if (selectedMonth) {
            result = result.filter(o => {
                if (!o.parsedDate) return false;
                const m = `${o.parsedDate.getFullYear()}-${String(o.parsedDate.getMonth() + 1).padStart(2, '0')}`;
                return m === selectedMonth;
            });
        }

        // Brand filter
        if (selectedBrand) {
            result = result.filter(o => normalizeBrandName(o.brand) === selectedBrand);
        }

        // Sort by date
        result.sort((a, b) => {
            if (!a.parsedDate && !b.parsedDate) return 0;
            if (!a.parsedDate) return 1;
            if (!b.parsedDate) return -1;

            const timeDiff = sortNewestFirst
                ? b.parsedDate.getTime() - a.parsedDate.getTime()
                : a.parsedDate.getTime() - b.parsedDate.getTime();

            if (timeDiff !== 0) return timeDiff;

            // Fallback: use row indices (derived from ID) to be stable
            const aRow = a.id.startsWith('row-') ? parseInt(a.id.split('-')[1], 10) : 0;
            const bRow = b.id.startsWith('row-') ? parseInt(b.id.split('-')[1], 10) : 0;
            return sortNewestFirst ? bRow - aRow : aRow - bRow;
        });

        return result;
    }, [orders, statusFilter, searchQuery, sortNewestFirst, selectedMonth, selectedBrand]);

    // Helper: get effective status (considering overrides)
    const getEffectiveStatus = useCallback((order: Order): string => {
        const meta = orderMetas[order.id];
        return meta?.statusOverride || order.status;
    }, [orderMetas]);

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

        // Convert to array and sort by month
        const data = Object.keys(counts).map(monthStr => {
            const [year, m] = monthStr.split('-');
            return {
                name: `${m}/${year}`,
                fullMonth: monthStr,
                total: counts[monthStr],
                lineTotal: counts[monthStr] + 3.5 // Offset the line upward above bars
            };
        }).sort((a, b) => a.fullMonth.localeCompare(b.fullMonth));
        return data;
    }, [orders, selectedYear]);

    // Brand stats for bar chart with intelligent grouping
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
                // Safety check: ensure keys exist before reduce
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
        
        // Use local dates for day-relative comparison
        const todayAtZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dateAtZero = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        // Difference in full days (calendar days)
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

    return (
        <div className="space-y-6">
            {/* ===== HERO BANNER (matching Nhiệm vụ style) ===== */}
            <HeroBanner
                icon={Package}
                title="Đơn đặt hàng"
                subtitle="QUẢN LÝ ĐƠN HÀNG"
                description="Theo dõi & quản lý đơn đặt hàng vật tư, in ấn cho các thương hiệu."
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

            {/* Tab Switcher */}
            <div className="flex gap-1.5 p-1.5 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-sm w-fit">
                <button
                    onClick={() => setActiveTab('orders')}
                    className={clsx("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                        activeTab === 'orders'
                            ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    )}
                >
                    <Package size={16} /> Đơn hàng
                </button>
                <button
                    onClick={() => setActiveTab('print')}
                    className={clsx("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                        activeTab === 'print'
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    )}
                >
                    <Printer size={16} /> In ấn
                    {printProcessingCount > 0 && (
                        <span className={clsx(
                            'ml-1 min-w-[20px] h-5 flex items-center justify-center rounded-full text-[11px] font-bold px-1.5',
                            activeTab === 'print'
                                ? 'bg-white/25 text-white'
                                : 'bg-cyan-500 text-white animate-pulse'
                        )}>
                            {printProcessingCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('design')}
                    className={clsx("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                        activeTab === 'design'
                            ? 'bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white shadow-lg shadow-fuchsia-500/30'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                    )}
                >
                    <PenLine size={16} /> Thiết kế
                    {designPendingCount > 0 && (
                        <span className={clsx(
                            'ml-1 min-w-[20px] h-5 flex items-center justify-center rounded-full text-[11px] font-bold px-1.5',
                            activeTab === 'design'
                                ? 'bg-white/25 text-white'
                                : 'bg-fuchsia-500 text-white animate-pulse'
                        )}>
                            {designPendingCount}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'print' ? (
                <PrintOrdersManager />
            ) : activeTab === 'design' ? (
                <DesignOrdersManager />
            ) : (
            <>
            {/* Charts Section */}
            {monthlyStats && monthlyStats.length > 0 && (
                <div className="grid grid-cols-1 gap-6">
                    {/* Monthly Bar Chart */}
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
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
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
                                                fill={entry.fullMonth === selectedMonth ? '#4f46e5' : 'url(#colorTotal)'}
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
            {
                loading && (
                    <div className="flex flex-col items-center justify-center p-16 text-slate-500">
                        <Loader2 className="animate-spin h-8 w-8 text-violet-500 mb-3" />
                        <span className="text-sm font-medium">Đang tải đơn hàng...</span>
                    </div>
                )
            }

            {/* Error State */}
            {
                error && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400">
                        <AlertCircle size={20} />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )
            }

            {/* Orders List */}
            {
                !loading && !error && (
                    <div className="space-y-3">
                        {filteredOrders.map((order, idx) => {
                            const effectiveStatus = getEffectiveStatus(order);
                            const statusInfo = getStatusInfo(effectiveStatus);
                            const StatusIcon = statusInfo.icon;
                            const timeAgo = formatTimeAgo(order.parsedDate);
                            const meta = orderMetas[order.id] || {};
                            const isSaving = savingMeta === order.id;

                            return (
                                <div
                                    key={order.id || idx}
                                    className={clsx(
                                        "group relative flex flex-col sm:flex-row bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl transition-all duration-300",
                                        (editingStatus === order.id || editingDelivery === order.id) ? "z-50" : "z-10 hover:z-20",
                                        statusInfo.label === 'Đang xử lý'
                                            ? "border-2 border-amber-300/80 dark:border-amber-500/50 shadow-[0_8px_30px_rgb(251,191,36,0.15)] ring-1 ring-amber-400/20"
                                            : "border border-white/50 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/10 shadow-sm",
                                    )}
                                >
                                    {/* Glassmorphism shimmer */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />

                                    {/* Smart Date Block (Left Side) */}
                                    <div className="relative flex sm:flex-col items-center justify-between sm:justify-center p-4 sm:p-5 sm:w-32 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-3xl sm:rounded-tr-none sm:rounded-l-3xl">
                                        <div className="flex items-center sm:flex-col sm:items-center gap-3 sm:gap-1.5 w-full justify-center">
                                            {/* ID Badge (Moved to Top) */}
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
                                                    {/* Person Badge - Moved from Sidebar to Header Area */}
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

                                                    {/* Status Badge - Pushed to top right */}
                                                    <div
                                                        className={clsx(
                                                            "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold border shadow-sm shrink-0 relative",
                                                            canEdit && "cursor-pointer hover:ring-2 hover:ring-violet-400/30 transition-all",
                                                            statusInfo.bg, statusInfo.color, statusInfo.border
                                                        )}
                                                        onClick={(e) => {
                                                            if (canEdit) {
                                                                e.stopPropagation();
                                                                setEditingStatus(editingStatus === order.id ? null : order.id);
                                                            }
                                                        }}
                                                    >
                                                        <StatusIcon size={14} />
                                                        <span>{effectiveStatus || 'N/A'}</span>
                                                        {canEdit && <ChevronDown size={10} className="ml-0.5 opacity-60" />}
                                                        {/* Status Dropdown */}
                                                        {editingStatus === order.id && canEdit && (
                                                            <div className="absolute top-full right-0 mt-2 z-50 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl shadow-violet-500/10 overflow-hidden min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
                                                                <div className="p-1.5">
                                                                    {STATUS_OPTIONS.map(opt => {
                                                                        const optInfo = getStatusInfo(opt);
                                                                        const OptIcon = optInfo.icon;
                                                                        const isActive = effectiveStatus === opt;
                                                                        return (
                                                                            <button
                                                                                key={opt}
                                                                                onClick={() => handleStatusChange(order.id, opt)}
                                                                                disabled={isSaving}
                                                                                className={clsx(
                                                                                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                                                                                    isActive
                                                                                        ? `${optInfo.bg} ${optInfo.color} ${optInfo.border} border`
                                                                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                                                                                )}
                                                                            >
                                                                                <OptIcon size={14} />
                                                                                <span>{opt}</span>
                                                                                {isActive && <CheckCircle2 size={12} className="ml-auto" />}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                                {isSaving && <div className="px-3 py-1.5 text-[10px] text-violet-500 font-semibold text-center border-t border-slate-200 dark:border-slate-700 bg-violet-50/50 dark:bg-violet-500/5">Đang lưu...</div>}
                                                            </div>
                                                        )}
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

                                                    {/* Description Box on Top Level (visible on PC natively, or stacked on mobile) */}
                                                    {order.description && (() => {
                                                        const isLongDescription = order.description.length > 150 || (order.description.match(/\n/g) || []).length >= 3;
                                                        return (
                                                            <div className="flex-1 min-w-0 flex gap-3 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative group">
                                                                <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
                                                                    <FileText size={16} className="text-violet-600 dark:text-violet-400" />
                                                                </div>
                                                                <div className="flex-1 min-w-0 pr-8">
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
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigator.clipboard.writeText(order.description);
                                                                        setCopiedOrderId(order.id);
                                                                        setTimeout(() => setCopiedOrderId(null), 2000);
                                                                    }}
                                                                    className={clsx(
                                                                        "absolute right-3 top-3 px-2 flex items-center gap-1.5 py-1.5 rounded-lg transition-all text-[11px] font-semibold",
                                                                        copiedOrderId === order.id
                                                                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 opacity-100"
                                                                            : "text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 opacity-0 group-hover:opacity-100"
                                                                    )}
                                                                    title="Copy nội dung"
                                                                >
                                                                    {copiedOrderId === order.id ? (
                                                                        <>
                                                                            <CheckCircle2 size={14} />
                                                                            Đã copy
                                                                        </>
                                                                    ) : (
                                                                        <Copy size={14} />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Delivery Date Section */}
                                                    {(meta.deliveryDate || canEdit) && (
                                                        <div className="w-full lg:w-[260px] shrink-0 flex flex-col gap-3 relative">
                                                            {/* Delivery Date Display (visible to all) */}
                                                            {meta.deliveryDate && (
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
                                                            )}

                                                            {/* Admin/Authorized: Delivery Date Picker Button */}
                                                            {canEdit && (
                                                                <div className="flex justify-end relative">
                                                                    <button
                                                                        onClick={() => openDeliveryPicker(order.id, meta.deliveryDate)}
                                                                        className="flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 text-xs font-bold hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-all border border-violet-200/50 dark:border-violet-500/20 shadow-sm"
                                                                    >
                                                                        <Calendar size={14} />
                                                                        {meta.deliveryDate ? 'Sửa' : 'Chọn ngày giao hàng dự kiến'}
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Inline Date Picker (Absolute Dropdown) */}
                                                            {canEdit && editingDelivery === order.id && (
                                                                <div className="absolute top-full right-0 mt-2 z-[100] transform md:translate-x-0 -translate-x-1/4">
                                                                    <GlassDatePicker
                                                                        selected={tempDeliveryDate}
                                                                        onSelect={setTempDeliveryDate}
                                                                        onClose={() => setEditingDelivery(null)}
                                                                        onSave={() => handleDeliverySave(order.id)}
                                                                        minDate={new Date(new Date().getTime() + 15 * 60000)} // At least 15 min from now
                                                                        errorMessagePrefix="Ngày giao hàng dự kiến"
                                                                    />
                                                                </div>
                                                            )}
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
                )
            }
            </>
            )}
        </div>
    );
};

export default Orders;

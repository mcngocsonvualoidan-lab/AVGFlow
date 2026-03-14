import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tag, Layers, Hash, FileText, Ruler, Scale, Package, DollarSign, Calculator, CalendarClock, StickyNote, CheckCircle2, PenLine, XCircle, ShoppingCart, ChevronUp, ChevronDown, Loader2, AlertCircle, Printer, LayoutGrid, Table } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

// ===== CONFIG =====
const PRINT_SHEET_ID = '16GLyiZLdBknve7P_JO9ly-Luy5vIgdizNmQH985zPeo';
const PRINT_CSV_URL = `https://docs.google.com/spreadsheets/d/${PRINT_SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const PRINT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyt_spuMfPA4iQ7qvOe-KH7xoh9AehAOD9e_OH3hdvlfQZSUpq2_0NUNbiLnkAZaY2Q/exec';

const ALLOWED_EDITOR_EMAILS = [
    'mcngocsonvualoidan@gmail.com',
    'ccmartech.com@gmail.com',
    'lenguyet011@gmail.com',
];

interface PrintOrder {
    id: string;
    rowIndex: number;
    timestamp: string;
    person: string;
    category: string;
    brand: string;
    sku: string;
    productName: string;
    size: string;
    unit: string;
    material: string;
    quantity: string;
    deliveryDate: string;
    note: string;
    unitPrice: number;
    totalPrice: number;
    status: string;
    updatedBy: string;
    updatedAt: string;
}

function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    const row: string[] = [];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') { current += '"'; i++; }
                else inQuotes = false;
            } else current += ch;
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') { row.push(current.trim()); current = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
                row.push(current.trim()); current = '';
                if (row.length > 0 && row.some(c => c)) rows.push([...row]);
                row.length = 0;
            } else current += ch;
        }
    }
    row.push(current.trim());
    if (row.some(c => c)) rows.push(row);
    return rows;
}

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
    const [showMobileActions, setShowMobileActions] = useState<string | null>(null);
    const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

    const canEdit = useMemo(() => {
        if (!currentUser?.email) return false;
        if (!isAdminView) return false;
        return ALLOWED_EDITOR_EMAILS.includes(currentUser.email.toLowerCase());
    }, [currentUser, isAdminView]);

    const fetchPrintOrders = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(PRINT_CSV_URL);
            const text = await res.text();
            const rows = parseCSV(text);
            if (rows.length < 2) { setPrintOrders([]); setLoading(false); return; }

            const parsed: PrintOrder[] = [];
            for (let i = 1; i < rows.length; i++) {
                const c = rows[i];
                if (!c[0] && !c[1] && !c[3]) continue;
                parsed.push({
                    id: `po-${i}`,
                    rowIndex: i + 1, // 1-based, row 1 = header
                    timestamp: (c[0] || '').trim(),
                    person: (c[1] || '').trim(),
                    category: (c[2] || '').trim(),
                    brand: (c[3] || '').trim(),
                    sku: (c[4] || '').trim(),
                    productName: (c[5] || '').trim(),
                    size: (c[6] || '').trim(),
                    unit: (c[7] || '').trim(),
                    material: (c[8] || '').trim(),
                    quantity: (c[9] || '').trim(),
                    deliveryDate: (c[10] || '').trim(),
                    note: (c[11] || '').trim(),
                    unitPrice: parseFloat((c[12] || '0').replace(/[.,\s]/g, '')) || 0,
                    status: (c[13] || 'Chưa xử lý').trim(),
                    totalPrice: parseFloat((c[14] || '0').replace(/[.,\s]/g, '')) || 0,
                    updatedBy: (c[15] || '').trim(),
                    updatedAt: (c[16] || '').trim(),
                });
            }
            setPrintOrders(parsed.reverse()); // newest first
        } catch (e: any) {
            setError(e.message || 'Lỗi tải dữ liệu đơn in');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPrintOrders(); }, [fetchPrintOrders]);

    const getPrintStatusInfo = (status: string) => {
        const s = (status || '').toLowerCase().trim();
        if (s.includes('đã đặt in') || s.includes('đã xử lý')) return { color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20', label: 'Đã đặt in' };
        if (s.includes('hoàn thành')) return { color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/20', label: 'Hoàn thành' };
        if (s.includes('hủy')) return { color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', label: 'Đã hủy' };
        return { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', label: 'Chưa xử lý' };
    };

    const handleUpdatePrintOrder = async (po: PrintOrder, updates: { unitPrice?: number; totalPrice?: number; status?: string }) => {
        const updatedBy = users.find(u => u.email === currentUser?.email)?.name || currentUser?.email || 'Unknown';
        const updatedAt = formatVNDateTime(new Date());

        // Optimistic update
        setPrintOrders(prev => prev.map(p => p.id === po.id ? { ...p, ...updates, updatedBy, updatedAt } : p));
        setExpandedPrintOrder(null);
        setCancelConfirmId(null);

        try {
            const resp = await fetch(PRINT_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'update',
                    rowIndex: po.rowIndex,
                    unitPrice: updates.unitPrice,
                    status: updates.status,
                    totalPrice: updates.totalPrice,
                    updatedBy,
                    updatedAt,
                }),
            });
            const result = await resp.json();
            if (!result.success) {
                console.error('Sheet write error:', result.error);
                alert('Lỗi ghi Google Sheet: ' + (result.error || 'Unknown'));
            }
        } catch (err: any) {
            console.error('Error writing to Sheet:', err);
            alert('Lỗi kết nối Google Sheet: ' + (err?.message || ''));
        }
    };

    // ===== Delivery date formatting =====
    const formatDeliveryDate = (d: string) => {
        if (!d) return null;
        // Try DD/MM/YYYY or YYYY-MM-DD
        const parts = d.split('/');
        if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}`;
        return d;
    };

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
                <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setViewMode('card')}
                        className={clsx("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            viewMode === 'card' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        )}
                    >
                        <LayoutGrid size={13} /> Thẻ
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={clsx("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        )}
                    >
                        <Table size={13} /> Bảng
                    </button>
                </div>
            </div>

            {viewMode === 'table' ? (
                /* ===== TABLE VIEW ===== */
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl shadow-lg" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50">
                                {['#', 'Nhãn hàng', 'Tên SP', 'Kích thước', 'Chất liệu', 'SL', 'ĐVT', 'Đơn giá', 'Thành tiền', 'Trạng thái', 'Ngày giao'].map(h => (
                                    <th key={h} className="px-3 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {printOrders.map((po, idx) => {
                                const si = getPrintStatusInfo(po.status);
                                return (
                                    <tr key={po.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-3 py-2.5 text-xs font-bold text-slate-400">{idx + 1}</td>
                                        <td className="px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-white">{po.brand || '—'}</td>
                                        <td className="px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 max-w-[200px] truncate">{po.productName || '—'}</td>
                                        <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">{po.size || '—'}</td>
                                        <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">{po.material || '—'}</td>
                                        <td className="px-3 py-2.5 text-sm font-bold text-cyan-600 dark:text-cyan-400">{po.quantity || '—'}</td>
                                        <td className="px-3 py-2.5 text-sm text-slate-500">{po.unit || '—'}</td>
                                        <td className="px-3 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(po.unitPrice)}</td>
                                        <td className="px-3 py-2.5 text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(po.totalPrice)}</td>
                                        <td className="px-3 py-2.5">
                                            <span className={clsx("px-2 py-1 rounded-lg text-[11px] font-bold border", si.bg, si.color, si.border)}>{si.label}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-sm text-slate-500">{formatDeliveryDate(po.deliveryDate) || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* ===== CARD VIEW ===== */
                <div className="space-y-3">
                    {printOrders.map((po) => {
                        const effectivePrintStatus = po.status || 'Chưa xử lý';
                        const si = getPrintStatusInfo(effectivePrintStatus);
                        const deliveryFormatted = formatDeliveryDate(po.deliveryDate);
                        const isEditing = expandedPrintOrder === po.id;

                        return (
                            <div key={po.id} className="relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-white/10 hover:border-cyan-300 dark:hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/10 shadow-sm transition-all duration-300 overflow-hidden">
                                {/* Shimmer */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent dark:from-white/5 pointer-events-none rounded-2xl" />

                                {/* Card Header - Status + Person */}
                                <div className="relative flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">#{po.rowIndex - 1}</span>
                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{po.person || 'N/A'}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{po.timestamp}</span>
                                    </div>
                                    <span className={clsx("px-2.5 py-1 rounded-xl text-[11px] font-bold border", si.bg, si.color, si.border)}>
                                        {si.label}
                                    </span>
                                </div>

                                {/* ===== DESKTOP CARD BODY (sm+) — 2-row layout ===== */}
                                <div className="hidden sm:block px-5 py-4 space-y-2">
                                    {/* Row 1: Product info */}
                                    <div className="flex flex-row flex-wrap gap-2">
                                        {/* Nhãn hàng */}
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                            <Tag size={12} className="text-indigo-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhãn hàng</p>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{po.brand || 'N/A'}</p>
                                            </div>
                                        </div>
                                        {/* Chủng loại */}
                                        {po.category && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                                <Layers size={12} className="text-violet-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chủng loại</p>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{po.category}</p>
                                                </div>
                                            </div>
                                        )}
                                        {/* SKU */}
                                        {po.sku && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                                <Hash size={12} className="text-cyan-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SKU</p>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{po.sku}</p>
                                                </div>
                                            </div>
                                        )}
                                        {/* Tên sản phẩm */}
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-50/50 dark:bg-cyan-500/5 border border-cyan-200/40 dark:border-cyan-500/15">
                                            <FileText size={12} className="text-cyan-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">Tên sản phẩm</p>
                                                <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300 truncate">{po.productName || 'N/A'}</p>
                                            </div>
                                        </div>
                                        {/* Kích thước */}
                                        {po.size && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                                <Ruler size={12} className="text-orange-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kích thước</p>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{po.size}</p>
                                                </div>
                                            </div>
                                        )}
                                        {/* Chất liệu */}
                                        {po.material && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                                <Scale size={12} className="text-teal-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chất liệu</p>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{po.material}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Row 2: Order/pricing details + Action buttons */}
                                    <div className="flex flex-row flex-wrap gap-2 items-center">
                                        {/* SL đặt in */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-50/70 dark:bg-sky-500/5 border border-sky-200/50 dark:border-sky-500/15">
                                            <Package size={12} className="text-sky-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">SL đặt in</p>
                                                <p className="text-sm font-bold text-sky-700 dark:text-sky-300">{po.quantity || '—'}</p>
                                            </div>
                                        </div>
                                        {/* ĐVT */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                            <Layers size={12} className="text-slate-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ĐVT</p>
                                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{po.unit || '—'}</p>
                                            </div>
                                        </div>
                                        {/* Đơn giá / Thành tiền */}
                                        {isEditing ? (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-50/70 dark:bg-violet-500/5 border border-violet-200/50 dark:border-violet-500/15">
                                                <DollarSign size={12} className="text-violet-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Đơn giá</p>
                                                    <input
                                                        type="text"
                                                        value={inlineUnitPrices[po.id] || ''}
                                                        onChange={e => setInlineUnitPrices(prev => ({ ...prev, [po.id]: e.target.value }))}
                                                        className="text-sm font-bold text-violet-700 dark:text-violet-300 bg-transparent border-none outline-none w-24 placeholder:text-violet-300"
                                                        placeholder="Nhập giá..."
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-50/50 dark:bg-violet-500/5 border border-violet-200/40 dark:border-violet-500/15">
                                                    <DollarSign size={12} className="text-violet-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Đơn giá</p>
                                                        <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{formatCurrency(po.unitPrice)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-200/40 dark:border-indigo-500/15">
                                                    <Calculator size={12} className="text-indigo-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Thành tiền</p>
                                                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(po.totalPrice)}</p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        {/* Ngày giao */}
                                        {deliveryFormatted && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/15">
                                                <CalendarClock size={12} className="text-emerald-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Ngày giao</p>
                                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{deliveryFormatted}</p>
                                                </div>
                                            </div>
                                        )}
                                        {/* Ghi chú */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/40 dark:border-amber-500/15 min-w-0">
                                            <StickyNote size={12} className="text-amber-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Ghi chú</p>
                                                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 truncate">{po.note || '—'}</p>
                                            </div>
                                        </div>

                                        {/* Action buttons — pushed to end */}
                                        {canEdit && (
                                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                {/* Hoàn thành (when editing) */}
                                                {isEditing && (() => {
                                                    const rawPrice = inlineUnitPrices[po.id] || '';
                                                    const priceNum = parseFloat(rawPrice.replace(/[.,\s]/g, '')) || 0;
                                                    const qtyNum = parseInt(po.quantity, 10) || 0;
                                                    const totalNum = qtyNum * priceNum;
                                                    return (
                                                        <button
                                                            onClick={() => handleUpdatePrintOrder(po, { unitPrice: priceNum, totalPrice: totalNum, status: 'Đã đặt in' })}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shrink-0"
                                                        >
                                                            <CheckCircle2 size={13} />
                                                            Hoàn thành
                                                        </button>
                                                    );
                                                })()}
                                                {/* Chỉnh sửa + Hủy (read-only mode, Đã đặt in) */}
                                                {effectivePrintStatus === 'Đã đặt in' && !isEditing && (
                                                    <>
                                                        <button
                                                            onClick={() => { setExpandedPrintOrder(po.id); setInlineUnitPrices(prev => ({ ...prev, [po.id]: po.unitPrice ? po.unitPrice.toString() : '' })); }}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-sm font-bold border border-violet-200 dark:border-violet-500/20 hover:bg-violet-100 hover:shadow-md transition-all shrink-0"
                                                        >
                                                            <PenLine size={12} /> Chỉnh sửa
                                                        </button>
                                                        <button
                                                            onClick={() => setCancelConfirmId(po.id)}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-bold border border-red-200 dark:border-red-500/20 hover:bg-red-100 hover:shadow-md transition-all shrink-0"
                                                        >
                                                            <XCircle size={12} /> Hủy đặt in
                                                        </button>
                                                    </>
                                                )}
                                                {/* Lên đơn hàng (Chưa xử lý) */}
                                                {(effectivePrintStatus === 'Chưa xử lý' || effectivePrintStatus === 'Đã hủy') && !isEditing && (
                                                    <button
                                                        onClick={() => { setExpandedPrintOrder(po.id); setInlineUnitPrices(prev => ({ ...prev, [po.id]: '' })); }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shrink-0"
                                                    >
                                                        <ShoppingCart size={13} />
                                                        {effectivePrintStatus === 'Đã hủy' ? 'Đặt in lại' : 'Lên đơn hàng'}
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
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-50/50 dark:bg-cyan-500/5 border border-cyan-200/40 dark:border-cyan-500/15">
                                        <FileText size={12} className="text-cyan-500 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">Tên sản phẩm</p>
                                            <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300">{po.productName || 'N/A'}</p>
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
                                        {po.size && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                                <Ruler size={11} className="text-orange-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kích thước</p>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{po.size}</p>
                                                </div>
                                            </div>
                                        )}
                                        {po.material && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                                <Scale size={11} className="text-teal-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chất liệu</p>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{po.material}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-50/70 dark:bg-sky-500/5 border border-sky-200/50 dark:border-sky-500/15">
                                            <Package size={11} className="text-sky-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">SL đặt in</p>
                                                <p className="text-sm font-bold text-sky-700 dark:text-sky-300">{po.quantity || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                                            <Layers size={11} className="text-slate-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ĐVT</p>
                                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{po.unit || '—'}</p>
                                            </div>
                                        </div>
                                        {/* Đơn giá / Thành tiền */}
                                        {isEditing ? (
                                            <div className="col-span-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-50/70 dark:bg-violet-500/5 border border-violet-200/50 dark:border-violet-500/15">
                                                <DollarSign size={11} className="text-violet-500 shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Đơn giá</p>
                                                    <input
                                                        type="text"
                                                        value={inlineUnitPrices[po.id] || ''}
                                                        onChange={e => setInlineUnitPrices(prev => ({ ...prev, [po.id]: e.target.value }))}
                                                        className="text-sm font-bold text-violet-700 dark:text-violet-300 bg-transparent border-none outline-none w-full placeholder:text-violet-300"
                                                        placeholder="Nhập giá..."
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
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
                                        {deliveryFormatted && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/15">
                                                <CalendarClock size={11} className="text-emerald-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Ngày giao</p>
                                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{deliveryFormatted}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/40 dark:border-amber-500/15 min-w-0", !deliveryFormatted && "col-span-2")}>
                                            <StickyNote size={11} className="text-amber-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Ghi chú</p>
                                                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 truncate">{po.note || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Toggle arrow for action buttons */}
                                    {canEdit && (
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
                                                    {isEditing && (() => {
                                                        const rawPrice = inlineUnitPrices[po.id] || '';
                                                        const priceNum = parseFloat(rawPrice.replace(/[.,\s]/g, '')) || 0;
                                                        const qtyNum = parseInt(po.quantity, 10) || 0;
                                                        const totalNum = qtyNum * priceNum;
                                                        return (
                                                            <button
                                                                onClick={() => handleUpdatePrintOrder(po, { unitPrice: priceNum, totalPrice: totalNum, status: 'Đã đặt in' })}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[11px] font-bold shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all shrink-0"
                                                            >
                                                                <CheckCircle2 size={13} /> Hoàn thành
                                                            </button>
                                                        );
                                                    })()}
                                                    {effectivePrintStatus === 'Đã đặt in' && !isEditing && (
                                                        <>
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
                                                    {(effectivePrintStatus === 'Chưa xử lý' || effectivePrintStatus === 'Đã hủy') && !isEditing && (
                                                        <button
                                                            onClick={() => { setExpandedPrintOrder(po.id); setInlineUnitPrices(prev => ({ ...prev, [po.id]: '' })); }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[11px] font-bold shadow-lg shadow-cyan-500/25 transition-all shrink-0"
                                                        >
                                                            <ShoppingCart size={13} />
                                                            {effectivePrintStatus === 'Đã hủy' ? 'Đặt in lại' : 'Lên đơn hàng'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Cancel Confirmation Modal */}
                                {cancelConfirmId === po.id && (
                                    <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl z-50 flex items-center justify-center p-6">
                                        <div className="text-center space-y-3">
                                            <XCircle size={32} className="text-red-500 mx-auto" />
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">Xác nhận hủy đặt in?</p>
                                            <p className="text-xs text-slate-500">Hành động này sẽ đổi trạng thái thành "Đã hủy"</p>
                                            <div className="flex gap-2 justify-center">
                                                <button
                                                    onClick={() => handleUpdatePrintOrder(po, { status: 'Đã hủy' })}
                                                    className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-all"
                                                >
                                                    Xác nhận hủy
                                                </button>
                                                <button
                                                    onClick={() => setCancelConfirmId(null)}
                                                    className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition-all"
                                                >
                                                    Quay lại
                                                </button>
                                            </div>
                                        </div>
                                    </div>
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

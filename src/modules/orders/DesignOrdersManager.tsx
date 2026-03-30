import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tag, Box, Share2, PenLine, Sparkles, Search, Filter, XCircle, Clock, UserCheck, CheckCircle2, AlertCircle, Loader2, ArrowUpDown, Package, MessageCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { Timestamp, collection, query, orderBy, onSnapshot } from '@/lib/firestore';
import { db } from '../../lib/firebase';

import DesignTicketStats from './DesignTicketStats';
import DesignTicketPopup from './DesignTicketPopup';
import { useAuth } from '../../context/AuthContext';

// ============================================================
// TYPES
// ============================================================
interface DesignTicket {
    id: string;
    ticketCode: string;
    category: 'label-bag' | 'carton' | 'social';
    action: 'edit' | 'new';
    brandName: string;
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
    contactAddress?: string;
    description: string;
    status: 'open' | 'in-review' | 'revision' | 'approved' | 'completed' | 'cancelled';
    revisionRound: number;
    createdAt: Timestamp | string | null;
    updatedAt: Timestamp | string | null;
    completedAt?: Timestamp | string | null;
    assignedTo?: string;
    formData?: Record<string, string>;
    imageUrls?: string[];
}

// ============================================================
// CONFIG
// ============================================================
const CATEGORY_CONFIG: Record<string, { label: string; icon: React.FC<any>; gradient: string; lightBg: string; border: string; text: string }> = {
    'label-bag': { label: 'Nhãn / Túi', icon: Tag, gradient: 'from-violet-500 to-purple-600', lightBg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200 dark:border-violet-500/20', text: 'text-violet-600 dark:text-violet-400' },
    'carton': { label: 'Thùng Carton', icon: Box, gradient: 'from-amber-500 to-orange-600', lightBg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
    'social': { label: 'Social Media', icon: Share2, gradient: 'from-cyan-500 to-blue-600', lightBg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-cyan-200 dark:border-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400' },
};

const ACTION_CONFIG: Record<string, { label: string; icon: React.FC<any> }> = {
    edit: { label: 'Chỉnh sửa', icon: PenLine },
    new: { label: 'Tạo mới', icon: Sparkles },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.FC<any> }> = {
    open: { label: 'Mới', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20', icon: AlertCircle },
    'in-review': { label: 'Đang duyệt', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', icon: Clock },
    revision: { label: 'Cần chỉnh sửa', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20', icon: PenLine },
    approved: { label: 'Đã duyệt', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', icon: CheckCircle2 },
    completed: { label: 'Hoàn thành', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/20', icon: CheckCircle2 },
    cancelled: { label: 'Đã hủy', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', icon: XCircle },
};

// ============================================================
// HELPERS
// ============================================================
function parseDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Timestamp) return val.toDate();
    if (typeof val === 'string' || typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val?.toDate === 'function') return val.toDate();
    return null;
}

function formatTimeAgo(date: Date | null): string {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
    return `${Math.floor(diffDays / 30)} tháng trước`;
}


// ============================================================
// COMPONENT
// ============================================================
// ── localStorage helpers for last-read tracking ──
const LAST_READ_KEY = (email: string) => `avgflow_ticket_lastread_${email}`;

function getLastReadMap(email: string): Record<string, string> {
    try {
        const raw = localStorage.getItem(LAST_READ_KEY(email));
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function setLastRead(email: string, ticketId: string) {
    const map = getLastReadMap(email);
    map[ticketId] = new Date().toISOString();
    localStorage.setItem(LAST_READ_KEY(email), JSON.stringify(map));
}

const DesignOrdersManager: React.FC = () => {
    const { currentUser } = useAuth();
    const [tickets, setTickets] = useState<DesignTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTicket, setSelectedTicket] = useState<DesignTicket | null>(null);

    // 💬 Unread messages tracking
    // messageCounts: { ticketId: { total: number, lastMessageAt: string } }
    const [messageCounts, setMessageCounts] = useState<Record<string, { total: number; lastMessageAt: string }>>({});

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [sortNewestFirst, setSortNewestFirst] = useState(true);

    // Load tickets — Firestore PRIMARY with realtime
    useEffect(() => {
        setLoading(true);
        setError('');

        const ticketsRef = collection(db, 'design_tickets');
        const q = query(ticketsRef, orderBy('createdAt', 'desc'));
        const unsubTickets = onSnapshot(q, (snapshot) => {
            const mapped = snapshot.docs.map(doc => {
                const t = doc.data();
                return {
                    id: doc.id,
                    ticketCode: t.ticketCode || '',
                    category: (t.category || 'label-bag') as DesignTicket['category'],
                    action: (t.action || 'new') as DesignTicket['action'],
                    brandName: t.brandName || '',
                    contactName: t.contactName || '',
                    contactPhone: t.contactPhone || '',
                    contactEmail: t.contactEmail || '',
                    contactAddress: t.contactAddress || '',
                    description: t.description || '',
                    status: (t.status || 'open') as DesignTicket['status'],
                    revisionRound: t.revisionRound || 0,
                    createdAt: t.createdAt || null,
                    updatedAt: t.updatedAt || null,
                    completedAt: t.completedAt || null,
                    assignedTo: t.assignedTo || '',
                    formData: (t.formData || {}) as Record<string, string>,
                    imageUrls: (t.imageUrls || []) as string[],
                };
            });
            setTickets(mapped);
            setLoading(false);
            setError('');
        }, (err) => {
            console.error('[Firestore] Ticket load error:', err);
            setError('Lỗi tải dữ liệu ticket');
            setLoading(false);
        });

        return () => unsubTickets();
    }, []);

    // ── Fetch message counts per ticket (Firestore) ──
    useEffect(() => {
        // Only subscribe if we have tickets
        if (tickets.length === 0) return;
        
        const unsubscribers = tickets.map(t => {
            const messagesRef = collection(db, 'ticket_chats', t.id, 'messages');
            return onSnapshot(messagesRef, (snapshot) => {
                const total = snapshot.size;
                let lastMessageAt = '';
                snapshot.docs.forEach(d => {
                    const ts = d.data().createdAt;
                    if (ts) {
                        const dateStr = typeof ts === 'string' ? ts : ts.toDate?.()?.toISOString() || '';
                        if (dateStr > lastMessageAt) lastMessageAt = dateStr;
                    }
                });
                setMessageCounts(prev => ({
                    ...prev,
                    [t.id]: { total, lastMessageAt },
                }));
            });
        });

        return () => unsubscribers.forEach(unsub => unsub());
    }, [tickets]);

    // Filtered & sorted tickets
    const filteredTickets = useMemo(() => {
        let result = [...tickets];

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(t => t.status === statusFilter);
        }

        // Category filter
        if (categoryFilter !== 'all') {
            result = result.filter(t => t.category === categoryFilter);
        }

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t =>
                (t.ticketCode || '').toLowerCase().includes(q) ||
                (t.brandName || '').toLowerCase().includes(q) ||
                (t.contactName || '').toLowerCase().includes(q) ||
                (t.contactEmail || '').toLowerCase().includes(q) ||
                (t.description || '').toLowerCase().includes(q)
            );
        }

        // Sort
        result.sort((a, b) => {
            const dA = parseDate(a.createdAt);
            const dB = parseDate(b.createdAt);
            if (!dA && !dB) return 0;
            if (!dA) return 1;
            if (!dB) return -1;
            return sortNewestFirst ? dB.getTime() - dA.getTime() : dA.getTime() - dB.getTime();
        });

        return result;
    }, [tickets, statusFilter, categoryFilter, searchQuery, sortNewestFirst]);

    // Open count for badge
    const openCount = useMemo(() => tickets.filter(t => t.status === 'open' || t.status === 'in-review' || t.status === 'revision').length, [tickets]);

    // Compute unread counts per ticket
    const adminEmail = currentUser?.email || '';
    const lastReadMap = useMemo(() => getLastReadMap(adminEmail), [adminEmail, selectedTicket]);

    const getUnreadCount = useCallback((ticketId: string): number => {
        const mc = messageCounts[ticketId];
        if (!mc || mc.total === 0) return 0;
        const lastRead = lastReadMap[ticketId];
        if (!lastRead) return mc.total; // Never read = all unread
        // Compare last message time with last-read time
        return new Date(mc.lastMessageAt) > new Date(lastRead) ? mc.total : 0;
    }, [messageCounts, lastReadMap]);

    // Handle opening a ticket (marks as read)
    const handleOpenTicket = useCallback((ticket: DesignTicket) => {
        setLastRead(adminEmail, ticket.id);
        setSelectedTicket(ticket);
    }, [adminEmail]);

    // Handle closing popup (refresh lastRead)
    const handleCloseTicket = useCallback(() => {
        if (selectedTicket) {
            setLastRead(adminEmail, selectedTicket.id);
        }
        setSelectedTicket(null);
    }, [adminEmail, selectedTicket]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="text-violet-500 animate-spin" />
                <span className="ml-3 text-sm text-slate-500 font-medium">Đang tải đơn thiết kế...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16">
                <AlertCircle size={48} className="mx-auto mb-3 text-red-400 opacity-60" />
                <p className="text-sm text-red-500 font-medium">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Dashboard */}
            <DesignTicketStats tickets={tickets} />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm theo mã ticket, thương hiệu, khách hàng..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all shadow-sm"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {/* Status filter */}
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="appearance-none pl-9 pr-8 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer shadow-sm"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            {Object.entries(STATUS_CONFIG).map(([key, sc]) => (
                                <option key={key} value={key}>{sc.label}</option>
                            ))}
                        </select>
                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    {/* Category filter */}
                    <div className="relative">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="appearance-none pl-9 pr-8 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer shadow-sm"
                        >
                            <option value="all">Tất cả loại</option>
                            {Object.entries(CATEGORY_CONFIG).map(([key, cc]) => (
                                <option key={key} value={key}>{cc.label}</option>
                            ))}
                        </select>
                        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    {/* Sort */}
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

            {/* Results count */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                <div>
                    Hiển thị {filteredTickets.length} / {tickets.length} đơn thiết kế
                    {openCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold">
                            {openCount} đang chờ xử lý
                        </span>
                    )}
                </div>
                {(statusFilter !== 'all' || categoryFilter !== 'all') && (
                    <button
                        onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setSearchQuery(''); }}
                        className="text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
                    >
                        <XCircle size={12} /> Bỏ lọc
                    </button>
                )}
            </div>

            {/* Tickets List */}
            <div className="space-y-3">
                {filteredTickets.length > 0 ? (
                    filteredTickets.map(ticket => {
                        const catConf = CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG['label-bag'];
                        const actConf = ACTION_CONFIG[ticket.action] || ACTION_CONFIG.edit;
                        const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                        const StatusIcon = statusConf.icon;
                        const CatIcon = catConf.icon;
                        const ActIcon = actConf.icon;
                        const createdDate = parseDate(ticket.createdAt);

                        return (
                            <div
                                key={ticket.id}
                                className="group relative overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-white/10 hover:border-violet-200 dark:hover:border-violet-500/20 transition-all duration-300 shadow-sm hover:shadow-lg cursor-pointer"
                                onClick={() => handleOpenTicket(ticket)}
                            >
                                {/* Main row */}
                                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                    {/* Category icon */}
                                    <div className={clsx("shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md", catConf.gradient)}>
                                        <CatIcon size={18} className="text-white" />
                                    </div>

                                    {/* Main info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-md">
                                                {ticket.ticketCode}
                                            </span>
                                            <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-md border", catConf.lightBg, catConf.border, catConf.text)}>
                                                {catConf.label}
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                <ActIcon size={10} /> {actConf.label}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mt-1 truncate">
                                            {ticket.brandName || 'Chưa có tên'}
                                        </h4>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                            {ticket.contactName && <span className="font-semibold">{ticket.contactName}</span>}
                                            {ticket.contactName && ticket.contactEmail && ' • '}
                                            {ticket.contactEmail && <span>{ticket.contactEmail}</span>}
                                        </p>
                                    </div>

                                    {/* Status + time + unread */}
                                    <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0">
                                        <div className="flex items-center gap-1.5">
                                            {(() => {
                                                const unread = getUnreadCount(ticket.id);
                                                return unread > 0 ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/25 text-red-600 dark:text-red-400 animate-pulse">
                                                        <MessageCircle size={11} />{unread}
                                                    </span>
                                                ) : null;
                                            })()}
                                            <span className={clsx("flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border", statusConf.bg, statusConf.border, statusConf.color)}>
                                                <StatusIcon size={12} /> {statusConf.label}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                            <Clock size={10} /> {formatTimeAgo(createdDate)}
                                        </span>
                                        {ticket.assignedTo && (
                                            <span className="text-[10px] text-indigo-500 dark:text-indigo-400 flex items-center gap-1 font-semibold">
                                                <UserCheck size={10} /> {ticket.assignedTo}
                                            </span>
                                        )}
                                    </div>

                                </div>

                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                        <Package size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">
                            {tickets.length === 0
                                ? 'Chưa có đơn thiết kế nào'
                                : 'Không tìm thấy đơn thiết kế phù hợp'}
                        </p>
                    </div>
                )}
            </div>
            {/* Popup */}
            {selectedTicket && (
                <DesignTicketPopup
                    ticket={selectedTicket}
                    onClose={handleCloseTicket}
                    adminEmail={currentUser?.email || ''}
                    adminName={currentUser?.displayName || currentUser?.email || 'Admin'}
                />
            )}
        </div>
    );
};

export default DesignOrdersManager;

import React, { useMemo } from 'react';
import { BarChart3, Users, Clock, TrendingUp, Sparkles, PenLine, Tag } from 'lucide-react';
import { clsx } from 'clsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';
import { Timestamp } from '@/lib/firestore';

// Safe date parser for both Firebase Timestamp and ISO string
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

interface DesignTicket {
    id: string;
    ticketCode: string;
    category: 'label-bag' | 'carton' | 'social';
    action: 'edit' | 'new';
    brandName: string;
    contactName: string;
    status: string;
    revisionRound: number;
    createdAt: Timestamp | string | null;
    updatedAt: Timestamp | string | null;
}

const COLORS = ['#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#10b981', '#6366f1'];

const DesignTicketStats: React.FC<{ tickets: DesignTicket[] }> = ({ tickets }) => {
    const stats = useMemo(() => {
        const now = new Date();
        const thisMonth = tickets.filter(t => {
            const d = parseDate(t.createdAt);
            if (!d) return false;
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        // Action breakdown
        const newCount = tickets.filter(t => t.action === 'new').length;
        const editCount = tickets.filter(t => t.action === 'edit').length;
        const newThisMonth = thisMonth.filter(t => t.action === 'new').length;
        const editThisMonth = thisMonth.filter(t => t.action === 'edit').length;

        // By customer
        const byCustomer: Record<string, number> = {};
        tickets.forEach(t => {
            const name = t.brandName || t.contactName || 'Ẩn danh';
            byCustomer[name] = (byCustomer[name] || 0) + 1;
        });
        const customerData = Object.entries(byCustomer)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, count]) => ({ name: name.length > 12 ? name.slice(0, 12) + '…' : name, count }));

        // By category
        const catCounts = { 'label-bag': 0, 'carton': 0, 'social': 0 };
        tickets.forEach(t => { if (catCounts[t.category] !== undefined) catCounts[t.category]++; });
        const categoryData = [
            { name: 'Nhãn/Túi', value: catCounts['label-bag'], color: '#8b5cf6' },
            { name: 'Carton', value: catCounts['carton'], color: '#f59e0b' },
            { name: 'Social', value: catCounts['social'], color: '#06b6d4' },
        ].filter(d => d.value > 0);

        // Processing time (completed tickets)
        const completedTickets = tickets.filter(t => (t.status === 'completed' || t.status === 'approved') && t.createdAt && t.updatedAt);
        let avgProcessingHours = 0;
        let totalProcessingHours = 0;
        const processingTimes: { code: string; hours: number }[] = [];
        completedTickets.forEach(t => {
            const startD = parseDate(t.createdAt);
            const endD = parseDate(t.updatedAt);
            if (!startD || !endD) return;
            const hours = Math.max(0, (endD.getTime() - startD.getTime()) / (1000 * 60 * 60));
            totalProcessingHours += hours;
            processingTimes.push({ code: t.ticketCode, hours: Math.round(hours * 10) / 10 });
        });
        if (completedTickets.length > 0) avgProcessingHours = totalProcessingHours / completedTickets.length;

        // Monthly trend
        const monthlyData: Record<string, { new: number; edit: number }> = {};
        tickets.forEach(t => {
            const d = parseDate(t.createdAt);
            if (!d) return;
            const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
            if (!monthlyData[key]) monthlyData[key] = { new: 0, edit: 0 };
            monthlyData[key][t.action]++;
        });
        const monthlyChart = Object.entries(monthlyData)
            .sort((a, b) => {
                const [mA, yA] = a[0].split('/').map(Number);
                const [mB, yB] = b[0].split('/').map(Number);
                return yA * 12 + mA - (yB * 12 + mB);
            })
            .slice(-6)
            .map(([month, data]) => ({ month, 'Tạo mới': data.new, 'Chỉnh sửa': data.edit, total: data.new + data.edit }));

        // Status breakdown
        const statusCounts: Record<string, number> = {};
        tickets.forEach(t => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });

        return {
            total: tickets.length, newCount, editCount, newThisMonth, editThisMonth,
            thisMonthTotal: thisMonth.length,
            customerData, categoryData,
            avgProcessingHours: Math.round(avgProcessingHours * 10) / 10,
            completedCount: completedTickets.length,
            processingTimes: processingTimes.slice(0, 6),
            monthlyChart, statusCounts,
            pendingCount: (statusCounts['open'] || 0) + (statusCounts['in-review'] || 0),
            revisionCount: statusCounts['revision'] || 0,
        };
    }, [tickets]);

    if (tickets.length === 0) return null;

    const formatHours = (h: number) => {
        if (h < 1) return `${Math.round(h * 60)} phút`;
        if (h < 24) return `${Math.round(h * 10) / 10} giờ`;
        return `${Math.round(h / 24 * 10) / 10} ngày`;
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <BarChart3 size={14} className="text-white" />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">Thống kê Đơn hàng Thiết kế</h3>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng đơn', value: stats.total, sub: `Tháng này: ${stats.thisMonthTotal}`, icon: Tag, gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
                    { label: 'Tạo mới', value: stats.newCount, sub: `Tháng: ${stats.newThisMonth}`, icon: Sparkles, gradient: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-500/20' },
                    { label: 'Chỉnh sửa', value: stats.editCount, sub: `Tháng: ${stats.editThisMonth}`, icon: PenLine, gradient: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/20' },
                    { label: 'TB xử lý', value: formatHours(stats.avgProcessingHours), sub: `${stats.completedCount} đơn hoàn tất`, icon: Clock, gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' },
                ].map((card, i) => (
                    <div key={i} className="relative overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 p-4 shadow-lg">
                        <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br opacity-10 rounded-full blur-lg" style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }} />
                        <div className={clsx("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md mb-2", card.gradient, card.shadow)}>
                            <card.icon size={16} className="text-white" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                        <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{card.value}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{card.sub}</p>
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Monthly trend */}
                {stats.monthlyChart.length > 0 && (
                    <div className="relative overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 p-4 shadow-lg">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <TrendingUp size={12} className="text-violet-500" /> Xu hướng theo tháng
                        </p>
                        <div className="h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.monthlyChart} barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 11, fontWeight: 700 }} />
                                    <Bar dataKey="Tạo mới" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Chỉnh sửa" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex items-center justify-center gap-4 mt-2">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />Tạo mới</span>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />Chỉnh sửa</span>
                        </div>
                    </div>
                )}

                {/* By customer */}
                {stats.customerData.length > 0 && (
                    <div className="relative overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 p-4 shadow-lg">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Users size={12} className="text-violet-500" /> Đơn hàng theo khách hàng
                        </p>
                        <div className="h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.customerData} layout="vertical" margin={{ left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={80} />
                                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 11, fontWeight: 700 }} />
                                    <Bar dataKey="count" name="Số đơn" radius={[0, 4, 4, 0]}>
                                        {stats.customerData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {/* Category + Processing time row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Category pie */}
                {stats.categoryData.length > 0 && (
                    <div className="relative overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 p-4 shadow-lg">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <BarChart3 size={12} className="text-violet-500" /> Phân bổ theo loại thiết kế
                        </p>
                        <div className="h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={30} paddingAngle={4} strokeWidth={0}>
                                        {stats.categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 11, fontWeight: 700 }} />
                                    <Legend formatter={(value) => <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{value}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Processing time per ticket */}
                {stats.processingTimes.length > 0 && (
                    <div className="relative overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 p-4 shadow-lg">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Clock size={12} className="text-emerald-500" /> Thời gian xử lý mỗi đơn
                        </p>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                            {stats.processingTimes.map((pt, i) => (
                                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50/50 dark:bg-slate-700/30 border border-slate-200/30 dark:border-white/5">
                                    <span className="text-[10px] font-mono font-bold text-slate-500 w-24 shrink-0">{pt.code}</span>
                                    <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${Math.min(100, (pt.hours / Math.max(...stats.processingTimes.map(p => p.hours), 1)) * 100)}%` }} />
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 w-16 text-right shrink-0">{formatHours(pt.hours)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-200/30 dark:border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold">Trung bình tháng</span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{formatHours(stats.avgProcessingHours)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DesignTicketStats;

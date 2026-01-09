import React, { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Activity, CheckCircle2, AlertOctagon, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import ActiveUsersWidget from '../components/ActiveUsersWidget';

const COLORS = ['#10b981', '#3b82f6', '#ef4444'];

const Dashboard: React.FC = () => {
    const { logs, payrollRecords } = useData();
    const { t } = useLanguage();
    const [showAI, setShowAI] = useState(false);

    // --- DERIVED METRICS ---

    // Payroll Analysis
    const payrollChartData = React.useMemo(() => {
        if (!payrollRecords.length) return [];

        // Request: Use Nov 2025 data (T11/2025)
        const targetMonth = '2025-11';

        // Fallback to latest if Nov 2025 not found, or strictly use it?
        // Let's try to find it.
        const hasTarget = payrollRecords.some(r => r.month === targetMonth);
        const monthToUse = hasTarget ? targetMonth : [...new Set(payrollRecords.map(r => r.month))].sort().pop();

        if (!monthToUse) return [];

        return payrollRecords
            .filter(r => r.month === monthToUse)
            .sort((a, b) => (Number(b.netPay) || 0) - (Number(a.netPay) || 0)) // Sort by Net Pay
            // .slice(0, 10) // REMOVED: Show All Users
            .map(r => ({
                name: r.fullName,
                shortName: (() => {
                    if (r.fullName.includes('Phan Thị Hải')) return 'Phan Hải';
                    if (r.fullName.includes('Lê Thị Nga')) return 'Lê Nga';
                    return r.fullName.split(' ').slice(-2).join(' ');
                })(),
                income: Number(r.netPay) || 0, // Ensure Number type for Recharts
                additional: Number(r.totalAdditional) || 0, // 'Tổng tăng' (Additional Income)
                fullIncome: Number(r.totalActualIncome) || 0
            }));
    }, [payrollRecords]);
    const totalOrders = logs.length;

    // Status Counts
    const completedCount = logs.filter(l => l.status === 'completed').length;
    const processingCount = logs.filter(l => l.status === 'processing').length;
    const reworkCount = logs.filter(l => l.status === 'rework').length;
    const activeCount = processingCount + reworkCount;

    const reworkRate = totalOrders > 0 ? ((reworkCount / totalOrders) * 100).toFixed(1) : '0.0';

    // Chart Data: Status
    const dataStatus = [
        { name: t.common.completed, value: completedCount },
        { name: t.common.processing, value: processingCount },
        { name: t.common.rework, value: reworkCount },
    ];

    // Chart Data: Backlog by Dept (Processing + Rework)
    const deptBacklog = logs
        .filter(l => l.status !== 'completed')
        .reduce((acc, log) => {
            acc[log.dept] = (acc[log.dept] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

    const dataBacklog = Object.keys(deptBacklog).map(dept => ({
        name: dept,
        value: deptBacklog[dept]
    }));

    // If no backlog, show some empty placeholder or correct charts handle 0 fine.
    // Ensure all depts are represented maybe? For now dynamic is fine.


    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">{t.sidebar.dashboard}</h1>
                    <p className="text-slate-400 mt-1">{t.users.subtitle}</p>
                </div>
                <button
                    onClick={() => setShowAI(!showAI)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-95 group border border-indigo-400/20"
                >
                    <Sparkles size={18} className="text-amber-300 group-hover:animate-spin-slow" />
                    <span>{t.common.aiAnalysis}</span>
                </button>
            </div>

            {/* AI Insights Panel */}
            <AnimatePresence>
                {showAI && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass-panel p-6 rounded-2xl border-l-4 border-l-indigo-500 relative overflow-hidden mb-6"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <Sparkles size={120} />
                        </div>
                        <h3 className="text-lg font-semibold text-indigo-300 flex items-center gap-2 mb-3">
                            <Sparkles size={20} /> Gemini {t.dashboard.insights}
                        </h3>
                        {/* Dynamic Insights based on real data could go here, for now keeping static structure but maybe conditional */}
                        <div className="space-y-3 text-slate-300 text-sm">
                            <p>• <strong className="text-amber-400">{t.common.status}:</strong> <strong>{activeCount}</strong> {t.dashboard.activeOrders}.</p>
                            <p>• <strong className="text-emerald-400">Performance:</strong> {t.dashboard.completionRate} <strong>{((completedCount / totalOrders) * 100).toFixed(0)}%</strong>.</p>
                            {reworkCount > 0 && <p>• <strong className="text-red-400">Note:</strong> {reworkCount} {t.dashboard.reworkNotes}.</p>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>



            {/* Key Metrics Layer */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* 1. Team Presence */}
                <ActiveUsersWidget />

                {/* 2. Active Orders */}
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase">{t.common.processing}</p>
                            <h3 className="text-4xl font-bold text-white mt-2">{activeCount}</h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                            <Activity size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                        <span className="text-sm text-blue-300">{t.common.active}</span>
                    </div>
                </div>

                {/* 3. Completed */}
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden hover:border-emerald-500/30 transition-colors">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase">{t.common.completed}</p>
                            <h3 className="text-4xl font-bold text-white mt-2">{completedCount}</h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                            <CheckCircle2 size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-emerald-400 bg-emerald-500/10 w-fit px-2 py-1 rounded-lg">
                        <TrendingUp size={14} className="mr-1" /> {t.dashboard.systemData}
                    </div>
                </div>

                {/* 4. Error Rate */}
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden hover:border-red-500/30 transition-colors">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 text-sm font-medium uppercase">{t.dashboard.reworkRate}</p>
                            <h3 className="text-4xl font-bold text-white mt-2">{reworkRate}%</h3>
                        </div>
                        <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                            <AlertOctagon size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-red-400">
                        <AlertTriangle size={14} className="mr-1" /> {Number(reworkRate) > 5 ? t.dashboard.checkProcess : t.dashboard.normal}
                    </div>
                </div>
            </div>

            {/* Analytics Layer */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bar Chart - Backlog */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-white mb-6">{t.reports.cards.deptDesc}</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dataBacklog.length ? dataBacklog : [{ name: 'Empty', value: 0 }]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#ffffff', opacity: 0.05 }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                        borderColor: 'rgba(255,255,255,0.1)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '12px',
                                        color: '#fff'
                                    }}
                                    itemStyle={{ color: '#818cf8' }}
                                />
                                <Bar
                                    dataKey="value"
                                    fill="url(#colorBar)"
                                    radius={[6, 6, 0, 0]}
                                    barSize={40}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut Chart - Status */}
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center">
                    <h3 className="text-lg font-semibold text-white mb-2 w-full text-left">{t.common.status} {t.dashboard.distribution}</h3>
                    <div className="h-[250px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={dataStatus}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {dataStatus.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                        borderColor: 'rgba(255,255,255,0.1)',
                                        borderRadius: '12px'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span className="text-slate-300 text-sm ml-1">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>

                        {/* Center Text */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center -mt-4">
                            <p className="text-3xl font-bold text-white">{totalOrders}</p>
                            <p className="text-xs text-slate-400">{t.common.newest}</p>
                        </div>
                    </div>

                    {/* Custom Legend/Details below chart if needed extra detail, utilizing space */}
                    <div className="mt-4 w-full grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-slate-800/50 p-2 rounded-lg border border-white/5">
                            <span className="block text-slate-400 text-xs">{t.common.completed}</span>
                            <span className="font-semibold text-emerald-400">{((completedCount / totalOrders * 100) || 0).toFixed(1)}%</span>
                        </div>
                        <div className="bg-slate-800/50 p-2 rounded-lg border border-white/5">
                            <span className="block text-slate-400 text-xs">{t.common.rework}</span>
                            <span className="font-semibold text-red-400">{reworkRate}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payroll Chart Section */}
            <div className="glass-panel p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Biểu đồ Thu nhập Nhân sự (Tháng gần nhất)</h3>
                        <p className="text-sm text-slate-400">Thống kê toàn bộ đội ngũ nhân sự</p>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <TrendingUp size={20} />
                    </div>
                </div>

                <div className="h-[350px] w-full">
                    {payrollChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={payrollChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="shortName"
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                        borderColor: 'rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                    }}
                                    formatter={(value: any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value))}
                                    labelStyle={{ color: '#e2e8f0', fontWeight: 600, marginBottom: '0.5rem' }}
                                />
                                <Bar
                                    dataKey="income"
                                    name="Thu nhập thực nhận"
                                    fill="#10b981"
                                    radius={[4, 4, 0, 0]}
                                    barSize={20}
                                    isAnimationActive={false}
                                />
                                <Bar
                                    dataKey="additional"
                                    name="Thu nhập tăng thêm"
                                    fill="#f97316" // Orange
                                    radius={[4, 4, 0, 0]}
                                    barSize={20}
                                    isAnimationActive={false}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <AlertOctagon size={48} className="mb-4 opacity-50" />
                            <p>Chưa có dữ liệu bảng lương</p>
                            <span className="text-xs mt-2 text-slate-600">Vui lòng tải dữ liệu tại trang Thu nhập</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

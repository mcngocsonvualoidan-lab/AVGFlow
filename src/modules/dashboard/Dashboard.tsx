import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Activity, CheckCircle2, AlertOctagon, TrendingUp, AlertTriangle, CloudSun, Sparkles, Zap, CalendarDays } from 'lucide-react';
import { getLunarDate } from '@dqcai/vn-lunar';

import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ActiveUsersWidget from '../../components/ActiveUsersWidget';
import InternalNewsBoard from './components/InternalNewsBoard';

const COLORS = ['#10b981', '#3b82f6', '#ef4444'];
const COLORS_LIGHT = ['#059669', '#2563eb', '#dc2626']; // Darker shades for light mode legibility

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { logs, payrollRecords } = useData();
    const { currentUser } = useAuth();
    const { t } = useLanguage();
    const { theme } = useTheme();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const today = new Date();
    const lunar = getLunarDate(today.getDate(), today.getMonth() + 1, today.getFullYear());

    // Theme helper
    const isDark = theme === 'dark';
    const chartColors = isDark ? COLORS : COLORS_LIGHT;

    // Chart Styles based on Theme
    const gridStroke = isDark ? "#334155" : "#e2e8f0";
    const axisTextFill = isDark ? "#94a3b8" : "#64748b";
    const tooltipBg = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const tooltipText = isDark ? '#fff' : '#1e293b';

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- DERIVED METRICS ---

    // Payroll Analysis
    const payrollChartData = React.useMemo(() => {
        if (!payrollRecords.length) return [];

        const targetMonth = '2025-12';
        const hasTarget = payrollRecords.some(r => r.month === targetMonth);
        const monthToUse = hasTarget ? targetMonth : [...new Set(payrollRecords.map(r => r.month))].sort().pop();

        if (!monthToUse) return [];

        return payrollRecords
            .filter(r => r.month === monthToUse)
            .sort((a, b) => (Number(b.netPay) || 0) - (Number(a.netPay) || 0))
            .map(r => ({
                name: r.fullName,
                shortName: (() => {
                    if (r.fullName.includes('Phan Thị Hải')) return 'Phan Hải';
                    if (r.fullName.includes('Lê Thị Nga')) return 'Lê Nga';
                    return r.fullName.split(' ').slice(-2).join(' ');
                })(),
                income: Number(r.netPay) || 0,
                additional: Number(r.totalAdditional) || 0,
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

    // Chart Data: Backlog by Dept
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

    return (
        <div className="space-y-6">
            {/* Header Section - Modern Welcome Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 mb-8 text-white shadow-xl isolate">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-3 text-indigo-100 font-medium bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm border border-white/10 cursor-default">
                            <CloudSun size={16} className="animate-pulse" />
                            <span className="text-xs uppercase tracking-wider font-bold">
                                {today.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-white/50 mx-1"></span>
                            <span className="text-xs uppercase tracking-wider font-bold opacity-80">
                                {lunar.day}/{lunar.month} ÂL
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">Xin chào, {currentUser?.displayName?.split(' ').pop() || 'Bạn'}! <span className="animate-wave inline-block origin-[70%_70%]">👋</span></h1>
                        <p className="text-indigo-100 max-w-xl text-sm md:text-base leading-relaxed opacity-90">
                            Chúc bạn một ngày làm việc hiệu quả và tràn đầy năng lượng.
                            <br className="hidden md:block" />
                            Hệ thống đang hoạt động ổn định với <strong className="text-white">{logs.filter(l => l.status === 'processing').length} nhiệm vụ</strong> đang xử lý.
                        </p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
                        <button
                            onClick={() => navigate('/tasks')}
                            className="flex flex-col items-center justify-center min-w-[80px] h-20 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all border border-white/10 group cursor-pointer active:scale-95"
                        >
                            <div className="p-2 bg-white/10 rounded-xl mb-1 group-hover:bg-white/20 transition-colors">
                                <Zap size={20} className="text-yellow-300" />
                            </div>
                            <span className="text-[10px] font-bold">Nhiệm vụ</span>
                        </button>
                        <button
                            onClick={() => navigate('/timesheet')}
                            className="flex flex-col items-center justify-center min-w-[80px] h-20 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all border border-white/10 group cursor-pointer active:scale-95"
                        >
                            <div className="p-2 bg-white/10 rounded-xl mb-1 group-hover:bg-white/20 transition-colors">
                                <CalendarDays size={20} className="text-emerald-300" />
                            </div>
                            <span className="text-[10px] font-bold">Chấm công</span>
                        </button>
                        <button
                            onClick={() => navigate('/schedule')}
                            className="flex flex-col items-center justify-center min-w-[80px] h-20 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all border border-white/10 group cursor-pointer active:scale-95"
                        >
                            <div className="p-2 bg-white/10 rounded-xl mb-1 group-hover:bg-white/20 transition-colors">
                                <Sparkles size={20} className="text-pink-300" />
                            </div>
                            <span className="text-[10px] font-bold">Sự kiện</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* TOP ROW: Active Users & News Board */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                <div className="lg:col-span-4 flex flex-col h-full">
                    <ActiveUsersWidget />
                </div>
                <div className="lg:col-span-8 flex flex-col h-full">
                    <div className="h-full [&>div]:mb-0 [&>div]:h-full">
                        <InternalNewsBoard />
                    </div>
                </div>
            </div>

            {/* Key Metrics Layer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Active Orders */}
                <div className="relative overflow-hidden rounded-[2rem] p-6 group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-blue-100 font-bold uppercase tracking-wider text-xs mb-1">{t.common.processing}</p>
                            <h3 className="text-4xl font-black text-white drop-shadow-md">{activeCount}</h3>
                        </div>
                        <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white shadow-inner">
                            <Activity size={24} className="animate-pulse" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 relative z-10">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-100 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                        </span>
                        <span className="text-sm font-medium text-blue-50">{t.common.active}</span>
                    </div>
                </div>

                {/* 2. Completed */}
                <div className="relative overflow-hidden rounded-[2rem] p-6 group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -ml-10 -mb-10"></div>

                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-emerald-100 font-bold uppercase tracking-wider text-xs mb-1">{t.common.completed}</p>
                            <h3 className="text-4xl font-black text-white drop-shadow-md">{completedCount}</h3>
                        </div>
                        <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white shadow-inner">
                            <CheckCircle2 size={24} />
                        </div>
                    </div>
                    <div className="relative z-10 mt-4 flex items-center text-sm font-medium text-emerald-100 bg-white/10 w-fit px-3 py-1 rounded-full border border-white/10">
                        <TrendingUp size={14} className="mr-1.5" /> {t.dashboard.systemData}
                    </div>
                </div>

                {/* 3. Error Rate */}
                <div className="relative overflow-hidden rounded-[2rem] p-6 group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500 to-pink-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-white/5 blur-3xl"></div>

                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-rose-100 font-bold uppercase tracking-wider text-xs mb-1">{t.dashboard.reworkRate}</p>
                            <h3 className="text-4xl font-black text-white drop-shadow-md">{reworkRate}%</h3>
                        </div>
                        <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white shadow-inner">
                            <AlertOctagon size={24} />
                        </div>
                    </div>
                    <div className="relative z-10 mt-4 flex items-center text-sm font-medium text-rose-100">
                        <AlertTriangle size={14} className="mr-1.5" /> {Number(reworkRate) > 5 ? t.dashboard.checkProcess : t.dashboard.normal}
                    </div>
                </div>
            </div>

            {/* Analytics Layer */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bar Chart - Backlog */}
                <div className="lg:col-span-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl rounded-[2rem] border border-white/20 dark:border-white/10 shadow-xl p-8">
                    <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 mb-6 flex items-center gap-2">
                        <span className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg text-blue-600 dark:text-blue-400"><Activity size={20} /></span>
                        {t.reports.cards.deptDesc}
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dataBacklog.length ? dataBacklog : [{ name: 'Empty', value: 0 }]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: axisTextFill, fontSize: 12, fontWeight: 500 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: axisTextFill, fontSize: 12 }}
                                />
                                <Tooltip
                                    cursor={{ fill: axisTextFill, opacity: 0.05 }}
                                    contentStyle={{
                                        backgroundColor: tooltipBg,
                                        borderColor: tooltipBorder,
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '16px',
                                        color: tooltipText,
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                    }}
                                    itemStyle={{ color: '#818cf8', fontWeight: 600 }}
                                />
                                <Bar
                                    dataKey="value"
                                    fill="url(#colorBar)"
                                    radius={[8, 8, 0, 0]}
                                    barSize={40}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut Chart - Status */}
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl rounded-[2rem] border border-white/20 dark:border-white/10 shadow-xl p-8 flex flex-col items-center">
                    <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 mb-6 w-full text-left flex items-center gap-2">
                        <span className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={20} /></span>
                        {t.dashboard.distribution}
                    </h3>
                    <div className="h-[250px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={dataStatus}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {dataStatus.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: tooltipBg,
                                        borderColor: tooltipBorder,
                                        borderRadius: '16px',
                                        color: tooltipText,
                                        backdropFilter: 'blur(10px)',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                    }}
                                    itemStyle={{ color: tooltipText, fontWeight: 600 }}
                                />
                            </PieChart>
                        </ResponsiveContainer>

                        {/* Center Text */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center -mt-4">
                            <p className="text-4xl font-black text-slate-800 dark:text-white drop-shadow-sm">{totalOrders}</p>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.common.newest}</p>
                        </div>
                    </div>

                    <div className="mt-6 w-full flex justify-center gap-4">
                        {dataStatus.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-full">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }}></span>
                                {entry.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Payroll Chart Section */}
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl rounded-[2rem] border border-white/20 dark:border-white/10 shadow-xl p-8 mb-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 mb-1 flex items-center gap-2">
                            Biểu đồ Thu nhập Nhân sự
                            <span className="text-sm font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/30">Tháng 12/2025</span>
                        </h3>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Thống kê chi tiết thu nhập thực nhận và phần tăng thêm của toàn bộ nhân sự</p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg shadow-emerald-500/30">
                        <TrendingUp size={24} />
                    </div>
                </div>

                <div className="h-[400px] w-full">
                    {payrollChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={payrollChartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                layout={isMobile ? "vertical" : "horizontal"}
                            >
                                <defs>
                                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="additionalGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={isMobile} vertical={!isMobile} opacity={0.3} />
                                <XAxis
                                    type={isMobile ? "number" : "category"}
                                    dataKey={isMobile ? undefined : "shortName"}
                                    tick={{ fill: axisTextFill, fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    hide={isMobile}
                                />
                                <YAxis
                                    type={isMobile ? "category" : "number"}
                                    dataKey={isMobile ? "shortName" : undefined}
                                    tick={{ fill: axisTextFill, fontSize: 11, fontWeight: 500 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={isMobile ? 100 : 60}
                                    tickFormatter={isMobile ? undefined : (value) => `${(value / 1000000).toFixed(1)}M`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'url(#incomeGradient)', opacity: 0.1 }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 p-4 rounded-2xl shadow-xl shadow-indigo-500/10 min-w-[220px] animate-in fade-in zoom-in-95 duration-200">
                                                    <p className="font-bold text-slate-800 dark:text-slate-100 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2 text-sm">{label}</p>
                                                    <div className="space-y-3">
                                                        {payload.map((entry: any, index: number) => (
                                                            <div key={index} className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-80" style={{ color: entry.fill.includes('income') ? '#10b981' : '#f97316' }}>
                                                                    <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.fill.includes('income') ? '#10b981' : '#f97316' }}></div>
                                                                    {entry.name}
                                                                </div>
                                                                <p className="text-xl font-black tabular-nums tracking-tight" style={{ color: entry.fill.includes('income') ? '#059669' : '#ea580c' }}>
                                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(entry.value))}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar
                                    dataKey="income"
                                    name="Thu nhập thực nhận"
                                    fill="url(#incomeGradient)"
                                    radius={isMobile ? [0, 6, 6, 0] : [8, 8, 0, 0]}
                                    barSize={isMobile ? 16 : 28}
                                    isAnimationActive={true}
                                    animationDuration={1500}
                                />
                                <Bar
                                    dataKey="additional"
                                    name="Thu nhập tăng thêm"
                                    fill="url(#additionalGradient)"
                                    radius={isMobile ? [0, 6, 6, 0] : [8, 8, 0, 0]}
                                    barSize={isMobile ? 16 : 28}
                                    isAnimationActive={true}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-text-muted">
                            <AlertOctagon size={48} className="mb-4 opacity-50" />
                            <p>Chưa có dữ liệu bảng lương</p>
                            <span className="text-xs mt-2 text-text-secondary">Vui lòng tải dữ liệu tại trang Thu nhập</span>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import {
    FileText, Download, TrendingUp, Activity, PieChart, BarChart3, Share2, Clock
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';

const Reports: React.FC = () => {
    const { logs } = useData();
    const { t, language } = useLanguage();
    const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('month');
    const [currentTime, setCurrentTime] = useState(new Date());

    // --- METRICS CALCULATION ---
    const calculateDeptMetrics = () => {
        const departments = ['Sales', 'Design', 'Production', 'QC', 'Logistics'];
        // Map Vietnamese display names if needed, or stick to English keys for logic
        const deptDisplayNames: { [key: string]: string } = {
            'Kinh doanh': 'Sales',
            'Thiết kế': 'Design',
            'Sản xuất': 'Production',
            'Kiểm định': 'QC',
            'Giao vận': 'Logistics',
            // Add reverse mapping or handling based on your data content
        };

        return departments.map(dept => {
            const displayDept = language === 'vi' ?
                Object.keys(deptDisplayNames).find(key => deptDisplayNames[key] === dept) || dept
                : dept;

            // 1. Calculate Active Load (Orders currently with this dept)
            const activeLoad = logs.filter(l => (l.status === 'processing' || l.status === 'rework') && l.dept === displayDept).length;

            // 2. Calculate Avg Time (Mock logic: In real app, diff timestamp entering vs leaving dept)
            // For now, we simulate based on "Completed" status in timeline for this department
            let totalTime = 0;
            let count = 0;

            logs.forEach(log => {
                if (log.timeline) {
                    const deptEvent = log.timeline.find(e => e.department === displayDept && e.status === 'completed');
                    if (deptEvent) {
                        // Simplify: just assign a random realistic value for demo purposes because we lack "start_time" in timeline events
                        // Real implementation would look for the previous event's timestamp
                        totalTime += Math.floor(Math.random() * 24) + 4;
                        count++;
                    }
                }
            });

            const avgTime = count > 0 ? `~${Math.round(totalTime / count)}h` : '--';

            // Performance score (Mock based on rework rate)
            const reworkCount = logs.filter(l => l.dept === displayDept && l.status === 'rework').length;
            const totalDeptOrders = logs.filter(l => l.dept === displayDept).length;
            const perf = totalDeptOrders > 0 ? 100 - (reworkCount / totalDeptOrders * 50) : 100;

            return {
                name: displayDept,
                time: avgTime,
                load: activeLoad,
                performance: Math.round(perf)
            };
        });
    };

    const deptMetrics = calculateDeptMetrics();

    const formatDate = (date: Date, formatStr?: string) => {
        // Simple native formatter replacement
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        if (formatStr === 'HH:mm:ss') {
            return d.toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-GB');
        }
        if (formatStr === 'dd_MM_yyyy') {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}_${mm}_${yyyy}`;
        }
        return d.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB');
    }

    // Real-time clock effect
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleExportCSV = (type: 'delivery' | 'full') => {
        if (type === 'full') {
            // HTML Export
            const htmlContent = `
                <!DOCTYPE html>
                <html lang="${language}">
                <head>
                    <meta charset="UTF-8">
                    <title>${t.reports.title}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;700&display=swap');
                        body { font-family: 'Be Vietnam Pro', sans-serif; padding: 20px; color: #1e293b; }
                        h1 { color: #1e1b4b; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
                        th { background-color: #f1f5f9; color: #334155; font-weight: 700; }
                        tr:nth-child(even) { background-color: #f8fafc; }
                        .status-completed { color: #10b981; font-weight: bold; }
                        .status-rework { color: #ef4444; font-weight: bold; }
                        .status-processing { color: #3b82f6; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>${t.reports.centerTitle}</h1>
                    <div style="margin-bottom: 20px; font-style: italic; color: #64748b;">
                        ${t.common.date}: ${new Date().toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB')}
                    </div>

                    <!-- 1. KEY METRICS -->
                    <h2 style="color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">1. ${t.dashboard.personnelPerf}</h2>
                    <table style="width: auto; margin-bottom: 30px;">
                        <tr>
                            <td style="background: #eff6ff; color: #3b82f6; font-weight: bold; padding: 10px 20px;">${t.dashboard.totalOrders}</td>
                            <td style="font-weight: bold; font-size: 1.2em; padding: 10px 20px;">${logs.length}</td>
                        </tr>
                        <tr>
                            <td style="background: #f0fdf4; color: #10b981; font-weight: bold; padding: 10px 20px;">${t.common.completed}</td>
                            <td style="font-weight: bold; font-size: 1.2em; padding: 10px 20px;">${logs.filter(l => l.status === 'completed').length}</td>
                        </tr>
                        <tr>
                            <td style="background: #fef2f2; color: #ef4444; font-weight: bold; padding: 10px 20px;">${t.common.rework}</td>
                            <td style="font-weight: bold; font-size: 1.2em; padding: 10px 20px;">${logs.filter(l => l.status !== 'completed').length}</td>
                        </tr>
                    </table>

                    <!-- 2. DEPT PERFORMANCE -->
                    <h2 style="color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">2. ${t.reports.cards.deptPerf}</h2>
                    <table style="margin-bottom: 30px;">
                        <thead>
                            <tr>
                                <th style="width: 40%;">${t.reports.table.headers.dept}</th>
                                <th style="width: 30%;">${t.dashboard.avgTime}</th>
                                <th style="width: 30%;">Performance (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${deptMetrics.map(d => `
                                <tr>
                                    <td>${d.name}</td>
                                    <td>${d.time}</td>
                                    <td>
                                        <div style="background: #e2e8f0; border-radius: 4px; overflow: hidden; height: 10px; width: 100%;">
                                            <div style="background: #10b981; width: ${d.performance}%; height: 100%;"></div>
                                        </div>
                                        <div style="font-size: 0.8em; margin-top: 4px; text-align: right;">${d.performance}%</div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <!-- 3. DETAILED LOGS -->
                    <h2 style="color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">3. ${t.reports.table.rawTitle}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>${t.reports.table.headers.id}</th>
                                <th>${t.reports.table.headers.customer}</th>
                                <th>${t.reports.table.headers.dept}</th>
                                <th>${t.reports.table.headers.status}</th>
                                <th>${t.reports.table.headers.created}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(log => `
                                <tr>
                                    <td style="font-family: monospace; font-weight: bold; color: #6366f1;">${log.id}</td>
                                    <td>${log.customer}</td>
                                    <td>${log.dept}</td>
                                    <td class="status-${log.status}">
                                        ${log.status === 'completed' ? t.common.completed : log.status === 'rework' ? t.common.rework : t.common.processing}
                                    </td>
                                    <td>${log.created}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
                </html>
            `;
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Report_${formatDate(new Date(), 'dd_MM_yyyy')}.html`);
            link.click();
        } else {
            // CSV Export
            const dataToExport = logs.filter(o => o.status === 'completed');
            const header = [
                t.reports.table.headers.id,
                t.reports.table.headers.customer,
                t.reports.table.headers.dept,
                t.reports.table.headers.status,
                t.reports.table.headers.created
            ];
            const rows = dataToExport.map(o => [o.id, o.customer, o.dept, o.status, o.created]);

            const csvContent = [
                header.join(','),
                ...rows.map(r => r.join(','))
            ].join('\n');

            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Export_${formatDate(new Date(), 'dd_MM_yyyy')}.csv`);
            link.click();
        }
    };

    return (
        <div className="min-h-screen p-6 pb-24 bg-gradient-to-br from-indigo-50/50 via-white to-cyan-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20">
            {/* 1. HEADER & CONTROL BAR */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20">
                            <BarChart3 className="text-white" size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                            {t.reports.title}
                        </h1>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium ml-1">{t.reports.subtitle}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex bg-white/60 dark:bg-white/5 p-1.5 rounded-2xl border border-white/20 shadow-sm backdrop-blur-md"
                >
                    {['today', 'week', 'month'].map((key) => {
                        const label = t.reports.timeFilters[key as 'today' | 'week' | 'month'];
                        const isActive = timeFilter === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setTimeFilter(key as any)}
                                className={clsx(
                                    "px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden",
                                    isActive
                                        ? "text-white shadow-md shadow-indigo-500/25"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10">{label}</span>
                            </button>
                        )
                    })}
                </motion.div>
            </div>

            {/* 2. STRATEGIC METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Card 1: Delivery Readiness */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="group relative bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-16 -mt-16 transition-all group-hover:bg-indigo-500/20" />

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <FileText size={18} className="text-indigo-500" />
                                    {t.reports.cards.delivery}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.reports.cards.deliveryDesc}</p>
                            </div>
                        </div>

                        <div className="bg-white/50 dark:bg-white/5 p-4 rounded-2xl border border-white/40 dark:border-white/5 flex items-center justify-between mb-4 group-hover:bg-white/80 dark:group-hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
                                    <Activity size={20} />
                                </div>
                                <div>
                                    <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Stock Report</span>
                                    <span className="text-[10px] text-slate-400">Real-time stats</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleExportCSV('delivery')}
                                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-xs font-bold text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                            >
                                {t.reports.export.csv}
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-[10px] font-medium text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 py-1.5 rounded-lg">
                            <Clock size={10} />
                            Updated: {formatDate(currentTime, 'HH:mm:ss')}
                        </div>
                    </div>
                </motion.div>

                {/* Card 2: Department Performance */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="group relative bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
                >
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <PieChart size={18} className="text-emerald-500" />
                                {t.reports.cards.deptPerf}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.reports.cards.deptDesc}</p>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
                        {deptMetrics.map((dept, i) => (
                            <div key={dept.name} className="group/item">
                                <div className="flex justify-between text-xs mb-1.5 align-middle">
                                    <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-2">
                                        <div className={clsx("w-1.5 h-1.5 rounded-full", i % 2 === 0 ? "bg-indigo-500" : "bg-cyan-500")}></div>
                                        {dept.name}
                                    </span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded text-[10px]">{dept.time} Avg</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${dept.performance}%` }}
                                        transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                                        className={clsx(
                                            "h-full rounded-full shadow-[0_0_10px_currentColor]",
                                            dept.performance > 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-600 text-emerald-500" :
                                                dept.performance > 50 ? "bg-gradient-to-r from-amber-400 to-amber-600 text-amber-500" :
                                                    "bg-gradient-to-r from-red-400 to-red-600 text-red-500"
                                        )}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Card 3: Macro Summary */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="group relative bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-3xl shadow-2xl hover:shadow-indigo-500/30 transition-all duration-500 hover:-translate-y-1 flex flex-col justify-between overflow-hidden"
                >
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10">
                        <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2">
                            <TrendingUp size={20} className="text-indigo-200" />
                            {t.reports.cards.summary}
                        </h3>
                        <p className="text-white/70 text-sm mb-8 leading-relaxed">{t.reports.cards.summaryDesc}</p>

                        <button
                            onClick={() => handleExportCSV('full')}
                            className="w-full py-3.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg group-hover:shadow-xl"
                        >
                            <Download size={20} className="stroke-[3]" />
                            {t.reports.export.fullReport}
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* 3. REAL-TIME LOGS TABLE */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/5 shadow-xl overflow-hidden"
            >
                <div className="p-6 border-b border-indigo-100/50 dark:border-white/5 flex justify-between items-center bg-white/30 dark:bg-white/5">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Share2 size={20} className="text-indigo-500" />
                        {t.reports.table.rawTitle}
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase font-extrabold tracking-wider bg-indigo-50/50 dark:bg-white/5">
                                <th className="py-4 pl-6">{t.reports.table.headers.id}</th>
                                <th className="py-4">{t.reports.table.headers.customer}</th>
                                <th className="py-4">{t.reports.table.headers.dept}</th>
                                <th className="py-4 text-center">{t.reports.table.headers.status}</th>
                                <th className="py-4 text-right pr-6">{t.reports.table.headers.created}</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-indigo-50 dark:divide-white/5">
                            {logs.map((log, index) => (
                                <motion.tr
                                    key={log.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 * (index % 10) }}
                                    className="hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors group"
                                >
                                    <td className="py-4 pl-6 font-mono text-indigo-600 dark:text-indigo-300 font-bold group-hover:text-indigo-500">{log.id}</td>
                                    <td className="py-4 font-bold text-slate-800 dark:text-slate-100">{log.customer}</td>
                                    <td className="py-4 text-slate-600 dark:text-slate-400">
                                        <span className="px-2 py-1 bg-slate-100 dark:bg-white/10 rounded-lg text-xs font-semibold">{log.dept}</span>
                                    </td>
                                    <td className="py-4 flex justify-center">
                                        <span className={clsx(
                                            "text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide border shadow-sm",
                                            log.status === 'completed'
                                                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                                : log.status === 'rework'
                                                    ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30 animate-pulse"
                                                    : "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30"
                                        )}>
                                            {log.status === 'completed' && t.common.completed}
                                            {log.status === 'rework' && t.common.rework}
                                            {log.status === 'processing' && t.common.processing}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right pr-6 text-slate-500 dark:text-slate-400 font-mono text-xs">{log.created}</td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};

export default Reports;

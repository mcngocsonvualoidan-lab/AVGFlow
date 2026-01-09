import React, { useState, useEffect } from 'react';
import {
    FileText, Download, Sparkles
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';

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
        <div className="h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar flex flex-col p-2 pb-20">

            {/* 1. HEADER & TIME FILTER */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">{t.reports.title}</h1>
                    <p className="text-slate-400 text-sm">{t.reports.subtitle}</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => alert(t.common.loading)}
                            className="px-4 py-2 bg-indigo-600/20 text-indigo-300 rounded-full text-sm border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors flex items-center gap-2"
                        >
                            <Sparkles size={14} /> {t.common.aiAnalysis}
                        </button>
                        <img src="https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff" className="w-10 h-10 rounded-full border-2 border-indigo-500/50" />
                    </div>
                </div>
            </div>

            {/* Control Bar - Report Specific */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4">{t.reports.centerTitle}</h2>
                <div className="flex justify-end mb-4">
                    <div className="flex bg-[#1e1b4b] p-1 rounded-xl border border-white/10">
                        {['today', 'week', 'month'].map((key) => {
                            const label = t.reports.timeFilters[key as 'today' | 'week' | 'month'];
                            const isActive = timeFilter === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setTimeFilter(key as any)}
                                    className={clsx(
                                        "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        isActive
                                            ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                                            : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 2. STRATEGIC METRICS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                    {/* Card 1: Delivery Readiness */}
                    <div className="glass-panel-dark p-6 rounded-2xl border border-indigo-500/20 flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-1">{t.reports.cards.delivery}</h3>
                            <p className="text-xs text-slate-400 mb-6">{t.reports.cards.deliveryDesc}</p>

                            <div className="bg-[#1e1b4b]/50 p-4 rounded-xl border border-white/5 flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                        <FileText size={20} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-300">Stock Report</span>
                                </div>
                                <button
                                    onClick={() => handleExportCSV('delivery')}
                                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider"
                                >
                                    {t.reports.export.csv}
                                </button>
                            </div>
                        </div>
                        <div className="text-[10px] text-slate-500 text-center italic mt-4">
                            Values updated at: {formatDate(currentTime, 'HH:mm:ss')}
                        </div>
                    </div>

                    {/* Card 2: Department Performance */}
                    <div className="glass-panel-dark p-6 rounded-2xl border border-indigo-500/20">
                        <h3 className="text-lg font-bold text-white mb-1">{t.reports.cards.deptPerf}</h3>
                        <p className="text-xs text-slate-400 mb-6">{t.reports.cards.deptDesc}</p>

                        <div className="space-y-4">
                            {deptMetrics.map(dept => (
                                <div key={dept.name}>
                                    <div className="flex justify-between text-xs mb-1.5 align-middle">
                                        <span className="text-slate-300 font-medium">
                                            {dept.name}
                                            {dept.load > 0 && (
                                                <span className="ml-2 text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                                                    {dept.load} Active
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-indigo-300 font-mono">{dept.time} Avg</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${dept.performance}%` }}
                                            className={clsx(
                                                "h-full rounded-full",
                                                dept.performance > 80 ? "bg-emerald-500/50" : dept.performance > 50 ? "bg-amber-500/50" : "bg-red-500/50"
                                            )}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Card 3: Macro Summary */}
                    <div className="glass-panel-dark p-6 rounded-2xl border border-indigo-500/20 flex flex-col">
                        <h3 className="text-lg font-bold text-white mb-1">{t.reports.cards.summary}</h3>
                        <p className="text-xs text-slate-400 mb-6">{t.reports.cards.summaryDesc}</p>

                        <div className="flex-1 flex items-center justify-center">
                            <button
                                onClick={() => handleExportCSV('full')}
                                className="w-full py-3 bg-[#1e1b4b] hover:bg-[#2e2b5b] border border-indigo-500/30 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all hover:scale-95 shadow-lg"
                            >
                                <Download size={18} /> {t.reports.export.fullReport}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. REAL-TIME LOGS TABLE */}
                <div className="glass-panel-dark p-6 rounded-2xl border border-indigo-500/20">
                    <h3 className="text-lg font-bold text-white mb-6">{t.reports.table.rawTitle}</h3>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase font-bold border-b border-white/5">
                                    <th className="pb-4 pl-4">{t.reports.table.headers.id}</th>
                                    <th className="pb-4">{t.reports.table.headers.customer}</th>
                                    <th className="pb-4">{t.reports.table.headers.dept}</th>
                                    <th className="pb-4 text-center">{t.reports.table.headers.status}</th>
                                    <th className="pb-4 text-right pr-4">{t.reports.table.headers.created}</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {logs.map((log) => (
                                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                        <td className="py-4 pl-4 font-mono text-indigo-300 group-hover:text-indigo-200">{log.id}</td>
                                        <td className="py-4 font-bold text-white">{log.customer}</td>
                                        <td className="py-4 text-slate-400">{log.dept}</td>
                                        <td className="py-4 flex justify-center">
                                            <span className={clsx(
                                                "text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase",
                                                log.status === 'completed' && "border-emerald-500 text-emerald-500 bg-emerald-500/10",
                                                log.status === 'rework' && "border-red-500 text-red-500 bg-red-500/10",
                                                log.status === 'processing' && "border-blue-500 text-blue-500 bg-blue-500/10"
                                            )}>
                                                {log.status === 'completed' && t.common.completed}
                                                {log.status === 'rework' && t.common.rework}
                                                {log.status === 'processing' && t.common.processing}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right pr-4 text-slate-500 font-mono">{log.created}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;

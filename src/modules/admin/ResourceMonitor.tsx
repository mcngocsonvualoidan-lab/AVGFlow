/**
 * 🔋 Resource Monitor Dashboard — Admin Only
 * 
 * Hiển thị gauge bars + trend chart cho Firestore usage.
 * Dữ liệu 100% từ localStorage — 0 Firestore reads.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, AlertTriangle, Shield, RefreshCcw, RotateCcw, Zap } from 'lucide-react';
import {
    getCurrentUsage, getUsageHistory, getUsagePercent, getAlertLevel,
    QUOTAS, THRESHOLDS, resetTodayUsage, type DailyUsage
} from '../../utils/firestoreTracker';

const METRIC_CONFIG = {
    reads: { label: 'Reads', color: '#6366f1', quota: QUOTAS.reads, icon: '📖' },
    writes: { label: 'Writes', color: '#10b981', quota: QUOTAS.writes, icon: '✏️' },
    deletes: { label: 'Deletes', color: '#f59e0b', quota: QUOTAS.deletes, icon: '🗑️' },
} as const;

const LEVEL_COLORS = {
    safe: { bg: 'from-emerald-500/20 to-emerald-600/5', bar: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    warning: { bg: 'from-amber-500/20 to-amber-600/5', bar: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30' },
    danger: { bg: 'from-red-500/20 to-red-600/5', bar: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30' },
    critical: { bg: 'from-red-600/30 to-red-700/10', bar: 'bg-red-600 animate-pulse', text: 'text-red-300', border: 'border-red-500/50' },
};

// --- Gauge Component ---
const GaugeBar = ({ metric, value, quota }: { metric: string, value: number, quota: number }) => {
    const percent = Math.min((value / quota) * 100, 100);
    const level = getAlertLevel(percent);
    const colors = LEVEL_COLORS[level];
    const config = METRIC_CONFIG[metric as keyof typeof METRIC_CONFIG];

    return (
        <div className={`p-4 rounded-xl bg-gradient-to-br ${colors.bg} border ${colors.border} transition-all`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <span className="text-sm font-bold text-slate-200">{config.label}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold ${colors.text}`}>
                        {value.toLocaleString()} / {(quota / 1000).toFixed(0)}K
                    </span>
                    {level !== 'safe' && (
                        <AlertTriangle size={14} className={colors.text} />
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-slate-800/60 rounded-full overflow-hidden shadow-inner">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${colors.bar} shadow-lg`}
                />
            </div>

            {/* Threshold markers */}
            <div className="relative h-2 mt-1">
                <div className="absolute left-[70%] w-px h-2 bg-amber-500/50" title="70%"></div>
                <div className="absolute left-[85%] w-px h-2 bg-red-500/50" title="85%"></div>
                <div className="absolute left-[95%] w-px h-2 bg-red-600/50" title="95%"></div>
            </div>

            <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-500">0%</span>
                <span className={`text-xs font-bold ${colors.text}`}>{percent.toFixed(1)}%</span>
                <span className="text-[10px] text-slate-500">100%</span>
            </div>
        </div>
    );
};

// --- Mini Sparkline Chart (SVG) ---
const SparklineChart = ({ history, metric }: { history: DailyUsage[], metric: 'reads' | 'writes' | 'deletes' }) => {
    const config = METRIC_CONFIG[metric];
    const data = history.slice(-7); // Last 7 days

    if (data.length < 2) return (
        <div className="h-16 flex items-center justify-center text-slate-600 text-xs">Chưa đủ dữ liệu</div>
    );

    const values = data.map(d => d[metric]);
    const max = Math.max(...values, 1);
    const width = 200;
    const height = 50;

    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - (v / max) * (height - 5);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative">
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="opacity-80">
                <defs>
                    <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={config.color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={config.color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                {/* Area fill */}
                <polygon
                    points={`0,${height} ${points} ${width},${height}`}
                    fill={`url(#grad-${metric})`}
                />
                {/* Line */}
                <polyline
                    points={points}
                    fill="none"
                    stroke={config.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Latest dot */}
                {values.length > 0 && (() => {
                    const lastIdx = values.length - 1;
                    const x = (lastIdx / (values.length - 1)) * width;
                    const y = height - (values[lastIdx] / max) * (height - 5);
                    return <circle cx={x} cy={y} r="3" fill={config.color} />;
                })()}
            </svg>
            {/* Labels */}
            <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                {data.map((d, i) => (
                    <span key={i}>{d.date.slice(8)}</span> // Show only day
                ))}
            </div>
        </div>
    );
};

// --- Main Component ---
const ResourceMonitor: React.FC = () => {
    const [usage, setUsage] = useState<DailyUsage>(getCurrentUsage());
    const [history, setHistory] = useState<DailyUsage[]>(getUsageHistory());
    const [lastRefresh, setLastRefresh] = useState(new Date());

    // Auto-refresh every 5 seconds (reads from in-memory tracker, 0 Firestore cost)
    useEffect(() => {
        const interval = setInterval(() => {
            setUsage(getCurrentUsage());
            setHistory(getUsageHistory());
            setLastRefresh(new Date());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = () => {
        setUsage(getCurrentUsage());
        setHistory(getUsageHistory());
        setLastRefresh(new Date());
    };

    // Overall health score
    const healthScore = useMemo(() => {
        const readPercent = getUsagePercent('reads');
        const writePercent = getUsagePercent('writes');
        const deletePercent = getUsagePercent('deletes');
        const maxPercent = Math.max(readPercent, writePercent, deletePercent);

        if (maxPercent >= THRESHOLDS.critical) return { label: 'NGUY HIỂM', color: 'text-red-400', bg: 'bg-red-500/20', icon: '🚨' };
        if (maxPercent >= THRESHOLDS.danger) return { label: 'CẢNH BÁO CAO', color: 'text-red-400', bg: 'bg-red-500/10', icon: '🔴' };
        if (maxPercent >= THRESHOLDS.warning) return { label: 'CHÚ Ý', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: '⚠️' };
        return { label: 'AN TOÀN', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: '🟢' };
    }, [usage]);

    // Estimated daily projection
    const projection = useMemo(() => {
        const now = new Date();
        const hours = now.getHours() + now.getMinutes() / 60;
        if (hours < 0.5) return null; // Not enough data yet

        const factor = 24 / hours;
        return {
            reads: Math.round(usage.reads * factor),
            writes: Math.round(usage.writes * factor),
            deletes: Math.round(usage.deletes * factor),
        };
    }, [usage]);

    return (
        <div className="h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${healthScore.bg}`}>
                        <Activity size={20} className={healthScore.color} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            Resource Monitor
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${healthScore.bg} ${healthScore.color}`}>
                                {healthScore.icon} {healthScore.label}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500">
                            Firebase Free Tier • Cập nhật: {lastRefresh.toLocaleTimeString('vi-VN')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="Làm mới"
                    >
                        <RefreshCcw size={16} />
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Reset bộ đếm hôm nay về 0? (Chỉ dùng cho testing)')) {
                                resetTodayUsage();
                                handleRefresh();
                            }
                        }}
                        className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                        title="Reset counters (Testing)"
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </div>

            {/* Gauge Bars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GaugeBar metric="reads" value={usage.reads} quota={QUOTAS.reads} />
                <GaugeBar metric="writes" value={usage.writes} quota={QUOTAS.writes} />
                <GaugeBar metric="deletes" value={usage.deletes} quota={QUOTAS.deletes} />
            </div>

            {/* Projection Card */}
            {projection && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={16} className="text-indigo-400" />
                        <span className="text-sm font-bold text-indigo-300">Dự báo cuối ngày (ước tính)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        {(['reads', 'writes', 'deletes'] as const).map(metric => {
                            const projected = projection[metric];
                            const quota = QUOTAS[metric];
                            const percent = (projected / quota) * 100;
                            const level = getAlertLevel(percent);
                            const colors = LEVEL_COLORS[level];

                            return (
                                <div key={metric} className="text-center">
                                    <div className={`text-lg font-mono font-bold ${colors.text}`}>
                                        {projected > 1000 ? `${(projected / 1000).toFixed(1)}K` : projected}
                                    </div>
                                    <div className="text-[10px] text-slate-500 uppercase">
                                        {METRIC_CONFIG[metric].label} (~{percent.toFixed(0)}%)
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Trend Charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['reads', 'writes', 'deletes'] as const).map(metric => (
                    <div key={metric} className="p-4 rounded-xl bg-slate-800/30 border border-white/5">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-300">{METRIC_CONFIG[metric].label} — 7 ngày</span>
                        </div>
                        <SparklineChart history={history} metric={metric} />
                    </div>
                ))}
            </div>

            {/* Alert Thresholds Info */}
            <div className="p-4 rounded-xl bg-slate-800/20 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                    <Shield size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Ngưỡng cảnh báo</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <span className="text-amber-400 text-sm">⚠️</span>
                        <div>
                            <div className="text-xs font-bold text-amber-300">{THRESHOLDS.warning}%</div>
                            <div className="text-[10px] text-slate-500">Chú ý</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                        <span className="text-red-400 text-sm">🔴</span>
                        <div>
                            <div className="text-xs font-bold text-red-300">{THRESHOLDS.danger}%</div>
                            <div className="text-[10px] text-slate-500">Nguy hiểm</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-600/10 border border-red-600/30">
                        <span className="text-red-300 text-sm">🚨</span>
                        <div>
                            <div className="text-xs font-bold text-red-200">{THRESHOLDS.critical}%</div>
                            <div className="text-[10px] text-slate-500">Cực kỳ nguy hiểm</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Note */}
            <p className="text-[10px] text-slate-600 text-center">
                📊 Dữ liệu được theo dõi từ Centralized Proxy (@/lib/firestore). Độ chính xác ~100%. • Cảnh báo Push gửi đến Admin khi vượt ngưỡng.
            </p>
        </div>
    );
};

export default ResourceMonitor;

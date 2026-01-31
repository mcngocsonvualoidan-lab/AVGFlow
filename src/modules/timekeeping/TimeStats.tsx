import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useData, User } from '../../context/DataContext';
import { calculateWorkingDays, getMonthDays } from './utils';
import { USER_SORT_ORDER } from '../../constants/common';
const COLORS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#eab308', // Yellow
    '#84cc16', // Lime
    '#22c55e', // Green
    '#10b981', // Emerald
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#0ea5e9', // Sky
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#a855f7', // Purple
    '#d946ef', // Fuchsia
    '#ec4899', // Pink
];

interface TimeStatsProps {
    month: number;
    year: number;
    users?: User[];
}

const TimeStats: React.FC<TimeStatsProps> = ({ month, year, users: propUsers }) => {
    const { users: contextUsers } = useData();
    const users = propUsers || contextUsers;
    const standardWorkDays = calculateWorkingDays(month, year);
    const ANNUAL_PAID_LEAVE = 12; // 12 days quota for 2026

    const days = React.useMemo(() => getMonthDays(month, year), [month, year]);

    // Helper to Determine Status Code (Replicated from TimeGrid for sync)
    const getStatusCode = (user: User, dateStr: string, isWeekend: boolean, holidayName: string | null) => {
        // 1. Check Holiday first
        if (holidayName) return 'L';

        // 2. Check Weekend
        if (isWeekend) return 'CN';

        // 3. Check User Leaves
        if (user.leaves) {
            for (const leave of user.leaves) {
                if (dateStr >= leave.start && dateStr <= leave.end) {
                    if (leave.type === 'leave') {
                        if (leave.session && leave.session !== 'full') return 'P/2';
                        return 'P';
                    }
                    if (leave.type === 'absence') {
                        if (leave.session && leave.session !== 'full') return 'x/2';
                        return 'KP';
                    }
                    if (leave.type === 'online') return 'ol';
                }
            }
        }

        // 4. Default: Work (Automatic Tick Logic)
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        if (dateStr > todayStr) return ''; // Future
        if (dateStr === todayStr) {
            if (now.getHours() < 18) return ''; // Today, working
        }

        // SPECIAL RULE: Jan 01 is Holiday (Double check if utils covered it, but TimeGrid has this extra check)
        if (dateStr === '2026-01-01') return 'nl';

        // Past or Today > 18:00
        return 'X';
    };

    // Calculate Stats per User
    const userStats = users.map(u => {
        // --- 1. Monthly Stats (Using Grid Logic) ---
        let monthlyPaidWork = 0;
        let monthlyLeaveDays = 0; // Just for counting P occurrences specifically for separate stats if needed
        let monthlyAbsenceDays = 0; // Just for counting KP

        days.forEach(d => {
            const code = getStatusCode(u, d.date, d.isWeekend, d.holiday);
            switch (code) {
                case 'X':
                case 'ol':
                case 'P':
                case 'L':
                case 'nl':
                    monthlyPaidWork += 1;
                    if (code === 'P') monthlyLeaveDays += 1;
                    break;
                case 'P/2':
                    monthlyPaidWork += 1; // 0.5 Work + 0.5 Paid Leave
                    monthlyLeaveDays += 0.5;
                    break;
                case 'x/2':
                    monthlyPaidWork += 0.5; // 0.5 Work
                    monthlyAbsenceDays += 0.5;
                    break;
                case 'KP':
                    monthlyAbsenceDays += 1;
                    break;
                default:
                    break;
            }
        });

        // --- 2. Yearly Stats (For Leave Balance - Remains Top-Down Logic or needs sync?) ---
        // For Leave Balance, we iterate all 2026 leaves.
        let totalPaidLeaveUsed = 0;
        if (u.leaves) {
            u.leaves.forEach(l => {
                const start = new Date(l.start);
                const end = new Date(l.end);
                // Iterate daily
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    if (d.getFullYear() === 2026) {
                        const dayOfWeek = d.getDay();
                        if (dayOfWeek !== 0) { // Not Sunday
                            if (l.type === 'leave') {
                                totalPaidLeaveUsed += (l.session && l.session !== 'full') ? 0.5 : 1;
                            }
                        }
                    }
                }
            });
        }

        const remainingPaidLeave = Math.max(0, ANNUAL_PAID_LEAVE - totalPaidLeaveUsed);

        return {
            name: u.name,
            shortName: u.name.split(' ').slice(-2).join(' '),
            actual: monthlyPaidWork,
            monthLeave: monthlyLeaveDays,
            monthAbsence: monthlyAbsenceDays,
            yearlyUsed: totalPaidLeaveUsed,
            yearlyRemaining: remainingPaidLeave,
            yearlyQuota: ANNUAL_PAID_LEAVE
        };
    }).sort((a, b) => {
        const indexA = USER_SORT_ORDER.indexOf(a.name);
        const indexB = USER_SORT_ORDER.indexOf(b.name);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-4 rounded-xl">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Ngày công chuẩn (T{month})</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{standardWorkDays} ngày</p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-4 rounded-xl">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Nhân sự đủ công</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                        {userStats.filter(u => u.actual >= standardWorkDays).length}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-4 rounded-xl">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Tổng phép đã dùng (2026)</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-500">
                        {userStats.reduce((sum, u) => sum + u.yearlyUsed, 0)} ngày
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-4 rounded-xl">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Tổng không lương (T{month})</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                        {userStats.reduce((sum, u) => sum + u.monthAbsence, 0)}
                    </p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Monthly Attendance Chart */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-5 rounded-xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">Thống kê Ngày công tháng {month}</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={userStats} layout="vertical" margin={{ left: 40, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} stroke="#94a3b8" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="shortName" width={100} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '12px' }}
                                    itemStyle={{ color: '#0f172a' }}
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                />
                                <Bar dataKey="actual" name="Công thực tế" stackId="a" barSize={16} radius={[0, 4, 4, 0]}>
                                    {userStats.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Annual Leave Balance Chart */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-5 rounded-xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">Quỹ phép năm 2026 (12 ngày)</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={userStats} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} stroke="#94a3b8" />
                                <XAxis type="number" domain={[0, 12]} stroke="#94a3b8" />
                                <YAxis type="category" dataKey="shortName" width={100} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '12px' }}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Bar dataKey="yearlyUsed" name="Đã nghỉ" stackId="b" fill="#f59e0b" barSize={12} radius={[0, 0, 0, 0]} />
                                <Bar dataKey="yearlyRemaining" name="Còn lại" stackId="b" fill="#3b82f6" barSize={12} radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Table Detail */}
                <div className="col-span-1 lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-5 rounded-xl overflow-hidden flex flex-col">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">Chi tiết phép năm 2026</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Nhân sự</th>
                                    <th className="px-4 py-3 text-center">Tiêu chuẩn 2026</th>
                                    <th className="px-4 py-3 text-center text-orange-600 dark:text-orange-500">Đã nghỉ</th>
                                    <th className="px-4 py-3 text-center text-blue-600 dark:text-blue-500">Còn lại</th>
                                    <th className="px-4 py-3 text-center rounded-tr-lg">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                                {userStats.map((u, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{u.name}</td>
                                        <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">12</td>
                                        <td className="px-4 py-3 text-center text-orange-600 dark:text-orange-500 font-bold">{u.yearlyUsed}</td>
                                        <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-500 font-bold">{u.yearlyRemaining}</td>
                                        <td className="px-4 py-3 text-center">
                                            {u.yearlyRemaining === 0 ? (
                                                <span className="px-2 py-1 rounded bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 text-xs font-bold">
                                                    Hết phép
                                                </span>
                                            ) : u.yearlyRemaining < 4 ? (
                                                <span className="px-2 py-1 rounded bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 text-xs font-bold">
                                                    Sắp hết
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 text-xs font-bold">
                                                    Khả dụng
                                                </span>
                                            )}
                                        </td>
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

export default TimeStats;

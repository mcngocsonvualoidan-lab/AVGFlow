import React from 'react';
import { getMonthDays } from './utils';
import { useData, User } from '../../context/DataContext';
import { USER_SORT_ORDER } from '../../constants/common';
import { clsx } from 'clsx';
import LeaveDetailsList from './LeaveDetailsList';

interface TimeGridProps {
    month: number;
    year: number;
    users?: User[];
}

const TimeGrid: React.FC<TimeGridProps> = ({ month, year, users: propUsers }) => {
    const { users: contextUsers } = useData();
    const users = propUsers || contextUsers;
    const days = getMonthDays(month, year);

    // SORT USERS
    const sortedUsers = [...users].sort((a, b) => {
        const indexA = USER_SORT_ORDER.indexOf(a.name);
        const indexB = USER_SORT_ORDER.indexOf(b.name);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Both in list
        if (indexA !== -1) return -1; // A in list, B not -> A first
        if (indexB !== -1) return 1; // B in list, A not -> B first
        return a.name.localeCompare(b.name); // Neither in list -> Alphabetical
    });

    // Helper to get status code for a specific user and date
    const getStatus = (user: User, dateStr: string, isWeekend: boolean, holidayName: string | null) => {
        // 1. Check Holiday first
        if (holidayName) return { code: 'L', color: 'bg-red-200 dark:bg-red-500/20 text-red-900 dark:text-red-500 font-black', title: holidayName };

        // 2. Check Weekend
        if (isWeekend) return { code: 'CN', color: 'bg-slate-200 dark:bg-slate-700/80 text-slate-600 dark:text-slate-400 font-bold', title: 'Chủ nhật' };

        // 3. Check User Leaves
        if (user.leaves) {
            for (const leave of user.leaves) {
                // Check date range (inclusive)
                // Fix: Normalize date strings to strip time component if present
                const leaveStart = leave.start.split('T')[0];
                const leaveEnd = leave.end.split('T')[0];

                if (dateStr >= leaveStart && dateStr <= leaveEnd) {
                    if (leave.type === 'leave') {
                        // Check for Half Day
                        if (leave.session && leave.session !== 'full') {
                            return {
                                code: 'P/2',
                                color: 'bg-orange-200 dark:bg-orange-500/10 text-orange-900 dark:text-orange-400 font-black',
                                title: `Nghỉ phép (${leave.session === 'morning' ? 'Sáng' : 'Chiều'})`
                            };
                        }
                        return { code: 'P', color: 'bg-orange-200 dark:bg-orange-500/20 text-orange-900 dark:text-orange-500 font-black', title: 'Nghỉ phép' };
                    }
                    if (leave.type === 'absence') {
                        if (leave.session && leave.session !== 'full') {
                            return {
                                code: 'x/2',
                                color: 'bg-purple-200 dark:bg-purple-500/10 text-purple-900 dark:text-purple-400 font-black',
                                title: `Nghỉ không lương 1/2 (${leave.session === 'morning' ? 'Sáng' : 'Chiều'})`
                            };
                        }
                        return { code: 'KP', color: 'bg-purple-200 dark:bg-purple-500/20 text-purple-900 dark:text-purple-500 font-black', title: 'Nghỉ không phép' };
                    }
                    if (leave.type === 'online') {
                        return { code: 'ol', color: 'bg-blue-200 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 font-black', title: 'Làm việc Online' };
                    }
                }
            }
        }

        // 4. Default: Work (Automatic Tick Logic)
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        if (dateStr > todayStr) {
            // Future: Empty
            return { code: '', color: '', title: 'Chưa ghi nhận' };
        } else if (dateStr === todayStr) {
            // Today: Check time > 18:00
            const currentHour = now.getHours();
            if (currentHour < 18) {
                return { code: '', color: '', title: 'Đang làm việc...' };
            }
        }

        // SPECIAL RULE: Jan 01 is Holiday
        if (dateStr === '2026-01-01') {
            return { code: 'nl', color: 'bg-red-200 dark:bg-red-500/20 text-red-900 dark:text-red-500 font-black', title: 'Nghỉ Tết Dương Lịch' };
        }

        // Past or Today > 18:00
        return { code: 'X', color: 'text-emerald-600 dark:text-emerald-500 font-bold', title: 'Làm việc' };
    };

    return (
        <div className="space-y-6">
            <div className="w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-xl ring-1 ring-black/5">
                <div className="p-4 border-b border-white/20 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 flex justify-between items-center">
                    <h3 className="font-bold text-emerald-800 dark:text-emerald-300 text-lg flex items-center gap-2">
                        📅 Bảng Chấm Công Chi Tiết
                    </h3>
                    <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-white/50 dark:bg-black/20 px-3 py-1 rounded-full">
                        Tháng {month}/{year}
                    </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-white/10">
                                <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 p-3 text-left font-bold text-slate-900 dark:text-white min-w-[200px] border-r border-slate-200 dark:border-white/10">
                                    Nhân sự
                                </th>
                                {days.map(d => (
                                    <th key={d.day} className={clsx(
                                        "p-2 min-w-[32px] text-center border-r border-slate-100 dark:border-white/5 transition-colors",
                                        d.isWeekend ? "bg-slate-200 dark:bg-slate-700/80 text-slate-700 dark:text-slate-400 font-bold" : "text-slate-700 dark:text-slate-400 font-bold",
                                        d.holiday && "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 font-bold"
                                    )}>
                                        <div className="flex flex-col gap-0.5">
                                            <span>{d.day}</span>
                                            <span className="text-[9px] opacity-70">
                                                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.weekday]}
                                            </span>
                                            <span className="text-[8px] opacity-70 text-indigo-600 dark:text-indigo-400 font-bold">
                                                {d.lunarDay}/{d.lunarMonth}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                                <th className="sticky right-0 z-20 bg-emerald-200 dark:bg-emerald-900/50 p-2 text-center font-bold text-emerald-900 dark:text-emerald-400 min-w-[50px] border-l border-emerald-300 dark:border-white/10 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]">
                                    Tổng
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedUsers.map((user, idx) => (
                                <tr key={user.id} className={clsx("group hover:bg-slate-100 dark:hover:bg-white/5 transition-colors border-b border-slate-200 dark:border-white/5", idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-900/50")}>
                                    <td className={clsx(
                                        "sticky left-0 z-30 p-3 border-r border-slate-200 dark:border-white/10 font-medium text-slate-900 dark:text-white whitespace-nowrap group-hover:text-indigo-500 transition-colors shadow-[5px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[5px_0_10px_-5px_rgba(0,0,0,0.3)]",
                                        idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-900"
                                    )}>
                                        <div className="flex items-center gap-2">
                                            <img src={user.avatar} className="w-5 h-5 rounded-full object-cover" />
                                            <span>{user.name}</span>
                                        </div>
                                    </td>
                                    {days.map(d => {
                                        const status = getStatus(user, d.date, d.isWeekend, d.holiday);
                                        let cellContent = status.code;
                                        let cellClass = status.color;

                                        // Special styling for x/2
                                        if (status.code === 'x/2') {
                                            cellContent = 'x/2';
                                            cellClass = 'bg-purple-200 dark:bg-purple-500/10 text-purple-900 dark:text-purple-400 font-black';
                                        }

                                        return (
                                            <td
                                                key={`${user.id}-${d.day}`}
                                                className={clsx(
                                                    "p-1 text-center border-r border-slate-100 dark:border-white/5 cursor-default relative text-[10px] font-bold select-none",
                                                    cellClass,
                                                    status.code === 'X' && "group-hover:text-emerald-600 dark:group-hover:text-emerald-500 transition-colors"
                                                )}
                                                title={`${user.name} - ${d.date}: ${status.title}`}
                                            >
                                                {cellContent}
                                            </td>
                                        );
                                    })}
                                    {/* TOTAL COLUMN */}
                                    <td className={clsx(
                                        "sticky right-0 z-10 border-l border-emerald-200 dark:border-white/10 p-2 text-center font-black text-emerald-900 dark:text-emerald-400 min-w-[50px] shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]",
                                        "bg-emerald-100 dark:bg-emerald-900/20"
                                    )}>
                                        {(() => {
                                            let total = 0;
                                            days.forEach(d => {
                                                const status = getStatus(user, d.date, d.isWeekend, d.holiday);
                                                // Logic for counting "Công" (Paid Days)
                                                switch (status.code) {
                                                    case 'X':
                                                    case 'ol':
                                                    case 'P':
                                                    case 'L':
                                                    case 'nl':
                                                        total += 1;
                                                        break;
                                                    case 'P/2':
                                                        total += 1; // 0.5 Leave + 0.5 Work = 1.0 Paid
                                                        break;
                                                    case 'x/2':
                                                        total += 0.5; // 0.5 Unpaid + 0.5 Work = 0.5 Paid
                                                        break;
                                                    default:
                                                        break;
                                                }
                                            });
                                            return total;
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Legend */}
                {/* Legend */}
                <div className="p-6 border-t border-white/20 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300 justify-center bg-slate-50/50 dark:bg-slate-800/30">
                    <span className="font-bold mr-2 opacity-70 uppercase tracking-wider text-[10px] self-center">Chú thích:</span>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-white/5 rounded-md border border-slate-200 dark:border-white/10 shadow-sm"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> X: Làm việc</div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-white/5 rounded-md border border-slate-200 dark:border-white/10 shadow-sm"><span className="w-2 h-2 rounded-full border-2 border-blue-500"></span> ol: Online</div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-white/5 rounded-md border border-slate-200 dark:border-white/10 shadow-sm"><span className="w-2 h-2 rounded-full bg-orange-500"></span> P: Nghỉ phép</div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-white/5 rounded-md border border-slate-200 dark:border-white/10 shadow-sm"><span className="w-2 h-2 rounded-full bg-orange-300"></span> P/2: 1/2 phép</div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-white/5 rounded-md border border-slate-200 dark:border-white/10 shadow-sm"><span className="w-2 h-2 rounded-full bg-purple-500"></span> KP: Không phép</div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-white/5 rounded-md border border-slate-200 dark:border-white/10 shadow-sm"><span className="w-2 h-2 rounded-full bg-purple-300"></span> x/2: 1/2 ngày KP</div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-white/5 rounded-md border border-slate-200 dark:border-white/10 shadow-sm"><span className="w-2 h-2 rounded-full bg-red-500"></span> L: Lễ/Tết</div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-white/5 rounded-md border border-slate-200 dark:border-white/10 shadow-sm"><span className="w-2 h-2 rounded-full bg-slate-300"></span> CN: Chủ nhật</div>
                </div>
            </div>

            {/* Leave Details List */}
            <LeaveDetailsList month={month} year={year} users={users} />
        </div>
    );
};

export default TimeGrid;

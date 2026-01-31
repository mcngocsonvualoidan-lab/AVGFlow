import React from 'react';
import { User, LeaveRecord } from '../../context/DataContext';
import { clsx } from 'clsx';

interface LeaveDetailsListProps {
    month: number;
    year: number;
    users?: User[];
}

const LeaveDetailsList: React.FC<LeaveDetailsListProps> = ({ month, year, users = [] }) => {
    // 1. Flatten and Filter Leaves
    const allLeaves = users.flatMap(user => {
        if (!user.leaves) return [];
        return user.leaves.map(leave => ({ user, leave }));
    });

    const currentMonthLeaves = allLeaves.filter(({ leave }) => {
        const start = new Date(leave.start);
        const end = new Date(leave.end);

        // Simple check: Is the start date in the current month?
        // Or strictly overlapping? Let's do Strict Overlap.
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month, end of day

        return start <= monthEnd && end >= monthStart;
    });

    // 2. Sort chronologically
    currentMonthLeaves.sort((a, b) => new Date(a.leave.start).getTime() - new Date(b.leave.start).getTime());

    // Helper for Type Badge
    const getTypeBadge = (leave: LeaveRecord) => {
        if (leave.type === 'online') return { label: 'Online', class: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-200 dark:border-blue-500/30' };
        if (leave.type === 'leave') {
            if (leave.session && leave.session !== 'full') return { label: 'P/2', class: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 border-orange-200 dark:border-orange-500/30' };
            return { label: 'P', class: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 border-orange-200 dark:border-orange-500/30' };
        }
        if (leave.type === 'absence') {
            if (leave.session && leave.session !== 'full') return { label: 'x/2', class: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-500 border-purple-200 dark:border-purple-500/30' };
            return { label: 'KP', class: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-500 border-purple-200 dark:border-purple-500/30' };
        }
        return { label: '?', class: 'bg-slate-100 dark:bg-slate-500/10 text-slate-500' };
    };

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return `${d.getDate()}/${d.getMonth() + 1}`;
        } catch { return dateStr; }
    };

    if (currentMonthLeaves.length === 0) return null;

    return (
        <div className="mt-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    📋 Danh sách chi tiết nghỉ / vắng tháng {month}/{year}
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-4 py-3">Thời gian</th>
                            <th className="px-4 py-3">Nhân sự</th>
                            <th className="px-4 py-3 text-center">Loại</th>
                            <th className="px-4 py-3">Lý do</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {currentMonthLeaves.map(({ user, leave }, idx) => {
                            const badge = getTypeBadge(leave);
                            const dateDisplay = leave.start === leave.end
                                ? formatDate(leave.start)
                                : `${formatDate(leave.start)} - ${formatDate(leave.end)}`;

                            return (
                                <tr key={`${user.id}-${leave.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                        {dateDisplay}
                                        {leave.session && leave.session !== 'full' && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1 font-normal">
                                                ({leave.session === 'morning' ? 'Sáng' : 'Chiều'})
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                        <div className="flex items-center gap-2">
                                            <img src={user.avatar} className="w-5 h-5 rounded-full border border-slate-200 dark:border-white/10" alt="" />
                                            <span className="hidden sm:inline font-medium">{user.name}</span>
                                            <span className="sm:hidden font-medium">{user.alias}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={clsx("px-2 py-0.5 rounded text-xs font-bold border", badge.class)}>
                                            {badge.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 italic">
                                        {leave.reason}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

};

export default LeaveDetailsList;

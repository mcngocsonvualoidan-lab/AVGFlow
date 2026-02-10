import React from 'react';
import { User, LeaveRecord } from '../../context/DataContext';
import { clsx } from 'clsx';
import { Clock, Calendar } from 'lucide-react';

interface LeaveDetailsListProps {
    month: number;
    year: number;
    users?: User[];
}

const LeaveDetailsList: React.FC<LeaveDetailsListProps> = ({ month, year, users = [] }) => {

    // 1. Flatten and Explode Leaves into Days (Memoized)
    const { granularLeaves, groupedLeaves } = React.useMemo(() => {
        const granular: { date: string; user: User; leave: LeaveRecord }[] = [];
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

        users.forEach(user => {
            if (!user.leaves) return;
            user.leaves.forEach(leave => {
                const start = new Date(leave.start);
                const end = new Date(leave.end);

                // Iterate from start to end
                let current = new Date(start);
                // Normalize current to start of day to avoid skipping if times differ
                current.setHours(0, 0, 0, 0);

                const endDate = new Date(end);
                endDate.setHours(23, 59, 59, 999); // Include full end day

                while (current <= endDate) {
                    // Check if date is in current month view
                    if (current >= monthStart && current <= monthEnd) {
                        const y = current.getFullYear();
                        const m = String(current.getMonth() + 1).padStart(2, '0');
                        const d = String(current.getDate()).padStart(2, '0');
                        const dateStr = `${y}-${m}-${d}`;

                        // ONLINE LOGIC: Only show past dates or today > 18:00
                        let showOnline = true;
                        if (leave.type === 'online') {
                            const now = new Date();
                            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                            if (dateStr > todayStr) showOnline = false;
                            else if (dateStr === todayStr && now.getHours() < 18) showOnline = false;
                        }

                        if (showOnline) {
                            granular.push({ date: dateStr, user, leave });
                        }
                    }
                    // Next day
                    current.setDate(current.getDate() + 1);
                }
            });
        });

        // 2. Sort Chronologically
        granular.sort((a, b) => a.date.localeCompare(b.date));

        // 3. Group by Date
        const grouped = granular.reduce((acc, { date, user, leave }) => {
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push({ user, leave });
            return acc;
        }, {} as Record<string, { user: User, leave: LeaveRecord }[]>);

        return { granularLeaves: granular, groupedLeaves: grouped };
    }, [month, year, users]);


    // Helper for Type Badge
    const getTypeStyles = (leave: LeaveRecord) => {
        switch (leave.type) {
            case 'online':
                return {
                    label: 'Online',
                    bg: 'bg-blue-50 dark:bg-blue-900/20',
                    border: 'border-blue-200 dark:border-blue-800',
                    text: 'text-blue-700 dark:text-blue-300',
                    dot: 'bg-blue-500'
                };
            case 'leave':
                return {
                    label: leave.session && leave.session !== 'full' ? 'Nghỉ phép (1/2)' : 'Nghỉ phép',
                    bg: 'bg-amber-50 dark:bg-amber-900/20',
                    border: 'border-amber-200 dark:border-amber-800',
                    text: 'text-amber-700 dark:text-amber-300',
                    dot: 'bg-amber-500'
                };
            case 'absence':
                return {
                    label: leave.session && leave.session !== 'full' ? 'Không lương (1/2)' : 'Không lương',
                    bg: 'bg-rose-50 dark:bg-rose-900/20',
                    border: 'border-rose-200 dark:border-rose-800',
                    text: 'text-rose-700 dark:text-rose-300',
                    dot: 'bg-rose-500'
                };
            default:
                return {
                    label: 'Khác',
                    bg: 'bg-slate-50 dark:bg-slate-800',
                    border: 'border-slate-200 dark:border-slate-700',
                    text: 'text-slate-700 dark:text-slate-300',
                    dot: 'bg-slate-400'
                };
        }
    };

    const formatDateDisplay = (dateStr: string) => {
        try {
            // Handle range
            if (dateStr.includes(' - ')) {
                const [start, end] = dateStr.split(' - ');
                const d1 = new Date(start);
                const d2 = new Date(end);
                return (
                    <div className="flex flex-col items-end text-right">
                        <span className="font-black text-xl md:text-2xl leading-none tracking-tight text-indigo-600 dark:text-indigo-400">
                            {d1.getDate()}-{d2.getDate()}
                        </span>
                        <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                            Tháng {d1.getMonth() + 1}
                        </span>
                    </div>
                );
            }
            // Handle single date
            const d = new Date(dateStr);
            return (
                <div className="flex flex-col items-end text-right">
                    <span className="font-black text-2xl md:text-3xl leading-none text-indigo-600 dark:text-indigo-400 block">
                        {d.getDate()}
                    </span>
                    <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5 block leading-tight">
                        Tháng {d.getMonth() + 1}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 uppercase block leading-tight">
                        {d.toLocaleDateString('vi-VN', { weekday: 'short' })}
                    </span>
                </div>
            );
        } catch { return dateStr; }
    };

    if (granularLeaves.length === 0) return null;

    return (
        <div className="mt-8">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                <Calendar className="w-6 h-6 text-indigo-500" />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                    Chi Tiết Nghỉ / Vắng Tháng {month}/{year}
                </span>
            </h3>

            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-24 md:ml-40 space-y-8 pl-8 md:pl-12 pb-12">
                {Object.entries(groupedLeaves).map(([dateKey, items]) => (
                    <div key={dateKey} className="relative">
                        {/* Timeline Dot & Date */}
                        <div className="absolute -left-[7.5rem] md:-left-[12rem] top-0 flex flex-col items-end w-20 md:w-32 text-slate-500 dark:text-slate-400 pr-2">
                            {formatDateDisplay(dateKey)}
                        </div>
                        <div className="absolute -left-[2.55rem] md:-left-[3.55rem] top-2 w-4 h-4 rounded-full border-4 border-white dark:border-slate-950 bg-indigo-500 shadow-md z-10"></div>

                        {/* Content Cards */}
                        <div className="space-y-3">
                            {items.map(({ user, leave }, idx) => {
                                const style = getTypeStyles(leave);
                                return (
                                    <div
                                        key={`${user.id}-${leave.id}-${idx}`}
                                        className={clsx(
                                            "relative group p-4 rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
                                            "bg-white dark:bg-slate-900/50 backdrop-blur-sm",
                                            style.border,
                                            style.bg
                                        )}
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Avatar */}
                                            <div className="relative shrink-0">
                                                <div className="w-10 h-10 rounded-full p-0.5 bg-white dark:bg-slate-800 shadow-sm">
                                                    <img
                                                        src={user.avatar}
                                                        className="w-full h-full rounded-full object-cover"
                                                        alt={user.name}
                                                    />
                                                </div>
                                                <div className={clsx("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm flex items-center justify-center", style.dot)}>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                                                        {user.name}
                                                    </h4>
                                                    <span className={clsx("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", style.border, style.text, "bg-white/50 dark:bg-black/20")}>
                                                        {style.label}
                                                    </span>
                                                </div>

                                                <p className="text-sm text-slate-600 dark:text-slate-400 italic mb-2 line-clamp-2 leading-relaxed">
                                                    "{leave.reason}"
                                                </p>

                                                {(leave.session && leave.session !== 'full') && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-500 font-medium bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded inline-flex">
                                                        <Clock size={12} />
                                                        <span>{leave.session === 'morning' ? 'Buổi Sáng (08:30 - 12:00)' : 'Buổi Chiều (13:30 - 17:30)'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LeaveDetailsList;

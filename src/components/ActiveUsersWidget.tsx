import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Users } from 'lucide-react';

const ActiveUsersWidget: React.FC = () => {
    const { users } = useData();

    const stats = useMemo(() => {
        const now = new Date();
        const nowIso = now.toISOString();
        const todayLocal = now.toLocaleDateString('en-CA'); // YYYY-MM-DD

        let online = 0;
        let onLeave = 0;
        let onAbsence = 0;
        let total = users.length;
        let onlineUsers: any[] = [];

        users.forEach(u => {
            let isUserOnline = false;
            let isUserOnLeave = false;
            let isUserAbsent = false;

            // Check Leave/Absence
            if (u.leaves) {
                for (const leave of u.leaves) {
                    if (leave.type === 'leave') {
                        // Full day leave
                        if (todayLocal >= leave.start && todayLocal <= leave.end) {
                            isUserOnLeave = true;
                            break; // Priority to full leave
                        }
                    } else if (leave.type === 'absence') {
                        // Temporary absence
                        if (nowIso >= leave.start && nowIso <= leave.end) isUserAbsent = true;
                    }
                }
            }

            // Check Online (Heartbeat within 5 mins)
            // If on full leave, they definitely aren't "working" officially, but might be online. 
            // Let's prioritize showing them as Online if they are actually online, or stick to status?
            // Usually status "Online" overrides "Leave" visually if they are actually active, but for stats, let's keep them separate buckets?
            // Existing logic: if (u.lastSeen && !isUserOnLeave) -> suggests if on leave, don't count as online.

            if (u.lastSeen && !isUserOnLeave && !isUserAbsent) {
                const diff = now.getTime() - new Date(u.lastSeen).getTime();
                if (diff < 5 * 60 * 1000) {
                    isUserOnline = true;
                }
            }

            if (isUserOnLeave) onLeave++;
            else if (isUserAbsent) onAbsence++;
            else if (isUserOnline) {
                online++;
                onlineUsers.push(u);
            }
        });

        return { online, onLeave, onAbsence, total, onlineUsers };
    }, [users]);

    return (
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between h-full group hover:border-indigo-500/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-slate-400 text-sm font-medium uppercase">Nhân sự Online</h3>
                    <div className="flex items-baseline gap-2 mt-2">
                        <h2 className="text-4xl font-bold text-white">{stats.online}</h2>
                        <span className="text-sm text-slate-500">/ {stats.total}</span>
                    </div>
                </div>
                <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                    <Users size={24} />
                </div>
            </div>

            {/* Avatars Preview */}
            <div className="flex -space-x-3 mb-4 overflow-hidden py-1 pl-1 min-h-[40px]">
                {stats.onlineUsers.slice(0, 5).map((u: any, idx: number) => (
                    <div key={idx} className="relative group/avatar">
                        <img
                            src={u.avatar}
                            className="w-10 h-10 rounded-full border-2 border-[#0f172a] shadow-lg object-cover"
                            title={u.name}
                        />
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                    </div>
                ))}
                {stats.online > 5 && (
                    <div className="w-10 h-10 rounded-full border-2 border-[#0f172a] bg-slate-800 flex items-center justify-center text-xs text-slate-300 font-bold">
                        +{stats.online - 5}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="flex items-center gap-3 text-[10px] text-slate-400 bg-slate-900/40 p-2 rounded-lg border border-white/5">
                <div className="flex items-center gap-1.5" title="Đang trực tuyến">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-emerald-400 font-bold whitespace-nowrap">Online: {stats.online}</span>
                </div>
                <div className="w-[1px] h-3 bg-white/10"></div>
                <div className="flex items-center gap-1.5" title="Nghỉ phép cả ngày">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    <span className="whitespace-nowrap">Nghỉ: <strong className="text-white">{stats.onLeave}</strong></span>
                </div>
                <div className="w-[1px] h-3 bg-white/10"></div>
                <div className="flex items-center gap-1.5" title="Vắng mặt tạm thời">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                    <span className="whitespace-nowrap">Vắng: <strong className="text-white">{stats.onAbsence}</strong></span>
                </div>
            </div>
        </div>
    );
};

export default ActiveUsersWidget;

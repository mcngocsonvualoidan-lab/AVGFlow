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
        let offline = 0;
        let total = users.length;
        let onlineUsers: any[] = [];
        let leaveUsers: any[] = [];
        let absenceUsers: any[] = [];
        let offlineUsers: any[] = [];

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
            if (u.lastSeen && !isUserOnLeave && !isUserAbsent) {
                const diff = now.getTime() - new Date(u.lastSeen).getTime();
                if (diff < 5 * 60 * 1000) {
                    isUserOnline = true;
                }
            }

            if (isUserOnLeave) {
                onLeave++;
                leaveUsers.push(u);
            }
            else if (isUserAbsent) {
                onAbsence++;
                absenceUsers.push(u);
            }
            else if (isUserOnline) {
                online++;
                onlineUsers.push(u);
            } else {
                offline++;
                offlineUsers.push(u);
            }
        });

        return { online, onLeave, onAbsence, offline, total, onlineUsers, leaveUsers, absenceUsers, offlineUsers };
    }, [users]);

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl rounded-[2rem] border border-white/20 dark:border-white/10 shadow-xl p-6 h-full flex flex-col justify-between group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10">
            {/* Decorative Gradients */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-emerald-400/20 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Nhân sự Online
                    </h3>
                    <div className="flex items-baseline gap-2 mt-1">
                        <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 tracking-tight">
                            {stats.online}
                        </h2>
                        <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">/ {stats.total} nhân sự</span>
                    </div>
                </div>
                <div className="p-3 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                    <Users size={22} className="drop-shadow-sm" />
                </div>
            </div>

            {/* Avatars Preview */}
            <div className="flex -space-x-3 mb-6 overflow-visible py-2 pl-2 min-h-[50px] relative z-10">
                {stats.onlineUsers.slice(0, 5).map((u: any, idx: number) => (
                    <div key={idx} className="relative group/avatar cursor-help hover:z-20 hover:-translate-y-1 transition-all duration-300">
                        <div className="absolute inset-0 bg-emerald-500 rounded-full blur-md opacity-20 group-hover/avatar:opacity-40 transition-opacity"></div>
                        <img
                            src={u.avatar}
                            className="w-12 h-12 rounded-full border-[3px] border-white dark:border-slate-800 shadow-md object-cover relative z-10"
                            title={`Online: ${u.name}`}
                        />
                        <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full z-20 animate-pulse"></div>
                    </div>
                ))}
                {stats.online > 5 && (
                    <div className="w-12 h-12 rounded-full border-[3px] border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700/80 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-300 shadow-inner z-0">
                        +{stats.online - 5}
                    </div>
                )}
            </div>

            {/* Footer Stats - DETAILED (2x2 Grid) */}
            <div className="grid grid-cols-2 gap-3 relative z-10">
                {/* Online */}
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-xl border border-emerald-100 dark:border-emerald-500/10 group/stat hover:bg-emerald-100/50 dark:hover:bg-emerald-500/10 transition-colors">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_#10b981]"></span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Online</span>
                    </div>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{stats.online}</span>
                </div>

                {/* Leave */}
                <div className="flex items-center justify-between p-2.5 bg-rose-50/50 dark:bg-rose-500/5 rounded-xl border border-rose-100 dark:border-rose-500/10 group/stat hover:bg-rose-100/50 dark:hover:bg-rose-500/10 transition-colors">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Nghỉ</span>
                    </div>
                    <div className="flex -space-x-1.5">
                        {stats.leaveUsers.slice(0, 3).map((u: any) => (
                            <img key={u.id} src={u.avatar} className="w-5 h-5 rounded-full border border-white dark:border-slate-800 grayscale opacity-60" />
                        ))}
                        {stats.leaveUsers.length > 3 && <span className="text-[10px] font-bold text-rose-500 pl-2">+{stats.leaveUsers.length - 3}</span>}
                        {stats.leaveUsers.length === 0 && <span className="text-sm font-bold text-rose-500">0</span>}
                    </div>
                </div>

                {/* Absence */}
                <div className="flex items-center justify-between p-2.5 bg-amber-50/50 dark:bg-amber-500/5 rounded-xl border border-amber-100 dark:border-amber-500/10 group/stat hover:bg-amber-100/50 dark:hover:bg-amber-500/10 transition-colors">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Vắng</span>
                    </div>
                    <span className="text-sm font-black text-amber-600 dark:text-amber-400">{stats.onAbsence}</span>
                </div>

                {/* Offline */}
                <div className="flex items-center justify-between p-2.5 bg-slate-50/50 dark:bg-slate-700/20 rounded-xl border border-slate-100 dark:border-slate-700/30 group/stat hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Offline</span>
                    </div>
                    <span className="text-sm font-black text-slate-500 dark:text-slate-400">{stats.offline}</span>
                </div>
            </div>
        </div>
    );
};

export default ActiveUsersWidget;

import React, { useMemo } from 'react';
import { LayoutDashboard, CheckSquare, GitGraph, Users, FileBarChart, Menu, Settings, Gift, Sparkles, CircleDollarSign, Calendar, FileCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, collapsed, setCollapsed }) => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const { users, birthdayWishes, showTetDecor, toggleTetDecor, activeEvents } = useData();

    // Check if user has birthday or special event active
    const showSpecialBox = useMemo(() => {
        if (!currentUser) return false;

        const appUser = users.find(u => u.email === currentUser.email);
        if (!appUser) return false;

        // 1. Birthday Check
        let isBirthday = false;
        if (appUser.dob) {
            const dob = new Date(appUser.dob);
            const today = new Date();
            const currentYear = today.getFullYear();
            const thisYearBirthday = new Date(currentYear, dob.getMonth(), dob.getDate());

            const diffTime = today.getTime() - thisYearBirthday.getTime();
            const diffDays = diffTime / (1000 * 3600 * 24);
            isBirthday = diffDays >= 0 && diffDays < 4;
        }

        // 2. Event Check
        const hasActiveEvent = activeEvents && activeEvents.some(e => {
            if (e.userId !== appUser.id) return false;
            const eventDate = new Date(e.date);
            const today = new Date();
            const diffTime = today.getTime() - eventDate.getTime();
            const diffDays = diffTime / (1000 * 3600 * 24);
            return diffDays >= -1 && diffDays <= 3;
        });

        return isBirthday || hasActiveEvent;

    }, [currentUser, users, activeEvents]);

    const unreadWishesCount = useMemo(() => {
        if (!currentUser) return 0;
        const appUser = users.find(u => u.email === currentUser.email);
        if (!appUser) return 0;

        return birthdayWishes.filter(w => w.toUserId === appUser.id && !w.isRead).length;
    }, [currentUser, users, birthdayWishes]);

    // Define Menu Groups
    const menuGroups = [
        // Group 1: Overview
        [
            { id: 'dashboard', icon: LayoutDashboard, label: t.sidebar.dashboard },
        ],
        // Group 2: Management
        [
            { id: 'tasks', icon: CheckSquare, label: t.sidebar.tasks },
            { id: 'workflow', icon: GitGraph, label: t.sidebar.workflow },
            { id: 'reports', icon: FileBarChart, label: t.sidebar.reports },
        ],
        // Group 3: Personnel & Finance
        [
            { id: 'users', icon: Users, label: t.sidebar.users },
            { id: 'income', icon: CircleDollarSign, label: 'Thu nhập' },
        ],
        // Group 4: Docs & Schedule
        [
            { id: 'schedule', icon: Calendar, label: 'Lịch trao đổi' },
            { id: 'conclusion-docs', icon: FileCheck, label: 'Văn bản kết luận' },
        ]
    ];

    if (showSpecialBox) {
        menuGroups.push([
            { id: 'my-wishes', icon: Gift, label: 'Hộp thư yêu thương' }
        ]);
    }

    return (
        <aside
            className={twMerge(
                "h-screen fixed left-0 top-0 transition-all duration-300 ease-in-out z-50 glass-panel border-r border-white/10 flex flex-col",
                collapsed ? "w-16" : "w-64"
            )}
        >
            {/* Brand / Logo Area */}
            <div className="h-16 flex items-center justify-center border-b border-white/5 relative shrink-0">
                <div className={clsx("absolute transition-opacity duration-300", collapsed ? "opacity-0" : "opacity-100")}>
                    <h1 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                        AVG<span className="font-light text-white">Flow</span>
                    </h1>
                </div>
                <div className={clsx("absolute transition-opacity duration-300", collapsed ? "opacity-100" : "opacity-0")}>
                    <span className="text-xl font-bold text-indigo-500">A</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 flex flex-col overflow-y-auto custom-scrollbar">
                {menuGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className={clsx("flex flex-col gap-1 mx-3", groupIndex > 0 && "mt-3 pt-3 border-t border-white/5")}>
                        {group.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={clsx(
                                    "flex items-center px-4 py-3 mx-2 rounded-xl transition-all duration-200 relative group overflow-hidden",
                                    collapsed ? "justify-center gap-0" : "gap-3",
                                    item.id === 'my-wishes'
                                        ? (activeTab === item.id
                                            ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/40 border border-pink-400/50"
                                            : "bg-gradient-to-r from-pink-900/30 to-rose-900/30 text-pink-300 hover:from-pink-600/80 hover:to-rose-600/80 hover:text-white border border-pink-500/20 hover:border-pink-500/50 shadow-pink-900/10 hover:shadow-pink-500/20")
                                        : (activeTab === item.id
                                            ? "bg-indigo-600/30 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/30"
                                            : "text-slate-400 hover:bg-white/5 hover:text-white")
                                )}
                                title={collapsed ? item.label : undefined}
                            >
                                <item.icon size={20} className={clsx(
                                    "min-w-[20px] shrink-0 transition-colors",
                                    activeTab === item.id
                                        ? (item.id === 'my-wishes' ? "text-white animate-bounce-slow" : "text-indigo-400")
                                        : (item.id === 'my-wishes' ? "text-pink-400 group-hover:text-white" : "text-current")
                                )} />
                                <span className={clsx("whitespace-nowrap transition-all duration-300", collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto")}>
                                    {item.label}
                                </span>

                                {/* Unread Wishes Badge */}
                                {item.id === 'my-wishes' && unreadWishesCount > 0 && (
                                    <span className={clsx(
                                        "flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full absolute shadow-lg shadow-red-500/50 animate-bounce-slow",
                                        collapsed ? "top-2 right-2 w-2.5 h-2.5 p-0" : "right-3 w-5 h-5"
                                    )}>
                                        {!collapsed && unreadWishesCount}
                                    </span>
                                )}

                                {/* Active Indicator Glow */}
                                {activeTab === item.id && (
                                    <div className="absolute inset-0 bg-indigo-400/10 blur-md rounded-xl -z-10" />
                                )}
                            </button>
                        ))}
                    </div>
                ))}
            </nav>

            {/* Collapse Toggle & Footer settings */}
            <div className="p-4 border-t border-white/5 space-y-2 shrink-0">
                {/* Tet Decoration Toggle */}
                <button
                    onClick={toggleTetDecor}
                    className={clsx(
                        "w-full flex items-center p-2 rounded-lg transition-all duration-200 group",
                        collapsed ? "justify-center" : "justify-between px-3",
                        showTetDecor ? "text-yellow-400 bg-yellow-500/5 border border-yellow-500/20" : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                    )}
                    title={collapsed ? "Bật/Tắt không khí Tết" : undefined}
                >
                    <div className={clsx("flex items-center gap-3 transition-colors", showTetDecor && "text-yellow-400")}>
                        <Sparkles size={20} className={clsx("shrink-0", showTetDecor && "animate-pulse")} />
                        <span className={clsx("whitespace-nowrap transition-all duration-300 font-medium text-sm", collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto", showTetDecor && "bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent font-bold")}>
                            Không khí Tết
                        </span>
                    </div>

                    {!collapsed && (
                        <div className={clsx("w-8 h-4 rounded-full relative transition-colors border border-white/10 shrink-0", showTetDecor ? "bg-red-500 shadow-sm" : "bg-slate-700")}>
                            <div className={clsx("absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm", showTetDecor ? "left-[18px]" : "left-[3px]")} />
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={clsx(
                        "w-full flex items-center p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors",
                        collapsed ? "justify-center" : "gap-3 px-3"
                    )}
                >
                    <Menu size={20} className="shrink-0" />
                    <span className={clsx("whitespace-nowrap transition-all duration-300", collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto text-sm")}>
                        Thu gọn
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('settings')}
                    className={clsx(
                        "w-full flex items-center p-2 rounded-lg transition-all duration-200",
                        collapsed ? "justify-center gap-0" : "gap-3",
                        activeTab === 'settings' ? "text-indigo-400 bg-indigo-500/10 shadow-[0_0_10px_rgba(99,102,241,0.2)]" : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                    title="Settings"
                >
                    <Settings size={20} className="shrink-0 min-w-[20px]" />
                    <span className={clsx("whitespace-nowrap transition-all duration-300", collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto text-sm")}>
                        {t.sidebar.settings}
                    </span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;

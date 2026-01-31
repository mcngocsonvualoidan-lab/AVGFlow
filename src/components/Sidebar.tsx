import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, GitGraph, Users, FileBarChart, Menu, Settings, Gift, Sparkles, CircleDollarSign, Calendar, FileCheck, Grid, Megaphone, Wallet, CalendarCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

interface SidebarProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    mobileOpen?: boolean;
    setMobileOpen?: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed, mobileOpen = false, setMobileOpen }) => {
    const { t } = useLanguage();
    const location = useLocation();
    const activeTab = location.pathname.substring(1) || 'dashboard'; // e.g. /tasks -> tasks

    // ... logic unchanged
    const { currentUser } = useAuth();
    const { users, birthdayWishes, showTetDecor, toggleTetDecor, activeEvents } = useData();

    // Define appUser here to be accessible by all hooks
    const appUser = useMemo(() => {
        if (!currentUser) return null;
        return users.find(u => u.email === currentUser.email);
    }, [currentUser, users]);

    // Check if user has birthday or special event active
    const showSpecialBox = useMemo(() => {
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
            { id: 'executive-directives', icon: Megaphone, label: 'Thông điệp điều hành' },
            { id: 'apps', icon: Grid, label: 'Kho Ứng dụng' },
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
            { id: 'timesheet', icon: CalendarCheck, label: 'Bảng chấm công' },
            { id: 'income', icon: CircleDollarSign, label: 'Thu nhập' },
            { id: 'business-fund', icon: Wallet, label: 'Quỹ doanh nghiệp' },
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

    // Filter Menu based on Permissions (RBAC)
    const filteredMenuGroups = useMemo(() => {
        // 1. If not logged in or Super Admin, show all
        if (!appUser) return menuGroups;
        const isSuperAdmin = ['mcngocsonvualoidan@gmail.com', 'ccmartech.com@gmail.com'].includes(appUser.email) || appUser.isAdmin;
        if (isSuperAdmin) return menuGroups;

        // 2. Permission Mapping
        const keyMap: Record<string, string> = {
            'dashboard': 'dashboard',
            'ai-chat': 'ai_chat',
            'tasks': 'tasks',
            'workflow': 'workflow',
            'reports': 'reports',
            'users': 'users',
            'income': 'finance',
            'schedule': 'schedule',
            'conclusion-docs': 'documents'
        };

        // 3. Filter
        return menuGroups.map(group => {
            return group.filter(item => {
                // Special items override
                if (item.id === 'my-wishes') return true;

                // Check specific permission
                const permKey = keyMap[item.id];
                if (!permKey) return true; // Default allow if no key mapped

                // If permissions object exists but this specific key is missing -> Allow or Deny?
                // Let's Default ALLOW for backward compatibility, unless explicitly set to false.
                const userPerms = appUser.permissions as any; // Cast to any to bypass strict optional check safely here
                if (userPerms && userPerms[permKey] && userPerms[permKey].view === false) {
                    return false;
                }
                return true;
            });
        }).filter(group => group.length > 0); // Remove empty groups
    }, [menuGroups, appUser]);

    return (
        <aside
            className={twMerge(
                "fixed left-0 top-0 h-full bg-bg-card border-r border-border transition-all duration-300 z-[70] flex flex-col shadow-2xl md:shadow-none",
                // Mobile Slide
                mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 px-0",
                // Desktop Width
                collapsed ? "md:w-20" : "md:w-72",
                mobileOpen && "w-72" // Force width on mobile open
            )}
        >
            {/* Brand / Logo Area */}
            <div className="h-20 flex items-center justify-center border-b border-dashed border-indigo-500/20 relative shrink-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
                <div className={clsx("absolute transition-all duration-500 ease-out transform", collapsed ? "opacity-0 scale-90" : "opacity-100 scale-100")}>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-1.5">
                        <span className="text-transparent bg-clip-text bg-gradient-to-tr from-indigo-600 to-violet-600 drop-shadow-sm">AVG</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">Flow</span>
                    </h1>
                </div>
                <div className={clsx("absolute transition-all duration-500 ease-out transform", collapsed ? "opacity-100 scale-100" : "opacity-0 scale-75")}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/40">
                        A
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto custom-scrollbar px-3">
                {filteredMenuGroups.map((group, groupIndex) => {
                    // Group Headers
                    const groupLabels = ["TỔNG QUAN", "VẬN HÀNH", "TÀI CHÍNH & NHÂN SỰ", "KHÁC"];
                    const label = groupLabels[groupIndex];

                    return (
                        <div key={groupIndex} className={clsx("flex flex-col gap-1", groupIndex > 0 && "mt-4 pt-4 border-t border-dashed border-indigo-500/10")}>
                            {!collapsed && label && (
                                <div className="px-4 mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 select-none">
                                    {label}
                                </div>
                            )}

                            {group.map((item) => {
                                const isActive = activeTab === item.id;
                                const isWish = item.id === 'my-wishes';

                                return (
                                    <Link
                                        key={item.id}
                                        to={`/${item.id}`}
                                        onClick={() => setMobileOpen && setMobileOpen(false)}
                                        className={clsx(
                                            "flex items-center px-3.5 py-3 rounded-xl transition-all duration-300 relative group overflow-hidden",
                                            (collapsed && !mobileOpen) ? "justify-center gap-0 w-12 h-12 mx-auto" : "gap-3.5",
                                            isWish
                                                ? (isActive
                                                    ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-pink-500/30 ring-2 ring-pink-400/20"
                                                    : "bg-pink-50 text-pink-600 hover:bg-pink-100 hover:scale-[1.02]")
                                                : (isActive
                                                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 scale-[1.02]"
                                                    : "text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800/60 hover:text-indigo-600 dark:hover:text-indigo-300 hover:translate-x-1")
                                        )}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        <item.icon
                                            size={20}
                                            strokeWidth={isActive ? 2.5 : 2}
                                            className={clsx(
                                                "min-w-[20px] shrink-0 transition-colors",
                                                isActive ? "text-white" : "text-current"
                                            )}
                                        />

                                        <span className={clsx(
                                            "whitespace-nowrap transition-all duration-300 font-bold text-[13px]",
                                            (collapsed && !mobileOpen) ? "opacity-0 w-0 overflow-hidden absolute" : "opacity-100 w-auto"
                                        )}>
                                            {item.label}
                                        </span>

                                        {/* Unread Wishes Badge */}
                                        {isWish && unreadWishesCount > 0 && (
                                            <span className={clsx(
                                                "flex items-center justify-center bg-white text-pink-600 text-[10px] font-black rounded-full shadow-sm ring-2 ring-pink-100",
                                                collapsed ? "absolute top-1 right-1 w-3 h-3 p-0" : "absolute right-3 w-5 h-5"
                                            )}>
                                                {!collapsed && unreadWishesCount}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    );
                })}
            </nav>

            {/* Collapse Toggle & Footer settings */}
            <div className="p-4 pb-24 md:pb-4 border-t border-border space-y-2 shrink-0">
                {/* Tet Decoration Toggle */}
                <button
                    onClick={toggleTetDecor}
                    className={clsx(
                        "w-full flex items-center p-2 rounded-lg transition-all duration-200 group",
                        collapsed ? "justify-center" : "justify-between px-3",
                        showTetDecor ? "text-yellow-500 bg-yellow-500/5 border border-yellow-500/20" : "text-text-muted hover:text-text-main hover:bg-bg-elevated border border-transparent"
                    )}
                    title={collapsed ? "Bật/Tắt không khí Tết" : undefined}
                >
                    <div className={clsx("flex items-center gap-3 transition-colors", showTetDecor && "text-yellow-500")}>
                        <Sparkles size={20} className={clsx("shrink-0", showTetDecor && "animate-pulse")} />
                        <span className={clsx("whitespace-nowrap transition-all duration-300 font-medium text-sm", collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto", showTetDecor && "bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent font-bold")}>
                            Không khí Tết
                        </span>
                    </div>

                    {!collapsed && (
                        <div className={clsx("w-8 h-4 rounded-full relative transition-colors border border-border shrink-0", showTetDecor ? "bg-red-500 shadow-sm border-red-500" : "bg-slate-300 dark:bg-slate-700")}>
                            <div className={clsx("absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm", showTetDecor ? "left-[18px]" : "left-[3px]")} />
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={clsx(
                        "w-full flex items-center p-2 rounded-lg text-text-muted hover:bg-bg-elevated hover:text-text-main transition-colors",
                        collapsed ? "justify-center" : "gap-3 px-3"
                    )}
                >
                    <Menu size={20} className="shrink-0" />
                    <span className={clsx("whitespace-nowrap transition-all duration-300", collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto text-sm")}>
                        Thu gọn
                    </span>
                </button>

                <Link
                    to="/settings"
                    onClick={() => setMobileOpen && setMobileOpen(false)}
                    className={clsx(
                        "w-full flex items-center p-2 rounded-lg transition-all duration-200",
                        collapsed ? "justify-center gap-0" : "gap-3",
                        activeTab === 'settings' ? "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 shadow-sm border border-indigo-500/10" : "text-text-muted hover:text-text-main hover:bg-bg-elevated"
                    )}
                    title="Settings"
                >
                    <Settings size={20} className="shrink-0 min-w-[20px]" />
                    <span className={clsx("whitespace-nowrap transition-all duration-300", collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto text-sm")}>
                        {t.sidebar.settings}
                    </span>
                </Link>
            </div>
        </aside>
    );
};

export default Sidebar;

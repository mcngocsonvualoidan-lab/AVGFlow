import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { CheckSquare, Megaphone, CalendarCheck, CircleDollarSign, Calendar, Home } from 'lucide-react';
import TetDecorations from './TetDecorations';
import ToastContainer from './ToastContainer';
import { useData } from '../context/DataContext';
import { clsx } from 'clsx';
import RealtimeChatWidget from './RealtimeChatWidget';
import InvitationModal from './InvitationModal';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { showTetDecor } = useData();
    const location = useLocation();
    const mainRef = React.useRef<HTMLElement>(null);

    React.useEffect(() => {
        if (mainRef.current) {
            mainRef.current.scrollTo(0, 0);
        }
    }, [location.pathname]);

    const bottomNavItems = [
        { id: 'dashboard', label: 'Tổng quan', icon: Home, path: '/dashboard' },
        { id: 'tasks', label: 'Nhiệm vụ', icon: CheckSquare, path: '/tasks' },
        { id: 'executive-directives', label: 'Điều hành', icon: Megaphone, path: '/executive-directives' },
        { id: 'timesheet', label: 'Chấm công', icon: CalendarCheck, path: '/timesheet' },
        { id: 'income', label: 'Thu nhập', icon: CircleDollarSign, path: '/income' },
        { id: 'schedule', label: 'Lịch', icon: Calendar, path: '/schedule' },
    ];

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-bg-main text-text-main font-sans selection:bg-indigo-500/30 transition-colors duration-300">
            <Sidebar
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                mobileOpen={mobileMenuOpen}
                setMobileOpen={setMobileMenuOpen}
            />

            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            <Header onMenuClick={() => setMobileMenuOpen(true)} />

            <main
                ref={mainRef}
                className={clsx(
                    "flex-1 overflow-y-auto overflow-x-hidden pt-6 px-2 md:px-6 pb-24 md:pb-6 transition-all duration-300 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700",
                    collapsed ? "md:pl-20" : "md:pl-72"
                )}
            >
                <div className="max-w-7xl mx-auto animate-fade-in-up min-h-[calc(100vh-10rem)] flex flex-col">
                    {children}
                </div>

                {/* FOOTER */}
                <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center text-xs text-text-muted font-mono">
                    <div>
                        © 2026 <span className="text-indigo-600 dark:text-indigo-400 font-bold">AVGFlow System</span>. Precision Workflow Management.
                    </div>
                    <div className="flex gap-4 mt-2 md:mt-0">
                        <span>v2.5.0 (Beta)</span>
                        <span className="hover:text-text-main cursor-pointer transition-colors">Privacy Policy</span>
                        <span className="hover:text-text-main cursor-pointer transition-colors">Support</span>
                    </div>
                </div>
            </main>

            {/* Ambient background glows - Dark Mode Only */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none hidden dark:block">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
            </div>

            {/* TẾT 2026 DECORATIONS */}
            {showTetDecor && <TetDecorations />}

            {/* INTERNAL CHAT WIDGET */}
            <RealtimeChatWidget />

            {/* SPECIAL INVITATION POPUP */}
            <InvitationModal />

            {/* TOAST ALERTS */}
            <ToastContainer />

            {/* Mobile Bottom Navigation - Enhanced Visibility */}
            <div className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 px-2 pb-2 pt-2 flex justify-between items-end z-[60] safe-area-pb shadow-[0_-5px_20px_rgba(0,0,0,0.1)] text-xs h-[80px]">
                {bottomNavItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.path);
                    return (
                        <Link
                            key={item.id}
                            to={item.path}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex-1 flex flex-col items-center justify-end h-full gap-1 group relative pb-1"
                        >
                            <div className={clsx(
                                "flex items-center justify-center transition-all duration-300 rounded-2xl",
                                isActive
                                    ? "bg-indigo-600 text-white w-12 h-12 shadow-lg shadow-indigo-500/40 mb-1"
                                    : "text-slate-400 dark:text-slate-500 group-hover:bg-slate-50 dark:group-hover:bg-white/5 w-10 h-10"
                            )}>
                                <item.icon size={isActive ? 24 : 22} strokeWidth={isActive ? 2 : 2} />
                            </div>
                            <span className={clsx(
                                "text-[10px] leading-tight transition-all duration-300 text-center",
                                isActive
                                    ? "font-bold text-indigo-700 dark:text-indigo-400 scale-105"
                                    : "font-medium text-slate-500 dark:text-slate-400"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default Layout;

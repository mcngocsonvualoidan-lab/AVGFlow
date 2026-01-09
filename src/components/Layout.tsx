import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import TetDecorations from './TetDecorations';
import ToastContainer from './ToastContainer';
import { useData } from '../context/DataContext';
import { clsx } from 'clsx';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
    const [collapsed, setCollapsed] = useState(false);
    const { showTetDecor } = useData();

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-900 text-white font-sans selection:bg-indigo-500/30">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
            />
            <Header />

            <main
                className={clsx(
                    "flex-1 overflow-y-auto pt-6 px-6 pb-20 transition-all duration-300 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent",
                    collapsed ? "pl-20" : "pl-72"
                )}
            >
                <div className="max-w-7xl mx-auto animate-fade-in-up">
                    {children}
                </div>

                {/* FOOTER */}
                <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 font-mono">
                    <div>
                        © 2025 <span className="text-indigo-400 font-bold">AVGFlow System</span>. Precision Workflow Management.
                    </div>
                    <div className="flex gap-4 mt-2 md:mt-0">
                        <span>v2.4.0 (Beta)</span>
                        <span className="hover:text-white cursor-pointer transition-colors">Privacy Policy</span>
                        <span className="hover:text-white cursor-pointer transition-colors">Support</span>
                    </div>
                </div>
            </main>

            {/* Ambient background glows */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
            </div>

            {/* TẾT 2026 DECORATIONS */}
            {showTetDecor && <TetDecorations />}

            {/* TOAST ALERTS */}
            <ToastContainer />
        </div>
    );
};

export default Layout;

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { User } from '../context/DataContext';

interface SmartIdentityPickerProps {
    users: User[];
    selectedId: string;
    onSelect: (id: string) => void;
    label?: string;
}

const SmartIdentityPicker: React.FC<SmartIdentityPickerProps> = ({ users, selectedId, onSelect, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedUser = users.find(u => u.id === selectedId) || users[0];

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getUserStatusInfo = (u: User) => {
        const now = new Date();
        const nowIso = now.toISOString();
        const todayLocal = now.toLocaleDateString('en-CA');

        // 1. Check Leaves (Red)
        if (u.leaves) {
            for (const leave of u.leaves) {
                if (leave.type === 'leave') {
                    if (todayLocal >= leave.start && todayLocal <= leave.end) {
                        return { label: "NGHỈ PHÉP", color: "text-red-400", bg: "bg-red-500/20", dot: "bg-red-500" };
                    }
                } else if (leave.type === 'absence') {
                    if (nowIso >= leave.start && nowIso <= leave.end) {
                        return { label: "VẮNG MẶT", color: "text-red-400", bg: "bg-red-500/20", dot: "bg-red-500" };
                    }
                }
            }
        }

        // 2. Check Online (Green)
        if (u.lastSeen) {
            const diff = now.getTime() - new Date(u.lastSeen).getTime();
            if (diff < 5 * 60 * 1000) {
                return { label: "ONLINE", color: "text-emerald-400", bg: "bg-emerald-500/20", dot: "bg-emerald-500" };
            }
        }

        // 3. Default (Yellow/Amber - Offline)
        return { label: "OFFLINE", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-500" };
    };

    const StatusBadge = ({ user }: { user: User }) => {
        const status = getUserStatusInfo(user);
        return (
            <div className={clsx("flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border border-white/5", status.bg, status.color)}>
                <div className={clsx("w-1.5 h-1.5 rounded-full", status.dot)} />
                {status.label}
            </div>
        );
    };

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="text-xs text-slate-400 font-semibold uppercase mb-1.5 block">{label}</label>}

            {/* Trigger Box */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-full bg-slate-900 border border-white/10 rounded-xl p-3 flex items-center justify-between transition-all duration-200 group relative overflow-hidden",
                    "hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.15)]",
                    isOpen ? "border-indigo-500 ring-1 ring-indigo-500/20" : "shadow-inner"
                )}
            >
                <div className="flex items-center gap-3 w-full overflow-hidden">
                    <img
                        src={selectedUser?.avatar || "https://ui-avatars.com/api/?name=NA&background=334155&color=fff"}
                        alt="Avatar"
                        className="w-10 h-10 rounded-lg border border-white/10 object-cover shrink-0"
                    />
                    <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center justify-between w-full mb-0.5">
                            <div className="font-bold text-slate-50 text-sm leading-tight font-sans truncate pr-2">
                                {selectedUser?.name || "Select Personnel"}
                            </div>
                            {selectedUser && <StatusBadge user={selectedUser} />}
                        </div>
                        <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider truncate">
                            {selectedUser?.alias || "N/A"}
                        </div>
                    </div>
                </div>
                <div className="pl-2">
                    <ChevronDown
                        size={18}
                        className={clsx(
                            "text-slate-400 transition-transform duration-300",
                            isOpen ? "rotate-180 text-indigo-400" : "group-hover:text-white"
                        )}
                    />
                </div>
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className={clsx(
                    "absolute top-full left-0 right-0 mt-2 z-[100]",
                    "bg-slate-950 border border-white/20 rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]",
                    "overflow-hidden flex flex-col max-h-72 overflow-y-auto custom-scrollbar",
                    "animate-in fade-in slide-in-from-top-2 duration-200"
                )}>
                    {users.map((user) => {
                        const isSelected = user.id === selectedId;
                        return (
                            <button
                                key={user.id}
                                onClick={() => {
                                    onSelect(user.id);
                                    setIsOpen(false);
                                }}
                                className={clsx(
                                    "flex items-center gap-3 p-3 w-full transition-colors text-left relative border-b border-white/5 last:border-0",
                                    "hover:bg-indigo-600/20",
                                    isSelected ? "bg-indigo-600/30" : "text-slate-300"
                                )}
                            >
                                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}

                                <img
                                    src={user.avatar}
                                    alt={user.name}
                                    className={clsx(
                                        "w-9 h-9 rounded-lg border object-cover shrink-0",
                                        isSelected ? "border-indigo-400" : "border-white/10"
                                    )}
                                />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <div className={clsx(
                                            "font-bold text-sm truncate font-sans pr-2",
                                            isSelected ? "text-white text-glow" : "text-slate-200"
                                        )}>
                                            {user.name}
                                        </div>
                                        <StatusBadge user={user} />
                                    </div>
                                    <div className="text-xs font-mono text-indigo-400 uppercase tracking-wider truncate">
                                        {user.alias}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SmartIdentityPicker;

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
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

    return (
        <div className="relative" ref={containerRef}>
            {label && <label className="text-xs text-slate-400 font-semibold uppercase mb-1.5 block">{label}</label>}

            {/* Trigger Box */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-full bg-slate-950/50 border border-white/10 rounded-xl p-3 flex items-center justify-between transition-all duration-200 group",
                    "hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.15)]",
                    // Inner shadow effect simulation with gradient or distinct border style if needed, 
                    // reusing generic shadow-inner class if available or standard utility
                    isOpen ? "border-indigo-500 ring-1 ring-indigo-500/20" : "shadow-inner"
                )}
            >
                <div className="flex items-center gap-3">
                    <img
                        src={selectedUser?.avatar || "https://ui-avatars.com/api/?name=NA&background=334155&color=fff"}
                        alt="Avatar"
                        className="w-8 h-8 rounded-lg border border-white/10 object-cover"
                    />
                    <div className="text-left">
                        <div className="font-bold text-slate-50 text-sm leading-tight font-sans">
                            {selectedUser?.name || "Select Personnel"}
                        </div>
                        <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">
                            {selectedUser?.alias || "N/A"}
                        </div>
                    </div>
                </div>
                <ChevronDown
                    size={18}
                    className={clsx(
                        "text-slate-400 transition-transform duration-300",
                        isOpen ? "rotate-180 text-indigo-400" : "group-hover:text-white"
                    )}
                />
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className={clsx(
                    "absolute top-full left-0 right-0 mt-2 z-50",
                    "bg-slate-950 border border-white/20 rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]",
                    "overflow-hidden flex flex-col max-h-64 overflow-y-auto custom-scrollbar",
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
                                    "flex items-center gap-3 p-3 w-full transition-colors text-left relative",
                                    "hover:bg-indigo-600/20", // Hover State
                                    isSelected ? "bg-indigo-600/30" : "text-slate-300" // Active Indicator
                                )}
                            >
                                {/* Active Marker Strip */}
                                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}

                                {/* Avatar */}
                                <img
                                    src={user.avatar}
                                    alt={user.name}
                                    className={clsx(
                                        "w-10 h-10 rounded-lg border object-cover shrink-0",
                                        isSelected ? "border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.3)]" : "border-white/10"
                                    )}
                                />

                                {/* Dual Typography */}
                                <div className="flex-1 min-w-0">
                                    <div className={clsx(
                                        "font-bold text-sm truncate font-sans",
                                        isSelected ? "text-white text-glow" : "text-slate-200"
                                    )}>
                                        {user.name}
                                    </div>
                                    <div className="text-xs font-mono text-indigo-400 uppercase tracking-wider truncate">
                                        {user.alias}
                                    </div>
                                </div>

                                {isSelected && <Check size={16} className="text-indigo-400 shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SmartIdentityPicker;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, X, MessageCircleHeart, ChevronDown, Sparkles } from 'lucide-react';
import MyBirthdayWishes from '../modules/hr/MyBirthdayWishes';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useLocation } from 'react-router-dom';
import { useData, ConfessionMessage } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const ConfessionWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    const { users, birthdayWishes, confessionMessages } = useData();
    const { currentUser } = useAuth();

    // Popup bubble state (mobile only)
    const [showBubble, setShowBubble] = useState(false);
    const [bubbleMessage, setBubbleMessage] = useState<ConfessionMessage | null>(null);
    const [dismissedMsgIds, setDismissedMsgIds] = useState<Set<string>>(() => {
        try {
            const stored = localStorage.getItem('dismissed_confession_bubbles');
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch { return new Set(); }
    });
    const bubbleTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
    const lastBubbleMsgRef = useRef<string>('');

    const [lastViewedConfessions, setLastViewedConfessions] = useState<number>(() => {
        const stored = localStorage.getItem('last_viewed_confessions');
        return stored ? parseInt(stored, 10) : Date.now();
    });

    useEffect(() => {
        if (isOpen || location.pathname === '/my-wishes') {
            const now = Date.now();
            setLastViewedConfessions(now);
            localStorage.setItem('last_viewed_confessions', now.toString());
        }
    }, [isOpen, location.pathname, confessionMessages.length]);

    const appUser = users.find(u => u.email === currentUser?.email);
    const unreadWishesCount = birthdayWishes.filter(w => w.toUserId === appUser?.id && !w.isRead).length;
    const unreadConfessionsCount = confessionMessages.filter(msg => new Date(msg.timestamp).getTime() > lastViewedConfessions).length;
    const totalUnread = unreadWishesCount + unreadConfessionsCount;

    // ---- MOBILE POPUP BUBBLE LOGIC ----
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    // Show bubble for latest unread confession on mobile
    useEffect(() => {
        if (!isMobile || isOpen || location.pathname === '/my-wishes') {
            setShowBubble(false);
            return;
        }

        // Find the latest confession that hasn't been dismissed
        const latestUnread = [...confessionMessages]
            .filter(msg => !dismissedMsgIds.has(msg.id) && new Date(msg.timestamp).getTime() > lastViewedConfessions)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        if (latestUnread && latestUnread.id !== lastBubbleMsgRef.current) {
            lastBubbleMsgRef.current = latestUnread.id;
            setBubbleMessage(latestUnread);
            setShowBubble(true);

            // Auto-hide after 12 seconds
            if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
            bubbleTimerRef.current = setTimeout(() => setShowBubble(false), 12000);
        }

        return () => {
            if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
        };
    }, [confessionMessages, isOpen, location.pathname, isMobile, dismissedMsgIds, lastViewedConfessions]);

    const dismissBubble = useCallback((msgId: string) => {
        setShowBubble(false);
        setDismissedMsgIds(prev => {
            const next = new Set(prev);
            next.add(msgId);
            // Keep only the last 100 dismissed IDs
            const arr = Array.from(next);
            const trimmed = arr.slice(-100);
            localStorage.setItem('dismissed_confession_bubbles', JSON.stringify(trimmed));
            return new Set(trimmed);
        });
    }, []);

    const openFromBubble = useCallback(() => {
        setShowBubble(false);
        setIsOpen(true);
    }, []);

    const formatBubbleTime = (ts: string) => {
        const d = new Date(ts);
        const now = new Date();
        const diffM = Math.floor((now.getTime() - d.getTime()) / 60000);
        if (diffM < 1) return 'Vừa xong';
        if (diffM < 60) return `${diffM} phút trước`;
        const diffH = Math.floor(diffM / 60);
        if (diffH < 24) return `${diffH} giờ trước`;
        return `${d.getDate()}/${d.getMonth() + 1}`;
    };

    // Hide widget if already on the page
    if (location.pathname === '/my-wishes') return null;

    return (
        <>
            {/* ============ MOBILE POPUP BUBBLE ============ */}
            <AnimatePresence>
                {showBubble && bubbleMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 80, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="fixed bottom-[170px] right-3 left-3 z-50 md:hidden"
                    >
                        <div className="relative bg-gradient-to-br from-pink-50 via-white to-rose-50 dark:from-slate-800 dark:via-slate-800 dark:to-pink-950/30 rounded-2xl shadow-[0_12px_40px_rgba(236,72,153,0.25)] border border-pink-200/60 dark:border-pink-800/40 p-3 backdrop-blur-xl">
                            {/* Close button */}
                            <button
                                onClick={() => dismissBubble(bubbleMessage.id)}
                                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 dark:bg-slate-700/80 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-sm"
                            >
                                <X size={12} />
                            </button>

                            {/* Header */}
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white shadow-md shadow-pink-300/30">
                                    <MessageCircleHeart size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-pink-600 dark:text-pink-400">Thông điệp yêu thương</span>
                                        <Sparkles size={10} className="text-amber-400" />
                                    </div>
                                    <span className="text-[10px] text-slate-400">{formatBubbleTime(bubbleMessage.timestamp)}</span>
                                </div>
                            </div>

                            {/* Message Content */}
                            <div className="mb-2.5">
                                <div className="flex items-start gap-2">
                                    <span className="text-lg leading-none shrink-0 mt-0.5">{bubbleMessage.anonymousEmoji}</span>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{bubbleMessage.anonymousName}</p>
                                        <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-3 leading-relaxed">{bubbleMessage.message}</p>
                                    </div>
                                </div>
                                {bubbleMessage.imageUrl && (
                                    <div className="mt-2 rounded-lg overflow-hidden border border-pink-100/50 dark:border-pink-900/30">
                                        <img src={bubbleMessage.imageUrl} alt="" className="w-full max-h-24 object-cover" />
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={openFromBubble}
                                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-pink-300/30 active:scale-95 transition-transform"
                                >
                                    <Heart size={12} className="fill-current" /> Xem tất cả
                                    {totalUnread > 0 && (
                                        <span className="bg-white/30 px-1.5 py-0.5 rounded-full text-[9px] font-black">{totalUnread}</span>
                                    )}
                                </button>
                                <button
                                    onClick={() => dismissBubble(bubbleMessage.id)}
                                    className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1 active:scale-95 transition-transform"
                                >
                                    <ChevronDown size={12} /> Ẩn
                                </button>
                            </div>

                            {/* Chat bubble tail */}
                            <div className="absolute -bottom-1.5 right-8 w-4 h-4 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-slate-800 dark:to-pink-950/30 border-r border-b border-pink-200/60 dark:border-pink-800/40 rotate-45 rounded-sm" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ============ FLOATING BUTTON ============ */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-[100px] right-4 md:bottom-8 md:right-8 w-14 h-14 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full flex items-center justify-center text-white shadow-[0_8px_30px_rgb(236,72,153,0.3)] hover:shadow-[0_8px_30px_rgb(236,72,153,0.5)] hover:scale-110 active:scale-95 transition-all duration-300 z-40 group"
            >
                <Heart size={24} className="group-hover:animate-ping absolute opacity-50" />
                <Heart size={24} className="relative z-10 fill-current" />

                {totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-white text-pink-600 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-lg border-2 border-pink-500">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}
            </button>

            {/* ============ FULL POPUP MODAL ============ */}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 md:p-12">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full h-full sm:max-w-5xl sm:h-[90vh] bg-slate-50 dark:bg-[#0f172a] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/10"
                        >
                            <button
                                onClick={() => setIsOpen(false)}
                                className={clsx(
                                    "absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 rounded-full flex items-center justify-center z-[110] transition-colors shadow-sm",
                                    "bg-white/80 dark:bg-slate-800/80 hover:bg-pink-100 hover:text-pink-500 dark:hover:bg-pink-900/50 text-slate-600 dark:text-slate-300 backdrop-blur-md border border-slate-200 dark:border-white/10"
                                )}
                            >
                                <X size={20} />
                            </button>
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 relative">
                                <MyBirthdayWishes asWidget />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ConfessionWidget;

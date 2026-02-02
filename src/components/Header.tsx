import React, { useState, useRef, useEffect } from 'react';
import { Bell, Settings, Check, Trash2, X, LogOut, ChevronDown, Shield, Gift, Send, Info, Calendar, Menu, Sun, Moon, RefreshCw } from 'lucide-react';
import { useData, Notification } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface HeaderProps {
    onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const { notifications, markAsRead, clearNotifications, users, addNotification, addBirthdayWish } = useData();
    // ... (rest of hook calls)
    const { t } = useLanguage();
    const { currentUser, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Birthday Wish Modal State
    const [showWishModal, setShowWishModal] = useState(false);
    const [wishTargetUserId, setWishTargetUserId] = useState<string | null>(null);
    const [wishMessage, setWishMessage] = useState('');
    const [wishType, setWishType] = useState<'birthday' | 'wedding' | 'funeral'>('birthday');

    // Notification Detail Modal State
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

    const notifRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    // Sorting: Newest first based on ISO timestamp
    const sortedNotifications = [...notifications].sort((a, b) => {
        const timeA = a.time ? new Date(a.time).getTime() : 0;
        const timeB = b.time ? new Date(b.time).getTime() : 0;
        return timeB - timeA;
    });
    const unreadCount = notifications.filter(n => !n.read).length;

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setShowProfileMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const userAvatar = currentUser?.photoURL || `https://ui-avatars.com/api/?name=${currentUser?.displayName || 'User'}&background=random`;
    const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

    const currentAppUser = users.find(u => u.email === currentUser?.email);
    const isAdmin = currentAppUser?.isAdmin || ['mcngocsonvualoidan@gmail.com', 'ccmartech.com@gmail.com'].includes(currentUser?.email || '');

    // Format Date Helper
    const formatTime = (isoString: string) => {
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffSeconds = Math.floor(diffMs / 1000);
            const diffMinutes = Math.floor(diffSeconds / 60);
            const diffHours = Math.floor(diffMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffDays < 3) {
                if (diffSeconds < 60) return "Vừa xong";
                if (diffMinutes < 60) return `${diffMinutes} phút trước`;
                if (diffHours < 24) return `${diffHours} giờ trước`;
                return `${diffDays} ngày trước`;
            }

            return new Intl.DateTimeFormat('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).format(date);
        } catch (e) {
            return isoString;
        }
    };

    // Helper to handle notification click
    const handleNotificationClick = (notif: Notification) => {
        markAsRead(notif.id);

        // Check if it's a birthday notification
        if (notif.id.startsWith('BIRTHDAY-TODAY-')) {
            // Extract user ID from "BIRTHDAY-TODAY-{userId}-{timestamp}"
            const parts = notif.id.split('-');
            const userId = parts[2]; // Index 2 is userId based on format

            if (userId) {
                setWishTargetUserId(userId);
                setWishType('birthday');
                setWishMessage(`Chúc mừng sinh nhật! 🎂 Chúc bạn tuổi mới thật nhiều niềm vui và thành công! ✨`);
                setShowNotifications(false);
                setShowWishModal(true);
            }
        } else if (notif.id.startsWith('BROADCAST-')) {
            // BROADCAST-{type}-{userId}-{timestamp}
            const parts = notif.id.split('-');
            const type = parts[1] as 'wedding' | 'funeral';
            const userId = parts[2];

            if (userId && (type === 'wedding' || type === 'funeral')) {
                setWishTargetUserId(userId);
                setWishType(type);
                setWishMessage(type === 'wedding'
                    ? `Chúc mừng hạnh phúc trăm năm! 💍 Chúc hai bạn sớm sinh quý tử, răng long đầu bạc! ❤️`
                    : `Xin thành kính phân ưu cùng gia đình. 🕯️ Mong bạn sớm vượt qua nỗi đau này.`);
                setShowNotifications(false);
                setShowWishModal(true);
            }
        } else {
            // Generic Notification - Show Detail Modal
            setSelectedNotification(notif);
            setShowDetailModal(true);
            setShowNotifications(false);
        }
    };

    const handleSendWish = () => {
        if (!wishTargetUserId || !wishMessage.trim()) return;

        const targetUser = users.find(u => u.id === wishTargetUserId);

        if (targetUser) {
            // Save wish to DataContext
            if (addBirthdayWish) {
                addBirthdayWish({
                    id: `WISH-${Date.now()}`,
                    fromUserId: currentAppUser?.id || 'unknown',
                    fromUserName: currentAppUser?.name || currentUser?.displayName || 'Đồng nghiệp',
                    toUserId: targetUser.id,
                    message: wishMessage,
                    timestamp: new Date().toISOString(),
                    isRead: false,
                    type: wishType
                });
            }

            // Notification for demo/system
            addNotification({
                id: `WISH-NOTIF-${Date.now()}`,
                title: '🎁 Lời chúc sinh nhật mới!',
                message: `${currentUser?.displayName || 'Đồng nghiệp'} đã gửi lời chúc đến ${targetUser.name}: "${wishMessage}"`,
                time: new Date().toISOString(),
                read: false,
                type: 'success'
            });

            alert(`Đã gửi lời chúc đến ${targetUser.name}!`);
        }

        setShowWishModal(false);
        setWishMessage('');
        setWishTargetUserId(null);
    };

    return (
        <>
            {/* Notification Detail Modal */}
            <AnimatePresence>
                {showDetailModal && selectedNotification && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className={clsx(
                                    "p-3 rounded-xl shadow-lg shrink-0",
                                    selectedNotification.type === 'alert' && "bg-red-500/20 text-red-500",
                                    selectedNotification.type === 'success' && "bg-emerald-500/20 text-emerald-500",
                                    selectedNotification.type === 'info' && "bg-blue-500/20 text-blue-500",
                                    (!selectedNotification.type || selectedNotification.type === 'error') && "bg-bg-elevated text-text-muted"
                                )}>
                                    {selectedNotification.type === 'alert' && <X size={24} />}
                                    {selectedNotification.type === 'success' && <Check size={24} />}
                                    {selectedNotification.type === 'info' && <Info size={24} />}
                                    {(!selectedNotification.type || selectedNotification.type === 'error') && <Bell size={24} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-text-main mb-1 leading-tight break-words">
                                        {selectedNotification.title}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-text-muted">
                                        <Calendar size={12} />
                                        <span>{formatTime(selectedNotification.time)}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-text-muted hover:text-text-main transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="bg-bg-main rounded-xl p-4 border border-border max-h-[300px] overflow-y-auto custom-scrollbar">
                                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
                                    {selectedNotification.message}
                                </p>
                            </div>

                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors text-sm"
                                >
                                    Đóng
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Wish Modal */}
            <AnimatePresence>
                {showWishModal && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Decorative background glow */}
                            <div className={clsx(
                                "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none",
                                wishType === 'birthday' ? "bg-pink-500/20" :
                                    wishType === 'wedding' ? "bg-yellow-500/20" : "bg-slate-500/20"
                            )} />

                            <div className="flex items-center gap-3 mb-6 relative">
                                <div className={clsx(
                                    "p-3 bg-gradient-to-br rounded-xl shadow-lg text-white",
                                    wishType === 'birthday' ? "from-pink-500 to-rose-600 shadow-pink-500/20" :
                                        wishType === 'wedding' ? "from-yellow-500 to-amber-600 shadow-yellow-500/20" :
                                            "from-slate-500 to-gray-600 shadow-slate-500/20"
                                )}>
                                    <Gift size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-text-main">
                                        {wishType === 'birthday' ? 'Gửi lời chúc sinh nhật' :
                                            wishType === 'wedding' ? 'Gửi lời chúc mừng' : 'Gửi lời chia buồn'}
                                    </h3>
                                    <p className="text-xs text-text-muted">Gửi lời nhắn đến đồng nghiệp</p>
                                </div>
                                <button
                                    onClick={() => setShowWishModal(false)}
                                    className="absolute top-0 right-0 p-2 text-text-muted hover:text-text-main rounded-lg hover:bg-bg-elevated transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="mb-6">
                                <label className="text-sm font-medium text-text-secondary mb-2 block">Lời nhắn của bạn</label>
                                <div className="relative">
                                    <textarea
                                        className={clsx(
                                            "w-full bg-bg-main border border-border rounded-xl p-4 text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 min-h-[120px] resize-none leading-relaxed",
                                            wishType === 'birthday' ? "focus:ring-pink-500/50" :
                                                wishType === 'wedding' ? "focus:ring-yellow-500/50" : "focus:ring-slate-500/50"
                                        )}
                                        value={wishMessage}
                                        onChange={(e) => setWishMessage(e.target.value)}
                                        placeholder={wishType === 'funeral' ? "Lời chia buồn..." : "Viết lời chúc ý nghĩa..."}
                                        autoFocus
                                    />
                                    <div className="absolute bottom-3 right-3 flex gap-2">
                                        {wishType === 'birthday' && (
                                            <>
                                                <button className="text-lg hover:scale-110 transition-transform" onClick={() => setWishMessage(prev => prev + " 🎂")}>🎂</button>
                                                <button className="text-lg hover:scale-110 transition-transform" onClick={() => setWishMessage(prev => prev + " 🎉")}>🎉</button>
                                                <button className="text-lg hover:scale-110 transition-transform" onClick={() => setWishMessage(prev => prev + " ❤️")}>❤️</button>
                                            </>
                                        )}
                                        {wishType === 'wedding' && (
                                            <>
                                                <button className="text-lg hover:scale-110 transition-transform" onClick={() => setWishMessage(prev => prev + " 💍")}>💍</button>
                                                <button className="text-lg hover:scale-110 transition-transform" onClick={() => setWishMessage(prev => prev + " 🥂")}>🥂</button>
                                                <button className="text-lg hover:scale-110 transition-transform" onClick={() => setWishMessage(prev => prev + " ❤️")}>❤️</button>
                                            </>
                                        )}
                                        {wishType === 'funeral' && (
                                            <>
                                                <button className="text-lg hover:scale-110 transition-transform" onClick={() => setWishMessage(prev => prev + " 🕯️")}>🕯️</button>
                                                <button className="text-lg hover:scale-110 transition-transform" onClick={() => setWishMessage(prev => prev + " 🙏")}>🙏</button>
                                                <button className="text-lg hover:scale-110 transition-transform" onClick={() => setWishMessage(prev => prev + " 🖤")}>🖤</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowWishModal(false)}
                                    className="px-4 py-2.5 text-text-muted hover:text-text-main hover:bg-bg-elevated rounded-xl transition-colors font-medium text-sm"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    onClick={handleSendWish}
                                    disabled={!wishMessage.trim()}
                                    className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <Send size={16} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                                    Gửi lời chúc
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <header className="h-16 border-b border-border flex items-center justify-between px-4 md:px-8 bg-bg-card/80 backdrop-blur-md sticky top-0 z-40">
                {/* Search Bar Removed - Use Page Level Search */}
                <div className="flex-1 flex items-center">
                    <button
                        onClick={onMenuClick}
                        className="mr-4 p-2 text-text-muted hover:text-text-main md:hidden hover:bg-bg-elevated rounded-lg transition-colors active:scale-95"
                    >
                        <Menu size={24} />
                    </button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-6">
                    {/* AI Status */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_#6366f1]" />
                        <span className="text-xs font-bold text-indigo-500 dark:text-indigo-300">{t.header.aiActive}</span>
                    </div>

                    {/* Theme Toggle Switch */}
                    <button
                        onClick={toggleTheme}
                        className={clsx(
                            "relative w-14 h-7 rounded-full p-0.5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",
                            theme === 'dark'
                                ? "bg-gradient-to-r from-indigo-600 to-purple-600"
                                : "bg-gradient-to-r from-amber-400 to-orange-400"
                        )}
                        title={theme === 'dark' ? 'Chuyển sang Light Mode' : 'Chuyển sang Dark Mode'}
                    >
                        {/* Sliding Knob */}
                        <motion.div
                            layout
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className={clsx(
                                "w-6 h-6 rounded-full shadow-lg flex items-center justify-center",
                                theme === 'dark'
                                    ? "bg-slate-800 ml-auto"
                                    : "bg-white ml-0"
                            )}
                        >
                            {theme === 'dark' ? (
                                <Moon size={14} className="text-indigo-300" />
                            ) : (
                                <Sun size={14} className="text-amber-500" />
                            )}
                        </motion.div>
                    </button>

                    {/* Refresh Button */}
                    <button
                        onClick={() => {
                            setIsRefreshing(true);
                            // Reload after animation starts
                            setTimeout(() => {
                                window.location.reload();
                            }, 300);
                        }}
                        disabled={isRefreshing}
                        className={clsx(
                            "p-2 rounded-lg transition-all duration-200",
                            isRefreshing
                                ? "text-indigo-500 bg-indigo-500/10"
                                : "text-text-muted hover:text-text-main hover:bg-bg-elevated"
                        )}
                        title="Làm mới trang (F5)"
                    >
                        <RefreshCw
                            size={18}
                            className={clsx(
                                "transition-transform",
                                isRefreshing && "animate-spin"
                            )}
                        />
                    </button>

                    {/* Icons */}
                    <div className="flex items-center gap-4 border-l border-border pl-6 relative" ref={notifRef}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className={clsx(
                                "relative transition-colors p-2 rounded-lg",
                                showNotifications ? "bg-bg-elevated text-text-main" : "text-text-muted hover:text-text-main hover:bg-bg-elevated"
                            )}
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-bg-card flex items-center justify-center">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                </span>
                            )}
                        </button>

                        {/* Notification Dropdown */}
                        <AnimatePresence>
                            {showNotifications && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute top-full right-[-4rem] sm:right-0 mt-4 w-[calc(100vw-2rem)] sm:w-96 bg-bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right ring-1 ring-black/5"
                                >
                                    <div className="p-4 border-b border-border flex justify-between items-center bg-bg-elevated/50 backdrop-blur-xl">
                                        <h3 className="font-bold text-text-main text-sm">
                                            {t.settings.notifications} ({unreadCount})
                                        </h3>
                                        {/* Only show Clear button if Admin */}
                                        {notifications.length > 0 && isAdmin && (
                                            <button
                                                onClick={clearNotifications}
                                                className="text-[10px] text-text-muted hover:text-red-500 flex items-center gap-1 transition-colors uppercase font-semibold tracking-wider"
                                            >
                                                <Trash2 size={12} /> {t.common.delete}
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-1 bg-bg-card">
                                        {notifications.length === 0 ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-text-muted">
                                                <Bell size={32} className="mb-3 opacity-20" />
                                                <p className="text-xs">{t.header.noNotifications}</p>
                                            </div>
                                        ) : (
                                            sortedNotifications.map(notif => (
                                                <div
                                                    key={notif.id}
                                                    onClick={() => handleNotificationClick(notif)}
                                                    className={clsx(
                                                        "p-3 rounded-xl transition-all cursor-pointer border relative group",
                                                        notif.read
                                                            ? "bg-transparent border-transparent opacity-60 hover:opacity-100 hover:bg-bg-elevated"
                                                            : "bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/10"
                                                    )}
                                                >
                                                    {!notif.read && <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-indigo-500 rounded-full" />}

                                                    <div className="flex items-start gap-3">
                                                        <div className={clsx(
                                                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                                                            notif.type === 'alert' && "bg-red-500/10 border-red-500/30 text-red-500",
                                                            notif.type === 'success' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-500",
                                                            notif.type === 'info' && "bg-blue-500/10 border-blue-500/30 text-blue-500",
                                                            (!notif.type || notif.type === 'error') && "bg-bg-elevated border-border text-text-muted"
                                                        )}>
                                                            {notif.type === 'alert' && <X size={14} />}
                                                            {notif.type === 'success' && <Check size={14} />}
                                                            {notif.type === 'info' && <Bell size={14} />}
                                                            {(!notif.type || notif.type === 'error') && <Bell size={14} />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className={clsx("text-sm font-bold mb-0.5", notif.read ? "text-text-muted" : "text-text-main")}>
                                                                {notif.title}
                                                            </h4>
                                                            <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed mb-1.5">{notif.message}</p>
                                                            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wide">
                                                                {formatTime(notif.time)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div >

                    {/* User Profile */}
                    < div className="relative" ref={profileRef} >
                        <div
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center gap-3 pl-2 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                            <div className="text-right hidden md:block">
                                <div className="text-sm font-bold text-text-main leading-tight flex items-center justify-end gap-1.5">
                                    {userName}
                                    {isAdmin && <Shield size={14} className="text-indigo-500 fill-indigo-500/20" />}
                                </div>
                                <div className="text-[10px] text-text-muted">
                                    {isAdmin ? <span className="text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider">Administrator</span> : 'Online'}
                                </div>
                            </div>
                            <div className={clsx(
                                "w-10 h-10 rounded-full p-0.5 relative transition-all",
                                isAdmin ? "bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" : "bg-gradient-to-tr from-slate-400 to-slate-300 dark:from-slate-700 dark:to-slate-600"
                            )}>
                                <div className="w-full h-full rounded-full bg-bg-card flex items-center justify-center overflow-hidden">
                                    <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                                </div>
                                {/* Online Dot */}
                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-bg-card rounded-full"></div>
                            </div>
                            <ChevronDown size={14} className="text-text-muted" />
                        </div>

                        {/* Profile Dropdown */}
                        <AnimatePresence>
                            {showProfileMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.1 }}
                                    className="absolute top-full right-0 mt-2 w-48 bg-bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 ring-1 ring-black/5 p-1"
                                >
                                    <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-main flex items-center gap-2 transition-colors">
                                        <Settings size={16} /> {t.settings.title}
                                    </button>
                                    <div className="my-1 border-t border-border mx-2"></div>
                                    <button
                                        onClick={logout}
                                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-2 transition-colors"
                                    >
                                        <LogOut size={16} /> {t.auth.logout}
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div >
                </div >
            </header >
        </>
    );
};

export default Header;

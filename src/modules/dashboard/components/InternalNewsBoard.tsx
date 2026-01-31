
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { db, storage } from '../../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Bell, Plus, X, Eye, Calendar, Trash2, Image as ImageIcon, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface NewsItem {
    id: string;
    title: string;
    content: string;
    priority: 'normal' | 'high' | 'urgent';
    createdAt: string;
    author: { id: string, name: string };
    readBy: string[];
    readDetails?: Record<string, string>; // Map of updateId -> timestamp ISO
    bannerUrl?: string;
    eventDate?: string; // Optional event date for countdown
}

const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
    const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = +new Date(targetDate) - +new Date();
            if (difference > 0) {
                setTimeLeft({
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60)
                });
            } else {
                setTimeLeft(null); // Expired
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);
    }, [targetDate]);

    if (!timeLeft) return null;

    if (!timeLeft) return null;

    return (
        <div className="flex items-center gap-1 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg px-3 py-2 border border-white/20 w-fit shadow-xl shadow-indigo-500/30 group-hover:scale-105 transition-all">
            <div className="flex flex-col items-center min-w-[28px]">
                <span className="text-lg font-black text-white leading-none font-mono tracking-wider tabular-nums">{String(timeLeft.days).padStart(2, '0')}</span>
                <span className="text-[9px] text-indigo-100 uppercase tracking-widest font-bold mt-0.5">Ngày</span>
            </div>
            <span className="text-white/50 font-bold -mt-3 animate-pulse">:</span>
            <div className="flex flex-col items-center min-w-[28px]">
                <span className="text-lg font-black text-white leading-none font-mono tracking-wider tabular-nums">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-[9px] text-indigo-100 uppercase tracking-widest font-bold mt-0.5">Giờ</span>
            </div>
            <span className="text-white/50 font-bold -mt-3 animate-pulse">:</span>
            <div className="flex flex-col items-center min-w-[28px]">
                <span className="text-lg font-black text-white leading-none font-mono tracking-wider tabular-nums">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="text-[9px] text-indigo-100 uppercase tracking-widest font-bold mt-0.5">Phút</span>
            </div>
            <span className="text-white/50 font-bold -mt-3 animate-pulse">:</span>
            <div className="flex flex-col items-center min-w-[28px]">
                <span className="text-lg font-black text-emerald-200 leading-none font-mono tracking-wider tabular-nums">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <span className="text-[9px] text-emerald-100 uppercase tracking-widest font-bold mt-0.5">Giây</span>
            </div>
        </div>
    );
};

const InternalNewsBoard = () => {
    const { currentUser } = useAuth();
    const { users } = useData();
    const [news, setNews] = useState<NewsItem[]>([]);
    const [isExpanded, setIsExpanded] = useState(false); // Show all vs show limited
    const [showCreateModal, setShowCreateModal] = useState(false);

    // View Details State
    // View Details State
    const [viewingItem, setViewingItem] = useState<NewsItem | null>(null);
    // const [selectedImage, setSelectedImage] = useState<string | null>(null); // Removed in favor of full detail modal

    const isAdmin = users.find(u => u.email === currentUser?.email)?.isAdmin ||
        ['mcngocsonvualoidan@gmail.com', 'ccmartech.com@gmail.com'].includes(currentUser?.email || '');

    // Form State
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newPriority, setNewPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch News
    useEffect(() => {
        const q = query(collection(db, 'internal_news'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem));
            setNews(items);
        });
        return () => unsubscribe();
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setBannerFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleCreate = async () => {
        if (!newTitle.trim() || !newContent.trim() || !currentUser) return;
        setSubmitting(true);
        try {
            let bannerUrl = '';

            // Upload Banner if exists
            if (bannerFile) {
                const storageRef = ref(storage, `news_banners/${Date.now()}_${bannerFile.name}`);
                const snapshot = await uploadBytes(storageRef, bannerFile);
                bannerUrl = await getDownloadURL(snapshot.ref);
            }

            const user = users.find(u => u.email === currentUser.email);
            await addDoc(collection(db, 'internal_news'), {
                title: newTitle,
                content: newContent,
                priority: newPriority,
                createdAt: new Date().toISOString(),
                author: {
                    id: user?.id || 'unknown',
                    name: 'Admin'
                },
                readBy: [],
                bannerUrl
            });

            // Dispatch Notifications to All Users
            const notificationPromises = users
                .filter(u => u.email !== currentUser.email) // Don't notify self
                .map(user => {
                    return addDoc(collection(db, 'notifications'), {
                        title: 'Bảng tin Nội bộ',
                        message: `Admin đã đăng thông báo mới: "${newTitle}"`,
                        time: new Date().toISOString(),
                        read: false,
                        type: newPriority === 'urgent' ? 'alert' : 'info',
                        userId: user.id // Target specific user if system supports it, or global
                    });
                });

            await Promise.all(notificationPromises);

            setShowCreateModal(false);
            setNewTitle('');
            setNewContent('');
            setNewPriority('normal');
            setBannerFile(null);
            setPreviewUrl(null);
        } catch (error) {
            console.error("Failed to post news", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Bạn chắc chắn muốn xóa tin này?")) return;
        try {
            await deleteDoc(doc(db, 'internal_news', id));
        } catch (error) {
            console.error(error);
        }
    }

    const handleRead = async (item: NewsItem) => {
        setViewingItem(item); // Open Modal

        // Mark as read / Update timestamp
        const userId = users.find(u => u.email === currentUser?.email)?.id;
        if (userId) {
            try {
                const newsRef = doc(db, 'internal_news', item.id);
                // Always update timestamp to reflect "Last Viewed"
                await updateDoc(newsRef, {
                    readBy: arrayUnion(userId),
                    [`readDetails.${userId}`]: new Date().toISOString()
                });
            } catch (err) {
                console.error("Failed to mark read", err);
            }
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'urgent': return 'bg-red-500 text-white border-red-400 shadow-red-500/20';
            case 'high': return 'bg-amber-500 text-white border-amber-400 shadow-amber-500/20';
            default: return 'bg-indigo-500 text-white border-indigo-400 shadow-indigo-500/20';
        }
    };

    const getPriorityLabel = (p: string) => {
        switch (p) {
            case 'urgent': return 'Khẩn cấp';
            case 'high': return 'Quan trọng';
            default: return 'Thông báo';
        }
    };



    // Calculate Unread
    const myId = users.find(u => u.email === currentUser?.email)?.id;
    const unreadCount = news.filter(n => myId && !n.readBy.includes(myId)).length;

    // Display Logic
    const displayNews = isExpanded ? news : news.slice(0, 3);

    return (
        <div className="w-full mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Header Section */}
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl rounded-[2rem] border border-white/20 dark:border-white/10 shadow-xl p-8 relative overflow-hidden group/board transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover/board:bg-indigo-500/15 transition-all duration-700" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 relative z-10 gap-4">
                    <div className="flex items-center gap-5 w-full md:w-auto">
                        <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/40 rounded-2xl text-white relative group cursor-pointer transition-transform hover:scale-110 shrink-0">
                            <Bell size={26} className={unreadCount > 0 ? "animate-swing" : ""} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-[11px] flex items-center justify-center text-white font-black border-[3px] border-white dark:border-slate-800 animate-bounce shadow-sm">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 flex flex-wrap items-center gap-3 leading-tight">
                                <span>Bảng tin Nội bộ</span>
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/30 whitespace-nowrap shadow-sm">
                                    {news.length} tin tức
                                </span>
                            </h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-indigo-200/70 mt-1">
                                Cập nhật thông báo và sự kiện quan trọng trong công ty
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {isAdmin && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-white dark:text-indigo-600 dark:hover:bg-indigo-50 rounded-xl transition-all font-bold shadow-lg shadow-indigo-500/30 dark:shadow-white/10 hover:shadow-indigo-500/40 dark:hover:shadow-white/20 hover:-translate-y-0.5"
                            >
                                <Plus size={20} strokeWidth={3} />
                                <span>Đăng tin</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* News List */}
                <div className="grid gap-4 relative z-10">
                    {displayNews.length === 0 ? (
                        <div className="p-12 text-center border-2 border-dashed border-slate-700/50 rounded-2xl bg-slate-800/20 backdrop-blur-sm">
                            <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                                <Bell size={32} />
                            </div>
                            <p className="text-slate-400 font-medium">Chưa có thông báo nào được đăng tải.</p>
                        </div>
                    ) : (
                        displayNews.map(item => {
                            const isRead = myId ? item.readBy.includes(myId) : false;

                            const isItemExpanded = false; // Disable expand logic

                            return (
                                <div
                                    key={item.id}
                                    className={clsx(
                                        "relative group rounded-2xl border transition-all duration-300 overflow-hidden backdrop-blur-md",
                                        isRead
                                            ? "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-700/30 hover:bg-white/60 dark:hover:bg-slate-800/50 hover:border-indigo-200/50 dark:hover:border-indigo-500/30"
                                            : "bg-white/80 dark:bg-slate-800/80 border-indigo-100 dark:border-indigo-500/30 shadow-lg shadow-indigo-500/5 hover:shadow-indigo-500/10 hover:scale-[1.01]"
                                    )}
                                >
                                    {/* Priority Left Border Strip */}
                                    <div className={clsx(
                                        "absolute top-0 bottom-0 left-0 w-1.5",
                                        item.priority === 'urgent' ? 'bg-red-500' : item.priority === 'high' ? 'bg-amber-500' : 'bg-indigo-500'
                                    )} />

                                    <div
                                        className="p-5 pl-7 cursor-pointer relative"
                                        onClick={() => handleRead(item)}
                                    >
                                        <div className="flex flex-col md:flex-row gap-4 md:items-start">
                                            {/* Left Content */}
                                            <div className="flex-1 min-w-0 order-2 md:order-1">
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    {!isRead && (
                                                        <span className="flex h-2 w-2 relative mr-1">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                        </span>
                                                    )}

                                                    <span className={clsx(
                                                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                                                        item.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-200' :
                                                            item.priority === 'high' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                                'bg-indigo-50 text-indigo-600 border-indigo-200'
                                                    )}>
                                                        {getPriorityLabel(item.priority)}
                                                    </span>

                                                    <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                                                        <span>•</span>
                                                        <Calendar size={12} />
                                                        <span>{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                                                        <span>•</span>
                                                        <span>{item.author.name}</span>
                                                    </div>
                                                </div>

                                                <h3 className={clsx(
                                                    "text-lg transition-colors leading-snug mb-2",
                                                    !isRead ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-600 dark:text-slate-400"
                                                )}>
                                                    {item.title}
                                                </h3>

                                                {/* Content Snippet */}
                                                {!isItemExpanded && (
                                                    <p className={clsx(
                                                        "text-sm line-clamp-2 leading-relaxed max-w-3xl",
                                                        !isRead ? "text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"
                                                    )}>
                                                        {item.content}
                                                    </p>
                                                )}

                                                <div className="mt-3 flex items-center gap-3">
                                                    <button className="text-xs font-bold text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 group/btn">
                                                        Xem chi tiết <ChevronDown size={14} className="-rotate-90 group-hover/btn:translate-x-1 transition-transform" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Right Content / Thumbnail / Timer */}
                                            <div className="order-1 md:order-2 shrink-0 flex flex-row md:flex-col items-center md:items-end gap-3">
                                                {(item.title.toUpperCase().includes('TẤT NIÊN') || item.title.toUpperCase().includes('YEAR END PARTY')) && (
                                                    <div className="hidden md:block scale-90 origin-top-right">
                                                        <CountdownTimer targetDate="2026-02-06T18:00:00" />
                                                    </div>
                                                )}

                                                {item.bannerUrl && (
                                                    <div className="h-full max-h-[100px] aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm relative group/img">
                                                        <img src={item.bannerUrl} alt="Banner" className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );

                        })
                    )}
                </div>

                {/* Footer / Expand Toggle */}
                {news.length > 3 && (
                    <div className="mt-4 text-center">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-300 uppercase tracking-widest hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        >
                            {isExpanded ? (
                                <>Thu gọn danh sách <ChevronUp size={14} /></>
                            ) : (
                                <>Xem thêm {news.length - 3} tin khác <ChevronDown size={14} /></>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-indigo-500/30 shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500 rounded-lg text-white shadow-lg shadow-indigo-500/20">
                                        <Plus size={24} />
                                    </div>
                                    Tạo thông báo mới
                                </h3>
                                <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors"><X size={24} /></button>
                            </div>

                            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        Tiêu đề thông báo <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={e => setNewTitle(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        placeholder="Nhập tiêu đề quan trọng..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Mức độ ưu tiên</label>
                                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700">
                                            {(['normal', 'high', 'urgent'] as const).map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setNewPriority(p)}
                                                    className={clsx(
                                                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                                                        newPriority === p
                                                            ? getPriorityColor(p)
                                                            : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5"
                                                    )}
                                                >
                                                    {getPriorityLabel(p)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            Hình ảnh / Banner
                                            <span className="text-[10px] font-normal text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-white/5">Optional</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileSelect}
                                                accept="image/*"
                                                className="hidden"
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className={clsx(
                                                    "w-full py-2.5 px-4 rounded-xl border border-dashed flex items-center justify-center gap-2 transition-all group",
                                                    bannerFile
                                                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                        : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-950 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-500"
                                                )}
                                            >
                                                {bannerFile ? (
                                                    <><ImageIcon size={18} /> {bannerFile.name}</>
                                                ) : (
                                                    <><Upload size={18} /> Tải ảnh lên</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {previewUrl && (
                                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 h-48 relative group">
                                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => {
                                                setBannerFile(null);
                                                setPreviewUrl(null);
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nội dung chi tiết <span className="text-red-500">*</span></label>
                                    <textarea
                                        value={newContent}
                                        onChange={e => setNewContent(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none h-40 resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        placeholder="Soạn thảo nội dung thông báo..."
                                    />
                                </div>
                            </div>

                            <div className="p-5 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/30">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 transition-colors"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={submitting || !newTitle || !newContent}
                                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang đăng...</>
                                    ) : (
                                        <><Plus size={18} /> Đăng tin ngay</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* News Detail Modal */}
            {
                viewingItem && (
                    <NewsDetailModal
                        item={news.find(n => n.id === viewingItem.id) || viewingItem} // Use live data from state
                        onClose={() => setViewingItem(null)}
                        users={users}
                        isAdmin={isAdmin}
                        onDelete={() => handleDelete(viewingItem.id)}
                        getPriorityColor={getPriorityColor}
                        getPriorityLabel={getPriorityLabel}
                    />
                )
            }
        </div >
    );
};

const NewsDetailModal = ({ item, onClose, users, isAdmin, onDelete, getPriorityColor, getPriorityLabel }: any) => {
    const [zoom, setZoom] = useState(1);
    const [isZooming, setIsZooming] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Zoom Handlers
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || isZooming) {
            e.preventDefault();
            e.stopPropagation();
        }
        // Allow wheel zoom on the image container
        if (containerRef.current && containerRef.current.contains(e.target as Node)) {
            e.stopPropagation();
            const delta = -e.deltaY * 0.001;
            setZoom(prev => Math.min(Math.max(1, prev + delta), 4));
        }
    };

    // Touch Zoom Logic (Pinch)
    const touchStartDist = useRef<number | null>(null);
    const startZoom = useRef<number>(1);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            touchStartDist.current = dist;
            startZoom.current = zoom;
            setIsZooming(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && touchStartDist.current !== null) {
            e.preventDefault(); // Prevent page scroll
            const dist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            const scaleFactor = dist / touchStartDist.current;
            setZoom(Math.min(Math.max(1, startZoom.current * scaleFactor), 4));
        }
    };

    const handleTouchEnd = () => {
        touchStartDist.current = null;
        setIsZooming(false);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div
                className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[95vh] relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-white/10 flex justify-between items-start bg-slate-50 dark:bg-slate-800/50 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={clsx(
                                "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border shadow-sm",
                                getPriorityColor(item.priority)
                            )}>
                                {getPriorityLabel(item.priority)}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <Calendar size={12} className="text-indigo-500 dark:text-indigo-400" />
                                {new Date(item.createdAt).toLocaleString('vi-VN')}
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-tight">{item.title}</h2>
                        <p className="text-sm text-indigo-600 dark:text-indigo-300 mt-1">Đăng bởi: {item.author.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {item.bannerUrl && (
                        <div
                            className="mb-6 bg-slate-100 dark:bg-black/50 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 relative group"
                            ref={containerRef}
                            onWheel={handleWheel}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div className="overflow-hidden w-full h-full flex items-center justify-center min-h-[300px] max-h-[500px]">
                                <img
                                    ref={imageRef}
                                    src={item.bannerUrl}
                                    alt="Banner"
                                    className="w-full h-full object-contain transition-transform duration-100 ease-linear origin-center"
                                    style={{ transform: `scale(${zoom})` }}
                                />
                            </div>

                            {/* Zoom Controls */}
                            <div className="absolute bottom-4 right-4 flex gap-2">
                                <button
                                    onClick={() => setZoom(z => Math.max(1, z - 0.5))}
                                    className="p-2 bg-white/80 dark:bg-black/60 hover:bg-white dark:hover:bg-black/80 text-slate-900 dark:text-white rounded-lg backdrop-blur shadow-sm"
                                >
                                    -
                                </button>
                                <span className="p-2 bg-white/80 dark:bg-black/60 text-slate-900 dark:text-white rounded-lg backdrop-blur text-sm font-mono min-w-[3rem] text-center flex items-center justify-center shadow-sm">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    onClick={() => setZoom(z => Math.min(4, z + 0.5))}
                                    className="p-2 bg-white/80 dark:bg-black/60 hover:bg-white dark:hover:bg-black/80 text-slate-900 dark:text-white rounded-lg backdrop-blur shadow-sm"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="text-base text-slate-700 dark:text-slate-200 whitespace-pre-line leading-8 font-light tracking-wide">
                        {item.content}
                    </div>

                    {/* Footer / Tracking */}
                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10">
                        <div className="flex items-center gap-2 mb-3">
                            <Eye size={16} className="text-indigo-500 dark:text-indigo-400" />
                            <span className="font-semibold text-slate-600 dark:text-slate-300">Đã xem ({item.readBy.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {item.readBy.map((uid: string) => {
                                const u = users.find((u: any) => u.id === uid);
                                if (!u) return null;
                                const readTime = item.readDetails?.[uid];

                                return (
                                    <div key={uid} className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 shadow-sm" title={readTime ? new Date(readTime).toLocaleString('vi-VN') : 'Đã xem'}>
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                                        <span className="font-medium">{u.name}</span>
                                        {readTime && (
                                            <span className="text-[10px] text-slate-400 border-l border-slate-300 dark:border-slate-600 pl-2 ml-1 font-mono">
                                                {new Date(readTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {' '}
                                                <span className="text-slate-500 dark:text-slate-600">
                                                    {new Date(readTime).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {isAdmin && (
                    <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/30 flex justify-end">
                        <button
                            onClick={() => {
                                if (window.confirm('Xóa tin này?')) {
                                    onDelete();
                                    onClose();
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-500 hover:text-white hover:bg-red-500 rounded-xl transition-all border border-red-500/20"
                        >
                            <Trash2 size={16} />
                            <span>Xóa tin này</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InternalNewsBoard;

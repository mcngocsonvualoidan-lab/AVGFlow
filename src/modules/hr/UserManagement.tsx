
import React, { useState, useEffect } from 'react';
import { storage, auth } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// import { doc, updateDoc, deleteDoc } from 'firebase/firestore'; // Removed as unused
import { useAuth } from '../../context/AuthContext'; // Import useAuth
import { sendInviteEmail } from '../../utils/emailService';
import {
    X, Save, RefreshCw, CreditCard, Sparkles, Cake,
    Upload, Search, Trash2, Edit2, Loader2,
    Mail, Phone, Briefcase, CheckCircle, Send,
    Copy, Download, ExternalLink
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useData, User } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';

import { DEPARTMENTS as departments, USER_SORT_ORDER } from '../../constants/common';

const BANKS = [
    { code: 'MB', name: 'MB Bank' },
    { code: 'VCB', name: 'Vietcombank' },
    { code: 'TCB', name: 'Techcombank' },
    { code: 'ACB', name: 'ACB' },
    { code: 'VPB', name: 'VPBank' },
    { code: 'TPB', name: 'TPBank' },
    { code: 'BIDV', name: 'BIDV' },
    { code: 'VIB', name: 'VIB' },
    { code: 'CTG', name: 'VietinBank' },
    { code: 'STB', name: 'Sacombank' },
    { code: 'MSB', name: 'MSB' },
    { code: 'HDB', name: 'HDBank' }
];

const UserManagement: React.FC = () => {
    const { users, addUser, updateUser, addNotification } = useData();

    // SORT USERS
    const sortedUsers = [...users].sort((a, b) => {
        const indexA = USER_SORT_ORDER.indexOf(a.name);
        const indexB = USER_SORT_ORDER.indexOf(b.name);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Both in list
        if (indexA !== -1) return -1; // A in list, B not -> A first
        if (indexB !== -1) return 1; // B in list, A not -> B first
        return a.name.localeCompare(b.name); // Neither in list -> Alphabetical
    });

    const { t } = useLanguage();
    const { currentUser } = useAuth(); // Get currentUser

    // Check real permissions
    const loggedInUser = users.find(u => (u.email || '').toLowerCase() === (currentUser?.email || '').toLowerCase());
    const isSuperAdmin = ['mcngocsonvualoidan@gmail.com', 'ccmartech.com@gmail.com'].includes((currentUser?.email || '').toLowerCase());
    const hasAdminRights = loggedInUser?.isAdmin || isSuperAdmin;

    const [showForm, setShowForm] = useState(false);
    const [showBankSelector, setShowBankSelector] = useState(false);



    // Avatar Upload State
    const [isUploading, setIsUploading] = useState(false);

    // QR Upload State
    const [isUploadingQr, setIsUploadingQr] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

    const handleSendInvite = async (user: User) => {
        if (!user.email) return alert("Nhân sự này chưa có Email!");
        if (!confirm(`Gửi email mời tham gia hệ thống cho ${user.name} (${user.email})?`)) return;

        setSendingEmailId(user.id);
        try {
            const result = await sendInviteEmail({ name: user.name, email: user.email });
            if (result.success) {
                alert(`✅ Đã gửi email mời thành công cho ${user.name}!`);
            } else {
                alert(`❌ Gửi thất bại: ${result.error}`);
            }
        } catch (error) {
            alert("Lỗi không xác định khi gửi email.");
        } finally {
            setSendingEmailId(null);
        }
    };

    const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) return alert("File QR quá lớn! Vui lòng chọn ảnh dưới 5MB.");
        if (!file.type.startsWith('image/')) return alert("Vui lòng chọn file ảnh.");

        setIsUploadingQr(true);
        try {
            const storageRef = ref(storage, `qrcodes/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setFormData(prev => ({ ...prev, customQrUrl: url }));
            alert("Đã tải mã QR lên thành công!");
        } catch (error) {
            console.error("Upload QR error:", error);
            alert("Lỗi khi tải QR lên: " + (error as any).message);
        } finally {
            setIsUploadingQr(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate
        if (file.size > 2 * 1024 * 1024) return alert("File quá lớn! Vui lòng chọn ảnh dưới 2MB.");
        if (!file.type.startsWith('image/')) return alert("Vui lòng chọn file ảnh.");

        setIsUploading(true);
        try {
            // Create a reference
            const storageRef = ref(storage, `avatars/${Date.now()}_${file.name}`);
            // Upload
            await uploadBytes(storageRef, file);
            // Get URL
            const url = await getDownloadURL(storageRef);

            setFormData(prev => ({ ...prev, avatar: url }));
        } catch (error) {
            console.error("Upload error:", error);
            alert("Lỗi khi tải ảnh lên: " + (error as any).message);
        } finally {
            setIsUploading(false);
        }
    };



    const [selectedQR, setSelectedQR] = useState<User | null>(null);

    // Scroll Container Ref
    const containerRef = React.useRef<HTMLDivElement>(null);

    const [searchQuery, setSearchQuery] = useState('');

    // Edit & Feedback State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [highlightId, setHighlightId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<User>>({
        avatar: 'https://ui-avatars.com/api/?name=New+User&background=random',
        dept: 'Kinh doanh',
        verified: true
    });

    // Effect to clear highlight
    useEffect(() => {
        if (highlightId) {
            const timer = setTimeout(() => setHighlightId(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [highlightId]);

    // Birthday notification helper
    const getDaysUntilBirthday = (dob: string): number => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset to start of day

        const birthday = new Date(dob);

        // Set birthday to this year
        const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
        thisYearBirthday.setHours(0, 0, 0, 0);

        // Calculate difference
        const diffTime = thisYearBirthday.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // If birthday already passed this year, calculate for next year
        if (diffDays < 0) {
            const nextYearBirthday = new Date(today.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
            nextYearBirthday.setHours(0, 0, 0, 0);
            return Math.round((nextYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        return diffDays;
    };

    // Check for birthdays (runs once on mount)
    useEffect(() => {
        // Small delay to ensure notifications are added after initial render
        const timer = setTimeout(() => {
            users.forEach(user => {
                if (!user.dob) return;

                const daysUntil = getDaysUntilBirthday(user.dob);

                if (daysUntil === 0) {
                    // TODAY IS BIRTHDAY!
                    addNotification({
                        id: `BIRTHDAY - TODAY - ${user.id}`,
                        title: '🎂 CHÚC MỪNG SINH NHẬT!',
                        message: `Hôm nay là sinh nhật của ${user.name} (${user.dept})! Hãy gửi lời chúc tốt đẹp nhé! 🎉🎊`,
                        time: new Date().toISOString(),
                        read: false,
                        type: 'success'
                    });
                } else if (daysUntil > 0 && daysUntil <= 3) {
                    // BIRTHDAY COMING SOON (within 3 days)
                    addNotification({
                        id: `BIRTHDAY - SOON - ${user.id}`,
                        title: '🎈 Sinh nhật sắp đến!',
                        message: `Còn ${daysUntil} ngày nữa là sinh nhật của ${user.name} (${user.dept}). Đừng quên chuẩn bị nhé!`,
                        time: new Date().toISOString(),
                        read: false,
                        type: 'info'
                    });
                }
            });
        }, 500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRandomAvatar = () => {
        const randomColor = Math.floor(Math.random() * 16777215).toString(16);
        setFormData({ ...formData, avatar: `https://ui-avatars.com/api/?name=${formData.name || 'User'}&background=${randomColor}&color=fff` });
    };

    // Generate Alias code if needed
    const generateAlias = (name: string) => {
        if (!name) return '';
        const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
        const parts = normalized.trim().split(' ');
        const last = parts[parts.length - 1];
        const randomNum = Math.floor(100 + Math.random() * 900);
        return `${last}-${randomNum}`.toUpperCase();
    };

    // --- REMOVED: handleEdit & handleDelete (Now Read-Only in App) ---

    const handleSave = async (e?: any) => {
        if (isSaving) return;
        if (e && e.preventDefault) e.preventDefault();

        const isCreating = !editingId;
        const currentUser = users.find(u => u.email === auth.currentUser?.email);
        const hasAdminRights = currentUser?.isAdmin || currentUser?.email === 'mcngocsonvualoidan@gmail.com'; // Hardcoded override as requested before

        if (isCreating && !hasAdminRights) return alert("⚠️ Chỉ Admin mới được tạo nhân sự mới.");

        if (editingId) {
            const editingUser = users.find(u => u.id === editingId);
            const isMe = (currentUser?.email || '').toLowerCase() === (editingUser?.email || '').toLowerCase();
            if (!hasAdminRights && !isMe) return alert("⚠️ Bạn không có quyền chỉnh sửa người này.");
        }

        if (!formData.name || formData.name.trim() === '') {
            alert(t.users.alerts.nameRequired);
            return;
        }

        const finalAlias = formData.alias || generateAlias(formData.name);

        // Preserve original data
        let originalUser: User | undefined;
        if (editingId) {
            originalUser = users.find(u => u.id === editingId);
        }

        const completeUserData: User = {
            // 1. Defaults
            role: 'Nhân viên',
            dept: 'Kinh doanh',
            email: '',
            phone: '',
            isAdmin: false,
            verified: true,

            // 2. Spread Original (Safe Keep)
            ...(originalUser || {}),

            // 3. Spread Form Data (Overwrite)
            ...formData,

            // 4. Force Critical Fields (Last one wins)
            id: editingId || Date.now().toString(),
            name: formData.name || originalUser?.name || '',
            alias: finalAlias,
            avatar: formData.avatar ?? originalUser?.avatar ?? '',
            bankAcc: formData.bankAcc ?? originalUser?.bankAcc ?? '',
            bankName: formData.bankName ?? originalUser?.bankName ?? '',
        };

        // Ensure Avatar fallback
        if (!completeUserData.avatar) {
            completeUserData.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(completeUserData.name || 'User')}&background=random`;
        }

        setIsSaving(true);
        try {
            // 10-second timeout race
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Quá thời gian xử lý. Vui lòng kiểm tra lại kết nối!')), 10000)
            );

            if (editingId) {
                // UPDATE EXISTING
                await Promise.race([updateUser(completeUserData), timeoutPromise]);
                setHighlightId(editingId);
                alert(t.users.alerts.updateSuccess);
            } else {
                // CREATE NEW
                await Promise.race([addUser(completeUserData), timeoutPromise]);
                setHighlightId(completeUserData.id);
                alert(t.users.alerts.addSuccess);
            }

            // RESET
            setShowForm(false);
            setEditingId(null);
            setFormData({
                avatar: 'https://ui-avatars.com/api/?name=New User&background=random',
                dept: 'Kinh doanh',
                verified: true,
                customQrUrl: undefined
            });
        } catch (error: any) {
            console.error('Save failed:', error);
            alert('Lỗi lưu dữ liệu: ' + (error.message || 'Không xác định'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({
            avatar: 'https://ui-avatars.com/api/?name=New+User&background=random',
            dept: 'Kinh doanh',
            verified: true,
            customQrUrl: undefined
        });
    };

    const getUserStatusColor = (user: User) => {
        const now = new Date();
        const nowIso = now.toISOString();

        if (user.leaves) {
            for (const leave of user.leaves) {
                if (leave.type === 'leave') {
                    // Check if today (local YYYY-MM-DD) is in range
                    const todayLocal = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
                    if (todayLocal >= leave.start && todayLocal <= leave.end) return "bg-red-500 shadow-[0_0_10px_#ef4444]";
                } else if (leave.type === 'absence') {
                    if (nowIso >= leave.start && nowIso <= leave.end) return "bg-red-500 shadow-[0_0_10px_#ef4444]";
                }
            }
        }

        if (user.lastSeen) {
            const diff = now.getTime() - new Date(user.lastSeen).getTime();
            if (diff < 5 * 60 * 1000) return "bg-emerald-500 shadow-[0_0_10px_#10b981]"; // 5 mins
        }

        return "bg-amber-400 shadow-[0_0_10px_#fbbf24] opacity-80";
    };

    return (
        <div ref={containerRef} className="flex flex-col bg-white/50 dark:bg-slate-800/50 backdrop-blur-3xl rounded-[3rem] p-6 md:p-8 shadow-2xl border border-white/20 ring-1 ring-white/20">

            {/* 1. HERO BANNER & STATS */}
            <div className="relative rounded-3xl overflow-hidden mb-10 shadow-2xl">
                {/* Background Gradient & Effects */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 mix-blend-overlay"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl -ml-10 -mb-10 mix-blend-overlay"></div>
                </div>

                <div className="relative z-10 p-8 md:p-10 text-white">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-widest border border-white/10">
                                    HR Management
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-sm">
                                {t.users.title}
                            </h1>
                            <p className="text-blue-100 font-medium max-w-xl text-lg opacity-90">
                                {t.users.subtitle}
                            </p>
                        </div>

                        {/* Top Actions */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            {hasAdminRights && (
                                <button
                                    onClick={async () => {
                                        const excludedNames = ['Phan Hải', 'Quỳnh Nga', 'Thị Hào'];
                                        const targetUsers = users.filter(u =>
                                            u.email &&
                                            !excludedNames.some(ex => u.name.toLowerCase().includes(ex.toLowerCase()))
                                        );

                                        if (confirm(`Bạn có chắc muốn gửi email mời đăng nhập cho ${targetUsers.length} nhân sự (Đã trừ: ${excludedNames.join(', ')})?`)) {
                                            let count = 0;
                                            for (const u of targetUsers) {
                                                try {
                                                    await sendInviteEmail({ name: u.name, email: u.email });
                                                    count++;
                                                } catch (err) {
                                                    console.error(`Failed for ${u.email}`, err);
                                                }
                                            }
                                            alert(`✅ Đã gửi thành công ${count}/${targetUsers.length} email!`);
                                        }
                                    }}
                                    className="group relative px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold shadow-xl overflow-hidden transition-all hover:scale-105 active:scale-95"
                                >
                                    <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative flex items-center gap-2">
                                        <Mail size={18} className="group-hover:rotate-12 transition-transform" />
                                        <span>GỬI MỜI HÀNG LOẠT</span>
                                    </div>
                                </button>
                            )}
                            {hasAdminRights && (
                                <button
                                    onClick={() => {
                                        setEditingId(null);
                                        setFormData({
                                            avatar: 'https://ui-avatars.com/api/?name=New+User&background=random',
                                            dept: 'Kinh doanh',
                                            verified: true,
                                            customQrUrl: undefined
                                        });
                                        setShowForm(true);
                                    }}
                                    className="px-6 py-3 bg-indigo-500/30 backdrop-blur-md border border-white/30 rounded-xl font-bold hover:bg-white/20 transition-all flex items-center gap-2"
                                >
                                    <Upload size={18} />
                                    <span>THÊM NHÂN SỰ</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-200">
                                    <Briefcase size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-blue-200 uppercase font-bold tracking-wider">Tổng nhân sự</p>
                                    <p className="text-2xl font-black">{users.length}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-200">
                                    <CheckCircle size={20} />
                                </div>
                                <div>
                                    <p className="text-xs text-emerald-200 uppercase font-bold tracking-wider">Chính thức</p>
                                    <p className="text-2xl font-black">{users.filter(u => u.verified).length}</p>
                                </div>
                            </div>
                        </div>
                        {/* Search in Banner */}
                        <div className="col-span-2 bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/10 flex items-center px-4 gap-3 focus-within:bg-white/20 transition-all">
                            <Search size={20} className="text-white/50" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm nhân sự theo tên, email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none outline-none text-white placeholder-white/50 w-full h-full font-medium"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. MODAL FORM PANEL */}
            <AnimatePresence>
                {showForm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={handleCancel}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-slate-900 border border-indigo-500/30 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative z-50 custom-scrollbar flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-slate-900/95 backdrop-blur z-20">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Edit2 size={20} className="text-indigo-400" />
                                        {editingId ? 'CẬP NHẬT HỒ SƠ NHÂN SỰ' : 'THÊM MỚI NHÂN SỰ'}
                                    </h2>
                                    <p className="text-slate-400 text-xs mt-1">
                                        {editingId ? 'Chỉnh sửa thông tin chi tiết.' : 'Nhập thông tin cho nhân sự mới.'}
                                    </p>
                                </div>
                                <button onClick={handleCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body - Grid Layout */}
                            <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-8">

                                {/* 1. Avatar Column (Left) */}
                                <div className="md:col-span-4 flex flex-col items-center gap-6 border-r border-border pr-4">
                                    <div className="relative group/avatar cursor-pointer">
                                        <div className="w-40 h-40 rounded-full border-4 border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)] overflow-hidden">
                                            <img src={formData.avatar} className="w-full h-full object-cover" />
                                        </div>
                                        {isUploading && (
                                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                                <Loader2 size={32} className="text-white animate-spin" />
                                            </div>
                                        )}
                                        <label className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-full flex flex-col items-center justify-center text-white text-xs font-bold uppercase tracking-wider cursor-pointer backdrop-blur-sm">
                                            <Upload size={24} className="mb-2" />
                                            Tải ảnh lên
                                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                                        </label>
                                    </div>
                                    <button onClick={handleRandomAvatar} className="text-xs flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white transition-colors px-3 py-1.5 rounded-full shadow-sm">
                                        <RefreshCw size={12} /> Random Avatar
                                    </button>

                                    {/* Permission Toggles (Admin Only) */}
                                    {hasAdminRights && (
                                        <div className="w-full space-y-3 mt-4 bg-bg-elevated p-4 rounded-xl border border-border">
                                            <h3 className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-2">Quyền & Trạng thái</h3>

                                            <label className="flex items-center justify-between cursor-pointer group">
                                                <span className="text-sm font-medium text-text-main group-hover:text-indigo-500 transition-colors">Admin Access</span>
                                                <div className={clsx("w-10 h-5 rounded-full relative transition-colors", formData.isAdmin ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-700")}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.isAdmin || false}
                                                        onChange={e => setFormData({ ...formData, isAdmin: e.target.checked })}
                                                        className="hidden"
                                                    />
                                                    <div className={clsx("absolute top-1 w-3 h-3 rounded-full bg-white transition-all shadow-sm", formData.isAdmin ? "left-6" : "left-1")} />
                                                </div>
                                            </label>

                                            <label className="flex items-center justify-between cursor-pointer group">
                                                <span className="text-sm font-medium text-text-main group-hover:text-emerald-500 transition-colors">Đã xác minh</span>
                                                <div className={clsx("w-10 h-5 rounded-full relative transition-colors", formData.verified ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.verified !== false}
                                                        onChange={e => setFormData({ ...formData, verified: e.target.checked })}
                                                        className="hidden"
                                                    />
                                                    <div className={clsx("absolute top-1 w-3 h-3 rounded-full bg-white transition-all shadow-sm", formData.verified ? "left-6" : "left-1")} />
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* 2. Fields Column (Right) */}
                                <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="col-span-2">
                                        <label className="text-xs text-text-muted font-bold uppercase tracking-wider mb-1 block">{t.users.form.name}</label>
                                        <input
                                            value={formData.name || ''}
                                            onChange={e => {
                                                const newName = e.target.value;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    name: newName,
                                                    alias: (!editingId) ? generateAlias(newName) : prev.alias
                                                }));
                                            }}
                                            className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-text-main outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium"
                                            placeholder="Nhập họ và tên..."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-amber-500 font-bold uppercase tracking-wider mb-1 block flex justify-between">{t.users.form.alias} <Sparkles size={12} /></label>
                                        <input
                                            value={formData.alias || ''}
                                            onChange={e => setFormData({ ...formData, alias: e.target.value.toUpperCase() })}
                                            className="w-full bg-slate-800/50 border border-amber-500/30 rounded-xl px-4 py-2.5 text-amber-400 font-mono focus:border-amber-500 outline-none"
                                            placeholder="Auto-generated"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-text-muted font-bold uppercase tracking-wider mb-1 block">{t.users.form.dept}</label>
                                        <select
                                            value={formData.dept}
                                            onChange={e => setFormData({ ...formData, dept: e.target.value })}
                                            className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-2.5 text-text-main focus:border-indigo-500 outline-none appearance-none"
                                        >
                                            {departments.map(d => <option key={d} className="bg-bg-card text-text-main">{d}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">{t.users.form.role}</label>
                                        <input
                                            value={formData.role || ''}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Mã nhân viên</label>
                                        <input
                                            value={formData.employeeCode || ''}
                                            onChange={e => setFormData({ ...formData, employeeCode: e.target.value })}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 outline-none font-mono"
                                            placeholder="NV..."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Số Hợp Đồng</label>
                                        <input
                                            value={formData.contractNo || ''}
                                            onChange={e => setFormData({ ...formData, contractNo: e.target.value })}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 outline-none font-mono"
                                            placeholder="HD/..."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1 block">Ngày vào làm</label>
                                        <input
                                            type="date"
                                            value={formData.startDate || ''}
                                            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Email</label>
                                        <input
                                            type="email"
                                            value={formData.email || ''}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Số điện thoại</label>
                                        <input
                                            type="tel"
                                            value={formData.phone || ''}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1 block">Ngân hàng (Auto QR)</label>
                                        <select
                                            value={formData.bankName || ''}
                                            onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-emerald-300 font-mono focus:border-emerald-500 outline-none appearance-none"
                                        >
                                            <option value="">-- Chọn ngân hàng --</option>
                                            {BANKS.map(b => (
                                                <option key={b.code} value={b.code} className="bg-slate-900">{b.code} - {b.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-span-1 md:col-span-2 bg-slate-800/30 p-4 rounded-xl border border-dashed border-slate-700 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-white rounded-lg p-1 flex items-center justify-center overflow-hidden">
                                                {formData.customQrUrl ? (
                                                    <img src={formData.customQrUrl} className="w-full h-full object-contain" />
                                                ) : (
                                                    <CreditCard size={24} className="text-slate-400" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">Mã QR Tùy chỉnh (Tùy chọn)</p>
                                                <p className="text-xs text-slate-400">Tải lên nếu mã tự động bị lỗi.</p>
                                            </div>
                                        </div>
                                        <label className={clsx("px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-white cursor-pointer transition-colors flex items-center gap-2", isUploadingQr && "opacity-50 pointer-events-none")}>
                                            <Upload size={14} />
                                            {isUploadingQr ? 'Đang tải...' : 'Upload QR'}
                                            <input type="file" className="hidden" accept="image/*" onChange={handleQrUpload} />
                                        </label>
                                        {formData.customQrUrl && (
                                            <button
                                                onClick={() => setFormData({ ...formData, customQrUrl: '' })}
                                                className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                                title="Xóa QR tùy chỉnh"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1 block">Số tài khoản</label>
                                        <input
                                            value={formData.bankAcc || ''}
                                            onChange={e => setFormData({ ...formData, bankAcc: e.target.value })}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-emerald-300 font-mono focus:border-emerald-500 outline-none"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="text-xs text-pink-400 font-bold uppercase tracking-wider mb-1 block flex gap-2 items-center"><Sparkles size={12} /> Sinh nhật (Dùng để thông báo)</label>
                                        <input
                                            type="date"
                                            value={formData.dob || ''}
                                            onChange={e => setFormData({ ...formData, dob: e.target.value })}
                                            className="w-full bg-slate-800/50 border border-pink-500/30 rounded-xl px-4 py-2.5 text-pink-200 focus:border-pink-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-white/10 flex justify-end gap-3 sticky bottom-0 bg-slate-900/95 backdrop-blur z-20">
                                <button
                                    onClick={handleCancel} // Using defined handleCancel
                                    className="px-6 py-3 rounded-xl font-bold bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
                                >
                                    {t.common.cancel}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    {isSaving ? 'Đang lưu...' : t.common.save}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 3. USER LIST BY DEPARTMENT */}
            <div className="space-y-12">
                {departments.map((deptName) => {
                    const deptUsers = sortedUsers.filter(u => u.dept === deptName && (
                        !searchQuery ||
                        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
                    ));

                    if (deptUsers.length === 0) return null;

                    return (
                        <div key={deptName} className="relative">
                            {/* Sticky Dept Header */}
                            <div className="sticky top-0 z-30 flex items-center gap-4 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md py-4 mb-6 border-b border-dotted border-indigo-200 dark:border-indigo-900/50">
                                <div className="w-2 h-8 rounded-r-lg bg-gradient-to-b from-indigo-500 to-purple-500" />
                                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{deptName}</h2>
                                <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-500/30">
                                    {deptUsers.length} MEMBERS
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                                <AnimatePresence>
                                    {deptUsers.map(user => (
                                        <motion.div
                                            key={user.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className={clsx(
                                                "relative group rounded-3xl p-[1px] bg-gradient-to-br from-white/20 to-white/5 dark:from-white/10 dark:to-white/5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/20",
                                                highlightId === user.id ? "ring-2 ring-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.3)]" : ""
                                            )}
                                        >
                                            <div className="h-full w-full bg-white/90 dark:bg-slate-900/90 rounded-[23px] relative overflow-hidden flex flex-col">
                                                {/* Decorative Header */}
                                                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 blur-xl pointer-events-none" />

                                                {/* Admin Actions */}
                                                <div className="absolute top-3 right-3 flex gap-2 z-20">
                                                    {/* Edit Button (For Admin or Self) - ONLY show if Admin rights */}
                                                    {(hasAdminRights || (currentUser?.email === user.email)) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingId(user.id);
                                                                setFormData(user);
                                                                setShowForm(true);
                                                            }}
                                                            className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-lg shadow-sm hover:shadow-lg text-slate-400 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                    )}
                                                    {hasAdminRights && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleSendInvite(user); }}
                                                            disabled={sendingEmailId === user.id}
                                                            className="p-2 bg-emerald-600 text-white rounded-lg shadow-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                                                            title="Gửi email mời"
                                                        >
                                                            {sendingEmailId === user.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Main Content */}
                                                <div className="p-5 flex gap-5 flex-1 relative z-10">
                                                    {/* Left Info */}
                                                    <div className="flex-1 min-w-0">
                                                        {/* Header */}
                                                        <div className="flex items-start gap-4 mb-4">
                                                            <div className="relative shrink-0">
                                                                <div className="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
                                                                    <img src={user.avatar} className="w-full h-full rounded-[14px] object-cover bg-white" />
                                                                </div>
                                                                <div className={clsx("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 shadow-sm z-10", getUserStatusColor(user))} />
                                                            </div>
                                                            <div className="min-w-0 pt-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h3 className="font-bold text-slate-800 dark:text-white text-lg font-sans leading-tight line-clamp-2">{user.name}</h3>
                                                                    {user.isAdmin && <span className="shrink-0 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200 font-bold">ADMIN</span>}
                                                                </div>
                                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-md text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider font-mono border border-slate-200 dark:border-slate-700">
                                                                    <span className="opacity-50">#</span>{user.alias}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Contact Stats */}
                                                        <div className="flex flex-col gap-1.5 mb-4">
                                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer group/link min-w-0">
                                                                <Mail size={14} className="text-slate-400 group-hover/link:text-indigo-500 shrink-0" />
                                                                <span className="truncate">{user.email}</span>
                                                            </div>
                                                            {user.phone && (
                                                                <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer group/link min-w-0">
                                                                    <Phone size={14} className="text-slate-400 group-hover/link:text-indigo-500 shrink-0" />
                                                                    <span className="truncate">{user.phone}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Modern Pills (Birthday & Work) */}
                                                        {(user.dob || user.startDate) && (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                                                {/* Birthday Pill */}
                                                                {user.dob && (() => {
                                                                    const daysUntil = getDaysUntilBirthday(user.dob);
                                                                    const isBirthdayToday = daysUntil === 0;
                                                                    return (
                                                                        <div className={clsx(
                                                                            "relative overflow-hidden rounded-xl p-2.5 border transition-all flex flex-col gap-1",
                                                                            isBirthdayToday ? "bg-pink-50 border-pink-200 shadow-sm" : "bg-slate-50 border-slate-100"
                                                                        )}>
                                                                            <div className="text-[9px] font-bold uppercase text-pink-500 flex items-center gap-1">
                                                                                <Cake size={10} /> {isBirthdayToday ? "Hôm nay!" : "Ngày sinh"}
                                                                            </div>
                                                                            <div className="font-bold text-slate-700 text-sm">
                                                                                {new Date(user.dob).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })()}

                                                                {/* Work Pill */}
                                                                {user.startDate && (() => {
                                                                    const startDate = new Date(user.startDate);
                                                                    const now = new Date();
                                                                    let years = now.getFullYear() - startDate.getFullYear();
                                                                    let months = now.getMonth() - startDate.getMonth();
                                                                    let days = now.getDate() - startDate.getDate();
                                                                    if (days < 0) { months--; days += 30; }
                                                                    if (months < 0) { years--; months += 12; }
                                                                    return (
                                                                        <div className="relative overflow-hidden rounded-xl p-2.5 border border-slate-100 bg-slate-50 transition-all flex flex-col gap-1">
                                                                            <div className="text-[9px] font-bold uppercase text-emerald-500 flex items-center gap-1">
                                                                                <Briefcase size={10} /> THỜI GIAN LÀM VIỆC
                                                                            </div>
                                                                            <div className="font-bold text-slate-700 text-sm break-words">
                                                                                {years > 0 ? `${years} Năm ` : ''}{months > 0 ? `${months} Tháng ` : ''}
                                                                                {days > 0 ? `${days} Ngày` : ''}
                                                                                {years === 0 && months === 0 && days === 0 ? 'Vừa bắt đầu' : ''}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })()}
                                                            </div>
                                                        )}

                                                        {/* Bank Info */}
                                                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3 group/bank hover:border-indigo-200 transition-colors">
                                                            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-500">
                                                                <CreditCard size={14} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-[9px] uppercase font-bold text-slate-400">Tài khoản</div>
                                                                <div className="flex flex-col items-start gap-0.5 mt-0.5">
                                                                    <span className="text-xs font-bold text-slate-700">{user.bankName}</span>
                                                                    <span className="text-xs font-mono text-slate-500 tracking-wider text-[11px] break-all">{user.bankAcc}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right QR */}
                                                    <div className="w-24 shrink-0 flex flex-col gap-2">
                                                        <div className="w-full aspect-square bg-white rounded-xl p-2 border border-slate-100 shadow-sm relative group/qr cursor-pointer"
                                                            onClick={(e) => { e.stopPropagation(); setSelectedQR(user); }}
                                                        >
                                                            <img
                                                                src={`https://img.vietqr.io/image/${user.bankName}-${user.bankAcc}-compact2.png?amount=&addInfo=&accountName=${encodeURIComponent(user.name)}`}
                                                                className="w-full h-full object-contain mix-blend-multiply"
                                                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=QR+Error' }}
                                                            />
                                                        </div>
                                                        <div className="text-center">
                                                            <span className="text-[9px] font-bold text-indigo-500 uppercase cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); setSelectedQR(user); }}>
                                                                Phóng to
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Footer Status */}
                                                <div className="border-t border-slate-100 bg-slate-50/50 py-2 px-5 flex justify-between items-center text-[10px] font-bold uppercase text-slate-400">
                                                    <span>Trạng thái</span>
                                                    <div className={clsx("flex items-center gap-1", user.verified ? "text-emerald-500" : "text-slate-400")}>
                                                        {user.verified && <CheckCircle size={10} />}
                                                        {user.verified ? 'Đã xác thực' : 'Chưa xác thực'}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 5. QR ZOOM MODAL */}
            <AnimatePresence>
                {selectedQR && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-4"
                        onClick={() => setSelectedQR(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-[0_0_50px_rgba(255,255,255,0.1)] relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setSelectedQR(null)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                            >
                                <X size={24} />
                            </button>

                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900 font-sans">Thông tin thanh toán</h3>
                                <p className="text-sm text-slate-500 mt-1">Quét mã để chuyển khoản nhanh</p>
                            </div>

                            <div className="bg-white p-4 rounded-xl mb-6 shadow-inner border border-slate-100">
                                <img
                                    src={selectedQR.customQrUrl || `https://img.vietqr.io/image/${selectedQR.bankName}-${selectedQR.bankAcc}-compact2.png?amount=&addInfo=&accountName=${encodeURIComponent(selectedQR.name)}`}
                                    className="w-full rounded-lg mix-blend-multiply"
                                    alt="QR Pay"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-500">Chủ tài khoản</span>
                                    <span className="font-bold text-slate-800 uppercase font-sans">{selectedQR.name}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-500">{t.users.form.bank}</span>
                                    <span className="font-bold text-slate-800 flex items-center gap-1 font-sans">
                                        <CreditCard size={14} className="text-indigo-600" /> {selectedQR.bankName}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-slate-500">{t.users.form.accNum}</span>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-mono font-bold text-xl text-indigo-600 tracking-wider break-all text-right">
                                            {selectedQR.bankAcc}
                                        </span>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(selectedQR.bankAcc);
                                                alert("Đã sao chép số tài khoản!");
                                            }}
                                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Sao chép"
                                        >
                                            <Copy size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* ACTION BUTTONS */}
                                <div className="grid grid-cols-2 gap-3 pt-4 mt-2 border-t border-slate-100">
                                    <button
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = `https://img.vietqr.io/image/${selectedQR.bankName}-${selectedQR.bankAcc}-print.png?amount=&addInfo=&accountName=${encodeURIComponent(selectedQR.name)}`;
                                            link.download = `QR-${selectedQR.name}.png`;
                                            link.click();
                                        }}
                                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors"
                                    >
                                        <Download size={18} /> Tải QR
                                    </button>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(selectedQR.bankAcc);
                                            setShowBankSelector(true);
                                        }}
                                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
                                    >
                                        <ExternalLink size={18} /> Chuyển tiền
                                    </button>
                                </div>
                                <p className="text-[10px] text-center text-slate-400 italic mt-2">
                                    *Chọn Ngân hàng của bạn để mở ứng dụng.
                                </p>
                            </div>

                            {/* BANK APP SELECTOR OVERLAY */}
                            <AnimatePresence>
                                {showBankSelector && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="absolute inset-0 bg-white z-30 flex flex-col p-4 rounded-[2rem]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                                            <h4 className="font-bold text-slate-800">Chọn Ngân hàng của bạn</h4>
                                            <button
                                                onClick={() => setShowBankSelector(false)}
                                                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
                                            <div className="grid grid-cols-3 gap-3">
                                                {[
                                                    { name: 'MB Bank', scheme: 'mbmobile://', color: 'bg-blue-600' },
                                                    { name: 'Vietcombank', scheme: 'vcbdigibank://', color: 'bg-green-600' },
                                                    { name: 'Techcombank', scheme: 'techcombankmobile://', color: 'bg-red-600' },
                                                    { name: 'VietinBank', scheme: 'vietinbankipay://', color: 'bg-blue-700' },
                                                    { name: 'BIDV', scheme: 'bidvsmartbanking://', color: 'bg-emerald-600' },
                                                    { name: 'VPBank', scheme: 'vpbankneo://', color: 'bg-green-500' },
                                                    { name: 'ACB', scheme: 'acbapp://', color: 'bg-blue-500' },
                                                    { name: 'TPBank', scheme: 'tpbankmobile://', color: 'bg-purple-600' },
                                                    { name: 'VIB', scheme: 'vibmobile://', color: 'bg-blue-400' },
                                                    { name: 'MSB', scheme: 'msbmobile://', color: 'bg-orange-500' },
                                                    { name: 'Sacombank', scheme: 'sacombankpay://', color: 'bg-blue-800' },
                                                    { name: 'MoMo', scheme: 'momo://', color: 'bg-pink-600' },
                                                    { name: 'ZaloPay', scheme: 'zalopay://', color: 'bg-blue-500' },
                                                ].map((bank, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={bank.scheme}
                                                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-indigo-500/50 hover:bg-indigo-50 transition-all group"
                                                        onClick={() => {
                                                            alert(`Đang mở ${bank.name}...`);
                                                            setTimeout(() => {
                                                                setShowBankSelector(false);
                                                            }, 1000);
                                                        }}
                                                    >
                                                        <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-md", bank.color)}>
                                                            {bank.name.substring(0, 3)}
                                                        </div>
                                                        <span className="text-[10px] font-medium text-slate-600 text-center leading-tight group-hover:text-indigo-600">
                                                            {bank.name}
                                                        </span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-center text-slate-400 mt-3 border-t border-slate-100 pt-2">
                                            Lưu ý: Nếu ứng dụng không mở, vui lòng mở thủ công.
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


        </div >
    );
};

export default UserManagement;

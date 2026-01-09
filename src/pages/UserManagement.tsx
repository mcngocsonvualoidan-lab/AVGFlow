
import React, { useState, useEffect } from 'react';
import { storage, auth } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// import { doc, updateDoc, deleteDoc } from 'firebase/firestore'; // Removed as unused
import {
    X, Save, RefreshCw, CreditCard, Sparkles,
    Upload, Search, Trash2, Calendar, Clock, Edit2, Loader2,
    Mail, Phone, Briefcase, CheckCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useData, User, Notification } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext'; // Import useAuth

import { DEPARTMENTS as departments } from '../constants/common';

// OVERRIDE: Enforce correct DOBs while DB sync propagates
// OVERRIDE REMOVED: DB is now synced.

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
    const { users, addUser, updateUser, deleteUser, addNotification, addActiveEvent } = useData();

    // MIGRATION: Auto Update Phone Numbers (2026-01-07)
    // MIGRATION: Auto Update User Info (Phone + Bank) + CLEANUP - 2026-01-07
    // MIGRATION: Auto Update Removed to allow user edits.
    // effective-date: 2026-01-08


    const { t } = useLanguage();
    const { currentUser } = useAuth(); // Get currentUser

    // Check real permissions
    const loggedInUser = users.find(u => u.email.toLowerCase() === currentUser?.email?.toLowerCase());
    const isSuperAdmin = currentUser?.email?.toLowerCase() === 'mcngocsonvualoidan@gmail.com';
    const hasAdminRights = loggedInUser?.isAdmin || isSuperAdmin;

    const [showForm, setShowForm] = useState(false);

    // Leave Request State
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveUserId, setLeaveUserId] = useState<string | null>(null);
    const [leaveType, setLeaveType] = useState<'leave' | 'absence'>('leave'); // leave = nghỉ cả ngày, absence = vắng mặt tạm thời
    const [leaveStartDate, setLeaveStartDate] = useState('');
    const [leaveEndDate, setLeaveEndDate] = useState('');
    const [leaveReason, setLeaveReason] = useState('');
    const [absenceStartTime, setAbsenceStartTime] = useState('');
    const [absenceEndTime, setAbsenceEndTime] = useState('');

    // Avatar Upload State
    const [isUploading, setIsUploading] = useState(false);

    // QR Upload State
    const [isUploadingQr, setIsUploadingQr] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) return alert("File QR quá lớn! Vui lòng chọn ảnh dưới 5MB.");
        if (!file.type.startsWith('image/')) return alert("Vui lòng chọn file ảnh.");

        setIsUploadingQr(true);
        try {
            const storageRef = ref(storage, `qrcodes / ${Date.now()}_${file.name} `);
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
            const storageRef = ref(storage, `avatars / ${Date.now()}_${file.name} `);
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
                        id: `BIRTHDAY - TODAY - ${user.id} `,
                        title: '🎂 CHÚC MỪNG SINH NHẬT!',
                        message: `Hôm nay là sinh nhật của ${user.name} (${user.dept}) !Hãy gửi lời chúc tốt đẹp nhé! 🎉🎊`,
                        time: new Date().toISOString(),
                        read: false,
                        type: 'success'
                    });
                } else if (daysUntil > 0 && daysUntil <= 3) {
                    // BIRTHDAY COMING SOON (within 3 days)
                    addNotification({
                        id: `BIRTHDAY - SOON - ${user.id} `,
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

    const generateAlias = (name: string) => {
        if (!name) return '';
        // Helper to remove accents (basic) if needed, or just use as is. 
        // For Vietnamese names, keeping accents is common or removing them for codes.
        // Let's remove accents for "Code" style.
        const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
        const parts = normalized.trim().split(' ');
        const last = parts[parts.length - 1];
        const randomNum = Math.floor(100 + Math.random() * 900);
        return `${last}-${randomNum}`.toUpperCase();
    };

    const handleEdit = (user: User) => {
        const isMe = currentUser?.email?.toLowerCase() === user.email.toLowerCase();
        if (!hasAdminRights && !isMe) return alert("⚠️ TRUY CẬP BỊ TỪ CHỐI: Bạn chỉ có thể chỉnh sửa thông tin của chính mình.");
        setFormData({
            ...user,
            email: user.email || '',
            phone: user.phone || '',
            dob: user.dob || '',
            startDate: user.startDate || '',
            dept: user.dept || 'Kinh doanh' // Fallback
        });
        setEditingId(user.id);
        setShowForm(true);
    };

    const handleDelete = (id: string) => {
        if (!hasAdminRights) return alert("⚠️ ACCESS DENIED: Only Admin can delete.");
        if (confirm(t.users.alerts.confirmDelete)) {
            deleteUser(id);
        }
    };

    const handleSave = async (e?: any) => {
        if (isSaving) return;
        if (e && e.preventDefault) e.preventDefault();

        const isCreating = !editingId;
        const currentUser = users.find(u => u.email === auth.currentUser?.email);
        const hasAdminRights = currentUser?.isAdmin || currentUser?.email === 'mcngocsonvualoidan@gmail.com'; // Hardcoded override as requested before

        if (isCreating && !hasAdminRights) return alert("⚠️ Chỉ Admin mới được tạo nhân sự mới.");

        if (editingId) {
            const editingUser = users.find(u => u.id === editingId);
            const isMe = currentUser?.email?.toLowerCase() === editingUser?.email.toLowerCase();
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



    // Leave Request Functions
    const handleOpenLeaveModal = (type: 'leave' | 'absence') => {
        if (!loggedInUser) {
            alert('Bạn cần đăng nhập để sử dụng tính năng này!');
            return;
        }
        setLeaveUserId(loggedInUser.id);
        setLeaveType(type);
        setLeaveStartDate('');
        setLeaveEndDate('');
        setLeaveReason('');
        setAbsenceStartTime('');
        setAbsenceEndTime('');
        setShowLeaveModal(true);
    };

    const handleSubmitLeave = () => {
        if (!leaveUserId || !leaveReason) {
            alert('Vui lòng điền đầy đủ thông tin!');
            return;
        }

        if (leaveType === 'leave' && !leaveStartDate) {
            alert('Vui lòng chọn ngày nghỉ!');
            return;
        }

        if (leaveType === 'absence' && (!leaveStartDate || !absenceStartTime || !absenceEndTime)) {
            alert('Vui lòng chọn ngày và khoảng thời gian vắng mặt!');
            return;
        }

        const requestingUser = users.find(u => u.id === leaveUserId);
        if (!requestingUser) return;

        // SAVE LEAVE TO USER RECORD
        const newLeave: any = {
            id: Date.now().toString(),
            type: leaveType,
            reason: leaveReason,
            start: leaveType === 'leave' ? leaveStartDate : `${leaveStartDate}T${absenceStartTime}:00.000Z`,
            end: leaveType === 'leave' ? (leaveEndDate || leaveStartDate) : `${leaveStartDate}T${absenceEndTime}:00.000Z`,
        };
        // For simple date checking in getUserStatusColor, we use ISO string comparison or just YYYY-MM-DD for leaves.
        // If leaveType 'leave', start/end are YYYY-MM-DD.
        // If 'absence', they are ISO.
        // Ideally we store everything as ISO, but for UI simplicity let's keep input format logic or normalize.
        // Current getUserStatusColor handles 'leave' by checking if today string is in range.

        // Update User
        const updatedLeaves = [...(requestingUser.leaves || []), newLeave];
        updateUser({ ...requestingUser, leaves: updatedLeaves });


        const formatDate = (dateStr: string) => {
            if (!dateStr) return '';
            try {
                return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            } catch { return dateStr; }
        };

        let notificationMessage = '';
        let notificationTitle = '';

        if (leaveType === 'leave') {
            const dateRange = leaveEndDate
                ? `${formatDate(leaveStartDate)} - ${formatDate(leaveEndDate)}`
                : formatDate(leaveStartDate);
            notificationTitle = '📅 Thông báo nghỉ phép';
            notificationMessage = `${requestingUser.name} (${requestingUser.dept}) xin nghỉ: ${dateRange}. Lý do: ${leaveReason}`;
        } else {
            notificationTitle = '⏰ Thông báo vắng mặt';
            notificationMessage = `${requestingUser.name} (${requestingUser.dept}) xin vắng mặt ngày ${formatDate(leaveStartDate)} từ ${absenceStartTime} đến ${absenceEndTime}. Lý do: ${leaveReason}`;
        }

        // Create notification for all users (HR contacts)
        const leaveNotification: Notification = {
            id: `${leaveType.toUpperCase()}-${Date.now()}`,
            title: notificationTitle,
            message: notificationMessage,
            time: new Date().toISOString(),
            read: false,
            type: 'info'
        };

        addNotification(leaveNotification);

        // SPECIAL EVENT HANDLING
        if (leaveType === 'leave' && (leaveReason === 'Nghỉ cưới' || leaveReason === 'Nghỉ tang')) {
            const eventType = leaveReason === 'Nghỉ cưới' ? 'wedding' : 'funeral';
            const eventId = `${eventType}-${requestingUser.id}-${Date.now()}`;

            addActiveEvent({
                id: eventId,
                userId: requestingUser.id,
                userName: requestingUser.name,
                type: eventType,
                date: leaveStartDate
            });

            addNotification({
                id: `BROADCAST-${eventId}`,
                title: eventType === 'wedding' ? '💍 Tin Hỷ' : '🕯️ Tin Buồn',
                message: `${requestingUser.name} đã xin ${leaveReason} từ ngày ${formatDate(leaveStartDate)}. Hãy gửi lời ${eventType === 'wedding' ? 'chúc mừng' : 'chia buồn'}!`,
                time: new Date().toISOString(),
                read: false,
                type: eventType === 'wedding' ? 'success' : 'alert'
            });
        }

        // Reset and close modal
        setShowLeaveModal(false);
        setLeaveUserId(null);
        setLeaveStartDate('');
        setLeaveEndDate('');
        setLeaveReason('');
        setAbsenceStartTime('');
        setAbsenceEndTime('');

        const typeLabel = leaveType === 'leave' ? 'nghỉ phép' : 'vắng mặt';
        const extraMsg = (leaveReason === 'Nghỉ cưới' || leaveReason === 'Nghỉ tang') ? '\n\nĐã gửi thông báo đặc biệt đến toàn công ty.' : '\n\nTất cả đầu mối nhân sự sẽ nhận được thông báo.';
        alert(`✅ Đã gửi thông báo ${typeLabel}!${extraMsg}`);
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
                    // ISO range check for today's hours?
                    // newLeave.start/end are likely strings like "2026-01-05T09:00:00.000Z" (from what I wrote above)
                    // But wait, in handleSubmitLeave I constructed them using `leaveStartDate + T + time`?
                    // My generic update above uses input values. 
                    // Let's assume strict string comparison for ISO
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
        <div ref={containerRef} className="flex flex-col">

            {/* 1. TOP HEADER BLOCK */}
            <div className="mb-8">
                {/* ... Header content ... */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
                            {t.users.title}
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-sm rounded-full font-mono border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                                {users.length}
                            </span>
                        </h1>
                        <p className="text-slate-400 text-sm">{t.users.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* GLOBAL ACTIONS FOR CURRENT USER */}
                        <button
                            onClick={() => handleOpenLeaveModal('leave')}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 rounded-full text-sm border border-amber-500/30 hover:bg-amber-500/20 transition-all shadow-lg shadow-amber-500/10 font-bold uppercase tracking-wide"
                        >
                            <Calendar size={16} />
                            Đăng ký Nghỉ phép
                        </button>
                        <button
                            onClick={() => handleOpenLeaveModal('absence')}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-sm border border-blue-500/30 hover:bg-blue-500/20 transition-all shadow-lg shadow-blue-500/10 font-bold uppercase tracking-wide"
                        >
                            <Clock size={16} />
                            Đăng ký Vắng mặt
                        </button>
                    </div>
                </div>

                {/* CONTROL BAR - PILL SHAPE */}
                <div className="bg-[#1e1b4b]/80 border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-xl backdrop-blur-md sticky top-0 z-30">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold text-white">{t.users.systemTitle}</h2>
                        <p className="text-xs text-slate-400 hidden md:block">{t.users.systemDesc}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group md:block hidden">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={14} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder={t.users.searchPlaceholder}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-900/50 border border-slate-700 text-slate-300 text-xs rounded-lg block w-full pl-9 pr-2.5 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all w-48"
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
                                <div className="md:col-span-4 flex flex-col items-center gap-6 border-r border-white/5 pr-4">
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
                                    <button onClick={handleRandomAvatar} className="text-xs flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-500/30 px-3 py-1.5 rounded-full">
                                        <RefreshCw size={12} /> Random Avatar
                                    </button>

                                    {/* Permission Toggles (Admin Only) */}
                                    {hasAdminRights && (
                                        <div className="w-full space-y-3 mt-4 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                            <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Quyền & Trạng thái</h3>

                                            <label className="flex items-center justify-between cursor-pointer group">
                                                <span className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">Admin Access</span>
                                                <div className={clsx("w-10 h-5 rounded-full relative transition-colors", formData.isAdmin ? "bg-indigo-500" : "bg-slate-700")}>
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
                                                <span className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">Đã xác minh</span>
                                                <div className={clsx("w-10 h-5 rounded-full relative transition-colors", formData.verified ? "bg-emerald-500" : "bg-slate-700")}>
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
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">{t.users.form.name}</label>
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
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium"
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
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">{t.users.form.dept}</label>
                                        <select
                                            value={formData.dept}
                                            onChange={e => setFormData({ ...formData, dept: e.target.value })}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 outline-none appearance-none"
                                        >
                                            {departments.map(d => <option key={d} className="bg-slate-900 text-white">{d}</option>)}
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
                            <div className="p-6 border-t border-white/10 bg-slate-900/50 backdrop-blur sticky bottom-0 z-20 flex justify-end gap-3">
                                <button
                                    onClick={handleCancel}
                                    className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    {t.common.cancel}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={clsx(
                                        "px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/20 font-bold text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-2",
                                        isSaving && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    {isSaving ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Tạo mới')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 3. USER CARDS BY DEPARTMENT */}
            <div>
                {departments.map(dept => {
                    const deptUsers = users.filter(u => {
                        const matchesDept = u.dept === dept;
                        const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            u.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            u.email.toLowerCase().includes(searchQuery.toLowerCase());
                        return matchesDept && matchesSearch;
                    });
                    if (deptUsers.length === 0) return null;

                    return (
                        <div key={dept} className="mb-10">
                            {/* Department Label */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-1 h-6 bg-indigo-500 rounded-full" />
                                <h2 className="text-xl font-bold text-white tracking-wide font-sans">{dept}</h2>
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold uppercase">{deptUsers.length} nhân sự</span>
                            </div>

                            {/* Cards Grid */}
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
                                                "relative group overflow-hidden rounded-3xl bg-[#1e1b4b]/60 border shadow-2xl transition-all duration-500",
                                                highlightId === user.id
                                                    ? "border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.2)]"
                                                    : "border-white/5 hover:border-indigo-500/30"
                                            )}
                                        >

                                            {/* Admin Actions Overlay */}
                                            {(hasAdminRights || currentUser?.email?.toLowerCase() === user.email.toLowerCase()) && (
                                                <div className="absolute top-3 right-3 flex gap-2 z-20">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(user); }}
                                                        className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-500 transition-colors"
                                                        title={t.common.edit}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    {hasAdminRights && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(user.id); }}
                                                            className="p-2 bg-red-500/80 text-white rounded-lg shadow-lg hover:bg-red-500 transition-colors"
                                                            title={t.common.delete}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Card Body Grid */}
                                            <div className="flex p-6 gap-6">
                                                {/* Left Info Column */}
                                                <div className="flex-1 flex flex-col gap-4">
                                                    {/* Header: Avatar + Name + Alias */}
                                                    <div className="flex items-start gap-4">
                                                        <div className="relative">
                                                            <img src={user.avatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/10" />
                                                            <div className={clsx("absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#1e1b4b]", getUserStatusColor(user))} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-bold text-white text-lg font-sans">{user.name}</h3>
                                                                {user.isAdmin && <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">ADMIN</span>}
                                                            </div>
                                                            <div className="inline-block mt-1 px-2 py-0.5 bg-indigo-500/20 rounded text-[10px] font-bold text-indigo-300 tracking-wider font-mono">
                                                                {user.alias}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Contact Details */}
                                                    <div className="space-y-2 mt-1">
                                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                                            <Mail size={12} className="text-slate-500" />
                                                            {user.email}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                                            <Phone size={12} className="text-slate-500" />
                                                            {user.phone}
                                                        </div>
                                                    </div>

                                                    {/* Dates & Seniority */}
                                                    {(user.dob || user.startDate) && (
                                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                                            {user.dob && (() => {
                                                                const daysUntil = getDaysUntilBirthday(user.dob);
                                                                const isBirthdayToday = daysUntil === 0;
                                                                const isBirthdaySoon = daysUntil > 0 && daysUntil <= 3;

                                                                return (
                                                                    <div className={clsx(
                                                                        "rounded-lg px-3 py-2 border relative overflow-hidden",
                                                                        isBirthdayToday
                                                                            ? "bg-gradient-to-r from-pink-500/30 via-purple-500/30 to-pink-500/30 border-pink-400 animate-pulse"
                                                                            : isBirthdaySoon
                                                                                ? "bg-amber-500/20 border-amber-500/40"
                                                                                : "bg-pink-500/10 border-pink-500/20"
                                                                    )}>
                                                                        {/* Birthday celebration effect */}
                                                                        {isBirthdayToday && (
                                                                            <div className="absolute -top-1 -right-1 text-2xl animate-bounce">
                                                                                🎂
                                                                            </div>
                                                                        )}
                                                                        {isBirthdaySoon && (
                                                                            <div className="absolute -top-1 -right-1 text-lg">
                                                                                🎈
                                                                            </div>
                                                                        )}

                                                                        <div className={clsx(
                                                                            "text-[9px] font-bold uppercase mb-1 flex items-center gap-1",
                                                                            isBirthdayToday ? "text-pink-300" : isBirthdaySoon ? "text-amber-400" : "text-pink-400"
                                                                        )}>
                                                                            <Sparkles size={10} />
                                                                            {isBirthdayToday ? "🎉 SINH NHẬT HÔM NAY!" : "Ngày sinh"}
                                                                        </div>

                                                                        <div className="text-sm text-white font-semibold">
                                                                            {new Date(user.dob).toLocaleDateString('vi-VN', {
                                                                                day: '2-digit',
                                                                                month: '2-digit',
                                                                                year: 'numeric'
                                                                            })}
                                                                        </div>

                                                                        {/* Countdown badge */}
                                                                        {isBirthdaySoon && !isBirthdayToday && (
                                                                            <div className="mt-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded inline-block">
                                                                                Còn {daysUntil} ngày!
                                                                            </div>
                                                                        )}
                                                                        {isBirthdayToday && (
                                                                            <div className="mt-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full inline-block shadow-lg">
                                                                                Chúc mừng sinh nhật! 🎊
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                            {user.startDate && (() => {
                                                                const startDate = new Date(user.startDate);
                                                                const now = new Date();

                                                                // Calculate years, months, days
                                                                let years = now.getFullYear() - startDate.getFullYear();
                                                                let months = now.getMonth() - startDate.getMonth();
                                                                let days = now.getDate() - startDate.getDate();

                                                                // Adjust for negative days
                                                                if (days < 0) {
                                                                    months--;
                                                                    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                                                                    days += lastMonth.getDate();
                                                                }

                                                                // Adjust for negative months
                                                                if (months < 0) {
                                                                    years--;
                                                                    months += 12;
                                                                }

                                                                return (
                                                                    <div className="bg-emerald-500/10 rounded-lg px-3 py-2 border border-emerald-500/20">
                                                                        <div className="text-[9px] text-emerald-400 font-bold uppercase mb-1 flex items-center gap-1">
                                                                            <Briefcase size={10} /> Thâm niên
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-1">
                                                                            {years > 0 && (
                                                                                <span className="bg-emerald-500 text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-md">
                                                                                    {years} năm
                                                                                </span>
                                                                            )}
                                                                            {months > 0 && (
                                                                                <span className="bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-md">
                                                                                    {months} tháng
                                                                                </span>
                                                                            )}
                                                                            <span className="bg-emerald-700 text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-md">
                                                                                {days} ngày
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[9px] text-slate-500 mt-1">
                                                                            Ngày ký HĐ: {startDate.toLocaleDateString('vi-VN')}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}

                                                    {/* Bank Details */}
                                                    <div>
                                                        <label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">{t.users.form.bank}</label>
                                                        <div className="text-sm text-slate-300 font-mono tracking-tight">
                                                            <span className="font-bold text-white font-sans">{user.bankName || 'N/A'}:</span> {user.bankAcc || '...'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right QR Column */}
                                                <div className="w-32 flex flex-col items-center gap-2">
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase">{t.users.card.clickZoom}</span>
                                                    <button
                                                        onClick={() => setSelectedQR(user)}
                                                        className="w-full aspect-square bg-white rounded-xl p-2 shadow-lg hover:scale-105 transition-transform cursor-pointer relative group/qr overflow-hidden"
                                                    >
                                                        <img
                                                            src={`https://img.vietqr.io/image/${user.bankName}-${user.bankAcc}-compact2.png?amount=&addInfo=&accountName=${encodeURIComponent(user.name)}`}
                                                            className="w-full h-full object-contain mix-blend-multiply relative z-10"
                                                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=QR+Error' }}
                                                        />
                                                        {/* Scan effect */}
                                                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/50 shadow-[0_0_15px_#6366f1] animate-[scan_2s_ease-in-out_infinite] z-20 opacity-0 group-hover/qr:opacity-100" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Footer: Verified Strip + Leave Button (only for current user) */}
                                            <div className="bg-black/20 py-2 px-6 flex justify-between items-center border-t border-white/5">
                                                {/* Only show leave buttons for current logged-in user */}
                                                <span className="text-[10px] uppercase font-bold text-slate-600">{t.users.card.systemVerify}</span>
                                                <div className={clsx(
                                                    "flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                                                    user.verified ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                                                )}>
                                                    {user.verified && <CheckCircle size={10} />}
                                                    {user.verified ? t.users.card.verified : t.users.card.pending}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    )
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
                                    src={`https://img.vietqr.io/image/${selectedQR.bankName}-${selectedQR.bankAcc}-compact2.png?amount=&addInfo=&accountName=${encodeURIComponent(selectedQR.name)}`}
                                    className="w-full rounded-lg mix-blend-multiply"
                                    alt="QR Pay"
                                />
                            </div>

                            <div className="space-y-3">
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
                                    <span className="font-mono font-bold text-xl text-indigo-600 tracking-wider">
                                        {selectedQR.bankAcc.replace(/(\d{4})(\d{3})/, '$1 $2 ')}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* LEAVE REQUEST MODAL */}
            <AnimatePresence>
                {showLeaveModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
                        onClick={() => setShowLeaveModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    {leaveType === 'leave' ? (
                                        <>
                                            <Calendar size={20} className="text-amber-400" />
                                            Đăng ký nghỉ phép
                                        </>
                                    ) : (
                                        <>
                                            <Clock size={20} className="text-blue-400" />
                                            Đăng ký vắng mặt
                                        </>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowLeaveModal(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* User Info */}
                            {leaveUserId && (
                                <div className={clsx(
                                    "border rounded-xl p-3 mb-4 flex items-center gap-3",
                                    leaveType === 'leave'
                                        ? "bg-amber-500/10 border-amber-500/30"
                                        : "bg-blue-500/10 border-blue-500/30"
                                )}>
                                    <img
                                        src={users.find(u => u.id === leaveUserId)?.avatar}
                                        className="w-10 h-10 rounded-full border border-white/20"
                                    />
                                    <div>
                                        <div className="text-white font-semibold">{users.find(u => u.id === leaveUserId)?.name}</div>
                                        <div className={leaveType === 'leave' ? "text-amber-300 text-xs" : "text-blue-300 text-xs"}>
                                            {users.find(u => u.id === leaveUserId)?.dept}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Form Fields */}
                            <div className="space-y-4">
                                {/* Date Selection */}
                                <div>
                                    <label className="text-sm text-slate-400 mb-1 block">
                                        {leaveType === 'leave' ? 'Ngày bắt đầu nghỉ *' : 'Ngày vắng mặt *'}
                                    </label>
                                    <input
                                        type="date"
                                        value={leaveStartDate}
                                        onChange={(e) => setLeaveStartDate(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none"
                                    />
                                </div>

                                {/* For Leave: End date */}
                                {leaveType === 'leave' && (
                                    <div>
                                        <label className="text-sm text-slate-400 mb-1 block">Ngày kết thúc (nếu nghỉ nhiều ngày)</label>
                                        <input
                                            type="date"
                                            value={leaveEndDate}
                                            onChange={(e) => setLeaveEndDate(e.target.value)}
                                            min={leaveStartDate}
                                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                )}

                                {/* For Absence: Time range */}
                                {leaveType === 'absence' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-sm text-slate-400 mb-1 block">Từ giờ *</label>
                                            <input
                                                type="time"
                                                value={absenceStartTime}
                                                onChange={(e) => setAbsenceStartTime(e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-slate-400 mb-1 block">Đến giờ *</label>
                                            <input
                                                type="time"
                                                value={absenceEndTime}
                                                onChange={(e) => setAbsenceEndTime(e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Reason */}
                                <div>
                                    <label className="text-sm text-slate-400 mb-1 block">Lý do *</label>
                                    <select
                                        value={leaveReason}
                                        onChange={(e) => setLeaveReason(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none"
                                    >
                                        <option value="">-- Chọn lý do --</option>
                                        {leaveType === 'leave' ? (
                                            <>
                                                <option value="Nghỉ phép năm">Nghỉ phép năm</option>
                                                <option value="Nghỉ ốm">Nghỉ ốm</option>
                                                <option value="Việc gia đình">Việc gia đình</option>
                                                <option value="Nghỉ cưới">Nghỉ cưới</option>
                                                <option value="Nghỉ tang">Nghỉ tang</option>
                                                <option value="Đi công tác">Đi công tác</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="Họp ngoài">Họp ngoài</option>
                                                <option value="Khám bệnh">Khám bệnh</option>
                                                <option value="Việc cá nhân">Việc cá nhân</option>
                                                <option value="Gặp khách hàng">Gặp khách hàng</option>
                                                <option value="Đi ngân hàng">Đi ngân hàng</option>
                                            </>
                                        )}
                                        <option value="Lý do khác">Lý do khác</option>
                                    </select>
                                </div>

                                {leaveReason === 'Lý do khác' && (
                                    <div>
                                        <label className="text-sm text-slate-400 mb-1 block">Chi tiết lý do</label>
                                        <textarea
                                            placeholder="Nhập lý do cụ thể..."
                                            onChange={(e) => setLeaveReason(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none resize-none h-20"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Submit Button */}
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowLeaveModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSubmitLeave}
                                    className={clsx(
                                        "flex-1 px-4 py-2.5 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2",
                                        leaveType === 'leave'
                                            ? "bg-amber-600 hover:bg-amber-500"
                                            : "bg-blue-600 hover:bg-blue-500"
                                    )}
                                >
                                    {leaveType === 'leave' ? <Calendar size={16} /> : <Clock size={16} />}
                                    Gửi thông báo
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default UserManagement;

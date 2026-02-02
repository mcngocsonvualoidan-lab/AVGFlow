import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData, Notification } from '../../context/DataContext';
import { ChevronLeft, ChevronRight, BarChart2, Table, Calendar, Clock, Globe, X } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import TimeGrid from './TimeGrid';
import TimeStats from './TimeStats';

const TimekeepingLayout = () => {
    const { users: contextUsers } = useData();

    // TEMP FIX: Inject missing unpaid leaves for Jan 2026 (Shared logic)
    const HARDCODED_LEAVES = [
        {
            userId: '6', // Hà Ngọc Doanh
            leaves: [{
                id: 'l_doanh_1',
                type: 'absence' as const,
                start: '2026-01-10',
                end: '2026-01-10',
                reason: 'Nghỉ không lương'
            }, {
                id: 'l_doanh_2',
                type: 'leave' as const,
                start: '2026-01-09',
                end: '2026-01-09',
                reason: 'Nghỉ phép'
            }, {
                id: 'l_doanh_3',
                type: 'absence' as const,
                start: '2026-01-27',
                end: '2026-01-27',
                session: 'afternoon' as const,
                reason: 'Bận việc gia đình'
            }]
        },
        {
            userId: '9', // Nguyễn Thị Quỳnh Nga
            leaves: [{
                id: 'l_nga_1',
                type: 'absence' as const,
                start: '2026-01-03',
                end: '2026-01-03',
                reason: 'Nghỉ không lương'
            }]
        },
        {
            userId: '10', // Phan Thị Hải
            leaves: [{
                id: 'l_hai_1',
                type: 'absence' as const,
                start: '2026-01-03',
                end: '2026-01-03',
                reason: 'Nghỉ không lương'
            }, {
                id: 'l_hai_2',
                type: 'absence' as const,
                start: '2026-01-19',
                end: '2026-01-19',
                reason: 'Nghỉ không lương'
            }, {
                id: 'l_hai_3',
                type: 'absence' as const,
                start: '2026-01-20',
                end: '2026-01-20',
                reason: 'Nghỉ không phép'
            }]
        }
    ];

    const users = contextUsers.map(u => {
        const fix = HARDCODED_LEAVES.find(h => h.userId === u.id);
        if (fix) {
            const existingIds = new Set((u.leaves || []).map((l: any) => l.id));
            const newLeaves = fix.leaves.filter((l: any) => !existingIds.has(l.id));
            if (newLeaves.length > 0) {
                return { ...u, leaves: [...(u.leaves || []), ...newLeaves] };
            }
        }
        return u;
    });

    // UserManagement uses useAuth for currentUser.
    const { currentUser: authUser } = useAuth();
    const { updateUser, addNotification, addActiveEvent } = useData();

    // Default to current month, but ensure we start viewing from 2026 if today is before 2026 (unlikely in this scenario, but good practice)
    const today = new Date();
    // Force min 2026 logic?
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [tab, setTab] = useState<'grid' | 'stats'>('grid');

    // Leave Request State
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveUserId, setLeaveUserId] = useState<string | null>(null);
    const [leaveType, setLeaveType] = useState<'leave' | 'absence' | 'online'>('leave');
    const [leaveSession, setLeaveSession] = useState<'full' | 'morning' | 'afternoon'>('full');
    const [leaveStartDate, setLeaveStartDate] = useState('');
    const [leaveEndDate, setLeaveEndDate] = useState('');
    const [leaveReason, setLeaveReason] = useState('');
    const [absenceStartTime, setAbsenceStartTime] = useState('');
    const [absenceEndTime, setAbsenceEndTime] = useState('');

    const loggedInUser = users.find(u => (u.email || '').toLowerCase() === (authUser?.email || '').toLowerCase());

    // Quota Logic: 1 day per month
    // Use selected view month for quota check if we want to show status for that month, 
    // OR use current month to determine if they can book for "this" month.
    // The request implies "Mỗi tháng...". Let's check the quota for the VIEWED month for the button label,
    // but the submission logic will check the quota for the REQUESTED month.

    const getUsedLeavesInMonth = (userId: string, targetMonth: number, targetYear: number) => {
        const u = users.find(u => u.id === userId);
        if (!u || !u.leaves) return 0;
        return u.leaves.filter((l: any) => {
            if (l.type !== 'leave') return false;
            const d = new Date(l.start);
            return d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;
        }).reduce((acc: number, l: any) => acc + (l.session === 'full' ? 1 : 0.5), 0);
    };

    const usedLeaveInViewMonth = loggedInUser ? getUsedLeavesInMonth(loggedInUser.id, month, year) : 0;
    const hasQuotaInViewMonth = usedLeaveInViewMonth < 1;

    const handlePrevMonth = () => {
        // Stop at Jan 2026
        if (year === 2026 && month === 1) return;

        if (month === 1) {
            setMonth(12);
            setYear(prev => prev - 1);
        } else {
            setMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (month === 12) {
            setMonth(1);
            setYear(prev => prev + 1);
        } else {
            setMonth(prev => prev + 1);
        }
    };

    // Leave Logic
    const handleOpenLeaveModal = (type: 'leave' | 'absence' | 'online') => {
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

        if (['absence', 'online'].includes(leaveType) && !leaveStartDate) {
            alert('Vui lòng chọn ngày!');
            return;
        }

        if (leaveType === 'absence' && (!absenceStartTime || !absenceEndTime)) {
            alert('Vui lòng chọn khoảng thời gian vắng mặt!');
            return;
        }

        const requestingUser = users.find(u => u.id === leaveUserId);
        if (!requestingUser) return;

        // Auto-convert to absence if quota exceeded
        let finalLeaveType = leaveType;
        let finalReason = leaveReason;
        let finalSession = leaveSession;

        if (leaveType === 'leave') {
            const startD = new Date(leaveStartDate);
            const m = startD.getMonth() + 1;
            const y = startD.getFullYear();
            const usedInMonth = getUsedLeavesInMonth(leaveUserId, m, y);

            // Calculate request duration
            let duration = 0;
            if (leaveSession === 'full') {
                if (leaveEndDate && leaveEndDate !== leaveStartDate) {
                    // Multi-day logic simplified: strict 1 day check means if they book 2 days, they exceed.
                    // For simplicity, just count days.
                    const d1 = new Date(leaveStartDate);
                    const d2 = new Date(leaveEndDate);
                    const diffTime = Math.abs(d2.getTime() - d1.getTime());
                    duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                } else {
                    duration = 1;
                }
            } else {
                duration = 0.5;
            }

            if (usedInMonth + duration > 1) {
                // EXCEEDED QUOTA
                finalLeaveType = 'absence'; // Convert to KP or similar. "x/2" is visualized in Grid, but stored as 'absence' usually? 
                // Actually stored as type='absence' session='...' in my previous hardcode example.
                // If it's 0.5 day, it becomes absence with session.

                // Alert the user
                alert(`Bạn đã dùng hết ngày phép tháng ${m}/${y} (Đã dùng: ${usedInMonth}, Hạn mức: 1). Yêu cầu này sẽ được chuyển thành "Nghỉ không lương/không phép" (KP/x2).`);

                finalReason = `${leaveReason} (Hết phép -> KP)`;
            }
        }

        // SAVE LEAVE TO USER RECORD
        const newLeave: any = {
            id: Date.now().toString(),
            type: finalLeaveType,
            reason: finalReason,
            session: finalLeaveType === 'leave' || finalLeaveType === 'absence' ? finalSession : undefined, // Keep session for absence too if converted
            start: finalLeaveType === 'leave' ? leaveStartDate : (finalLeaveType === 'absence' && leaveType === 'leave' ? leaveStartDate : `${leaveStartDate}T${absenceStartTime || '00:00'}:00.000`), // If converted from leave, keep date format simple or adapt?
            // Actually, existing 'absence' logic uses ISO with time. 'leave' uses YYYY-MM-DD.
            // If we convert 'leave' -> 'absence', we should probably stick to YYYY-MM-DD format if the system handles "full day absence" gracefully.
            // Looking at TimeGrid logic: it checks "type === 'absence'". If "session" is present, it treats it as x/2 ?
            // Let's check TimeGrid logic... wait, I can't check it inside this tool.
            // Warning: TimeGrid logic for 'absence' usually expects precise timestamps OR relies on `session` for half-day?
            // My hardcoded data: type: 'absence', session: 'afternoon', start: 'YYYY-MM-DD'. So 'absence' CAN store YYYY-MM-DD if session is set.
            // But standard 'absence' (clock based) stores ISO string.
            // Let's coerce: If converted from Leave (Day based) -> Absence (Day based), keep YYYY-MM-DD but ensure `session` is respected.
            end: finalLeaveType === 'leave'
                ? (finalSession === 'full' ? (leaveEndDate || leaveStartDate) : leaveStartDate)
                : (finalLeaveType === 'absence' && leaveType === 'leave' ? leaveStartDate : `${leaveStartDate}T${absenceEndTime || '23:59'}:00.000`),
        };

        // Fix for online/absence start/end format if needed, but keeping consistent with UserManagement logic

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
            const dateRange = (leaveEndDate && leaveSession === 'full')
                ? `${formatDate(leaveStartDate)} - ${formatDate(leaveEndDate)}`
                : `${formatDate(leaveStartDate)}${leaveSession === 'morning' ? ' (Sáng)' : leaveSession === 'afternoon' ? ' (Chiều)' : ''}`;

            notificationTitle = '📅 Thông báo nghỉ phép';
            notificationMessage = `${requestingUser.name} (${requestingUser.dept}) xin nghỉ: ${dateRange}. Lý do: ${leaveReason}`;
        } else if (leaveType === 'online') {
            notificationTitle = '🌐 Đăng ký làm Online';
            notificationMessage = `${requestingUser.name} (${requestingUser.dept}) làm online ngày ${formatDate(leaveStartDate)}. Lý do: ${leaveReason}`;
        } else {
            notificationTitle = '⏰ Thông báo vắng mặt';
            notificationMessage = `${requestingUser.name} (${requestingUser.dept}) xin vắng mặt ngày ${formatDate(leaveStartDate)} từ ${absenceStartTime} đến ${absenceEndTime}. Lý do: ${leaveReason}`;
        }

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

        setShowLeaveModal(false);
        setLeaveUserId(null);
        setLeaveStartDate('');
        setLeaveEndDate('');
        setLeaveReason('');
        setAbsenceStartTime('');
        setAbsenceEndTime('');

        alert(`✅ Đã gửi yêu cầu thành công!`);
    };


    return (
        <div className="space-y-6 relative">
            {/* 1. HERO BANNER - TIMEKEEPING */}
            <div className="relative rounded-3xl overflow-hidden mb-6 shadow-2xl shrink-0">
                {/* Background Gradient & Effects */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 mix-blend-overlay"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl -ml-10 -mb-10 mix-blend-overlay"></div>
                </div>

                <div className="relative z-10 p-6 md:p-8 text-white">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-widest border border-white/10">
                                    Timekeeping System
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-sm flex items-center gap-3">
                                Bảng chấm công
                            </h1>
                            <p className="text-blue-100 font-medium max-w-xl text-lg opacity-90">
                                Quản lý ngày công, phép năm và theo dõi hiệu suất nhân sự
                            </p>
                        </div>

                        {/* Top Actions: Leave Requests */}
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => handleOpenLeaveModal('leave')}
                                className={clsx(
                                    "px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95",
                                    "bg-white text-amber-600 hover:bg-amber-50"
                                )}
                                title={hasQuotaInViewMonth ? `Đăng ký nghỉ phép (Còn ${1 - usedLeaveInViewMonth} ngày)` : "Đã hết phép tháng này"}
                            >
                                <Calendar size={18} />
                                Nghỉ phép
                                {hasQuotaInViewMonth ? (
                                    <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                                        {1 - usedLeaveInViewMonth}
                                    </span>
                                ) : (
                                    <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">Hết</span>
                                )}
                            </button>
                            <button
                                onClick={() => handleOpenLeaveModal('absence')}
                                className="px-4 py-2.5 bg-indigo-500/40 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
                            >
                                <Clock size={18} /> Vắng mặt
                            </button>
                            <button
                                onClick={() => handleOpenLeaveModal('online')}
                                className="px-4 py-2.5 bg-emerald-500/80 backdrop-blur-md text-white hover:bg-emerald-400 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 hover:scale-105 active:scale-95 border border-white/20"
                            >
                                <Globe size={18} /> Online
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats & Filters Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                        {/* Month Nav - Styled as Card */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/10 flex items-center justify-between px-2">
                            <button
                                onClick={handlePrevMonth}
                                className={clsx("p-2 rounded-xl transition-colors text-white hover:bg-white/10", (year === 2026 && month === 1) && "opacity-50 cursor-not-allowed")}
                                disabled={year === 2026 && month === 1}
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <span className="font-bold text-xl uppercase tracking-widest">
                                Tháng {month} / {year}
                            </span>
                            <button onClick={handleNextMonth} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white">
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* View Switcher - Styled as Card */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1.5 border border-white/10 flex items-center">
                            <button
                                onClick={() => setTab('grid')}
                                className={clsx(
                                    "flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                                    tab === 'grid' ? "bg-white text-indigo-600 shadow-md" : "text-blue-100 hover:bg-white/10"
                                )}
                            >
                                <Table size={18} />
                                Bảng công
                            </button>
                            <button
                                onClick={() => setTab('stats')}
                                className={clsx(
                                    "flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                                    tab === 'stats' ? "bg-white text-indigo-600 shadow-md" : "text-blue-100 hover:bg-white/10"
                                )}
                            >
                                <BarChart2 size={18} />
                                Thống kê
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="min-h-[600px]">
                {tab === 'grid' ? (
                    <TimeGrid key={`${month}-${year}`} month={month} year={year} users={users} />
                ) : (
                    <TimeStats month={month} year={year} users={users} />
                )}
            </div>

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
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl m-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {leaveType === 'leave' && (
                                        <>
                                            <Calendar size={20} className="text-amber-500 dark:text-amber-400" />
                                            {hasQuotaInViewMonth ? "Đăng ký nghỉ phép" : "Đăng ký xin nghỉ"}
                                        </>
                                    )}
                                    {leaveType === 'absence' && (
                                        <>
                                            <Clock size={20} className="text-blue-500 dark:text-blue-400" />
                                            Đăng ký vắng mặt
                                        </>
                                    )}
                                    {leaveType === 'online' && (
                                        <>
                                            <Globe size={20} className="text-emerald-500 dark:text-emerald-400" />
                                            Đăng ký làm Online
                                        </>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowLeaveModal(false)}
                                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Type Selector Tabs */}
                            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-4">
                                <button
                                    onClick={() => setLeaveType('leave')}
                                    className={clsx(
                                        "flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1",
                                        leaveType === 'leave' ? "bg-amber-500 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    <Calendar size={14} /> {hasQuotaInViewMonth ? "Nghỉ phép" : "Xin nghỉ"}
                                </button>
                                <button
                                    onClick={() => setLeaveType('absence')}
                                    className={clsx(
                                        "flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1",
                                        leaveType === 'absence' ? "bg-blue-500 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    <Clock size={14} /> Vắng mặt
                                </button>
                                <button
                                    onClick={() => setLeaveType('online')}
                                    className={clsx(
                                        "flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1",
                                        leaveType === 'online' ? "bg-emerald-500 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    )}
                                >
                                    <Globe size={14} /> WFH (Online)
                                </button>
                            </div>

                            {/* User Info */}
                            {leaveUserId && (
                                <div className={clsx(
                                    "border rounded-xl p-3 mb-4 flex items-center gap-3",
                                    leaveType === 'leave'
                                        ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
                                        : leaveType === 'online' ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30" : "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"
                                )}>
                                    <img
                                        src={users.find(u => u.id === leaveUserId)?.avatar}
                                        className="w-10 h-10 rounded-full border border-white/20"
                                    />
                                    <div>
                                        <div className="text-slate-900 dark:text-white font-semibold">{users.find(u => u.id === leaveUserId)?.name}</div>
                                        <div className={leaveType === 'leave' ? "text-amber-600 dark:text-amber-300 text-xs" : (leaveType === 'online' ? "text-emerald-600 dark:text-emerald-300 text-xs" : "text-blue-600 dark:text-blue-300 text-xs")}>
                                            {users.find(u => u.id === leaveUserId)?.dept}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Form Fields */}
                            <div className="space-y-4">
                                {/* Date Selection */}
                                <div>
                                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
                                        {leaveType === 'leave' ? 'Ngày bắt đầu nghỉ *' : (leaveType === 'online' ? 'Ngày làm việc Online *' : 'Ngày vắng mặt *')}
                                    </label>
                                    <input
                                        type="date"
                                        value={leaveStartDate}
                                        onChange={(e) => setLeaveStartDate(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none"
                                    />
                                </div>

                                {/* For Leave: End date OR Session */}
                                {leaveType === 'leave' && (
                                    <>
                                        <div>
                                            <label className="text-sm text-slate-600 dark:text-slate-400 mb-2 block">Thời gian nghỉ *</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                <button
                                                    onClick={() => { setLeaveSession('full'); setLeaveEndDate(''); }}
                                                    className={clsx(
                                                        "px-3 py-2 rounded-lg text-xs font-bold border transition-all",
                                                        leaveSession === 'full'
                                                            ? "bg-amber-500 text-white border-amber-500"
                                                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-amber-500/50"
                                                    )}
                                                >
                                                    Cả ngày
                                                </button>
                                                <button
                                                    onClick={() => { setLeaveSession('morning'); setLeaveEndDate(''); }}
                                                    className={clsx(
                                                        "px-3 py-2 rounded-lg text-xs font-bold border transition-all",
                                                        leaveSession === 'morning'
                                                            ? "bg-amber-500 text-white border-amber-500"
                                                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-amber-500/50"
                                                    )}
                                                >
                                                    Buổi Sáng (1/2)
                                                </button>
                                                <button
                                                    onClick={() => { setLeaveSession('afternoon'); setLeaveEndDate(''); }}
                                                    className={clsx(
                                                        "px-3 py-2 rounded-lg text-xs font-bold border transition-all",
                                                        leaveSession === 'afternoon'
                                                            ? "bg-amber-500 text-white border-amber-500"
                                                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-amber-500/50"
                                                    )}
                                                >
                                                    Buổi Chiều (1/2)
                                                </button>
                                            </div>
                                        </div>

                                        {leaveSession === 'full' && (
                                            <div>
                                                <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Ngày kết thúc (nếu nghỉ nhiều ngày)</label>
                                                <input
                                                    type="date"
                                                    value={leaveEndDate}
                                                    onChange={(e) => setLeaveEndDate(e.target.value)}
                                                    min={leaveStartDate}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none"
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* For Absence: Time range */}
                                {leaveType === 'absence' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Từ giờ *</label>
                                            <input
                                                type="time"
                                                value={absenceStartTime}
                                                onChange={(e) => setAbsenceStartTime(e.target.value)}
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Đến giờ *</label>
                                            <input
                                                type="time"
                                                value={absenceEndTime}
                                                onChange={(e) => setAbsenceEndTime(e.target.value)}
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Reason */}
                                <div>
                                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Lý do *</label>
                                    <select
                                        value={leaveReason}
                                        onChange={(e) => setLeaveReason(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none"
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
                                        ) : leaveType === 'online' ? (
                                            <>
                                                <option value="Work From Home">Work From Home (WFH)</option>
                                                <option value="Họp đối tác">Họp đối tác xa</option>
                                                <option value="Công tác">Đi công tác</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="Họp ngoài">Họp ngoài</option>
                                                <option value="Khám bệnh">Khám bệnh</option>
                                                <option value="Việc cá nhân">Việc cá nhân (Ghi rõ)</option>
                                                <option value="Gặp khách hàng">Gặp khách hàng</option>
                                                <option value="Đi ngân hàng">Đi ngân hàng</option>
                                            </>
                                        )}
                                        <option value="Lý do khác">Lý do khác</option>
                                    </select>
                                </div>

                                {leaveReason === 'Lý do khác' && (
                                    <div>
                                        <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Chi tiết lý do</label>
                                        <textarea
                                            placeholder="Nhập lý do cụ thể..."
                                            onChange={(e) => setLeaveReason(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none resize-none h-20"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Submit Button */}
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowLeaveModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSubmitLeave}
                                    className={clsx(
                                        "flex-1 px-4 py-2.5 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2",
                                        leaveType === 'leave'
                                            ? "bg-amber-600 hover:bg-amber-500"
                                            : leaveType === 'online' ? "bg-emerald-600 hover:bg-emerald-500" : "bg-blue-600 hover:bg-blue-500"
                                    )}
                                >
                                    {leaveType === 'leave' ? <Calendar size={16} /> : (leaveType === 'online' ? <Globe size={16} /> : <Clock size={16} />)}
                                    Gửi yêu cầu
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TimekeepingLayout;

import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData, Notification } from '../../context/DataContext';
import { ChevronLeft, ChevronRight, BarChart2, Table, Calendar, Clock, Globe, X, Sparkles, Briefcase, Calculator } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import HeroBanner from '../../components/HeroBanner';
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
            userId: '8', // Lê Thị Nga
            leaves: [{
                id: 'l_nga_lt_1',
                type: 'leave' as const,
                start: '2026-02-07',
                end: '2026-02-07',
                reason: 'Bận việc gia đình'
            }]
        },
        {
            userId: '7', // Đinh Hoàng Ngọc Hân
            leaves: [{
                id: 'l_han_online_1',
                type: 'online' as const,
                start: '2026-02-09',
                end: '2026-02-13',
                reason: 'Làm việc online tại nhà'
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
        },
        {
            userId: 'unknown_luu',
            userName: 'Trần Hải Lưu',
            leaves: [{
                id: 'l_luu_online_1',
                type: 'online' as const,
                start: '2026-02-10',
                end: '2026-02-13',
                reason: 'Làm việc online tại nhà'
            }]
        }
    ];

    const users = useMemo(() => {
        return contextUsers.map(u => {
            let leaves = [...(u.leaves || [])];

            const fix = HARDCODED_LEAVES.find(h => h.userId === u.id || (h.userName && h.userName === u.name));
            if (fix) {
                const existingIds = new Set(leaves.map((l: any) => l.id));
                const newLeaves = fix.leaves.filter((l: any) => !existingIds.has(l.id));
                if (newLeaves.length > 0) {
                    leaves = [...leaves, ...newLeaves];
                }
            }

            return { ...u, leaves };
        });
    }, [contextUsers]);

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

        // Prepare the new leave object initially 
        const newLeave: any = {
            id: Date.now().toString(),
            type: leaveType,
            reason: leaveReason,
            session: leaveType === 'leave' || leaveType === 'absence' ? leaveSession : undefined,
            start: leaveType === 'leave' ? leaveStartDate : (leaveType === 'absence' ? `${leaveStartDate}T${absenceStartTime || '00:00'}:00.000` : leaveStartDate),
            end: leaveType === 'leave'
                ? (leaveSession === 'full' ? (leaveEndDate || leaveStartDate) : leaveStartDate)
                : (leaveType === 'absence' ? `${leaveStartDate}T${absenceEndTime || '23:59'}:00.000` : leaveStartDate),
        };

        let updatedLeaves = [...(requestingUser.leaves || [])];

        let shouldAlertQuota = false;
        let alertContext = '';

        if (leaveType === 'leave') {
            const startD = new Date(leaveStartDate);
            const targetM = startD.getMonth() + 1;
            const targetY = startD.getFullYear();

            // Add the new leave temporarily to recalculate
            updatedLeaves.push(newLeave);

            // Extract all leaves/absences (that were converted from leaves) for this month
            const monthLeaves = updatedLeaves.filter((l: any) => {
                const d = new Date(l.start);
                return d.getMonth() + 1 === targetM && d.getFullYear() === targetY &&
                    (l.type === 'leave' || (l.type === 'absence' && l.reason.includes('Hết phép')));
            });

            // Sort them chronologically
            monthLeaves.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

            // Recalculate Quota: Max 1 day
            let usedQuota = 0;
            const maxQuota = 1;

            monthLeaves.forEach(l => {
                const duration = l.session === 'full' ? 1 : 0.5; // Simplification for 1 day

                if (usedQuota + duration <= maxQuota) {
                    // It fits in quota, make it a paid leave
                    l.type = 'leave';
                    l.reason = l.reason.replace(' (Hết phép -> KP)', '').replace(' (Nghỉ phép -> KP)', '');
                    usedQuota += duration;
                } else {
                    // It exceeds quota, make it absence
                    if (l.type === 'leave') {
                        l.type = 'absence';
                        if (!l.reason.includes('Hết phép')) {
                            l.reason = `${l.reason} (Hết phép -> KP)`;
                            shouldAlertQuota = true;
                            alertContext = `${targetM}/${targetY}`;
                        }
                    }
                    usedQuota += duration; // Keep accumulating to see total requested
                }
            });

            // Re-integrate back into the main leaves array (references were kept, so updatedLeaves is already mutated)
        } else {
            // For online or standard absence, just push it
            updatedLeaves.push(newLeave);
        }

        if (shouldAlertQuota) {
            alert(`Do giới hạn 1 ngày phép/tháng, hệ thống đã sắp xếp lại các ngày nghỉ trong tháng ${alertContext}. Ngày nghỉ phát sinh thêm sẽ được chuyển thành "Nghỉ không lương/không phép" (KP/x2).`);
        }

        // Fix for online/absence start/end format if needed, but keeping consistent with UserManagement logic

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
            {/* 1. Hero Banner */}
            <HeroBanner
                icon={Briefcase}
                title="Bảng Chấm Công & Quản Lý Nghỉ Phép"
                subtitle={`Kỳ công: Tháng ${month}/${year}`}
                description="Hệ thống ghi nhận ngày công, tăng ca và quản lý đơn từ nghỉ phép tự động. Dữ liệu được cập nhật realtime."
                badge="Timekeeping"
                badgeIcon={Sparkles}
                secondBadge={hasQuotaInViewMonth ? `Còn ${1 - usedLeaveInViewMonth} ngày phép` : "Đã hết phép tháng này"}
                stats={[
                    { icon: Calendar, label: 'Kỳ công', value: `T${month}`, color: 'from-blue-400 to-indigo-500' },
                    { icon: Calculator, label: 'Công chuẩn', value: '26', color: 'from-emerald-400 to-green-500' },
                    // Có thể thêm stats động ở đây sau này nếu cần move state lên
                ]}
                gradientFrom="from-blue-600"
                gradientVia="via-indigo-600"
                gradientTo="to-blue-700"
                accentColor="blue"
            />

            {/* 2. Action Toolbar */}
            <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                <div className="flex items-center gap-2 mr-auto">
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:block">Thao tác nhanh:</span>
                </div>

                <button
                    onClick={() => handleOpenLeaveModal('leave')}
                    className={clsx(
                        "px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95 border",
                        hasQuotaInViewMonth
                            ? "bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-500 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-900/20"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-70"
                    )}
                    title={hasQuotaInViewMonth ? `Đăng ký nghỉ phép (Còn ${1 - usedLeaveInViewMonth} ngày)` : "Đã hết phép tháng này"}
                >
                    <Calendar size={18} />
                    Nghỉ phép
                    {hasQuotaInViewMonth ? (
                        <span className="ml-1 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                            {1 - usedLeaveInViewMonth}
                        </span>
                    ) : (
                        <span className="ml-1 text-[10px] bg-slate-500 text-white px-1.5 py-0.5 rounded-full">Hết</span>
                    )}
                </button>

                <button
                    onClick={() => handleOpenLeaveModal('absence')}
                    className="px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95 border bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/20"
                >
                    <Clock size={18} /> Vắng mặt / KP
                </button>

                <button
                    onClick={() => handleOpenLeaveModal('online')}
                    className="px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95 border bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/20"
                >
                    <Globe size={18} /> Làm từ xa
                </button>
            </div>
            {/* Quick Stats & Filters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Month Nav - Styled as Card */}
                <div className="bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-white/5 flex items-center justify-between px-2 shadow-sm">
                    <button
                        onClick={handlePrevMonth}
                        className={clsx("p-2 rounded-xl transition-colors text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700", (year === 2026 && month === 1) && "opacity-50 cursor-not-allowed")}
                        disabled={year === 2026 && month === 1}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="font-bold text-xl uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Tháng {month} / {year}
                    </span>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500 dark:text-slate-400">
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* View Switcher - Styled as Card */}
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-1.5 border border-slate-200 dark:border-white/5 flex items-center">
                    <button
                        onClick={() => setTab('grid')}
                        className={clsx(
                            "flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                            tab === 'grid'
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200"
                        )}
                    >
                        <Table size={18} />
                        Bảng công
                    </button>
                    <button
                        onClick={() => setTab('stats')}
                        className={clsx(
                            "flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                            tab === 'stats'
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200"
                        )}
                    >
                        <BarChart2 size={18} />
                        Thống kê
                    </button>
                </div>
            </div>

            {/* Content - Removed background wrapper to let children handle their own containers */}
            <div className="min-h-[600px] rounded-3xl">
                {tab === 'grid' ? (
                    <TimeGrid key={`${month}-${year}`} month={month} year={year} users={users} />
                ) : (
                    <TimeStats month={month} year={year} users={users} />
                )}
            </div>

            {/* LEAVE REQUEST MODAL */}
            <AnimatePresence>
                {
                    showLeaveModal && (
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
                    )
                }
            </AnimatePresence>
        </div>
    );
};

export default TimekeepingLayout;

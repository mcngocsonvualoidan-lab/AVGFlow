import React, { useEffect, useState, useMemo } from 'react';
import { useMeetingSchedule, MEETING_ARCHIVES, CURRENT_MONTH_GID, MonthArchive } from '../../hooks/useMeetingSchedule';
import {
    Calendar, RefreshCw, Clock, MapPin, Users,
    Link as LinkIcon, ChevronDown, Sparkles, Zap,
    UserCheck, FileText, MoreHorizontal, Archive
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const MeetingSchedule: React.FC = () => {
    // Archive state
    const [selectedGid, setSelectedGid] = useState(CURRENT_MONTH_GID);
    const [showArchiveDropdown, setShowArchiveDropdown] = useState(false);

    // Get current selected archive info
    const currentArchive = MEETING_ARCHIVES.find(a => a.gid === selectedGid) || MEETING_ARCHIVES[0];
    const isViewingArchive = selectedGid !== CURRENT_MONTH_GID;

    // Info: Use the shared hook for data fetching with month/year filter
    const { meetings: sheetData, loading: isSyncing, refresh: fetchSheetData } = useMeetingSchedule(
        selectedGid,
        currentArchive.month,
        currentArchive.year
    );

    useEffect(() => {
        const interval = setInterval(fetchSheetData, 60000); // Auto refresh every minute
        return () => clearInterval(interval);
    }, [fetchSheetData]);

    const displayMeetings = sheetData;

    const handleSelectArchive = (archive: MonthArchive) => {
        setSelectedGid(archive.gid);
        setShowArchiveDropdown(false);
    };

    // Group meetings by date
    const groupedMeetings = useMemo(() => {
        const groups: { [key: string]: typeof displayMeetings } = {};
        displayMeetings.forEach(meeting => {
            if (!groups[meeting.date]) {
                groups[meeting.date] = [];
            }
            groups[meeting.date].push(meeting);
        });
        return groups;
    }, [displayMeetings]);

    const getMeetingStatus = (meeting: any) => {
        if (!meeting.date) return 'none';
        const dateParts = meeting.date.split('/');
        if (dateParts.length !== 3) return 'none';
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        const mDate = new Date(year, month, day);
        const now = new Date();
        const todayFn = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (mDate < todayFn) return 'past';
        if (mDate > todayFn) return 'planned';

        if (!meeting.startTime) return 'upcoming';
        const [h, m] = meeting.startTime.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return 'upcoming';
        const startMins = h * 60 + m;
        const nowMins = now.getHours() * 60 + now.getMinutes();
        let endMins = startMins + 60;
        if (meeting.endTime) {
            const [eh, em] = meeting.endTime.split(':').map(Number);
            if (!isNaN(eh)) endMins = eh * 60 + em;
        } else if (meeting.duration) {
            const dur = parseInt(meeting.duration);
            if (!isNaN(dur)) endMins = startMins + dur;
        }

        if (nowMins > endMins) return 'past';
        if (nowMins >= startMins && nowMins <= endMins) return 'ongoing';
        return 'upcoming';
    };

    const formatDateDisplay = (dateStr: string, dayStr: string) => {
        const parts = dateStr.split('/');
        if (parts.length !== 3) return { day: dayStr, date: dateStr, full: dateStr, dayNum: parts[0], month: parts[1], weekday: dayStr };

        return {
            day: dayStr,
            date: dateStr,
            dayNum: parts[0],
            month: parts[1],
            weekday: dayStr
        };
    };

    return (
        <div className="p-4 flex flex-col gap-6 h-auto min-h-screen pb-24 bg-gradient-to-br from-indigo-50/50 via-white to-cyan-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20">

            {/* Hero Banner */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 dark:from-indigo-900 dark:via-violet-900 dark:to-purple-950 shadow-2xl shadow-indigo-500/30"
            >
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-cyan-400/30 to-transparent rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-gradient-to-tr from-pink-500/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full" />
                </div>

                {/* Content */}
                <div className="relative z-10 p-8 md:p-10">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        {/* Left Content */}
                        <div className="flex-1 max-w-2xl">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="flex items-center gap-2 mb-4"
                            >
                                <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles size={12} className="text-yellow-300" />
                                    Tháng {currentArchive.month}/{currentArchive.year}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                                    <Zap size={12} />
                                    {displayMeetings.length} cuộc họp
                                </span>
                            </motion.div>

                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight"
                            >
                                Lịch Trao Đổi & Họp Công Việc
                            </motion.h2>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-white/70 text-sm md:text-base leading-relaxed mb-6"
                            >
                                Quản lý và theo dõi các cuộc họp, trao đổi công việc một cách hiệu quả.
                                Đồng bộ tự động từ Google Sheets cập nhật realtime.
                            </motion.p>
                        </div>

                        {/* Right Decorative Element / Stats */}
                        <div className="hidden lg:flex gap-3">
                            {[
                                { label: 'Đang diễn ra', count: displayMeetings.filter(m => getMeetingStatus(m) === 'ongoing').length, color: 'bg-emerald-500' },
                                { label: 'Sắp tới', count: displayMeetings.filter(m => ['upcoming', 'planned'].includes(getMeetingStatus(m))).length, color: 'bg-red-500' },
                                { label: 'Hoàn thành', count: displayMeetings.filter(m => getMeetingStatus(m) === 'past').length, color: 'bg-blue-500' },
                            ].map((stat, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 + (i * 0.1) }}
                                    className="flex flex-col items-center justify-center w-28 h-24 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10"
                                >
                                    <span className="text-3xl font-black text-white">{stat.count}</span>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className={`w-2 h-2 rounded-full ${stat.color}`} />
                                        <span className="text-[10px] text-white/70 uppercase font-bold">{stat.label}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Controls Section - Restored Old Style Dropdown */}
            <div className="flex flex-wrap justify-between items-center gap-4 sticky top-0 z-40 py-2 bg-transparent backdrop-blur-sm mask-image-gradient-b">
                <div className="flex items-center gap-3">
                    {/* Archive Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowArchiveDropdown(!showArchiveDropdown)}
                            className={clsx(
                                "group relative px-4 py-2.5 rounded-xl border shadow-lg transition-all duration-300 overflow-hidden flex items-center gap-3 font-semibold text-sm backdrop-blur-sm",
                                isViewingArchive
                                    ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-700 dark:text-amber-300 border-amber-300/50 dark:border-amber-500/30 hover:shadow-amber-500/20"
                                    : "bg-gradient-to-r from-indigo-500/5 to-cyan-500/5 hover:from-indigo-500/10 hover:to-cyan-500/10 text-slate-700 dark:text-slate-200 border-indigo-200/50 dark:border-indigo-500/20 hover:shadow-indigo-500/20"
                            )}
                        >
                            <div className={clsx(
                                "p-1.5 rounded-lg transition-colors",
                                isViewingArchive
                                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                    : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                            )}>
                                <Calendar size={16} />
                            </div>
                            <span className="font-bold">{currentArchive.label}</span>
                            <motion.div
                                animate={{ rotate: showArchiveDropdown ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown size={16} className="text-slate-400" />
                            </motion.div>
                        </button>

                        <AnimatePresence>
                            {showArchiveDropdown && (
                                <>
                                    {/* Backdrop */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowArchiveDropdown(false)}
                                    />

                                    <motion.div
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                                        className="absolute top-full left-0 mt-3 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-2xl shadow-slate-900/10 dark:shadow-black/30 z-50 overflow-hidden"
                                    >
                                        {/* Header */}
                                        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-gradient-to-r from-indigo-500/5 to-cyan-500/5">
                                            <div className="flex items-center gap-2">
                                                <div className="text-indigo-500"><Archive size={14} /></div>
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    Lịch sử các tháng
                                                </span>
                                            </div>
                                        </div>

                                        {/* Options */}
                                        <div className="p-2 space-y-1">
                                            {MEETING_ARCHIVES.map((archive, index) => {
                                                const isSelected = selectedGid === archive.gid;
                                                const isCurrent = archive.gid === CURRENT_MONTH_GID;

                                                return (
                                                    <motion.button
                                                        key={archive.gid}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        onClick={() => handleSelectArchive(archive)}
                                                        className={clsx(
                                                            "w-full px-3 py-3 rounded-xl text-left text-sm font-medium transition-all duration-200 flex items-center gap-3 group/item",
                                                            isSelected
                                                                ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/30"
                                                                : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
                                                        )}
                                                    >
                                                        <div className={clsx(
                                                            "p-2 rounded-lg transition-colors",
                                                            isSelected
                                                                ? "bg-white/20"
                                                                : "bg-slate-100 dark:bg-white/5 group-hover/item:bg-indigo-100 dark:group-hover/item:bg-indigo-500/20"
                                                        )}>
                                                            <Calendar size={16} className={isSelected ? "text-white" : "text-indigo-500"} />
                                                        </div>

                                                        <div className="flex-1">
                                                            <div className={clsx(
                                                                "font-bold",
                                                                isSelected ? "text-white" : ""
                                                            )}>
                                                                {archive.label}
                                                            </div>
                                                            <div className={clsx(
                                                                "text-xs mt-0.5",
                                                                isSelected ? "text-white/70" : "text-slate-400"
                                                            )}>
                                                                {isCurrent ? "Tháng hiện tại" : "Lịch sử lưu trữ"}
                                                            </div>
                                                        </div>

                                                        {isCurrent && (
                                                            <span className={clsx(
                                                                "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide",
                                                                isSelected
                                                                    ? "bg-white/20 text-white"
                                                                    : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm"
                                                            )}>
                                                                Live
                                                            </span>
                                                        )}

                                                        {isSelected && (
                                                            <motion.div
                                                                initial={{ scale: 0 }}
                                                                animate={{ scale: 1 }}
                                                                className="w-2 h-2 rounded-full bg-white shadow-lg"
                                                            />
                                                        )}
                                                    </motion.button>
                                                );
                                            })}
                                        </div>

                                        {/* Footer hint */}
                                        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                                                Chọn tháng để xem lịch trao đổi tương ứng
                                            </p>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {isViewingArchive && (
                        <button
                            onClick={() => setSelectedGid(CURRENT_MONTH_GID)}
                            className="text-xs font-bold text-amber-600 hover:underline bg-amber-50 px-3 py-2 rounded-lg border border-amber-100"
                        >
                            Về tháng hiện tại
                        </button>
                    )}
                </div>

                <button
                    onClick={fetchSheetData}
                    disabled={isSyncing}
                    className="hidden group px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl hover:bg-white text-slate-700 dark:text-slate-200 rounded-xl border border-white/40 dark:border-white/10 shadow-sm transition-all flex items-center gap-2 text-sm font-semibold"
                >
                    <RefreshCw size={16} className={clsx("transition-transform duration-700", isSyncing && "animate-spin")} />
                    <span>Làm mới</span>
                </button>
            </div>

            {/* Timeline View */}
            <div className="relative max-w-5xl mx-auto w-full px-2 md:px-0">
                {displayMeetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/5">
                        <div className="w-24 h-24 rounded-full bg-indigo-50 dark:bg-slate-700/50 flex items-center justify-center mb-4 text-indigo-300">
                            <Calendar size={48} />
                        </div>
                        <p className="text-slate-500 font-medium">Chưa có lịch họp nào trong tháng này.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-10">
                        {Object.entries(groupedMeetings).map(([date, meetings], groupIndex) => {
                            const dateInfo = formatDateDisplay(date, meetings[0].day);

                            return (
                                <motion.div
                                    key={date}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: groupIndex * 0.1 }}
                                    className="flex flex-col md:flex-row gap-6 relative"
                                >
                                    {/* Timeline Line (Desktop) */}
                                    <div className="absolute left-[130px] top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/20 via-indigo-500/10 to-transparent hidden md:block" />

                                    {/* Date Column */}
                                    <div className="w-full md:w-[130px] md:text-right flex-shrink-0 flex md:flex-col flex-row items-center md:items-end justify-between md:justify-start gap-2 md:gap-0 sticky top-20 z-10 md:static">
                                        <div className="flex flex-col items-center md:items-end bg-white/80 dark:bg-slate-800/60 backdrop-blur-md p-2 md:p-3 rounded-xl shadow-sm border border-indigo-100/50 dark:border-white/10 md:mr-6 transition-transform hover:scale-105 duration-300">
                                            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">{dateInfo.weekday}</span>
                                            <span className="text-4xl font-black text-slate-800 dark:text-white leading-none my-1">{dateInfo.dayNum}</span>
                                            <span className="text-sm font-medium text-slate-400">Tháng {dateInfo.month}</span>
                                        </div>

                                        {/* Mobile Timeline Dot */}
                                        <div className="md:hidden h-px flex-1 bg-indigo-200 mx-4"></div>
                                    </div>

                                    {/* Event Cards */}
                                    <div className="flex-1 space-y-6">
                                        {meetings.map((meeting: any, idx) => {
                                            const status = getMeetingStatus(meeting);

                                            return (
                                                <div key={idx} className="relative pl-0 md:pl-8 group">
                                                    {/* Timeline Dot (Desktop) */}
                                                    <div className={clsx(
                                                        "hidden md:block absolute left-[-5px] top-6 w-3 h-3 rounded-full border-2 z-20 transition-all duration-300",
                                                        status === 'ongoing' ? "bg-emerald-500 border-white shadow-[0_0_0_4px_rgba(16,185,129,0.2)] scale-125" :
                                                            status === 'upcoming' ? "bg-red-500 border-white animate-pulse" :
                                                                status === 'past' ? "bg-blue-500 border-white" :
                                                                    "bg-white border-slate-300" // planned
                                                    )} />

                                                    <div className={clsx(
                                                        "relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                                                        status === 'ongoing' ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-500/20 shadow-lg shadow-emerald-500/10" :
                                                            status === 'upcoming' ? "bg-red-50/50 dark:bg-red-900/10 border-red-200/60 dark:border-red-500/20 shadow-lg shadow-red-500/10" :
                                                                status === 'past' ? "bg-blue-50/30 dark:bg-blue-900/10 border-blue-200/40 dark:border-blue-500/10 opacity-90" :
                                                                    "bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-white/60 dark:border-white/10 shadow-sm hover:shadow-indigo-500/10"
                                                    )}>

                                                        {/* Card Header */}
                                                        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-black/5 dark:border-white/5 bg-white/30 dark:bg-white/5">
                                                            <div className={clsx(
                                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm",
                                                                status === 'ongoing' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                                                    "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30"
                                                            )}>
                                                                <Clock size={14} className={status === 'ongoing' ? "text-emerald-600" : "text-blue-500"} />
                                                                {meeting.startTime}
                                                                {meeting.endTime && <span className="opacity-70"> - {meeting.endTime}</span>}
                                                            </div>

                                                            <span className="px-2.5 py-1 rounded-md bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 text-xs font-bold border border-cyan-100 dark:border-cyan-500/30 flex items-center gap-1.5">
                                                                <MapPin size={12} />
                                                                {meeting.scope}
                                                            </span>

                                                            <div className="ml-auto">
                                                                {status === 'ongoing' && <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 animate-pulse"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Đang diễn ra</span>}
                                                                {status === 'upcoming' && <span className="flex items-center gap-1.5 text-xs font-bold text-red-600"><span className="w-2 h-2 rounded-full bg-red-500 animate-ping" /> Sắp tới</span>}
                                                                {status === 'past' && <span className="flex items-center gap-1.5 text-xs font-bold text-blue-500"><span className="w-2 h-2 rounded-full bg-blue-400" /> Đã diễn ra</span>}
                                                                {status === 'planned' && <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400"><span className="w-2 h-2 rounded-full bg-white border border-slate-300" /> Đang chờ</span>}
                                                            </div>
                                                        </div>

                                                        {/* Card Body */}
                                                        <div className="p-5 grid gap-4">
                                                            <div>
                                                                <h3 className={clsx(
                                                                    "text-lg font-bold leading-snug mb-2",
                                                                    status === 'past' ? "text-slate-600 dark:text-slate-400" : "text-slate-800 dark:text-white"
                                                                )}>
                                                                    {meeting.content}
                                                                </h3>

                                                                {/* Optional Link */}
                                                                {meeting.link && (
                                                                    <a href={meeting.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-100">
                                                                        <LinkIcon size={12} /> Tài liệu đính kèm
                                                                    </a>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {/* Participants */}
                                                                <div className="space-y-1.5">
                                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                                        <Users size={12} /> Thành phần
                                                                    </div>
                                                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-white/50 dark:bg-white/5 p-2.5 rounded-lg border border-slate-100 dark:border-white/5">
                                                                        {meeting.participants || "Toàn bộ nhân sự"}
                                                                    </p>
                                                                </div>

                                                                {/* PIC */}
                                                                <div className="space-y-1.5">
                                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                                        <UserCheck size={12} /> Người điều hành
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-8 min-w-8 px-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-amber-500/20 whitespace-nowrap">
                                                                            {meeting.pic || 'U'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Footer: Secretary & Note */}
                                                            {(meeting.secretary || meeting.note) && (
                                                                <div className="flex flex-wrap items-start gap-4 pt-4 mt-2 border-t border-slate-100 dark:border-white/5">
                                                                    {meeting.secretary && (
                                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 text-xs text-purple-700 dark:text-purple-300 font-medium">
                                                                            <FileText size={12} className="text-purple-500" />
                                                                            Thư ký: <span className="font-bold">{meeting.secretary}</span>
                                                                        </div>
                                                                    )}
                                                                    {meeting.note && (
                                                                        <div className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 italic max-w-full">
                                                                            <MoreHorizontal size={12} className="shrink-0 mt-0.5" />
                                                                            <span>{meeting.note}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MeetingSchedule;

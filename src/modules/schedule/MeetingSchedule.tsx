import React, { useEffect, useState } from 'react';
import { useMeetingSchedule, MEETING_ARCHIVES, CURRENT_MONTH_GID, MonthArchive } from '../../hooks/useMeetingSchedule';
import { Calendar, RefreshCw, Clock, MapPin, Users, AlignLeft, User, Link as LinkIcon, Archive, ChevronDown } from 'lucide-react';
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
    const { meetings: sheetData, loading: isSyncing, error: syncError, refresh: fetchSheetData } = useMeetingSchedule(
        selectedGid,
        currentArchive.month,
        currentArchive.year
    );

    // Auto-refresh interval is managed inside the hook if needed, 
    // but the hook currently just fetches once. We can add interval here if we want strictly 
    // live updates, but the hook default behavior is fine. 
    // Let's keep the manual interval here for consistency with previous behavior if desirable, 
    // or rely on manual refresh. The previous code had a generic setInterval.

    useEffect(() => {
        const interval = setInterval(fetchSheetData, 60000); // Auto refresh every minute
        return () => clearInterval(interval);
    }, [fetchSheetData]);

    const displayMeetings = sheetData;

    const handleSelectArchive = (archive: MonthArchive) => {
        setSelectedGid(archive.gid);
        setShowArchiveDropdown(false);
    };

    return (
        <div className="p-4 flex flex-col gap-6 h-auto min-h-screen pb-24 bg-gradient-to-br from-indigo-50/50 via-white to-cyan-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 relative z-10">
                <div>
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3"
                    >
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                            <Calendar className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-600 dark:from-indigo-400 dark:to-cyan-400">
                                Lịch Trao Đổi
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                                    <RefreshCw size={10} className={isSyncing ? "animate-spin" : ""} />
                                    {isSyncing ? "Đang đồng bộ..." : "Đã cập nhật"}
                                </span>
                                {syncError && <span className="text-red-500 text-xs font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100">{syncError}</span>}
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Archive Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowArchiveDropdown(!showArchiveDropdown)}
                            className={clsx(
                                "group relative px-4 py-2.5 rounded-xl border shadow-sm transition-all overflow-hidden flex items-center gap-2 font-semibold text-sm",
                                isViewingArchive
                                    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 hover:bg-amber-100"
                                    : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10"
                            )}
                        >
                            <Archive size={18} className={isViewingArchive ? "text-amber-600" : ""} />
                            <span>{currentArchive.label}</span>
                            <ChevronDown size={16} className={clsx("transition-transform", showArchiveDropdown && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                            {showArchiveDropdown && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 shadow-xl z-50 overflow-hidden"
                                >
                                    <div className="p-2">
                                        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1.5">
                                            Lịch sử các tháng
                                        </div>
                                        {MEETING_ARCHIVES.map((archive) => (
                                            <button
                                                key={archive.gid}
                                                onClick={() => handleSelectArchive(archive)}
                                                className={clsx(
                                                    "w-full px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-all flex items-center gap-2",
                                                    selectedGid === archive.gid
                                                        ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                                                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
                                                )}
                                            >
                                                <Calendar size={14} />
                                                {archive.label}
                                                {archive.gid === CURRENT_MONTH_GID && (
                                                    <span className="ml-auto text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">Hiện tại</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button
                        onClick={fetchSheetData}
                        disabled={isSyncing}
                        className="group relative px-5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm transition-all overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
                        <span className="relative flex items-center gap-2 font-semibold text-sm">
                            <RefreshCw size={18} className={clsx("transition-transform duration-700", isSyncing && "animate-spin")} />
                            Làm mới
                        </span>
                    </button>
                    <div className="h-10 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden md:block"></div>
                </div>
            </div>

            {/* Archive Banner */}
            <AnimatePresence>
                {isViewingArchive && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                            <Archive size={18} className="text-amber-600 dark:text-amber-400" />
                            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                Bạn đang xem <strong>{currentArchive.label}</strong> (Lịch sử lưu trữ)
                            </span>
                            <button
                                onClick={() => setSelectedGid(CURRENT_MONTH_GID)}
                                className="ml-auto text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 underline"
                            >
                                Quay lại tháng hiện tại →
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Legend Bubbles */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-wrap gap-3"
            >
                {[
                    { label: 'Đang diễn ra', color: 'bg-emerald-500', shadow: 'shadow-emerald-500/40', ring: 'ring-emerald-500/20' },
                    { label: 'Sắp diễn ra', color: 'bg-red-500', shadow: 'shadow-red-500/40', ring: 'ring-red-500/20' },
                    { label: 'Đã kết thúc', color: 'bg-slate-400', shadow: 'shadow-slate-400/40', ring: 'ring-slate-400/20' },
                ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/5 shadow-sm">
                        <span className={clsx("w-2.5 h-2.5 rounded-full shadow-lg ring-2", item.color, item.shadow, item.ring)} />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{item.label}</span>
                    </div>
                ))}
            </motion.div>

            {/* Main Table Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="w-full relative rounded-2xl border border-white/50 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-2xl overflow-hidden"
            >
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 opacity-80" />
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="border-b border-indigo-100/50 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                <th className="p-4 text-center w-14 font-extrabold text-slate-400 text-xs uppercase tracking-wider">#</th>
                                <th className="p-4 text-left w-32 font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                                    <div className="flex items-center gap-2"><MapPin size={14} className="text-indigo-500" /> Phạm vi</div>
                                </th>
                                <th className="p-4 text-center w-24 font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-2"><Calendar size={14} className="text-cyan-500" /> Thời gian</div>
                                </th>
                                <th className="p-4 text-center w-32 font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-2"><Clock size={14} className="text-emerald-500" /> Khung giờ</div>
                                </th>
                                <th className="p-4 w-[25%] font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                                    <div className="flex items-center gap-2"><AlignLeft size={14} className="text-violet-500" /> Nội dung</div>
                                </th>
                                <th className="p-4 text-center w-24 font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                                    <div className="flex items-center justify-center gap-2"><User size={14} className="text-amber-500" /> NĐH</div>
                                </th>
                                <th className="p-4 w-[15%] font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                                    <div className="flex items-center gap-2"><Users size={14} className="text-blue-500" /> Thành phần</div>
                                </th>
                                <th className="p-4 text-center w-20 font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Thư ký</th>
                                <th className="p-4 w-[10%] font-bold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-indigo-50/50 dark:divide-white/5">
                            {(() => {
                                let foundNearest = false;
                                return displayMeetings.map((meeting, index) => {
                                    // Status Logic
                                    const getStatus = () => {
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
                                        if (mDate > todayFn) return 'upcoming';

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

                                    let status = getStatus();
                                    if (status === 'upcoming' && !foundNearest) {
                                        foundNearest = true;
                                        status = 'urgent';
                                    }

                                    return (
                                        <motion.tr
                                            key={meeting.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={clsx(
                                                "group transition-all duration-300 relative",
                                                status === 'ongoing' ? "bg-emerald-50/80 dark:bg-emerald-500/10 hover:bg-emerald-100/80" :
                                                    status === 'urgent' ? "bg-white dark:bg-white/5 hover:bg-red-50/50 dark:hover:bg-red-900/10" :
                                                        status === 'past' ? "opacity-60 hover:opacity-100 bg-slate-50/50 dark:bg-white/5 grayscale hover:grayscale-0" :
                                                            "bg-white/40 dark:bg-transparent hover:bg-indigo-50/50 dark:hover:bg-white/5"
                                            )}
                                        >
                                            {/* Status Bar Indicator */}
                                            <td className="relative p-0">
                                                <div className={clsx(
                                                    "absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5",
                                                    status === 'ongoing' ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" :
                                                        status === 'urgent' ? "bg-red-500 shadow-[0_0_10px_#ef4444]" :
                                                            "bg-transparent group-hover:bg-indigo-400"
                                                )} />
                                                <div className="flex items-center justify-center py-4 font-mono text-xs text-slate-400 font-bold group-hover:text-indigo-500">
                                                    {index + 1}
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <div className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-sm">
                                                    {meeting.scope}
                                                </div>
                                            </td>

                                            <td className="p-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{meeting.day}</span>
                                                    <span className="text-sm font-mono font-bold text-slate-700 dark:text-white bg-white/50 dark:bg-white/10 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 mt-1 shadow-sm">
                                                        {meeting.date}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="p-4 text-center">
                                                <div className={clsx(
                                                    "flex items-center justify-center gap-1.5 font-mono text-sm font-bold px-2 py-1 rounded-lg border",
                                                    status === 'ongoing' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                                        status === 'urgent' ? "bg-red-50 text-red-600 border-red-100" :
                                                            "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                                )}>
                                                    <span>{meeting.startTime}</span>
                                                    <span className="text-slate-300 dark:text-slate-600 mx-0.5">|</span>
                                                    <span className="text-slate-400 dark:text-slate-500 text-xs">{meeting.endTime}</span>
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <p className="font-medium text-slate-800 dark:text-slate-100 text-sm leading-relaxed whitespace-pre-wrap group-hover:text-indigo-900 dark:group-hover:text-white transition-colors">
                                                    {meeting.content}
                                                </p>
                                                {meeting.link && (
                                                    <a href={meeting.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded mt-2 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                                                        <LinkIcon size={12} /> Tài liệu đính kèm
                                                    </a>
                                                )}
                                            </td>

                                            <td className="p-4 text-center">
                                                <span className="inline-block px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-xs font-bold dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20">
                                                    {meeting.pic}
                                                </span>
                                            </td>

                                            <td className="p-4">
                                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                                                    {meeting.participants}
                                                </p>
                                            </td>

                                            <td className="p-4 text-center">
                                                <div className="text-xs font-semibold text-pink-600 dark:text-pink-400 flex items-center justify-center gap-1">
                                                    {meeting.secretary}
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <span className="text-xs text-slate-400 italic">
                                                    {meeting.note}
                                                </span>
                                            </td>
                                        </motion.tr>
                                    );
                                });
                            })()}

                            {displayMeetings.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="p-20 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4 text-slate-300 dark:text-slate-600">
                                            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                                                <Calendar size={40} />
                                            </div>
                                            <p className="font-medium">{isSyncing ? "Đang đồng bộ dữ liệu..." : "Chưa có lịch họp nào."}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};

export default MeetingSchedule;

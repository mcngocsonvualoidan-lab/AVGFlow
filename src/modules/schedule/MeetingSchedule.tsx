import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useMeetingSchedule, MEETING_ARCHIVES, CURRENT_MONTH_GID, MonthArchive } from '../../hooks/useMeetingSchedule';
import {
    Calendar, Clock, MapPin, Users,
    Link as LinkIcon, ChevronDown, Sparkles, Zap,
    UserCheck, FileText, MoreHorizontal, Archive,
    LayoutGrid, List, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const MeetingSchedule: React.FC = () => {
    // Archive state
    const [selectedGid, setSelectedGid] = useState(CURRENT_MONTH_GID);
    const [showArchiveDropdown, setShowArchiveDropdown] = useState(false);
    const [viewMode, setViewMode] = useState<'card' | 'grid'>('card');
    const [selectedMeeting, setSelectedMeeting] = useState<any>(null);

    // Get current selected archive info
    const currentArchive = MEETING_ARCHIVES.find(a => a.gid === selectedGid) || MEETING_ARCHIVES[0];
    const isViewingArchive = selectedGid !== CURRENT_MONTH_GID;

    // Info: Use the shared hook for data fetching with month/year filter
    const { meetings: sheetData, loading: _isSyncing, refresh: fetchSheetData } = useMeetingSchedule(
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

    // Ref for auto-scrolling to first active meeting group
    const firstActiveGroupRef = useRef<HTMLDivElement>(null);
    const hasScrolledRef = useRef(false);

    // Reset scroll flag when switching archive months
    useEffect(() => {
        hasScrolledRef.current = false;
    }, [selectedGid]);

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

    // Sort grouped entries chronologically (ascending by date)
    const sortedGroupedEntries = useMemo(() => {
        const entries = Object.entries(groupedMeetings);

        // Parse date DD/MM/YYYY for chronological sorting
        const parseDate = (dateStr: string) => {
            const parts = dateStr.split('/');
            if (parts.length !== 3) return 0;
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
        };

        return entries.sort((a, b) => parseDate(a[0]) - parseDate(b[0]));
    }, [groupedMeetings]);

    // Find index of first active (non-past) group
    const firstActiveGroupIndex = useMemo(() => {
        return sortedGroupedEntries.findIndex(([_, meetings]) => {
            return (meetings as any[]).some(m => ['ongoing', 'upcoming', 'planned'].includes(getMeetingStatus(m)));
        });
    }, [sortedGroupedEntries]);

    // Auto-scroll to first active group when data loads
    useEffect(() => {
        if (!hasScrolledRef.current && firstActiveGroupRef.current && displayMeetings.length > 0 && firstActiveGroupIndex >= 0) {
            hasScrolledRef.current = true;
            // Wait for Layout's scroll-to-top and animations to complete before scrolling
            const scrollTimer = setTimeout(() => {
                if (firstActiveGroupRef.current) {
                    const element = firstActiveGroupRef.current;
                    // The actual scroll container is the <main> element with overflow-y-auto in Layout
                    const scrollContainer = element.closest('main') || element.closest('[class*="overflow-y-auto"]');
                    if (scrollContainer) {
                        const containerRect = scrollContainer.getBoundingClientRect();
                        const elementRect = element.getBoundingClientRect();
                        const scrollTop = scrollContainer.scrollTop + (elementRect.top - containerRect.top) - 20;
                        scrollContainer.scrollTo({
                            top: scrollTop,
                            behavior: 'smooth'
                        });
                    } else {
                        // Fallback to scrollIntoView
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }, 800);
            return () => clearTimeout(scrollTimer);
        }
    }, [displayMeetings, firstActiveGroupIndex]);

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

                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl border border-white/40 dark:border-white/10 shadow-sm p-1">
                    <button
                        onClick={() => setViewMode('card')}
                        className={clsx(
                            "p-2 rounded-lg transition-all text-sm font-semibold flex items-center gap-1.5",
                            viewMode === 'card'
                                ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10"
                        )}
                        title="Chế độ Thẻ"
                    >
                        <List size={16} />
                        <span className="hidden sm:inline">Thẻ</span>
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={clsx(
                            "p-2 rounded-lg transition-all text-sm font-semibold flex items-center gap-1.5",
                            viewMode === 'grid'
                                ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10"
                        )}
                        title="Chế độ Lưới"
                    >
                        <LayoutGrid size={16} />
                        <span className="hidden sm:inline">Lưới</span>
                    </button>
                </div>
            </div>

            {/* Meeting Detail Modal for Grid View */}
            <AnimatePresence>
                {selectedMeeting && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedMeeting(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-white/10 overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            {(() => {
                                const ms = getMeetingStatus(selectedMeeting);
                                const colorMap = {
                                    ongoing: { bg: 'from-emerald-500 to-teal-600', text: 'text-emerald-600', label: 'Đang diễn ra' },
                                    upcoming: { bg: 'from-rose-500 to-red-600', text: 'text-red-600', label: 'Sắp tới' },
                                    planned: { bg: 'from-indigo-500 to-violet-600', text: 'text-indigo-600', label: 'Đang chờ' },
                                    past: { bg: 'from-amber-500 to-orange-600', text: 'text-amber-600', label: 'Đã diễn ra' },
                                    none: { bg: 'from-slate-400 to-slate-500', text: 'text-slate-500', label: '' },
                                };
                                const c = colorMap[ms] || colorMap.none;
                                return (
                                    <>
                                        {/* Modal Header */}
                                        <div className={`bg-gradient-to-r ${c.bg} p-5 relative`}>
                                            <button onClick={() => setSelectedMeeting(null)} className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors">
                                                <X size={20} />
                                            </button>
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="text-white/80 text-xs font-bold uppercase tracking-wider">{selectedMeeting.day} - {selectedMeeting.date}</div>
                                                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold">{c.label}</span>
                                            </div>
                                            <h3 className="text-xl font-black text-white leading-snug">{selectedMeeting.content || 'Không có nội dung'}</h3>
                                        </div>

                                        {/* Modal Body */}
                                        <div className="p-5 space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                                    <Clock size={14} className={c.text} />
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedMeeting.startTime || '—'}{selectedMeeting.endTime ? ` - ${selectedMeeting.endTime}` : ''}</span>
                                                </div>
                                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                                    <MapPin size={14} className="text-cyan-500" />
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedMeeting.scope || '—'}</span>
                                                </div>
                                            </div>

                                            {selectedMeeting.participants && (
                                                <div>
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5"><Users size={12} /> Thành phần</div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/5">{selectedMeeting.participants}</p>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-3">
                                                {selectedMeeting.pic && (
                                                    <div>
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5"><UserCheck size={12} /> Người điều hành</div>
                                                        <div className="h-8 min-w-8 px-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 inline-flex items-center justify-center text-white text-xs font-bold shadow-md">{selectedMeeting.pic}</div>
                                                    </div>
                                                )}
                                                {selectedMeeting.secretary && (
                                                    <div>
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5"><FileText size={12} /> Thư ký</div>
                                                        <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">{selectedMeeting.secretary}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {selectedMeeting.note && (
                                                <div className="text-sm text-slate-500 dark:text-slate-400 italic border-t border-slate-100 dark:border-white/5 pt-3 flex items-start gap-1.5">
                                                    <MoreHorizontal size={14} className="shrink-0 mt-0.5" />
                                                    <span>{selectedMeeting.note}</span>
                                                </div>
                                            )}

                                            {selectedMeeting.link && (
                                                <a href={selectedMeeting.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg border border-blue-100 transition-colors">
                                                    <LinkIcon size={12} /> Tài liệu đính kèm
                                                </a>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Content Area */}
            <div className="relative max-w-5xl mx-auto w-full px-2 md:px-0">
                {displayMeetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/5">
                        <div className="w-24 h-24 rounded-full bg-indigo-50 dark:bg-slate-700/50 flex items-center justify-center mb-4 text-indigo-300">
                            <Calendar size={48} />
                        </div>
                        <p className="text-slate-500 font-medium">Chưa có lịch họp nào trong tháng này.</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* ===== GRID VIEW ===== */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayMeetings.map((meeting: any, idx) => {
                            const status = getMeetingStatus(meeting);
                            const gridColors = {
                                ongoing: {
                                    card: 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200/70 dark:border-emerald-500/25 hover:shadow-emerald-500/15',
                                    accent: 'from-emerald-500 to-teal-600',
                                    dot: 'bg-emerald-500',
                                    text: 'text-emerald-700 dark:text-emerald-300',
                                    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                    label: 'Đang diễn ra',
                                },
                                upcoming: {
                                    card: 'bg-red-50 dark:bg-red-900/15 border-red-200/70 dark:border-red-500/25 hover:shadow-red-500/15',
                                    accent: 'from-rose-500 to-red-600',
                                    dot: 'bg-red-500',
                                    text: 'text-red-700 dark:text-red-300',
                                    badge: 'bg-red-100 text-red-700 border-red-200',
                                    label: 'Sắp tới',
                                },
                                planned: {
                                    card: 'bg-indigo-50 dark:bg-indigo-900/15 border-indigo-200/70 dark:border-indigo-500/25 hover:shadow-indigo-500/15',
                                    accent: 'from-indigo-500 to-violet-600',
                                    dot: 'bg-indigo-500',
                                    text: 'text-indigo-700 dark:text-indigo-300',
                                    badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                                    label: 'Đang chờ',
                                },
                                past: {
                                    card: 'bg-amber-50 dark:bg-amber-900/15 border-amber-200/70 dark:border-amber-500/25 hover:shadow-amber-500/15',
                                    accent: 'from-amber-500 to-orange-600',
                                    dot: 'bg-amber-500',
                                    text: 'text-amber-700 dark:text-amber-300',
                                    badge: 'bg-amber-100 text-amber-700 border-amber-200',
                                    label: 'Đã diễn ra',
                                },
                                none: {
                                    card: 'bg-slate-50 dark:bg-slate-900/15 border-slate-200/70 dark:border-slate-500/25 hover:shadow-slate-500/15',
                                    accent: 'from-slate-400 to-slate-500',
                                    dot: 'bg-slate-400',
                                    text: 'text-slate-500 dark:text-slate-400',
                                    badge: 'bg-slate-100 text-slate-600 border-slate-200',
                                    label: '',
                                },
                            };
                            const gc = gridColors[status];

                            return (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    onClick={() => setSelectedMeeting(meeting)}
                                    className={clsx(
                                        "relative rounded-2xl border cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden group",
                                        gc.card
                                    )}
                                >
                                    {/* Color accent top bar */}
                                    <div className={`h-1.5 bg-gradient-to-r ${gc.accent}`} />

                                    <div className="p-4">
                                        {/* Date + Status Row */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gc.accent} flex items-center justify-center text-white font-black text-sm shadow-md`}>
                                                    {meeting.date?.split('/')[0]}
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{meeting.day}</div>
                                                    <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold">{meeting.date}</div>
                                                </div>
                                            </div>
                                            <span className={clsx("flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border", gc.badge)}>
                                                <span className={clsx("w-1.5 h-1.5 rounded-full", gc.dot, status === 'ongoing' && 'animate-pulse')} />
                                                {gc.label}
                                            </span>
                                        </div>

                                        {/* Time */}
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2">
                                            <Clock size={12} className={gc.text} />
                                            <span className="font-semibold">{meeting.startTime || '—'}{meeting.endTime ? ` - ${meeting.endTime}` : ''}</span>
                                            {meeting.scope && (
                                                <>
                                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                                    <MapPin size={12} className="text-cyan-500" />
                                                    <span className="font-medium truncate">{meeting.scope}</span>
                                                </>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <p className="text-sm font-bold text-slate-800 dark:text-white leading-snug line-clamp-2 group-hover:line-clamp-none transition-all">
                                            {meeting.content || 'Không có nội dung'}
                                        </p>

                                        {/* PIC */}
                                        {meeting.pic && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <div className="h-6 min-w-6 px-2 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                                                    {meeting.pic}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col gap-10">
                        {sortedGroupedEntries.map(([date, meetings], groupIndex) => {
                            const dateInfo = formatDateDisplay(date, (meetings as any[])[0].day);
                            const isFirstActive = groupIndex === firstActiveGroupIndex;

                            // Determine dominant status for the date group
                            const statuses = (meetings as any[]).map(m => getMeetingStatus(m));
                            const dominantStatus = statuses.includes('ongoing') ? 'ongoing'
                                : statuses.includes('upcoming') ? 'upcoming'
                                : statuses.includes('planned') ? 'planned'
                                : 'past';

                            // Color mapping for date card
                            const dateCardColors = {
                                ongoing: {
                                    gradient: 'from-emerald-500 to-teal-600',
                                    shadow: 'shadow-emerald-500/30',
                                    tint: 'text-emerald-100',
                                    mobileLine: 'from-emerald-400',
                                },
                                upcoming: {
                                    gradient: 'from-rose-500 to-red-600',
                                    shadow: 'shadow-rose-500/30',
                                    tint: 'text-rose-100',
                                    mobileLine: 'from-rose-400',
                                },
                                planned: {
                                    gradient: 'from-indigo-500 to-violet-600',
                                    shadow: 'shadow-indigo-500/30',
                                    tint: 'text-indigo-100',
                                    mobileLine: 'from-indigo-400',
                                },
                                past: {
                                    gradient: 'from-amber-500 to-orange-600',
                                    shadow: 'shadow-amber-500/30',
                                    tint: 'text-amber-100',
                                    mobileLine: 'from-amber-400',
                                },
                            };
                            const colors = dateCardColors[dominantStatus];

                            return (
                                <motion.div
                                    key={date}
                                    ref={isFirstActive ? firstActiveGroupRef : undefined}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: groupIndex * 0.1 }}
                                    className="flex flex-col md:flex-row gap-6 relative"
                                >
                                    {/* Timeline Line (Desktop) */}
                                    <div className="absolute left-[130px] top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/20 via-indigo-500/10 to-transparent hidden md:block" />

                                    {/* Date Column */}
                                    <div className="w-full md:w-[130px] md:text-right flex-shrink-0 flex md:flex-col flex-row items-center md:items-end justify-between md:justify-start gap-2 md:gap-0">
                                        <div className={clsx(
                                            "flex flex-col items-center md:items-end p-2.5 md:p-3.5 rounded-2xl border border-white/20 md:mr-6 transition-all hover:scale-105 duration-300 relative overflow-hidden group",
                                            `bg-gradient-to-br ${colors.gradient} shadow-lg ${colors.shadow}`
                                        )}>
                                            <div className="absolute top-0 left-0 w-16 h-16 bg-white/20 rounded-full blur-xl -translate-y-1/2 -translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
                                            <div className="absolute bottom-0 right-0 w-12 h-12 bg-white/10 rounded-full blur-lg translate-y-1/4 translate-x-1/4 group-hover:scale-150 transition-transform duration-500"></div>
                                            <span className={clsx("text-[11px] md:text-xs font-bold uppercase tracking-wider relative z-10", colors.tint)}>{dateInfo.weekday}</span>
                                            <span className="text-4xl md:text-5xl font-black text-white leading-none my-1 drop-shadow-md relative z-10">{dateInfo.dayNum}</span>
                                            <span className={clsx("text-xs md:text-sm font-medium relative z-10", colors.tint)}>Tháng {dateInfo.month}</span>
                                        </div>

                                        {/* Mobile Timeline Dot */}
                                        <div className={clsx("md:hidden h-0.5 flex-1 bg-gradient-to-r to-transparent mx-4 rounded-full opacity-50", colors.mobileLine)}></div>
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
                                                                status === 'past' ? "bg-amber-500 border-white" :
                                                                    "bg-indigo-500 border-white" // planned
                                                    )} />

                                                    <div className={clsx(
                                                        "relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                                                        status === 'ongoing' ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-500/20 shadow-lg shadow-emerald-500/10" :
                                                            status === 'upcoming' ? "bg-red-50/50 dark:bg-red-900/10 border-red-200/60 dark:border-red-500/20 shadow-lg shadow-red-500/10" :
                                                                status === 'past' ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-500/15" :
                                                                    "bg-indigo-50/40 dark:bg-indigo-900/10 border-indigo-200/50 dark:border-indigo-500/15 shadow-sm hover:shadow-indigo-500/10"
                                                    )}>

                                                        {/* Card Header */}
                                                        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-black/5 dark:border-white/5 bg-white/30 dark:bg-white/5">
                                                            <div className={clsx(
                                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm",
                                                                status === 'ongoing' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                                                    status === 'upcoming' ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30" :
                                                                        status === 'past' ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/30" :
                                                                            "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800/30"
                                                            )}>
                                                                <Clock size={14} className={clsx(
                                                                    status === 'ongoing' ? "text-emerald-600" :
                                                                        status === 'upcoming' ? "text-red-500" :
                                                                            status === 'past' ? "text-amber-500" : "text-indigo-500"
                                                                )} />
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
                                                                {status === 'past' && <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500" /> Đã diễn ra</span>}
                                                                {status === 'planned' && <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-500"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Đang chờ</span>}
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

import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useMeetingSchedule, Meeting } from '../../hooks/useMeetingSchedule';
import { db, storage } from '../../lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
    Loader2, Upload, FileText, BarChart2, Clock, Eye, X, Search,
    Edit2, Trash2, Archive, CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// --- Types ---
interface ConclusionDoc {
    id: string;
    name: string;
    url: string;
    size: number;
    type: string;
    userId: string;
    userName: string;
    uploadedAt: string; // ISO
    meetingId?: string; // Links to a specific meeting from Sheet
    isArchived?: boolean; // New Flag for "Kho dữ liệu"
    viewLogs?: { userId: string, userName: string, startTime: string, durationSeconds: number }[];
}

// --- Sub-Component: Ticking Timer ---
const MeetingTimer = ({ deadline }: { deadline: Date }) => {
    const [timeLeft, setTimeLeft] = useState<{ d: number, h: number, m: number, s: number, status: 'ontime' | 'warning' | 'overdue' }>({ d: 0, h: 0, m: 0, s: 0, status: 'ontime' });

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            const diffMs = deadline.getTime() - now.getTime();
            const absDiff = Math.abs(diffMs);

            const d = Math.floor(absDiff / (1000 * 60 * 60 * 24));
            const h = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((absDiff % (1000 * 60)) / 1000);

            let status: 'ontime' | 'warning' | 'overdue' = 'ontime';
            if (diffMs < 0) status = 'overdue';
            else if (diffMs < 24 * 60 * 60 * 1000) status = 'warning';

            setTimeLeft({ d, h, m, s, status });
        };

        const timer = setInterval(tick, 1000);
        tick(); // Initial
        return () => clearInterval(timer);
    }, [deadline]);

    // Flip-clock style digits - Updated for Glassmorphism
    const Digit = ({ val, label }: { val: number, label: string }) => (
        <div className="flex flex-col items-center gap-1">
            <div className="bg-[#A0420D]/20 backdrop-blur-md text-white text-2xl md:text-3xl font-bold w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)] border border-white/20 relative overflow-hidden group">
                <span className="drop-shadow-sm">{String(val).padStart(2, '0')}</span>
            </div>
            <span className="text-[9px] uppercase font-bold text-white/90 tracking-wider shadow-sm">{label}</span>
        </div>
    );

    return (
        <div className="flex flex-col items-center">
            <div className="flex items-start gap-2 md:gap-4">
                <Digit val={timeLeft.d} label="Ngày" />
                <span className="text-2xl text-white/50 font-bold mt-2">:</span>
                <Digit val={timeLeft.h} label="Giờ" />
                <span className="text-2xl text-white/50 font-bold mt-2">:</span>
                <Digit val={timeLeft.m} label="Phút" />
                <span className="text-2xl text-white/50 font-bold mt-2">:</span>
                <Digit val={timeLeft.s} label="Giây" />
            </div>
            <div className={clsx(
                "mt-4 text-[10px] font-black uppercase tracking-[0.1em] px-4 py-1.5 rounded-full border shadow-sm backdrop-blur-md transition-colors",
                timeLeft.status === 'overdue'
                    ? "bg-red-600/30 text-white border-red-500/30"
                    : "bg-[#A0420D]/20 text-white border-white/20"
            )}>
                {timeLeft.status === 'overdue' ? 'Đã quá hạn nộp' : 'Thời gian còn lại'}
            </div>
        </div>
    );
};


const ConclusionDocs = () => {
    const { currentUser } = useAuth();
    const { users, addNotification } = useData();
    const { meetings, loading: loadingMeetings } = useMeetingSchedule();

    const [docs, setDocs] = useState<ConclusionDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [viewMode, setViewMode] = useState<'active' | 'archive'>('active');
    const [selectedMeetingId, setSelectedMeetingId] = useState<string>(''); // For upload linking
    const [secretaryFilter, setSecretaryFilter] = useState<string>('');
    const [viewingDoc, setViewingDoc] = useState<{ id: string, name: string, url: string, startTime: number } | null>(null);

    // --- Stats Logic ---
    const [timeFilterType, setTimeFilterType] = useState<'month' | 'quarter' | 'year'>('month');
    const [timeFilterValue, setTimeFilterValue] = useState<number>(new Date().getMonth() + 1);
    const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');

    // Preview & Edit
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    // --- Fetch Data ---
    useEffect(() => {
        const qDocs = query(collection(db, 'conclusion_docs'), orderBy('uploadedAt', 'desc'));
        const unsubDocs = onSnapshot(qDocs, (snapshot) => {
            setDocs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConclusionDoc)));
            setLoading(false);
        }, (error) => {
            console.error("Fetch docs error:", error);
            setLoading(false);
        });

        return () => { unsubDocs(); };
    }, []);

    // --- Helper: Parse Date ---
    const parseMeetingDate = (dateStr: string, timeStr?: string) => {
        try {
            const [d, m, y] = dateStr.split('/').map(Number);
            const date = new Date(y, m - 1, d);
            if (timeStr) {
                // Normalize separators (h, ., -) to colon
                const normalizedTime = timeStr.toString().replace(/[h.-]/g, ':');
                const parts = normalizedTime.split(':').map(p => parseInt(p, 10));

                const hh = !isNaN(parts[0]) ? parts[0] : 17;
                const mm = parts[1] && !isNaN(parts[1]) ? parts[1] : 0;

                date.setHours(hh, mm, 0);
            } else {
                date.setHours(17, 0, 0); // End of day default
            }
            return date;
        } catch (e) {
            console.error("Date parse error", e);
            return new Date(0); // Return old date to ensure it appears in list (as overdue) rather than hidden
        }
    };

    // --- Logic: Unified Meeting Tracking ---
    // Returns List of Meetings with Status: 'completed' | 'pending' | 'overdue'
    const trackedMeetings = useMemo(() => {
        if (!meetings.length) return [];

        const now = new Date();
        const trackingList: Array<{
            meeting: Meeting;
            deadline: Date;
            status: 'ontime' | 'warning' | 'overdue' | 'completed';
            delayHours: number;
            linkedDoc?: ConclusionDoc;
        }> = [];

        // 1. Filter by Time (Month/Quarter/Year) based on Meeting Date
        const matchesTimeFilter = (mDate: Date) => {
            if (mDate.getFullYear() !== yearFilter) return false;
            if (timeFilterType === 'month') return (mDate.getMonth() + 1) === timeFilterValue;
            if (timeFilterType === 'quarter') return Math.ceil((mDate.getMonth() + 1) / 3) === timeFilterValue;
            return true; // Year match already checked
        };

        const validMeetings = meetings.filter(m => {
            if (!m.date) return false;
            // Use End Time to determine if meeting has passed
            const mDate = parseMeetingDate(m.date, m.endTime || m.startTime);
            return matchesTimeFilter(mDate) && mDate < now;
        });

        validMeetings.forEach(m => {

            const deadline = new Date('2026-02-05T23:59:59');

            const linkedDoc = docs.find(d =>
                (d.meetingId === m.id) ||
                (d.meetingId === m.id && !d.isArchived)
            );

            if (linkedDoc) {
                trackingList.push({
                    meeting: m,
                    deadline,
                    status: 'completed',
                    delayHours: 0,
                    linkedDoc
                });
            } else {
                const diffMs = deadline.getTime() - now.getTime();
                let status: 'ontime' | 'warning' | 'overdue' = 'ontime';
                if (diffMs < 0) status = 'overdue';
                else if (diffMs < 24 * 60 * 60 * 1000) status = 'warning';

                trackingList.push({
                    meeting: m,
                    deadline,
                    status,
                    delayHours: Math.abs(diffMs / (1000 * 60 * 60))
                });
            }
        });

        // Sorting: Chronological (Newest First) regardless of status
        trackingList.sort((a, b) => {
            // Parse dates including time for accurate sorting
            const dateA = parseMeetingDate(a.meeting.date, a.meeting.startTime);
            const dateB = parseMeetingDate(b.meeting.date, b.meeting.startTime);

            return dateB.getTime() - dateA.getTime(); // Newest first
        });

        return trackingList.filter(item => {
            if (secretaryFilter && item.meeting.secretary !== secretaryFilter) return false;
            return true;
        });
    }, [meetings, docs, secretaryFilter, timeFilterType, timeFilterValue, yearFilter]);

    // Categories: Completed On Time, Completed Late, Not Completed (Pending)
    const statsData = useMemo(() => {
        const stats: Record<string, { onTime: number, late: number, missing: number, name: string }> = {};

        // 0. Initialize ALL secretaries
        meetings.forEach(m => {
            if (m.secretary) {
                const sec = m.secretary.trim();
                // Check if this meeting falls within the filtered time range? 
                // Stats should probably reflect the *filtered view*.
                const mDate = parseMeetingDate(m.date);
                if ((timeFilterType === 'year' && mDate.getFullYear() !== yearFilter) ||
                    (timeFilterType === 'month' && (mDate.getFullYear() !== yearFilter || (mDate.getMonth() + 1) !== timeFilterValue)) ||
                    (timeFilterType === 'quarter' && (mDate.getFullYear() !== yearFilter || Math.ceil((mDate.getMonth() + 1) / 3) !== timeFilterValue))) {
                    return; // Skip if out of range
                }

                if (!stats[sec]) stats[sec] = { onTime: 0, late: 0, missing: 0, name: sec };
            }
        });

        // 1. Process Completed Docs
        docs.filter(d => !d.isArchived && d.meetingId).forEach(d => {
            const m = meetings.find(met => met.id === d.meetingId);
            if (m && m.secretary && stats[m.secretary.trim()]) {
                // Use the Extended Countdown Deadline for "On Time" check
                const deadline = new Date('2026-02-05T23:59:59');
                const uploadDate = new Date(d.uploadedAt);
                if (uploadDate <= deadline) {
                    stats[m.secretary.trim()].onTime++;
                } else {
                    stats[m.secretary.trim()].late++;
                }
            }
        });

        // 2. Process Missing
        trackedMeetings.forEach(item => {
            if (item.status !== 'completed' && stats[item.meeting.secretary]) {
                // Only count if it's in the filtered set (trackedMeetings is already filtered by time)
                stats[item.meeting.secretary].missing++;
            }
        });

        return Object.values(stats).sort((a, b) => (b.onTime + b.late + b.missing) - (a.onTime + a.late + a.missing));
    }, [docs, meetings, trackedMeetings, timeFilterType, timeFilterValue, yearFilter]); // Depends on trackedMeetings which is already filtered 
    // Request says "Kiểm đếm ... trong tháng".

    // --- New Logic: Monthly Counts & Duration Per Secretary ---
    const { monthlyStats, durationStats } = useMemo(() => {
        const counts: Record<string, number> = {};
        const durations: Record<string, number> = {};

        // Helper to check filter
        const matchesFilter = (dStr: string) => {
            if (!dStr) return false;
            const mDate = parseMeetingDate(dStr);
            if (mDate.getFullYear() !== yearFilter) return false;
            if (timeFilterType === 'month') return (mDate.getMonth() + 1) === timeFilterValue;
            if (timeFilterType === 'quarter') return Math.ceil((mDate.getMonth() + 1) / 3) === timeFilterValue;
            return true;
        };

        // Iterate all meetings
        meetings.forEach(m => {
            if (m.secretary && m.date && matchesFilter(m.date)) {
                const sec = m.secretary.trim();

                // 1. Monthly Count (Submitted Docs)
                const hasDoc = docs.some(d => d.meetingId === m.id && !d.isArchived);
                if (hasDoc) {
                    counts[sec] = (counts[sec] || 0) + 1;
                }

                // 2. Total Duration (ALL meetings in period)
                // Calculate Duration
                const start = m.startTime || '00:00';
                const end = m.endTime || m.startTime || '00:00';

                // Parse "HH:mm"
                // Handle cases like "14h30" or "14.30" if raw data is messy, 
                // but usually m.startTime is standardized or we should generic parse function.
                // Re-using simple split for now as data seems clean, or use regex.
                const parseTime = (t: string) => {
                    const clean = t.replace(/[h.-]/g, ':');
                    const [h, m] = clean.split(':').map(Number);
                    return (h || 0) * 60 + (m || 0);
                };

                const startMins = parseTime(start);
                const endMins = parseTime(end);

                const minutes = endMins - startMins;

                if (minutes > 0) {
                    durations[sec] = (durations[sec] || 0) + minutes;
                }
            }
        });

        // Convert to Arrays
        const mStats = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        const dStats = Object.keys(durations).map(sec => ({
            name: sec,
            minutes: durations[sec]
        })).sort((a, b) => b.minutes - a.minutes);

        return { monthlyStats: mStats, durationStats: dStats };
    }, [meetings, docs, timeFilterType, timeFilterValue, yearFilter]);

    // Unique Secretaries for Filter
    const uniqueSecretaries = useMemo(() => {
        const s = new Set<string>();
        meetings.forEach(m => { if (m.secretary) s.add(m.secretary.trim()); });
        return Array.from(s).sort();
    }, [meetings]);


    // --- Handlers ---
    const handleDeleteDoc = async (document: ConclusionDoc) => {
        if (!currentUser) return;
        const u = users.find(u => u.email === currentUser?.email);
        const isOwner = document.userId === u?.id;
        const isAdmin = u?.isAdmin || ['mcngocsonvualoidan@gmail.com'].includes(currentUser?.email || '');

        const hoursSinceUpload = (new Date().getTime() - new Date(document.uploadedAt).getTime()) / (1000 * 60 * 60);

        // Permission check
        if (!isAdmin && !isOwner) {
            alert("Bạn không có quyền xóa tài liệu này.");
            return;
        }

        // Logic:
        // < 24h: Hard Delete (Remove mistake)
        // > 24h: Archive (Move to Warehouse)
        const isHardDelete = hoursSinceUpload < 24;
        const actionText = isHardDelete ? "Xóa vĩnh viễn" : "Lưu trữ vào Kho dữ liệu";

        if (!confirm(`Xác nhận ${actionText} văn bản "${document.name}"?`)) return;

        try {
            if (isHardDelete) {
                // 1. Delete from Storage
                const fileRef = ref(storage, document.url);
                await deleteObject(fileRef).catch(err => console.warn("File storage delete warn:", err));
                // 2. Delete from Firestore
                await deleteDoc(doc(db, 'conclusion_docs', document.id));
                addNotification({
                    id: Date.now().toString(),
                    title: 'Đã xóa văn bản',
                    message: `Đã xóa hoàn toàn: ${document.name}`,
                    type: 'info',
                    time: 'Vừa xong',
                    read: false
                });
            } else {
                // Archive
                await updateDoc(doc(db, 'conclusion_docs', document.id), {
                    isArchived: true,
                    archivedAt: new Date().toISOString(),
                    archivedBy: u?.id
                });
                addNotification({
                    id: Date.now().toString(),
                    title: 'Đã lưu trữ văn bản',
                    message: `Văn bản đã được chuyển vào kho lưu trữ (do đã quá 24h).`,
                    type: 'info',
                    time: 'Vừa xong',
                    read: false
                });
            }

        } catch (error) {
            console.error("Delete/Archive error:", error);
            alert("Lỗi khi xử lý tài liệu.");
        }
    };

    const handleUpdateDoc = async () => {
        if (!editingDocId || !editingName.trim() || !currentUser) return;

        // Find doc
        const docToUpdate = docs.find(d => d.id === editingDocId);
        if (!docToUpdate) return;

        const u = users.find(u => u.email === currentUser.email);
        const isOwner = docToUpdate.userId === u?.id;
        const isAdmin = u?.isAdmin || ['mcngocsonvualoidan@gmail.com'].includes(currentUser.email || '');

        if (!isOwner && !isAdmin) {
            alert("Bạn không có quyền chỉnh sửa tài liệu này.");
            return;
        }

        try {
            await updateDoc(doc(db, 'conclusion_docs', editingDocId), {
                name: editingName.trim()
            });

            addNotification({
                id: Date.now().toString(),
                title: 'Cập nhật thành công',
                message: `Đã đổi tên thành: ${editingName}`,
                type: 'success',
                time: 'Vừa xong',
                read: false
            });

            setEditingDocId(null);
            setEditingName('');
        } catch (error) {
            console.error("Update error:", error);
            alert("Lỗi khi cập nhật tên văn bản.");
        }
    };

    const handleViewDoc = (doc: ConclusionDoc) => {
        setViewingDoc({
            id: doc.id,
            name: doc.name,
            url: doc.url,
            startTime: Date.now()
        });
    };

    const handleCloseDoc = async () => {
        if (!viewingDoc || !currentUser) {
            setViewingDoc(null);
            return;
        }

        const durationSeconds = Math.round((Date.now() - viewingDoc.startTime) / 1000);

        // Update Firestore
        // We append to viewLogs
        try {
            const docRef = doc(db, 'conclusion_docs', viewingDoc.id);
            // We need to fetch current logs first? Or arrayUnion
            const user = users.find(u => u.email === currentUser.email);

            // Using arrayUnion might be duplicate if we want every session. 
            // arrayUnion works for unique objects. Since startTime is unique, it should be fine.
            const newLog = {
                userId: user?.id || 'unknown',
                userName: user?.name || currentUser.email || 'Unknown',
                startTime: new Date(viewingDoc.startTime).toISOString(),
                durationSeconds
            };

            // Note: Firestore arrayUnion only adds unique elements. 
            // Since timestamp is in newLog, it's unique.
            // However, to be safe and use atomic updates:
            const docSnap = docs.find(d => d.id === viewingDoc.id); // Get from local state or fetch
            const currentLogs = docSnap?.viewLogs || [];

            // Check if user already exists in viewLogs
            const userId = user?.id || 'unknown';
            const hasViewed = currentLogs.some(log => log.userId === userId);

            if (!hasViewed) {
                await updateDoc(docRef, {
                    viewLogs: [...currentLogs, newLog]
                });
            } else {
                // Optional: Update last viewed time if we wanted to track latest access, 
                // but requirement is strict "1 count per user". 
                // We'll skip adding a new log to keep the count unique.
            }

        } catch (err) {
            console.error("Failed to log view duration", err);
        }

        setViewingDoc(null);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !currentUser) return;
        if (!selectedMeetingId) {
            alert("Vui lòng chọn cuộc họp liên quan để upload văn bản kết luận!");
            e.target.value = '';
            return;
        }

        const file = e.target.files[0];
        // Enforce PDF Only
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert("Vui lòng chỉ tải lên file định dạng PDF (.pdf)!");
            e.target.value = '';
            return;
        }

        setUploading(true);
        try {
            const user = users.find(u => u.email === currentUser.email);
            if (!user) throw new Error("User not identified");

            const meeting = meetings.find(m => m.id === selectedMeetingId);
            const fileName = meeting ? `KL_${meeting.date?.replace(/\//g, '-')}_${file.name}` : file.name;

            const storageRef = ref(storage, `conclusion-docs/${user.id}/${Date.now()}_${fileName}`);
            const snapshot = await uploadBytes(storageRef, file, {
                contentType: 'application/pdf',
                customMetadata: { 'uploadedBy': user.id }
            });
            const downloadURL = await getDownloadURL(snapshot.ref);

            await addDoc(collection(db, 'conclusion_docs'), {
                name: fileName,
                url: downloadURL,
                size: file.size,
                type: file.type,
                userId: user.id,
                userName: user.name,
                uploadedAt: new Date().toISOString(),
                meetingId: selectedMeetingId, // Linked!
                isArchived: false,
                viewLogs: []
            });

            addNotification({
                id: Date.now().toString(),
                title: 'Upload thành công',
                message: `Đã tải lên văn bản kết luận.`,
                type: 'success',
                time: 'Vừa xong',
                read: false
            });

            // Reset
            setSelectedMeetingId('');

        } catch (error) {
            console.error(error);
            alert("Lỗi khi upload file.");
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    // --- Render Logic ---
    const visibleDocs = docs.filter(d => {
        if (viewMode === 'archive' ? !d.isArchived : d.isArchived) return false;

        // Filter by Search Query
        if (searchQuery) {
            if (!d.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !d.userName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        }

        // Filter by Secretary (Need to find meeting linkage)
        // If doc is linked to meeting, check meeting secretary.
        if (secretaryFilter) {
            const m = meetings.find(met => met.id === d.meetingId);
            if (m && m.secretary !== secretaryFilter) return false;
            // If not linked or no secretary found, maybe we shouldn't show it if filter is active?
            if (!m) return false;
        }

        return true;
    });


    if (loading || loadingMeetings) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 size={40} className="text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-6 p-6 overflow-hidden relative font-sans" style={{ fontFamily: '"Be Vietnam Pro", sans-serif' }}>
            {/* Header - Banner Style */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white shadow-xl isolate mb-2 shrink-0">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2 flex items-center gap-3">
                            <FileText size={28} className="text-indigo-200" />
                            QUẢN LÝ VĂN BẢN KẾT LUẬN
                        </h1>
                        <p className="text-indigo-100 text-sm font-medium opacity-90 max-w-2xl">
                            Hệ thống theo dõi nộp, lưu trữ và đánh giá tiến độ thực hiện văn bản kết luận cuộc họp.
                        </p>
                    </div>

                    <div className="w-full xl:w-auto bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/20">
                        <select
                            value={secretaryFilter}
                            onChange={(e) => setSecretaryFilter(e.target.value)}
                            className="bg-transparent text-white border-none text-sm font-bold px-3 py-2 outline-none w-full xl:min-w-[200px] cursor-pointer"
                        >
                            <option className="bg-slate-800 text-white" value="">-- Tất cả Thư ký --</option>
                            {uniqueSecretaries.map(s => <option className="bg-slate-800 text-white" key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* SECTION 1: Pending & Countdown (Only show in Active Mode) */}
            {/* SECTION 1: Pending & Countdown (Only show in Active Mode) */}
            {viewMode === 'active' && (
                <div className="flex flex-col gap-6 shrink-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* LEFT: Stats & Filters */}
                        <div className="lg:col-span-8 flex flex-col gap-4">
                            {/* Stats Summary Cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col shadow-sm">
                                    <span className="text-[10px] uppercase font-bold text-slate-500">Tổng số</span>
                                    <span className="text-2xl font-black text-slate-700 dark:text-slate-200">{trackedMeetings.length}</span>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex flex-col shadow-sm">
                                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-500">Đã nộp</span>
                                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{trackedMeetings.filter(t => t.status === 'completed').length}</span>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-500/20 flex flex-col shadow-sm relative overflow-hidden">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-500/10 rounded-full blur-xl animate-pulse"></div>
                                    <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-500">Chưa nộp</span>
                                    <span className="text-2xl font-black text-red-600 dark:text-red-400">{trackedMeetings.filter(t => t.status !== 'completed').length}</span>
                                </div>
                            </div>

                            {/* Main List */}
                            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col min-h-[300px] max-h-[500px]">
                                <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-wrap justify-between items-center gap-3">
                                    <h3 className="font-bold text-sm text-slate-700 dark:text-white flex items-center gap-2">
                                        <Clock size={16} className="text-indigo-500" />
                                        TIẾN ĐỘ NỘP VĂN BẢN
                                    </h3>

                                    {/* Inline Filter */}
                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
                                        <select
                                            value={timeFilterType}
                                            onChange={(e) => setTimeFilterType(e.target.value as any)}
                                            className="bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 outline-none px-2 py-1"
                                        >
                                            <option value="month">Tháng</option>
                                            <option value="quarter">Quý</option>
                                            <option value="year">Năm</option>
                                        </select>
                                        <div className="w-px h-3 bg-slate-300" />
                                        {timeFilterType === 'month' && (
                                            <select value={timeFilterValue} onChange={(e) => setTimeFilterValue(Number(e.target.value))} className="bg-transparent text-xs font-bold text-indigo-600 outline-none px-1">
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        )}
                                        {timeFilterType === 'quarter' && (
                                            <select value={timeFilterValue} onChange={(e) => setTimeFilterValue(Number(e.target.value))} className="bg-transparent text-xs font-bold text-indigo-600 outline-none px-1">
                                                {[1, 2, 3, 4].map(q => <option key={q} value={q}>{q}</option>)}
                                            </select>
                                        )}
                                        <select value={yearFilter} onChange={(e) => setYearFilter(Number(e.target.value))} className="bg-transparent text-xs font-bold text-indigo-600 outline-none px-1">
                                            {[2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 p-4">
                                    {trackedMeetings.length > 0 ? trackedMeetings.map((item, idx) => (
                                        <div key={idx} className={clsx(
                                            "flex flex-row items-center gap-3 p-3 rounded-xl border transition-all group relative",
                                            item.status === 'completed'
                                                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/10"
                                                : "bg-white border-slate-200 dark:bg-slate-900/50 dark:border-white/5 hover:border-indigo-400 dark:hover:border-white/10"
                                        )}>
                                            {/* STT Column */}
                                            <div className="w-6 shrink-0 flex justify-center self-start md:self-center mt-1 md:mt-0">
                                                <span className={clsx(
                                                    "text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full",
                                                    item.status === 'completed' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                                                )}>
                                                    {item.status === 'completed' ? <CheckCircle2 size={12} /> : idx + 1}
                                                </span>
                                            </div>

                                            {/* Data Info */}
                                            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-4 items-start md:items-center">
                                                {/* Date */}
                                                <div className="md:col-span-2 text-[10px] md:text-xs font-mono text-slate-500 dark:text-slate-400">
                                                    {item.meeting.date}
                                                </div>

                                                {/* Content - Increased Span */}
                                                <div className="md:col-span-6 w-full group/content relative">
                                                    <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 line-clamp-1 font-medium cursor-help">
                                                        {item.meeting.content}
                                                    </p>
                                                    {/* Custom Tooltip on Hover */}
                                                    <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-xl border border-white/10 opacity-0 group-hover/content:opacity-100 pointer-events-none transition-opacity z-50">
                                                        {item.meeting.content}
                                                        <div className="absolute left-4 bottom-[-4px] w-2 h-2 bg-slate-800 transform rotate-45 border-r border-b border-white/10"></div>
                                                    </div>
                                                    <div className="md:hidden mt-1">
                                                        <button
                                                            onClick={() => alert(item.meeting.content)}
                                                            className="text-[10px] text-indigo-500 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                                                        >
                                                            <Eye size={10} /> Xem chi tiết
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Time Column (New) - NO Session Text */}
                                                <div className="md:col-span-2 flex flex-col items-center justify-center text-[10px] text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-white/5 pl-2">
                                                    {(() => {
                                                        const start = item.meeting.startTime || '00:00';
                                                        const end = item.meeting.endTime || item.meeting.startTime || '00:00';

                                                        // Calculate Duration
                                                        const [h1, m1] = start.split(':').map(Number);
                                                        const [h2, m2] = end.split(':').map(Number);
                                                        const duration = (h2 * 60 + m2) - (h1 * 60 + m1);

                                                        // Format for display (HH:mm)
                                                        const formatTime = (t: string) => {
                                                            if (!t) return '00:00';
                                                            return t.split(':').slice(0, 2).join(':');
                                                        };

                                                        return (
                                                            <>
                                                                <span className="font-bold text-slate-700 dark:text-slate-300">{formatTime(start)} - {formatTime(end)}</span>
                                                                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">({duration > 0 ? duration : 0}p)</span>
                                                            </>
                                                        )
                                                    })()}
                                                </div>

                                                {/* Secretary Column */}
                                                <div className="md:col-span-2 flex justify-start md:justify-end">
                                                    <span className="text-[9px] md:text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 whitespace-nowrap">
                                                        {item.meeting.secretary}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Timer & Action */}
                                            <div className="shrink-0 flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-4 justify-end min-w-[80px]">
                                                {item.status === 'completed' && item.linkedDoc ? (
                                                    <button
                                                        onClick={() => handleViewDoc(item.linkedDoc!)}
                                                        className="p-1.5 md:p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors flex items-center gap-2"
                                                        title="Xem văn bản"
                                                    >
                                                        <FileText size={14} className="md:w-4 md:h-4" />
                                                        <span className="text-xs font-bold hidden md:inline">Đã nộp</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setSelectedMeetingId(item.meeting.id)}
                                                        className={clsx(
                                                            "p-1.5 md:p-2 rounded-lg transition-colors",
                                                            selectedMeetingId === item.meeting.id ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                                                        )}
                                                    >
                                                        <Upload size={14} className="md:w-4 md:h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                                            <CheckCircle2 size={32} className="text-emerald-500/20" />
                                            <span className="text-sm">Không có dữ liệu văn bản cần theo dõi.</span>
                                        </div>
                                    )}
                                </div>


                            </div>
                        </div>

                        {/* RIGHT: Countdown & Quick Actions */}
                        <div className="lg:col-span-4 flex flex-col gap-4 sticky top-4">
                            {/* Timer Card */}
                            <div className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] p-6 rounded-2xl shadow-xl text-center relative overflow-hidden border border-white/20">
                                <div className="relative z-10">
                                    <MeetingTimer deadline={new Date('2026-02-05T23:59:59')} />
                                </div>
                            </div>

                            {/* Quick Submit Card */}
                            <div className="bg-indigo-600 p-5 rounded-2xl shadow-lg shadow-indigo-500/20 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                <div className="relative z-10">
                                    <h4 className="font-bold text-lg mb-1 flex items-center gap-2">
                                        <Upload size={20} /> Nộp văn bản
                                    </h4>
                                    <p className="text-indigo-100 text-xs mb-4 opacity-80">Chọn cuộc họp và tải lên file PDF.</p>

                                    <div className="space-y-3">
                                        <select
                                            value={selectedMeetingId}
                                            onChange={(e) => setSelectedMeetingId(e.target.value)}
                                            className="w-full bg-indigo-700 border border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer hover:bg-indigo-600 transition-colors"
                                        >
                                            <option className="bg-slate-800" value="">-- Chọn cuộc họp --</option>
                                            {trackedMeetings.filter(t => t.status !== 'completed').map(p => (
                                                <option className="bg-slate-800" key={p.meeting.id} value={p.meeting.id}>
                                                    {p.meeting.date} - {p.meeting.content.substring(0, 30)}...
                                                </option>
                                            ))}
                                        </select>

                                        <label className={clsx(
                                            "flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer border border-white/20",
                                            !selectedMeetingId || uploading
                                                ? "bg-white/10 text-white/50 cursor-not-allowed"
                                                : "bg-white text-indigo-600 hover:bg-indigo-50"
                                        )}>
                                            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                            <span>{uploading ? "Đang tải..." : "Chọn File & Nộp"}</span>
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                onChange={handleFileUpload}
                                                disabled={!selectedMeetingId || uploading}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 2: Document Library (Active or Archive) + Stats Chart (If Active) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-[300px]">

                {/* Stats Chart (Moved Here) - Only if ViewMode Active to save space or layout consistency? 
                    Actually, let's keep it visible or hide if archived? 
                    User wanted Pending Expanded. Chart can be here.
                */}
                {viewMode === 'active' && (
                    <div className="glass-panel p-5 rounded-2xl flex flex-col order-2 lg:order-1 h-auto min-h-[500px] bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none">
                        <h3 className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-2 text-sm uppercase tracking-wider mb-4">
                            <BarChart2 size={16} className="text-amber-500 dark:text-amber-400" /> Thống kê Tiến độ
                        </h3>
                        <div style={{ height: `${Math.max(200, statsData.length * 15)}px` }} className="mb-4 transition-all duration-300 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statsData} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }} barSize={15} barGap={2}>
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        width={100}
                                        tickMargin={10}
                                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                                        interval={0}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                                    />
                                    <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                    <Bar name="Đúng hạn" dataKey="onTime" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                    <Bar name="Trễ hạn" dataKey="late" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                                    <Bar name="Chưa nộp" dataKey="missing" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* New Chart: Average Duration */}
                        <h3 className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-2 text-sm uppercase tracking-wider mb-4 border-t border-slate-200 dark:border-white/10 pt-4">
                            <Clock size={16} className="text-indigo-600 dark:text-indigo-400" /> Tổng thời lượng (phút)
                        </h3>
                        <div style={{ height: `${Math.max(200, durationStats.length * 15)}px` }} className="transition-all duration-300 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={durationStats} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }} barSize={15}>
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        width={100}
                                        tickMargin={10}
                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                                        interval={0}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                                        formatter={(value) => [`${value} phút`, "Tổng thời lượng"]}
                                    />
                                    <Bar dataKey="minutes" fill="#818cf8" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex justify-between items-center mt-2 px-2 py-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">Tổng thời lượng</span>
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                {durationStats.reduce((acc, curr) => acc + curr.minutes, 0)} phút
                            </span>
                        </div>

                        {/* Monthly Counts Summary */}
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/10">
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                Văn bản đã nộp ({
                                    timeFilterType === 'month' ? `Tháng ${timeFilterValue}` :
                                        timeFilterType === 'quarter' ? `Quý ${timeFilterValue}` :
                                            `Năm ${yearFilter}`
                                })
                            </h4>
                            <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                                {monthlyStats.map(([sec, count]) => (
                                    <div key={sec} className="flex justify-between items-center text-xs">
                                        <span className="text-slate-700 dark:text-slate-300">{sec}</span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{count}</span>
                                    </div>
                                ))}
                                {monthlyStats.length === 0 && <div className="text-xs text-slate-500 italic">Chưa có dữ liệu</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Library - Takes remaining space */}
                <div className={clsx(
                    "glass-panel rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden order-1 lg:order-2 bg-white dark:bg-slate-800/50 shadow-sm dark:shadow-none",
                    viewMode === 'active' ? "lg:col-span-3" : "lg:col-span-4"
                )}>
                    {/* Library Toolbar */}
                    <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={viewMode === 'active' ? "Tìm kiếm văn bản..." : "Tìm kiếm trong kho dữ liệu..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-slate-900 dark:text-white focus:border-indigo-500 outline-none w-64 shadow-sm"
                                />
                            </div>

                            {/* Status Tabs if needed */}
                            <div className="text-xs font-bold px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 disabled:opacity-50">
                                {visibleDocs.length} tài liệu
                            </div>
                        </div>
                    </div>

                    {/* Library Grid */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {visibleDocs.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {visibleDocs.map(doc => {
                                    // Calculate Link Status for UI
                                    const m = meetings.find(met => met.id === doc.meetingId);
                                    const isLinked = !!m;

                                    // Permission Check
                                    const u = users.find(u => u.email === currentUser?.email);
                                    const isOwner = doc.userId === u?.id;
                                    const isAdmin = u?.isAdmin || ['mcngocsonvualoidan@gmail.com'].includes(currentUser?.email || '');
                                    const canEdit = isOwner || isAdmin;

                                    return (
                                        <div key={doc.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl p-4 hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all group relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3 w-full overflow-hidden">
                                                    <div className="w-10 h-10 shrink-0 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0 overflow-hidden">
                                                        {editingDocId === doc.id ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    value={editingName}
                                                                    onChange={(e) => setEditingName(e.target.value)}
                                                                    className="bg-slate-800 border border-indigo-500 rounded px-2 py-1 text-xs text-white outline-none w-full"
                                                                    autoFocus
                                                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateDoc()}
                                                                />
                                                                <button onClick={handleUpdateDoc} className="text-emerald-400 hover:text-emerald-300"><CheckCircle2 size={14} /></button>
                                                                <button onClick={() => setEditingDocId(null)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 w-full">
                                                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 max-w-full" title={doc.name} onClick={() => handleViewDoc(doc)}>
                                                                    {doc.name}
                                                                </h4>
                                                                {doc.viewLogs && doc.viewLogs.length > 0 && (
                                                                    <div className="group/views relative ml-1 shrink-0">
                                                                        <div className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded cursor-help">
                                                                            <Eye size={10} /> {doc.viewLogs.length}
                                                                        </div>
                                                                        {/* Tooltip Views */}
                                                                        <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-slate-900 border border-white/10 rounded shadow-xl opacity-0 group-hover/views:opacity-100 pointer-events-none z-50 transition-opacity">
                                                                            <div className="text-[10px] font-bold text-slate-400 mb-1 border-b border-white/5 pb-1">Lịch sử xem:</div>
                                                                            <div className="max-h-32 overflow-y-auto space-y-1">
                                                                                {[...doc.viewLogs].reverse().map((log, i) => (
                                                                                    <div key={i} className="text-[9px] text-slate-300 flex justify-between">
                                                                                        <span>{log.userName}</span>
                                                                                        <span className="text-slate-500">{log.durationSeconds}s</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 truncate">
                                                            <span>{new Date(doc.uploadedAt).toLocaleString('vi-VN', {
                                                                hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                                                            })}</span>
                                                            <span className="shrink-0">•</span>
                                                            <span className="text-indigo-600 dark:text-indigo-400 shrink-0 truncate max-w-[100px]">{doc.userName}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                                                    {!editingDocId && viewMode === 'active' && canEdit && (
                                                        <button
                                                            onClick={() => {
                                                                setEditingDocId(doc.id);
                                                                setEditingName(doc.name);
                                                            }}
                                                            className="p-1.5 hover:bg-white/10 rounded-lg text-blue-400"
                                                            title="Đổi tên"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                    )}
                                                    {/* Removed Green Eye Button as requested */}
                                                    {viewMode === 'active' && canEdit && (
                                                        <button
                                                            onClick={() => handleDeleteDoc(doc)}
                                                            className="p-1.5 hover:bg-white/10 rounded-lg text-red-400"
                                                            title="Xóa / Lưu trữ"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Linked Meeting Info */}
                                            {isLinked ? (
                                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                                                    <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                                                    <span className="line-clamp-1">{m?.content}</span>
                                                </div>
                                            ) : (
                                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-400 dark:text-slate-600 italic">
                                                    Chưa liên kết cuộc họp
                                                </div>
                                            )}

                                            {/* Status Tag for Archived */}
                                            {doc.isArchived && (
                                                <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] uppercase font-bold rounded">
                                                    Archived
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-600">
                                <Search size={32} className="mb-2 opacity-50" />
                                <p className="text-sm">Không tìm thấy tài liệu nào trong {viewMode === 'active' ? 'mục hiện hành' : 'kho lưu trữ'}.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Controls: Warehouse */}
            <div className="flex justify-center shrink-0 mt-4 pb-4">
                <button
                    onClick={() => setViewMode(viewMode === 'active' ? 'archive' : 'active')}
                    className={clsx(
                        "w-full md:w-auto px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 text-sm uppercase tracking-wider",
                        viewMode === 'archive'
                            ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-500/30 hover:shadow-amber-500/50"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700"
                    )}
                >
                    <Archive size={18} />
                    {viewMode === 'active' ? 'Truy cập Kho Lưu Trữ' : 'Quay lại Văn bản Hiện hành'}
                </button>
            </div>
            {/* PDF Viewer Modal */}
            {
                viewingDoc && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden relative">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <FileText className="text-indigo-600 dark:text-indigo-400" size={16} />
                                    {viewingDoc.name}
                                </h3>
                                <button
                                    onClick={handleCloseDoc}
                                    className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 bg-slate-800 relative">
                                {/* Loading Indicator beneath iframe */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <Loader2 size={32} className="text-indigo-500/20 animate-spin" />
                                </div>
                                <object
                                    data={viewingDoc.url}
                                    type="application/pdf"
                                    className="w-full h-full relative z-10 rounded-lg"
                                >
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                                        <p>Trình duyệt không hỗ trợ xem trực tiếp.</p>
                                        <a
                                            href={viewingDoc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors"
                                        >
                                            Tải về hoặc Mở tab mới
                                        </a>
                                    </div>
                                </object>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ConclusionDocs;

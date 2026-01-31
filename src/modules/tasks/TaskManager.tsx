import React, { useState } from 'react';
import { storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    Calendar, Plus, Search,
    Bold, Italic, List, ChevronDown,
    AlertCircle, X, CheckCircle2, Clock, Link,
    Maximize2, Minimize2, Underline, Type, Image as ImageIcon
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useData, Task } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';

import { DEPARTMENTS } from '../../constants/common';
const departments = ['All', ...DEPARTMENTS];

// --- HELPERS ---
const formatDate = (date: Date | string, type: 'time-h' | 'time-m' | 'date' | 'full') => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    if (type === 'time-h') return d.getHours().toString().padStart(2, '0');
    if (type === 'time-m') return d.getMinutes().toString().padStart(2, '0');
    if (type === 'date') return d.toLocaleDateString('en-GB'); // dd/mm/yyyy
    if (type === 'full') return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
    return '';
};

// --- COMPONENTS ---

const GlassDatePicker = ({ selected, onSelect, onClose }: { selected?: Date, onSelect: (date: Date) => void, onClose: () => void }) => {
    const { t } = useLanguage();
    const [viewDate, setViewDate] = useState(selected || new Date());
    const [time, setTime] = useState({
        h: selected ? formatDate(selected, 'time-h') : '09',
        m: selected ? formatDate(selected, 'time-m') : '00'
    });

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const startDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const offset = startDay === 0 ? 6 : startDay - 1; // Adjust for Monday start (0=Sun, 1=Mon...) - User wants Mon start? English default is usually Sun (0). Checked existing code: offset logic implies Monday start (Sun=0 -> offset=6. Mon=1 -> offset=0). Correct.

    const handleDateClick = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        newDate.setHours(parseInt(time.h), parseInt(time.m));
        onSelect(newDate);
    };

    const handleTimeChange = (type: 'h' | 'm', val: string) => {
        let numVal = parseInt(val);
        if (isNaN(numVal)) numVal = 0;

        if (type === 'h') {
            if (numVal > 23) numVal = 0;
            if (numVal < 0) numVal = 23;
        }
        if (type === 'm') {
            if (numVal > 59) numVal = 0;
            if (numVal < 0) numVal = 59;
        }

        const cleanVal = numVal.toString().padStart(2, '0');

        const newTime = { ...time, [type]: cleanVal };
        setTime(newTime);
        if (selected) {
            const newDate = new Date(selected);
            newDate.setHours(parseInt(newTime.h), parseInt(newTime.m));
            onSelect(newDate);
        }
    };

    const changeMonth = (delta: number) => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
    };

    return (
        <div className="p-6 rounded-2xl border-2 border-indigo-500/20 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] bg-slate-950 w-[320px] animate-in zoom-in-95 duration-200 relative z-[60]">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <span className="font-black text-xl text-white tracking-tight uppercase shadow-black drop-shadow-md">
                    {t.common.datePicker.months[viewDate.getMonth()]}, {viewDate.getFullYear()}
                </span>
                <div className="flex gap-1 text-slate-400">
                    <button onClick={(e) => { e.stopPropagation(); changeMonth(-1); }} className="p-2 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><ChevronDown className="rotate-90" size={18} /></button>
                    <button onClick={(e) => { e.stopPropagation(); changeMonth(1); }} className="p-2 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><ChevronDown className="-rotate-90" size={18} /></button>
                </div>
            </div>

            {/* Grid */}
            <div className="mb-6">
                <div className="grid grid-cols-7 text-center mb-2">
                    {t.common.datePicker.weekdays.map(d => <span key={d} className="text-[10px] font-bold text-slate-500 uppercase">{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {[...Array(offset)].map((_, i) => <div key={`empty-${i}`} />)}
                    {[...Array(daysInMonth)].map((_, i) => {
                        const d = i + 1;
                        const isSelected = selected &&
                            selected.getDate() === d &&
                            selected.getMonth() === viewDate.getMonth() &&
                            selected.getFullYear() === viewDate.getFullYear();

                        return (
                            <button
                                key={d}
                                onClick={(e) => { e.stopPropagation(); handleDateClick(d); }}
                                className={clsx(
                                    "w-9 h-9 text-sm font-bold rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105",
                                    isSelected
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/50 scale-105 ring-2 ring-indigo-400/30"
                                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                                )}
                            >
                                {d}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Time */}
            <div className="flex items-center justify-between gap-4 mb-6 bg-slate-900/50 p-3 rounded-xl border border-white/5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.common.datePicker.time}</span>
                <div className="flex items-center gap-2">
                    {/* Hours */}
                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleTimeChange('h', (parseInt(time.h) + 1).toString()); }}
                            className="text-slate-500 hover:text-white transition-colors"
                        >
                            <ChevronDown className="rotate-180" size={14} />
                        </button>
                        <input
                            type="text"
                            value={time.h}
                            onChange={(e) => handleTimeChange('h', e.target.value)}
                            onBlur={() => setTime(prev => ({ ...prev, h: prev.h.padStart(2, '0') }))}
                            className="w-12 h-10 bg-slate-800 rounded-lg text-center text-lg font-black text-white border border-white/10 focus:border-indigo-500 outline-none"
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); handleTimeChange('h', (parseInt(time.h) - 1).toString()); }}
                            className="text-slate-500 hover:text-white transition-colors"
                        >
                            <ChevronDown size={14} />
                        </button>
                    </div>

                    <span className="text-slate-500 font-black mb-4">:</span>

                    {/* Minutes */}
                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleTimeChange('m', (parseInt(time.m) + 1).toString()); }}
                            className="text-slate-500 hover:text-white transition-colors"
                        >
                            <ChevronDown className="rotate-180" size={14} />
                        </button>
                        <input
                            type="text"
                            value={time.m}
                            onChange={(e) => handleTimeChange('m', e.target.value)}
                            onBlur={() => setTime(prev => ({ ...prev, m: prev.m.padStart(2, '0') }))}
                            className="w-12 h-10 bg-slate-800 rounded-lg text-center text-lg font-black text-white border border-white/10 focus:border-indigo-500 outline-none"
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); handleTimeChange('m', (parseInt(time.m) - 1).toString()); }}
                            className="text-slate-500 hover:text-white transition-colors"
                        >
                            <ChevronDown size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* CTA */}
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm uppercase tracking-wider shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02]"
            >
                {t.common.datePicker.done}
            </button>
        </div>
    )
}

// --- COUNTDOWN COMPONENT ---
const TaskCountdown = ({ task, updateTask, addNotification }: { task: Task, updateTask: (t: Task) => void, addNotification: (n: any) => void }) => {
    const [timeLeft, setTimeLeft] = useState<{ h: number, m: number, s: number } | null>(null);
    const [phase, setPhase] = useState<'early' | 'mid' | 'late'>('early');

    React.useEffect(() => {
        const calculateTime = () => {
            const now = new Date().getTime();
            const end = new Date(task.deadline).getTime();

            // 3-PHASE REPLACEMENT
            // Use acceptedAt as start. Fallback to 24h prior if missing (legacy support)
            const start = task.acceptedAt ? new Date(task.acceptedAt).getTime() : (end - (24 * 60 * 60 * 1000));
            const totalDuration = end - start;
            const remaining = end - now;

            if (remaining <= 0) {
                setTimeLeft({ h: 0, m: 0, s: 0 });
                setPhase('late');
                return;
            }

            const h = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((remaining % (1000 * 60)) / 1000);

            setTimeLeft({ h, m, s });

            // Calculate Phase
            const ratio = remaining / totalDuration;
            let currentPhase: 'early' | 'mid' | 'late' = 'early';

            if (ratio > 0.66) currentPhase = 'early';
            else if (ratio > 0.33) currentPhase = 'mid';
            else currentPhase = 'late';

            setPhase(currentPhase);

            // Trigger Warning Notification ONLY on Late Phase entry
            if (currentPhase === 'late' && !task.warningSent) {
                addNotification({
                    id: Date.now().toString(),
                    title: '⚠️ CẢNH BÁO TIẾN ĐỘ',
                    message: `Công việc "${task.title}" đã bước vào giai đoạn nước rút (còn < 33% thời gian)!`,
                    time: new Date().toISOString(),
                    read: false,
                    type: 'alert'
                });
                updateTask({ ...task, warningSent: true });
            }
        };

        calculateTime();
        const timer = setInterval(calculateTime, 1000);
        return () => clearInterval(timer);
    }, [task.deadline, task.warningSent, task.id, task.acceptedAt]);

    if (!timeLeft) return <div className="animate-pulse w-16 h-4 bg-white/10 rounded"></div>;

    return (
        <div className={clsx(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-bold text-xs transition-colors",
            phase === 'early' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
            phase === 'mid' && "bg-amber-500/10 text-amber-400 border-amber-500/30",
            phase === 'late' && "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]"
        )}>
            <Clock size={12} className={phase === 'late' ? "animate-spin-slow" : ""} />
            <span>
                {timeLeft.h.toString().padStart(2, '0')}:
                {timeLeft.m.toString().padStart(2, '0')}:
                {timeLeft.s.toString().padStart(2, '0')}
            </span>
            {phase === 'late' && <span className="text-[9px] uppercase tracking-wider ml-1">QUÁ HẠN</span>}
            {phase === 'mid' && <span className="text-[9px] uppercase tracking-wider ml-1">CẦN GẤP</span>}
        </div>
    );
};


import { useAuth } from '../../context/AuthContext';
import { Archive, RefreshCcw, Trash2, Layout } from 'lucide-react';

const TaskManager: React.FC = () => {
    const { tasks, users, logs, addTask, updateTask, deleteTask, addNotification, updateLog } = useData();
    const { t } = useLanguage();
    const { currentUser } = useAuth();

    // Resolve current app user
    const appUser = users.find(u => (u.email || '').toLowerCase() === (currentUser?.email || '').toLowerCase());
    const canEdit = appUser?.isAdmin || (appUser?.permissions?.tasks?.edit !== false); // Default true if undefined

    const [selectedDept, setSelectedDept] = useState('All');
    const [subSelectedDept, setSubSelectedDept] = useState('Thiết kế'); // For New Task Form
    const [deadline, setDeadline] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [activeTab, setActiveTab] = useState<'assigned' | 'archive'>('assigned');
    const [tabCounts, setTabCounts] = useState({ assigned: 0, archive: 0 });

    // New Task Form
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'urgent' | 'high' | 'normal'>('normal');
    const [activeUserId, setActiveUserId] = useState<string>('');
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [attachments, setAttachments] = useState<{ type: 'link' | 'file'; url: string; name: string }[]>([]);

    // --- EDITOR STATE ---
    const [isExpanded, setIsExpanded] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkName, setLinkName] = useState('');

    const inlineRef = React.useRef<HTMLTextAreaElement>(null);
    const expandedRef = React.useRef<HTMLTextAreaElement>(null);

    const insertText = (before: string, after: string = '') => {
        const textarea = isExpanded ? expandedRef.current : inlineRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);

        const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
        setDescription(newText);

        // Restore cursor position after React render
        setTimeout(() => {
            if (textarea) {
                textarea.focus();
                const newCursorPos = start + before.length;
                if (start === end) {
                    // No selection: place cursor inside tags (e.g. **|**)
                    textarea.setSelectionRange(newCursorPos, newCursorPos);
                } else {
                    // Selection: select the text inside tags (e.g. **<selected>**)
                    textarea.setSelectionRange(newCursorPos, newCursorPos + selectedText.length);
                }
            }
        }, 0);
    };


    // --- ATTACHMENT HANDLERS ---
    const handleAddLink = () => {
        if (!linkUrl) return;
        setAttachments([...attachments, {
            type: 'link',
            url: linkUrl,
            name: linkName || "Link"
        }]);
        setLinkUrl('');
        setLinkName('');
        setShowLinkInput(false);
    };

    const [isUploading, setIsUploading] = useState(false);

    const handleAttachFile = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png, image/jpeg, image/jpg'; // Only images
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (file) {
                // Validate Size (5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert("File quá lớn! Vui lòng chọn ảnh dưới 5MB.");
                    return;
                }

                setIsUploading(true);
                try {
                    // Create storage ref
                    const storageRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);
                    setAttachments(prev => [...prev, { type: 'file', url, name: file.name }]);
                } catch (error) {
                    console.error("Upload failed", error);
                    alert("Tải file thất bại. Vui lòng thử lại.");
                } finally {
                    setIsUploading(false);
                }
            }
        };
        input.click();
    };

    // SAFE USER SELECTION LOGIC
    const availableUsers = users.filter(u => {
        const d = u.dept === 'Interwrite' ? 'InterData' : u.dept;
        return d === subSelectedDept;
    });
    // const activeUser = users.find(u => u.id === activeUserId) || availableUsers[0] || { id: '', name: 'No User', avatar: 'https://ui-avatars.com/api/?name=NA&background=334155&color=fff', alias: 'N/A', role: '...', bankAcc: '', bankName: '' };

    // Auto select first order
    React.useEffect(() => {
        if (!selectedOrderId && logs.length > 0) {
            setSelectedOrderId(logs[0].id);
        }
    }, [logs, selectedOrderId]);

    React.useEffect(() => {
        const counts = {
            assigned: tasks.filter(t => t.status === 'pending').length,
            archive: tasks.filter(t => t.status === 'archived').length
        };
        setTabCounts(counts);
    }, [tasks]);

    const handleSoftDelete = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (confirm("Chuyển công việc này vào Kho dữ liệu?")) {
            await updateTask({ id, status: 'archived' } as any);
        }
    };

    const handleRestore = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (confirm("Khôi phục công việc này?")) {
            await updateTask({ id, status: 'pending' } as any);
        }
    };

    const handlePermanentDelete = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (confirm("⚠️ CẢNH BÁO: Hành động này không thể hoàn tác!\nBạn có chắc muốn xóa vĩnh viễn?")) {
            await deleteTask(id);
        }
    };


    // Auto Select first user if activeUserId is empty but users exist
    React.useEffect(() => {
        if (!activeUserId && availableUsers.length > 0) {
            setActiveUserId(availableUsers[0].id);
        }
    }, [availableUsers, activeUserId]);


    const [searchQuery, setSearchQuery] = useState('');
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedTaskId(prev => prev === id ? null : id);
    };

    const handleCreateTask = async () => {
        if (!title || !activeUserId) {
            alert("Vui lòng nhập tiêu đề và chọn người xử lý!");
            return;
        }

        // Generate Department Abbreviation
        const deptAbbreviations: Record<string, string> = {
            'Tài chính': 'TC',
            'Hồ sơ năng lực': 'HSNL',
            'Đầu ra': 'DR',
            'Dữ liệu': 'DL',
            'Thiết kế': 'TK',
            'Thông tin đầu ra': 'TTDR',
            'Pháp lý': 'PL'
        };
        const deptCode = deptAbbreviations[subSelectedDept] || subSelectedDept.substring(0, 2).toUpperCase();

        // Generate Task Code
        let taskCode = '';
        if (selectedOrderId) {
            // Count existing tasks for this order + department
            const existingCount = tasks.filter(t =>
                t.orderId === selectedOrderId && t.department === subSelectedDept
            ).length;
            const sequence = (existingCount + 1).toString().padStart(2, '0');
            // Format: ORD001-TK-01
            taskCode = `${selectedOrderId.replace('-', '')}-${deptCode}-${sequence}`;
        } else {
            // If no order linked, use date-based code
            const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
            const randomSeq = Math.floor(Math.random() * 100).toString().padStart(2, '0');
            taskCode = `NV-${deptCode}-${dateCode}-${randomSeq}`;
        }

        const newTask: Task = {
            id: `TSK-${Date.now()}`,
            title: title.trim(),
            assigneeId: activeUserId,
            priority,
            deadline: deadline.toISOString(),
            status: 'pending',
            department: subSelectedDept,
            description: (description || '').trim(),
            orderId: selectedOrderId || '',
            taskCode: taskCode,
            attachments: attachments.map(a => ({
                type: a.type || 'link',
                url: a.url || '',
                name: a.name || 'Attachment'
            })),
            // Explicitly set optional fields to avoid undefined if Interface expects them roughly
            createdAt: new Date().toISOString()
        };

        // Deep sanitize
        const safeTask = JSON.parse(JSON.stringify(newTask));

        try {
            await addTask(safeTask);

            setTitle('');
            setDescription('');
            setAttachments([]); // Reset attachments
            setPriority('normal');

            // Optional: Close expanded view if open
            if (isExpanded) setIsExpanded(false);

            // alert(t.common.success); // Removed as per user request
            console.log("Task created successfully");
        } catch (error: any) {
            console.error("Failed to create task:", error);
            const msg = error?.message || "Unknown error";
            alert(`Lỗi khi tạo công việc: ${msg}`);
        }
    };



    // Handle Accept Task - Sync to Order List
    const handleAcceptTask = (task: Task) => {
        const acceptedAt = new Date().toISOString();
        const assignee = users.find(u => u.id === task.assigneeId);

        // 1. Update the Task
        updateTask({
            ...task,
            status: 'active',
            acceptedAt,
            warningSent: false
        });

        // 2. If task is linked to an order, update that order's timeline
        if (task.orderId) {
            const order = logs.find(o => o.id === task.orderId);
            if (order) {
                const newTimelineEvent = {
                    id: `TL-${Date.now()}`,
                    department: task.department,
                    timestamp: acceptedAt,
                    status: 'in-progress' as const,
                    note: `Nhiệm vụ "${task.title}" đã được ${assignee?.name || 'nhân viên'} nhận xử lý.`
                };

                updateLog({
                    ...order,
                    status: 'processing',
                    timeline: [...(order.timeline || []), newTimelineEvent]
                });

                addNotification({
                    id: Date.now().toString(),
                    title: '📦 Đơn hàng cập nhật',
                    message: `Đơn hàng ${order.id} đã có tiến độ mới từ ${task.department}.`,
                    time: new Date().toISOString(),
                    read: false,
                    type: 'info'
                });
            }
        }
    };

    const filteredTasks = tasks.filter(t => {
        const matchesDept = selectedDept === 'All' || t.department === selectedDept;
        const matchesSearch = (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.id || '').toLowerCase().includes(searchQuery.toLowerCase());

        let matchesTab = false;
        if (activeTab === 'assigned') matchesTab = t.status === 'pending';
        else if (activeTab === 'archive') matchesTab = t.status === 'archived';

        return matchesDept && matchesSearch && matchesTab;
    });

    const groupedTasks = React.useMemo(() => {
        const sorted = [...filteredTasks].sort((a, b) => {
            // Newest first (descending)
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            // Fallback to ID if needed, but ID format TSK-timestamp helps too
            return dateB - dateA;
        });

        const groups: { [key: string]: Task[] } = {};
        sorted.forEach(t => {
            const date = t.createdAt ? new Date(t.createdAt) : new Date();
            // Group by Date String
            const key = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });
        return groups;
    }, [filteredTasks]);

    return (
        <div className="h-[calc(100vh-7rem)] flex flex-col gap-4 overflow-hidden relative">
            <div className="flex-1 flex flex-col lg:flex-row gap-6 lg:overflow-hidden overflow-y-auto">
                {/* LEFT: New Task Form */}
                {canEdit && (
                    <div className="w-full lg:w-1/3 flex flex-col gap-4 lg:overflow-y-auto overflow-visible custom-scrollbar pr-2 shrink-0">
                        <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-indigo-500/30 shadow-xl dark:shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                <Plus className="bg-indigo-600 text-white rounded-lg p-0.5" size={24} /> {t.common.add} {t.sidebar.tasks}
                            </h2>

                            {/* Smart Filters Group */}
                            <div className="space-y-4 mb-6 relative z-20">
                                {/* 1. TIÊU ĐỀ (TITLE) */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block pl-1">
                                        Tiêu đề
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors placeholder-slate-400 dark:placeholder-slate-500"
                                        placeholder="Nhập tiêu đề công việc..."
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                    />
                                </div>

                                {/* Department & Assignee */}
                                {/* Department & Assignee */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-white/10 space-y-4 relative z-50">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2 pl-1">
                                            Bộ phận
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {departments.filter(d => d !== 'All').map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => { setSubSelectedDept(d); setActiveUserId(''); }}
                                                    className={clsx(
                                                        "py-2 rounded-lg text-xs font-bold border transition-all uppercase tracking-wider",
                                                        subSelectedDept === d
                                                            ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
                                                            : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-white"
                                                    )}
                                                >
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2 pl-1">
                                            Đầu mối xử lý
                                        </label>

                                        <div className="grid grid-cols-1 gap-3">
                                            {availableUsers.map(user => {
                                                const isSelected = activeUserId === user.id;

                                                // Status Logic
                                                const getUserStatusInfo = (u: any) => {
                                                    const now = new Date();
                                                    const nowIso = now.toISOString();

                                                    // 1. Check Leaves (Red)
                                                    if (u.leaves) {
                                                        for (const leave of u.leaves) {
                                                            if (leave.type === 'leave') {
                                                                const todayLocal = now.toLocaleDateString('en-CA');
                                                                if (todayLocal >= leave.start && todayLocal <= leave.end) {
                                                                    return { color: "bg-red-500 shadow-[0_0_10px_#ef4444]", label: "NGHỈ PHÉP", dotColor: "bg-red-500", textColor: "text-red-400", borderColor: "border-red-500/20", bgObj: "bg-red-500/10" };
                                                                }
                                                            } else if (leave.type === 'absence') {
                                                                if (nowIso >= leave.start && nowIso <= leave.end) {
                                                                    return { color: "bg-red-500 shadow-[0_0_10px_#ef4444]", label: "VẮNG MẶT", dotColor: "bg-red-500", textColor: "text-red-400", borderColor: "border-red-500/20", bgObj: "bg-red-500/10" };
                                                                }
                                                            }
                                                        }
                                                    }

                                                    // 2. Check Online (Green)
                                                    if (u.lastSeen) {
                                                        const diff = now.getTime() - new Date(u.lastSeen).getTime();
                                                        if (diff < 5 * 60 * 1000) {
                                                            return { color: "bg-emerald-500 shadow-[0_0_10px_#10b981]", label: "ONLINE", dotColor: "bg-emerald-500", textColor: "text-emerald-400", borderColor: "border-emerald-500/20", bgObj: "bg-emerald-500/10", animate: true };
                                                        }
                                                    }

                                                    // 3. Default (Yellow/Amber - Offline/Away)
                                                    return { color: "bg-amber-400 shadow-[0_0_10px_#fbbf24] opacity-80", label: "OFFLINE", dotColor: "bg-amber-400", textColor: "text-amber-400", borderColor: "border-amber-500/20", bgObj: "bg-amber-500/10" };
                                                };

                                                const status = getUserStatusInfo(user);

                                                return (
                                                    <div
                                                        key={user.id}
                                                        onClick={() => setActiveUserId(user.id)}
                                                        className={clsx(
                                                            "relative p-3 rounded-xl border transition-all duration-300 cursor-pointer group overflow-hidden",
                                                            isSelected
                                                                ? "bg-indigo-50 dark:bg-indigo-900/40 border-indigo-500 shadow-lg dark:shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                                                                : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-indigo-200 dark:hover:border-white/10 grayscale opacity-90 dark:opacity-60 hover:grayscale-0 hover:opacity-100"
                                                        )}
                                                    >
                                                        {/* Selected Indicator */}
                                                        {isSelected && (
                                                            <div className="absolute top-2 right-2 z-20">
                                                                <div className="bg-indigo-500 rounded-full p-0.5 shadow-lg shadow-indigo-500/50">
                                                                    <CheckCircle2 size={14} className="text-white" />
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-3">
                                                            <div className="relative shrink-0">
                                                                <img
                                                                    src={user.avatar}
                                                                    className={clsx(
                                                                        "w-12 h-12 rounded-lg object-cover shadow-lg transition-transform duration-500",
                                                                        isSelected ? "border-2 border-indigo-400" : "border border-white/10"
                                                                    )}
                                                                />
                                                                <div className={clsx(
                                                                    "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 shadow-lg",
                                                                    status.color,
                                                                    status.animate && "animate-pulse"
                                                                )} />
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <h4 className={clsx(
                                                                    "font-bold text-sm leading-tight mb-0.5 transition-colors",
                                                                    isSelected ? "text-indigo-700 dark:text-white" : "text-slate-700 dark:text-slate-300"
                                                                )}>
                                                                    {user.name}
                                                                </h4>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                                                        {user.alias || 'N/A'}
                                                                    </span>
                                                                    <div className={clsx(
                                                                        "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide flex items-center gap-1",
                                                                        status.bgObj, status.textColor, status.borderColor
                                                                    )}>
                                                                        <div className={clsx("w-1 h-1 rounded-full", status.dotColor)} />
                                                                        {status.label}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Glow Effect for Selected */}
                                                        {isSelected && (
                                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none" />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>



                                {/* B. GLASS DATE TIME PICKER */}
                                <div className="mb-6 relative z-40">
                                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2 pl-1">Thời hạn (Deadline)</label>
                                    <button
                                        onClick={() => setShowDatePicker(!showDatePicker)}
                                        className="w-full flex items-center justify-between bg-bg-elevated border border-border rounded-xl px-4 py-3 text-sm text-text-main hover:border-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all group"
                                    >
                                        <span className="flex items-center gap-3">
                                            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 group-hover:text-indigo-400 transition-colors">
                                                <Calendar size={16} />
                                            </div>
                                            <span className="font-mono font-bold text-lg tracking-tight group-hover:text-indigo-500 transition-colors">
                                                {formatDate(deadline, 'date')}
                                            </span>
                                        </span>
                                        <span className="text-text-muted font-black text-xs bg-bg-card px-2 py-1 rounded border border-border group-hover:border-indigo-500/30 transition-colors">
                                            {formatDate(deadline, 'time-h')}:{formatDate(deadline, 'time-m')}
                                        </span>
                                    </button>

                                    <AnimatePresence>
                                        {showDatePicker && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                                className="absolute top-full left-0 right-0 mt-3 z-50"
                                            >
                                                <GlassDatePicker
                                                    selected={deadline}
                                                    onSelect={(d) => setDeadline(d)}
                                                    onClose={() => setShowDatePicker(false)}
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* C. RICH COMMAND EDITOR */}
                                <div className="flex-1 flex flex-col mb-6 group relative">
                                    <div className="flex justify-between items-end mb-2 px-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">NỘI DUNG</label>

                                        {/* Priority Toggles */}
                                        <div className="flex flex-col items-end gap-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Mức độ ưu tiên</label>
                                            <div className="flex bg-slate-100 dark:bg-slate-900/50 rounded-lg p-1 border border-slate-200 dark:border-white/5">
                                                {['urgent', 'high', 'normal'].map(p => {
                                                    const label = p === 'urgent' ? 'KHẨN CẤP' : p === 'high' ? 'CAO' : 'BÌNH THƯỜNG';
                                                    return (
                                                        <button
                                                            key={p}
                                                            onClick={() => setPriority(p as any)}
                                                            className={clsx(
                                                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all",
                                                                priority === p
                                                                    ? (p === 'urgent' ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : p === 'high' ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "bg-blue-500 text-white shadow-lg shadow-blue-500/30")
                                                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300"
                                                            )}
                                                        >
                                                            {label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div
                                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90]"
                                            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                                        />
                                    )}
                                    <div className={clsx(
                                        "flex flex-col transition-all duration-300 overflow-hidden",
                                        isExpanded
                                            ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[90vw] h-[85vh] bg-[#0f172a] shadow-2xl rounded-2xl border border-indigo-500/50 p-6"
                                            : "glass-panel bg-slate-950/30 rounded-2xl border border-white/10 group-focus-within:border-indigo-500/50 group-focus-within:shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                                    )}>
                                        {/* Toolbar */}
                                        <div className="flex items-center gap-1 p-2 bg-bg-elevated/50 border-b border-border">
                                            <button type="button" onMouseDown={(e) => { e.preventDefault(); insertText('**', '**'); }} className="p-1.5 hover:bg-bg-elevated rounded-lg text-text-muted hover:text-text-main transition-colors" title="Bold"><Bold size={14} /></button>
                                            <button type="button" onMouseDown={(e) => { e.preventDefault(); insertText('*', '*'); }} className="p-1.5 hover:bg-bg-elevated rounded-lg text-text-muted hover:text-text-main transition-colors" title="Italic"><Italic size={14} /></button>
                                            <button type="button" onMouseDown={(e) => { e.preventDefault(); insertText('<u>', '</u>'); }} className="p-1.5 hover:bg-bg-elevated rounded-lg text-text-muted hover:text-text-main transition-colors" title="Underline"><Underline size={14} /></button>
                                            <div className="w-[1px] h-4 bg-border mx-1" />
                                            <button type="button" onMouseDown={(e) => { e.preventDefault(); insertText('## '); }} className="p-1.5 hover:bg-bg-elevated rounded-lg text-text-muted hover:text-text-main transition-colors" title="Heading"><Type size={14} /></button>
                                            <button type="button" onMouseDown={(e) => { e.preventDefault(); insertText('- '); }} className="p-1.5 hover:bg-bg-elevated rounded-lg text-text-muted hover:text-text-main transition-colors" title="List"><List size={14} /></button>

                                            <div className="flex-1" />

                                            <button
                                                type="button"
                                                onClick={() => setIsExpanded(!isExpanded)}
                                                className="p-1.5 hover:bg-indigo-500/20 text-indigo-500 rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <span className="text-[10px] font-bold uppercase tracking-wider">{isExpanded ? "THU NHỎ" : "PHÓNG TO"}</span>
                                                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                            </button>
                                        </div>

                                        <textarea
                                            ref={inlineRef}
                                            className={clsx(
                                                "w-full bg-transparent border-none outline-none p-4 resize-none text-sm text-text-main placeholder-text-muted font-medium leading-relaxed custom-scrollbar",
                                                isExpanded ? "flex-1 text-lg max-w-4xl mx-auto" : "min-h-[120px]"
                                            )}
                                            placeholder="Nhập nội dung chi tiết tại đây..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        ></textarea>

                                        {/* 3. ATTACHMENT SYSTEM */}
                                        <div className={clsx("px-4 pb-4", isExpanded && "max-w-4xl mx-auto w-full")}>
                                            {/* Link Input Form */}
                                            <AnimatePresence>
                                                {showLinkInput && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden mb-3"
                                                    >
                                                        <div className="bg-bg-elevated rounded-xl p-3 border border-indigo-500/30 flex gap-2 items-center">
                                                            <Link size={14} className="text-indigo-500 shrink-0" />
                                                            <input
                                                                type="text"
                                                                placeholder="URL (https://...)"
                                                                className="bg-transparent border-none outline-none text-xs text-text-main placeholder-text-muted flex-1 font-mono"
                                                                value={linkUrl}
                                                                onChange={e => setLinkUrl(e.target.value)}
                                                                autoFocus
                                                            />
                                                            <div className="w-[1px] h-4 bg-border" />
                                                            <input
                                                                type="text"
                                                                placeholder="Tên hiển thị (Tùy chọn)"
                                                                className="bg-transparent border-none outline-none text-xs text-text-main placeholder-text-muted w-32"
                                                                value={linkName}
                                                                onChange={e => setLinkName(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && handleAddLink()}
                                                            />
                                                            <button onClick={handleAddLink} className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors whitespace-nowrap">THÊM</button>
                                                            <button onClick={() => setShowLinkInput(false)} className="text-[10px] font-bold hover:bg-bg-elevated text-text-muted px-2 py-1 rounded transition-colors whitespace-nowrap"><X size={12} /></button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Attachment List */}
                                            {attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {attachments.map((att, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 bg-bg-elevated border border-border px-2 py-1 rounded-md text-[10px] text-text-secondary group/att">
                                                            {att.type === 'link' ? <Link size={10} className="text-blue-500" /> : <ImageIcon size={10} className="text-emerald-500" />}
                                                            <span className="max-w-[150px] truncate">{att.name}</span>
                                                            <button
                                                                onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                                                                className="hover:text-red-500 transition-colors opacity-50 group-hover/att:opacity-100"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex gap-2 mb-2">
                                                <button
                                                    type="button"
                                                    onClick={handleAttachFile}
                                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border text-xs text-text-muted hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
                                                >
                                                    <ImageIcon size={12} /> Đính kèm File
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setShowLinkInput(!showLinkInput);
                                                    }}
                                                    className={clsx(
                                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all",
                                                        showLinkInput
                                                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                                            : "bg-bg-elevated text-text-muted border-border hover:text-indigo-400 hover:border-indigo-500/30"
                                                    )}
                                                >
                                                    <Link size={12} /> Thêm Link
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. THE POWER BUTTON */}
                                <button
                                    onClick={handleCreateTask}
                                    className="mt-auto w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_10px_40px_-10px_rgba(79,70,229,0.5)] border border-indigo-400/20 transition-all hover:-translate-y-1 hover:shadow-indigo-500/40 relative group overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-200%] group-hover:animate-shimmer" />
                                    <span className="relative flex items-center justify-center gap-3">
                                        <Plus size={18} strokeWidth={3} /> {t.tasks.panel.submit}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* RIGHT: Running Tasks Grid */}
                <div className={clsx("bg-bg-card rounded-2xl border border-border p-6 flex flex-col min-w-0", canEdit ? "w-full lg:flex-1" : "w-full")}>
                    <div className="flex flex-col gap-6 mb-6">
                        {/* HEADER BANNER */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white shadow-xl isolate mb-6">
                            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>

                            <div className="relative z-10 flex justify-between items-end">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight mb-1">Danh sách công việc</h2>
                                    <p className="text-indigo-100 text-sm font-medium opacity-90">Quản lý và theo dõi tiến độ dự án hiệu quả</p>
                                </div>
                                <div className="hidden md:block">
                                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                                        <Calendar size={16} className="text-indigo-200" />
                                        <span className="text-xs font-bold font-mono">{new Date().toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* STATS METRIC CARDS - VIBRANT */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-2xl border border-slate-700/50 flex flex-col gap-2 relative overflow-hidden group shadow-lg">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity rotate-12">
                                    <Layout size={40} className="text-white" />
                                </div>
                                <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Tổng số</span>
                                <span className="text-3xl font-black text-white tracking-tight">{tasks.length}</span>
                            </div>

                            <div className="bg-gradient-to-br from-purple-500 to-fuchsia-600 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group shadow-lg shadow-purple-500/20">
                                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-30 transition-opacity rotate-12">
                                    <Clock size={40} className="text-white" />
                                </div>
                                <span className="text-[10px] uppercase font-black text-purple-100 tracking-widest">Chờ xử lý</span>
                                <span className="text-3xl font-black text-white tracking-tight">{tasks.filter(t => t.status === 'pending').length}</span>
                            </div>

                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group shadow-lg shadow-emerald-500/20">
                                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-30 transition-opacity rotate-12">
                                    <CheckCircle2 size={40} className="text-white" />
                                </div>
                                <span className="text-[10px] uppercase font-black text-emerald-100 tracking-widest">Đang thực hiện</span>
                                <span className="text-3xl font-black text-white tracking-tight">{tasks.filter(t => t.status === 'active').length}</span>
                            </div>

                            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group shadow-lg shadow-blue-500/20">
                                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-30 transition-opacity rotate-12">
                                    <Archive size={40} className="text-white" />
                                </div>
                                <span className="text-[10px] uppercase font-black text-blue-100 tracking-widest">Hoàn thành</span>
                                <span className="text-3xl font-black text-white tracking-tight">{tasks.filter(t => t.status === 'completed').length}</span>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">

                            <div className="w-full lg:w-auto flex flex-col lg:flex-row gap-3 lg:items-center overflow-hidden">
                                {/* TABS */}
                                <div className="flex bg-bg-elevated p-1 rounded-xl border border-border overflow-x-auto no-scrollbar shrink-0">
                                    <button
                                        onClick={() => setActiveTab('assigned')}
                                        className={clsx(
                                            "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                                            activeTab === 'assigned' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-text-muted hover:text-text-main"
                                        )}
                                    >
                                        <Layout size={14} /> GIAO VIỆC <span className="text-[9px] bg-white/20 px-1.5 rounded-full">{tabCounts.assigned}</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('archive')}
                                        className={clsx(
                                            "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                                            activeTab === 'archive' ? "bg-slate-600 text-white shadow-lg" : "text-text-muted hover:text-text-main"
                                        )}
                                    >
                                        <Archive size={14} /> KHO DỮ LIỆU <span className="text-[9px] bg-white/20 px-1.5 rounded-full">{tabCounts.archive}</span>
                                    </button>
                                </div>

                                <div className="flex gap-2 items-center w-full lg:w-auto">
                                    {/* Department Filters - Improved PILL Container */}
                                    <div className="flex-1 lg:flex-none flex gap-1.5 overflow-x-auto scrollbar-hide pb-0 mask-linear max-w-full lg:max-w-[400px] items-center">
                                        {departments.map(dept => (
                                            <button
                                                key={dept}
                                                onClick={() => setSelectedDept(dept)}
                                                className={clsx(
                                                    "px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all select-none shrink-0 border",
                                                    selectedDept === dept
                                                        ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20"
                                                        : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-white"
                                                )}
                                            >
                                                {dept === 'All' ? 'Tất cả' : dept}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative shrink-0">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                        <input
                                            type="text"
                                            placeholder={t.common.search}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="bg-bg-elevated border border-border rounded-lg py-1.5 pl-8 pr-3 text-xs text-text-main focus:border-indigo-500 outline-none w-32 lg:w-40 placeholder-text-muted"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tasks Grid grouped by Date */}
                    <div className="grid grid-cols-1 gap-8 overflow-y-auto custom-scrollbar pr-2 lg:h-[calc(100vh-14rem)] h-auto content-start pb-20">
                        {Object.entries(groupedTasks).map(([date, groupTasks]) => (
                            <div key={date} className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Date Header */}
                                <div className="sticky top-0 z-20 bg-bg-card/95 backdrop-blur-sm py-3 mb-4 flex items-center gap-3 border-b border-border shadow-sm">
                                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
                                    <h3 className="text-sm font-bold text-text-main uppercase tracking-widest">{date}</h3>
                                    <span className="text-[10px] font-mono bg-bg-elevated text-text-muted px-1.5 py-0.5 rounded border border-border">{groupTasks.length}</span>
                                </div>

                                {/* Task Cards Grid for this Date */}
                                <div className="grid grid-cols-2 gap-4">
                                    {groupTasks.map(task => {
                                        const assigneeUser = users.find(u => u.id === task.assigneeId);
                                        const isOverdue = new Date(task.deadline).getTime() < new Date().getTime();
                                        const isPending = task.status === 'pending';
                                        const isMyTask = appUser && assigneeUser && appUser.id === assigneeUser.id;
                                        const isExpanded = expandedTaskId === task.id;

                                        return (
                                            <div key={task.id} className={clsx(
                                                "glass-panel rounded-2xl border border-border relative group transition-all duration-300 hover:border-indigo-500/30 overflow-hidden",
                                                task.status === 'completed' ? "opacity-60" : "",
                                                isExpanded ? "row-span-2 bg-bg-elevated border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]" : "bg-bg-card"
                                            )}>
                                                {/* Main Click Area */}
                                                <div
                                                    onClick={() => toggleExpand(task.id)}
                                                    className="p-5 cursor-pointer"
                                                >
                                                    {/* Header */}
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex gap-2">
                                                            {task.priority === 'urgent' && <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-500 px-2 py-0.5 rounded border border-red-500/20">{t.tasks.priority.urgent}</span>}
                                                            {task.priority === 'high' && <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">{t.tasks.priority.high}</span>}
                                                            {task.priority === 'normal' && <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded border border-blue-500/20">{t.tasks.priority.normal}</span>}
                                                            {isPending && <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded border border-purple-500/20 animate-pulse">CHỜ XỬ LÝ</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {!isPending && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); updateTask({ ...task, status: task.status === 'active' ? 'completed' : 'active' }); }}
                                                                    className={clsx(
                                                                        "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                                                                        task.status === 'completed' ? "bg-emerald-500 border-emerald-500" : "border-text-muted hover:border-emerald-400"
                                                                    )}
                                                                >
                                                                    {task.status === 'completed' && <X size={10} className="text-white rotate-45" strokeWidth={4} />}
                                                                </button>
                                                            )}
                                                            <div className="flex items-center gap-1">
                                                                {activeTab === 'archive' ? (
                                                                    <>
                                                                        <button onClick={(e) => handleRestore(task.id, e)} className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-500 transition-colors" title="Khôi phục">
                                                                            <RefreshCcw size={14} />
                                                                        </button>
                                                                        <button onClick={(e) => handlePermanentDelete(task.id, e)} className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors" title="Xóa vĩnh viễn">
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button onClick={(e) => handleSoftDelete(task.id, e)} className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1" title="Lưu trữ">
                                                                        <Archive size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <ChevronDown size={16} className={clsx("text-text-muted transition-transform duration-300", isExpanded ? "rotate-180" : "")} />
                                                        </div>
                                                    </div>

                                                    <h3 className={clsx("font-medium text-text-main mb-2 line-clamp-2", task.status === 'completed' && "line-through text-text-muted")}>
                                                        {task.title}
                                                    </h3>

                                                    {/* Summary Row */}
                                                    <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                                                        <div className="flex items-center gap-2">
                                                            <img src={assigneeUser?.avatar || 'https://ui-avatars.com/api/?name=NA'} alt="User" className="w-6 h-6 rounded-full border border-border" />
                                                            <div>
                                                                <div className="text-xs font-semibold text-text-main">{assigneeUser?.alias || 'Unknown'}</div>
                                                                <div className="flex items-center gap-1 text-[10px] text-text-muted font-mono mt-0.5">
                                                                    <Clock size={10} />
                                                                    <span>{new Date(task.createdAt || 0).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Action/Countdown */}
                                                        <div onClick={e => e.stopPropagation()}>
                                                            {isPending && isMyTask ? (
                                                                <button
                                                                    onClick={() => handleAcceptTask(task)}
                                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1"
                                                                >
                                                                    <CheckCircle2 size={12} /> NHẬN VIỆC
                                                                </button>
                                                            ) : (
                                                                task.status === 'active' ? (
                                                                    <TaskCountdown
                                                                        task={task}
                                                                        updateTask={updateTask}
                                                                        addNotification={addNotification}
                                                                    />
                                                                ) : (
                                                                    <div className={clsx(
                                                                        "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-bg-elevated border",
                                                                        isOverdue ? "text-red-500 border-red-500/30" : "text-text-muted border-border"
                                                                    )}>
                                                                        <AlertCircle size={12} />
                                                                        {formatDate(task.deadline, 'full')}
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* EXPANDED CONTENT */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="px-5 pb-5 border-t border-white/5 bg-slate-900/30"
                                                        >
                                                            <div className="pt-4 space-y-4">
                                                                {/* Description */}
                                                                <div>
                                                                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">NỘI DUNG CHI TIẾT</div>
                                                                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/50 p-4 rounded-xl border border-white/5 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                                        {task.description || <span className="text-slate-500 italic">Không có mô tả</span>}
                                                                    </div>
                                                                </div>

                                                                {/* Attachments */}
                                                                {task.attachments.length > 0 && (
                                                                    <div>
                                                                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">TÀI LIỆU ĐÍNH KÈM ({task.attachments.length})</div>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {task.attachments.map((att, i) => (
                                                                                <a
                                                                                    key={i}
                                                                                    href={att.url}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className={clsx(
                                                                                        "flex items-center gap-2 border px-3 py-2 rounded-lg transition-colors group/link",
                                                                                        att.type === 'link'
                                                                                            ? "bg-blue-500/10 border-blue-500/30 hover:bg-blue-600"
                                                                                            : "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-600"
                                                                                    )}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    {att.type === 'link' ? (
                                                                                        <>
                                                                                            <Link size={14} className="text-blue-400 group-hover/link:text-white" />
                                                                                            <span className="text-[9px] bg-blue-500/30 text-blue-300 px-1 rounded font-bold">LINK</span>
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <ImageIcon size={14} className="text-emerald-400 group-hover/link:text-white" />
                                                                                            <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 rounded font-bold">FILE</span>
                                                                                        </>
                                                                                    )}
                                                                                    <span className="text-xs font-medium text-slate-200 group-hover/link:text-white">{att.name}</span>
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Metadata */}
                                                                <div className="flex flex-col gap-1 text-[10px] text-slate-500 uppercase tracking-widest font-mono pt-2 border-t border-white/5">
                                                                    <div className="flex justify-between items-center">
                                                                        <span>MÃ BÁO CÁO: <strong className="text-indigo-400">{task.taskCode || task.id}</strong></span>
                                                                        <span>ID: {task.id}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span>ĐƠN HÀNG: {task.orderId || 'Không liên kết'}</span>
                                                                        <span>TẠO LÚC: {new Date(task.createdAt || 0).toLocaleString('vi-VN')}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* STATUS BAR FOOTER */}

            {/* EXPANDED EDITOR MODAL */}
            {
                isExpanded && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                            onClick={() => setIsExpanded(false)}
                        />
                        <div className="relative w-full max-w-6xl h-[85vh] bg-bg-modal rounded-2xl border border-indigo-500/50 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Modal Toolbar */}
                            <div className="flex items-center gap-1 p-3 bg-bg-elevated/50 border-b border-border shrink-0">
                                <button type="button" onMouseDown={(e) => { e.preventDefault(); insertText('**', '**'); }} className="p-2 hover:bg-bg-elevated rounded-lg text-text-muted hover:text-text-main transition-colors" title="Bold"><Bold size={16} /></button>
                                <button type="button" onMouseDown={(e) => { e.preventDefault(); insertText('*', '*'); }} className="p-2 hover:bg-bg-elevated rounded-lg text-text-muted hover:text-text-main transition-colors" title="Italic"><Italic size={16} /></button>
                                <button type="button" onMouseDown={(e) => { e.preventDefault(); insertText('- '); }} className="p-2 hover:bg-bg-elevated rounded-lg text-text-muted hover:text-text-main transition-colors" title="List"><List size={16} /></button>
                                <div className="w-[1px] h-4 bg-border mx-2" />
                                <div className="flex-1 font-bold text-text-muted uppercase tracking-widest text-xs">Soạn thảo chi tiết</div>
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(false)}
                                    className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <span className="text-xs font-bold uppercase tracking-wider">Thu nhỏ</span>
                                    <Minimize2 size={16} />
                                </button>
                            </div>

                            {/* Modal Editor Area */}
                            <div className="flex-1 overflow-hidden relative flex flex-col">
                                <textarea
                                    ref={expandedRef}
                                    className="flex-1 w-full bg-transparent border-none outline-none p-6 resize-none text-base text-text-main placeholder-text-muted font-medium leading-relaxed custom-scrollbar"
                                    placeholder="Nhập nội dung chi tiết tại đây..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    autoFocus
                                />

                                {/* Attachments Section in Modal */}
                                <div className="p-4 bg-bg-elevated/50 border-t border-border shrink-0">
                                    {/* Link Input */}
                                    <AnimatePresence>
                                        {showLinkInput && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden mb-3"
                                            >
                                                <div className="bg-bg-elevated rounded-xl p-3 border border-indigo-500/30 flex gap-2 items-center">
                                                    <Link size={14} className="text-indigo-500 shrink-0" />
                                                    <input
                                                        type="text"
                                                        placeholder="URL (https://...)"
                                                        className="bg-transparent border-none outline-none text-xs text-text-main placeholder-text-muted flex-1 font-mono"
                                                        value={linkUrl}
                                                        onChange={e => setLinkUrl(e.target.value)}
                                                    />
                                                    <div className="w-[1px] h-4 bg-border" />
                                                    <input
                                                        type="text"
                                                        placeholder="Tên hiển thị (Tùy chọn)"
                                                        className="bg-transparent border-none outline-none text-xs text-text-main placeholder-text-muted w-32"
                                                        value={linkName}
                                                        onChange={e => setLinkName(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleAddLink()}
                                                    />
                                                    <button onClick={handleAddLink} className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors whitespace-nowrap">THÊM</button>
                                                    <button onClick={() => setShowLinkInput(false)} className="text-[10px] font-bold hover:bg-bg-elevated text-text-muted px-2 py-1 rounded transition-colors whitespace-nowrap"><X size={12} /></button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Attachment List */}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {attachments.map((att, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 bg-bg-elevated border border-border px-2 py-1 rounded-md text-[10px] text-text-secondary group/att">
                                                {att.type === 'link' ? <Link size={10} className="text-blue-500" /> : <ImageIcon size={10} className="text-emerald-500" />}
                                                <span className="max-w-[150px] truncate">{att.name}</span>
                                                <button
                                                    onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                                                    className="hover:text-red-500 transition-colors opacity-50 group-hover/att:opacity-100"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleAttachFile}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border text-xs text-text-muted hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
                                        >
                                            <ImageIcon size={12} /> {isUploading ? 'Đang tải...' : 'Đính kèm File'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setShowLinkInput(!showLinkInput);
                                            }}
                                            className={clsx(
                                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all",
                                                showLinkInput
                                                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                                    : "bg-bg-elevated text-text-muted border-border hover:text-indigo-400 hover:border-indigo-500/30"
                                            )}
                                        >
                                            <Link size={12} /> Thêm Link
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default TaskManager;

import React, { useState } from 'react';
import {
    Search, AlertOctagon, CheckCircle2, Clock,
    MapPin, Camera, AlertTriangle, Printer, ArrowRight, X, Save, CheckSquare,
    Layout, Box, RefreshCcw, Plus, FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useData, OrderLog, TimelineEvent } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';

const OrderCard: React.FC<{ order: OrderLog; isSelected: boolean; onClick: () => void }> = ({ order, isSelected, onClick }) => {
    const { t } = useLanguage();
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={onClick}
            className={clsx(
                "p-5 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group mb-4 backdrop-blur-md",
                isSelected
                    ? "bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/40 dark:to-slate-900/40 border border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)] scale-[1.02]"
                    : "bg-white/60 dark:bg-white/5 border border-white/20 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-white/80 dark:hover:bg-white/10"
            )}
        >
            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-cyan-500" />}

            <div className="flex justify-between items-start mb-3 relative z-10">
                <span className="font-mono text-indigo-600 dark:text-indigo-300 font-bold tracking-wider text-xs bg-indigo-50 dark:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-500/30">
                    {order.id}
                </span>
                {order.status === 'processing' && <span className="bg-blue-500/10 text-blue-600 dark:text-blue-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-blue-500/20">{t.common.processing}</span>}
                {order.status === 'rework' && <span className="bg-red-500/10 text-red-600 dark:text-red-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">{t.common.rework}</span>}
                {order.status === 'completed' && <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-emerald-500/20">{t.common.completed}</span>}
            </div>

            <h4 className="text-slate-900 dark:text-white font-bold text-base mb-4 line-clamp-2 leading-tight group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                {order.customer}
            </h4>

            <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Clock size={12} className="text-indigo-400" />
                        <span className="font-mono font-medium">{order.dueDate ? new Date(order.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : 'N/A'}</span>
                    </div>
                    {order.deliveryAttempts !== undefined && order.deliveryAttempts > 0 && (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            <MapPin size={10} />
                            <span>{order.deliveryAttempts}</span>
                        </div>
                    )}
                </div>

                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                        className={clsx(
                            "h-full rounded-full transition-all duration-500 shadow-[0_0_8px_currentColor]",
                            order.status === 'rework' ? "bg-red-500 text-red-500" : "bg-gradient-to-r from-indigo-500 to-cyan-500 text-cyan-500"
                        )}
                        style={{ width: `${order.progress || 0}%` }}
                    />
                </div>
            </div>

            {/* Decorative Glow */}
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
        </motion.div>
    );
};

const TaskCard: React.FC<{ task: any; isSelected: boolean; onClick: () => void }> = ({ task, isSelected, onClick }) => {
    const deadlineDate = new Date(task.deadline);
    const validDate = !isNaN(deadlineDate.getTime());
    const isOverdue = validDate ? deadlineDate.getTime() < new Date().getTime() : false;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={onClick}
            className={clsx(
                "p-5 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group mb-4 backdrop-blur-md",
                isSelected
                    ? "bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/40 dark:to-slate-900/40 border border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)] scale-[1.02]"
                    : "bg-white/60 dark:bg-white/5 border border-white/20 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-white/80 dark:hover:bg-white/10"
            )}
        >
            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-cyan-500" />}

            <div className="flex justify-between items-start mb-2">
                <span className={clsx(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-sm",
                    task.priority === 'urgent' ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                )}>
                    {task.priority || 'Normal'}
                </span>
                <span className="text-xs text-slate-400 font-mono group-hover:text-indigo-500 transition-colors">{task.id}</span>
            </div>

            <h4 className="text-slate-800 dark:text-slate-100 font-bold mb-3 line-clamp-2 leading-tight">{task.title}</h4>

            <div className="flex items-center justify-between text-xs">
                <span className={clsx("flex items-center gap-1 font-medium", isOverdue ? "text-red-500" : "text-slate-500 dark:text-slate-400")}>
                    <Clock size={12} className={isOverdue ? "text-red-500" : "text-indigo-400"} />
                    {validDate ? deadlineDate.toLocaleDateString('vi-VN') : 'N/A'}
                </span>
                <span className="bg-slate-100 dark:bg-white/10 px-2 py-1 rounded text-[10px] font-medium text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-white/5">
                    {task.department || 'General'}
                </span>
            </div>
        </motion.div>
    );
};

const TimelineNode: React.FC<{ event: TimelineEvent; index: number; isLast: boolean }> = ({ event, index, isLast }) => {
    const { t } = useLanguage();
    return (
        <div className="flex gap-6 relative group">
            {/* Connector Line */}
            {!isLast && (
                <div className="absolute left-[20px] top-10 bottom-[-24px] w-0.5 bg-gradient-to-b from-indigo-500 to-slate-200 dark:to-slate-800" />
            )}

            {/* Status Icon Orb */}
            <div className={clsx(
                "w-11 h-11 rounded-full flex items-center justify-center shrink-0 border-2 z-10 transition-transform duration-300 group-hover:scale-110",
                event.status === 'completed'
                    ? "bg-emerald-500 text-white border-emerald-200 dark:border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                    : event.status === 'rework'
                        ? "bg-red-500 text-white border-red-200 dark:border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                        : "bg-white dark:bg-slate-900 text-indigo-500 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            )}>
                {event.status === 'completed' ? <CheckCircle2 size={20} /> :
                    event.status === 'rework' ? <AlertOctagon size={20} /> :
                        <span className="font-mono font-black text-sm">{index + 1}</span>}
            </div>

            {/* Content Card */}
            <div className="flex-1 pb-10">
                <div className={clsx(
                    "relative rounded-2xl p-6 border transition-all duration-300 group-hover:-translate-y-1 shadow-sm",
                    event.status === 'rework'
                        ? "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-500/30"
                        : "bg-white/50 dark:bg-white/5 border-white/40 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/10 hover:shadow-lg hover:shadow-indigo-500/10"
                )}>
                    {/* Glass Shine */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/40 to-transparent pointer-events-none opacity-50" />

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className={clsx("font-bold text-lg", event.status === 'rework' ? "text-red-700 dark:text-red-400" : "text-slate-800 dark:text-white")}>
                                    {event.department}
                                </h4>
                                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                                    <Clock size={12} className="mr-1.5 text-indigo-400" /> {event.timestamp}
                                </div>
                            </div>
                            {event.status === 'rework' && (
                                <div className="bg-red-100 dark:bg-red-500/20 px-2 py-1 rounded-lg border border-red-200 dark:border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-center shadow-sm font-bold">
                                    <AlertTriangle size={12} className="mr-1" /> ISSUE
                                </div>
                            )}
                        </div>

                        {event.status === 'rework' && (
                            <div className="mt-4 mb-4 bg-red-50 dark:bg-red-950/30 p-4 rounded-xl border border-red-100 dark:border-red-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-red-600 dark:text-red-400 font-bold text-sm tracking-wide">{t.workflow.reworkReason}:</span>
                                    <span className="text-slate-700 dark:text-slate-200 text-sm">{event.reworkReason}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-red-600 dark:text-red-400 font-bold text-sm tracking-wide">{t.workflow.reworkOrigin}:</span>
                                    <span className="text-xs font-bold uppercase tracking-wider bg-white dark:bg-white/10 px-2 py-0.5 rounded border border-red-100 dark:border-white/5 shadow-sm text-slate-600 dark:text-slate-300">
                                        {event.reworkOrigin}
                                    </span>
                                </div>
                            </div>
                        )}

                        {event.note && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 bg-white/40 dark:bg-white/5 p-3 rounded-xl italic border border-slate-100 dark:border-white/5 leading-relaxed">
                                "{event.note}"
                            </p>
                        )}

                        {event.images && event.images.length > 0 && (
                            <div className="flex gap-3 mt-4 overflow-x-auto pb-2 custom-scrollbar">
                                {event.images.map((img, i) => (
                                    <div key={i} className="group/img relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white dark:border-white/10 cursor-pointer shadow-md shrink-0 transition-transform hover:scale-105">
                                        <img src={img} alt="Evidence" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-indigo-900/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity backdrop-blur-[2px]">
                                            <Camera size={16} className="text-white drop-shadow-md" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface UpdateModalProps {
    order: OrderLog;
    onClose: () => void;
    onSave: (updatedOrder: OrderLog) => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({ order, onClose, onSave }) => {
    const { t } = useLanguage();
    const [status, setStatus] = useState<'processing' | 'completed' | 'rework'>(order.status);
    const [progress, setProgress] = useState(order.progress || 0);
    const [note, setNote] = useState('');
    const [reworkReason, setReworkReason] = useState('');

    const handleSave = () => {
        const newTimelineEvent: TimelineEvent = {
            id: Date.now().toString(),
            department: 'Update',
            timestamp: new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
            status: status === 'processing' ? 'in-progress' : status,
            note: note,
            reworkReason: status === 'rework' ? reworkReason : undefined
        };
        const updatedOrder: OrderLog = {
            ...order,
            status: status,
            progress: progress,
            timeline: [newTimelineEvent, ...(order.timeline || [])]
        };
        onSave(updatedOrder);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-[#1e293b] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20} /></button>
                <h3 className="text-xl font-bold text-white mb-6">{t.workflow.modal.title}: {order.id}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">{t.workflow.modal.newStatus}</label>
                        <div className="flex gap-2">
                            {(['processing', 'rework', 'completed'] as const).map((s) => (
                                <button key={s} onClick={() => setStatus(s)} className={clsx("flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors capitalize", status === s ? s === 'processing' ? "bg-blue-500/20 text-blue-300 border-blue-500/50" : s === 'rework' ? "bg-red-500/20 text-red-300 border-red-500/50" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10")}>
                                    {s === 'processing' ? t.common.processing : s === 'rework' ? t.common.rework : t.common.completed}
                                </button>
                            ))}
                        </div>
                    </div>
                    {status === 'rework' && (
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">{t.workflow.modal.issueReason}</label>
                            <input type="text" value={reworkReason} onChange={(e) => setReworkReason(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-white text-sm" placeholder={t.workflow.modal.issuePlaceholder} />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">{t.workflow.modal.progress}: {progress}%</label>
                        <input type="range" min="0" max="100" value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">{t.workflow.modal.note}</label>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-white text-sm h-24 resize-none" placeholder={t.workflow.modal.notePlaceholder} />
                    </div>
                    <button onClick={handleSave} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 mt-2 transition-colors">
                        <Save size={18} /> {t.workflow.modal.save}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Workflow: React.FC = () => {
    const { logs, updateLog, tasks, updateTask } = useData();
    const { t } = useLanguage();

    // View Mode (Default to 'tasks' to serve user request)
    const [viewMode, setViewMode] = useState<'orders' | 'tasks'>('tasks');

    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');

    const selectedOrder = logs.find(o => o.id === selectedOrderId);
    const relatedTasks = selectedOrder ? tasks.filter(t => t.orderId === selectedOrderId) : [];

    const selectedTask = tasks.find(t => t.id === selectedTaskId);

    const filteredLogs = logs.filter(order =>
        (order.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.customer || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeTasks = tasks.filter(task =>
    ((task.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.id || '').toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Derived State for Linked Order
    const linkedOrder = viewMode === 'tasks' && selectedTask?.orderId
        ? logs.find(o => o.id === selectedTask.orderId)
        : null;

    // Auto-select first item
    React.useEffect(() => {
        if (viewMode === 'tasks') {
            if (!selectedTaskId && activeTasks.length > 0) setSelectedTaskId(activeTasks[0].id);
        } else {
            if (!selectedOrderId && filteredLogs.length > 0) setSelectedOrderId(filteredLogs[0].id);
        }
    }, [viewMode, activeTasks, filteredLogs, selectedTaskId, selectedOrderId]);

    const handleCompleteTask = async () => {
        if (!selectedTask) return;

        // If already completed -> Re-open
        if (selectedTask.status === 'completed') {
            if (confirm("Kích hoạt lại nhiệm vụ này?")) {
                await updateTask({ ...selectedTask, status: 'active' });
            }
            return;
        }

        // If active -> Complete
        if (confirm("Xác nhận hoàn thành nhiệm vụ này?\nNhiệm vụ sẽ được chuyển sang trạng thái Completed.")) {
            await updateTask({ ...selectedTask, status: 'completed' });
            // Don't deselect, just update UI
        }
    };

    return (
        <div className="h-[calc(100vh-7rem)] flex flex-col gap-4 relative overflow-hidden p-4">
            {/* HERO SECTION */}
            <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-3xl p-6 text-white shadow-xl shrink-0 relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 p-24 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="absolute bottom-0 left-1/4 p-20 bg-blue-400/20 rounded-full blur-2xl pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
                        <div>
                            <span className="bg-white/20 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-md border border-white/10 mb-3 inline-block">
                                WORKFLOW MANAGEMENT
                            </span>
                            <h1 className="text-3xl font-black tracking-tight mb-2 text-white">Quản lý Quy trình</h1>
                            <p className="text-blue-100 text-sm max-w-lg opacity-90">Hệ thống hóa quy trình làm việc trực quan, theo dõi tiến độ đơn hàng và nhiệm vụ theo thời gian thực.</p>
                        </div>

                        <div className="flex gap-3 self-start">
                            <button className="bg-white text-blue-600 px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg hover:bg-blue-50 transition-colors flex items-center gap-2 uppercase tracking-wide">
                                <Plus size={16} /> Tạo Mới
                            </button>
                            <button className="bg-white/10 text-white px-5 py-2.5 rounded-xl font-bold text-xs border border-white/20 hover:bg-white/20 transition-colors flex items-center gap-2 uppercase tracking-wide backdrop-blur-sm">
                                <FileText size={16} /> Báo Cáo
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-stretch">
                        {/* Stats Cards */}
                        <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center gap-4 min-w-[160px] hover:bg-white/15 transition-colors cursor-pointer" onClick={() => setViewMode('tasks')}>
                                <div className="bg-blue-500/30 w-10 h-10 rounded-xl flex items-center justify-center text-blue-200">
                                    <Layout size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-blue-100 uppercase font-bold tracking-wider mb-0.5">Việc cần làm</div>
                                    <div className="text-2xl font-black">{activeTasks.length}</div>
                                </div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center gap-4 min-w-[160px] hover:bg-white/15 transition-colors cursor-pointer" onClick={() => setViewMode('orders')}>
                                <div className="bg-violet-500/30 w-10 h-10 rounded-xl flex items-center justify-center text-violet-200">
                                    <Box size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] text-blue-100 uppercase font-bold tracking-wider mb-0.5">Tổng đơn</div>
                                    <div className="text-2xl font-black">{logs.length}</div>
                                </div>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="flex-1 relative group">
                            <div className="absolute inset-0 bg-white/5 rounded-2xl md:ml-4 blur-sm group-focus-within:bg-white/10 transition-colors"></div>
                            <Search size={20} className="absolute left-8 top-1/2 -translate-y-1/2 text-blue-200 group-focus-within:text-white transition-colors z-10" />
                            <input
                                className="w-full h-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder:text-blue-200/50 focus:bg-white/20 outline-none transition-all backdrop-blur-md md:ml-4 relative z-10"
                                placeholder={viewMode === 'tasks' ? "Tìm kiếm công việc đang xử lý..." : "Tìm kiếm đơn hàng, khách hàng..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-6 lg:overflow-hidden overflow-y-auto relative">
                {/* Modal */}
                {isUpdateModalOpen && selectedOrder && (
                    <UpdateModal
                        order={selectedOrder}
                        onClose={() => setIsUpdateModalOpen(false)}
                        onSave={updateLog}
                    />
                )}

                {/* Left Column: List */}
                <div className="w-full lg:w-1/3 flex flex-col bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-white/5 lg:h-full min-h-[500px] shrink-0 overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="p-4 border-b border-indigo-100/50 dark:border-white/5 flex justify-between items-center bg-white/30 dark:bg-white/5">
                        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            {viewMode === 'tasks' ? <Layout size={14} /> : <Box size={14} />}
                            {viewMode === 'tasks' ? 'Danh sách công việc' : 'Danh sách đơn hàng'}
                        </h2>

                        {/* VIEW TOGGLE */}
                        <div className="flex bg-slate-100 dark:bg-slate-800/50 rounded-lg p-1 border border-slate-200 dark:border-white/10">
                            <button
                                onClick={() => setViewMode('tasks')}
                                className={clsx("px-3 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1", viewMode === 'tasks' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm" : "text-slate-500 hover:text-indigo-500")}
                            >
                                <Layout size={12} />
                            </button>
                            <button
                                onClick={() => setViewMode('orders')}
                                className={clsx("px-3 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1", viewMode === 'orders' ? "bg-white dark:bg-slate-700 text-cyan-600 dark:text-white shadow-sm" : "text-slate-500 hover:text-cyan-500")}
                            >
                                <Box size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {viewMode === 'tasks' ? (
                            activeTasks.length > 0 ? (
                                activeTasks.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        isSelected={selectedTaskId === task.id}
                                        onClick={() => setSelectedTaskId(task.id)}
                                    />
                                ))
                            ) : (
                                <div className="text-center text-slate-500 py-10 italic text-sm">Không có công việc đang xử lý.</div>
                            )
                        ) : (
                            filteredLogs.map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    isSelected={selectedOrderId === order.id}
                                    onClick={() => setSelectedOrderId(order.id)}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Right Column: Details */}
                <div className="w-full lg:w-2/3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-white/5 lg:h-full min-h-[500px] shrink-0 relative overflow-hidden flex flex-col shadow-2xl">
                    {viewMode === 'tasks' ? (
                        selectedTask ? (
                            <>
                                {/* Task Detail Header */}
                                <div className="p-6 border-b border-slate-200 dark:border-white/10 flex flex-col md:flex-row justify-between items-start gap-4 bg-slate-50/50 dark:bg-white/5 backdrop-blur-xl z-20">
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                        <div className="w-12 h-12 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30">
                                            <Layout size={24} className="text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-wide leading-tight mb-2 break-words">
                                                {selectedTask.title}
                                            </h1>
                                            <div className="flex flex-wrap items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                                                <span className="font-mono bg-white/50 dark:bg-white/10 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs">
                                                    {selectedTask.id}
                                                </span>

                                                <div className="w-px h-3 bg-slate-300 dark:bg-white/20 hidden sm:block"></div>

                                                <span className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                                                    <Clock size={14} className="text-indigo-500" />
                                                    <span>Hạn chót: {new Date(selectedTask.deadline).toLocaleDateString('vi-VN')}</span>
                                                </span>

                                                <div className="w-px h-3 bg-slate-300 dark:bg-white/20 hidden sm:block"></div>

                                                <span className={clsx(
                                                    "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap",
                                                    selectedTask.status === 'completed' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                                                        selectedTask.status === 'active' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" :
                                                            "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                                                )}>
                                                    {selectedTask.status === 'completed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                    {selectedTask.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 self-start">
                                        <button
                                            onClick={handleCompleteTask}
                                            className={clsx(
                                                "px-5 py-2.5 font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all text-xs uppercase tracking-wider",
                                                selectedTask.status === 'completed'
                                                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300 shadow-slate-900/10 border border-slate-700"
                                                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 border border-emerald-500/50"
                                            )}
                                        >
                                            {selectedTask.status === 'completed' ? (
                                                <> <RefreshCcw size={16} /> KÍCH HOẠT LẠI </>
                                            ) : (
                                                <> <CheckCircle2 size={16} /> HOÀN THÀNH </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                                    {linkedOrder && (
                                        <div className="mb-6 p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-xl flex justify-between items-center group hover:bg-indigo-950/50 transition-colors">
                                            <div>
                                                <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                                    <Box size={12} /> ĐƠN HÀNG LIÊN KẾT
                                                </div>
                                                <div className="text-white font-bold text-lg flex items-center gap-3">
                                                    {linkedOrder.customer}
                                                    <span className="font-mono text-sm font-normal text-slate-400">#{linkedOrder.id}</span>
                                                    <span className={clsx(
                                                        "text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider",
                                                        linkedOrder.status === 'rework' ? "bg-red-500/20 text-red-300 border-red-500/30" :
                                                            linkedOrder.status === 'completed' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                                                                "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                                    )}>
                                                        {linkedOrder.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setSelectedOrderId(linkedOrder.id); setIsUpdateModalOpen(true); }}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 text-xs font-bold transition-all flex items-center gap-2"
                                            >
                                                CẬP NHẬT TRẠNG THÁI <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <h3 className="text-slate-900 dark:text-white font-semibold mb-2 flex items-center gap-2"><ArrowRight size={16} /> Mô tả chi tiết</h3>
                                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl p-6 text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-8 text-sm leading-relaxed min-h-[100px]">
                                        {selectedTask.description || "Không có mô tả chi tiết."}
                                    </div>

                                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><ArrowRight size={16} /> Tài liệu đính kèm</h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {selectedTask.attachments && selectedTask.attachments.length > 0 ? (
                                            selectedTask.attachments.map((att: any, i: number) => (
                                                <a href={att.url} target="_blank" key={i} className="block p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors group">
                                                    <div className="w-full aspect-video rounded bg-black/40 mb-2 flex items-center justify-center overflow-hidden">
                                                        {(att.type?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name)) ? (
                                                            <img src={att.url} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                        ) : (
                                                            <Printer size={20} className="text-slate-500" />
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-300 truncate font-mono">{att.name}</div>
                                                </a>
                                            ))
                                        ) : (
                                            <div className="col-span-4 text-slate-500 italic text-sm border border-dashed border-white/10 rounded-lg p-4 text-center">Không có tài liệu đính kèm.</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                <Layout size={40} className="text-white/20 mb-4" />
                                <p>Chọn một công việc để xem chi tiết</p>
                            </div>
                        )
                    ) : (
                        // Order Detail View
                        selectedOrder ? (
                            <>
                                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5 backdrop-blur-xl z-20">
                                    <div>
                                        <h1 className="text-2xl font-bold text-white font-mono tracking-wide flex items-center gap-3">
                                            {selectedOrder.id}
                                            <span className={clsx("text-xs px-2 py-1 rounded-full border uppercase tracking-wider", selectedOrder.status === 'rework' ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30")}>
                                                {selectedOrder.status === 'rework' ? 'Issue' : t.common.active}
                                            </span>
                                        </h1>
                                        <div className="flex items-center gap-4 text-slate-400 text-sm mt-2">
                                            <span className="flex items-center gap-1"><MapPin size={14} /> Region: North</span>
                                            <span className="flex items-center gap-1"><Clock size={14} /> Deadline: 02/01/2026</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => alert(t.common.print)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm flex items-center gap-2 transition-all">
                                            <Printer size={16} /> {t.common.print}
                                        </button>
                                        <button onClick={() => setIsUpdateModalOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all font-medium">
                                            {t.workflow.statusUpdate} <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar border-b border-white/10">
                                    <div className="max-w-3xl mx-auto">
                                        {selectedOrder.timeline && selectedOrder.timeline.length > 0 ? (
                                            selectedOrder.timeline.map((event, index) => (
                                                <TimelineNode key={event.id} event={event} index={index} isLast={index === (selectedOrder.timeline?.length || 0) - 1} />
                                            ))
                                        ) : (
                                            <div className="h-40 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-white/10 rounded-2xl"><p>New order initiated. No timeline events yet.</p></div>
                                        )}
                                    </div>
                                </div>

                                <div className="h-1/3 min-h-[200px] bg-black/20 p-6 overflow-y-auto custom-scrollbar">
                                    <h3 className="text-white font-bold mb-4 flex items-center gap-2"><CheckSquare size={18} className="text-indigo-400" /> {t.workflow.linkedTasks}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {relatedTasks.length > 0 ? (
                                            relatedTasks.map(task => (
                                                <div key={task.id} className="bg-white/5 border border-white/5 rounded-lg p-3 flex items-start justify-between group hover:bg-white/10 transition-colors">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={clsx("w-2 h-2 rounded-full", task.priority === 'urgent' ? 'bg-red-500' : task.priority === 'high' ? 'bg-orange-500' : 'bg-blue-500')} />
                                                            <span className="text-xs text-slate-400 font-mono">{task.id}</span>
                                                        </div>
                                                        <h4 className="text-sm text-slate-200 font-medium line-clamp-1">{task.title}</h4>
                                                        <p className="text-xs text-slate-500 mt-1">{task.department} • {task.assigneeId}</p>
                                                    </div>
                                                    <div className={clsx("px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider", task.status === 'completed' ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400")}>
                                                        {task.status}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-full py-8 text-center text-slate-500 text-sm italic">No linked tasks found.</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                <Box size={40} className="text-white/20 mb-4" />
                                <p>{t.workflow.emptyState}</p>
                            </div>
                        )
                    )}
                </div>
            </div>


        </div>
    );
};

export default Workflow;

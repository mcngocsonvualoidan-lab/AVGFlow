import React, { useState } from 'react';
import {
    Search, AlertOctagon, CheckCircle2, Clock,
    MapPin, Camera, AlertTriangle, Printer, ArrowRight, X, Save, CheckSquare,
    Layout, Box
} from 'lucide-react';
import { clsx } from 'clsx';
import { useData, OrderLog, TimelineEvent } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';

const OrderCard: React.FC<{ order: OrderLog; isSelected: boolean; onClick: () => void }> = ({ order, isSelected, onClick }) => {
    const { t } = useLanguage();
    return (
        <div
            onClick={onClick}
            className={clsx(
                "p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:bg-white/5 relative overflow-hidden group mb-3",
                isSelected ? "bg-white/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10" : "bg-white/5 border-white/5"
            )}
        >
            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
            <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-indigo-300 font-semibold tracking-wider text-sm">{order.id}</span>
                {order.status === 'processing' && <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full border border-blue-500/30">{t.common.processing}</span>}
                {order.status === 'rework' && <span className="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse">{t.common.rework}</span>}
                {order.status === 'completed' && <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full border border-emerald-500/30">{t.common.completed}</span>}
            </div>
            <h4 className="text-white font-medium mb-3">{order.customer}</h4>
            <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 backdrop-blur-sm bg-black/20 px-2 py-0.5 rounded border border-white/5">
                        <Clock size={10} className="text-indigo-400" />
                        <span className="font-mono">{order.dueDate ? new Date(order.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : 'N/A'}</span>
                    </div>
                    {order.deliveryAttempts !== undefined && order.deliveryAttempts > 0 && (
                        <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-emerald-400">
                            <MapPin size={10} />
                            <span className="font-mono font-bold">{order.deliveryAttempts} Delivery</span>
                        </div>
                    )}
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={clsx("h-full rounded-full transition-all duration-500", order.status === 'rework' ? "bg-red-500" : "bg-indigo-500")}
                        style={{ width: `${order.progress || 0}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

const TaskCard: React.FC<{ task: any; isSelected: boolean; onClick: () => void }> = ({ task, isSelected, onClick }) => {
    const isOverdue = new Date(task.deadline).getTime() < new Date().getTime();

    return (
        <div
            onClick={onClick}
            className={clsx(
                "p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:bg-white/5 relative overflow-hidden group mb-3",
                isSelected ? "bg-white/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10" : "bg-white/5 border-white/5"
            )}
        >
            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}

            <div className="flex justify-between items-start mb-2">
                <span className={clsx("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", task.priority === 'urgent' ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30")}>
                    {task.priority}
                </span>
                <span className="text-xs text-slate-500 font-mono">{task.id}</span>
            </div>

            <h4 className="text-white font-medium mb-2 line-clamp-2">{task.title}</h4>

            <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1"><Clock size={12} className={isOverdue ? "text-red-400" : ""} /> {new Date(task.deadline).toLocaleDateString('vi-VN')}</span>
                <span className="bg-white/10 px-2 py-0.5 rounded text-[10px]">{task.department}</span>
            </div>
        </div>
    );
};

const TimelineNode: React.FC<{ event: TimelineEvent; index: number; isLast: boolean }> = ({ event, index, isLast }) => {
    const { t } = useLanguage();
    return (
        <div className="flex gap-4 relative">
            {!isLast && (
                <div className="absolute left-[19px] top-10 bottom-[-20px] w-0.5 bg-gradient-to-b from-indigo-500/50 to-transparent" />
            )}
            <div className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 z-10",
                event.status === 'completed' ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]" :
                    event.status === 'rework' ? "bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]" :
                        "bg-indigo-950 border-indigo-500/30 text-indigo-300"
            )}>
                {event.status === 'completed' ? <CheckCircle2 size={18} /> :
                    event.status === 'rework' ? <AlertOctagon size={18} /> :
                        <span className="font-mono font-bold text-sm">{index + 1}</span>}
            </div>
            <div className="flex-1 pb-8">
                <div className={clsx(
                    "glass-panel rounded-xl p-4 border relative overflow-hidden transition-all hover:bg-white/10",
                    event.status === 'rework' ? "border-red-500/30" : "border-white/5"
                )}>
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h4 className="font-bold text-white text-lg">{event.department}</h4>
                            <div className="flex items-center text-xs text-slate-400 mt-1">
                                <Clock size={12} className="mr-1" /> {event.timestamp}
                            </div>
                        </div>
                        {event.status === 'rework' && (
                            <div className="bg-red-500/10 px-2 py-1 rounded border border-red-500/20 text-xs text-red-400 flex items-center">
                                <AlertTriangle size={12} className="mr-1" /> ISSUE
                            </div>
                        )}
                    </div>
                    {event.status === 'rework' && (
                        <div className="mt-3 mb-3 bg-red-950/30 p-3 rounded-lg border-l-2 border-red-500">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-red-400 font-semibold text-sm">{t.workflow.reworkReason}:</span>
                                <span className="text-slate-200 text-sm">{event.reworkReason}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-red-400 font-semibold text-sm">{t.workflow.reworkOrigin}:</span>
                                <span className="text-slate-200 text-sm uppercase tracking-wide bg-red-500/10 px-1 rounded">{event.reworkOrigin}</span>
                            </div>
                        </div>
                    )}
                    {event.note && (
                        <p className="text-sm text-slate-300 mb-3 bg-white/5 p-2 rounded-lg italic border border-white/5">
                            "{event.note}"
                        </p>
                    )}
                    {event.images && event.images.length > 0 && (
                        <div className="flex gap-2 mt-2">
                            {event.images.map((img, i) => (
                                <div key={i} className="group relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 cursor-pointer">
                                    <img src={img} alt="Evidence" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera size={14} className="text-white" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeTasks = tasks.filter(task =>
        ['active'].includes(task.status) &&
        (task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.id.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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
        if (confirm("Xác nhận hoàn thành nhiệm vụ này?\nNhiệm vụ sẽ được chuyển sang trạng thái Completed.")) {
            await updateTask({ ...selectedTask, status: 'completed' } as any);
            setSelectedTaskId(null);
        }
    };

    return (
        <div className="h-[calc(100vh-7rem)] flex flex-col gap-4 relative">
            <div className="flex-1 flex gap-6 overflow-hidden relative">
                {/* Modal */}
                {isUpdateModalOpen && selectedOrder && (
                    <UpdateModal
                        order={selectedOrder}
                        onClose={() => setIsUpdateModalOpen(false)}
                        onSave={updateLog}
                    />
                )}

                {/* Left Column: List */}
                <div className="w-1/3 flex flex-col glass-panel rounded-2xl border border-white/10 h-full overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 space-y-3">
                        <div className="flex justify-between items-center mb-1">
                            <h2 className="text-lg font-semibold text-white">{t.workflow.title}</h2>

                            {/* VIEW TOGGLE */}
                            <div className="flex bg-slate-900 rounded-lg p-1 border border-white/10">
                                <button
                                    onClick={() => setViewMode('tasks')}
                                    className={clsx("px-3 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1", viewMode === 'tasks' ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white")}
                                >
                                    <Layout size={12} /> CÔNG VIỆC
                                </button>
                                <button
                                    onClick={() => setViewMode('orders')}
                                    className={clsx("px-3 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1", viewMode === 'orders' ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white")}
                                >
                                    <Box size={12} /> ĐƠN HÀNG
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder={viewMode === 'tasks' ? "Tìm kiếm công việc..." : t.workflow.searchPlaceholder}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:border-indigo-500 outline-none"
                            />
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
                <div className="w-2/3 glass-panel rounded-2xl border border-white/10 h-full relative overflow-hidden flex flex-col">
                    {viewMode === 'tasks' ? (
                        selectedTask ? (
                            <>
                                {/* Task Detail Header */}
                                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5 backdrop-blur-xl z-20">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                                            <Layout size={24} className="text-indigo-400" />
                                        </div>
                                        <div>
                                            <h1 className="text-2xl font-bold text-white tracking-wide">{selectedTask.title}</h1>
                                            <div className="flex items-center gap-4 text-slate-400 text-sm mt-1">
                                                <span className="font-mono bg-white/10 px-2 rounded text-slate-300">{selectedTask.id}</span>
                                                <span className="flex items-center gap-1"><Clock size={14} /> Deadline: {new Date(selectedTask.deadline).toLocaleDateString('vi-VN')}</span>
                                                <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-indigo-400" /> Trạng thái: Active</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleCompleteTask}
                                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
                                    >
                                        <CheckCircle2 size={18} /> HOÀN THÀNH
                                    </button>
                                </div>

                                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                                    <h3 className="text-white font-semibold mb-2 flex items-center gap-2"><ArrowRight size={16} /> Mô tả chi tiết</h3>
                                    <div className="bg-white/5 border border-white/5 rounded-xl p-6 text-slate-300 whitespace-pre-wrap mb-8 text-sm leading-relaxed min-h-[100px]">
                                        {selectedTask.description || "Không có mô tả chi tiết."}
                                    </div>

                                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><ArrowRight size={16} /> Tài liệu đính kèm</h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {selectedTask.attachments && selectedTask.attachments.length > 0 ? (
                                            selectedTask.attachments.map((att: any, i: number) => (
                                                <a href={att.url} target="_blank" key={i} className="block p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors group">
                                                    <div className="w-full aspect-video rounded bg-black/40 mb-2 flex items-center justify-center overflow-hidden">
                                                        {att.type?.includes('image') ? <img src={att.url} className="w-full h-full object-cover transition-transform group-hover:scale-110" /> : <Printer size={20} className="text-slate-500" />}
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

            <div className="h-10 glass-panel border border-white/5 rounded-xl flex items-center justify-between px-4 shrink-0 relative z-20">
                <div className="flex items-center gap-6 text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        WF ENGINE
                    </span>
                    <span className={clsx(viewMode === 'tasks' ? "text-white" : "text-slate-500")}>ACTIVE TASKS: <strong className={clsx(viewMode === 'tasks' ? "text-emerald-400" : "")}>{activeTasks.length}</strong></span>
                    <span className={clsx(viewMode === 'orders' ? "text-white" : "text-slate-500")}>ORDERS: <strong className={clsx(viewMode === 'orders' ? "text-blue-400" : "")}>{logs.length}</strong></span>
                </div>
                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                    AVG Workflow v2.5
                </div>
            </div>
        </div>
    );
};

export default Workflow;

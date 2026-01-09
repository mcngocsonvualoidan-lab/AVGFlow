import React, { useState, useEffect } from 'react';
import { useData, Meeting } from '../context/DataContext';
import { Plus, Pencil, Trash2, X, Calendar, Users, Link as LinkIcon, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const MeetingSchedule: React.FC = () => {
    const { meetings, addMeeting, updateMeeting, deleteMeeting } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
    const [formData, setFormData] = useState<Partial<Meeting>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Sort meetings by date/time (Undated items appear at the top)
    const sortedMeetings = [...meetings].sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return -1;
        if (!b.date) return 1;
        return new Date(a.date + 'T' + (a.startTime || '00:00')).getTime() - new Date(b.date + 'T' + (b.startTime || '00:00')).getTime();
    });

    const handleOpenModal = (meeting?: Meeting) => {
        if (meeting) {
            setEditingMeeting(meeting);
            setFormData(meeting);
        } else {
            setEditingMeeting(null);
            setFormData({
                scope: '',
                day: '',
                date: '',
                startTime: '',
                endTime: '',
                duration: '',
                content: '',
                pic: '',
                participants: '',
                secretary: '',
                note: '',
                link: '',
                isHighlight: false
            });
            setIsSaving(false);
        }
        setIsModalOpen(true);
    };



    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Ensure strictly no undefined values for Firestore
        const meetingToSave: Meeting = {
            id: editingMeeting ? editingMeeting.id : Date.now().toString(),
            scope: formData.scope || '',
            date: formData.date || '',
            day: formData.day || '',
            startTime: formData.startTime || '',
            endTime: formData.endTime || '',
            duration: formData.duration || '',
            content: formData.content || '',
            pic: formData.pic || '',
            participants: formData.participants || '',
            secretary: formData.secretary || '',
            note: formData.note || '',
            link: formData.link || '',
            isHighlight: !!formData.isHighlight, // Ensure boolean
        };

        setIsSaving(true);
        try {
            if (editingMeeting) {
                await updateMeeting(meetingToSave);
            } else {
                await addMeeting(meetingToSave);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save meeting:", error);
            alert("Lỗi khi lưu lịch trình. Vui lòng thử lại.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa lịch này không?')) {
            deleteMeeting(id);
        }
    };

    // Auto-calculate Day of Week if Date changes
    useEffect(() => {
        if (formData.date) {
            const date = new Date(formData.date);
            const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
            if (!isNaN(date.getTime())) {
                setFormData(prev => ({ ...prev, day: days[date.getDay()] }));
            }
        }
    }, [formData.date]);

    // Format display date
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    return (
        <div className="p-4 h-[calc(100vh-8rem)] overflow-hidden flex flex-col gap-4">
            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 flex items-center gap-3">
                        <Calendar className="text-cyan-400" size={32} />
                        Lịch Trao Đổi
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Danh sách các cuộc họp, trao đổi và sự kiện quan trọng.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 font-medium"
                >
                    <Plus size={18} />
                    Thêm mới
                </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 px-2 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-white/5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                    Đang diễn ra
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-white/5">
                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                    Sắp diễn ra (Tiếp theo)
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-white/5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
                    Đã diễn ra
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto rounded-2xl border border-white/10 glass-panel shadow-2xl relative custom-scrollbar">
                <table className="w-full text-sm text-left border-collapse table-fixed">
                    <thead className="sticky top-0 z-20 bg-[#0f172a]/95 backdrop-blur-xl shadow-sm text-slate-300 font-bold uppercase text-xs tracking-wider">
                        <tr>
                            <th className="p-3 border-b border-white/10 text-center w-12">STT</th>
                            <th className="p-3 border-b border-white/10 w-20">Phạm vi</th>
                            <th className="p-3 border-b border-white/10 text-center w-24">
                                <div className="flex flex-col gap-0.5 items-center">
                                    <span>Thời gian</span>
                                </div>
                            </th>
                            <th className="p-3 border-b border-white/10 text-center w-24">Giờ</th>
                            <th className="p-3 border-b border-white/10 w-[25%]">Nội dung</th>
                            <th className="p-3 border-b border-white/10 text-center w-16">NĐH</th>
                            <th className="p-3 border-b border-white/10 w-[20%]">Thành phần</th>
                            <th className="p-3 border-b border-white/10 text-center w-20">Thư ký</th>
                            <th className="p-3 border-b border-white/10">Ghi chú</th>
                            <th className="p-3 border-b border-white/10 text-center w-20">Thao tác</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-white/5">
                        {(() => {
                            let foundNearest = false;

                            return sortedMeetings.map((meeting, index) => {
                                // Check Status
                                const getStatus = () => {
                                    if (!meeting.date) return 'none';
                                    const now = new Date();
                                    const mDate = new Date(meeting.date);
                                    mDate.setHours(0, 0, 0, 0);
                                    const todayFn = new Date();
                                    todayFn.setHours(0, 0, 0, 0);

                                    if (mDate < todayFn) return 'past';
                                    if (mDate > todayFn) return 'upcoming';

                                    if (!meeting.startTime) return 'upcoming';

                                    const [h, m] = meeting.startTime.split(':').map(Number);
                                    const startMins = h * 60 + m;
                                    const nowMins = now.getHours() * 60 + now.getMinutes();

                                    let endMins = startMins + 60;
                                    if (meeting.endTime) {
                                        const [eh, em] = meeting.endTime.split(':').map(Number);
                                        endMins = eh * 60 + em;
                                    } else if (meeting.duration) {
                                        endMins = startMins + parseInt(meeting.duration);
                                    }

                                    if (nowMins > endMins) return 'past';
                                    if (nowMins >= startMins && nowMins <= endMins) return 'ongoing';
                                    return 'upcoming';
                                };

                                let status = getStatus();

                                // Logic for Nearest Highlight
                                if (status === 'upcoming') {
                                    if (!foundNearest) {
                                        foundNearest = true;
                                        status = 'urgent'; // Override to Urgent (Red)
                                    } else {
                                        status = 'future'; // Normal
                                    }
                                }

                                return (
                                    <tr key={meeting.id}
                                        className={clsx(
                                            "transition-all duration-500 group relative",
                                            status === 'ongoing' ? "bg-emerald-500/10 shadow-[inset_4px_0_0_#10b981]" : // Green
                                                status === 'urgent' ? "bg-red-500/10 shadow-[inset_4px_0_0_#ef4444]" : // Red (Nearest)
                                                    status === 'past' ? "bg-amber-500/5 shadow-[inset_4px_0_0_#f59e0b] opacity-60 hover:opacity-100" :
                                                        meeting.isHighlight ? "bg-indigo-500/10 hover:bg-indigo-500/20" : "hover:bg-white/5"
                                        )}
                                    >
                                        <td className="p-3 text-center text-slate-500 text-xs font-mono">{index + 1}</td>
                                        <td className="p-3 font-medium text-indigo-300">{meeting.scope}</td>
                                        <td className="p-3 text-center">
                                            {meeting.day && <div className="font-bold text-white">{meeting.day}</div>}
                                            {meeting.date && <div className="text-slate-400 text-xs">{formatDate(meeting.date)}</div>}
                                        </td>
                                        <td className="p-3 text-center">
                                            {(meeting.startTime || meeting.endTime) && (
                                                <div className="bg-slate-800/50 rounded-lg py-1 px-2 border border-white/5 inline-flex flex-col items-center">
                                                    <span className="text-emerald-400 font-bold">{meeting.startTime}</span>
                                                    <span className="text-slate-500 text-[9px]">-</span>
                                                    <span className="text-slate-400 font-medium">{meeting.endTime}</span>
                                                    {meeting.duration && <span className="text-[9px] text-slate-500 mt-0.5">({meeting.duration}')</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className={clsx("whitespace-pre-wrap leading-relaxed", meeting.isHighlight ? "font-bold text-emerald-300 uppercase" : "text-slate-200")}>
                                                {meeting.content}
                                            </div>
                                            {meeting.link && (
                                                <a href={meeting.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs mt-2 underline">
                                                    <LinkIcon size={10} /> Link VBKL
                                                </a>
                                            )}
                                        </td>
                                        <td className="p-3 text-center font-bold text-amber-500">{meeting.pic}</td>
                                        <td className="p-3 text-slate-300 text-sm whitespace-pre-wrap">{meeting.participants}</td>
                                        <td className="p-3 text-center font-medium text-pink-400">{meeting.secretary}</td>
                                        <td className="p-3 text-slate-400 text-sm italic">{meeting.note}</td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenModal(meeting)} className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors">
                                                    <Pencil size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(meeting.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        })()}
                        {sortedMeetings.length === 0 && (
                            <tr>
                                <td colSpan={10} className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                                    <Calendar size={48} className="opacity-20" />
                                    <span>Chưa có lịch trình nào.</span>
                                </td>
                            </tr>
                        )}

                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    {editingMeeting ? <Pencil size={20} className="text-blue-400" /> : <Plus size={20} className="text-indigo-400" />}
                                    {editingMeeting ? 'Chỉnh sửa Lịch trình' : 'Thêm Lịch trình mới'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleSave} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">

                                {/* Row 1: Scope + Date + Start + End */}
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Phạm vi</label>
                                        <input type="text" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={formData.scope || ''} onChange={e => setFormData({ ...formData, scope: e.target.value })}
                                            placeholder="P1..."
                                        />
                                    </div>
                                    <div className="col-span-4 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Ngày</label>
                                        <input type="date" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={formData.date || ''} onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Bắt đầu</label>
                                        <input type="time" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={formData.startTime || ''} onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Kết thúc</label>
                                        <input type="time" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={formData.endTime || ''} onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Row 2: Day (Auto) + Duration + PIC + Secretary */}
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Thứ (Tự động)</label>
                                        <input type="text" readOnly className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed"
                                            value={formData.day || ''}
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Thời lượng (phút)</label>
                                        <input type="text" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={formData.duration || ''} onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                            placeholder="Example: 70"
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">NĐH (PIC)</label>
                                        <input type="text" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={formData.pic || ''} onChange={e => setFormData({ ...formData, pic: e.target.value })}
                                            placeholder="#, DH..."
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Thư ký</label>
                                        <input type="text" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={formData.secretary || ''} onChange={e => setFormData({ ...formData, secretary: e.target.value })}
                                            placeholder="Kiến, 9..."
                                        />
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Nội dung</label>
                                    <textarea className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 min-h-[100px]"
                                        value={formData.content || ''} onChange={e => setFormData({ ...formData, content: e.target.value })}
                                        placeholder="Nhập nội dung công việc..."
                                    />
                                </div>

                                {/* Participants */}
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Thành phần tham dự</label>
                                    <textarea className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 min-h-[60px]"
                                        value={formData.participants || ''} onChange={e => setFormData({ ...formData, participants: e.target.value })}
                                        placeholder="Danh sách người tham dự..."
                                    />
                                </div>

                                {/* Note + Link */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Ghi chú</label>
                                        <textarea className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 min-h-[40px]"
                                            value={formData.note || ''} onChange={e => setFormData({ ...formData, note: e.target.value })}
                                            placeholder="Ghi chú thêm..."
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Link VBKL</label>
                                        <input type="text" className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            value={formData.link || ''} onChange={e => setFormData({ ...formData, link: e.target.value })}
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>

                                {/* Highlight Toggle */}
                                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 cursor-pointer" onClick={() => setFormData(p => ({ ...p, isHighlight: !p.isHighlight }))}>
                                    <div className={clsx("w-5 h-5 rounded border flex items-center justify-center transition-colors", formData.isHighlight ? "bg-emerald-500 border-emerald-500" : "border-slate-500")}>
                                        {formData.isHighlight && <Users size={12} className="text-white" />}
                                    </div>
                                    <span className="text-sm font-medium text-emerald-300">Đánh dấu là Lịch tập trung / Quan trọng</span>
                                </div>

                            </form>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                                    Hủy bỏ
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={clsx(
                                        "px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2",
                                        isSaving && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                                    {isSaving ? 'Đang lưu...' : (editingMeeting ? 'Lưu thay đổi' : 'Thêm mới')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default MeetingSchedule;

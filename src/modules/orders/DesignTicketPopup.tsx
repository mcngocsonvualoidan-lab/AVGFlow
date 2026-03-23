import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Paperclip, MessageCircle, Clock, PenLine, Calendar, CheckCircle2, AlertCircle, Loader2, UserCheck, Download, Tag, Box, Share2, Sparkles, Phone, Mail, MapPin, FileText, Image as ImageIcon, ZoomIn, ChevronDown, History, AArrowUp, AArrowDown } from 'lucide-react';
import { clsx } from 'clsx';
import { Timestamp } from 'firebase/firestore';
import { supabase } from '../../lib/supabase';
import type { SupabaseTicketMessage } from '../../lib/supabase';
import { uploadFileToR2 } from '../../services/r2UploadService';

// ── Types ──
interface DesignTicket {
    id: string; ticketCode: string;
    category: 'label-bag' | 'carton' | 'social'; action: 'edit' | 'new';
    brandName: string; contactName: string; contactPhone: string;
    contactEmail?: string; contactAddress?: string; description: string;
    status: 'open' | 'in-review' | 'revision' | 'approved' | 'completed' | 'cancelled';
    revisionRound: number;
    createdAt: Timestamp | string | null; updatedAt: Timestamp | string | null;
    completedAt?: Timestamp | string | null; assignedTo?: string;
    formData?: Record<string, string>; imageUrls?: string[];
}
interface ChatMessage {
    id: string; text: string; sender: string;
    senderRole: 'customer' | 'admin'; senderEmail?: string;
    imageUrl?: string; createdAt: string;
}
interface Props {
    ticket: DesignTicket; onClose: () => void;
    adminEmail: string; adminName: string;
    onTicketUpdate?: (updated: DesignTicket) => void;
}

// ── Config ──
const ADMIN_NAMES: Record<string, string> = {
    'cambridgeorg.209@gmail.com': 'Lê Trần Thiện Tâm',
    'trolitct@gmail.com': 'Đinh Hoàng Ngọc Hân',
};
const DESIGN_HANDLERS = ['Nguyễn Ngọc Sơn', 'Hà Ngọc Doanh'];

const CAT_CFG: Record<string, { label: string; icon: React.FC<any>; gradient: string }> = {
    'label-bag': { label: 'Nhãn / Túi', icon: Tag, gradient: 'from-violet-500 to-purple-600' },
    'carton': { label: 'Thùng Carton', icon: Box, gradient: 'from-amber-500 to-orange-600' },
    'social': { label: 'Social Media', icon: Share2, gradient: 'from-cyan-500 to-blue-600' },
};
const STATUS_CFG: Record<string, { label: string; icon: React.FC<any>; color: string; bg: string; border: string }> = {
    open: { label: 'Mới', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' },
    'in-review': { label: 'Đang duyệt', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
    revision: { label: 'Cần chỉnh sửa', icon: PenLine, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' },
    approved: { label: 'Đã duyệt', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
    completed: { label: 'Hoàn thành', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/20' },
    cancelled: { label: 'Đã hủy', icon: X, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20' },
};

// Status transitions — defines what statuses you can go to from current
const STATUS_TRANSITIONS: Record<string, string[]> = {
    open: ['in-review', 'cancelled'],
    'in-review': ['revision', 'approved', 'cancelled'],
    revision: ['in-review', 'cancelled'],
    approved: ['completed'],
    completed: [],
    cancelled: [],
};

// Fields that are contact info (already shown in contact section)
const CONTACT_FIELDS = new Set([
    'Tên đơn vị đặt hàng', 'Người đặt hàng', 'Số điện thoại',
    'Địa chỉ', 'Email', 'Ngày đặt hàng',
]);

// ── Helpers ──
function parseDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Timestamp) return val.toDate();
    if (typeof val === 'string' || typeof val === 'number') { const d = new Date(val); return isNaN(d.getTime()) ? null : d; }
    if (typeof val?.toDate === 'function') return val.toDate();
    return null;
}
function fmtDate(d: Date | null) {
    if (!d) return '—';
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmtTime(ts: string | null) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' • ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// ════════════════════════════════════════════════════════════════
// INFO PANEL (reusable for both mobile tab & desktop left side)
// ════════════════════════════════════════════════════════════════
interface InfoPanelProps {
    ticket: DesignTicket;
    onPreview: (url: string) => void;
    fontSize: number;
    onFontSizeChange: (delta: number) => void;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ ticket, onPreview, fontSize, onFontSizeChange }) => {
    const filteredFormData = ticket.formData
        ? Object.entries(ticket.formData).filter(([k, v]) => v && !CONTACT_FIELDS.has(k))
        : [];

    const fs = fontSize; // base font size in px
    const fsLabel = fs - 1;
    const fsSmall = Math.max(9, fs - 3);

    return (
        <div className="p-4 md:p-5 space-y-3 overflow-y-auto custom-scrollbar">
            {/* Font size controls */}
            <div className="flex items-center justify-end gap-1">
                <button onClick={() => onFontSizeChange(-1)} disabled={fontSize <= 11}
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    <AArrowDown size={13} />
                </button>
                <span className="text-[10px] font-mono font-bold text-slate-400 w-5 text-center">{fontSize}</span>
                <button onClick={() => onFontSizeChange(1)} disabled={fontSize >= 20}
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    <AArrowUp size={13} />
                </button>
            </div>

            {/* ── Contact Card ── */}
            {(ticket.contactName || ticket.contactPhone || ticket.contactEmail) && (
                <div className="rounded-2xl overflow-hidden border border-indigo-200/40 dark:border-indigo-500/15 shadow-sm">
                    <div className="px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-violet-500/5 dark:from-indigo-500/15 dark:to-violet-500/10 border-b border-indigo-200/30 dark:border-indigo-500/10">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5" style={{ fontSize: fsSmall }}>
                            <UserCheck size={12} className="text-indigo-500" /> Thông tin liên hệ
                        </p>
                    </div>
                    <div className="px-4 py-3 bg-white/60 dark:bg-slate-800/30 space-y-2">
                        {ticket.contactName && (
                            <div className="flex items-center gap-2" style={{ fontSize: fs }}>
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0">
                                    <UserCheck size={13} className="text-indigo-500" />
                                </div>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{ticket.contactName}</span>
                            </div>
                        )}
                        {ticket.contactPhone && (
                            <div className="flex items-center gap-2" style={{ fontSize: fs }}>
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0">
                                    <Phone size={13} className="text-indigo-500" />
                                </div>
                                <span className="text-slate-600 dark:text-slate-300">{ticket.contactPhone}</span>
                            </div>
                        )}
                        {ticket.contactEmail && (
                            <div className="flex items-center gap-2" style={{ fontSize: fs }}>
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0">
                                    <Mail size={13} className="text-indigo-500" />
                                </div>
                                <span className="text-slate-600 dark:text-slate-300">{ticket.contactEmail}</span>
                            </div>
                        )}
                        {ticket.contactAddress && (
                            <div className="flex items-center gap-2" style={{ fontSize: fs }}>
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0">
                                    <MapPin size={13} className="text-indigo-500" />
                                </div>
                                <span className="text-slate-600 dark:text-slate-300">{ticket.contactAddress}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Order Detail Cards ── */}
            {filteredFormData.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-violet-200/40 dark:border-violet-500/15 shadow-sm">
                    <div className="px-4 py-2 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 dark:from-violet-500/15 dark:to-fuchsia-500/10 border-b border-violet-200/30 dark:border-violet-500/10">
                        <p className="font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1.5" style={{ fontSize: fsSmall }}>
                            <FileText size={12} className="text-violet-500" /> Chi tiết đơn hàng
                        </p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/30 divide-y divide-slate-100 dark:divide-white/5">
                        {filteredFormData.map(([k, v]) => (
                            <div key={k} className="px-4 py-2.5 hover:bg-violet-50/40 dark:hover:bg-violet-500/5 transition-colors" style={{ fontSize: fs }}>
                                <p className="font-bold text-violet-600/80 dark:text-violet-400/80 mb-0.5" style={{ fontSize: fsLabel }}>{k}</p>
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{v}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Images Card ── */}
            {ticket.imageUrls && ticket.imageUrls.length > 0 && (
                <div className="rounded-2xl overflow-hidden border border-slate-200/50 dark:border-white/10 shadow-sm">
                    <div className="px-4 py-2 bg-gradient-to-r from-slate-100/80 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-800/30 border-b border-slate-200/30 dark:border-white/5">
                        <p className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5" style={{ fontSize: fsSmall }}>
                            <ImageIcon size={12} /> Hình ảnh đính kèm ({ticket.imageUrls.length})
                        </p>
                    </div>
                    <div className="p-3 bg-white/60 dark:bg-slate-800/30">
                        <div className="flex flex-wrap gap-2">
                            {ticket.imageUrls.map((url, i) => (
                                <button key={i} onClick={() => onPreview(url)} className="block w-24 h-24 rounded-xl overflow-hidden border-2 border-slate-200/50 dark:border-white/10 shadow-sm hover:shadow-xl hover:border-violet-400/50 transition-all hover:scale-105 relative group">
                                    <img src={url} alt={`Ảnh ${i+1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                                        <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ════════════════════════════════════════════════════════════════
// CHAT PANEL (reusable for both mobile tab & desktop right side)
// ════════════════════════════════════════════════════════════════
interface ChatPanelProps {
    ticketId: string; messages: ChatMessage[]; newMsg: string; sending: boolean; chatErr: string;
    setNewMsg: (v: string) => void; handleSend: () => void; handlePaste: (e: React.ClipboardEvent) => void;
    handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setChatErr: (v: string) => void; onPreview: (url: string) => void;
    endRef: React.RefObject<HTMLDivElement | null>; fileRef: React.RefObject<HTMLInputElement | null>;
    className?: string;
}
const ChatPanel: React.FC<ChatPanelProps> = ({ messages, newMsg, sending, chatErr, setNewMsg, handleSend, handlePaste, handleFile, setChatErr, onPreview, endRef, fileRef, className }) => (
    <div className={clsx("flex flex-col", className)}>
        {/* Chat header - compact LIVE indicator */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-200/50 dark:border-white/10 bg-white/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20 ml-auto">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">LIVE</span>
            </div>
        </div>

        {chatErr && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200/50">
                <AlertCircle size={12} className="text-amber-500" />
                <span className="text-[10px] text-amber-700 font-medium flex-1">{chatErr}</span>
                <button onClick={() => setChatErr('')} className="text-[9px] font-bold text-amber-600 px-1.5 py-0.5 rounded bg-amber-100">✕</button>
            </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                        <MessageCircle size={24} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">Chưa có tin nhắn</p>
                    <p className="text-[10px] text-slate-300 mt-1">Bắt đầu trao đổi với khách hàng!</p>
                </div>
            )}
            {messages.map(msg => {
                const isMe = msg.senderRole === 'admin';
                const name = isMe ? (msg.senderEmail ? (ADMIN_NAMES[msg.senderEmail] || msg.sender) : msg.sender) : msg.sender;
                return (
                    <div key={msg.id} className={clsx("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                        <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black shadow-sm",
                            isMe ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white" : "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                        )}>{isMe ? (name?.charAt(0)?.toUpperCase() || 'A') : (name?.charAt(0)?.toUpperCase() || '?')}</div>
                        <div className={clsx("max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm",
                            isMe ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-tr-md"
                                : "bg-white/80 dark:bg-slate-700/80 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 text-slate-800 dark:text-slate-200 rounded-tl-md"
                        )}>
                            <p className={clsx("text-[10px] font-bold mb-1", isMe ? "text-white/70 text-right" : "text-slate-400")}>
                                {name}
                                {isMe && msg.senderEmail && <span className="ml-1 text-[8px] opacity-50">(nội bộ)</span>}
                            </p>
                            {/* Inline image preview */}
                            {msg.imageUrl && msg.text?.startsWith('📷') && (
                                <img src={msg.imageUrl} alt="" className="rounded-xl max-w-full max-h-48 object-cover mb-2 border border-white/20 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); onPreview(msg.imageUrl!); }} />
                            )}
                            {msg.imageUrl && msg.text?.startsWith('📎') && (
                                <div onClick={() => window.open(msg.imageUrl, '_blank')} className="flex items-center gap-2 p-2.5 mb-2 rounded-xl bg-slate-900/10 dark:bg-black/20 border border-slate-200/50 cursor-pointer hover:bg-slate-900/20 transition-colors">
                                    <Paperclip size={16} className="text-violet-500 shrink-0" />
                                    <span className="text-sm font-medium truncate flex-1">{msg.text.replace('📎 ', '')}</span>
                                    <Download size={14} className="text-slate-400 shrink-0" />
                                </div>
                            )}
                            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.text.startsWith('📷 ') || msg.text.startsWith('📎 ') ? '' : msg.text}</p>
                            <p className={clsx("text-[9px] mt-1.5", isMe ? "text-white/50 text-right" : "text-slate-300 dark:text-slate-600")}>{fmtTime(msg.createdAt)}</p>
                        </div>
                    </div>
                );
            })}
            <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200/50 dark:border-white/10 p-3 bg-white/50 dark:bg-slate-800/50">
            <div className="flex gap-2 items-end">
                <button type="button" onClick={() => fileRef.current?.click()} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all shrink-0">
                    <Paperclip size={16} />
                </button>
                <input ref={fileRef} type="file" onChange={handleFile} className="hidden" />
                <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} onPaste={handlePaste}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                    placeholder="Nhập tin nhắn... (Ctrl+V paste ảnh)" rows={1}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-700/80 border border-slate-200/50 dark:border-white/10 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
                />
                <button type="button" onClick={handleSend} disabled={!newMsg.trim() || sending}
                    className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/30 hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0">
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
            </div>
        </div>
    </div>
);

// ════════════════════════════════════════════════════════════════
// MAIN POPUP COMPONENT
// ════════════════════════════════════════════════════════════════
const DesignTicketPopup: React.FC<Props> = ({ ticket: initialTicket, onClose, adminEmail, adminName, onTicketUpdate }) => {
    const [mobileTab, setMobileTab] = useState<'info' | 'chat' | 'timeline'>('info');
    const [rightTab, setRightTab] = useState<'chat' | 'timeline'>('chat');
    const [infoFontSize, setInfoFontSize] = useState(12);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMsg, setNewMsg] = useState('');
    const [sending, setSending] = useState(false);
    const [chatErr, setChatErr] = useState('');
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [ticket, setTicket] = useState<DesignTicket>(initialTicket);
    const endRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const cat = CAT_CFG[ticket.category] || CAT_CFG['label-bag'];
    const st = STATUS_CFG[ticket.status] || STATUS_CFG.open;
    const StIcon = st.icon; const CatIcon = cat.icon;
    const created = parseDate(ticket.createdAt);
    const updated = parseDate(ticket.updatedAt);
    const completed = parseDate(ticket.completedAt);
    const nextStatuses = STATUS_TRANSITIONS[ticket.status] || [];
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const [showAssignMenu, setShowAssignMenu] = useState(false);

    // ── Status change handler ──
    const handleStatusChange = useCallback(async (newStatus: string) => {
        setUpdating(true);
        try {
            const updateData: any = {
                status: newStatus,
                updated_at: new Date().toISOString(),
            };
            if (newStatus === 'completed') {
                updateData.completed_at = new Date().toISOString();
            }
            if (newStatus === 'revision') {
                updateData.revision_round = (ticket.revisionRound || 0) + 1;
            }

            const { error } = await supabase
                .from('design_tickets')
                .update(updateData)
                .eq('id', ticket.id);

            if (error) throw error;

            const updatedTicket = {
                ...ticket,
                status: newStatus as DesignTicket['status'],
                updatedAt: updateData.updated_at,
                ...(newStatus === 'completed' ? { completedAt: updateData.completed_at } : {}),
                ...(newStatus === 'revision' ? { revisionRound: updateData.revision_round } : {}),
            };
            setTicket(updatedTicket);
            onTicketUpdate?.(updatedTicket);

            // Send system message
            const stLabel = STATUS_CFG[newStatus]?.label || newStatus;
            await supabase.from('ticket_messages').insert({
                ticket_id: ticket.id,
                text: `🔄 Trạng thái đã chuyển sang: ${stLabel}`,
                sender: 'Admin',
                sender_role: 'admin',
                sender_email: adminEmail,
            });
        } catch (err: any) {
            setChatErr(`Lỗi cập nhật: ${err.message}`);
        } finally {
            setUpdating(false);
        }
    }, [ticket, adminEmail, onTicketUpdate]);

    // ── Assign handler ──
    const handleAssign = useCallback(async (handler: string) => {
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('design_tickets')
                .update({ assigned_to: handler, updated_at: new Date().toISOString() })
                .eq('id', ticket.id);

            if (error) throw error;

            const updatedTicket = { ...ticket, assignedTo: handler, updatedAt: new Date().toISOString() };
            setTicket(updatedTicket);
            onTicketUpdate?.(updatedTicket);

            // No chat message for assignment - info is shown in header
        } catch (err: any) {
            setChatErr(`Lỗi giao việc: ${err.message}`);
        } finally {
            setUpdating(false);
        }
    }, [ticket, adminEmail, onTicketUpdate]);

    // ── Load messages + realtime ──
    useEffect(() => {
        const load = async () => {
            const { data } = await supabase.from('ticket_messages').select('*')
                .eq('ticket_id', ticket.id).order('created_at', { ascending: true });
            if (data) setMessages(data.map((m: SupabaseTicketMessage) => ({
                id: m.id, text: m.text, sender: m.sender, senderRole: m.sender_role,
                senderEmail: m.sender_email || undefined, imageUrl: m.image_url || undefined, createdAt: m.created_at,
            })));
        };
        load();
        const ch = supabase.channel(`popup-msg-${ticket.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticket.id}` }, (p) => {
                const m = p.new as SupabaseTicketMessage;
                const realMsg = { id: m.id, text: m.text, sender: m.sender, senderRole: m.sender_role,
                    senderEmail: m.sender_email || undefined, imageUrl: m.image_url || undefined, createdAt: m.created_at };
                setMessages(prev => {
                    if (prev.some(x => x.id === m.id)) return prev;
                    // Replace matching optimistic message
                    const localIdx = prev.findIndex(x => x.id.startsWith('local_') && x.text === m.text && x.senderRole === m.sender_role);
                    if (localIdx !== -1) {
                        const updated = [...prev];
                        updated[localIdx] = realMsg;
                        return updated;
                    }
                    return [...prev, realMsg];
                });
            }).subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [ticket.id]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ── Send ──
    const handleSend = useCallback(async () => {
        if (!newMsg.trim() || sending) return;
        setSending(true); setChatErr('');
        const txt = newMsg.trim();
        const opt: ChatMessage = { id: `local_${Date.now()}`, text: txt, sender: adminName, senderRole: 'admin', senderEmail: adminEmail, createdAt: new Date().toISOString() };
        setMessages(p => [...p, opt]); setNewMsg('');
        try {
            const { error } = await supabase.from('ticket_messages').insert({
                ticket_id: ticket.id, text: txt, sender: 'Admin', sender_role: 'admin', sender_email: adminEmail,
            });
            if (error) throw error;
        } catch { setChatErr('Gửi thất bại'); setMessages(p => p.filter(m => m.id !== opt.id)); setNewMsg(txt); }
        finally { setSending(false); }
    }, [newMsg, sending, ticket.id, adminName, adminEmail]);

    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items; if (!items) return;
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile(); if (!blob) return;
                setSending(true);
                try {
                    const file = new File([blob], `paste_${Date.now()}.png`, { type: blob.type });
                    const result = await uploadFileToR2(file, 'design_ticket_chat');
                    await supabase.from('ticket_messages').insert({ ticket_id: ticket.id, text: '📷 Hình ảnh', sender: 'Admin', sender_role: 'admin', sender_email: adminEmail, image_url: result.url });
                } catch (err: any) { setChatErr(`Gửi ảnh thất bại: ${err.message}`); }
                finally { setSending(false); } break;
            }
        }
    }, [ticket.id, adminEmail]);

    const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setSending(true);
        try {
            const result = await uploadFileToR2(file, 'design_ticket_chat');
            const label = file.type.startsWith('image/') ? `📷 ${file.name}` : `📎 ${file.name}`;
            await supabase.from('ticket_messages').insert({ ticket_id: ticket.id, text: label, sender: 'Admin', sender_role: 'admin', sender_email: adminEmail, image_url: result.url });
        } catch (err: any) { setChatErr(`Gửi file thất bại: ${err.message}`); }
        finally { setSending(false); if (fileRef.current) fileRef.current.value = ''; }
    }, [ticket.id, adminEmail]);

    // ESC close
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (previewImg) setPreviewImg(null); else onClose(); } };
        window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    }, [onClose, previewImg]);

    const chatProps: ChatPanelProps = { ticketId: ticket.id, messages, newMsg, sending, chatErr, setNewMsg, handleSend, handlePaste, handleFile, setChatErr, onPreview: setPreviewImg, endRef, fileRef };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-black/30 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>

                {/* ─── Header (all info consolidated here) ─── */}
                <div className={clsx("relative px-5 md:px-6 py-3 md:py-4 bg-gradient-to-r text-white shrink-0", cat.gradient)} style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                    <button onClick={onClose} className="absolute top-3 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all z-10">
                        <X size={16} />
                    </button>

                    {/* Row 1: Brand + Interactive chips */}
                    <div className="flex flex-col md:flex-row md:items-center md:gap-5">
                        {/* Brand info */}
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 flex items-center justify-center shrink-0">
                                <CatIcon size={18} className="text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-white/60 text-[10px] font-mono font-semibold tracking-wider">{ticket.ticketCode}</p>
                                <h2 className="text-sm md:text-base font-extrabold truncate leading-tight">{ticket.brandName || 'Chưa có tên'}</h2>
                            </div>
                        </div>

                        {/* Interactive chips row — Glassmorphism */}
                        <div className="flex-1 min-w-0 mt-2.5 md:mt-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Status chip (clickable → dropdown) */}
                                <div className="relative">
                                    <button
                                        onClick={() => { if (nextStatuses.length > 0) { setShowStatusMenu(!showStatusMenu); setShowAssignMenu(false); } }}
                                        disabled={updating || nextStatuses.length === 0}
                                        className={clsx(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all",
                                            "bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-lg shadow-black/5",
                                            "hover:bg-white/30 hover:border-white/40 hover:shadow-xl",
                                            nextStatuses.length > 0 && "cursor-pointer",
                                            nextStatuses.length === 0 && "cursor-default",
                                            updating && "opacity-60"
                                        )}
                                    >
                                        {updating ? <Loader2 size={12} className="animate-spin" /> : <StIcon size={12} />}
                                        {st.label}
                                        {nextStatuses.length > 0 && <ChevronDown size={10} className="opacity-70" />}
                                    </button>
                                    {showStatusMenu && (
                                        <div className="absolute top-full left-0 mt-1.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/20 border border-white/20 dark:border-white/10 py-1 z-50 min-w-[180px]" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                                            {nextStatuses.map(ns => {
                                                const nsCfg = STATUS_CFG[ns];
                                                if (!nsCfg) return null;
                                                const NsIcon = nsCfg.icon;
                                                return (
                                                    <button
                                                        key={ns}
                                                        onClick={() => { handleStatusChange(ns); setShowStatusMenu(false); }}
                                                        className={clsx("w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors", nsCfg.color)}
                                                    >
                                                        <NsIcon size={13} /> {nsCfg.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Assign chip (clickable → dropdown) */}
                                <div className="relative">
                                    <button
                                        onClick={() => { setShowAssignMenu(!showAssignMenu); setShowStatusMenu(false); }}
                                        disabled={updating}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-lg shadow-black/5 hover:bg-white/30 hover:border-white/40 hover:shadow-xl transition-all disabled:opacity-60 cursor-pointer"
                                    >
                                        <UserCheck size={12} />
                                        {ticket.assignedTo || 'Chưa giao'}
                                        <ChevronDown size={10} className="opacity-70" />
                                    </button>
                                    {showAssignMenu && (
                                        <div className="absolute top-full left-0 mt-1.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/20 border border-white/20 dark:border-white/10 py-1 z-50 min-w-[180px]" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                                            {DESIGN_HANDLERS.map(h => (
                                                <button
                                                    key={h}
                                                    onClick={() => { handleAssign(h); setShowAssignMenu(false); }}
                                                    className={clsx("w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
                                                        ticket.assignedTo === h ? 'text-violet-600 font-bold' : 'text-slate-600 dark:text-slate-400'
                                                    )}
                                                >
                                                    <UserCheck size={12} className={ticket.assignedTo === h ? 'text-violet-500' : ''} />
                                                    {h}
                                                    {ticket.assignedTo === h && <span className="ml-auto text-[9px] text-violet-500 font-bold">✓</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Action chip */}
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-md border border-white/20 text-white/90">
                                    <Sparkles size={10} /> {ticket.action === 'new' ? 'Tạo mới' : 'Chỉnh sửa'}
                                </span>

                                {/* Revision chip */}
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-md border border-white/20 text-white/90">
                                    <PenLine size={10} /> Sửa: {ticket.revisionRound}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Dates */}
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[10px] text-white/60">
                        <span className="flex items-center gap-1 bg-white/10 backdrop-blur-sm border border-white/10 px-2.5 py-0.5 rounded-full">
                            <Calendar size={9} /> Tạo: {fmtDate(created)}
                        </span>
                        {updated && (
                            <span className="flex items-center gap-1 bg-white/10 backdrop-blur-sm border border-white/10 px-2.5 py-0.5 rounded-full">
                                <Clock size={9} /> Cập nhật: {fmtDate(updated)}
                            </span>
                        )}
                        {completed && (
                            <span className="flex items-center gap-1 bg-emerald-400/15 backdrop-blur-sm border border-emerald-300/20 text-emerald-100 px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 size={9} /> Hoàn thành: {fmtDate(completed)}
                            </span>
                        )}
                    </div>
                </div>

                {/* ─── Mobile: Tab switcher ─── */}
                <div className="flex md:hidden border-b border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                    <button onClick={() => setMobileTab('info')} className={clsx("flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all",
                        mobileTab === 'info' ? 'border-violet-500 text-violet-600' : 'border-transparent text-slate-400')}>
                        <FileText size={13} /> Chi tiết
                    </button>
                    <button onClick={() => setMobileTab('chat')} className={clsx("flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all relative",
                        mobileTab === 'chat' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400')}>
                        <MessageCircle size={13} /> Chat
                        {messages.length > 0 && <span className="min-w-[16px] h-[16px] rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center px-1">{messages.length}</span>}
                    </button>
                    <button onClick={() => setMobileTab('timeline')} className={clsx("flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all",
                        mobileTab === 'timeline' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400')}>
                        <History size={13} /> Lịch sử
                    </button>
                </div>

                {/* ─── Content ─── */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                    <div className={clsx(
                        "md:w-[45%] md:border-r border-slate-200/50 dark:border-white/10 overflow-y-auto",
                        "md:block", mobileTab === 'info' ? 'block' : 'hidden'
                    )}>
                        <InfoPanel ticket={ticket} onPreview={setPreviewImg} fontSize={infoFontSize} onFontSizeChange={(d) => setInfoFontSize(prev => Math.max(11, Math.min(20, prev + d)))} />
                    </div>
                    <div className={clsx(
                        "md:w-[55%] md:flex md:flex-col",
                        (mobileTab === 'chat' || mobileTab === 'timeline') ? 'flex flex-col' : 'hidden'
                    )} style={{ minHeight: 0 }}>
                        {/* Desktop: tab switcher for right panel */}
                        <div className="hidden md:flex border-b border-slate-200/50 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 shrink-0">
                            <button onClick={() => setRightTab('chat')} className={clsx("flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all",
                                rightTab === 'chat' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600')}>
                                <MessageCircle size={14} /> Trao đổi
                                {messages.length > 0 && <span className="min-w-[16px] h-[16px] rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center px-1">{messages.length}</span>}
                            </button>
                            <button onClick={() => setRightTab('timeline')} className={clsx("flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all",
                                rightTab === 'timeline' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600')}>
                                <History size={14} /> Timeline
                            </button>
                        </div>

                        {/* Chat or Timeline content */}
                        {((mobileTab === 'chat') || (mobileTab !== 'timeline' && rightTab === 'chat')) && (
                            <ChatPanel {...chatProps} className="flex-1 min-h-0" />
                        )}
                        {((mobileTab === 'timeline') || (mobileTab !== 'chat' && rightTab === 'timeline')) && (
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {(() => {
                                    // Only system events — no chat messages
                                    const systemEvents = messages.filter(m => m.text.startsWith('🔄') || m.text.startsWith('👤') || m.text.startsWith('🎉') || m.text.startsWith('📋'));
                                    if (systemEvents.length === 0) return (
                                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                            <div className="w-16 h-16 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/30 dark:border-white/10 flex items-center justify-center mb-4 shadow-lg">
                                                <History size={28} className="text-slate-300 dark:text-slate-500" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-400">Chưa có sự kiện nào</p>
                                            <p className="text-[10px] text-slate-300 mt-1">Các thay đổi trạng thái sẽ hiển thị tại đây</p>
                                        </div>
                                    );
                                    return (
                                        <div className="relative">
                                            {/* Glass timeline line */}
                                            <div className="absolute left-[18px] top-4 bottom-4 w-[2px] rounded-full" style={{ background: 'linear-gradient(180deg, rgba(139,92,213,0.4) 0%, rgba(99,102,241,0.3) 50%, rgba(148,163,184,0.15) 100%)' }} />

                                            <div className="space-y-2">
                                                {[...systemEvents].reverse().map((msg) => {
                                                    const isStatus = msg.text.startsWith('🔄');
                                                    const isAssign = msg.text.startsWith('👤');
                                                    const icon = isStatus ? <Clock size={11} /> : isAssign ? <UserCheck size={11} /> : <CheckCircle2 size={11} />;
                                                    const accentFrom = isStatus ? 'from-amber-400 to-orange-500' : isAssign ? 'from-sky-400 to-blue-500' : 'from-emerald-400 to-green-500';
                                                    const cardBorder = isStatus ? 'border-amber-200/40 dark:border-amber-500/15' : isAssign ? 'border-sky-200/40 dark:border-sky-500/15' : 'border-emerald-200/40 dark:border-emerald-500/15';
                                                    const cardGlow = isStatus ? 'hover:shadow-amber-200/20 dark:hover:shadow-amber-500/10' : isAssign ? 'hover:shadow-sky-200/20 dark:hover:shadow-sky-500/10' : 'hover:shadow-emerald-200/20 dark:hover:shadow-emerald-500/10';

                                                    return (
                                                        <div key={msg.id} className="relative flex items-start gap-3 pl-0.5">
                                                            {/* Dot */}
                                                            <div className={clsx("w-[38px] h-[38px] rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 text-white z-10 shadow-lg", accentFrom)}
                                                                style={{ backdropFilter: 'blur(8px)' }}>
                                                                {icon}
                                                            </div>
                                                            {/* Glass card */}
                                                            <div className={clsx(
                                                                "flex-1 min-w-0 rounded-xl px-3.5 py-2.5 border transition-all",
                                                                "bg-white/50 dark:bg-white/[0.04] backdrop-blur-xl",
                                                                "shadow-sm hover:shadow-md",
                                                                cardBorder, cardGlow
                                                            )}>
                                                                <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 leading-relaxed" style={{ wordBreak: 'break-word' }}>
                                                                    {msg.text}
                                                                </p>
                                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
                                                                    {fmtTime(msg.createdAt)} • {msg.sender}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Image Lightbox ─── */}
            {previewImg && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setPreviewImg(null)}>
                    <button onClick={() => setPreviewImg(null)} className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all z-10">
                        <X size={20} />
                    </button>
                    <img src={previewImg} alt="Preview" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
};

export default DesignTicketPopup;

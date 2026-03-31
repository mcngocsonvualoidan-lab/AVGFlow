import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Clock, PenLine, Calendar, CheckCircle2, AlertCircle, Loader2, UserCheck, Tag, Box, Share2, Sparkles, Phone, Mail, MapPin, FileText, Image as ImageIcon, ZoomIn, ChevronDown, History, AArrowUp, AArrowDown, MessageCircle, Send, Paperclip } from 'lucide-react';
import { clsx } from 'clsx';
import { Timestamp, doc, updateDoc, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from '@/lib/firestore';
import { db } from '../../lib/firebase';
import { updateTicket as updateTicketOnSheet, isConfigured as isSheetConfigured } from '../../services/designTicketSheetService';
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
    imageUrl?: string; createdAt: any;
}
interface Props {
    ticket: DesignTicket; onClose: () => void;
    adminEmail: string; adminName: string;
    onTicketUpdate?: (updated: DesignTicket) => void;
}

// ── Config ──
const DESIGN_HANDLERS = ['Nguyễn Ngọc Sơn', 'Hà Ngọc Doanh'];
const ADMIN_NAMES: Record<string, string> = {
    'cambridgeorg.209@gmail.com': 'Lê Trần Thiện Tâm',
    'trolitct@gmail.com': 'Đinh Hoàng Ngọc Hân',
};
const ADMIN_EMAILS_POPUP = ['cambridgeorg.209@gmail.com', 'trolitct@gmail.com'];

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

// Status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
    open: ['in-review', 'cancelled'],
    'in-review': ['revision', 'approved', 'cancelled'],
    revision: ['in-review', 'cancelled'],
    approved: ['completed'],
    completed: [],
    cancelled: [],
};

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
function fmtTime(ts: any) {
    if (!ts) return '';
    let d: Date;
    if (ts instanceof Timestamp) d = ts.toDate();
    else if (typeof ts?.toDate === 'function') d = ts.toDate();
    else if (typeof ts?.seconds === 'number') d = new Date(ts.seconds * 1000);
    else d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' • ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// System event emojis — messages starting with these are timeline events, NOT chat
const SYSTEM_EMOJIS = ['🔄', '👤', '🎉', '📋', '🔍', '✅', '❌'];
function isSystemEvent(text: string): boolean {
    return SYSTEM_EMOJIS.some(e => text.startsWith(e));
}

// ════════════════════════════════════════════════════════════════
// INFO PANEL
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

    const fs = fontSize;
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

            {/* Contact Card */}
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
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0"><UserCheck size={13} className="text-indigo-500" /></div>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{ticket.contactName}</span>
                            </div>
                        )}
                        {ticket.contactPhone && (
                            <div className="flex items-center gap-2" style={{ fontSize: fs }}>
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0"><Phone size={13} className="text-indigo-500" /></div>
                                <span className="text-slate-600 dark:text-slate-300">{ticket.contactPhone}</span>
                            </div>
                        )}
                        {ticket.contactEmail && (
                            <div className="flex items-center gap-2" style={{ fontSize: fs }}>
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0"><Mail size={13} className="text-indigo-500" /></div>
                                <span className="text-slate-600 dark:text-slate-300">{ticket.contactEmail}</span>
                            </div>
                        )}
                        {ticket.contactAddress && (
                            <div className="flex items-center gap-2" style={{ fontSize: fs }}>
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0"><MapPin size={13} className="text-indigo-500" /></div>
                                <span className="text-slate-600 dark:text-slate-300">{ticket.contactAddress}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Order Detail Cards */}
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
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{String(v)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Images Card */}
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
// INLINE CHAT PANEL (embedded, not floating)
// ════════════════════════════════════════════════════════════════
interface InlineChatPanelProps {
    ticketId: string;
    ticketCode: string;
    customerName: string;
    isAdmin: boolean;
    adminEmail: string;
    messages: ChatMessage[];
}

const InlineChatPanel: React.FC<InlineChatPanelProps> = ({ ticketId, ticketCode, customerName, isAdmin, adminEmail, messages }) => {
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [chatError, setChatError] = useState('');
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const senderRole = isAdmin ? 'admin' : 'customer';
    const displayName = isAdmin ? 'Admin' : customerName;

    // Filter to chat messages only (exclude system events)
    const chatMessages = messages.filter(m => !isSystemEvent(m.text));

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages.length]);

    const handleSend = useCallback(async () => {
        if (!newMessage.trim() || sending) return;
        const msgText = newMessage.trim();
        setNewMessage('');
        setChatError('');
        setSending(true);
        setTimeout(() => setSending(false), 300);

        const messagesRef = collection(db, 'ticket_chats', ticketId, 'messages');
        addDoc(messagesRef, {
            text: msgText,
            sender: isAdmin ? 'Admin' : displayName,
            senderRole,
            senderEmail: isAdmin ? adminEmail : null,
            ticketCode,
            createdAt: serverTimestamp(),
        }).catch((error) => {
            console.error('[Chat] Send failed:', error);
            setChatError('⚠️ Gửi tin nhắn thất bại.');
            setNewMessage(msgText);
        });
    }, [newMessage, ticketId, ticketCode, sending, displayName, senderRole, isAdmin, adminEmail]);

    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (!blob) return;
                setSending(true);
                try {
                    const file = new File([blob], `paste_${Date.now()}.png`, { type: blob.type });
                    const result = await uploadFileToR2(file, 'design_ticket_chat');
                    const messagesRef = collection(db, 'ticket_chats', ticketId, 'messages');
                    await addDoc(messagesRef, {
                        text: '📷 Hình ảnh',
                        sender: isAdmin ? 'Admin' : displayName,
                        senderRole,
                        senderEmail: isAdmin ? adminEmail : null,
                        ticketCode,
                        imageUrl: result.url,
                        createdAt: serverTimestamp(),
                    });
                } catch (err: any) {
                    console.error('[Chat] Paste image failed:', err);
                    setChatError(`⚠️ Gửi hình ảnh thất bại: ${err.message || 'Lỗi'}`);
                } finally { setSending(false); }
                break;
            }
        }
    }, [ticketId, ticketCode, displayName, senderRole, isAdmin, adminEmail]);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSending(true);
        try {
            const result = await uploadFileToR2(file, 'design_ticket_chat');
            const label = file.type.startsWith('image/') ? `📷 ${file.name}` : `📎 ${file.name}`;
            const messagesRef = collection(db, 'ticket_chats', ticketId, 'messages');
            await addDoc(messagesRef, {
                text: label,
                sender: isAdmin ? 'Admin' : displayName,
                senderRole,
                senderEmail: isAdmin ? adminEmail : null,
                ticketCode,
                imageUrl: result.url,
                createdAt: serverTimestamp(),
            });
        } catch (err: any) {
            console.error('[Chat] File upload failed:', err);
            setChatError(`⚠️ Gửi file thất bại: ${err.message || 'Lỗi'}`);
        } finally { setSending(false); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [ticketId, ticketCode, displayName, senderRole, isAdmin, adminEmail]);

    return (
        <div className="flex flex-col h-full">
            {/* Chat header */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-200/50 dark:border-white/10 bg-gradient-to-r from-indigo-500/5 to-violet-500/5 dark:from-indigo-500/10 dark:to-violet-500/10 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
                    <MessageCircle size={13} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-slate-800 dark:text-white truncate">Trao đổi Đơn hàng</p>
                    <p className="text-[9px] text-slate-400 font-mono truncate">{ticketCode}</p>
                </div>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{chatMessages.length}</span>
            </div>

            {/* Chat error */}
            {chatError && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200/50 dark:border-amber-500/20 shrink-0">
                    <AlertCircle size={11} className="text-amber-500 shrink-0" />
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex-1 truncate">{chatError}</span>
                    <button onClick={() => setChatError('')} className="text-[9px] font-bold text-amber-600 px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 shrink-0">X</button>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar min-h-0">
                {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-6">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2.5">
                            <MessageCircle size={20} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-400">Chưa có tin nhắn nào</p>
                        <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-0.5">Hãy gửi tin nhắn đầu tiên!</p>
                    </div>
                )}
                {chatMessages.map((msg) => {
                    const isCustomer = msg.senderRole === 'customer';
                    const internalAdminName = msg.senderEmail ? (ADMIN_NAMES[msg.senderEmail] || msg.sender) : msg.sender;
                    const showName = isCustomer ? msg.sender : (isAdmin ? internalAdminName : 'Admin');
                    const isMe = isAdmin ? !isCustomer : isCustomer;

                    return (
                        <div key={msg.id} className={clsx("flex gap-1.5 w-full", isMe ? "flex-row-reverse" : "flex-row")}>
                            <div className={clsx(
                                "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-black shadow-sm mt-0.5",
                                isMe
                                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                                    : "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                            )}>
                                {showName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className={clsx(
                                "max-w-[82%] rounded-2xl px-3 py-2 shadow-sm break-words relative",
                                isMe
                                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-tr-sm"
                                    : "bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                            )}>
                                {!isMe && <p className="text-[9px] font-black mb-0.5 text-emerald-500 opacity-70">{showName}</p>}

                                {msg.imageUrl && (
                                    <div className="mb-1.5 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 group relative max-w-[180px]">
                                        <img src={msg.imageUrl} alt="attached" className="w-full h-auto cursor-pointer hover:scale-105 transition-transform" onClick={() => setPreviewImg(msg.imageUrl || null)} />
                                    </div>
                                )}

                                <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                <p className={clsx("text-[8px] mt-1 opacity-50", isMe ? "text-right" : "")}>{fmtTime(msg.createdAt)}</p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-xl shrink-0">
                <div className="flex gap-1.5">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all shrink-0"
                    >
                        <Paperclip size={14} />
                    </button>
                    <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
                    <div className="flex-1 relative align-center flex">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onPaste={handlePaste}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Nhập tin nhắn..."
                            rows={1}
                            className="w-full h-8 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-700/80 border border-slate-200/50 dark:border-white/10 text-[11px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg disabled:opacity-40 transition-all shrink-0"
                    >
                        {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    </button>
                </div>
            </div>

            {/* Lightbox */}
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


// ════════════════════════════════════════════════════════════════
// MAIN POPUP COMPONENT
// ════════════════════════════════════════════════════════════════
const DesignTicketPopup: React.FC<Props> = ({ ticket: initialTicket, onClose, adminEmail, adminName: _adminName, onTicketUpdate }) => {
    const [mobileTab, setMobileTab] = useState<'info' | 'chat' | 'timeline'>('info');
    const [infoFontSize, setInfoFontSize] = useState(12);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [ticket, setTicket] = useState<DesignTicket>(initialTicket);
    const endRef = useRef<HTMLDivElement>(null);

    const cat = CAT_CFG[ticket.category] || CAT_CFG['label-bag'];
    const st = STATUS_CFG[ticket.status] || STATUS_CFG.open;
    const isAdmin = ADMIN_EMAILS_POPUP.includes(adminEmail);
    const StIcon = st.icon; const CatIcon = cat.icon;
    const created = parseDate(ticket.createdAt);
    const updated = parseDate(ticket.updatedAt);
    const completed = parseDate(ticket.completedAt);
    const nextStatuses = STATUS_TRANSITIONS[ticket.status] || [];
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const [showAssignMenu, setShowAssignMenu] = useState(false);

    // Unread chat count for mobile tab badge
    const chatMessages = messages.filter(m => !isSystemEvent(m.text));

    // ── Status change handler ──
    const handleStatusChange = useCallback(async (newStatus: string) => {
        setUpdating(true);
        try {
            const now = new Date().toISOString();
            const updateData: any = {
                status: newStatus,
                updatedAt: Timestamp.now(),
            };
            if (newStatus === 'completed') updateData.completedAt = Timestamp.now();
            if (newStatus === 'revision') updateData.revisionRound = (ticket.revisionRound || 0) + 1;

            await updateDoc(doc(db, 'design_tickets', ticket.id), updateData);

            if (isSheetConfigured()) {
                updateTicketOnSheet(ticket.ticketCode, { status: newStatus })
                    .catch(err => console.warn('[Sheet] Status backup failed:', err));
            }

            const updatedTicket = {
                ...ticket,
                status: newStatus as DesignTicket['status'],
                updatedAt: now,
                ...(newStatus === 'completed' ? { completedAt: now } : {}),
                ...(newStatus === 'revision' ? { revisionRound: (ticket.revisionRound || 0) + 1 } : {}),
            };
            setTicket(updatedTicket);
            onTicketUpdate?.(updatedTicket);

            const stLabel = STATUS_CFG[newStatus]?.label || newStatus;
            const messagesRef = collection(db, 'ticket_chats', ticket.id, 'messages');
            await addDoc(messagesRef, {
                text: `🔄 Trạng thái đã chuyển sang: ${stLabel}`,
                sender: isAdmin ? 'Admin' : (ticket.contactName || 'Khách hàng'),
                senderRole: isAdmin ? 'admin' : 'customer',
                senderEmail: isAdmin ? adminEmail : (ticket.contactEmail || null),
                ticketCode: ticket.ticketCode,
                createdAt: serverTimestamp(),
            });
        } catch (err: any) {
            console.error(`Lỗi cập nhật: ${err.message}`);
        } finally {
            setUpdating(false);
        }
    }, [ticket, adminEmail, onTicketUpdate]);

    // ── Assign handler ──
    const handleAssign = useCallback(async (handler: string) => {
        setUpdating(true);
        try {
            const now = new Date().toISOString();
            await updateDoc(doc(db, 'design_tickets', ticket.id), {
                assignedTo: handler,
                updatedAt: Timestamp.now(),
            });

            if (isSheetConfigured()) {
                updateTicketOnSheet(ticket.ticketCode, { assignedTo: handler })
                    .catch(err => console.warn('[Sheet] Assign backup failed:', err));
            }

            const updatedTicket = { ...ticket, assignedTo: handler, updatedAt: now };
            setTicket(updatedTicket);
            onTicketUpdate?.(updatedTicket);
        } catch (err: any) {
            console.error(`Lỗi giao việc: ${err.message}`);
        } finally {
            setUpdating(false);
        }
    }, [ticket, adminEmail, onTicketUpdate]);

    // ── Load messages (includes chat + system events) ──
    useEffect(() => {
        const messagesRef = collection(db, 'ticket_chats', ticket.id, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(200));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: ChatMessage[] = snapshot.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id, text: data.text || '', sender: data.sender || '',
                    senderRole: data.senderRole || 'customer',
                    senderEmail: data.senderEmail || undefined,
                    imageUrl: data.imageUrl || undefined,
                    createdAt: data.createdAt || null,
                };
            });
            setMessages(msgs);
        }, (error) => {
            console.error('[Messages] Firestore listen error:', error);
        });

        return () => unsubscribe();
    }, [ticket.id]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ESC close
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (previewImg) setPreviewImg(null); else onClose(); } };
        window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    }, [onClose, previewImg]);


    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative w-full max-w-6xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-black/30 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>

                {/* ─── Header ─── */}
                <div className={clsx("relative px-5 md:px-6 py-3 md:py-4 bg-gradient-to-r text-white shrink-0", cat.gradient)} style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                    <button onClick={onClose} className="absolute top-3 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all z-10">
                        <X size={16} />
                    </button>

                    {/* Row 1: Brand + Interactive chips */}
                    <div className="flex flex-col md:flex-row md:items-center md:gap-5">
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 flex items-center justify-center shrink-0">
                                <CatIcon size={18} className="text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-white/60 text-[10px] font-mono font-semibold tracking-wider">{ticket.ticketCode}</p>
                                <h2 className="text-sm md:text-base font-extrabold truncate leading-tight">{ticket.brandName || 'Chưa có tên'}</h2>
                            </div>
                        </div>

                        {/* Interactive chips */}
                        <div className="flex-1 min-w-0 mt-2.5 md:mt-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Status chip */}
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

                                {/* Assign chip */}
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

                {/* ─── Mobile: Tab switcher (3 tabs) ─── */}
                <div className="flex md:hidden border-b border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                    <button onClick={() => setMobileTab('info')} className={clsx("flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all",
                        mobileTab === 'info' ? 'border-violet-500 text-violet-600' : 'border-transparent text-slate-400')}>
                        <FileText size={13} /> Chi tiết
                    </button>
                    <button onClick={() => setMobileTab('timeline')} className={clsx("flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all",
                        mobileTab === 'timeline' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400')}>
                        <History size={13} /> Lịch sử
                    </button>
                    <button onClick={() => setMobileTab('chat')} className={clsx("flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all relative",
                        mobileTab === 'chat' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400')}>
                        <MessageCircle size={13} /> Chat
                        {chatMessages.length > 0 && mobileTab !== 'chat' && (
                            <span className="absolute top-1.5 right-[20%] w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800" />
                        )}
                    </button>
                </div>

                {/* ─── Content: 3-column layout (desktop) / tabs (mobile) ─── */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                    {/* Column 1: Info */}
                    <div className={clsx(
                        "md:w-[35%] md:border-r border-slate-200/50 dark:border-white/10 overflow-y-auto",
                        "md:block", mobileTab === 'info' ? 'block' : 'hidden'
                    )}>
                        <InfoPanel ticket={ticket} onPreview={setPreviewImg} fontSize={infoFontSize} onFontSizeChange={(d) => setInfoFontSize(prev => Math.max(11, Math.min(20, prev + d)))} />
                    </div>

                    {/* Column 2: Timeline */}
                    <div className={clsx(
                        "md:w-[30%] md:flex md:flex-col md:border-r border-slate-200/50 dark:border-white/10",
                        mobileTab === 'timeline' ? 'flex flex-col' : 'hidden md:flex'
                    )} style={{ minHeight: 0 }}>
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200/50 dark:border-white/10 bg-gradient-to-r from-amber-500/5 to-orange-500/5 dark:from-amber-500/10 dark:to-orange-500/10 shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shrink-0">
                                <History size={13} className="text-white" />
                            </div>
                            <p className="text-[11px] font-black text-slate-800 dark:text-white">Lịch sử hoạt động</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                            {(() => {
                                const systemEvents = messages.filter(m => isSystemEvent(m.text));
                                if (systemEvents.length === 0) return (
                                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                        <div className="w-14 h-14 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/30 dark:border-white/10 flex items-center justify-center mb-3 shadow-lg">
                                            <History size={24} className="text-slate-300 dark:text-slate-500" />
                                        </div>
                                        <p className="text-[11px] font-bold text-slate-400">Chưa có sự kiện nào</p>
                                        <p className="text-[9px] text-slate-300 mt-0.5">Các thay đổi trạng thái sẽ hiển thị tại đây</p>
                                    </div>
                                );
                                return (
                                    <div className="relative">
                                        <div className="absolute left-[15px] top-4 bottom-4 w-[2px] rounded-full" style={{ background: 'linear-gradient(180deg, rgba(139,92,213,0.4) 0%, rgba(99,102,241,0.3) 50%, rgba(148,163,184,0.15) 100%)' }} />
                                        <div className="space-y-2">
                                            {[...systemEvents].reverse().map((msg) => {
                                                const isAssign = msg.text.startsWith('👤');
                                                const isApproved = msg.text.startsWith('✅');
                                                const isCancel = msg.text.startsWith('❌');
                                                const isComplete = msg.text.startsWith('🎉');

                                                let icon, accentFrom, cardBorder, cardGlow;
                                                if (isCancel) {
                                                    icon = <X size={10} />;
                                                    accentFrom = 'from-red-400 to-rose-500';
                                                    cardBorder = 'border-red-200/40 dark:border-red-500/15';
                                                    cardGlow = 'hover:shadow-red-200/20';
                                                } else if (isApproved) {
                                                    icon = <CheckCircle2 size={10} />;
                                                    accentFrom = 'from-emerald-400 to-green-500';
                                                    cardBorder = 'border-emerald-200/40 dark:border-emerald-500/15';
                                                    cardGlow = 'hover:shadow-emerald-200/20';
                                                } else if (isComplete) {
                                                    icon = <CheckCircle2 size={10} />;
                                                    accentFrom = 'from-green-400 to-emerald-600';
                                                    cardBorder = 'border-green-200/40 dark:border-green-500/15';
                                                    cardGlow = 'hover:shadow-green-200/20';
                                                } else if (isAssign) {
                                                    icon = <UserCheck size={10} />;
                                                    accentFrom = 'from-sky-400 to-blue-500';
                                                    cardBorder = 'border-sky-200/40 dark:border-sky-500/15';
                                                    cardGlow = 'hover:shadow-sky-200/20';
                                                } else {
                                                    icon = <Clock size={10} />;
                                                    accentFrom = 'from-amber-400 to-orange-500';
                                                    cardBorder = 'border-amber-200/40 dark:border-amber-500/15';
                                                    cardGlow = 'hover:shadow-amber-200/20';
                                                }

                                                return (
                                                    <div key={msg.id} className="relative flex items-start gap-2 pl-0.5">
                                                        <div className={clsx("w-[32px] h-[32px] rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 text-white z-10 shadow-md", accentFrom)}>
                                                            {icon}
                                                        </div>
                                                        <div className={clsx(
                                                            "flex-1 min-w-0 rounded-xl px-3 py-2 border transition-all",
                                                            "bg-white/50 dark:bg-white/[0.04] backdrop-blur-xl",
                                                            "shadow-sm hover:shadow-md",
                                                            cardBorder, cardGlow
                                                        )}>
                                                            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 leading-relaxed" style={{ wordBreak: 'break-word' }}>
                                                                {msg.text}
                                                            </p>
                                                            <p className="text-[8px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
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
                            <div ref={endRef} />
                        </div>
                    </div>

                    {/* Column 3: Chat */}
                    <div className={clsx(
                        "md:w-[35%] md:flex md:flex-col",
                        mobileTab === 'chat' ? 'flex flex-col flex-1' : 'hidden md:flex'
                    )} style={{ minHeight: 0 }}>
                        <InlineChatPanel
                            ticketId={ticket.id}
                            ticketCode={ticket.ticketCode}
                            customerName={ticket.brandName || 'Khách hàng'}
                            isAdmin={isAdmin}
                            adminEmail={adminEmail}
                            messages={messages}
                        />
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

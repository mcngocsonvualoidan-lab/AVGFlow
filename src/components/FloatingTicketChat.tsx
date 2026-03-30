import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Paperclip, AlertCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, Timestamp } from '@/lib/firestore';
import { uploadFileToR2 } from '../services/r2UploadService';

// Admin emails who can manage tickets
const ADMIN_NAMES: Record<string, string> = {
    'cambridgeorg.209@gmail.com': 'Lê Trần Thiện Tâm',
    'trolitct@gmail.com': 'Đinh Hoàng Ngọc Hân',
};

interface ChatMessage {
    id: string;
    text: string;
    sender: string;
    senderRole: 'customer' | 'admin';
    senderEmail?: string;
    imageUrl?: string;
    createdAt: any;
}

interface FloatingTicketChatProps {
    ticketId: string;
    ticketCode: string;
    customerName: string;
    isAdmin?: boolean;
    adminEmail?: string;
    adminName?: string;
}

const FloatingTicketChat: React.FC<FloatingTicketChatProps> = ({ ticketId, ticketCode, customerName, isAdmin, adminEmail }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [chatError, setChatError] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewImg, setPreviewImg] = useState<string | null>(null);

    const senderRole = isAdmin ? 'admin' : 'customer';
    const displayName = isAdmin ? 'Admin' : customerName;

    // Firestore Realtime — only active when chat is OPEN
    useEffect(() => {
        if (!ticketId || !isOpen) return;

        setChatError('');
        const messagesRef = collection(db, 'ticket_chats', ticketId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: ChatMessage[] = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    text: d.text || '',
                    sender: d.sender || '',
                    senderRole: (d.senderRole || 'customer') as 'customer' | 'admin',
                    senderEmail: d.senderEmail || undefined,
                    imageUrl: d.imageUrl || undefined,
                    createdAt: d.createdAt || null,
                };
            });
            setMessages(msgs);
        }, (error) => {
            console.error('[Chat] Firestore listen error:', error);
            setChatError('⚠️ Không thể tải tin nhắn.');
        });

        return () => unsubscribe();
    }, [ticketId, isOpen]);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSend = useCallback(async () => {
        if (!newMessage.trim() || sending) return;
        const msgText = newMessage.trim();
        setNewMessage('');
        setChatError('');

        // Brief disable to prevent double-click
        setSending(true);
        setTimeout(() => setSending(false), 300);

        // Fire-and-forget: add to Firestore
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
                    setChatError(`⚠️ Gửi hình ảnh thất bại: ${err.message || 'Lỗi không xác định'}`);
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
            setChatError(`⚠️ Gửi file thất bại: ${err.message || 'Lỗi không xác định'}`);
        } finally { setSending(false); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [ticketId, ticketCode, displayName, senderRole, isAdmin, adminEmail]);

    const formatTime = (ts: any) => {
        if (!ts) return '';
        let d: Date;
        if (ts instanceof Timestamp) d = ts.toDate();
        else if (typeof ts?.toDate === 'function') d = ts.toDate();
        else if (typeof ts?.seconds === 'number') d = new Date(ts.seconds * 1000);
        else d = new Date(ts);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' • ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={clsx(
                    "fixed bottom-[100px] left-4 md:bottom-8 md:left-8 z-[99999]",
                    "w-14 h-14 bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 hover:scale-105 active:scale-95 transition-all duration-300"
                )}
                title="Mở trò chuyện Ticket"
            >
                <MessageCircle size={24} />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">1</span>
            </button>
        );
    }

    return (
        <div className={clsx(
            "fixed z-[99999] flex flex-col overflow-hidden transition-all duration-300",
            "bottom-[90px] left-3 right-3 h-[500px]",
            "md:bottom-8 md:left-8 md:w-[380px] md:h-[600px] md:right-auto",
            "bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/50 dark:border-white/10"
        )}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/50 dark:border-white/10 bg-white/50 dark:bg-slate-800/50">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0">
                    <MessageCircle size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-800 dark:text-white truncate">Trao đổi Đơn hàng</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{ticketCode}</p>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-full text-slate-500 dark:text-slate-400 transition-colors shrink-0"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Error */}
            {chatError && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200/50 dark:border-amber-500/20">
                    <AlertCircle size={12} className="text-amber-500 shrink-0" />
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex-1">{chatError}</span>
                    <button onClick={() => setChatError('')} className="text-[9px] font-bold text-amber-600 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200">X</button>
                </div>
            )}

            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                            <MessageCircle size={24} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Chưa có tin nhắn nào</p>
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">Hãy bắt đầu cuộc trò chuyện!</p>
                    </div>
                )}
                {messages.map((msg) => {
                    const isCustomer = msg.senderRole === 'customer';
                    const internalAdminName = msg.senderEmail ? (ADMIN_NAMES[msg.senderEmail] || msg.sender) : msg.sender;
                    const showName = isCustomer ? msg.sender : (isAdmin ? internalAdminName : 'Admin');
                    const isMe = isAdmin ? !isCustomer : isCustomer;

                    return (
                        <div key={msg.id} className={clsx("flex gap-2 w-full", isMe ? "flex-row-reverse" : "flex-row")}>
                            <div className={clsx(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black shadow-sm mt-1",
                                isMe
                                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                                    : "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                            )}>
                                {showName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className={clsx(
                                "max-w-[80%] rounded-2xl p-3 shadow-sm break-words relative",
                                isMe
                                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-tr-sm"
                                    : "bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                            )}>
                                {!isMe && <p className={clsx("text-[10px] font-black mb-1 opacity-70", isMe ? "text-white" : "text-emerald-500")}>{showName}</p>}

                                {msg.imageUrl && (
                                    <div className="mb-2 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 group relative max-w-[200px]">
                                        <img src={msg.imageUrl} alt="attached" className="w-full h-auto cursor-pointer hover:scale-105 transition-transform" onClick={() => setPreviewImg(msg.imageUrl || null)} />
                                    </div>
                                )}

                                <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                <p className={clsx("text-[9px] mt-1.5 opacity-60", isMe ? "text-right" : "")}>{formatTime(msg.createdAt)}</p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-xl shrink-0">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all shrink-0"
                    >
                        <Paperclip size={16} />
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
                            className="w-full h-9 px-3.5 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-700/80 border border-slate-200/50 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg disabled:opacity-40 transition-all shrink-0"
                    >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
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

export default FloatingTicketChat;

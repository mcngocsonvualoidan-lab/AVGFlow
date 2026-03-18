import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Tag, Box, Share2, PenLine, Sparkles, ArrowLeft, Loader2, AlertCircle, Shield, Send, Paperclip, MessageCircle, Clock, Hash, ChevronRight, Upload, Search, Filter, XCircle, UserCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { db } from '../../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { uploadFileToR2 } from '../../services/r2UploadService';
import { useAuth } from '../../context/AuthContext';
// Design ticket handlers (only specific staff)
const DESIGN_HANDLERS = ['Nguyễn Ngọc Sơn', 'Lương Ngọc Doanh'];
import DesignTicketStats from './DesignTicketStats';

// Admin emails who can manage tickets
const ADMIN_EMAILS = ['cambridgeorg.209@gmail.com', 'trolitct@gmail.com'];
const ADMIN_NAMES: Record<string, string> = {
    'cambridgeorg.209@gmail.com': 'Lê Trần Thiện Tâm',
    'trolitct@gmail.com': 'Đinh Hoàng Ngọc Hân',
};

// ============================================================
// TYPES
// ============================================================
interface DesignTicket {
    id: string;
    ticketCode: string;
    category: 'label-bag' | 'carton' | 'social';
    action: 'edit' | 'new';
    brandName: string;
    contactName: string;
    contactPhone: string;
    description: string;
    status: 'open' | 'in-review' | 'revision' | 'approved' | 'completed' | 'cancelled';
    revisionRound: number;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
    completedAt?: Timestamp | null;
    cancelReason?: string;
    cancelledAt?: Timestamp | null;
    assignedTo?: string;
    assignedBy?: string;
}

interface ChatMessage {
    id: string;
    text: string;
    sender: string;
    senderRole: 'customer' | 'admin';
    senderEmail?: string;
    imageUrl?: string;
    createdAt: Timestamp | null;
}

// ============================================================
// HELPERS
// ============================================================
function generateTicketCode(category: string): string {
    const prefixes: Record<string, string> = {
        'label-bag': 'TK-NB',
        'carton': 'TK-CT',
        'social': 'TK-SC',
    };
    const prefix = prefixes[category] || 'TK';
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
}

const CATEGORY_CONFIG = {
    'label-bag': {
        label: 'Nhãn / Túi',
        icon: Tag,
        gradient: 'from-violet-500 to-purple-600',
        lightBg: 'bg-violet-50 dark:bg-violet-500/10',
        border: 'border-violet-200 dark:border-violet-500/20',
        text: 'text-violet-600 dark:text-violet-400',
        shadow: 'shadow-violet-500/20',
        glow: 'from-violet-400/20 to-purple-400/20',
    },
    'carton': {
        label: 'Thùng Carton',
        icon: Box,
        gradient: 'from-amber-500 to-orange-600',
        lightBg: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-200 dark:border-amber-500/20',
        text: 'text-amber-600 dark:text-amber-400',
        shadow: 'shadow-amber-500/20',
        glow: 'from-amber-400/20 to-orange-400/20',
    },
    'social': {
        label: 'Social Media',
        icon: Share2,
        gradient: 'from-cyan-500 to-blue-600',
        lightBg: 'bg-cyan-50 dark:bg-cyan-500/10',
        border: 'border-cyan-200 dark:border-cyan-500/20',
        text: 'text-cyan-600 dark:text-cyan-400',
        shadow: 'shadow-cyan-500/20',
        glow: 'from-cyan-400/20 to-blue-400/20',
    },
};

type CategoryKey = keyof typeof CATEGORY_CONFIG;

const ACTION_CONFIG = {
    edit: { label: 'Chỉnh sửa', icon: PenLine, desc: 'Cập nhật, thay đổi thiết kế hiện có' },
    new: { label: 'Tạo mới', icon: Sparkles, desc: 'Thiết kế hoàn toàn mới từ đầu' },
};

// ============================================================
// FORM FIELDS CONFIG — mapped from real Google Sheet structure
// ============================================================
interface FormField {
    label: string;
    placeholder: string;
    type: 'text' | 'textarea' | 'select' | 'checkbox-group' | 'section-header';
    options?: string[];
    required?: boolean;
    half?: boolean; // render side-by-side
}

const CUSTOMER_INFO_FIELDS: FormField[] = [
    { label: '§ THÔNG TIN KHÁCH HÀNG', placeholder: '', type: 'section-header' },
    { label: 'Tên đơn vị đặt hàng', placeholder: 'VD: Công ty TNHH ABC', type: 'text', required: true },
    { label: 'Người đặt hàng', placeholder: 'Họ và tên', type: 'text', required: true, half: true },
    { label: 'Số điện thoại', placeholder: '0xxx xxx xxx', type: 'text', required: true, half: true },
    { label: 'Địa chỉ', placeholder: 'Địa chỉ đơn vị', type: 'text' },
    { label: 'Email', placeholder: 'email@example.com', type: 'text', half: true },
    { label: 'Ngày đặt hàng', placeholder: 'DD/MM/YYYY', type: 'text', half: true },
];

const PRODUCT_INFO_FIELDS: FormField[] = [
    { label: '§ THÔNG TIN SẢN PHẨM', placeholder: '', type: 'section-header' },
    { label: 'Tên nhãn hàng', placeholder: 'Tên brand', type: 'text', required: true, half: true },
    { label: 'Tên sản phẩm', placeholder: 'Tên sản phẩm cụ thể', type: 'text', required: true, half: true },
    { label: 'Dung tích', placeholder: 'VD: 500ml, 1L...', type: 'text', half: true },
    { label: 'Thời gian cần giao hàng', placeholder: 'VD: 15/04/2026', type: 'text', half: true },
    { label: 'Link hình ảnh CAN/CHAI/TÚI', placeholder: 'https://drive.google.com/...', type: 'text' },
];

const DELIVERY_FORMAT_FIELD: FormField = {
    label: 'Hình thức bàn giao',
    placeholder: '',
    type: 'checkbox-group',
    options: ['File Package (Font, tài nguyên, AI gốc)', 'File in (convert)', 'File PDF', 'File ảnh (JPEG/JPG)', 'File tách nền (PNG)', 'File PSD (Mockup 3D)', 'File ảnh/tách nền 3D', 'Yêu cầu khác'],
};

const LABEL_BAG_TECHNICAL_FIELDS: FormField[] = [
    { label: '§ THÔNG TIN KỸ THUẬT', placeholder: '', type: 'section-header' },
    { label: 'Mã vạch', placeholder: 'Nội dung mã vạch sản phẩm', type: 'text' },
    { label: 'Mã QR', placeholder: 'Nội dung hoặc link mã QR', type: 'text' },
    { label: 'Tên các pháp nhân', placeholder: 'Tên đầy đủ pháp nhân trên nhãn', type: 'textarea' },
    { label: 'Thông tin CSKH', placeholder: 'Hotline, website, địa chỉ CSKH...', type: 'textarea' },
    { label: 'Nguồn gốc xuất xứ', placeholder: 'Quốc gia, vùng sản xuất...', type: 'text' },
    { label: 'Thành phần', placeholder: 'Thành phần chi tiết sản phẩm', type: 'textarea' },
    { label: 'Công dụng', placeholder: 'Công dụng sản phẩm', type: 'textarea' },
    { label: 'Hướng dẫn sử dụng', placeholder: 'Cách sử dụng sản phẩm', type: 'textarea' },
    { label: 'Bảo quản', placeholder: 'Điều kiện bảo quản', type: 'text' },
    { label: 'Khuyến cáo', placeholder: 'Các khuyến cáo, cảnh báo', type: 'textarea' },
];

const LABEL_BAG_COMMERCIAL_FIELDS: FormField[] = [
    { label: '§ THÔNG TIN THƯƠNG MẠI', placeholder: '', type: 'section-header' },
    { label: 'Kích thước D*R (mm)', placeholder: 'VD: 80x120 mm', type: 'text', half: true },
    { label: 'Màu sắc', placeholder: 'Số lượng màu, tông chủ đạo...', type: 'text', half: true },
    { label: 'Hình ảnh / Họa tiết', placeholder: 'Mô tả hình ảnh, họa tiết mong muốn', type: 'textarea' },
    { label: 'Thông tin quảng cáo', placeholder: 'Slogan, chương trình KM...', type: 'textarea' },
    { label: 'Ý tưởng / Thông tin khác', placeholder: 'Ý tưởng thiết kế, tham khảo, ...', type: 'textarea' },
    { label: 'Link tài nguyên thiết kế', placeholder: 'Link file vector, hình ảnh chất lượng cao...', type: 'text' },
];

const FORM_FIELDS: Record<string, FormField[]> = {
    'label-bag-new': [
        ...CUSTOMER_INFO_FIELDS,
        ...PRODUCT_INFO_FIELDS,
        { label: '§ YÊU CẦU THIẾT KẾ', placeholder: '', type: 'section-header' },
        { label: 'Kích thước D*R (mm)', placeholder: 'VD: 80x120 mm', type: 'text', half: true },
        { label: 'Màu sắc', placeholder: 'Số lượng màu, tông chủ đạo...', type: 'text', half: true },
        { label: 'Phong cách thiết kế', placeholder: 'Sang trọng, hiện đại, tối giản, trẻ trung...', type: 'text' },
        { label: 'Nội dung chính trên nhãn', placeholder: 'Tên SP, thành phần, công dụng, HDSD, bảo quản, pháp nhân...', type: 'textarea' },
        { label: 'Hình ảnh / Họa tiết mong muốn', placeholder: 'Mô tả hình ảnh, logo, icon mong muốn trên nhãn/túi', type: 'textarea' },
        { label: 'Thông tin quảng cáo / Slogan', placeholder: 'Slogan, USP, chương trình KM nếu có...', type: 'textarea' },
        { label: 'Ý tưởng / Ghi chú thêm', placeholder: 'Ý tưởng thiết kế, link tham khảo, yêu cầu đặc biệt...', type: 'textarea' },
        { label: 'Link tài nguyên thiết kế', placeholder: 'Link file vector, logo, hình ảnh chất lượng cao...', type: 'text' },
        DELIVERY_FORMAT_FIELD,
    ],
    'label-bag-edit': [
        ...CUSTOMER_INFO_FIELDS,
        ...PRODUCT_INFO_FIELDS,
        { label: '§ LÝ DO CHỈNH SỬA', placeholder: '', type: 'section-header' },
        { label: 'Lý do chỉnh sửa', placeholder: 'Lý do cần chỉnh sửa thiết kế', type: 'textarea', required: true },
        { label: '§ MỨC GIÁ THIẾT KẾ', placeholder: '', type: 'section-header' },
        { label: 'Giá KH đề xuất', placeholder: 'VD: 2,000,000 VNĐ', type: 'text', half: true },
        { label: 'AVG báo giá', placeholder: 'Admin điền', type: 'text', half: true },
        ...LABEL_BAG_TECHNICAL_FIELDS,
        ...LABEL_BAG_COMMERCIAL_FIELDS,
        DELIVERY_FORMAT_FIELD,
    ],
    'carton-new': [
        ...CUSTOMER_INFO_FIELDS,
        ...PRODUCT_INFO_FIELDS,
        { label: '§ THÔNG TIN THÙNG CARTON', placeholder: '', type: 'section-header' },
        { label: 'Loại thùng', placeholder: 'Chọn loại', type: 'select', options: ['Thùng carton 3 lớp', 'Thùng carton 5 lớp', 'Thùng carton in offset', 'Hộp carton', 'Khác'] },
        { label: 'Kích thước (DxRxC)', placeholder: 'VD: 30x20x15 cm', type: 'text', half: true },
        { label: 'Số lượng', placeholder: 'VD: 500', type: 'text', half: true },
        { label: 'Yêu cầu in ấn', placeholder: 'Số màu in, vị trí in, chất liệu...', type: 'textarea' },
        { label: 'Ý tưởng thiết kế', placeholder: 'Concept, tham khảo mẫu...', type: 'textarea' },
        { label: 'Link tài nguyên thiết kế', placeholder: 'Link file vector, logo, hình ảnh...', type: 'text' },
        DELIVERY_FORMAT_FIELD,
    ],
    'carton-edit': [
        ...CUSTOMER_INFO_FIELDS,
        { label: 'Mã đơn hàng cũ', placeholder: 'VD: TK-CT-XXXX', type: 'text' },
        { label: 'Lý do chỉnh sửa', placeholder: 'Chi tiết phần cần thay đổi...', type: 'textarea', required: true },
        { label: 'Giá KH đề xuất', placeholder: 'VD: 1,500,000 VNĐ', type: 'text', half: true },
        { label: 'AVG báo giá', placeholder: 'Admin điền', type: 'text', half: true },
        DELIVERY_FORMAT_FIELD,
    ],
    'social-new': [
        ...CUSTOMER_INFO_FIELDS,
        { label: '§ THÔNG TIN THIẾT KẾ SOCIAL', placeholder: '', type: 'section-header' },
        { label: 'Tên nhãn hàng / Fanpage', placeholder: 'VD: AVG Beauty', type: 'text', required: true },
        { label: 'Loại thiết kế', placeholder: 'Chọn loại', type: 'select', options: ['Banner Facebook', 'Post Instagram', 'Story', 'Video thumbnail', 'Avatar/Cover', 'Poster sự kiện', 'Khác'] },
        { label: 'Kích thước / Tỷ lệ', placeholder: 'VD: 1080x1080, 16:9...', type: 'text' },
        { label: 'Nội dung bài viết / Caption', placeholder: 'Nội dung chính, thông điệp muốn truyền tải...', type: 'textarea' },
        { label: 'Phong cách / Tông màu', placeholder: 'Sang trọng, năng động, tối giản...', type: 'text' },
        { label: 'Link tài nguyên / Tham khảo', placeholder: 'Link hình ảnh, mẫu tham khảo...', type: 'text' },
        DELIVERY_FORMAT_FIELD,
    ],
    'social-edit': [
        ...CUSTOMER_INFO_FIELDS,
        { label: 'Link thiết kế cũ', placeholder: 'https://...', type: 'text' },
        { label: 'Nội dung cần chỉnh sửa', placeholder: 'Chi tiết phần cần thay đổi...', type: 'textarea', required: true },
    ],
};

// ============================================================
// CHAT COMPONENT
// ============================================================
const TicketChat: React.FC<{ ticketId: string; ticketCode: string; customerName: string; isAdmin?: boolean; adminEmail?: string; adminName?: string }> = ({ ticketId, ticketCode, customerName, isAdmin, adminEmail }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const senderRole = isAdmin ? 'admin' : 'customer';
    const displayName = isAdmin ? 'Admin' : customerName;

    useEffect(() => {
        const q = query(
            collection(db, 'design_tickets', ticketId, 'messages'),
            orderBy('createdAt', 'asc')
        );
        const unsub = onSnapshot(q, (snap) => {
            const msgs: ChatMessage[] = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
            } as ChatMessage));
            setMessages(msgs);
        });
        return () => unsub();
    }, [ticketId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const buildMsgData = useCallback((text: string, imageUrl?: string) => ({
        text,
        sender: displayName,
        senderRole,
        senderEmail: isAdmin ? adminEmail : undefined,
        ...(imageUrl ? { imageUrl } : {}),
        createdAt: serverTimestamp(),
    }), [displayName, senderRole, isAdmin, adminEmail]);

    const handleSend = useCallback(async () => {
        if (!newMessage.trim() || sending) return;
        setSending(true);
        try {
            await addDoc(collection(db, 'design_tickets', ticketId, 'messages'), buildMsgData(newMessage.trim()));
            setNewMessage('');
        } catch (e) { console.error(e); }
        finally { setSending(false); }
    }, [newMessage, ticketId, sending, buildMsgData]);

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
                    await addDoc(collection(db, 'design_tickets', ticketId, 'messages'), buildMsgData('📷 Hình ảnh', result.url));
                } catch (err) { console.error(err); }
                finally { setSending(false); }
                break;
            }
        }
    }, [ticketId, buildMsgData]);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSending(true);
        try {
            const result = await uploadFileToR2(file, 'design_ticket_chat');
            const label = file.type.startsWith('image/') ? `📷 ${file.name}` : `📎 ${file.name}`;
            await addDoc(collection(db, 'design_tickets', ticketId, 'messages'), buildMsgData(label, result.url));
        } catch (err) { console.error(err); }
        finally { setSending(false); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [ticketId, buildMsgData]);

    const formatTime = (ts: Timestamp | null) => {
        if (!ts) return '';
        const d = ts.toDate();
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' • ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/50 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <MessageCircle size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-800 dark:text-white">Trao đổi Ticket</p>
                    <p className="text-[10px] text-slate-400 font-mono">{ticketCode}</p>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">ONLINE</span>
                </div>
            </div>

            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px] custom-scrollbar">
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
                    const showName = isAdmin && !isCustomer ? internalAdminName : msg.sender;
                    return (
                        <div key={msg.id} className={clsx("flex gap-2", isCustomer ? "flex-row-reverse" : "flex-row")}>
                            <div className={clsx(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black shadow-sm",
                                isCustomer
                                    ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                                    : "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                            )}>
                                {showName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className={clsx(
                                "max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm",
                                isCustomer
                                    ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-tr-md"
                                    : "bg-white/80 dark:bg-slate-700/80 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 text-slate-800 dark:text-slate-200 rounded-tl-md"
                            )}>
                                <p className={clsx("text-[10px] font-bold mb-1", isCustomer ? "text-white/70" : "text-slate-400 dark:text-slate-500")}>
                                    {showName}
                                    {isAdmin && !isCustomer && msg.senderEmail && (
                                        <span className="ml-1.5 text-[8px] font-medium opacity-50">(nội bộ)</span>
                                    )}
                                </p>
                                {msg.imageUrl && (
                                    <img src={msg.imageUrl} alt="Uploaded" className="rounded-xl max-w-full max-h-48 object-cover mb-2 border border-white/20 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.imageUrl, '_blank')} />
                                )}
                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>
                                <p className={clsx("text-[9px] mt-1.5", isCustomer ? "text-white/50 text-right" : "text-slate-300 dark:text-slate-600")}>
                                    {formatTime(msg.createdAt)}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-slate-200/50 dark:border-white/10 p-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl">
                <div className="flex gap-2 items-end">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all shrink-0"
                    >
                        <Paperclip size={16} />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    <div className="flex-1 relative">
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onPaste={handlePaste}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Nhập tin nhắn... (Ctrl+V để paste ảnh)"
                            rows={1}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-700/80 border border-slate-200/50 dark:border-white/10 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/30 hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
                    >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// STATUS HELPERS
// ============================================================
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    'open': { label: 'Mới tạo', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-300 dark:border-sky-500/30', dot: 'bg-sky-500' },
    'in-review': { label: 'Đang duyệt', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-300 dark:border-amber-500/30', dot: 'bg-amber-500' },
    'revision': { label: 'SXTC', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-300 dark:border-violet-500/30', dot: 'bg-violet-500' },
    'approved': { label: 'Đã chốt', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-300 dark:border-emerald-500/30', dot: 'bg-emerald-500' },
    'completed': { label: 'Hoàn tất', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-300 dark:border-green-500/30', dot: 'bg-green-500' },
    'cancelled': { label: 'Đã hủy', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-300 dark:border-red-500/30', dot: 'bg-red-500' },
};

// ============================================================
// MAIN COMPONENT
// ============================================================
const DesignOrderForm: React.FC = () => {
    const { currentUser, isAdminView } = useAuth();
    const [step, setStep] = useState<'select-category' | 'select-action' | 'fill-form' | 'ticket-view'>('select-category');
    const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
    const [selectedAction, setSelectedAction] = useState<'edit' | 'new' | null>(null);
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Ticket state
    const [activeTicket, setActiveTicket] = useState<DesignTicket | null>(null);
    const [myTickets, setMyTickets] = useState<DesignTicket[]>([]);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    // Cancel modal
    const [cancelModal, setCancelModal] = useState<{ ticketId: string; ticketCode: string } | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    // Assign modal
    const [assignModal, setAssignModal] = useState<{ ticketId: string } | null>(null);

    // Image upload state
    const [uploadedImages, setUploadedImages] = useState<{ name: string; url: string; preview: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Admin check
    const userEmail = currentUser?.email || '';
    const isAdmin = isAdminView && ADMIN_EMAILS.includes(userEmail);
    const adminName = ADMIN_NAMES[userEmail] || currentUser?.displayName || 'Admin';

    // Load tickets from Firestore
    useEffect(() => {
        const q = query(collection(db, 'design_tickets'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const tickets: DesignTicket[] = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
            } as DesignTicket));
            setMyTickets(tickets);
        });
        return () => unsub();
    }, []);

    // Filtered tickets
    const filteredTickets = useMemo(() => {
        return myTickets.filter(t => {
            if (filterStatus !== 'all' && t.status !== filterStatus) return false;
            if (filterCategory !== 'all' && t.category !== filterCategory) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (
                    t.ticketCode.toLowerCase().includes(q) ||
                    t.brandName?.toLowerCase().includes(q) ||
                    t.contactName?.toLowerCase().includes(q) ||
                    t.contactPhone?.includes(q)
                );
            }
            return true;
        });
    }, [myTickets, filterStatus, filterCategory, searchQuery]);

    // Cancel ticket
    const handleCancelTicket = async () => {
        if (!cancelModal || !cancelReason.trim()) return;
        try {
            await updateDoc(doc(db, 'design_tickets', cancelModal.ticketId), {
                status: 'cancelled',
                cancelReason: cancelReason.trim(),
                cancelledAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            await addDoc(collection(db, 'design_tickets', cancelModal.ticketId, 'messages'), {
                text: `❌ Đơn hàng ${cancelModal.ticketCode} đã bị hủy.\nLý do: ${cancelReason.trim()}`,
                sender: 'Hệ thống',
                senderRole: 'admin',
                createdAt: serverTimestamp(),
            });
            setCancelModal(null);
            setCancelReason('');
            if (activeTicket?.id === cancelModal.ticketId) {
                setActiveTicket(prev => prev ? { ...prev, status: 'cancelled', cancelReason: cancelReason.trim() } : null);
            }
        } catch (e) { console.error(e); }
    };

    // Assign handler
    const handleAssignHandler = async (handlerName: string) => {
        if (!assignModal) return;
        try {
            await updateDoc(doc(db, 'design_tickets', assignModal.ticketId), {
                assignedTo: handlerName,
                assignedBy: adminName,
                updatedAt: serverTimestamp(),
            });
            await addDoc(collection(db, 'design_tickets', assignModal.ticketId, 'messages'), {
                text: `👤 Người xử lý đã được phân công: ${handlerName}\nPhân công bởi: ${adminName}`,
                sender: 'Hệ thống',
                senderRole: 'admin',
                createdAt: serverTimestamp(),
            });
            setAssignModal(null);
        } catch (e) { console.error(e); }
    };

    const handleCategorySelect = (cat: CategoryKey) => {
        setSelectedCategory(cat);
        setSelectedAction(null);
        setFormValues({});
        setStep('select-action');
    };

    const handleActionSelect = (action: 'edit' | 'new') => {
        setSelectedAction(action);
        setFormValues({});
        setUploadedImages([]);
        setStep('fill-form');
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true); setError('');
        try {
            const newImages: typeof uploadedImages = [];
            for (const file of Array.from(files)) {
                if (file.size > 25 * 1024 * 1024) { setError('File quá lớn (tối đa 25MB)'); continue; }
                const result = await uploadFileToR2(file, 'design_tickets');
                const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
                newImages.push({ name: file.name, url: result.url, preview });
            }
            setUploadedImages(prev => [...prev, ...newImages]);
        } catch (e: any) {
            setError('Upload lỗi: ' + (e.message || 'Thử lại'));
        } finally {
            setUploading(false);
        }
    };

    const handleBack = () => {
        if (step === 'ticket-view') { setActiveTicket(null); setStep('select-category'); }
        else if (step === 'fill-form') setStep('select-action');
        else if (step === 'select-action') setStep('select-category');
    };

    const handleSubmit = async () => {
        if (!selectedCategory || !selectedAction) return;
        const formKey = `${selectedCategory}-${selectedAction}`;
        const fields = FORM_FIELDS[formKey] || [];
        // Only validate required fields (skip section-header and checkbox-group)
        const missing = fields.filter(f => f.required && f.type !== 'section-header' && f.type !== 'checkbox-group' && !(formValues[f.label] || '').trim());
        if (missing.length > 0) {
            setError(`Vui lòng điền: ${missing.map(f => f.label).join(', ')}`);
            return;
        }
        setSubmitting(true); setError('');
        try {
            const ticketCode = generateTicketCode(selectedCategory);
            // Extract all form data (excluding section headers)
            const formData: Record<string, string> = {};
            fields.forEach(f => {
                if (f.type !== 'section-header') {
                    formData[f.label] = formValues[f.label] || '';
                }
            });
            const ticketData = {
                ticketCode,
                category: selectedCategory,
                action: selectedAction,
                brandName: formValues['Tên nhãn hàng'] || formValues['Tên đơn vị đặt hàng'] || formValues['Tên nhãn hàng / Fanpage'] || '',
                contactName: formValues['Người đặt hàng'] || '',
                contactPhone: formValues['Số điện thoại'] || '',
                contactEmail: formValues['Email'] || '',
                contactAddress: formValues['Địa chỉ'] || '',
                formData, // Store ALL form fields in a nested object
                imageUrls: uploadedImages.map(img => img.url),
                description: Object.entries(formData).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n'),
                status: 'open',
                revisionRound: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                completedAt: null,
            };
            const docRef = await addDoc(collection(db, 'design_tickets'), ticketData);
            // Auto-send welcome message
            await addDoc(collection(db, 'design_tickets', docRef.id, 'messages'), {
                text: `🎉 Ticket ${ticketCode} đã được tạo thành công!\n\nLoại: ${CATEGORY_CONFIG[selectedCategory].label} — ${ACTION_CONFIG[selectedAction].label}\nThương hiệu: ${ticketData.brandName}\n\nAdmin sẽ liên hệ bạn sớm nhất qua chat này. Hãy theo dõi ticket để cập nhật tiến độ!`,
                sender: 'Hệ thống',
                senderRole: 'admin',
                createdAt: serverTimestamp(),
            });
            // Sync to Google Sheet via Apps Script webhook (fire & forget)
            try {
                fetch('https://script.google.com/macros/s/AKfycbzLlTLxa9hqObNmS4sbYNjAqAvMd68zeqpN6UJKGlM9pblH_K-fivpRyjW9Mf53rqloIQ/exec', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticketCode, category: selectedCategory, action: selectedAction, ...formData }),
                    mode: 'no-cors',
                }).catch(() => { /* silent fail — Sheet sync is secondary */ });
            } catch { /* ignore */ }
            setActiveTicket({
                id: docRef.id,
                ...ticketData,
                createdAt: null,
                updatedAt: null,
            } as DesignTicket);
            setStep('ticket-view');
        } catch (e: any) {
            setError(e.message || 'Có lỗi xảy ra');
        } finally {
            setSubmitting(false);
        }
    };

    const currentConfig = selectedCategory ? CATEGORY_CONFIG[selectedCategory] : null;
    const formKey = selectedCategory && selectedAction ? `${selectedCategory}-${selectedAction}` : '';
    const currentFields = formKey ? FORM_FIELDS[formKey] || [] : [];

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="space-y-6">
            {/* Back button + breadcrumb */}
            {step !== 'select-category' && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
                    >
                        <ArrowLeft size={14} /> Quay lại
                    </button>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <span>Thiết kế</span>
                        {selectedCategory && (
                            <>
                                <ChevronRight size={12} />
                                <span className={currentConfig?.text}>{currentConfig?.label}</span>
                            </>
                        )}
                        {selectedAction && (
                            <>
                                <ChevronRight size={12} />
                                <span>{ACTION_CONFIG[selectedAction].label}</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ===== STEP 1: SELECT CATEGORY ===== */}
            {step === 'select-category' && (
                <div className="space-y-6">
                    {/* Category cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(Object.keys(CATEGORY_CONFIG) as CategoryKey[]).map((catKey) => {
                            const cfg = CATEGORY_CONFIG[catKey];
                            const CatIcon = cfg.icon;
                            return (
                                <button
                                    key={catKey}
                                    type="button"
                                    onClick={() => handleCategorySelect(catKey)}
                                    className="group relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/60 dark:border-white/10 p-6 sm:p-8 text-center transition-all duration-500 hover:shadow-2xl hover:scale-[1.03] hover:border-transparent"
                                >
                                    {/* Glow bg on hover */}
                                    <div className={clsx("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl", cfg.glow)} />
                                    {/* Glassmorphism overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/5 pointer-events-none rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    <div className="relative z-10">
                                        <div className={clsx("w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-xl mb-4 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", cfg.gradient, cfg.shadow)}>
                                            <CatIcon size={28} className="text-white sm:w-9 sm:h-9" />
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">{cfg.label}</h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">Chọn để xem tùy chọn</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Tickets - Search & Filter */}
                    {myTickets.length > 0 && (
                        <div className="relative overflow-hidden rounded-3xl bg-white/60 dark:bg-slate-800/50 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 shadow-xl">
                            <div className="px-5 py-4 border-b border-slate-200/50 dark:border-white/10 space-y-3">
                                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <Hash size={16} className="text-violet-500" /> Tra cứu Tickets
                                    <span className="ml-auto text-[10px] font-bold text-slate-400">{filteredTickets.length}/{myTickets.length}</span>
                                </h3>
                                {/* Search */}
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Tìm theo mã ticket, thương hiệu, tên, SĐT..."
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"><XCircle size={14} /></button>
                                    )}
                                </div>
                                {/* Filters */}
                                <div className="flex flex-wrap gap-1.5">
                                    <Filter size={12} className="text-slate-400 mt-1" />
                                    {['all', ...Object.keys(STATUS_CONFIG)].map(s => {
                                        const cfg = s === 'all' ? null : STATUS_CONFIG[s];
                                        return (
                                            <button key={s} onClick={() => setFilterStatus(s)}
                                                className={clsx("text-[10px] font-bold px-2 py-1 rounded-lg border transition-all", filterStatus === s ? (cfg ? `${cfg.bg} ${cfg.color} ${cfg.border}` : 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-500/30') : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100')}
                                            >
                                                {cfg && <span className={clsx("inline-block w-1.5 h-1.5 rounded-full mr-1", cfg.dot)} />}
                                                {s === 'all' ? 'Tất cả' : cfg?.label}
                                            </button>
                                        );
                                    })}
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                    {['all', ...Object.keys(CATEGORY_CONFIG)].map(c => {
                                        const cfg = c === 'all' ? null : CATEGORY_CONFIG[c as CategoryKey];
                                        return (
                                            <button key={c} onClick={() => setFilterCategory(c)}
                                                className={clsx("text-[10px] font-bold px-2 py-1 rounded-lg border transition-all", filterCategory === c ? (cfg ? `${cfg.lightBg} ${cfg.text} ${cfg.border}` : 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-500/30') : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100')}
                                            >{c === 'all' ? 'Tất cả' : cfg?.label}</button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {filteredTickets.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400">Không tìm thấy ticket phù hợp</div>
                                ) : filteredTickets.map((ticket) => {
                                    const catCfg = CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG['label-bag'];
                                    const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['open'];
                                    const createdStr = ticket.createdAt ? ticket.createdAt.toDate().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
                                    return (
                                        <div key={ticket.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <button type="button" onClick={() => { setActiveTicket(ticket); setStep('ticket-view'); }} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                                                <div className={clsx("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md relative", catCfg.gradient)}>
                                                    {React.createElement(catCfg.icon, { size: 16, className: 'text-white' })}
                                                    <span className={clsx("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800", statusCfg.dot)} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">{ticket.ticketCode}</span>
                                                        <span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded-md border", statusCfg.bg, statusCfg.color, statusCfg.border)}>{statusCfg.label}</span>
                                                        {ticket.assignedTo && (
                                                            <span className="text-[9px] font-medium text-indigo-500 dark:text-indigo-400 flex items-center gap-0.5"><UserCheck size={9} />{ticket.assignedTo.split(' ').pop()}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 truncate">{ticket.brandName} — {catCfg.label} {createdStr && `• ${createdStr}`}</p>
                                                    {ticket.status === 'cancelled' && ticket.cancelReason && (
                                                        <p className="text-[10px] text-red-400 truncate mt-0.5">Lý do hủy: {ticket.cancelReason}</p>
                                                    )}
                                                </div>
                                            </button>
                                            {isAdmin && ticket.status !== 'cancelled' && ticket.status !== 'completed' && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button onClick={() => setAssignModal({ ticketId: ticket.id })} title="Phân công" className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 hover:bg-indigo-100 transition-colors"><UserCheck size={12} /></button>
                                                    <button onClick={() => setCancelModal({ ticketId: ticket.id, ticketCode: ticket.ticketCode })} title="Hủy" className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors"><XCircle size={12} /></button>
                                                </div>
                                            )}
                                            <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors shrink-0" />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Cancel Modal */}
                    {cancelModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setCancelModal(null)}>
                            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-800 shadow-2xl p-6 space-y-4">
                                <h3 className="text-base font-black text-red-600 flex items-center gap-2"><XCircle size={20} /> Hủy đơn hàng {cancelModal.ticketCode}</h3>
                                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Nhập lý do hủy đơn hàng (bắt buộc)..." rows={3} className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30" />
                                <div className="flex gap-2">
                                    <button onClick={() => setCancelModal(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300">Hủy bỏ</button>
                                    <button onClick={handleCancelTicket} disabled={!cancelReason.trim()} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-40 hover:bg-red-600 transition-colors">Xác nhận hủy</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Assign Modal */}
                    {assignModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAssignModal(null)}>
                            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-800 shadow-2xl p-6 space-y-4">
                                <h3 className="text-base font-black text-indigo-600 flex items-center gap-2"><UserCheck size={20} /> Phân công người xử lý</h3>
                                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                                    {DESIGN_HANDLERS.map(name => (
                                        <button key={name} onClick={() => handleAssignHandler(name)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors text-left">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-black">{name.charAt(0)}</div>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Statistics Dashboard */}
                    <DesignTicketStats tickets={myTickets} />
                </div>
            )}

            {/* ===== STEP 2: SELECT ACTION ===== */}
            {step === 'select-action' && currentConfig && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(['edit', 'new'] as const).map((actionKey) => {
                        const act = ACTION_CONFIG[actionKey];
                        const ActIcon = act.icon;
                        return (
                            <button
                                key={actionKey}
                                type="button"
                                onClick={() => handleActionSelect(actionKey)}
                                className="group relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/60 dark:border-white/10 p-6 sm:p-8 text-left transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] hover:border-transparent"
                            >
                                <div className={clsx("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl", currentConfig.glow)} />
                                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />

                                <div className="relative z-10">
                                    <div className={clsx(
                                        "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-xl mb-4 transition-transform duration-300 group-hover:scale-110",
                                        actionKey === 'new' ? currentConfig.gradient : 'from-slate-500 to-slate-700',
                                        actionKey === 'new' ? currentConfig.shadow : 'shadow-slate-500/20'
                                    )}>
                                        <ActIcon size={24} className="text-white" />
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800 dark:text-white mb-1">{act.label}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{act.desc}</p>
                                    <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-violet-500 dark:text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span>Tiếp tục</span> <ChevronRight size={12} />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ===== STEP 3: FILL FORM ===== */}
            {step === 'fill-form' && currentConfig && selectedAction && (
                <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 shadow-2xl">
                    {/* Form header */}
                    <div className={clsx("relative overflow-hidden px-6 py-5 border-b border-slate-200/30 dark:border-white/5 bg-gradient-to-r", currentConfig.gradient)}>
                        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center shadow-lg">
                                {React.createElement(currentConfig.icon, { size: 24, className: 'text-white' })}
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">{currentConfig.label}</h3>
                                <p className="text-xs text-white/70 font-medium">{ACTION_CONFIG[selectedAction].label} — Điền thông tin bên dưới</p>
                            </div>
                        </div>
                    </div>

                    {/* Form body */}
                    <div className="p-6 space-y-4">
                        {(() => {
                            const rendered: React.ReactNode[] = [];
                            let halfBuffer: typeof currentFields = [];
                            const flushHalf = () => {
                                if (halfBuffer.length === 0) return;
                                rendered.push(
                                    <div key={`half-${rendered.length}`} className="grid grid-cols-2 gap-3">
                                        {halfBuffer.map((hf, hi) => (
                                            <div key={hi}>
                                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                    {hf.label} {hf.required && <span className="text-red-400">*</span>}
                                                </label>
                                                <input type="text" value={formValues[hf.label] || ''} onChange={(e) => setFormValues(p => ({ ...p, [hf.label]: e.target.value }))} placeholder={hf.placeholder} className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all shadow-sm" />
                                            </div>
                                        ))}
                                    </div>
                                );
                                halfBuffer = [];
                            };

                            currentFields.forEach((field, i) => {
                                // If halved text, buffer it
                                if (field.half && field.type === 'text') {
                                    halfBuffer.push(field);
                                    if (halfBuffer.length === 2) flushHalf();
                                    return;
                                }
                                flushHalf(); // flush any pending half fields

                                if (field.type === 'section-header') {
                                    rendered.push(
                                        <div key={i} className="pt-4 pb-1 border-t border-slate-200/40 dark:border-white/5 first:border-t-0 first:pt-0">
                                            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                                                {field.label.replace('§ ', '')}
                                            </h4>
                                        </div>
                                    );
                                } else if (field.type === 'checkbox-group') {
                                    rendered.push(
                                        <div key={i}>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">{field.label}</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {field.options?.map(opt => {
                                                    const checked = (formValues[field.label] || '').split('|').includes(opt);
                                                    return (
                                                        <button key={opt} type="button" onClick={() => {
                                                            const cur = (formValues[field.label] || '').split('|').filter(Boolean);
                                                            const next = checked ? cur.filter(c => c !== opt) : [...cur, opt];
                                                            setFormValues(p => ({ ...p, [field.label]: next.join('|') }));
                                                        }} className={clsx("flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all text-left", checked ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/30' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-100')}>
                                                            <div className={clsx("w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all", checked ? 'bg-violet-500 border-violet-500' : 'border-slate-300 dark:border-slate-600')}>
                                                                {checked && <span className="text-white text-[8px] font-black">✓</span>}
                                                            </div>
                                                            {opt}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                } else if (field.type === 'text') {
                                    rendered.push(
                                        <div key={i}>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                {field.label} {field.required && <span className="text-red-400">*</span>}
                                            </label>
                                            <input type="text" value={formValues[field.label] || ''} onChange={(e) => setFormValues(p => ({ ...p, [field.label]: e.target.value }))} placeholder={field.placeholder} className="w-full px-4 py-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all shadow-sm" />
                                        </div>
                                    );
                                } else if (field.type === 'textarea') {
                                    rendered.push(
                                        <div key={i}>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                {field.label} {field.required && <span className="text-red-400">*</span>}
                                            </label>
                                            <textarea value={formValues[field.label] || ''} onChange={(e) => setFormValues(p => ({ ...p, [field.label]: e.target.value }))} placeholder={field.placeholder} rows={3} className="w-full px-4 py-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all shadow-sm resize-none leading-relaxed" />
                                        </div>
                                    );
                                } else if (field.type === 'select') {
                                    rendered.push(
                                        <div key={i}>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                {field.label} {field.required && <span className="text-red-400">*</span>}
                                            </label>
                                            <select value={formValues[field.label] || ''} onChange={(e) => setFormValues(p => ({ ...p, [field.label]: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all shadow-sm cursor-pointer">
                                                <option value="">{field.placeholder}</option>
                                                {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    );
                                }
                            });
                            flushHalf(); // flush remaining half-width fields
                            return rendered;
                        })()}

                        {/* Upload reference images */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                                Hình ảnh tham khảo (tùy chọn)
                            </label>
                            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.ai,.psd,.doc,.docx,.zip,.rar" multiple className="hidden" onChange={e => handleFileUpload(e.target.files)} />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-violet-400', 'bg-violet-50/30'); }}
                                onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('border-violet-400', 'bg-violet-50/30'); }}
                                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-violet-400', 'bg-violet-50/30'); handleFileUpload(e.dataTransfer.files); }}
                                className="flex items-center justify-center w-full h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 hover:border-violet-400 hover:text-violet-500 transition-all cursor-pointer"
                            >
                                {uploading ? (
                                    <div className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /><span className="text-[10px] font-bold">Đang upload...</span></div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1">
                                        <Upload size={20} />
                                        <span className="text-[10px] font-bold">Kéo thả hoặc click để upload</span>
                                    </div>
                                )}
                            </div>
                            {uploadedImages.length > 0 && (
                                <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {uploadedImages.map((img, idx) => (
                                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                            <img src={img.preview || img.url} alt={img.name} className="w-full h-20 object-cover" />
                                            <button type="button" onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black">×</button>
                                            <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-0.5"><span className="text-[8px] text-white font-medium truncate block">{img.name}</span></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200/50 dark:border-red-500/20">
                                <AlertCircle size={16} className="text-red-500 shrink-0" />
                                <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className={clsx(
                                "w-full py-4 rounded-2xl text-white font-black text-sm shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 bg-gradient-to-r",
                                currentConfig.gradient
                            )}
                        >
                            {submitting ? <><Loader2 size={18} className="animate-spin" /> Đang tạo ticket...</> : <><Sparkles size={18} /> Tạo Ticket Đơn Hàng</>}
                        </button>

                        <div className="text-center flex items-center justify-center gap-2 text-[10px] text-slate-400">
                            <Shield size={10} className="text-emerald-500" />
                            <span>Ticket sẽ được lưu trữ an toàn & Admin sẽ phản hồi qua chat</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== STEP 4: TICKET VIEW + CHAT ===== */}
            {step === 'ticket-view' && activeTicket && (() => {
                const catCfg = CATEGORY_CONFIG[activeTicket.category] || CATEGORY_CONFIG['label-bag'];
                const statusCfg = STATUS_CONFIG[activeTicket.status] || STATUS_CONFIG['open'];
                return (
                    <div className="space-y-4">
                        {/* Ticket info card */}
                        <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 shadow-2xl">
                            {/* Header */}
                            <div className={clsx("relative overflow-hidden px-5 py-4 border-b border-slate-200/30 dark:border-white/5 bg-gradient-to-r", catCfg.gradient)}>
                                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                                <div className="relative z-10 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center shadow-lg">
                                            {React.createElement(catCfg.icon, { size: 20, className: 'text-white' })}
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-white font-mono">{activeTicket.ticketCode}</h3>
                                            <p className="text-[10px] text-white/70 font-medium">{catCfg.label} — {ACTION_CONFIG[activeTicket.action]?.label}</p>
                                        </div>
                                    </div>
                                    <span className={clsx("text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg border backdrop-blur-xl", statusCfg.bg, statusCfg.color, statusCfg.border)}>
                                        {statusCfg.label}
                                    </span>
                                </div>
                            </div>

                            {/* Ticket details */}
                            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                                <div>
                                    <span className="text-slate-400 font-medium">Thương hiệu</span>
                                    <p className="font-bold text-slate-800 dark:text-white mt-0.5">{activeTicket.brandName || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-medium">Liên hệ</span>
                                    <p className="font-bold text-slate-800 dark:text-white mt-0.5">{activeTicket.contactName || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-medium">Điện thoại</span>
                                    <p className="font-bold text-slate-800 dark:text-white mt-0.5">{activeTicket.contactPhone || '—'}</p>
                                </div>
                                {activeTicket.revisionRound > 0 && (
                                    <div>
                                        <span className="text-slate-400 font-medium">SXTC</span>
                                        <p className="font-bold text-violet-600 dark:text-violet-400 mt-0.5">Lần {activeTicket.revisionRound}</p>
                                    </div>
                                )}
                                {activeTicket.assignedTo && (
                                    <div>
                                        <span className="text-slate-400 font-medium">Người xử lý</span>
                                        <p className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1"><UserCheck size={12} />{activeTicket.assignedTo}</p>
                                        {activeTicket.assignedBy && <p className="text-[10px] text-slate-400 mt-0.5">Phân công bởi: {activeTicket.assignedBy}</p>}
                                    </div>
                                )}
                                {activeTicket.status === 'cancelled' && activeTicket.cancelReason && (
                                    <div className="col-span-full">
                                        <span className="text-red-400 font-medium">Lý do hủy</span>
                                        <p className="font-bold text-red-600 dark:text-red-400 mt-0.5">{activeTicket.cancelReason}</p>
                                    </div>
                                )}
                                {activeTicket.createdAt && (
                                    <div>
                                        <span className="text-slate-400 font-medium">Ngày tạo</span>
                                        <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{activeTicket.createdAt.toDate().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                )}
                            </div>

                            {/* Admin actions */}
                            {isAdmin && activeTicket.status !== 'cancelled' && activeTicket.status !== 'completed' && (
                                <div className="px-5 pb-4 flex gap-2">
                                    <button onClick={() => setAssignModal({ ticketId: activeTicket.id })} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-200 dark:border-indigo-500/20"><UserCheck size={14} /> Phân công</button>
                                    <button onClick={() => setCancelModal({ ticketId: activeTicket.id, ticketCode: activeTicket.ticketCode })} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 transition-colors border border-red-200 dark:border-red-500/20"><XCircle size={14} /> Hủy đơn</button>
                                </div>
                            )}
                        </div>

                        {/* Chat section */}
                        <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 shadow-2xl">
                            <TicketChat
                                ticketId={activeTicket.id}
                                ticketCode={activeTicket.ticketCode}
                                customerName={activeTicket.contactName || 'Khách hàng'}
                                isAdmin={isAdmin}
                                adminEmail={userEmail}
                                adminName={adminName}
                            />
                        </div>

                        {/* SXTC History (if any) */}
                        {activeTicket.revisionRound > 0 && (
                            <div className="relative overflow-hidden rounded-3xl bg-white/60 dark:bg-slate-800/50 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 shadow-lg p-5">
                                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Clock size={14} className="text-violet-500" /> Lịch sử Sản xuất Thứ cấp (SXTC)
                                </h4>
                                <div className="space-y-2">
                                    {Array.from({ length: activeTicket.revisionRound }, (_, i) => (
                                        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50/50 dark:bg-slate-700/30 border border-slate-200/30 dark:border-white/5">
                                            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-xs font-black text-violet-600 dark:text-violet-400">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">SXTC Lần {i + 1}</p>
                                                <p className="text-[10px] text-slate-400">Phiên chỉnh sửa #{i + 1}</p>
                                            </div>
                                            <span className="text-[10px] font-bold text-emerald-500">✓ Hoàn tất</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
};

export default DesignOrderForm;

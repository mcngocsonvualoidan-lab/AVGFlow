import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Tag, Box, Share2, PenLine, Sparkles, ArrowLeft, Loader2, AlertCircle, Shield, Send, Paperclip, MessageCircle, Clock, Hash, ChevronRight, ChevronLeft, ChevronDown, Upload, Search, Filter, XCircle, X, UserCheck, Calendar, Check, Download, FileText, ExternalLink, Eye, Archive, PlayCircle, RotateCcw, CheckCircle2, ThumbsUp } from 'lucide-react';
import { clsx } from 'clsx';
import { Timestamp } from 'firebase/firestore';
import { supabase } from '../../lib/supabase';
import type { SupabaseDesignTicket, SupabaseTicketMessage } from '../../lib/supabase';
import { uploadFileToR2 } from '../../services/r2UploadService';
import { useAuth } from '../../context/AuthContext';
import { initializeGemini } from '../../lib/gemini';
// Design ticket handlers (only specific staff)
const DESIGN_HANDLERS = ['Nguyễn Ngọc Sơn', 'Hà Ngọc Doanh'];
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
    contactEmail?: string;
    contactAddress?: string;
    formData?: Record<string, string>;
    imageUrls?: string[];
}

interface ChatMessage {
    id: string;
    text: string;
    sender: string;
    senderRole: 'customer' | 'admin';
    senderEmail?: string;
    imageUrl?: string;
    createdAt: Timestamp | string | null;
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
    type: 'text' | 'textarea' | 'select' | 'checkbox-group' | 'section-header' | 'customer-company-dropdown' | 'customer-person-dropdown' | 'brand-dropdown' | 'product-dropdown' | 'date-today' | 'date-picker';
    options?: string[];
    required?: boolean;
    half?: boolean; // render side-by-side
    aiSuggest?: boolean; // Show AI suggestion button
}

// Customer data — type imported from customerService
import { fetchCustomers as fetchCustomerService, subscribeToCustomerChanges, type CustomerContact } from '../../services/customerService';
import { fetchCatalog as fetchCatalogFromService, subscribeToCatalogChanges } from '../../services/catalogService';

const CUSTOMER_INFO_FIELDS: FormField[] = [
    { label: '§ THÔNG TIN KHÁCH HÀNG', placeholder: '', type: 'section-header' },
    { label: 'Tên đơn vị đặt hàng', placeholder: '-- Chọn đơn vị --', type: 'customer-company-dropdown', required: true },
    { label: 'Người đặt hàng', placeholder: '-- Chọn người đặt hàng --', type: 'customer-person-dropdown', required: true, half: true },
    { label: 'Số điện thoại', placeholder: '0xxx xxx xxx', type: 'text', required: true, half: true },
    { label: 'Địa chỉ', placeholder: 'Địa chỉ đơn vị', type: 'text' },
    { label: 'Email', placeholder: 'email@example.com', type: 'text', half: true },
    { label: 'Ngày đặt hàng', placeholder: 'DD/MM/YYYY', type: 'date-today', half: true },
];

const PRODUCT_INFO_FIELDS: FormField[] = [
    { label: '§ THÔNG TIN SẢN PHẨM', placeholder: '', type: 'section-header' },
    { label: 'Tên nhãn hàng', placeholder: '-- Chọn nhãn hàng --', type: 'brand-dropdown', required: true, half: true },
    { label: 'Tên sản phẩm', placeholder: '-- Chọn sản phẩm --', type: 'product-dropdown', required: true, half: true },
    { label: 'Dung tích', placeholder: 'VD: 500ml, 1L...', type: 'text', half: true },
    { label: 'Thời gian cần giao hàng', placeholder: 'Chọn ngày giao hàng', type: 'date-picker', half: true },
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
    { label: 'Hình ảnh / Họa tiết', placeholder: 'Mô tả hình ảnh, họa tiết mong muốn', type: 'textarea', aiSuggest: true },
    { label: 'Thông tin quảng cáo', placeholder: 'Slogan, chương trình KM...', type: 'textarea', aiSuggest: true },
    { label: 'Ý tưởng / Thông tin khác', placeholder: 'Ý tưởng thiết kế, tham khảo, ...', type: 'textarea', aiSuggest: true },
    { label: 'Link tài nguyên thiết kế', placeholder: 'Link file vector, hình ảnh chất lượng cao...', type: 'text' },
];

const FORM_FIELDS: Record<string, FormField[]> = {
    'label-bag-new': [
        ...CUSTOMER_INFO_FIELDS,
        ...PRODUCT_INFO_FIELDS,
        { label: '§ YÊU CẦU THIẾT KẾ', placeholder: '', type: 'section-header' },
        { label: 'Kích thước D*R (mm)', placeholder: 'VD: 80x120 mm', type: 'text', half: true },
        { label: 'Màu sắc', placeholder: 'Số lượng màu, tông chủ đạo...', type: 'text', half: true },
        { label: 'Phong cách thiết kế', placeholder: 'Sang trọng, hiện đại, tối giản, trẻ trung...', type: 'text', aiSuggest: true },
        { label: 'Nội dung chính trên nhãn', placeholder: 'Tên SP, thành phần, công dụng, HDSD, bảo quản, pháp nhân...', type: 'textarea', aiSuggest: true },
        { label: 'Hình ảnh / Họa tiết mong muốn', placeholder: 'Mô tả hình ảnh, logo, icon mong muốn trên nhãn/túi', type: 'textarea', aiSuggest: true },
        { label: 'Thông tin quảng cáo / Slogan', placeholder: 'Slogan, USP, chương trình KM nếu có...', type: 'textarea', aiSuggest: true },
        { label: 'Ý tưởng / Ghi chú thêm', placeholder: 'Ý tưởng thiết kế, link tham khảo, yêu cầu đặc biệt...', type: 'textarea', aiSuggest: true },
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
        { label: 'Yêu cầu in ấn', placeholder: 'Số màu in, vị trí in, chất liệu...', type: 'textarea', aiSuggest: true },
        { label: 'Ý tưởng thiết kế', placeholder: 'Concept, tham khảo mẫu...', type: 'textarea', aiSuggest: true },
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
        { label: 'Nội dung bài viết / Caption', placeholder: 'Nội dung chính, thông điệp muốn truyền tải...', type: 'textarea', aiSuggest: true },
        { label: 'Phong cách / Tông màu', placeholder: 'Sang trọng, năng động, tối giản...', type: 'text', aiSuggest: true },
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
    const [chatError, setChatError] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewImg, setPreviewImg] = useState<string | null>(null);

    const senderRole = isAdmin ? 'admin' : 'customer';
    const displayName = isAdmin ? 'Admin' : customerName;

    // ── Supabase Realtime subscription for messages ──
    useEffect(() => {
        // Load existing messages
        const loadMessages = async () => {
            try {
                const { data, error } = await supabase
                    .from('ticket_messages')
                    .select('*')
                    .eq('ticket_id', ticketId)
                    .order('created_at', { ascending: true });
                if (error) throw error;
                if (data) {
                    setMessages(data.map((m: SupabaseTicketMessage) => ({
                        id: m.id,
                        text: m.text,
                        sender: m.sender,
                        senderRole: m.sender_role,
                        senderEmail: m.sender_email || undefined,
                        imageUrl: m.image_url || undefined,
                        createdAt: m.created_at,
                    })));
                    setChatError('');
                }
            } catch (err: any) {
                console.error('[Chat] Load failed:', err);
                setChatError('⚠️ Không thể tải tin nhắn. Vui lòng tải lại trang.');
            }
        };
        loadMessages();

        // Realtime subscription for new messages
        const channel = supabase
            .channel(`messages-${ticketId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'ticket_messages',
                filter: `ticket_id=eq.${ticketId}`,
            }, (payload) => {
                const m = payload.new as SupabaseTicketMessage;
                const newMsg: ChatMessage = {
                    id: m.id,
                    text: m.text,
                    sender: m.sender,
                    senderRole: m.sender_role,
                    senderEmail: m.sender_email || undefined,
                    imageUrl: m.image_url || undefined,
                    createdAt: m.created_at,
                };
                setMessages(prev => {
                    // Skip if already in list (duplicate event)
                    if (prev.some(p => p.id === m.id)) return prev;
                    // Find and replace the matching optimistic message (same text + same role)
                    const localIdx = prev.findIndex(p => p.id.startsWith('local_') && p.text === m.text && p.senderRole === m.sender_role);
                    if (localIdx !== -1) {
                        const updated = [...prev];
                        updated[localIdx] = newMsg;
                        return updated;
                    }
                    // New message from other side - just append
                    return [...prev, newMsg];
                });
                setChatError('');
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [ticketId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Send message via Supabase ──
    const handleSend = useCallback(async () => {
        if (!newMessage.trim() || sending) return;
        setSending(true);
        setChatError('');
        const msgText = newMessage.trim();
        // Optimistic local message
        const optimisticMsg: ChatMessage = {
            id: `local_${Date.now()}`,
            text: msgText,
            sender: displayName,
            senderRole,
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');
        try {
            const { error } = await supabase.from('ticket_messages').insert({
                ticket_id: ticketId,
                text: msgText,
                sender: isAdmin ? 'Admin' : displayName,
                sender_role: senderRole,
                sender_email: isAdmin ? adminEmail : null,
            });
            if (error) throw error;
        } catch (e: any) {
            console.error('[Chat] Send failed:', e);
            setChatError('⚠️ Gửi tin nhắn thất bại. Vui lòng thử lại.');
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            setNewMessage(msgText);
        } finally { setSending(false); }
    }, [newMessage, ticketId, sending, displayName, senderRole, isAdmin, adminEmail]);

    // ── Paste image via Supabase ──
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
                    const { error } = await supabase.from('ticket_messages').insert({
                        ticket_id: ticketId,
                        text: '📷 Hình ảnh',
                        sender: isAdmin ? 'Admin' : displayName,
                        sender_role: senderRole,
                        sender_email: isAdmin ? adminEmail : null,
                        image_url: result.url,
                    });
                    if (error) throw error;
                } catch (err: any) {
                    console.error('[Chat] Paste image failed:', err);
                    setChatError(`⚠️ Gửi hình ảnh thất bại: ${err.message || 'Lỗi không xác định'}`);
                } finally { setSending(false); }
                break;
            }
        }
    }, [ticketId, displayName, senderRole, isAdmin, adminEmail]);

    // ── File upload via Supabase ──
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSending(true);
        try {
            const result = await uploadFileToR2(file, 'design_ticket_chat');
            const label = file.type.startsWith('image/') ? `📷 ${file.name}` : `📎 ${file.name}`;
            const { error } = await supabase.from('ticket_messages').insert({
                ticket_id: ticketId,
                text: label,
                sender: isAdmin ? 'Admin' : displayName,
                sender_role: senderRole,
                sender_email: isAdmin ? adminEmail : null,
                image_url: result.url,
            });
            if (error) throw error;
        } catch (err: any) {
            console.error('[Chat] File upload failed:', err);
            setChatError(`⚠️ Gửi file thất bại: ${err.message || 'Lỗi không xác định'}`);
        } finally { setSending(false); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [ticketId, displayName, senderRole, isAdmin, adminEmail]);

    const formatTime = (ts: Timestamp | string | null) => {
        if (!ts) return '';
        const d = typeof ts === 'string' ? new Date(ts) : ts.toDate();
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' • ' + d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    return (
        <>
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

            {/* Chat error banner */}
            {chatError && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200/50 dark:border-amber-500/20">
                    <AlertCircle size={12} className="text-amber-500 shrink-0" />
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex-1">{chatError}</span>
                    <button onClick={() => { setChatError(''); window.location.reload(); }} className="text-[9px] font-bold text-amber-600 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 transition-colors shrink-0">↻</button>
                </div>
            )}

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
                    // Admin view: show real admin name; Customer view: always show "Admin"
                    const showName = isCustomer ? msg.sender : (isAdmin ? internalAdminName : 'Admin');
                    // isMe = my own messages go RIGHT
                    const isMe = isAdmin ? !isCustomer : isCustomer;
                    return (
                        <div key={msg.id} className={clsx("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                            <div className={clsx(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black shadow-sm",
                                isMe
                                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                                    : "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
                            )}>
                                {showName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className={clsx(
                                "max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm",
                                isMe
                                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-tr-md"
                                    : "bg-white/80 dark:bg-slate-700/80 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 text-slate-800 dark:text-slate-200 rounded-tl-md"
                            )}>
                                <p className={clsx("text-[10px] font-bold mb-1", isMe ? "text-white/70 text-right" : "text-slate-400 dark:text-slate-500")}>
                                    {showName}
                                    {isAdmin && !isCustomer && msg.senderEmail && (
                                        <span className="ml-1.5 text-[8px] font-medium opacity-50">(nội bộ)</span>
                                    )}
                                </p>
                                {msg.imageUrl && msg.text?.startsWith('📷') && (
                                    <img src={msg.imageUrl} alt="Uploaded" className="rounded-xl max-w-full max-h-48 object-cover mb-2 border border-white/20 cursor-pointer hover:opacity-90 transition-opacity" onClick={(e) => { e.stopPropagation(); setPreviewImg(msg.imageUrl!); }} />
                                )}
                                {msg.imageUrl && msg.text?.startsWith('📎') && (
                                    <div 
                                        onClick={() => window.open(msg.imageUrl, '_blank')}
                                        className="flex items-center gap-2 p-3 mb-2 rounded-xl bg-slate-900/10 dark:bg-black/20 border border-slate-200/50 dark:border-white/10 cursor-pointer hover:bg-slate-900/20 dark:hover:bg-black/40 transition-colors"
                                    >
                                        <Paperclip size={18} className="text-violet-500 shrink-0" />
                                        <span className="text-sm font-medium truncate flex-1 leading-none">{msg.text.replace('📎 ', '')}</span>
                                        <Download size={14} className="text-slate-400 shrink-0" />
                                    </div>
                                )}
                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.text.startsWith('📷 ') || msg.text.startsWith('📎 ') ? '' : msg.text}</p>
                                <p className={clsx("text-[9px] mt-1.5", isMe ? "text-white/50 text-right" : "text-slate-300 dark:text-slate-600")}>
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
                    <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
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

            {/* Image Lightbox */}
            {previewImg && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setPreviewImg(null)}>
                    <button onClick={() => setPreviewImg(null)} className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all z-10">
                        <X size={20} />
                    </button>
                    <img src={previewImg} alt="Preview" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </>
    );
};

// ============================================================
// CUSTOM SEARCHABLE DROPDOWN COMPONENT
// ============================================================
interface SearchableDropdownProps {
    value: string;
    onChange: (val: string) => void;
    options: string[];
    placeholder: string;
    loading?: boolean;
    isHalf?: boolean;
}
const SearchableDropdown: React.FC<SearchableDropdownProps> = ({ value, onChange, options, placeholder, loading, isHalf }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        if (!search.trim()) return options;
        const q = search.toLowerCase();
        return options.filter(o => o.toLowerCase().includes(q));
    }, [options, search]);

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectItem = (item: string) => {
        onChange(item);
        setIsOpen(false);
        setSearch('');
    };

    const baseCls = isHalf
        ? 'w-full px-3 py-2.5 rounded-xl'
        : 'w-full px-4 py-3 rounded-2xl';

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    baseCls,
                    'backdrop-blur-xl border text-sm text-left transition-all shadow-sm flex items-center justify-between gap-2 group',
                    isOpen
                        ? 'border-violet-400 dark:border-violet-500/50 ring-2 ring-violet-500/20 bg-white/60 dark:bg-slate-900/60'
                        : value
                            ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-300/60 dark:border-emerald-500/20'
                            : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/30',
                    value ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'
                )}
            >
                <span className="truncate flex-1">
                    {loading ? 'Đang tải...' : (value || placeholder)}
                </span>
                <ChevronDown
                    size={14}
                    className={clsx(
                        'shrink-0 transition-transform duration-200 text-slate-400',
                        isOpen && 'rotate-180 text-violet-500'
                    )}
                />
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-2xl border border-slate-200/60 dark:border-white/15 rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/30 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Search input */}
                    <div className="p-2.5 border-b border-slate-100 dark:border-white/5">
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Tìm kiếm..."
                                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/40 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400/30 transition-all"
                            />
                        </div>
                    </div>
                    {/* Options list */}
                    <div className="max-h-52 overflow-y-auto overscroll-contain py-1 custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-slate-400">
                                Không tìm thấy kết quả
                            </div>
                        ) : (
                            filtered.map((item) => {
                                const isSelected = value === item;
                                return (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => selectItem(item)}
                                        className={clsx(
                                            'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-all duration-150',
                                            isSelected
                                                ? 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 font-semibold'
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                        )}
                                    >
                                        <span className={clsx(
                                            'w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all',
                                            isSelected
                                                ? 'bg-violet-500 border-violet-500'
                                                : 'border-slate-200 dark:border-slate-600'
                                        )}>
                                            {isSelected && <Check size={10} className="text-white" />}
                                        </span>
                                        <span className="truncate">{item}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                    {/* Clear selection */}
                    {value && (
                        <div className="border-t border-slate-100 dark:border-white/5 p-1.5">
                            <button
                                type="button"
                                onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                                className="w-full py-2 rounded-xl text-xs font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                            >
                                Xóa lựa chọn
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================
// CUSTOM CALENDAR DATE PICKER COMPONENT
// ============================================================
const VIET_MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const VIET_DAYS = ['T2','T3','T4','T5','T6','T7','CN'];

interface DatePickerFieldProps {
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    isHalf?: boolean;
    readOnly?: boolean;
}
const DatePickerField: React.FC<DatePickerFieldProps> = ({ value, onChange, placeholder, isHalf, readOnly }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const calendarRef = useRef<HTMLDivElement>(null);

    // Parse value DD/MM/YYYY
    const parseDMY = (s: string) => {
        const p = s.split('/');
        if (p.length !== 3) return null;
        return { d: parseInt(p[0]), m: parseInt(p[1]) - 1, y: parseInt(p[2]) };
    };
    const formatDMY = (d: number, m: number, y: number) =>
        `${String(d).padStart(2,'0')}/${String(m + 1).padStart(2,'0')}/${y}`;

    const parsed = parseDMY(value);
    const today = new Date();
    const todayD = today.getDate(), todayM = today.getMonth(), todayY = today.getFullYear();

    // Calendar view month
    const [viewMonth, setViewMonth] = useState(parsed ? parsed.m : todayM);
    const [viewYear, setViewYear] = useState(parsed ? parsed.y : todayY);

    // Sync view to value when opened
    useEffect(() => {
        if (isOpen && parsed) {
            setViewMonth(parsed.m);
            setViewYear(parsed.y);
        } else if (isOpen) {
            setViewMonth(todayM);
            setViewYear(todayY);
        }
    }, [isOpen]);

    // Click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1);
        const lastDay = new Date(viewYear, viewMonth + 1, 0);
        const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
        const daysInMonth = lastDay.getDate();
        const prevMonthLast = new Date(viewYear, viewMonth, 0).getDate();

        const cells: { day: number; month: number; year: number; isCurrentMonth: boolean; isToday: boolean; isPast: boolean }[] = [];

        // Previous month trailing days
        for (let i = startDow - 1; i >= 0; i--) {
            const d = prevMonthLast - i;
            const m = viewMonth === 0 ? 11 : viewMonth - 1;
            const y = viewMonth === 0 ? viewYear - 1 : viewYear;
            const dt = new Date(y, m, d);
            cells.push({ day: d, month: m, year: y, isCurrentMonth: false, isToday: false, isPast: dt < new Date(todayY, todayM, todayD) });
        }

        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(viewYear, viewMonth, d);
            cells.push({
                day: d, month: viewMonth, year: viewYear, isCurrentMonth: true,
                isToday: d === todayD && viewMonth === todayM && viewYear === todayY,
                isPast: dt < new Date(todayY, todayM, todayD),
            });
        }

        // Next month leading days
        const remaining = 42 - cells.length;
        for (let d = 1; d <= remaining; d++) {
            const m = viewMonth === 11 ? 0 : viewMonth + 1;
            const y = viewMonth === 11 ? viewYear + 1 : viewYear;
            cells.push({ day: d, month: m, year: y, isCurrentMonth: false, isToday: false, isPast: false });
        }

        return cells;
    }, [viewMonth, viewYear, todayD, todayM, todayY]);

    const goPrev = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const goNext = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const selectDate = (cell: typeof calendarDays[0]) => {
        if (!readOnly && cell.isPast) return;
        onChange(formatDMY(cell.day, cell.month, cell.year));
        setIsOpen(false);
    };

    const selectToday = () => {
        onChange(formatDMY(todayD, todayM, todayY));
        setIsOpen(false);
    };

    // Display text
    const displayText = parsed
        ? `${String(parsed.d).padStart(2,'0')} ${VIET_MONTHS[parsed.m]}, ${parsed.y}`
        : '';

    const baseCls = isHalf
        ? 'w-full px-3 py-2.5 rounded-xl'
        : 'w-full px-4 py-3 rounded-2xl';

    // For readOnly (date-today), show simpler non-interactive input
    if (readOnly) {
        return (
            <div className="relative group">
                <div className={clsx(
                    baseCls,
                    'bg-violet-50/40 dark:bg-violet-500/5 backdrop-blur-xl border border-violet-200/60 dark:border-violet-500/20 text-sm font-semibold text-violet-700 dark:text-violet-300 cursor-default flex items-center justify-between shadow-sm'
                )}>
                    <span>{displayText || value}</span>
                    <Calendar size={14} className="text-violet-400 shrink-0" />
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    baseCls,
                    'backdrop-blur-xl border text-sm text-left transition-all shadow-sm flex items-center justify-between gap-2',
                    isOpen
                        ? 'border-violet-400 dark:border-violet-500/50 ring-2 ring-violet-500/20 bg-white/60 dark:bg-slate-900/60'
                        : value
                            ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-300/60 dark:border-emerald-500/20'
                            : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/30',
                    value ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'
                )}
            >
                <span className="truncate flex-1">
                    {displayText || placeholder}
                </span>
                <Calendar
                    size={14}
                    className={clsx(
                        'shrink-0 transition-colors',
                        isOpen ? 'text-violet-500' : 'text-slate-400'
                    )}
                />
            </button>

            {/* Calendar popup */}
            {isOpen && (
                <div
                    ref={calendarRef}
                    className="absolute z-50 left-0 mt-1.5 w-[300px] bg-white/95 dark:bg-slate-800/95 backdrop-blur-2xl border border-slate-200/60 dark:border-white/15 rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/30 overflow-hidden"
                    style={{ animation: 'fadeSlideIn 0.2s ease-out' }}
                >
                    {/* Header — Month/Year Navigation */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <button
                            type="button"
                            onClick={goPrev}
                            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-500 dark:text-slate-400 transition-all active:scale-90"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 select-none">
                            {VIET_MONTHS[viewMonth]} {viewYear}
                        </div>
                        <button
                            type="button"
                            onClick={goNext}
                            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-500 dark:text-slate-400 transition-all active:scale-90"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Day names header */}
                    <div className="grid grid-cols-7 px-3 pb-1">
                        {VIET_DAYS.map(d => (
                            <div key={d} className="text-center text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-0.5 px-3 pb-3">
                        {calendarDays.map((cell, idx) => {
                            const isSelected = parsed && cell.day === parsed.d && cell.month === parsed.m && cell.year === parsed.y;
                            const disabled = !readOnly && cell.isPast && cell.isCurrentMonth;
                            const isPastOther = !readOnly && cell.isPast && !cell.isCurrentMonth;

                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    disabled={disabled || isPastOther}
                                    onClick={() => selectDate(cell)}
                                    className={clsx(
                                        'relative w-full aspect-square rounded-xl flex items-center justify-center text-xs font-semibold transition-all duration-150',
                                        // Selected
                                        isSelected && 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 scale-105',
                                        // Today (not selected)
                                        !isSelected && cell.isToday && 'ring-2 ring-violet-400/50 text-violet-600 dark:text-violet-400 font-black',
                                        // Normal current month
                                        !isSelected && !cell.isToday && cell.isCurrentMonth && !disabled && 'text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 active:scale-90',
                                        // Other month
                                        !cell.isCurrentMonth && 'text-slate-300 dark:text-slate-600',
                                        // Disabled (past)
                                        (disabled || isPastOther) && 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40',
                                    )}
                                >
                                    {cell.day}
                                    {/* Today dot indicator */}
                                    {cell.isToday && !isSelected && (
                                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-500" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer actions */}
                    <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30">
                        <button
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                        >
                            Xóa
                        </button>
                        <button
                            type="button"
                            onClick={selectToday}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all flex items-center gap-1"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                            Hôm nay
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// FORMAT TODAY'S DATE AS DD/MM/YYYY
// ============================================================
function getTodayDDMMYYYY(): string {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

// ============================================================
// MAIN COMPONENT
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
    const { currentUser } = useAuth();
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

    // File viewer modal
    const [viewingFile, setViewingFile] = useState<{url: string, name: string} | null>(null);

    // AI Suggestion state
    const [aiLoadingField, setAiLoadingField] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<{ field: string; text: string } | null>(null);

    const handleAiSuggest = useCallback(async (fieldLabel: string) => {
        if (aiLoadingField) return;
        setAiLoadingField(fieldLabel);
        setAiSuggestion(null);
        try {
            const model = await initializeGemini();
            if (!model) {
                setError('Chưa cấu hình Gemini API Key. Liên hệ Admin.');
                setAiLoadingField(null);
                return;
            }

            // Build context from filled form values
            const brandName = formValues['Tên nhãn hàng'] || formValues['Tên nhãn hàng / Fanpage'] || formValues['Tên đơn vị đặt hàng'] || '';
            const productName = formValues['Tên sản phẩm'] || '';
            const volume = formValues['Dung tích'] || '';
            const categoryLabel = selectedCategory ? CATEGORY_CONFIG[selectedCategory].label : '';
            const existingContent = formValues[fieldLabel] || '';
            const designStyle = formValues['Phong cách thiết kế'] || formValues['Phong cách / Tông màu'] || '';

            const contextParts = [
                brandName && `Nhãn hàng: ${brandName}`,
                productName && `Sản phẩm: ${productName}`,
                volume && `Dung tích: ${volume}`,
                categoryLabel && `Loại thiết kế: ${categoryLabel}`,
                designStyle && fieldLabel !== 'Phong cách thiết kế' && `Phong cách: ${designStyle}`,
                existingContent && `Nội dung hiện tại: ${existingContent}`,
            ].filter(Boolean).join('\n');

            const prompt = `Bạn là chuyên gia thiết kế bao bì và nhãn sản phẩm tại Việt Nam. Dựa trên thông tin sản phẩm dưới đây, hãy gợi ý nội dung cho trường "${fieldLabel}".

Thông tin sản phẩm:
${contextParts || '(Chưa có thông tin sản phẩm)'}

Yêu cầu:
- Viết bằng tiếng Việt
- Ngắn gọn, chuyên nghiệp, phù hợp ngành mỹ phẩm / hóa chất / thực phẩm
- Chỉ trả về nội dung gợi ý, KHÔNG giải thích thêm
- Nếu trường là "Phong cách thiết kế": gợi ý 3-4 keyword phong cách (VD: Sang trọng, hiện đại, tối giản với tông vàng gold)
- Nếu trường là "Nội dung chính trên nhãn": liệt kê các mục cần có trên nhãn
- Nếu trường là "Hình ảnh / Họa tiết": mô tả hình ảnh, icon phù hợp
- Nếu trường là "Thông tin quảng cáo / Slogan": đề xuất 2-3 slogan
- Nếu trường là "Ý tưởng": gợi ý concept thiết kế
- Nếu trường là "Nội dung bài viết / Caption": viết caption social media
- Giữ độ dài phù hợp (2-5 dòng)`;

            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();

            if (text) {
                setAiSuggestion({ field: fieldLabel, text });
            }
        } catch (err: any) {
            console.error('AI suggest error:', err);
            setError('Không thể tạo gợi ý AI. Thử lại sau.');
        } finally {
            setAiLoadingField(null);
        }
    }, [aiLoadingField, formValues, selectedCategory]);

    const acceptAiSuggestion = useCallback(() => {
        if (!aiSuggestion) return;
        const existing = formValues[aiSuggestion.field] || '';
        const newValue = existing ? `${existing}\n${aiSuggestion.text}` : aiSuggestion.text;
        setFormValues(p => ({ ...p, [aiSuggestion.field]: newValue }));
        setAiSuggestion(null);
    }, [aiSuggestion, formValues]);

    const dismissAiSuggestion = useCallback(() => {
        setAiSuggestion(null);
    }, []);

    // 🛡️ Customer data from Supabase (via service)
    const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([]);
    const [customerLoading, setCustomerLoading] = useState(false);
    useEffect(() => {
        const loadCustomers = async () => {
            setCustomerLoading(true);
            try {
                const contacts = await fetchCustomerService();
                setCustomerContacts(contacts);
                console.log(`[CustomerData] ✅ Loaded ${contacts.length} contacts`);
            } catch (err) {
                console.error('[CustomerData] ❌ Failed to load:', err);
            } finally {
                setCustomerLoading(false);
            }
        };
        loadCustomers();
        const unsubscribe = subscribeToCustomerChanges(() => loadCustomers());
        return () => unsubscribe();
    }, []);

    // Derived customer data — independent lists
    const companyList = useMemo(() => [...new Set(customerContacts.map(c => c.company))].filter(Boolean), [customerContacts]);
    // Person list shows ALL contacts (independent of selected company)
    const allContactNames = useMemo(() => customerContacts.map(c => c.name).filter(Boolean), [customerContacts]);

    // Auto-fill when person is selected (also fills company automatically)
    const handlePersonSelect = useCallback((personName: string) => {
        const contact = customerContacts.find(c => c.name === personName);
        if (contact) {
            setFormValues(p => ({
                ...p,
                'Người đặt hàng': personName,
                'Tên đơn vị đặt hàng': contact.company || p['Tên đơn vị đặt hàng'] || '',
                'Số điện thoại': contact.phone,
                'Địa chỉ': contact.address,
                'Email': contact.email,
            }));
        } else {
            setFormValues(p => ({ ...p, 'Người đặt hàng': personName }));
        }
    }, [customerContacts]);

    // Auto-fill \"Ngày đặt hàng\" with today's date when entering form
    useEffect(() => {
        if (step === 'fill-form' && !formValues['Ngày đặt hàng']) {
            setFormValues(p => ({ ...p, 'Ngày đặt hàng': getTodayDDMMYYYY() }));
        }
    }, [step]);

    // ============================================================
    // PRODUCT CATALOG from Google Sheet (Brand → Product mapping)
    // 🛡️ Product catalog from Supabase (via service)
    interface ProductCatalogItem { brand: string; productName: string; }
    const [catalogItems, setCatalogItems] = useState<ProductCatalogItem[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    useEffect(() => {
        const loadCatalog = async () => {
            setCatalogLoading(true);
            try {
                const items = await fetchCatalogFromService();
                const mapped: ProductCatalogItem[] = items
                    .filter(it => it.nhanHang && it.tenSanPham)
                    .map(it => ({ brand: it.nhanHang, productName: it.tenSanPham }));
                setCatalogItems(mapped);
                console.log(`[ProductCatalog] ✅ Loaded ${mapped.length} products`);
            } catch (err) {
                console.error('[ProductCatalog] ❌ Failed to load:', err);
            } finally {
                setCatalogLoading(false);
            }
        };
        loadCatalog();
        const unsubscribe = subscribeToCatalogChanges(() => loadCatalog());
        return () => unsubscribe();
    }, []);

    // Unique brand list from catalog
    const catalogBrands = useMemo(() => {
        const set = new Set(catalogItems.map(it => it.brand));
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
    }, [catalogItems]);

    // Products filtered by selected brand
    const catalogProducts = useMemo(() => {
        const selectedBrand = formValues['Tên nhãn hàng'] || '';
        if (!selectedBrand) return catalogItems.map(it => it.productName);
        return catalogItems
            .filter(it => it.brand.toLowerCase() === selectedBrand.toLowerCase())
            .map(it => it.productName);
    }, [catalogItems, formValues]);

    // When brand changes, clear product if it doesn't belong to that brand
    const handleBrandSelect = useCallback((brand: string) => {
        setFormValues(p => {
            const currentProduct = p['Tên sản phẩm'] || '';
            const productBelongs = catalogItems.some(
                it => it.brand.toLowerCase() === brand.toLowerCase() && it.productName === currentProduct
            );
            return {
                ...p,
                'Tên nhãn hàng': brand,
                ...(productBelongs ? {} : { 'Tên sản phẩm': '' }),
            };
        });
    }, [catalogItems]);

    // Image upload state
    const [uploadedImages, setUploadedImages] = useState<{ name: string; url: string; preview: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Admin check
    const userEmail = currentUser?.email || '';
    const isAdmin = ADMIN_EMAILS.includes(userEmail);
    const adminName = ADMIN_NAMES[userEmail] || currentUser?.displayName || 'Admin';

    // Load tickets from Supabase (with realtime subscription)
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [ticketsError, setTicketsError] = useState('');
    const [ticketsFromCache, setTicketsFromCache] = useState(false);
    useEffect(() => {
        setTicketsLoading(true);
        setTicketsError('');
        // Initial load
        const loadTickets = async () => {
            try {
                let query = supabase
                    .from('design_tickets')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (!isAdmin && userEmail) {
                    query = query.eq('contact_email', userEmail);
                }

                const { data, error } = await query;
                if (error) throw error;
                if (data) {
                    setMyTickets(data.map((t: SupabaseDesignTicket) => ({
                        id: t.id,
                        ticketCode: t.ticket_code,
                        category: t.category,
                        action: t.action,
                        brandName: t.brand_name,
                        contactName: t.contact_name,
                        contactPhone: t.contact_phone,
                        contactEmail: t.contact_email,
                        contactAddress: t.contact_address,
                        formData: t.form_data,
                        imageUrls: t.image_urls || [],
                        description: t.description,
                        status: t.status,
                        revisionRound: t.revision_round,
                        assignedTo: t.assigned_to,
                        cancelReason: t.cancel_reason,
                        createdAt: t.created_at,
                        updatedAt: t.updated_at,
                        completedAt: t.completed_at,
                    } as any)));
                    setTicketsFromCache(false);
                }
                setTicketsLoading(false);
                setTicketsError('');
            } catch (err: any) {
                console.error('[Supabase] Ticket load error:', err);
                setTicketsLoading(false);
                setTicketsError(`Lỗi tải dữ liệu: ${err.message}`);
            }
        };
        loadTickets();

        // Realtime subscription for ticket changes
        const channel = supabase
            .channel('tickets-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'design_tickets',
            }, () => {
                // Reload all tickets on any change
                loadTickets();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
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

    // Cancel ticket (Supabase)
    const handleCancelTicket = async () => {
        if (!cancelModal || !cancelReason.trim()) return;
        try {
            await supabase.from('design_tickets').update({
                status: 'cancelled',
                cancel_reason: cancelReason.trim(),
            }).eq('id', cancelModal.ticketId);
            await supabase.from('ticket_messages').insert({
                ticket_id: cancelModal.ticketId,
                text: `❌ Đơn hàng ${cancelModal.ticketCode} đã bị hủy.\nLý do: ${cancelReason.trim()}`,
                sender: 'Hệ thống',
                sender_role: 'admin',
            });
            setCancelModal(null);
            setCancelReason('');
            if (activeTicket?.id === cancelModal.ticketId) {
                setActiveTicket(prev => prev ? { ...prev, status: 'cancelled', cancelReason: cancelReason.trim() } : null);
            }
        } catch (e) { console.error(e); }
    };

    // Assign handler (Supabase)
    const handleAssignHandler = async (handlerName: string) => {
        if (!assignModal) return;
        try {
            await supabase.from('design_tickets').update({
                assigned_to: handlerName,
            }).eq('id', assignModal.ticketId);
            await supabase.from('ticket_messages').insert({
                ticket_id: assignModal.ticketId,
                text: `👤 Người xử lý đã được phân công: ${handlerName}\nPhân công bởi: ${adminName}`,
                sender: 'Hệ thống',
                sender_role: 'admin',
            });
            setAssignModal(null);
        } catch (e) { console.error(e); }
    };

    // Update ticket status (generic handler)
    const [statusUpdating, setStatusUpdating] = useState(false);
    const handleUpdateStatus = async (ticketId: string, ticketCode: string, newStatus: string, extraMessage?: string) => {
        if (statusUpdating) return;
        setStatusUpdating(true);
        try {
            const updateData: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
            // Increment revision_round when going to revision
            if (newStatus === 'revision') {
                const currentTicket = myTickets.find(t => t.id === ticketId);
                updateData.revision_round = (currentTicket?.revisionRound || 0) + 1;
            }
            if (newStatus === 'completed') {
                updateData.completed_at = new Date().toISOString();
            }
            await supabase.from('design_tickets').update(updateData).eq('id', ticketId);

            // Status emoji/label map
            const statusEmojis: Record<string, string> = {
                'in-review': '🔍 Đang duyệt',
                'revision': '🔄 Yêu cầu SXTC (Chỉnh sửa)',
                'approved': '✅ Đã chốt sản phẩm',
                'completed': '🎉 Hoàn tất đơn hàng',
            };
            const label = statusEmojis[newStatus] || newStatus;
            const senderRole = isAdmin ? 'admin' : 'customer';
            const senderName = isAdmin ? 'Admin' : (activeTicket?.contactName || 'Khách hàng');
            await supabase.from('ticket_messages').insert({
                ticket_id: ticketId,
                text: `${label}\n${extraMessage || `Trạng thái đơn hàng ${ticketCode} đã được cập nhật.`}`,
                sender: senderName,
                sender_role: senderRole,
            });

            // Update local state
            if (activeTicket?.id === ticketId) {
                setActiveTicket(prev => prev ? {
                    ...prev,
                    status: newStatus as any,
                    ...(newStatus === 'revision' ? { revisionRound: (prev.revisionRound || 0) + 1 } : {}),
                } : null);
            }
        } catch (e) {
            console.error('[UpdateStatus] Error:', e);
        } finally {
            setStatusUpdating(false);
        }
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
        else if (step === 'fill-form') setStep('select-category');
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

        const SHEET_WEBHOOK = 'https://script.google.com/macros/s/AKfycbzLlTLxa9hqObNmS4sbYNjAqAvMd68zeqpN6UJKGlM9pblH_K-fivpRyjW9Mf53rqloIQ/exec';

        try {
            const ticketCode = generateTicketCode(selectedCategory);
            // Extract all form data (excluding section headers)
            const formData: Record<string, string> = {};
            fields.forEach(f => {
                if (f.type !== 'section-header') {
                    formData[f.label] = formValues[f.label] || '';
                }
            });
            const now = new Date().toISOString();
            const ticketData = {
                ticketCode,
                category: selectedCategory,
                action: selectedAction,
                brandName: formValues['Tên nhãn hàng'] || formValues['Tên đơn vị đặt hàng'] || formValues['Tên nhãn hàng / Fanpage'] || '',
                contactName: formValues['Người đặt hàng'] || '',
                contactPhone: formValues['Số điện thoại'] || '',
                contactEmail: !isAdmin && userEmail ? userEmail : (formValues['Email'] || ''),
                contactAddress: formValues['Địa chỉ'] || '',
                formData,
                imageUrls: uploadedImages.map(img => img.url),
                description: Object.entries(formData).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n'),
                status: 'open' as const,
                revisionRound: 0,
                completedAt: null,
            };

            // =============================================
            // STEP 1: Write to Google Sheet (PRIMARY — always reliable)
            // =============================================
            try {
                await fetch(SHEET_WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticketCode,
                        category: selectedCategory,
                        action: selectedAction,
                        brandName: ticketData.brandName,
                        contactName: ticketData.contactName,
                        contactPhone: ticketData.contactPhone,
                        contactEmail: ticketData.contactEmail,
                        contactAddress: ticketData.contactAddress,
                        description: ticketData.description,
                        imageUrls: ticketData.imageUrls.join(', '),
                        status: 'open',
                        createdAt: now,
                        ...formData,
                    }),
                    mode: 'no-cors', // Apps Script requires no-cors from browser
                });
                // no-cors = opaque response, but request IS sent successfully
                console.log(`[Sheet] ✅ Ticket ${ticketCode} sent to Google Sheet`);
            } catch (sheetErr) {
                console.warn('[Sheet] ⚠️ Sheet webhook failed:', sheetErr);
                // Continue — Firestore might still work
            }

            // =============================================
            // STEP 2: Write to Supabase (PRIMARY database)
            // =============================================
            let supabaseId = '';
            try {
                const { data: insertedRow, error: supaErr } = await supabase
                    .from('design_tickets')
                    .insert({
                        ticket_code: ticketCode,
                        category: selectedCategory,
                        action: selectedAction,
                        brand_name: ticketData.brandName,
                        contact_name: ticketData.contactName,
                        contact_phone: ticketData.contactPhone,
                        contact_email: ticketData.contactEmail,
                        contact_address: ticketData.contactAddress,
                        form_data: formData,
                        image_urls: ticketData.imageUrls,
                        description: ticketData.description,
                        status: 'open',
                    })
                    .select('id')
                    .single();
                if (supaErr) throw supaErr;
                supabaseId = insertedRow.id;
                console.log(`[Supabase] ✅ Ticket saved: ${supabaseId}`);

                // Welcome message
                supabase.from('ticket_messages').insert({
                    ticket_id: supabaseId,
                    text: `🎉 Ticket ${ticketCode} đã được tạo thành công!\n\nLoại: ${CATEGORY_CONFIG[selectedCategory].label} — ${ACTION_CONFIG[selectedAction].label}\nThương hiệu: ${ticketData.brandName}\n\nAdmin sẽ liên hệ bạn sớm nhất qua chat này. Hãy theo dõi ticket để cập nhật tiến độ!`,
                    sender: 'Hệ thống',
                    sender_role: 'admin',
                }).then(); // fire-and-forget
            } catch (supaErr: any) {
                console.error(`[Supabase] ❌ Insert failed:`, supaErr);
                throw new Error('Không thể lưu ticket. Vui lòng thử lại.');
            }

            // =============================================
            // STEP 3: Show success
            // =============================================
            const createdTicket: DesignTicket = {
                id: supabaseId,
                ...ticketData,
                createdAt: now as any,
                updatedAt: now as any,
            };

            setMyTickets(prev => [createdTicket, ...prev]);
            setActiveTicket(createdTicket);
            setStep('ticket-view');
        } catch (e: any) {
            setError(e.message || 'Có lỗi xảy ra khi tạo ticket');
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
                    {/* Category cards with inline action buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(Object.keys(CATEGORY_CONFIG) as CategoryKey[]).map((catKey) => {
                            const cfg = CATEGORY_CONFIG[catKey];
                            const CatIcon = cfg.icon;
                            return (
                                <div
                                    key={catKey}
                                    className="group relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl border border-slate-200/60 dark:border-white/10 p-5 sm:p-6 text-center transition-all duration-500 hover:shadow-2xl hover:border-transparent"
                                >
                                    {/* Glow bg on hover */}
                                    <div className={clsx("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500 rounded-3xl", cfg.glow)} />

                                    <div className="relative z-10">
                                        <div className={clsx("w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-xl mb-3 transition-transform duration-500 group-hover:scale-110", cfg.gradient, cfg.shadow)}>
                                            <CatIcon size={24} className="text-white sm:w-7 sm:h-7" />
                                        </div>
                                        <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white mb-3 tracking-tight">{cfg.label}</h3>

                                        {/* ACTION BUTTONS — directly below category */}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedCategory(catKey); setSelectedAction('edit'); setFormValues({}); setUploadedImages([]); setStep('fill-form'); }}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-600/60 border border-slate-200/50 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all duration-200 hover:shadow-md"
                                            >
                                                <PenLine size={13} /> Chỉnh sửa
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedCategory(catKey); setSelectedAction('new'); setFormValues({}); setUploadedImages([]); setStep('fill-form'); }}
                                                className={clsx("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border", cfg.lightBg, cfg.text, cfg.border)}
                                            >
                                                <Sparkles size={13} /> Tạo mới
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tickets - Search & Filter — ALWAYS VISIBLE */}
                    <div className="relative overflow-hidden rounded-3xl bg-white/60 dark:bg-slate-800/50 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 shadow-xl">
                        <div className="px-5 py-4 border-b border-slate-200/50 dark:border-white/10 space-y-3">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Hash size={16} className="text-violet-500" /> Danh sách Đặt hàng Thiết kế
                                {!ticketsLoading && <span className="ml-auto text-[10px] font-bold text-slate-400">{filteredTickets.length}/{myTickets.length}</span>}
                                {ticketsFromCache && !ticketsLoading && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-300/50">📦 Cached</span>
                                )}
                            </h3>

                            {/* Error banner */}
                            {ticketsError && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                                    <AlertCircle size={14} className="text-red-500 shrink-0" />
                                    <span className="text-[11px] text-red-600 dark:text-red-400 font-medium flex-1">{ticketsError}</span>
                                    <button onClick={() => window.location.reload()} className="text-[10px] font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors shrink-0">↻ Tải lại</button>
                                </div>
                            )}

                            {/* Search */}
                            {!ticketsLoading && (
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
                            )}
                            {/* Filters */}
                            {!ticketsLoading && myTickets.length > 0 && (
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
                            )}
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {ticketsLoading ? (
                                <div className="py-12 text-center">
                                    <Loader2 size={24} className="mx-auto mb-2 text-violet-500 animate-spin" />
                                    <p className="text-xs text-slate-400 font-medium">Đang tải danh sách tickets...</p>
                                </div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="py-8 text-center text-xs text-slate-400">
                                    {myTickets.length === 0 ? '📋 Chưa có ticket nào. Hãy tạo yêu cầu đầu tiên ở trên!' : 'Không tìm thấy ticket phù hợp'}
                                </div>
                            ) : filteredTickets.map((ticket) => {
                                const catCfg = CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG['label-bag'];
                                const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['open'];
                                let createdStr = '';
                                try {
                                    const ts = ticket.createdAt;
                                    createdStr = ts?.toDate ? ts.toDate().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : (ts ? new Date(ts as unknown as string).toLocaleDateString('vi-VN') : '');
                                } catch { createdStr = ''; }
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
                            // Render a single form field element (for use in half or full)
                            const renderFieldInput = (f: FormField, isHalfWidth?: boolean) => {
                                const hasValue = !!(formValues[f.label]);
                                const filledBg = hasValue
                                    ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-300/60 dark:border-emerald-500/20'
                                    : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-white/10';
                                const cls = clsx(
                                    isHalfWidth ? 'w-full px-3 py-2.5 rounded-xl' : 'w-full px-4 py-3 rounded-2xl',
                                    filledBg,
                                    'backdrop-blur-xl border text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all shadow-sm'
                                );
                                if (f.type === 'customer-company-dropdown') {
                                    return (
                                        <SearchableDropdown
                                            value={formValues[f.label] || ''}
                                            onChange={(val) => setFormValues(p => ({ ...p, [f.label]: val }))}
                                            options={companyList}
                                            placeholder={customerLoading ? 'Đang tải...' : f.placeholder}
                                            loading={customerLoading}
                                            isHalf={isHalfWidth}
                                        />
                                    );
                                }
                                if (f.type === 'customer-person-dropdown') {
                                    return (
                                        <SearchableDropdown
                                            value={formValues[f.label] || ''}
                                            onChange={(val) => handlePersonSelect(val)}
                                            options={allContactNames}
                                            placeholder={f.placeholder}
                                            isHalf={isHalfWidth}
                                        />
                                    );
                                }
                                if (f.type === 'brand-dropdown') {
                                    return (
                                        <SearchableDropdown
                                            value={formValues[f.label] || ''}
                                            onChange={(val) => handleBrandSelect(val)}
                                            options={catalogBrands}
                                            placeholder={catalogLoading ? 'Đang tải...' : f.placeholder}
                                            loading={catalogLoading}
                                            isHalf={isHalfWidth}
                                        />
                                    );
                                }
                                if (f.type === 'product-dropdown') {
                                    return (
                                        <SearchableDropdown
                                            value={formValues[f.label] || ''}
                                            onChange={(val) => setFormValues(p => ({ ...p, [f.label]: val }))}
                                            options={catalogProducts}
                                            placeholder={catalogLoading ? 'Đang tải...' : f.placeholder}
                                            loading={catalogLoading}
                                            isHalf={isHalfWidth}
                                        />
                                    );
                                }
                                if (f.type === 'date-today') {
                                    return (
                                        <DatePickerField
                                            value={formValues[f.label] || ''}
                                            onChange={(val) => setFormValues(p => ({ ...p, [f.label]: val }))}
                                            placeholder={f.placeholder}
                                            isHalf={isHalfWidth}
                                            readOnly
                                        />
                                    );
                                }
                                if (f.type === 'date-picker') {
                                    return (
                                        <DatePickerField
                                            value={formValues[f.label] || ''}
                                            onChange={(val) => setFormValues(p => ({ ...p, [f.label]: val }))}
                                            placeholder={f.placeholder}
                                            isHalf={isHalfWidth}
                                        />
                                    );
                                }
                                return (
                                    <input type="text" value={formValues[f.label] || ''} onChange={(e) => setFormValues(p => ({ ...p, [f.label]: e.target.value }))} placeholder={f.placeholder} className={cls} />
                                );
                            };
                            const flushHalf = () => {
                                if (halfBuffer.length === 0) return;
                                rendered.push(
                                    <div key={`half-${rendered.length}`} className="grid grid-cols-2 gap-3">
                                        {halfBuffer.map((hf, hi) => (
                                            <div key={hi}>
                                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                    {hf.label} {hf.required && <span className="text-red-400">*</span>}
                                                </label>
                                                {renderFieldInput(hf, true)}
                                            </div>
                                        ))}
                                    </div>
                                );
                                halfBuffer = [];
                            };

                            currentFields.forEach((field, i) => {
                                if (field.half && (field.type === 'text' || field.type === 'customer-person-dropdown' || field.type === 'brand-dropdown' || field.type === 'product-dropdown' || field.type === 'date-today' || field.type === 'date-picker')) {
                                    halfBuffer.push(field);
                                    if (halfBuffer.length === 2) flushHalf();
                                    return;
                                }
                                flushHalf();

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
                                } else if (field.type === 'customer-company-dropdown') {
                                    rendered.push(
                                        <div key={i}>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                {field.label} {field.required && <span className="text-red-400">*</span>}
                                            </label>
                                            {renderFieldInput(field)}
                                        </div>
                                    );
                                } else if (field.type === 'customer-person-dropdown') {
                                    rendered.push(
                                        <div key={i}>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                {field.label} {field.required && <span className="text-red-400">*</span>}
                                            </label>
                                            {renderFieldInput(field)}
                                        </div>
                                    );
                                } else if (field.type === 'text') {
                                    rendered.push(
                                        <div key={i}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                    {field.label} {field.required && <span className="text-red-400">*</span>}
                                                </label>
                                                {field.aiSuggest && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAiSuggest(field.label)}
                                                        disabled={!!aiLoadingField}
                                                        className={clsx(
                                                            'flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all',
                                                            aiLoadingField === field.label
                                                                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-500 cursor-wait'
                                                                : 'bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 text-violet-600 dark:text-violet-400 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-500/20 dark:hover:to-purple-500/20 border border-violet-200/50 dark:border-violet-500/20 hover:shadow-md hover:shadow-violet-500/10'
                                                        )}
                                                    >
                                                        {aiLoadingField === field.label ? (
                                                            <><Loader2 size={10} className="animate-spin" /> Đang nghĩ...</>
                                                        ) : (
                                                            <><Sparkles size={10} /> AI gợi ý</>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                            {renderFieldInput(field)}
                                            {/* AI Suggestion popup for text fields */}
                                            {field.aiSuggest && aiSuggestion && aiSuggestion.field === field.label && (
                                                <div className="mt-2 p-3 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200/60 dark:border-violet-500/20 shadow-lg shadow-violet-500/5">
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <Sparkles size={12} className="text-violet-500" />
                                                        <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Gợi ý từ AI</span>
                                                    </div>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-3">{aiSuggestion.text}</p>
                                                    <div className="flex items-center gap-2">
                                                        <button type="button" onClick={acceptAiSuggestion} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors shadow-md shadow-violet-500/20">
                                                            <Check size={12} /> Sử dụng
                                                        </button>
                                                        <button type="button" onClick={dismissAiSuggestion} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors">
                                                            <X size={12} /> Bỏ qua
                                                        </button>
                                                        <button type="button" onClick={() => handleAiSuggest(field.label)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors">
                                                            <RotateCcw size={12} /> Gợi ý khác
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                } else if (field.type === 'textarea') {
                                    rendered.push(
                                        <div key={i}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                    {field.label} {field.required && <span className="text-red-400">*</span>}
                                                </label>
                                                {field.aiSuggest && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAiSuggest(field.label)}
                                                        disabled={!!aiLoadingField}
                                                        className={clsx(
                                                            'flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all',
                                                            aiLoadingField === field.label
                                                                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-500 cursor-wait'
                                                                : 'bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 text-violet-600 dark:text-violet-400 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-500/20 dark:hover:to-purple-500/20 border border-violet-200/50 dark:border-violet-500/20 hover:shadow-md hover:shadow-violet-500/10'
                                                        )}
                                                    >
                                                        {aiLoadingField === field.label ? (
                                                            <><Loader2 size={10} className="animate-spin" /> Đang nghĩ...</>
                                                        ) : (
                                                            <><Sparkles size={10} /> AI gợi ý</>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                            <textarea value={formValues[field.label] || ''} onChange={(e) => setFormValues(p => ({ ...p, [field.label]: e.target.value }))} placeholder={field.placeholder} rows={3} className={clsx('w-full px-4 py-3 rounded-2xl backdrop-blur-xl border text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all shadow-sm resize-none leading-relaxed', formValues[field.label] ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-300/60 dark:border-emerald-500/20' : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-white/10')} />
                                            {/* AI Suggestion popup */}
                                            {aiSuggestion && aiSuggestion.field === field.label && (
                                                <div className="mt-2 p-3 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200/60 dark:border-violet-500/20 shadow-lg shadow-violet-500/5 animate-in slide-in-from-top-2">
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <Sparkles size={12} className="text-violet-500" />
                                                        <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Gợi ý từ AI</span>
                                                    </div>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-3">{aiSuggestion.text}</p>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={acceptAiSuggestion}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors shadow-md shadow-violet-500/20"
                                                        >
                                                            <Check size={12} /> Sử dụng
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={dismissAiSuggestion}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors"
                                                        >
                                                            <X size={12} /> Bỏ qua
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAiSuggest(field.label)}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors"
                                                        >
                                                            <RotateCcw size={12} /> Gợi ý khác
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                } else if (field.type === 'select') {
                                    rendered.push(
                                        <div key={i}>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                {field.label} {field.required && <span className="text-red-400">*</span>}
                                            </label>
                                            <SearchableDropdown
                                                value={formValues[field.label] || ''}
                                                onChange={(val) => setFormValues(p => ({ ...p, [field.label]: val }))}
                                                options={field.options || []}
                                                placeholder={field.placeholder}
                                            />
                                        </div>
                                    );
                                } else if (field.type === 'date-today' || field.type === 'date-picker') {
                                    rendered.push(
                                        <div key={i}>
                                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                                                {field.label} {field.required && <span className="text-red-400">*</span>}
                                            </label>
                                            {renderFieldInput(field)}
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
                    <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
                        {/* LEFT COLUMN: Ticket info + SXTC history */}
                        <div className="lg:w-1/2 space-y-4">
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
                                {activeTicket.createdAt && (() => {
                                    let dateStr = '';
                                    try {
                                        const ts = activeTicket.createdAt;
                                        const d = (ts as any)?.toDate ? (ts as any).toDate() : new Date(ts as unknown as string);
                                        dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                                    } catch { dateStr = ''; }
                                    return dateStr ? (
                                        <div>
                                            <span className="text-slate-400 font-medium">Ngày tạo</span>
                                            <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{dateStr}</p>
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            {/* Status Action Buttons */}
                            {activeTicket.status !== 'cancelled' && activeTicket.status !== 'completed' && (
                                <div className="px-5 pb-4 space-y-2">
                                    {/* Status transition buttons */}
                                    <div className="flex flex-wrap gap-2">
                                        {/* ADMIN: open → in-review */}
                                        {isAdmin && activeTicket.status === 'open' && (
                                            <button disabled={statusUpdating} onClick={() => handleUpdateStatus(activeTicket.id, activeTicket.ticketCode, 'in-review', `Admin đang xem xét đơn hàng ${activeTicket.ticketCode}.`)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors border border-amber-200 dark:border-amber-500/20 disabled:opacity-50">
                                                <PlayCircle size={14} /> Bắt đầu duyệt
                                            </button>
                                        )}

                                        {/* ADMIN: in-review → approved */}
                                        {isAdmin && activeTicket.status === 'in-review' && (
                                            <button disabled={statusUpdating} onClick={() => handleUpdateStatus(activeTicket.id, activeTicket.ticketCode, 'approved', `Admin đã chốt thiết kế cho đơn hàng ${activeTicket.ticketCode}.`)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors border border-emerald-200 dark:border-emerald-500/20 disabled:opacity-50">
                                                <CheckCircle2 size={14} /> Chốt thiết kế
                                            </button>
                                        )}

                                        {/* ADMIN: in-review → revision (SXTC) */}
                                        {isAdmin && activeTicket.status === 'in-review' && (
                                            <button disabled={statusUpdating} onClick={() => handleUpdateStatus(activeTicket.id, activeTicket.ticketCode, 'revision', `Admin yêu cầu chỉnh sửa / SXTC đơn hàng ${activeTicket.ticketCode}. Lần ${(activeTicket.revisionRound || 0) + 1}.`)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-bold hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors border border-violet-200 dark:border-violet-500/20 disabled:opacity-50">
                                                <RotateCcw size={14} /> SXTC
                                            </button>
                                        )}

                                        {/* ADMIN: revision → in-review */}
                                        {isAdmin && activeTicket.status === 'revision' && (
                                            <button disabled={statusUpdating} onClick={() => handleUpdateStatus(activeTicket.id, activeTicket.ticketCode, 'in-review', `Đơn hàng ${activeTicket.ticketCode} đã hoàn thành chỉnh sửa, đang duyệt lại.`)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors border border-amber-200 dark:border-amber-500/20 disabled:opacity-50">
                                                <PlayCircle size={14} /> Duyệt lại
                                            </button>
                                        )}

                                        {/* ADMIN: approved → completed */}
                                        {isAdmin && activeTicket.status === 'approved' && (
                                            <button disabled={statusUpdating} onClick={() => handleUpdateStatus(activeTicket.id, activeTicket.ticketCode, 'completed', `Đơn hàng ${activeTicket.ticketCode} đã hoàn tất thành công! 🎉`)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors border border-green-200 dark:border-green-500/20 disabled:opacity-50">
                                                <CheckCircle2 size={14} /> Hoàn tất
                                            </button>
                                        )}

                                        {/* ADMIN: approved → revision */}
                                        {isAdmin && activeTicket.status === 'approved' && (
                                            <button disabled={statusUpdating} onClick={() => handleUpdateStatus(activeTicket.id, activeTicket.ticketCode, 'revision', `Yêu cầu chỉnh sửa bổ sung đơn hàng ${activeTicket.ticketCode}. Lần ${(activeTicket.revisionRound || 0) + 1}.`)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-bold hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors border border-violet-200 dark:border-violet-500/20 disabled:opacity-50">
                                                <RotateCcw size={14} /> Yêu cầu SXTC
                                            </button>
                                        )}

                                        {/* CUSTOMER: in-review → approved (Chốt sản phẩm) */}
                                        {!isAdmin && activeTicket.status === 'in-review' && (
                                            <button disabled={statusUpdating} onClick={() => handleUpdateStatus(activeTicket.id, activeTicket.ticketCode, 'approved', `Khách hàng đã chốt sản phẩm cho đơn hàng ${activeTicket.ticketCode}.`)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors border border-emerald-200 dark:border-emerald-500/20 disabled:opacity-50">
                                                <ThumbsUp size={14} /> Chốt sản phẩm
                                            </button>
                                        )}

                                        {/* CUSTOMER: in-review/approved → revision (Yêu cầu chỉnh sửa) */}
                                        {!isAdmin && (activeTicket.status === 'in-review' || activeTicket.status === 'approved') && (
                                            <button disabled={statusUpdating} onClick={() => handleUpdateStatus(activeTicket.id, activeTicket.ticketCode, 'revision', `Khách hàng yêu cầu chỉnh sửa đơn hàng ${activeTicket.ticketCode}. Lần ${(activeTicket.revisionRound || 0) + 1}.`)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-bold hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors border border-violet-200 dark:border-violet-500/20 disabled:opacity-50">
                                                <RotateCcw size={14} /> Yêu cầu chỉnh sửa
                                            </button>
                                        )}
                                    </div>

                                    {/* Admin utility buttons (assign / cancel) */}
                                    {isAdmin && (
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={() => setAssignModal({ ticketId: activeTicket.id })} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold hover:bg-indigo-100 transition-colors border border-indigo-200 dark:border-indigo-500/20">
                                                <UserCheck size={13} /> Phân công
                                            </button>
                                            <button onClick={() => setCancelModal({ ticketId: activeTicket.id, ticketCode: activeTicket.ticketCode })} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold hover:bg-red-100 transition-colors border border-red-200 dark:border-red-500/20">
                                                <XCircle size={13} /> Hủy đơn
                                            </button>
                                        </div>
                                    )}

                                    {/* Loading indicator */}
                                    {statusUpdating && (
                                        <div className="flex items-center justify-center gap-2 py-1.5 text-xs text-slate-400">
                                            <Loader2 size={12} className="animate-spin" /> Đang cập nhật...
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Form Data & Requirements */}
                            {activeTicket.formData && Object.keys(activeTicket.formData).length > 0 && (
                                <div className="px-5 pb-6 space-y-4 border-t border-slate-100 dark:border-white/5 pt-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                                            <Sparkles size={12} className="text-violet-600 dark:text-violet-400" />
                                        </div>
                                        <h4 className="text-xs font-black tracking-wide text-slate-800 dark:text-slate-200 uppercase">Chi tiết yêu cầu thiết kế</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {Object.entries(activeTicket.formData).map(([k, v]) => {
                                            if (!v || ["Tên nhãn hàng", "Tên đơn vị đặt hàng", "Tên nhãn hàng / Fanpage", "Người đặt hàng", "Số điện thoại", "Email", "Địa chỉ"].includes(k)) return null;
                                            return (
                                                <div key={k} className="bg-slate-50/70 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{k}</span>
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{v.toString()}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Attachments from Form */}
                            {activeTicket.imageUrls && activeTicket.imageUrls.length > 0 && (
                                <div className="px-5 pb-6 space-y-4 border-t border-slate-100 dark:border-white/5 pt-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                                            <Paperclip size={12} className="text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <h4 className="text-xs font-black tracking-wide text-slate-800 dark:text-slate-200 uppercase">Tài liệu đính kèm ({activeTicket.imageUrls.length})</h4>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {activeTicket.imageUrls.map((url, idx) => {
                                            const cleanUrl = url.split('?')[0].toLowerCase();
                                            const isImage = /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(cleanUrl);
                                            const isPdf = /\.(pdf)$/i.test(cleanUrl);
                                            const isVideo = /\.(mp4|webm|mkv|mov|avi)$/i.test(cleanUrl);
                                            const isDoc = /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(cleanUrl);
                                            
                                            const fileName = `File đính kèm ${idx + 1}`;
                                            return (
                                                <button type="button" onClick={() => setViewingFile({ url, name: fileName })} key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/10 transition-all aspect-video flex items-center justify-center text-left">
                                                    {isImage ? (
                                                        <>
                                                            <img src={url} alt={fileName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                                <Eye size={20} className="text-white" />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center gap-2 p-3">
                                                            {isPdf ? <FileText size={24} className="text-red-400 group-hover:text-red-500 transition-colors" /> 
                                                            : isVideo ? <FileText size={24} className="text-blue-400 group-hover:text-blue-500 transition-colors" />
                                                            : isDoc ? <FileText size={24} className="text-green-400 group-hover:text-green-500 transition-colors" />
                                                            : <Archive size={24} className="text-slate-400 group-hover:text-violet-500 transition-colors" />}
                                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate w-full text-center group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                                                                {isPdf ? 'Tài liệu PDF' : isVideo ? 'Video' : isDoc ? 'Tài liệu Office' : 'Tệp dữ liệu'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
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
                        </div>{/* end left column */}

                        {/* RIGHT COLUMN: Chat section */}
                        <div className="lg:w-1/2 lg:sticky lg:top-4">
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
                        </div>{/* end right column */}
                    </div>
                );
            })()}
            {/* File Viewer Modal */}
            {viewingFile && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col p-4 sm:p-8 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h3 className="text-white font-bold text-sm sm:text-base truncate pr-4">{viewingFile.name}</h3>
                        <div className="flex items-center gap-2 shrink-0">
                            <a href={viewingFile.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title="Mở tab mới">
                                <ExternalLink size={20} />
                            </a>
                            <button onClick={() => setViewingFile(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-red-500 transition-colors">
                                <XCircle size={20} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 flex items-center justify-center bg-black/20 rounded-2xl overflow-hidden relative">
                        {/\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(viewingFile.url.split('?')[0].toLowerCase()) ? (
                            <img src={viewingFile.url} alt={viewingFile.name} className="max-w-full max-h-full object-contain" />
                        ) : /\.(mp4|webm|mkv|mov|avi)$/i.test(viewingFile.url.split('?')[0].toLowerCase()) ? (
                            <video controls autoPlay className="max-w-full max-h-full bg-black">
                                <source src={viewingFile.url} />
                            </video>
                        ) : /\.(pdf)$/i.test(viewingFile.url.split('?')[0].toLowerCase()) ? (
                            // Native browser PDF viewer
                            <iframe src={viewingFile.url} title={viewingFile.name} className="w-full h-full border-0 bg-white" />
                        ) : /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(viewingFile.url.split('?')[0].toLowerCase()) ? (
                            // Microsoft Office Viewer for superior compatibility with Word, Excel, PowerPoint
                            <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewingFile.url)}`} title={viewingFile.name} className="w-full h-full border-0 bg-white" />
                        ) : /\.(txt|csv|rtf)$/i.test(viewingFile.url.split('?')[0].toLowerCase()) ? (
                            // Google Docs Viewer as fallback for basic text/data formats
                            <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingFile.url)}&embedded=true`} title={viewingFile.name} className="w-full h-full border-0 bg-white" />
                        ) : (
                            <div className="text-center space-y-4">
                                <Archive size={48} className="text-slate-400 mx-auto" />
                                <p className="text-slate-300 font-medium whitespace-pre-wrap">
                                    Tệp này không hỗ trợ xem trực tiếp trên Ứng dụng.{'\n'}
                                    Bạn có thể ấn tải xuống, hoặc mở thẻ mới để xem.
                                </p>
                                <a href={viewingFile.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition-colors shadow-lg hover:shadow-xl">
                                    <Download size={20} />
                                    Tải tệp xuống
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DesignOrderForm;

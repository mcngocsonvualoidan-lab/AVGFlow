import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Sun, Skull, Crown, RotateCcw, Send, ThumbsUp, Loader2, MessageCircle, Users, Shield, Clock, Trophy, BarChart3, Volume2, VolumeX, BookOpen } from 'lucide-react';
import { MinigameService, GameRoom, WerewolfState, WerewolfChatMessage, GameHistory, decodeEmail } from '../../services/minigameService';
import { useData } from '../../context/DataContext';
import { werewolfAudio, PhaseType } from './werewolf-audio';
import './werewolf-gothic.css';

// Error Boundary to prevent white screen crashes
class WerewolfErrorBoundary extends React.Component<
    { children: React.ReactNode; roomId?: string; isHost?: boolean },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('🐺 WerewolfGame crash:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 text-center bg-[#0a0a0f] rounded-2xl border border-[#8b1a1a]/30">
                    <div className="text-4xl mb-3">🐺💥</div>
                    <h3 className="text-xl font-bold text-[#c62828] mb-2">Đã xảy ra lỗi</h3>
                    <p className="text-sm text-[#6b5f50] mb-4">{this.state.error?.message || 'Lỗi không xác định'}</p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-4 py-2 bg-[#8b5c3a] text-white rounded-xl font-bold text-sm mr-2"
                    >
                        🔄 Thử lại
                    </button>
                    {this.props.isHost && this.props.roomId && (
                        <button
                            onClick={async () => {
                                try {
                                    await MinigameService.updateGameState(this.props.roomId!, { phase: 'waiting' });
                                    this.setState({ hasError: false, error: null });
                                } catch (e) { console.error(e); }
                            }}
                            className="px-4 py-2 bg-[#c62828] text-white rounded-xl font-bold text-sm"
                        >
                            ↩ Reset game
                        </button>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}

const WOLF_ROLES = [
    { role: 'Ma Sói', icon: '🐺', team: 'wolf', desc: 'Kẻ săn mồi trong đêm. Mỗi đêm chọn 1 người để cắn.', cardImage: '/cards/werewolf.png' },
    { role: 'Dân làng', icon: '🏡', team: 'village', desc: 'Linh hồn của ngôi làng. Tìm và treo cổ Ma Sói.', cardImage: '/cards/villager.png' },
    { role: 'Tiên tri', icon: '🔮', team: 'village', desc: 'Nhà tiên tri bí ẩn. Mỗi đêm soi 1 người để biết họ có phải Ma Sói không.', cardImage: '/cards/seer.png' },
    { role: 'Bảo vệ', icon: '⚔️', team: 'village', desc: 'Hiệp sĩ canh giữ. Mỗi đêm bảo vệ 1 người.', cardImage: '/cards/guard.png' },
    { role: 'Phù thủy', icon: '🧙', team: 'village', desc: 'Bà phù thủy bí ẩn. Có 1 bình cứu và 1 bình độc.', cardImage: '/cards/witch.png' },
    { role: 'Thợ săn', icon: '🏹', team: 'village', desc: 'Mỗi đêm ghim 1 người (không ghim trùng người đêm trước). Nếu Thợ săn chết, người bị ghim cũng sẽ chết theo.', cardImage: '/cards/hunter_v2.png' },
    { role: 'Kẻ chán đời', icon: '😵', team: 'alone', desc: 'Kẻ chán đời muốn chết. Thắng nếu bị dân làng bỏ phiếu treo cổ (không thắng nếu bị sói cắn).', cardImage: '/cards/tanner.png' },
    { role: 'Kẻ tẩm dầu', icon: '🔥', team: 'alone', desc: 'Kẻ phóng hỏa bí ẩn. Mỗi đêm tẩm dầu 1 người hoặc châm lửa đốt tất cả đã tẩm dầu. Thắng khi đốt hết mọi người.', cardImage: '/cards/arsonist.png' },
];
const CARD_BACK_IMAGE = '/cards/card_back.png';

// Role gradient map for fallback cards — gothic dark palette
const ROLE_GRADIENTS: Record<string, string> = {
    'Ma Sói': 'from-[#2a0a0a] via-[#4a1010] to-[#1a0505]',
    'Dân làng': 'from-[#1a1510] via-[#2a2518] to-[#0f0d08]',
    'Tiên tri': 'from-[#10102a] via-[#1a1848] to-[#080818]',
    'Bảo vệ': 'from-[#0a1520] via-[#142838] to-[#081018]',
    'Phù thủy': 'from-[#201020] via-[#381838] to-[#100810]',
    'Thợ săn': 'from-[#1a1008] via-[#2a2010] to-[#0f0a04]',
    'Kẻ chán đời': 'from-[#1a1518] via-[#2a2028] to-[#0f0a10]',
    'Kẻ tẩm dầu': 'from-[#2a1a08] via-[#3a2510] to-[#1a0f04]',
};

// Fallback card face when image fails to load
const CardFallback = ({ roleName, roleIcon, size }: { roleName: string; roleIcon: string; size: 'sm' | 'lg' }) => {
    const gradient = ROLE_GRADIENTS[roleName] || 'from-[#1a1825] to-[#0a0a0f]';
    const iconSize = size === 'sm' ? 'text-6xl' : 'text-8xl';
    const nameSize = size === 'sm' ? 'text-base' : 'text-2xl';
    return (
        <div className={`w - full h - full bg - gradient - to - br ${gradient} flex flex - col items - center justify - center gap - 2 p - 4`}>
            <span className={iconSize}>{roleIcon}</span>
            <span className={`${nameSize} font - black text - [#e8dcc8] tracking - wider uppercase drop - shadow - lg`} style={{ fontFamily: "'Playfair Display', serif" }}>{roleName}</span>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2260%22%20height%3D%2260%22%3E%3Cpath%20d%3D%22M30%200L60%2030L30%2060L0%2030Z%22%20fill%3D%22none%22%20stroke%3D%22rgba(139%2C92%2C58%2C0.06)%22%20stroke-width%3D%221%22%2F%3E%3C%2Fsvg%3E')] opacity-60" />
        </div>
    );
};

const CardBackFallback = ({ size }: { size: 'sm' | 'lg' }) => {
    const iconSize = size === 'sm' ? 'text-4xl' : 'text-7xl';
    return (
        <div className="w-full h-full bg-gradient-to-br from-[#1a1030] via-[#12111a] to-[#0a0a0f] flex flex-col items-center justify-center gap-3">
            <span className={iconSize}>🃏</span>
            <span className="text-[#8b5c3a]/40 font-bold text-sm tracking-widest uppercase" style={{ fontFamily: "'Playfair Display', serif" }}>Ma Sói</span>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2218%22%20fill%3D%22none%22%20stroke%3D%22rgba(139%2C92%2C58%2C0.04)%22%20stroke-width%3D%221%22%2F%3E%3C%2Fsvg%3E')] opacity-60" />
        </div>
    );
};

// Extracted as module-level component to avoid re-creation on every render (prevents flicker)
const CardFace = ({ flipped, size, onFlip, cardImage, roleName, roleIcon, alive }: {
    flipped: boolean; size: 'sm' | 'lg'; onFlip: () => void;
    cardImage?: string; roleName: string; roleIcon: string; alive: boolean;
}) => {
    const [imgError, setImgError] = useState(false);
    const [backImgError, setBackImgError] = useState(false);
    const w = size === 'sm' ? 'w-[140px]' : 'w-[280px] md:w-[320px]';
    const h = size === 'sm' ? 'h-[200px]' : 'h-[400px] md:h-[460px]';
    const hintText = flipped ? 'Nhấn để úp bài' : 'Nhấn để lật bài';
    return (
        <motion.div
            className="cursor-pointer select-none flex flex-col items-center"
            onClick={onFlip}
            whileTap={{ scale: 0.97 }}
            style={{ perspective: 800 }}
        >
            <AnimatePresence mode="wait" initial={false}>
                {flipped ? (
                    <motion.div
                        key="front"
                        initial={{ rotateY: 90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        exit={{ rotateY: -90, opacity: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className={clsx(w, h, 'rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] border-2 border-white/20 relative')}
                    >
                        {!imgError && cardImage ? (
                            <img src={cardImage} alt={roleName} className="w-full h-full object-cover" onError={() => setImgError(true)} />
                        ) : (
                            <CardFallback roleName={roleName} roleIcon={roleIcon} size={size} />
                        )}
                        {!alive && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-white text-base font-bold flex items-center gap-1"><Skull size={16} /> Đã bị loại</span>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="back"
                        initial={{ rotateY: -90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        exit={{ rotateY: 90, opacity: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className={clsx(w, h, 'rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] border-2 border-white/20 relative')}
                    >
                        {!backImgError ? (
                            <img src={CARD_BACK_IMAGE} alt="Card back" className="w-full h-full object-cover" onError={() => setBackImgError(true)} />
                        ) : (
                            <CardBackFallback size={size} />
                        )}

                    </motion.div>
                )}
            </AnimatePresence>

            <p className={clsx('mt-1.5', size === 'lg' ? 'text-sm text-[#6b5f50]' : 'text-xs text-[#6b5f50]')}>{hintText}</p>
        </motion.div>
    );
};

// ==================== ROLE ASSIGN CARD (with fallback) ====================
export const RoleAssignCard = ({ cardImage, roleName, roleIcon, isBack }: {
    cardImage?: string; roleName?: string; roleIcon?: string; isBack?: boolean;
}) => {
    const [imgError, setImgError] = useState(false);
    if (isBack) {
        return (
            <div className="w-[160px] h-[230px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.3)] border-2 border-white/20 mb-3 relative">
                {!imgError ? (
                    <img src={CARD_BACK_IMAGE} alt="Card back" className="w-full h-full object-cover" onError={() => setImgError(true)} />
                ) : (
                    <CardBackFallback size="sm" />
                )}

            </div>
        );
    }
    return (
        <div className="w-[160px] h-[230px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.3)] border-2 border-white/30 mb-3 relative">
            {!imgError && cardImage ? (
                <img src={cardImage} alt={roleName} className="w-full h-full object-cover" onError={() => setImgError(true)} />
            ) : (
                <CardFallback roleName={roleName || ''} roleIcon={roleIcon || ''} size="sm" />
            )}
        </div>
    );
};

// ==================== SCRATCH CARD for Role Reveal ====================
const ScratchRevealCard: React.FC<{
    cardImage?: string; roleName: string; roleIcon: string;
    onRevealed: () => void;
}> = ({ cardImage, roleName, roleIcon, onRevealed }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imgError, setImgError] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const isDrawing = useRef(false);
    const scratchPercent = useRef(0);

    // Initialize scratch overlay
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || revealed) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;

        // Draw golden scratch overlay
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#8b5c3a');
        grad.addColorStop(0.3, '#c9873a');
        grad.addColorStop(0.5, '#e8d5a3');
        grad.addColorStop(0.7, '#c9873a');
        grad.addColorStop(1, '#8b5c3a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Add texture pattern
        ctx.globalAlpha = 0.15;
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const r = Math.random() * 3 + 0.5;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Center text
        ctx.fillStyle = '#1a0a0a';
        ctx.font = 'bold 16px "Playfair Display", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✨ Cào để xem vai trò ✨', w / 2, h / 2 - 12);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#3a2010';
        ctx.fillText('Kéo ngón tay hoặc chuột', w / 2, h / 2 + 12);

        // Decorative border
        ctx.strokeStyle = '#e8d5a3';
        ctx.lineWidth = 3;
        ctx.strokeRect(4, 4, w - 8, h - 8);
    }, [revealed]);

    const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            const t = e.touches[0] || e.changedTouches[0];
            return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
        }
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const scratch = (pos: { x: number; y: number }) => {
        const canvas = canvasRef.current;
        if (!canvas || revealed) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
        ctx.fill();
        // Also draw a connecting line for smoother scratching
        ctx.lineWidth = 44;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';

        // Check scratch percentage
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let transparent = 0;
        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] === 0) transparent++;
        }
        scratchPercent.current = transparent / (imageData.data.length / 4);
        if (scratchPercent.current > 0.4) {
            setRevealed(true);
            onRevealed();
        }
    };

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isDrawing.current = true;
        const pos = getPos(e);
        if (pos) scratch(pos);
    };
    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        const pos = getPos(e);
        if (pos) scratch(pos);
    };
    const handleEnd = () => { isDrawing.current = false; };

    return (
        <div className="relative w-[200px] h-[290px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] border-2 border-[#c9873a]/40 mb-3 select-none">
            {/* Background: role card */}
            <div className="absolute inset-0">
                {!imgError && cardImage ? (
                    <img src={cardImage} alt={roleName} className="w-full h-full object-cover" onError={() => setImgError(true)} />
                ) : (
                    <CardFallback roleName={roleName} roleIcon={roleIcon} size="sm" />
                )}
            </div>
            {/* Scratch canvas overlay */}
            {!revealed && (
                <canvas
                    ref={canvasRef}
                    width={200}
                    height={290}
                    className="absolute inset-0 w-full h-full cursor-pointer z-10"
                    style={{ touchAction: 'none' }}
                    onMouseDown={handleStart}
                    onMouseMove={handleMove}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                    onTouchStart={handleStart}
                    onTouchMove={handleMove}
                    onTouchEnd={handleEnd}
                />
            )}
            {/* Revealed sparkle effect */}
            {revealed && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 1.2 }}
                    className="absolute inset-0 bg-gradient-to-br from-[#c9873a]/30 via-transparent to-[#e8d5a3]/20 pointer-events-none z-10"
                />
            )}
        </div>
    );
};

// ==================== CHAT COMPONENT ====================
const GameChat: React.FC<{
    roomId: string; myUid: string; myName: string; myAvatar: string;
    channel: 'day' | 'wolf' | 'dead'; visibleChannels: string[];
    canSwitchToWolf?: boolean;
}> = ({ roomId, myUid, myName, myAvatar, channel, visibleChannels, canSwitchToWolf }) => {
    const [messages, setMessages] = useState<WerewolfChatMessage[]>([]);
    const [text, setText] = useState('');
    const [showChat, setShowChat] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [unread, setUnread] = useState(0);
    const lastCountRef = useRef(0);
    const [activeChannel, setActiveChannel] = useState<'day' | 'wolf' | 'dead'>(channel);

    // Sync activeChannel when the default channel changes (e.g. phase change)
    useEffect(() => { setActiveChannel(channel); }, [channel]);

    useEffect(() => {
        return MinigameService.subscribeToChat(roomId, (msgs) => {
            const visible = msgs.filter(m => visibleChannels.includes(m.channel));
            setMessages(visible);
            if (!showChat && visible.length > lastCountRef.current) {
                setUnread(u => u + (visible.length - lastCountRef.current));
            }
            lastCountRef.current = visible.length;
        });
    }, [roomId, visibleChannels, showChat]);

    useEffect(() => {
        if (showChat && chatEndRef.current) {
            const container = chatEndRef.current.parentElement;
            if (container) container.scrollTop = container.scrollHeight;
            setUnread(0);
        }
    }, [messages, showChat]);

    const send = async () => {
        if (!text.trim()) return;
        await MinigameService.sendChat(roomId, {
            sender: myUid, senderName: myName, senderAvatar: myAvatar,
            text: text.trim(), timestamp: Date.now(), channel: activeChannel,
        });
        setText('');
    };

    const channelLabel: Record<string, string> = { day: '💬 Tất cả', wolf: '🐺 Ma Sói', dead: '💀 Linh hồn', system: '📢 Hệ thống' };
    const isWolfMode = activeChannel === 'wolf';

    // Filter messages by active tab — exclude system messages (shown in GameEventLog)
    const filteredMessages = messages.filter(m =>
        m.channel !== 'system' && m.channel === activeChannel
    );

    return (
        <>
            <button onClick={() => setShowChat(!showChat)}
                className="fixed bottom-4 right-4 md:bottom-24 md:right-8 z-50 w-12 h-12 bg-[#2a1510] text-[#e8d5a3] rounded-full shadow-xl flex items-center justify-center hover:bg-[#3a1a14] transition-colors border border-[#8b5c3a]/30">
                <MessageCircle size={22} />
                {unread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#8b1a1a] text-[#e8dcc8] rounded-full text-xs font-bold flex items-center justify-center">{unread}</span>}
            </button>
            <AnimatePresence>{showChat && (
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                    className={clsx("fixed bottom-20 right-4 md:bottom-40 md:right-8 z-50 w-80 max-w-[calc(100vw-32px)] rounded-2xl shadow-2xl border flex flex-col overflow-hidden backdrop-blur-xl",
                        isWolfMode ? "bg-[#1a0808]/75 border-[#8b1a1a]/40" : "bg-[#12111a]/75 border-[#8b5c3a]/25")}
                    style={{ height: 400 }}>
                    <div className={clsx("px-3 py-2 border-b flex items-center justify-between",
                        isWolfMode ? "border-[#8b1a1a]/30 bg-[#2a0a0a]/60" : "border-[#8b5c3a]/15 bg-[#1a1825]/80")}>
                        <span className={clsx("text-base font-bold", isWolfMode ? "text-[#c62828]" : "text-[#c9873a]")} style={{ fontFamily: "'Playfair Display', serif" }}>
                            {channelLabel[activeChannel] || 'Chat'}
                        </span>
                        <div className="flex items-center gap-1">
                            {canSwitchToWolf && (
                                <>
                                    <button onClick={() => setActiveChannel('day')}
                                        className={clsx("px-2 py-0.5 rounded-full text-xs font-bold transition-all",
                                            !isWolfMode ? "bg-[#c9873a] text-[#0a0a0f]" : "bg-[#221f30] text-[#6b5f50] hover:bg-[#2d2940]")}>
                                        �️ Chung
                                    </button>
                                    <button onClick={() => setActiveChannel('wolf')}
                                        className={clsx("px-2 py-0.5 rounded-full text-xs font-bold transition-all",
                                            isWolfMode ? "bg-[#8b1a1a] text-[#e8dcc8]" : "bg-[#221f30] text-[#6b5f50] hover:bg-[#2a0a0a]")}>
                                        🐺 Sói
                                    </button>
                                </>
                            )}
                            <button onClick={() => setShowChat(false)} className="text-[#6b5f50] hover:text-slate-600 text-sm font-bold ml-1">✕</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                        {filteredMessages.length === 0 && <p className={clsx("text-sm text-center py-4", isWolfMode ? "text-[#c62828]/60" : "text-[#6b5f50]")}>
                            {isWolfMode ? '🐺 Chat riêng giữa các sói. Chỉ sói mới thấy!' : 'Chưa có tin nhắn'}
                        </p>}
                        {filteredMessages.map(m => (
                            <div key={m.id} className={clsx("flex gap-1.5", m.sender === myUid ? "flex-row-reverse" : "")}>
                                {m.channel === 'system' ? (
                                    <div className="w-full text-center"><span className={clsx("text-xs px-2 py-0.5 rounded-full",
                                        isWolfMode ? "text-[#c62828]/70 bg-red-900/30" : "text-[#6b5f50] bg-[#1a1825]")}>{m.text}</span></div>
                                ) : (
                                    <>
                                        <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0 mt-0.5"><img src={m.senderAvatar || `https://ui-avatars.com/api/?name=${m.senderName}&size=32`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[8px]" style={{display:'none'}}>{(m.senderName||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                        <div className={clsx("max-w-[75%]", m.sender === myUid ? "text-right" : "")}>
                                            <p className={clsx("text-xs", isWolfMode ? "text-[#c62828]/70" : "text-[#6b5f50]")}>
                                                {m.senderName} {m.channel === 'wolf' && '🐺'} {m.channel === 'dead' && '💀'}
                                            </p>
                                            <p className={clsx("text-sm px-2.5 py-1.5 rounded-xl inline-block",
                                                m.channel === 'wolf'
                                                    ? (m.sender === myUid ? "bg-[#8b1a1a] text-[#e8dcc8]" : "bg-[#2a0a0a] text-[#c62828]")
                                                    : (m.sender === myUid ? "bg-[#8b5c3a] text-[#0a0a0f]" : "bg-[#221f30] text-[#a89b85]")
                                            )}>{m.text}</p>
                                        </div>
                                    </>
                                )}
                            </div >
                        ))}
                        <div ref={chatEndRef} />
                    </div >
                    <div className={clsx("p-2 border-t flex gap-1.5", isWolfMode ? "border-red-800/40" : "border-[#8b5c3a]/20")}>
                        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                            placeholder={isWolfMode ? "🐺 Nhắn riêng cho đồng đội sói..." : "Nhập tin nhắn..."}
                            className={clsx("flex-1 text-base px-3 py-2 rounded-xl border outline-none",
                                isWolfMode
                                    ? "border-[#8b1a1a]/40 bg-[#1a0505] text-[#c62828] placeholder:text-[#8b1a1a]/40 focus:border-[#c62828]/60"
                                    : "border-[#8b5c3a]/20 bg-[#16141f] text-[#e8dcc8] placeholder:text-[#6b5f50] focus:border-[#c9873a]/40")} />
                        <button onClick={send} className={clsx("p-2 text-[#e8dcc8] rounded-xl transition-colors",
                            isWolfMode ? "bg-[#8b1a1a] hover:bg-[#a02020]" : "bg-[#8b5c3a] hover:bg-[#a06b40]")}><Send size={16} /></button>
                    </div>
                </motion.div >
            )}</AnimatePresence >
        </>
    );
};

// ==================== CHAT TOAST — New Message Popup ====================
const ChatToast: React.FC<{
    messages: { id: string; senderName: string; senderAvatar: string; text: string; channel: string }[];
    onDismiss: (id: string) => void;
    isWolf?: boolean;
}> = ({ messages, onDismiss, isWolf: _isWolf }) => {
    useEffect(() => {
        const timers = messages.map(m =>
            setTimeout(() => onDismiss(m.id), 4000)
        );
        return () => timers.forEach(t => clearTimeout(t));
    }, [messages, onDismiss]);

    if (messages.length === 0) return null;

    return (
        <div className="space-y-1.5 mb-2">
            <AnimatePresence>
                {messages.slice(-3).map(m => (
                    <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 40, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                        onClick={() => onDismiss(m.id)}
                        className={clsx(
                            "flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all hover:brightness-110",
                            m.channel === 'wolf'
                                ? "bg-[#2a0a0a]/90 border-[#8b1a1a]/50 shadow-lg shadow-red-900/30"
                                : "bg-[#1a1825]/90 border-[#8b5c3a]/40 shadow-lg shadow-amber-900/20"
                        )}
                        style={{ backdropFilter: 'blur(12px)' }}
                    >
                        <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0">
                            <img src={m.senderAvatar || `https://ui-avatars.com/api/?name=${m.senderName}&size=32`}
                                className="w-full h-full object-cover" alt=""
                                onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} />
                            <div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[8px]" style={{display:'none'}}>
                                {(m.senderName||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={clsx("text-xs font-bold", m.channel === 'wolf' ? "text-[#c62828]" : "text-[#c9873a]")}>
                                {m.senderName} {m.channel === 'wolf' && '🐺'}
                            </p>
                            <p className={clsx("text-sm truncate", m.channel === 'wolf' ? "text-[#e8a0a0]" : "text-[#e8dcc8]")}>
                                {m.text}
                            </p>
                        </div>
                        <span className="text-[10px] text-[#6b5f50] shrink-0 mt-0.5">●</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

// ==================== SINGLE CHANNEL CHAT BOX ====================
const ChatBox: React.FC<{
    roomId: string; myUid: string; myName: string; myAvatar: string;
    channel: 'day' | 'wolf' | 'dead'; visibleChannels: string[];
    title: string; maxHeight?: number; isWolf?: boolean;
}> = ({ roomId, myUid, myName, myAvatar, channel, title, maxHeight = 250, isWolf = false }) => {
    const [messages, setMessages] = useState<WerewolfChatMessage[]>([]);
    const [text, setText] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [toasts, setToasts] = useState<{ id: string; senderName: string; senderAvatar: string; text: string; channel: string }[]>([]);
    const prevMsgCountRef = useRef(0);
    const initialLoadRef = useRef(true);

    useEffect(() => {
        return MinigameService.subscribeToChat(roomId, (msgs) => {
            const filtered = msgs.filter(m => m.channel === channel);
            setMessages(filtered);

            // Show toast for new messages from OTHER players (not self, not system)
            const nonSystem = filtered.filter(m => m.channel !== 'system');
            if (!initialLoadRef.current && nonSystem.length > prevMsgCountRef.current) {
                const newMsgs = nonSystem.slice(prevMsgCountRef.current);
                const otherNewMsgs = newMsgs.filter(m => m.sender !== myUid);
                if (otherNewMsgs.length > 0) {
                    setToasts(prev => [
                        ...prev,
                        ...otherNewMsgs.map(m => ({
                            id: m.id || `toast-${Date.now()}-${Math.random()}`,
                            senderName: m.senderName,
                            senderAvatar: m.senderAvatar,
                            text: m.text,
                            channel: m.channel,
                        }))
                    ].slice(-3));
                }
            }
            prevMsgCountRef.current = nonSystem.length;
            if (initialLoadRef.current) initialLoadRef.current = false;
        });
    }, [roomId, channel, myUid]);

    useEffect(() => {
        if (chatEndRef.current) {
            const container = chatEndRef.current.parentElement;
            if (container) container.scrollTop = container.scrollHeight;
        }
    }, [messages]);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const send = async () => {
        if (!text.trim()) return;
        await MinigameService.sendChat(roomId, {
            sender: myUid, senderName: myName, senderAvatar: myAvatar,
            text: text.trim(), timestamp: Date.now(), channel,
        });
        setText('');
    };

    return (
        <div className={clsx("overflow-hidden", isWolf ? "ww-chat-box-wolf" : "ww-chat-box")}>
            <div className={clsx("px-3 py-2 border-b flex items-center gap-2",
                isWolf ? "border-[#8b1a1a]/20 bg-[#2a0a0a]/40" : "border-[#8b5c3a]/12 bg-[#1a1825]/40")}>
                <MessageCircle size={14} className={isWolf ? "text-[#c62828]" : "text-[#c9873a]"} />
                <span className={clsx("text-sm font-bold", isWolf ? "text-[#c62828]" : "text-[#c9873a]")}
                    style={{ fontFamily: "'Playfair Display', serif" }}>{title}</span>
            </div>
            {/* Toast notifications for new messages */}
            {toasts.length > 0 && (
                <div className="px-2.5 pt-2">
                    <ChatToast messages={toasts} onDismiss={dismissToast} isWolf={isWolf} />
                </div>
            )}
            <div className="overflow-y-auto p-2.5 space-y-1.5" style={{ maxHeight }}>
                {messages.filter(m => m.channel !== 'system').length === 0 && <p className={clsx("text-xs text-center py-3",
                    isWolf ? "text-[#c62828]/50" : "text-[#6b5f50]")}>
                    {isWolf ? '🐺 Bí mật — chỉ sói thấy!' : 'Chưa có tin nhắn'}
                </p>}
                {messages.map(m => (
                    <div key={m.id} className={clsx("flex gap-1.5", m.sender === myUid ? "flex-row-reverse" : "")}>
                        {m.channel === 'system' ? (
                            <div className="w-full text-center"><span className={clsx("text-xs px-2 py-0.5 rounded-full",
                                isWolf ? "text-[#c62828]/60 bg-[#2a0a0a]/60" : "text-[#6b5f50] bg-[#1a1825]/60")}>{m.text}</span></div>
                        ) : (
                            <>
                                <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0 mt-0.5"><img src={m.senderAvatar || `https://ui-avatars.com/api/?name=${m.senderName}&size=32`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[8px]" style={{display:'none'}}>{(m.senderName||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                <div className={clsx("max-w-[80%]", m.sender === myUid ? "text-right" : "")}>
                                    <p className={clsx("text-xs", isWolf ? "text-[#c62828]/60" : "text-[#6b5f50]")}>{m.senderName}</p>
                                    <p className={clsx("text-sm px-2.5 py-1.5 rounded-xl inline-block",
                                        isWolf
                                            ? (m.sender === myUid ? "bg-[#8b1a1a]/80 text-[#e8dcc8]" : "bg-[#2a0a0a]/70 text-[#c62828]")
                                            : (m.sender === myUid ? "bg-[#8b5c3a]/70 text-[#0a0a0f]" : "bg-[#221f30]/70 text-[#a89b85]")
                                    )}>{m.text}</p>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <div className={clsx("p-2 border-t flex gap-1.5", isWolf ? "border-[#8b1a1a]/20" : "border-[#8b5c3a]/12")}>
                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder={isWolf ? "🐺 Nhắn cho sói..." : "Nhập tin nhắn..."}
                    className={clsx("flex-1 text-sm px-3 py-2 rounded-xl border outline-none",
                        isWolf
                            ? "border-[#8b1a1a]/30 bg-[#1a0505]/50 text-[#c62828] placeholder:text-[#8b1a1a]/30 focus:border-[#c62828]/50"
                            : "border-[#8b5c3a]/15 bg-[#16141f]/50 text-[#e8dcc8] placeholder:text-[#6b5f50] focus:border-[#c9873a]/30")} />
                <button onClick={send} className={clsx("p-2 text-[#e8dcc8] rounded-xl transition-colors",
                    isWolf ? "bg-[#8b1a1a]/70 hover:bg-[#a02020]/80" : "bg-[#8b5c3a]/70 hover:bg-[#a06b40]/80")}><Send size={14} /></button>
            </div>
        </div>
    );
};

// ==================== SEPARATED CHATS — General + Wolf ====================
const SeparatedChats: React.FC<{
    roomId: string; myUid: string; myName: string; myAvatar: string;
    channel: 'day' | 'wolf' | 'dead'; visibleChannels: string[];
    title?: string; maxHeight?: number; canSwitchToWolf?: boolean;
}> = ({ roomId, myUid, myName, myAvatar, visibleChannels, title = '💬 Thảo Luận', maxHeight = 250, canSwitchToWolf }) => {
    return (
        <div className={clsx("mt-4", canSwitchToWolf ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "")}>
            <ChatBox roomId={roomId} myUid={myUid} myName={myName} myAvatar={myAvatar}
                channel="day" visibleChannels={visibleChannels} title={title} maxHeight={maxHeight} />
            {canSwitchToWolf && (
                <ChatBox roomId={roomId} myUid={myUid} myName={myName} myAvatar={myAvatar}
                    channel="wolf" visibleChannels={visibleChannels} title="🐺 Chat Ma Sói" maxHeight={maxHeight} isWolf />
            )}
        </div>
    );
};

// ==================== GAME EVENT LOG — System Messages Panel ====================
const GameEventLog: React.FC<{ roomId: string }> = ({ roomId }) => {
    const [events, setEvents] = useState<WerewolfChatMessage[]>([]);
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        return MinigameService.subscribeToChat(roomId, (msgs) => {
            setEvents(msgs.filter(m => m.channel === 'system'));
        });
    }, [roomId]);

    useEffect(() => {
        if (logEndRef.current) {
            const container = logEndRef.current.parentElement;
            if (container) container.scrollTop = container.scrollHeight;
        }
    }, [events]);

    if (events.length === 0) return null;

    return (
        <div className="mt-4 rounded-xl border border-[#8b5c3a]/30 bg-[#16141f]/60 overflow-hidden">
            <div className="px-3 py-2 border-b border-[#8b5c3a]/15 bg-[#1a1825]/40 flex items-center gap-2">
                <span className="text-sm">📜</span>
                <span className="text-sm font-bold text-[#c9873a]" style={{ fontFamily: "'Playfair Display', serif" }}>Diễn biến cuộc chơi</span>
            </div>
            <div className="overflow-y-auto p-3 space-y-1" style={{ maxHeight: 180 }}>
                {events.map((e, i) => (
                    <div key={e.id || i} className="flex items-start gap-2 text-sm">
                        <span className="text-[#8b5c3a] text-xs mt-0.5 shrink-0">●</span>
                        <span className="text-[#a89b85]">{e.text}</span>
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>
        </div>
    );
};

// ==================== ROLE ABILITY DESCRIPTIONS ====================
const getRoleDesc = (role: string) => WOLF_ROLES.find(r => r.role === role)?.desc || '';
const getRoleIconByName = (role: string) => WOLF_ROLES.find(r => r.role === role)?.icon || '❓';

// ==================== WOLF ICON (SVG) — Howling Silhouette + Moon ====================
const WolfIcon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({ size = 24, className = '', style }) => {
    const id = React.useId();
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
            <defs>
                {/* Golden outer glow */}
                <filter id={`wolfGlow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                {/* Moon ambient glow */}
                <radialGradient id={`moonGrad-${id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0"/>
                </radialGradient>
            </defs>

            {/* Ambient moon glow behind everything */}
            <circle cx="38" cy="18" r="20" fill={`url(#moonGrad-${id})`}/>

            {/* Crescent moon */}
            <g filter={`url(#wolfGlow-${id})`}>
                <circle cx="38" cy="18" r="12" fill="currentColor" opacity="0.9"/>
                <circle cx="42" cy="15" r="9.5" fill="#1a1028" opacity="0.95"/>
            </g>

            {/* Wolf silhouette — howling upward, side profile */}
            <g filter={`url(#wolfGlow-${id})`}>
                <path d="
                    M 10,58
                    L 10,44
                    C 10,40 12,36 14,34
                    L 16,32
                    C 14,30 13,28 13,26
                    C 13,23 15,20 18,18
                    L 20,17
                    C 20,15 21,13 22,12
                    L 20,8
                    L 18,3
                    C 18,3 22,6 23,9
                    L 24,11
                    C 25,10 26,9 28,9
                    L 30,4
                    C 30,4 30,8 29,11
                    C 28,13 27,15 26,17
                    C 25,19 24,21 24,24
                    C 24,26 25,28 26,29
                    L 22,30
                    C 20,28 19,26 19,24
                    C 19,22 20,20 22,18
                    L 18,20
                    C 16,22 15,25 16,28
                    L 17,31
                    C 15,33 14,36 14,38
                    L 14,42
                    L 18,42
                    C 20,42 22,40 24,38
                    L 26,36
                    C 28,38 30,42 30,46
                    L 30,58
                    L 26,58
                    L 26,48
                    C 26,46 25,44 24,42
                    L 22,44
                    C 20,46 18,48 18,50
                    L 18,58
                    Z
                " fill="currentColor" opacity="0.95"/>
            </g>

            {/* Small stars twinkling */}
            <circle cx="8" cy="8" r="0.8" fill="currentColor" opacity="0.6"/>
            <circle cx="52" cy="10" r="0.6" fill="currentColor" opacity="0.5"/>
            <circle cx="56" cy="30" r="0.7" fill="currentColor" opacity="0.4"/>
            <circle cx="48" cy="38" r="0.5" fill="currentColor" opacity="0.3"/>
            <circle cx="6" cy="22" r="0.5" fill="currentColor" opacity="0.45"/>
            <circle cx="46" cy="5" r="0.6" fill="currentColor" opacity="0.35"/>
        </svg>
    );
};

// ==================== NORMALIZE PHASE ====================
// Backward compat: old phases 'night', 'day' => new phases
// ==================== ATMOSPHERIC EFFECTS ====================
const WerewolfAtmosphere: React.FC<{ phase: string }> = React.memo(({ phase }) => {
    const isNight = phase.startsWith('night');
    return (
        <div className={clsx("ww-atmosphere", isNight && "ww-atmosphere-night")}>
            {/* Fog wisps */}
            <div className="ww-fog-wisp" />
            <div className="ww-fog-wisp" />
            <div className="ww-fog-wisp" />

            {/* Spirit orbs */}
            <div className="ww-spirit-orb" />
            <div className="ww-spirit-orb" />
            <div className="ww-spirit-orb" />
            <div className="ww-spirit-orb" />
            <div className="ww-spirit-orb" />
            <div className="ww-spirit-orb" />

            {/* Bats — night only */}
            {isNight && <>
                <div className="ww-bat">🦇</div>
                <div className="ww-bat">🦇</div>
                <div className="ww-bat">🦇</div>
            </>}

            {/* Candle flames */}
            <div className="ww-candle" />
            <div className="ww-candle" />
            <div className="ww-candle" />

            {/* Blood drips — night/dramatic phases */}
            {(isNight || phase === 'day-vote' || phase === 'day-defense') && <>
                <div className="ww-blood-drip" />
                <div className="ww-blood-drip" />
                <div className="ww-blood-drip" />
                <div className="ww-blood-drip" />
                <div className="ww-blood-drip" />
            </>}

            {/* Scanline */}
            <div className="ww-scanline" />

            {/* Vignette */}
            <div className={clsx("ww-vignette", isNight && "ww-vignette-night")} />
        </div>
    );
});

// Phase transition flash effect
const PhaseTransitionFlash: React.FC<{ phase: string }> = React.memo(({ phase }) => {
    const [flashType, setFlashType] = useState<string | null>(null);
    const prevPhaseRef = useRef(phase);

    useEffect(() => {
        if (prevPhaseRef.current === phase) return;
        const prev = prevPhaseRef.current;
        prevPhaseRef.current = phase;

        // Determine flash type
        if (phase.startsWith('night') && !prev.startsWith('night')) {
            setFlashType('night');
        } else if (phase.startsWith('day') && prev.startsWith('night')) {
            setFlashType('day');
        } else if (phase === 'gameover') {
            setFlashType('blood');
        } else {
            return;
        }

        const timer = setTimeout(() => setFlashType(null), 1300);
        return () => clearTimeout(timer);
    }, [phase]);

    if (!flashType) return null;
    return <div className={`ww-phase-flash ww-phase-flash-${flashType}`} />;
});

const normalizePhase = (phase: string | undefined): string => {
    if (!phase) return 'waiting';
    // Old phases mapping
    if (phase === 'night') return 'night-wolf';
    if (phase === 'day') return 'day-discussion';
    return phase;
};

// ==================== MAIN WEREWOLF COMPONENT ====================
const OnlineWerewolf: React.FC<{ room: GameRoom; myUid: string; myName: string; myAvatar: string }> = React.memo(({ room, myUid, myName, myAvatar }) => {
    const gs = (room.gameState || {}) as WerewolfState;
    const phase = normalizePhase(gs.phase);
    const isHost = myUid === room.hostId;
    // Sync avatars from Firestore users
    const { users: firestoreUsers } = useData();
    const playerList = useMemo(() => {
        return Object.entries(room.players || {}).map(([uid, data]: [string, any]) => {
            // Decode the RTDB key back to email to match Firestore user
            const email = decodeEmail(uid);
            const firestoreUser = firestoreUsers.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
            // Priority: Firestore avatar > RTDB avatar > fallback
            const resolvedAvatar = firestoreUser?.avatar || data.avatar || '';
            return { uid, name: data.name, avatar: resolvedAvatar };
        });
    }, [room.players, firestoreUsers]);

    // Auto-sync avatars to RTDB when Firestore user has avatar but RTDB doesn't
    useEffect(() => {
        if (!firestoreUsers.length || !room.players) return;
        Object.entries(room.players).forEach(([uid, data]: [string, any]) => {
            if (data.avatar) return; // Already has avatar in RTDB
            const email = decodeEmail(uid);
            const firestoreUser = firestoreUsers.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
            if (firestoreUser?.avatar) {
                // Sync avatar from Firestore to RTDB
                MinigameService.joinRoom(room.id, email, data.name, firestoreUser.avatar).catch(() => {});
            }
        });
    }, [firestoreUsers, room.players, room.id]);
    const myRole = gs.roles?.[myUid];
    const isWolf = myRole?.role === 'Ma Sói' && myRole?.alive;
    const [showMyRole, setShowMyRole] = useState<false | 'scratch' | true>(false);
    const resolvingRef = useRef(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const [audioMuted, setAudioMuted] = useState(true);
    const prevPhaseForAudioRef = useRef(phase);
    // Custom role selection by host (null = auto mode)
    const [customRoleCounts, setCustomRoleCounts] = useState<Record<string, number> | null>(null);
    // Bot (AI) players
    const BOT_NAMES = ['Tuyển Công Bằng', 'Lê Thị Nga', '🤖 Trần Văn Hùng', '🤖 Phạm Thị Lan', '🤖 Hoàng Minh Tuấn', '🤖 Võ Thị Mai', '🤖 Đỗ Quang Hải', '🤖 Bùi Thị Hoa', '🤖 Ngô Đức Thắng', '🤖 Lý Thị Xuân', '🤖 Đặng Văn Phúc', '🤖 Vũ Thị Hằng'];
    const STEALTH_BOT_COUNT = 2; // First N bots look like real players
    const [botCount, setBotCount] = useState(0);
    const [autoResetTimeLeft, setAutoResetTimeLeft] = useState<number | null>(null);
    const botPlayers = useMemo(() => {
        const makeBotAvatar = (name: string, i: number) => {
            // For stealth bots, use initials from last words of name
            if (i < STEALTH_BOT_COUNT) {
                const words = name.replace('🤖 ', '').split(' ');
                const initials = words.length >= 2 ? words[words.length - 2][0] + words[words.length - 1][0] : words[0].slice(0, 2);
                return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=44&background=2a1f3d&color=c9873a&bold=true`;
            }
            return `https://ui-avatars.com/api/?name=B${i + 1}&size=44&background=4a3728&color=c9873a&bold=true`;
        };
        if (phase !== 'waiting' && gs.botUids) {
            return (gs.botUids as string[]).map((uid, i) => ({
                uid,
                name: BOT_NAMES[i] || `🤖 Bot ${i + 1}`,
                avatar: makeBotAvatar(BOT_NAMES[i] || `Bot ${i + 1}`, i),
                isBot: true,
            }));
        }
        return Array.from({ length: botCount }, (_, i) => ({
            uid: `__bot_${i}__`,
            name: BOT_NAMES[i] || `🤖 Bot ${i + 1}`,
            avatar: makeBotAvatar(BOT_NAMES[i] || `Bot ${i + 1}`, i),
            isBot: true,
        }));
    }, [botCount, phase, gs.botUids]);
    // Merge real + bot players
    const allPlayers = useMemo(() => [...playerList, ...botPlayers], [playerList, botPlayers]);
    const isBot = useCallback((uid: string) => uid.startsWith('__bot_'), []);
    const isStealthBot = useCallback((uid: string) => {
        if (!uid.startsWith('__bot_')) return false;
        const idx = parseInt(uid.replace('__bot_', '').replace('__', ''), 10);
        return idx < STEALTH_BOT_COUNT;
    }, []);

    // Audio: init on first click anywhere in the game
    const initAudio = useCallback(() => {
        if (!werewolfAudio.isInitialized()) {
            werewolfAudio.init();
            werewolfAudio.setVolume(0.25);
        }
    }, []);

    // Audio: phase-based ambient switching + one-shot effects
    useEffect(() => {
        if (!werewolfAudio.isInitialized() || audioMuted) return;
        const prev = prevPhaseForAudioRef.current;
        prevPhaseForAudioRef.current = phase;

        // Map game phase to audio phase
        let audioPhase: PhaseType = 'waiting';
        if (phase.startsWith('night')) audioPhase = 'night';
        else if (phase === 'day-vote' || phase === 'day-defense' || phase === 'day-revote') audioPhase = 'vote';
        else if (phase.startsWith('day')) audioPhase = 'day';
        else if (phase === 'gameover') audioPhase = 'gameover';
        else if (phase === 'waiting') audioPhase = 'waiting';

        // Set ambient
        werewolfAudio.setPhase(audioPhase);

        // One-shot effects on transitions
        if (prev !== phase) {
            if (phase.startsWith('night') && !prev.startsWith('night')) {
                werewolfAudio.playWolfHowl();
            } else if (phase === 'day-discussion' && prev.startsWith('night')) {
                werewolfAudio.playBellToll();
                if (gs.nightKilled) werewolfAudio.playDeathStinger();
            } else if (phase === 'day-vote') {
                werewolfAudio.playHeartbeat(15);
            } else if (phase === 'gameover') {
                werewolfAudio.playVictory();
            }
        }
    }, [phase, gs.nightKilled, audioMuted]);

    // Audio: cleanup on unmount
    useEffect(() => {
        return () => { werewolfAudio.destroy(); };
    }, []);

    const toggleAudio = useCallback(() => {
        // First click: init audio context (requires user gesture)
        if (!werewolfAudio.isInitialized()) {
            initAudio();
        }
        if (audioMuted) {
            // Unmute: resume context + start ambient
            if (werewolfAudio.isMuted()) werewolfAudio.toggleMute();
            setAudioMuted(false);
        } else {
            // Mute
            if (!werewolfAudio.isMuted()) werewolfAudio.toggleMute();
            setAudioMuted(true);
        }
    }, [initAudio, audioMuted]);

    // Reset all local UI state when game resets to waiting or new roles assigned
    useEffect(() => {
        if (phase === 'waiting') {
            setShowMyRole(false);
            setDefenseTimeLeft(30);
            setRevoteTimeLeft(10);
            setShowResetConfirm(false);
            resolvingRef.current = false;
            defenseTriggeredRef.current = false;
            revoteTriggeredRef.current = false;
        }
    }, [phase]);

    // Timers — MUST be declared at top level (Rules of Hooks) to prevent flicker
    const DEFENSE_DURATION = 30;
    const REVOTE_DURATION = 10;
    const [defenseTimeLeft, setDefenseTimeLeft] = useState(DEFENSE_DURATION);
    const [revoteTimeLeft, setRevoteTimeLeft] = useState(REVOTE_DURATION);
    const [startNightCountdown, setStartNightCountdown] = useState<number | null>(null);
    const defenseTriggeredRef = useRef(false);
    const revoteTriggeredRef = useRef(false);

    // Auto-start Night 1 Timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        const _botUids = gs.botUids || [];
        const _humanUids = gs.roles ? Object.keys(gs.roles).filter(uid => !_botUids.includes(uid)) : [];
        const _scratched = _humanUids.filter(uid => gs.scratchedCards?.[uid]).length;
        const _allScratched = _humanUids.length > 0 && _scratched === _humanUids.length;

        if (phase === 'roles-assigned' && _allScratched) {
            setStartNightCountdown(prev => prev === null ? 10 : prev);
            interval = setInterval(() => {
                setStartNightCountdown(prev => {
                    if (prev === null || prev <= 1) {
                        clearInterval(interval);
                        return 0; // Trigger effect below
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            setStartNightCountdown(null);
        }
        return () => clearInterval(interval);
    }, [phase, gs.scratchedCards, gs.roles, gs.botUids]);

    // Handle Night 1 countdown reaching 0
    useEffect(() => {
        if (startNightCountdown === 0 && isHost && phase === 'roles-assigned') {
            startNight();
            setStartNightCountdown(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startNightCountdown, isHost, phase]);

    // Defense timer effect (runs only during day-defense phase)
    useEffect(() => {
        if (phase !== 'day-defense') {
            defenseTriggeredRef.current = false;
            return;
        }
        const defenseStarted = gs.defenseStartedAt || Date.now();
        // Initialize time left immediately
        const initialElapsed = Math.floor((Date.now() - defenseStarted) / 1000);
        setDefenseTimeLeft(Math.max(0, DEFENSE_DURATION - initialElapsed));
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - defenseStarted) / 1000);
            const remaining = Math.max(0, DEFENSE_DURATION - elapsed);
            setDefenseTimeLeft(remaining);
            if (remaining <= 0 && isHost && !defenseTriggeredRef.current) {
                defenseTriggeredRef.current = true;
                clearInterval(interval);
                startRevote();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [phase, gs.defenseStartedAt, isHost]);

    // Revote timer effect (runs only during day-revote phase)
    useEffect(() => {
        if (phase !== 'day-revote') {
            revoteTriggeredRef.current = false;
            return;
        }
        const revoteStarted = gs.revoteStartedAt || Date.now();
        const initialElapsed = Math.floor((Date.now() - revoteStarted) / 1000);
        setRevoteTimeLeft(Math.max(0, REVOTE_DURATION - initialElapsed));
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - revoteStarted) / 1000);
            const remaining = Math.max(0, REVOTE_DURATION - elapsed);
            setRevoteTimeLeft(remaining);
            if (remaining <= 0 && isHost && !revoteTriggeredRef.current) {
                revoteTriggeredRef.current = true;
                clearInterval(interval);
                finalResolveVote();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [phase, gs.revoteStartedAt, isHost]);

    // Night-resolve auto-trigger — MUST be at top-level (Rules of Hooks)
    useEffect(() => {
        if (phase !== 'night-resolve' || !isHost) return;
        
        let cancelled = false;
        const tryResolve = async (attempt = 0) => {
            if (cancelled || resolvingRef.current) return;
            resolvingRef.current = true;
            try {
                await resolveNight();
            } catch (e) {
                console.error(`resolveNight error (attempt ${attempt + 1}):`, e);
                // Retry up to 5 times with exponential backoff
                if (!cancelled && attempt < 5) {
                    await new Promise(r => setTimeout(r, Math.min((attempt + 1) * 1000, 5000)));
                    resolvingRef.current = false;
                    return tryResolve(attempt + 1);
                }
                // All retries exhausted — auto-fallback to day-discussion
                if (!cancelled) {
                    console.warn('resolveNight: All retries exhausted, falling back to day-discussion');
                    try {
                        await MinigameService.mergeGameState(room.id, {
                            phase: 'day-discussion',
                            nightLog: '☀️ Đêm bình yên (tự động bỏ qua do lỗi).',
                            nightKilled: null,
                        });
                        await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: '⚠️ Lỗi tổng hợp đêm — tự động bỏ qua.', timestamp: Date.now(), channel: 'system' });
                    } catch (fallbackErr) {
                        console.error('resolveNight fallback also failed:', fallbackErr);
                    }
                }
            } finally {
                resolvingRef.current = false;
            }
        };

        // Safety timeout: if still stuck after 15s, force-skip
        const safetyTimeout = setTimeout(() => {
            if (cancelled) return;
            console.warn('resolveNight: Safety timeout triggered (15s)');
            resolvingRef.current = false;
            MinigameService.mergeGameState(room.id, {
                phase: 'day-discussion',
                nightLog: '☀️ Đêm bình yên (timeout).',
                nightKilled: null,
            }).catch(() => {});
        }, 15000);

        tryResolve();
        return () => { cancelled = true; clearTimeout(safetyTimeout); };
    }, [phase, isHost]);

    // Auto-skip night phases if role is dead — MUST be at top-level hooks
    const hasWolfAlive = Object.entries(gs.roles || {}).some(([, r]) => (r as any).role === 'Ma Sói' && (r as any).alive);
    const hasSeerAlive = Object.entries(gs.roles || {}).some(([, r]) => (r as any).role === 'Tiên tri' && (r as any).alive);
    const hasGuardAlive = Object.entries(gs.roles || {}).some(([, r]) => (r as any).role === 'Bảo vệ' && (r as any).alive);
    const hasWitchAlive = Object.entries(gs.roles || {}).some(([, r]) => (r as any).role === 'Phù thủy' && (r as any).alive);

    // Auto-skip night-wolf if ALL wolves are dead
    useEffect(() => {
        if (phase === 'night-wolf' && isHost && !hasWolfAlive) {
            MinigameService.mergeGameState(room.id, {
                wolfTarget: null, 'nightActionsComplete/wolves': true, phase: 'night-seer',
            }).catch(e => console.error('auto-skip wolf:', e));
        }
    }, [phase, isHost, hasWolfAlive]);

    // Auto-skip Seer night phase if Seer is dead
    useEffect(() => {
        if (phase === 'night-seer' && isHost && !hasSeerAlive) { skipSeer(); }
    }, [phase, isHost, hasSeerAlive]);

    useEffect(() => {
        if (phase === 'night-guard' && isHost && !hasGuardAlive) { skipGuard(); }
    }, [phase, isHost, hasGuardAlive]);

    useEffect(() => {
        if (phase === 'night-witch' && isHost && !hasWitchAlive) { witchDone(); }
    }, [phase, isHost, hasWitchAlive]);

    // Auto-transfer host when host character is killed
    const hostRole = gs.roles?.[room.hostId];
    const isHostDead = hostRole && !hostRole.alive;
    useEffect(() => {
        if (!isHost || !isHostDead || phase === 'waiting' || phase === 'gameover' || !gs.roles) return;
        // Find a random alive player to be new host
        const alivePlayerUids = Object.entries(gs.roles)
            .filter(([uid, r]) => (r as any).alive && uid !== room.hostId && !isBot(uid))
            .map(([uid]) => uid);
        if (alivePlayerUids.length === 0) return;
        const newHostUid = alivePlayerUids[Math.floor(Math.random() * alivePlayerUids.length)];
        const newHostName = playerList.find(p => p.uid === newHostUid)?.name || '???';
        MinigameService.transferHost(room.id, newHostUid).then(() => {
            MinigameService.sendChat(room.id, {
                sender: 'system', senderName: 'Hệ thống', senderAvatar: '',
                text: `👑 Trưởng làng đã ngã xuống! ${newHostName} trở thành Trưởng làng mới.`,
                timestamp: Date.now(), channel: 'system',
            });
        }).catch(e => console.error('auto-transfer host error:', e));
    }, [isHost, isHostDead, phase]);

    // Auto-transfer host back to original creator at gameover
    useEffect(() => {
        if (phase !== 'gameover' || !gs.originalHostId) return;
        // Only the current host triggers transfer to avoid race conditions
        if (!isHost || room.hostId === gs.originalHostId) return;
        const origName = playerList.find(p => p.uid === gs.originalHostId)?.name || '???';
        MinigameService.transferHost(room.id, gs.originalHostId).then(() => {
            MinigameService.sendChat(room.id, {
                sender: 'system', senderName: 'Hệ thống', senderAvatar: '',
                text: `👑 Quyền Trưởng làng được trao lại cho ${origName}.`,
                timestamp: Date.now(), channel: 'system',
            });
        }).catch(e => console.error('restore host error:', e));
    }, [phase, isHost]);

    const alivePlayers = allPlayers.filter(p => gs.roles?.[p.uid]?.alive);
    const aliveOthers = alivePlayers.filter(p => p.uid !== myUid);

    // Auto-resolve vote after 5 seconds when all alive players have voted
    const totalAliveCount = alivePlayers.length;
    const totalVotedCount = Object.keys(gs.votes || {}).length + (gs.skipVotes || []).length;
    const allVoted = phase === 'day-vote' && totalAliveCount > 0 && totalVotedCount >= totalAliveCount;
    const [voteCountdown, setVoteCountdown] = useState<number | null>(null);
    const [discussionCountdown, setDiscussionCountdown] = useState<number | null>(null);
    const [resultCountdown, setResultCountdown] = useState<number | null>(null);

    useEffect(() => {
        if (!allVoted) { setVoteCountdown(null); return; }
        setVoteCountdown(10);
        const interval = setInterval(() => {
            setVoteCountdown(prev => {
                if (prev === null || prev <= 1) { clearInterval(interval); return 0; }
                return prev - 1;
            });
        }, 1000);
        const timer = setTimeout(() => {
            if (isHost && !resolvingRef.current) {
                resolvingRef.current = true;
                resolveVote().finally(() => { resolvingRef.current = false; });
            }
        }, 10000);
        return () => { clearInterval(interval); clearTimeout(timer); };
    }, [allVoted, isHost]);

    // Auto-transition: day-discussion to day-vote after 20 seconds
    useEffect(() => {
        if (phase !== 'day-discussion') {
            setDiscussionCountdown(null);
            return;
        }
        setDiscussionCountdown(20);
        const interval = setInterval(() => {
            setDiscussionCountdown(prev => {
                if (prev === null || prev <= 1) { clearInterval(interval); return 0; }
                return prev - 1;
            });
        }, 1000);
        const timer = setTimeout(() => {
            if (isHost && !resolvingRef.current && (room.gameState as any)?.phase === 'day-discussion') {
                resolvingRef.current = true;
                startDayVote().finally(() => { resolvingRef.current = false; });
            }
        }, 20000);
        return () => { clearInterval(interval); clearTimeout(timer); };
    }, [phase, isHost]);

    // Auto-transition: day-result to next night after 10 seconds
    useEffect(() => {
        if (phase !== 'day-result') {
            setResultCountdown(null);
            return;
        }
        setResultCountdown(10);
        const interval = setInterval(() => {
            setResultCountdown(prev => {
                if (prev === null || prev <= 1) { clearInterval(interval); return 0; }
                return prev - 1;
            });
        }, 1000);
        const timer = setTimeout(() => {
            if (isHost && !resolvingRef.current && (room.gameState as any)?.phase === 'day-result') {
                resolvingRef.current = true;
                startNight().finally(() => { resolvingRef.current = false; });
            }
        }, 10000);
        return () => { clearInterval(interval); clearTimeout(timer); };
    }, [phase, isHost, gs.night]);
    const playerNames: Record<string, { name: string; avatar: string }> = {};
    allPlayers.forEach(p => { playerNames[p.uid] = { name: p.name, avatar: p.avatar }; });

    // Determine chat channel
    const getChatChannel = (): 'day' | 'wolf' | 'dead' => {
        if (!myRole?.alive) return 'dead';
        if (phase.startsWith('night') && myRole?.role === 'Ma Sói') return 'wolf';
        return 'day';
    };
    const getVisibleChannels = (): string[] => {
        const ch = ['system'];
        if (!myRole?.alive) { ch.push('dead', 'day'); return ch; }
        if (phase.startsWith('day') || phase === 'roles-assigned' || phase === 'waiting') ch.push('day');
        if (myRole?.role === 'Ma Sói') ch.push('wolf');
        if (phase.startsWith('night') && myRole?.role !== 'Ma Sói') ch.push('day'); // can still see day during night
        return ch;
    };

    // ---- ROLE ASSIGNMENT (fully random each time, no repeat from previous game) ----
    const assignRoles = async () => {
        try {
            const uids = allPlayers.map(p => p.uid);
            const botUids = botPlayers.map(p => p.uid);
            const n = uids.length; if (n < 5) return;
            const roles: string[] = [];

            if (customRoleCounts) {
                // Use host's manual role selection
                for (const [roleName, count] of Object.entries(customRoleCounts)) {
                    for (let i = 0; i < count; i++) roles.push(roleName);
                }
                // Safety check: total must match player count
                if (roles.length !== n) {
                    alert(`Tổng số vai (${roles.length}) phải bằng số người chơi (${n})!`);
                    return;
                }
                // Must have at least 1 wolf
                if (!roles.includes('Ma Sói')) {
                    alert('Cần ít nhất 1 Ma Sói!');
                    return;
                }
            } else {
                // Auto mode (default)
                const wolfCount = n <= 6 ? 2 : n <= 9 ? 2 : 3;
                for (let i = 0; i < wolfCount; i++) roles.push('Ma Sói');
                roles.push('Tiên tri', 'Bảo vệ');
                if (n >= 6) roles.push('Phù thủy');
                if (n >= 7) roles.push('Thợ săn');
                if (n >= 8) roles.push('Kẻ chán đời');
                if (n >= 9) roles.push('Kẻ tẩm dầu');
                while (roles.length < n) roles.push('Dân làng');
            }

            // Fisher-Yates shuffle with crypto-grade randomness for better unpredictability
            const getSecureRandom = () => {
                if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                    const arr = new Uint32Array(1);
                    crypto.getRandomValues(arr);
                    return arr[0] / (0xFFFFFFFF + 1);
                }
                return Math.random();
            };

            // Get previous roles to avoid repeat assignments
            // (saved in `previousRoles` field during reset, or fallback to current roles)
            const prevRoles = gs.previousRoles || gs.roles || {};

            // Shuffle and ensure no player gets the same role as previous game
            let bestRoles: string[] = [];
            let bestConflicts = n + 1;

            // Try up to 20 shuffles, pick the one with fewest conflicts
            for (let attempt = 0; attempt < 20; attempt++) {
                const tryRoles = [...roles];
                // Double Fisher-Yates shuffle
                for (let pass = 0; pass < 2; pass++) {
                    for (let i = tryRoles.length - 1; i > 0; i--) {
                        const j = Math.floor(getSecureRandom() * (i + 1));
                        [tryRoles[i], tryRoles[j]] = [tryRoles[j], tryRoles[i]];
                    }
                }

                // Also shuffle the uids order
                const tryUids = [...uids];
                for (let i = tryUids.length - 1; i > 0; i--) {
                    const j = Math.floor(getSecureRandom() * (i + 1));
                    [tryUids[i], tryUids[j]] = [tryUids[j], tryUids[i]];
                }

                // Count conflicts (same non-wolf role as previous game)
                // Wolves CAN repeat, but special roles must change
                let conflicts = 0;
                tryUids.forEach((uid, i) => {
                    const role = tryRoles[i];
                    if (prevRoles[uid]?.role === role && role !== 'Ma Sói') conflicts++;
                    // Bot cannot be a Wolf or 3rd Party!
                    if (uid.startsWith('__bot_') && ['Ma Sói', 'Kẻ chán đời', 'Kẻ tẩm dầu'].includes(role)) conflicts += 1000;
                });

                if (conflicts < bestConflicts) {
                    bestConflicts = conflicts;
                    bestRoles = tryRoles.map((role, i) => `${tryUids[i]}::${role}`);
                }

                // Perfect — no conflicts at all
                if (conflicts === 0) break;
            }

            // Parse the best result
            const roleMap: any = {};
            bestRoles.forEach(entry => {
                const [uid, roleName] = entry.split('::');
                const r = WOLF_ROLES.find(x => x.role === roleName)!;
                roleMap[uid] = { role: r.role, icon: r.icon, alive: true };
            });

            // Final safety: try to fix any remaining non-wolf conflicts by swapping
            if (bestConflicts > 0) {
                const conflictUids = Object.keys(roleMap).filter(uid =>
                    prevRoles[uid]?.role === roleMap[uid].role && roleMap[uid].role !== 'Ma Sói'
                );
                const okUids = Object.keys(roleMap).filter(uid => !conflictUids.includes(uid));
                for (const cUid of conflictUids) {
                    // Find someone with a different role who can swap (skip wolf swaps)
                    const swapPartner = okUids.find(oUid =>
                        roleMap[oUid].role !== roleMap[cUid].role &&
                        (prevRoles[oUid]?.role !== roleMap[cUid].role || roleMap[cUid].role === 'Ma Sói') &&
                        (prevRoles[cUid]?.role !== roleMap[oUid].role || roleMap[oUid].role === 'Ma Sói')
                    );
                    if (swapPartner) {
                        const temp = { ...roleMap[cUid] };
                        roleMap[cUid] = { ...roleMap[swapPartner] };
                        roleMap[swapPartner] = temp;
                        okUids.splice(okUids.indexOf(swapPartner), 1);
                    }
                }
            }

            // *** CRITICAL: Ensure bots NEVER get the Wolf or 3rd Party roles ***
            // Swap any bot-restricted-role with a human safe-role
            if (botUids.length > 0) {
                const restrictedRoles = ['Ma Sói', 'Kẻ chán đời', 'Kẻ tẩm dầu'];
                const restrictedCount = Object.values(roleMap).filter((r: any) => restrictedRoles.includes(r.role)).length;
                const humanUids = uids.filter(uid => !botUids.includes(uid));
                // Validate: enough humans for all restricted roles
                if (humanUids.length < restrictedCount) {
                    alert(`Cần ít nhất ${restrictedCount} người thật để làm phe Sói và Phe Thứ 3! (hiện có ${humanUids.length} người)`);
                    return;
                }
                // Find bots that got restricted roles and swap them
                const botRestricted = botUids.filter(uid => restrictedRoles.includes(roleMap[uid]?.role));
                for (const botUid of botRestricted) {
                    const humanSafe = humanUids.find(uid => !restrictedRoles.includes(roleMap[uid]?.role));
                    if (humanSafe) {
                        // Swap roles
                        const temp = { ...roleMap[botUid] };
                        roleMap[botUid] = { ...roleMap[humanSafe] };
                        roleMap[humanSafe] = temp;
                    }
                }
            }

            await MinigameService.clearChat(room.id);
            // Full clean state — ensures no leftover data from previous game
            await MinigameService.updateGameState(room.id, {
                phase: 'roles-assigned', roles: roleMap, previousRoles: null, night: 0,
                originalHostId: room.hostId, // remember who started the game
                wolfVotes: {}, wolfTarget: null,
                guardTarget: null, guardLastTarget: null,
                witchSaveUsed: false, witchKillUsed: false,
                witchSaveThisNight: false, witchKillTarget: null,
                nightActionsComplete: {}, nightKilled: null, nightLog: '',
                votes: {}, skipVotes: [], voteResult: null, gameLog: [],
                defenseTarget: null, defenseStartedAt: null,
                revoteStartedAt: null, gameResult: null, gameoverAt: null,
                seerTarget: null, seerResult: null,
                hunterPinned: null, hunterLastPinned: null, hunterTarget: null, hunterPending: false, hunterDiedFrom: null,
                arsonistOiled: [], arsonistActionThisNight: null, arsonistOilTarget: null,
                tannerWin: false,
                botUids: botUids.length > 0 ? botUids : null,
                scratchedCards: {},
            });
        } catch (e) { console.error('assignRoles error:', e); }
    };

    // ---- START NIGHT ----
    const startNight = async () => {
        try {
            const nightNum = (gs.night || 0) + 1;
            await MinigameService.mergeGameState(room.id, {
                phase: 'night-wolf', night: nightNum,
                wolfVotes: {}, wolfTarget: null,
                guardTarget: null, witchSaveThisNight: false, witchKillTarget: null,
                nightKilled: null, nightLog: '', seerTarget: null, seerResult: null,
                arsonistActionThisNight: null, arsonistOilTarget: null,
                hunterPinned: null, hunterTarget: null,
                nightActionsComplete: { wolves: false, seer: false, guard: false, witch: false, hunter: false },
            });
            await MinigameService.sendChat(room.id, {
                sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: `🌙 Đêm ${nightNum} bắt đầu. Mọi người nhắm mắt...`,
                timestamp: Date.now(), channel: 'system',
            });
        } catch (e) { console.error('startNight error:', e); }
    };

    // ---- WOLF VOTE ----
    const wolfVote = async (targetUid: string) => {
        try {
            const newVotes = { ...(gs.wolfVotes || {}), [myUid]: targetUid };
            await MinigameService.mergeGameState(room.id, { wolfVotes: newVotes });
            const aliveWolves = Object.entries(gs.roles || {}).filter(([, r]) => (r as any).role === 'Ma Sói' && (r as any).alive).map(([uid]) => uid);
            const allVoted = aliveWolves.every(w => newVotes[w]);
            if (allVoted) {
                const voteCounts: Record<string, number> = {};
                Object.values(newVotes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
                const maxVotes = Math.max(...Object.values(voteCounts));
                const target = Object.entries(voteCounts).find(([, c]) => c === maxVotes)?.[0] || null;
                await MinigameService.mergeGameState(room.id, {
                    wolfTarget: target, 'nightActionsComplete/wolves': true, phase: 'night-seer',
                });
            }
        } catch (e) { console.error('wolfVote error:', e); }
    };

    // ---- SEER PEEK (each night, peek at 1 person to learn if wolf) ----
    const seerPeek = async (targetUid: string) => {
        try {
            const targetRole = gs.roles?.[targetUid]?.role;
            const isWolfResult = targetRole === 'Ma Sói';
            // Store result but DON'T change phase yet — let Seer see the result first
            await MinigameService.mergeGameState(room.id, {
                seerTarget: targetUid, seerResult: isWolfResult ? 'wolf' : 'village',
                'nightActionsComplete/seer': true,
            });
        } catch (e) { console.error('seerPeek error:', e); }
    };

    const confirmSeerResult = async () => {
        try {
            await MinigameService.mergeGameState(room.id, { phase: 'night-guard' });
        } catch (e) { console.error('confirmSeerResult error:', e); }
    };

    const skipSeer = async () => {
        try {
            await MinigameService.mergeGameState(room.id, { seerTarget: null, seerResult: null, 'nightActionsComplete/seer': true, phase: 'night-guard' });
        } catch (e) { console.error('skipSeer error:', e); }
    };

    // ---- GUARD PROTECT ----
    const guardProtect = async (targetUid: string) => {
        try {
            await MinigameService.mergeGameState(room.id, {
                guardTarget: targetUid, 'nightActionsComplete/guard': true, phase: 'night-witch',
            });
        } catch (e) { console.error('guardProtect error:', e); }
    };

    const skipGuard = async () => {
        try {
            await MinigameService.mergeGameState(room.id, { guardTarget: null, 'nightActionsComplete/guard': true, phase: 'night-witch' });
        } catch (e) { console.error('skipGuard error:', e); }
    };

    // ---- WITCH ACTIONS (reversible until witchDone) ----
    const witchSave = async () => {
        try { await MinigameService.mergeGameState(room.id, { witchSaveThisNight: true }); } catch (e) { console.error('witchSave error:', e); }
    };
    const witchUndoSave = async () => {
        try { await MinigameService.mergeGameState(room.id, { witchSaveThisNight: false }); } catch (e) { console.error('witchUndoSave error:', e); }
    };

    const witchKill = async (targetUid: string) => {
        try { await MinigameService.mergeGameState(room.id, { witchKillTarget: targetUid }); } catch (e) { console.error('witchKill error:', e); }
    };
    const witchUndoKill = async () => {
        try { await MinigameService.mergeGameState(room.id, { witchKillTarget: null }); } catch (e) { console.error('witchUndoKill error:', e); }
    };

    const witchDone = async () => {
        try {
            const updates: Record<string, any> = { 'nightActionsComplete/witch': true, phase: 'night-hunter' };
            if (gs.witchSaveThisNight) updates.witchSaveUsed = true;
            if (gs.witchKillTarget) updates.witchKillUsed = true;
            await MinigameService.mergeGameState(room.id, updates);
        } catch (e) { console.error('witchDone error:', e); }
    };

    // ---- HUNTER ACTIONS ----
    const hasHunterAlive = Object.entries(gs.roles || {}).some(([, r]) => (r as any).role === 'Thợ săn' && (r as any).alive);

    const hunterPin = async (targetUid: string) => {
        try { await MinigameService.mergeGameState(room.id, { hunterPinned: targetUid }); } catch (e) { console.error('hunterPin error:', e); }
    };

    const hunterDone = async () => {
        try {
            await MinigameService.mergeGameState(room.id, { 'nightActionsComplete/hunter': true, phase: 'night-arsonist' });
        } catch (e) { console.error('hunterDone error:', e); }
    };

    const skipHunter = async () => {
        try { await MinigameService.mergeGameState(room.id, { phase: 'night-arsonist' }); } catch (e) { console.error('skipHunter error:', e); }
    };

    useEffect(() => {
        if (phase === 'night-hunter' && isHost && !hasHunterAlive) { skipHunter(); }
    }, [phase, isHost, hasHunterAlive]);

    // ---- ARSONIST ACTIONS ----
    const hasArsonistAlive = Object.entries(gs.roles || {}).some(([, r]) => (r as any).role === 'Kẻ tẩm dầu' && (r as any).alive);

    const arsonistOil = async (targetUid: string) => {
        try {
            await MinigameService.mergeGameState(room.id, {
                arsonistActionThisNight: 'oil',
                arsonistOilTarget: targetUid,
            });
        } catch (e) { console.error('arsonistOil error:', e); }
    };

    const arsonistIgnite = async () => {
        try {
            await MinigameService.mergeGameState(room.id, {
                arsonistActionThisNight: 'ignite',
                arsonistOilTarget: null,
            });
        } catch (e) { console.error('arsonistIgnite error:', e); }
    };

    const arsonistDone = async () => {
        try {
            const updates: Record<string, any> = { phase: 'night-resolve' };
            if (gs.arsonistActionThisNight === 'oil' && gs.arsonistOilTarget) {
                const currentOiled = gs.arsonistOiled || [];
                if (!currentOiled.includes(gs.arsonistOilTarget)) {
                    updates.arsonistOiled = [...currentOiled, gs.arsonistOilTarget];
                }
            }
            await MinigameService.mergeGameState(room.id, updates);
        } catch (e) { console.error('arsonistDone error:', e); }
    };

    const skipArsonist = async () => {
        try {
            await MinigameService.mergeGameState(room.id, { phase: 'night-resolve' });
        } catch (e) { console.error('skipArsonist error:', e); }
    };

    useEffect(() => {
        if (phase === 'night-arsonist' && isHost && !hasArsonistAlive) { skipArsonist(); }
    }, [phase, isHost, hasArsonistAlive]);

    // ============ BOT AI AUTO-ACTIONS ============
    // Host executes all bot actions with random delays to simulate think time
    const botActionRef = useRef(false);
    useEffect(() => {
        if (!isHost || !gs.botUids || gs.botUids.length === 0) return;
        if (botActionRef.current) return;

        const botUidsList = gs.botUids;
        const roles = gs.roles || {};
        const getAliveBots = (roleName?: string) =>
            botUidsList.filter(uid => roles[uid]?.alive && (!roleName || roles[uid]?.role === roleName));
        const getRandomAliveTarget = (excludeUids: string[] = []) => {
            const targets = Object.entries(roles).filter(([uid, r]) => (r as any).alive && !excludeUids.includes(uid)).map(([uid]) => uid);
            return targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : null;
        };

        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
        const shortDelay = () => delay(2000 + Math.random() * 2000); // 2-4s (voting)
        const thinkDelay = () => delay(15000 + Math.random() * 5000); // 15-20s (special roles pretend to think)

        // --- NIGHT: Wolf bots auto-vote (smart: follow human wolf's lead) ---
        if (phase === 'night-wolf') {
            const aliveBotWolves = getAliveBots('Ma Sói');
            const currentVotes = gs.wolfVotes || {};
            const unresolvedBots = aliveBotWolves.filter(uid => !currentVotes[uid]);
            if (unresolvedBots.length > 0) {
                const aliveWolves = Object.entries(roles).filter(([, r]) => (r as any).role === 'Ma Sói' && (r as any).alive).map(([uid]) => uid);
                const humanWolves = aliveWolves.filter(uid => !botUidsList.includes(uid));
                // Check if any human wolf has voted already
                const humanWolfVotes = humanWolves.filter(uid => currentVotes[uid]);
                const allWolvesAreBots = humanWolves.length === 0;

                if (allWolvesAreBots || humanWolfVotes.length > 0) {
                    // All wolves are bots → vote randomly
                    // OR a human wolf has voted → bot follows the human's target
                    botActionRef.current = true;
                    (async () => {
                        await shortDelay();
                        const newVotes = { ...currentVotes };
                        // Determine target: follow human wolf or pick random
                        const humanTarget = humanWolfVotes.length > 0 ? currentVotes[humanWolfVotes[0]] : null;
                        for (const botUid of unresolvedBots) {
                            if (humanTarget) {
                                // Follow human wolf's choice
                                newVotes[botUid] = humanTarget;
                            } else {
                                // All bots: pick random non-wolf target
                                const target = getRandomAliveTarget(Object.keys(roles).filter(uid => roles[uid]?.role === 'Ma Sói'));
                                if (target) newVotes[botUid] = target;
                            }
                        }
                        const allWolvesVoted = aliveWolves.every(w => newVotes[w]);
                        if (allWolvesVoted) {
                            const voteCounts: Record<string, number> = {};
                            Object.values(newVotes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
                            const maxVotes = Math.max(...Object.values(voteCounts));
                            const target = Object.entries(voteCounts).find(([, c]) => c === maxVotes)?.[0] || null;
                            await MinigameService.mergeGameState(room.id, { wolfVotes: newVotes, wolfTarget: target, 'nightActionsComplete/wolves': true, phase: 'night-seer' });
                        } else {
                            await MinigameService.mergeGameState(room.id, { wolfVotes: newVotes });
                        }
                        botActionRef.current = false;
                    })();
                }
                // else: human wolves exist but haven't voted yet → bots wait patiently
                // Timeout fallback: if human hasn't voted in 10s, bots vote on their own
                else if (!allWolvesAreBots && humanWolfVotes.length === 0) {
                    const timerId = setTimeout(() => {
                        if (botActionRef.current) return;
                        botActionRef.current = true;
                        (async () => {
                            const freshVotes = gs.wolfVotes || {};
                            const stillUnvoted = aliveBotWolves.filter(uid => !freshVotes[uid]);
                            if (stillUnvoted.length === 0) { botActionRef.current = false; return; }
                            // Humans still haven't voted after timeout → bots vote randomly
                            const newVotes = { ...freshVotes };
                            for (const botUid of stillUnvoted) {
                                const target = getRandomAliveTarget(Object.keys(roles).filter(uid => roles[uid]?.role === 'Ma Sói'));
                                if (target) newVotes[botUid] = target;
                            }
                            await MinigameService.mergeGameState(room.id, { wolfVotes: newVotes });
                            botActionRef.current = false;
                        })();
                    }, 10000);
                    return () => clearTimeout(timerId);
                }
            }
        }

        // --- NIGHT: Seer bot auto-peek ---
        if (phase === 'night-seer' && !gs.seerTarget) {
            const botSeer = getAliveBots('Tiên tri');
            if (botSeer.length > 0) {
                botActionRef.current = true;
                (async () => {
                    await thinkDelay();
                    const target = getRandomAliveTarget(botSeer);
                    if (target) {
                        const isWolfResult = roles[target]?.role === 'Ma Sói';
                        await MinigameService.mergeGameState(room.id, { seerTarget: target, seerResult: isWolfResult ? 'wolf' : 'village', 'nightActionsComplete/seer': true });
                        await delay(1500);
                        await MinigameService.mergeGameState(room.id, { phase: 'night-guard' });
                    }
                    botActionRef.current = false;
                })();
            }
        }

        // --- NIGHT: Guard bot auto-protect ---
        if (phase === 'night-guard' && !gs.guardTarget) {
            const botGuard = getAliveBots('Bảo vệ');
            if (botGuard.length > 0) {
                botActionRef.current = true;
                (async () => {
                    await thinkDelay();
                    const target = getRandomAliveTarget([]);
                    if (target) {
                        await MinigameService.mergeGameState(room.id, { guardTarget: target, 'nightActionsComplete/guard': true, phase: 'night-witch' });
                    }
                    botActionRef.current = false;
                })();
            }
        }

        // --- NIGHT: Witch bot auto-act ---
        if (phase === 'night-witch') {
            const botWitch = getAliveBots('Phù thủy');
            if (botWitch.length > 0 && !(gs.nightActionsComplete as any)?.witch) {
                botActionRef.current = true;
                (async () => {
                    await thinkDelay();
                    const updates: Record<string, any> = { 'nightActionsComplete/witch': true, phase: 'night-hunter' };
                    // 50% chance to save if wolf target is set and save not used
                    if (gs.wolfTarget && !gs.witchSaveUsed && Math.random() > 0.5) {
                        updates.witchSaveThisNight = true;
                        updates.witchSaveUsed = true;
                    }
                    // 30% chance to kill if kill not used
                    else if (!gs.witchKillUsed && Math.random() > 0.7) {
                        const killTarget = getRandomAliveTarget(botWitch);
                        if (killTarget) {
                            updates.witchKillTarget = killTarget;
                            updates.witchKillUsed = true;
                        }
                    }
                    await MinigameService.mergeGameState(room.id, updates);
                    botActionRef.current = false;
                })();
            }
        }

        // --- NIGHT: Hunter bot auto-act ---
        if (phase === 'night-hunter') {
            const botHunter = getAliveBots('Thợ săn');
            if (botHunter.length > 0 && !(gs.nightActionsComplete as any)?.hunter) {
                botActionRef.current = true;
                (async () => {
                    await thinkDelay();
                    const updates: Record<string, any> = { 'nightActionsComplete/hunter': true, phase: 'night-arsonist' };
                    // Cho Bot thợ săn 70% tỉ lệ ghim mục tiêu ngẫu nhiên
                    if (Math.random() > 0.3) {
                        const pinTarget = getRandomAliveTarget(botHunter);
                        if (pinTarget) {
                            updates.hunterPinned = pinTarget;
                        }
                    }
                    await MinigameService.mergeGameState(room.id, updates);
                    botActionRef.current = false;
                })();
            }
        }

        // --- NIGHT: Arsonist bot auto-act ---
        if (phase === 'night-arsonist') {
            const botArsonist = getAliveBots('Kẻ tẩm dầu');
            if (botArsonist.length > 0) {
                botActionRef.current = true;
                (async () => {
                    await thinkDelay();
                    const oiled = gs.arsonistOiled || [];
                    const aliveOiled = oiled.filter(uid => roles[uid]?.alive);
                    // If 3+ oiled alive, 40% chance to ignite
                    if (aliveOiled.length >= 3 && Math.random() > 0.6) {
                        await MinigameService.mergeGameState(room.id, { arsonistActionThisNight: 'ignite', arsonistOilTarget: null });
                    } else {
                        // Oil a random target (not already oiled, not self)
                        const targets = Object.entries(roles).filter(([uid, r]) => (r as any).alive && !oiled.includes(uid) && !botArsonist.includes(uid)).map(([uid]) => uid);
                        if (targets.length > 0) {
                            const target = targets[Math.floor(Math.random() * targets.length)];
                            await MinigameService.mergeGameState(room.id, { arsonistActionThisNight: 'oil', arsonistOilTarget: target });
                        }
                    }
                    await delay(500);
                    // Call arsonistDone logic
                    const updates2: Record<string, any> = { phase: 'night-resolve' };
                    if (gs.arsonistActionThisNight === 'oil' && gs.arsonistOilTarget) {
                        const currentOiled = gs.arsonistOiled || [];
                        if (!currentOiled.includes(gs.arsonistOilTarget)) {
                            updates2.arsonistOiled = [...currentOiled, gs.arsonistOilTarget];
                        }
                    }
                    await MinigameService.mergeGameState(room.id, updates2);
                    botActionRef.current = false;
                })();
            }
        }

        // --- DAY VOTE: Bot auto-votes ---
        if (phase === 'day-vote') {
            const aliveBotsUids = getAliveBots();
            const currentVotes = gs.votes || {};
            const currentSkips = gs.skipVotes || [];
            const unvotedBots = aliveBotsUids.filter(uid => !currentVotes[uid] && !currentSkips.includes(uid));
            if (unvotedBots.length > 0) {
                botActionRef.current = true;
                (async () => {
                    await thinkDelay();
                    const newVotes = { ...currentVotes };
                    const newSkips = [...currentSkips];
                    for (const botUid of unvotedBots) {
                        // 15% chance to skip, 85% vote
                        if (Math.random() < 0.15) {
                            newSkips.push(botUid);
                        } else {
                            const target = getRandomAliveTarget([botUid]);
                            if (target) newVotes[botUid] = target;
                        }
                    }
                    await MinigameService.mergeGameState(room.id, { votes: newVotes, skipVotes: newSkips });
                    botActionRef.current = false;
                })();
            }
        }

        // --- DAY REVOTE: Bot auto-votes (same logic) ---
        if (phase === 'day-revote') {
            const aliveBotsUids = getAliveBots();
            const currentVotes = gs.votes || {};
            const currentSkips = gs.skipVotes || [];
            const unvotedBots = aliveBotsUids.filter(uid => !currentVotes[uid] && !currentSkips.includes(uid));
            if (unvotedBots.length > 0) {
                botActionRef.current = true;
                (async () => {
                    await shortDelay();
                    const newVotes = { ...currentVotes };
                    const newSkips = [...currentSkips];
                    for (const botUid of unvotedBots) {
                        if (Math.random() < 0.15) {
                            newSkips.push(botUid);
                        } else {
                            const target = getRandomAliveTarget([botUid]);
                            if (target) newVotes[botUid] = target;
                        }
                    }
                    await MinigameService.mergeGameState(room.id, { votes: newVotes, skipVotes: newSkips });
                    botActionRef.current = false;
                })();
            }
        }

    }, [phase, isHost, gs.botUids, gs.wolfVotes, gs.seerTarget, gs.guardTarget, gs.nightActionsComplete, gs.hunterPending, gs.votes, gs.skipVotes]);
    // ---- RESOLVE NIGHT ----
    const resolveNight = async () => {
        try {
            // BUG FIX: Read FRESH state from room.gameState instead of stale closure `gs`
            const freshState = (room.gameState || {}) as WerewolfState;
            const wolfTarget = freshState.wolfTarget;
            const guardTarget = freshState.guardTarget;
            const witchSaved = freshState.witchSaveThisNight;
            const witchKillTarget = freshState.witchKillTarget;
            const currentRoles = freshState.roles || {};
            let killed: string | null = null;
            let nightLog = '';

            // Build night event log entry
            const nightEvent: any = {
                night: freshState.night || 1,
                type: 'night',
                wolfTarget: wolfTarget || null,
                seerTarget: freshState.seerTarget || null,
                guardTarget: guardTarget || null,
                witchSave: !!witchSaved,
                witchKill: witchKillTarget || null,
                arsonistAction: freshState.arsonistActionThisNight || null,
                arsonistTarget: freshState.arsonistOilTarget || null,
                hunterPinned: freshState.hunterPinned || null,
                arsonistBurned: [] as string[],
                killed: [] as string[],
                saved: false,
            };

            // Resolve wolf kill (blocked by guard or witch save — but don't reveal HOW)
            if (wolfTarget) {
                if (wolfTarget === guardTarget) {
                    nightEvent.saved = true;
                } else if (witchSaved) {
                    nightEvent.saved = true;
                } else {
                    killed = wolfTarget;
                }
            }

            // Witch poison kill
            if (witchKillTarget && witchKillTarget !== killed) {
                if (!killed) {
                    killed = witchKillTarget;
                }
            }

            // Collect all dead this night
            const allKilled: string[] = [];
            if (killed) allKilled.push(killed);
            if (witchKillTarget && witchKillTarget !== killed) allKilled.push(witchKillTarget);

            // Hunter logic: if killed this night, pinned target dies. If killed by vote yesterday, target pinned yesterday dies.
            const hunterEntry = Object.entries(currentRoles).find(([, r]) => (r as any).role === 'Thợ săn' && (r as any).alive);
            const hunterKilled = hunterEntry && allKilled.includes(hunterEntry[0]);

            if (hunterKilled && freshState.hunterPinned && currentRoles[freshState.hunterPinned]?.alive && !allKilled.includes(freshState.hunterPinned)) {
                allKilled.push(freshState.hunterPinned);
                nightEvent.hunterTarget = freshState.hunterPinned;
            }

            if (freshState.hunterPending && freshState.hunterTarget && currentRoles[freshState.hunterTarget]?.alive && !allKilled.includes(freshState.hunterTarget)) {
                allKilled.push(freshState.hunterTarget);
                nightEvent.hunterTarget = freshState.hunterTarget;
            }

            // Arsonist ignition — burns all oiled players
            const arsonistBurned: string[] = [];
            if (freshState.arsonistActionThisNight === 'ignite') {
                const oiled = freshState.arsonistOiled || [];
                oiled.forEach(uid => {
                    if (currentRoles[uid]?.alive && !allKilled.includes(uid)) {
                        arsonistBurned.push(uid);
                        allKilled.push(uid);
                    }
                });
                nightEvent.arsonistBurned = arsonistBurned;
            }

            // Build night log message
            if (allKilled.length > 1) {
                nightLog += `🩸 Đêm qua là một đêm đẫm máu... ${allKilled.length} người đã không qua khỏi.`;
            } else if (allKilled.length === 1) {
                nightLog += '🩸 Đêm qua là một đêm đẫm máu... Có người đã không qua khỏi.';
            } else {
                nightLog += '☀️ Đêm qua bình yên, không ai bị hại.';
            }
            if (arsonistBurned.length > 0) {
                nightLog += ` 🔥 Ngọn lửa bùng lên! ${arsonistBurned.length} người bị thiêu rụi.`;
            }
            if (nightEvent.hunterTarget) {
                nightLog += ` 🏹 Một mũi tên ghim thẳng vào ngực ${playerNames[nightEvent.hunterTarget]?.name}...`;
            }
            nightEvent.killed = allKilled;

            const prevLog = freshState.gameLog || [];
            // Common reset fields to clean up night actions
            const nightResetFields = {
                wolfVotes: null, wolfTarget: null,
                guardTarget: null, witchSaveThisNight: false, witchKillTarget: null,
                seerTarget: null, seerResult: null, nightActionsComplete: null,
                arsonistActionThisNight: null, arsonistOilTarget: null,
                hunterLastPinned: freshState.hunterPinned || freshState.hunterLastPinned || null,
                hunterPinned: null, hunterTarget: null, hunterPending: false, hunterDiedFrom: null,
                ...(freshState.arsonistActionThisNight === 'ignite' ? { arsonistOiled: null } : {}),
            };

            if (allKilled.length > 0) {
                const updatedRoles = { ...currentRoles };
                allKilled.forEach(uid => {
                    updatedRoles[uid] = { ...updatedRoles[uid], alive: false };
                });

                const result = checkGameEnd(updatedRoles);
                await MinigameService.mergeGameState(room.id, {
                    ...nightResetFields,
                    roles: updatedRoles, nightLog, 
                    nightKilled: allKilled.length > 0 ? allKilled[0] : null,
                    guardLastTarget: guardTarget || null,
                    gameLog: [...prevLog, nightEvent],
                    phase: result ? 'gameover' : 'day-discussion',
                    ...(result ? { gameResult: result, gameoverAt: Date.now() } : {}),
                });
                if (result) await saveGameHistory(result, updatedRoles);
            } else {
                await MinigameService.mergeGameState(room.id, {
                    ...nightResetFields,
                    nightLog, nightKilled: null, guardLastTarget: guardTarget || null,
                    gameLog: [...prevLog, nightEvent],
                    phase: 'day-discussion',
                });
            }
            await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: allKilled.length > 0 ? '🩸 Đêm qua là một đêm đẫm máu... Trời sáng rồi.' : '☀️ Đêm qua bình yên. Trời sáng rồi.', timestamp: Date.now(), channel: 'system' });
        } catch (e) { console.error('resolveNight error:', e); throw e; }
    };

    // ---- DAY VOTE ----
    const dayVote = async (targetUid: string) => {
        try {
            const newVotes = { ...(gs.votes || {}), [myUid]: targetUid };
            const newSkip = (gs.skipVotes || []).filter(u => u !== myUid);
            await MinigameService.mergeGameState(room.id, { votes: newVotes, skipVotes: newSkip });
        } catch (e) { console.error('dayVote error:', e); }
    };

    const daySkip = async () => {
        try {
            const newSkip = [...(gs.skipVotes || []).filter(u => u !== myUid), myUid];
            const newVotes = { ...(gs.votes || {}) };
            delete newVotes[myUid];
            await MinigameService.mergeGameState(room.id, { votes: newVotes, skipVotes: newSkip });
        } catch (e) { console.error('daySkip error:', e); }
    };

    const resolveVote = async () => {
        try {
            const votes = gs.votes || {};
            const skipCount = (gs.skipVotes || []).length;
            const voteCounts: Record<string, number> = {};
            Object.values(votes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
            const maxVotes = Math.max(0, ...Object.values(voteCounts));
            const topTargets = Object.entries(voteCounts).filter(([, c]) => c === maxVotes);

            if (maxVotes === 0 || skipCount > maxVotes || topTargets.length > 1) {
                const msg = '⚖️ Không đủ phiếu hoặc hòa — không ai bị treo cổ.';
                await MinigameService.mergeGameState(room.id, { voteResult: null, phase: 'day-result' });
                await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: msg, timestamp: Date.now(), channel: 'system' });
            } else {
                const defenseTarget = topTargets[0][0];
                const dName = playerNames[defenseTarget]?.name || '???';
                const msg = `⚠️ ${dName} nhận nhiều phiếu nhất (${maxVotes} phiếu). Hãy biện hộ trong 30 giây!`;
                await MinigameService.mergeGameState(room.id, {
                    phase: 'day-defense',
                    defenseTarget,
                    defenseVoteCount: maxVotes,
                    defenseStartedAt: Date.now(),
                    preDefenseVotes: { ...votes },
                    preDefenseSkipVotes: [...(gs.skipVotes || [])],
                });
                await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: msg, timestamp: Date.now(), channel: 'system' });
            }
        } catch (e) { console.error('resolveVote error:', e); }
    };

    // After defense, start revote period (10s)
    const startRevote = async () => {
        try {
            const dName = playerNames[gs.defenseTarget || '']?.name || '???';
            const msg = `🗳️ ${dName} đã biện hộ xong. Bạn có 10 giây để thay đổi quyết định!`;
            await MinigameService.mergeGameState(room.id, {
                phase: 'day-revote',
                revoteStartedAt: Date.now(),
            });
            await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: msg, timestamp: Date.now(), channel: 'system' });
        } catch (e) { console.error('startRevote error:', e); }
    };

    // Final vote resolution after revote period
    const finalResolveVote = async () => {
        try {
            const votes = gs.votes || {};
            const skipCount = (gs.skipVotes || []).length;
            const voteCounts: Record<string, number> = {};
            Object.values(votes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
            const maxVotes = Math.max(0, ...Object.values(voteCounts));
            const topTargets = Object.entries(voteCounts).filter(([, c]) => c === maxVotes);
            let msg = '';

            // Build day event log entry
            const dayEvent: any = {
                night: gs.night || 1,
                type: 'day',
                votes: { ...votes },
                skipVotes: [...(gs.skipVotes || [])],
                voteResult: null as string | null,
                killed: [] as string[],
            };
            const prevLog = gs.gameLog || [];

            if (maxVotes === 0 || skipCount > maxVotes || topTargets.length > 1) {
                msg = '⚖️ Sau khi thay đổi phiếu, không đủ phiếu hoặc hòa — không ai bị treo cổ.';
                await MinigameService.mergeGameState(room.id, { voteResult: null, phase: 'day-result', gameLog: [...prevLog, dayEvent], defenseTarget: null, defenseVoteCount: null, defenseStartedAt: null, revoteStartedAt: null, preDefenseVotes: null, preDefenseSkipVotes: null });
            } else {
                const eliminated = topTargets[0][0];
                dayEvent.voteResult = eliminated;
                dayEvent.killed = [eliminated];
                const updatedRoles = { ...gs.roles };
                updatedRoles[eliminated] = { ...updatedRoles[eliminated], alive: false };
                const eName = playerNames[eliminated]?.name || '???';
                const eliminatedRole = gs.roles?.[eliminated]?.role;
                msg = `⚔️ ${eName} bị treo cổ!`;

                // TANNER WIN: If the Tanner is voted out, they win!
                if (eliminatedRole === 'Kẻ chán đời') {
                    const tannerResult = '😵 Kẻ chán đời thắng! Kẻ chán đời đã đạt được ước nguyện!';
                    await MinigameService.mergeGameState(room.id, {
                        roles: updatedRoles, voteResult: eliminated,
                        gameLog: [...prevLog, dayEvent],
                        phase: 'gameover',
                        gameResult: tannerResult, tannerWin: true,
                        gameoverAt: Date.now(),
                        defenseTarget: null, defenseVoteCount: null, defenseStartedAt: null, revoteStartedAt: null, preDefenseVotes: null, preDefenseSkipVotes: null,
                    });
                    await saveGameHistory(tannerResult, updatedRoles);
                    await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: msg, timestamp: Date.now(), channel: 'system' });
                    return;
                }

                // HUNTER REVENGE: If Hunter is voted out, note it for next night
                if (eliminatedRole === 'Thợ săn') {
                    // Automatically resolve vote
                    const result = checkGameEnd(updatedRoles);
                    await MinigameService.mergeGameState(room.id, {
                        roles: updatedRoles, voteResult: eliminated,
                        gameLog: [...prevLog, dayEvent],
                        phase: result ? 'gameover' : 'day-result',
                        ...(result ? { gameResult: result, gameoverAt: Date.now() } : {}),
                        hunterPending: true, hunterDiedFrom: 'vote',
                        hunterTarget: gs.hunterLastPinned, // Pin carries over to next night
                        defenseTarget: null, defenseVoteCount: null, defenseStartedAt: null, revoteStartedAt: null, preDefenseVotes: null, preDefenseSkipVotes: null,
                    });
                    if (result) await saveGameHistory(result, updatedRoles);
                    await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: `${msg} 🏹 Thợ săn đã bị loại! Mục tiêu của Thợ săn sẽ gã gục trong đêm tới.`, timestamp: Date.now(), channel: 'system' });
                    return;
                }

                const result = checkGameEnd(updatedRoles);
                await MinigameService.mergeGameState(room.id, {
                    roles: updatedRoles, voteResult: eliminated,
                    gameLog: [...prevLog, dayEvent],
                    phase: result ? 'gameover' : 'day-result',
                    ...(result ? { gameResult: result, gameoverAt: Date.now() } : {}),
                    defenseTarget: null, defenseVoteCount: null, defenseStartedAt: null, revoteStartedAt: null, preDefenseVotes: null, preDefenseSkipVotes: null,
                });
                if (result) await saveGameHistory(result, updatedRoles);
            }
            await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: msg, timestamp: Date.now(), channel: 'system' });
        } catch (e) { console.error('finalResolveVote error:', e); }
    };

    const checkGameEnd = (roles: any): string | null => {
        const aliveWolves = Object.values(roles).filter((r: any) => r.role === 'Ma Sói' && r.alive).length;
        const aliveNonWolf = Object.values(roles).filter((r: any) => r.role !== 'Ma Sói' && r.alive).length;
        // Arsonist wins if all non-arsonist alive players are dead (only arsonist remains)
        const aliveArsonist = Object.values(roles).filter((r: any) => r.role === 'Kẻ tẩm dầu' && r.alive).length;
        const totalAlive = Object.values(roles).filter((r: any) => r.alive).length;
        if (aliveArsonist > 0 && totalAlive === aliveArsonist) return '🔥 Kẻ tẩm dầu thắng! Ngôi làng chìm trong biển lửa!';
        if (aliveWolves === 0) return '🎉 Phe dân thắng!';
        if (aliveWolves >= aliveNonWolf) {
            const aliveWitch = Object.values(roles).find((r: any) => r.role === 'Phù thủy' && r.alive);
            if (aliveWitch && !gs.witchKillUsed) {
                return '🤝 Hòa! Phù thủy dùng bình độc tử sát cùng Sói!';
            }
            return '🐺 Ma Sói thắng!';
        }
        return null;
    };
    // ---- SAVE GAME HISTORY ----
    const saveGameHistory = async (result: string, finalRoles: any) => {
        try {
            let winnerTeam = 'draw';
            if (result.includes('dân')) winnerTeam = 'village';
            else if (result.includes('Sói') && !result.includes('Hòa')) winnerTeam = 'wolf';
            else if (result.includes('tẩm dầu')) winnerTeam = 'arsonist';
            else if (result.includes('chán đời')) winnerTeam = 'tanner';

            const now = Date.now();
            const startedAt = room.createdAt || now;
            const duration = Math.round((now - startedAt) / 1000);
            const players: Record<string, { name: string; avatar: string; role: string; alive: boolean; won: boolean; score: number }> = {};
            playerList.forEach(p => {
                const r = finalRoles[p.uid];
                if (r) {
                    let team = r.role === 'Ma Sói' ? 'wolf' : 'village';
                    if (r.role === 'Kẻ tẩm dầu') team = 'arsonist';
                    if (r.role === 'Kẻ chán đời') team = 'tanner';
                    const won = team === winnerTeam;
                    players[p.uid] = { name: p.name, avatar: p.avatar, role: r.role, alive: r.alive, won, score: won ? 1 : 0 };
                }
            });
            await MinigameService.saveGameHistory({
                gameType: 'werewolf',
                roomId: room.id,
                result,
                winnerTeam,
                players,
                nightCount: gs.night || 0,
                startedAt, finishedAt: now, duration,
            });
        } catch (e) {
            console.error('Failed to save game history:', e);
        }
    };

    const startDayVote = async () => {
        try {
            await MinigameService.mergeGameState(room.id, { phase: 'day-vote', votes: {}, skipVotes: [] });
            await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: '🗳️ Bỏ phiếu bắt đầu! Chọn người nghi ngờ hoặc bỏ qua.', timestamp: Date.now(), channel: 'system' });
        } catch (e) { console.error('startDayVote error:', e); }
    };

    const resetGame = async () => {
        try {
            // Save current roles so next assignRoles can avoid repeat assignments
            const currentRoles = gs.roles || null;
            await MinigameService.clearChat(room.id);
            // Full reset: clear ALL game state to ensure clean slate
            await MinigameService.updateGameState(room.id, {
                phase: 'waiting',
                roles: null, previousRoles: currentRoles, night: 0,
                wolfVotes: null, wolfTarget: null,
                guardTarget: null, guardLastTarget: null,
                witchSaveUsed: false, witchKillUsed: false,
                witchSaveThisNight: false, witchKillTarget: null,
                nightActionsComplete: null, nightKilled: null, nightLog: null,
                votes: null, skipVotes: null, voteResult: null, gameLog: null,
                seerTarget: null, seerResult: null,
                defenseTarget: null, defenseStartedAt: null,
                revoteStartedAt: null, gameResult: null, gameoverAt: null,
            });
        } catch (e) { console.error('resetGame error:', e); }
    };

    // Auto-reset timer for gameover phase (120 seconds)
    useEffect(() => {
        if (phase === 'gameover' && gs.gameoverAt) {
            const interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - gs.gameoverAt!) / 1000);
                const remaining = 120 - elapsed;
                
                if (remaining <= 0) {
                    clearInterval(interval);
                    setAutoResetTimeLeft(0);
                    // Only Host actually triggers the reset
                    if (isHost && !resolvingRef.current) {
                        resolvingRef.current = true;
                        resetGame().finally(() => { resolvingRef.current = false; });
                    }
                } else {
                    setAutoResetTimeLeft(remaining);
                }
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setAutoResetTimeLeft(null);
        }
    }, [phase, gs.gameoverAt, isHost, resetGame]);

    // ---- HELPER: Player Card ----
    const PlayerCard: React.FC<{ p: typeof playerList[0]; onClick?: () => void; selected?: boolean; disabled?: boolean; extra?: React.ReactNode }> = ({ p, onClick, selected, disabled, extra }) => {
        const r = gs.roles?.[p.uid];
        const isDead = r && !r.alive;
        return (
            <button onClick={onClick} disabled={disabled || !onClick}
                className={clsx("w-full flex items-center gap-2 p-2 rounded-xl text-left text-base transition-all",
                    selected ? "bg-[#2a0a0a] ring-2 ring-[#8b1a1a]" : "hover:bg-[#221f30] border border-transparent hover:border-[#8b5c3a]/20",
                    disabled && "opacity-40 cursor-not-allowed")}>
                <div className={clsx("relative w-7 h-7 rounded-full shrink-0", isDead ? "ww-avatar-dead" : "ww-avatar-spooky")} style={{overflow:'visible'}}><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=32&background=2a1f3d&color=c9873a`} className="w-full h-full object-cover rounded-full" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[8px] rounded-full" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                <span className={clsx("font-medium flex-1", isDead ? "text-[#6b5f50] line-through opacity-60" : "text-[#e8dcc8]")}>{p.name}</span>
                {isDead && <Skull size={14} className="text-[#c62828] shrink-0" />}
                {p.uid === room.hostId && <Crown size={12} className="text-[#c9873a]" />}
                {extra}
            </button>
        );
    };

    // ---- HELPER: Left Column (role card + info) ----
    const [roleCardFlipped, setRoleCardFlipped] = useState(false);

    // Reset card flip when game resets or new roles assigned
    useEffect(() => {
        if (phase === 'waiting' || phase === 'roles-assigned') {
            setRoleCardFlipped(false);
        }
    }, [phase]);

    // Auto-flip card back after 5 seconds
    useEffect(() => {
        if (!roleCardFlipped) return;
        const timer = setTimeout(() => setRoleCardFlipped(false), 5000);
        return () => clearTimeout(timer);
    }, [roleCardFlipped]);

    const renderLeftColumn = () => {
        if (!myRole || phase === 'waiting' || phase === 'gameover') return null;
        const roleInfo = WOLF_ROLES.find(r => r.role === myRole.role);
        return (
            <div className="ww-card-column">
                {/* Full-size card on all devices */}
                <div className="hidden md:block">
                    <CardFace flipped={roleCardFlipped} size="lg" onFlip={() => setRoleCardFlipped(f => !f)}
                        cardImage={roleInfo?.cardImage} roleName={myRole.role} roleIcon={myRole.icon} alive={myRole.alive} />
                </div>
                <div className="md:hidden flex justify-center">
                    <CardFace flipped={roleCardFlipped} size="lg" onFlip={() => setRoleCardFlipped(f => !f)}
                        cardImage={roleInfo?.cardImage} roleName={myRole.role} roleIcon={myRole.icon} alive={myRole.alive} />
                </div>

                {/* Role info panel — only visible after card is flipped */}
                <AnimatePresence>
                    {roleCardFlipped && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="ww-glass rounded-xl p-3 w-full text-center"
                        >
                            <p className="font-bold text-lg ww-glow-gold" style={{ fontFamily: "'Playfair Display', serif", color: '#c9873a' }}>{myRole.icon} Chức năng</p>
                            {roleInfo && <p className="text-sm italic mt-1" style={{ color: '#a89b85' }}>{roleInfo.desc}</p>}
                            {!myRole.alive && <p className="text-sm font-bold mt-2 flex items-center justify-center gap-1" style={{ color: '#c62828' }}><Skull size={14} /> Đã bị loại</p>}
                        </motion.div>
                    )}
                </AnimatePresence>




                {/* Player status — desktop only (mobile: shown below game content) */}
                <div className="ww-glass rounded-xl p-3 w-full hidden md:block">
                    <p className="text-sm font-bold mb-2 ww-glow-gold" style={{ fontFamily: "'Playfair Display', serif", color: '#c9873a' }}>
                        <Users size={14} className="inline mr-1" /> Ngôi Làng ({alivePlayers.length}/{allPlayers.length})
                    </p>
                    <div className="space-y-1">
                        {allPlayers.map(p => {
                            const r = gs.roles?.[p.uid];
                            const isDead = r && !r.alive;
                            const isBotPlayer = isBot(p.uid);
                            const showBotLabel = isBotPlayer && !isStealthBot(p.uid);
                            return (
                                <div key={p.uid} className={clsx("flex items-center gap-2 py-1 px-2 rounded-lg text-sm", isDead && "opacity-60")}>
                                    <div className={clsx("relative w-5 h-5 rounded-full shrink-0", isDead ? "ww-avatar-dead" : "ww-avatar-spooky")} style={{overflow:'visible'}}><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=24&background=2a1f3d&color=c9873a`} className="w-full h-full object-cover rounded-full" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[7px] rounded-full" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                    <span className={clsx("flex-1", isDead ? "line-through text-[#6b5f50]" : showBotLabel ? "text-[#8b9dc3]" : "text-[#e8dcc8]")}>{p.name}{showBotLabel && <span className="text-[9px] ml-1 text-[#6b8ab5]">(AI)</span>}</span>
                                    {isDead ? <Skull size={12} style={{ color: '#c62828' }} /> : <span className="w-2 h-2 rounded-full bg-emerald-500 ww-pulse-glow" />}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        );
    };

    // ---- GAME PHASE LAYOUT: Two-column on PC ----
    // NOTE: This is a RENDER FUNCTION, not a React component.
    // Defining it as a component inside OnlineWerewolf caused it to be
    // recreated on every render (new function reference = new component type),
    // which unmounted/remounted all children (including ChatBox) every second
    // during countdown timers, causing visible flickering.
    const renderPhaseLayout = (children: React.ReactNode, showCard = true, className?: string) => {
        const hasLeftColumn = showCard && myRole && phase !== 'waiting' && phase !== 'gameover';
        const showAdminReset = isHost && phase !== 'waiting' && phase !== 'gameover';
        return (
            <div className={clsx("werewolf-gothic ww-texture max-w-5xl mx-auto p-4 rounded-2xl relative", className)}>
                {/* Atmospheric Effects */}
                <WerewolfAtmosphere phase={phase} />
                <PhaseTransitionFlash phase={phase} />

                {/* Top Action Bar (Audio, Guide, Reset) */}
                <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 mb-4">
                    {/* Audio Toggle */}
                    <button
                        onClick={toggleAudio}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#1a0a0a]/80 hover:bg-[#2a0a0a] border border-[#8b5c3a]/40 hover:border-[#c9873a]/60 rounded-xl text-xs font-bold transition-all backdrop-blur-sm shadow-md"
                        title={audioMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                    >
                        {audioMuted ? <VolumeX size={14} className="text-[#8b5c3a]/70" /> : <Volume2 size={14} className="text-[#c9873a]" />}
                        <span className={audioMuted ? 'text-[#8b5c3a]/50' : 'text-[#c9873a]/80'}>{audioMuted ? '🔇 Muted' : '🔊 Âm thanh'}</span>
                    </button>

                    {/* Guide + Admin Reset */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowGuide(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a0a0a]/80 hover:bg-[#2a1a0a] border border-[#c9873a]/40 hover:border-[#c9873a]/70 rounded-xl text-xs font-bold transition-all backdrop-blur-sm shadow-md hover:shadow-[#c9873a]/20"
                            title="Hướng dẫn chơi"
                        >
                            <BookOpen size={14} className="text-[#c9873a]" />
                            <span className="text-[#c9873a]">Luật chơi</span>
                        </button>
                        {showAdminReset && (
                            <>
                                {showResetConfirm ? (
                                    <div className="flex items-center gap-1.5 bg-[#1a0a0a]/95 border border-[#c62828]/50 rounded-xl px-3 py-1.5 shadow-lg backdrop-blur-sm">
                                        <span className="text-xs text-[#e8a0a0] font-medium">Reset?</span>
                                        <button
                                            onClick={() => { resetGame(); setShowResetConfirm(false); }}
                                            className="px-3 py-1 bg-[#c62828] hover:bg-[#d32f2f] text-white rounded-lg text-xs font-bold transition-colors"
                                        >
                                            OK
                                        </button>
                                        <button
                                            onClick={() => setShowResetConfirm(false)}
                                            className="px-3 py-1 bg-[#333] hover:bg-[#444] text-[#aaa] rounded-lg text-xs font-medium transition-colors"
                                        >
                                            Hủy
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowResetConfirm(true)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-[#1a0a0a]/80 hover:bg-[#2a0a0a] border border-[#8b1a1a]/40 hover:border-[#c62828]/60 rounded-xl text-xs text-[#c62828]/80 hover:text-[#c62828] font-bold transition-all backdrop-blur-sm shadow-md"
                                        title="Reset game (Admin)"
                                    >
                                        <RotateCcw size={12} /> Reset
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Role Guide Modal */}
                {showGuide && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3" style={{ background: 'rgba(5,3,10,0.95)' }} onClick={() => setShowGuide(false)}>
                        <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-[#8b5c3a]/40 overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #1a1825 0%, #0f0e1a 100%)' }} onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-[#8b5c3a]/30 shrink-0"
                                style={{ background: 'linear-gradient(135deg, #1e1a2e 0%, #16141f 100%)' }}>
                                <h3 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif", color: '#c9873a' }}>
                                    <BookOpen size={18} /> Hướng Dẫn Ma Sói
                                </h3>
                                <button onClick={() => setShowGuide(false)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#6b5f50] hover:text-[#c9873a] hover:bg-[#8b5c3a]/20 transition-all text-lg font-bold">✕</button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
                                {/* Game Overview */}
                                <div className="ww-panel rounded-xl p-4 border border-[#8b5c3a]/20">
                                    <h4 className="text-base font-bold text-[#c9873a] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>🎮 Luật Chơi Cơ Bản</h4>
                                    <div className="space-y-2 text-[#b0a898]">
                                        <p>Ma Sói là trò chơi <strong className="text-[#e8dcc8]">suy luận xã hội</strong>. Người chơi được chia vai ngẫu nhiên và phải tìm ra ai là Sói để loại bỏ.</p>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div className="bg-[#0a0a1a]/60 rounded-lg p-2.5 border border-[#1a1040]/40">
                                                <p className="font-bold text-[#8b7acc] text-xs mb-1">🌙 Ban Đêm</p>
                                                <p className="text-[11px]">Sói chọn mục tiêu cắn. Tiên tri, Bảo vệ, Phù thủy, Kẻ tẩm dầu lần lượt hành động.</p>
                                            </div>
                                            <div className="bg-[#1a1510]/60 rounded-lg p-2.5 border border-[#2a2518]/40">
                                                <p className="font-bold text-[#c9873a] text-xs mb-1">☀️ Ban Ngày</p>
                                                <p className="text-[11px]">Tất cả thảo luận, sau đó bỏ phiếu treo cổ người nghi ngờ nhất.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Roles */}
                                <h4 className="text-base font-bold text-[#c9873a] px-1" style={{ fontFamily: "'Playfair Display', serif" }}>🃏 Nhân Vật</h4>

                                {/* Wolf */}
                                <div className="ww-panel rounded-xl p-4 border border-[#c62828]/20">
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">🐺</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-bold text-[#e8dcc8] text-base">Ma Sói</h5>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#c62828]/20 text-[#e88080] font-bold">PHE SÓI</span>
                                            </div>
                                            <div className="space-y-1.5 text-[#b0a898]">
                                                <p><strong className="text-[#e8a0a0]">🎯 Mục tiêu:</strong> Loại bỏ tất cả dân làng.</p>
                                                <p><strong className="text-[#e8a0a0]">🌙 Ban đêm:</strong> Mở mắt cùng đồng đội Sói, thống nhất chọn <strong className="text-[#e8dcc8]">1 người để cắn</strong>. Nạn nhân sẽ chết nếu không được bảo vệ/cứu.</p>
                                                <p><strong className="text-[#e8a0a0]">☀️ Ban ngày:</strong> Giả làm dân, cố gắng đổ tội cho người khác.</p>
                                                <p><strong className="text-[#e8a0a0]">💡 Chiến thuật:</strong> Phối hợp với đồng đội Sói. Đừng tố nhau. Hãy vote cùng phe dân để tạo niềm tin, sau đó dẫn dắt treo cổ nhầm người.</p>
                                                <p><strong className="text-[#e8a0a0]">🏆 Thắng khi:</strong> Số Sói ≥ Số Dân còn sống.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Villager */}
                                <div className="ww-panel rounded-xl p-4 border border-[#8b5c3a]/20">
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">👨‍🌾</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-bold text-[#e8dcc8] text-base">Dân Làng</h5>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-800/30 text-emerald-300 font-bold">PHE DÂN</span>
                                            </div>
                                            <div className="space-y-1.5 text-[#b0a898]">
                                                <p><strong className="text-emerald-300/80">🎯 Mục tiêu:</strong> Tìm và treo cổ tất cả Ma Sói.</p>
                                                <p><strong className="text-emerald-300/80">🌙 Ban đêm:</strong> Không có khả năng đặc biệt. Ngủ yên.</p>
                                                <p><strong className="text-emerald-300/80">☀️ Ban ngày:</strong> Thảo luận, phân tích hành vi, bỏ phiếu.</p>
                                                <p><strong className="text-emerald-300/80">💡 Chiến thuật:</strong> Quan sát ai đổi chiến thuật, ai vote lạ. Tin tưởng Tiên tri và Bảo vệ. Đừng tiết lộ vai nếu không cần thiết.</p>
                                                <p><strong className="text-emerald-300/80">🏆 Thắng khi:</strong> Tất cả Sói bị loại.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Seer */}
                                <div className="ww-panel rounded-xl p-4 border border-[#8b5c3a]/20">
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">🔮</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-bold text-[#e8dcc8] text-base">Tiên Tri</h5>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-800/30 text-emerald-300 font-bold">PHE DÂN</span>
                                            </div>
                                            <div className="space-y-1.5 text-[#b0a898]">
                                                <p><strong className="text-[#a78bfa]">🎯 Mục tiêu:</strong> Tìm ra Sói bằng khả năng soi.</p>
                                                <p><strong className="text-[#a78bfa]">🌙 Ban đêm:</strong> Chọn <strong className="text-[#e8dcc8]">1 người để soi</strong>. Kết quả hiện "🐺 Sói" hoặc "🏡 Dân". Kẻ tẩm dầu và Kẻ chán đời hiện là Dân.</p>
                                                <p><strong className="text-[#a78bfa]">☀️ Ban ngày:</strong> Dùng kết quả để thuyết phục dân làng.</p>
                                                <p><strong className="text-[#a78bfa]">💡 Chiến thuật:</strong> Đừng tiết lộ mình là Tiên tri quá sớm — Sói sẽ ưu tiên giết bạn. Soi người đáng ngờ nhất. Khi chắc chắn, hãy công khai kết quả.</p>
                                                <p><strong className="text-[#a78bfa]">⚠️ Lưu ý:</strong> Chỉ soi được <strong>1 lần/đêm</strong>. Không soi lại người đã soi.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Guard */}
                                <div className="ww-panel rounded-xl p-4 border border-[#8b5c3a]/20">
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">🛡️</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-bold text-[#e8dcc8] text-base">Bảo Vệ</h5>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-800/30 text-emerald-300 font-bold">PHE DÂN</span>
                                            </div>
                                            <div className="space-y-1.5 text-[#b0a898]">
                                                <p><strong className="text-[#60a5fa]">🎯 Mục tiêu:</strong> Bảo vệ dân làng khỏi bị Sói giết.</p>
                                                <p><strong className="text-[#60a5fa]">🌙 Ban đêm:</strong> Chọn <strong className="text-[#e8dcc8]">1 người để bảo vệ</strong>. Nếu người đó bị Sói cắn, họ sẽ <strong className="text-emerald-300">sống sót</strong>.</p>
                                                <p><strong className="text-[#60a5fa]">⚠️ Hạn chế:</strong> <strong className="text-[#e8dcc8]">Không được bảo vệ cùng 1 người 2 đêm liên tiếp</strong>. Có thể bảo vệ chính mình.</p>
                                                <p><strong className="text-[#60a5fa]">💡 Chiến thuật:</strong> Nếu biết ai là Tiên tri → ưu tiên bảo vệ họ. Đa dạng mục tiêu để Sói khó đoán. Không tiết lộ mình là Bảo vệ.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Witch */}
                                <div className="ww-panel rounded-xl p-4 border border-[#8b5c3a]/20">
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">🧙</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-bold text-[#e8dcc8] text-base">Phù Thủy</h5>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-800/30 text-emerald-300 font-bold">PHE DÂN</span>
                                            </div>
                                            <div className="space-y-1.5 text-[#b0a898]">
                                                <p><strong className="text-[#c084fc]">🎯 Mục tiêu:</strong> Sử dụng 2 bình thuốc một cách chiến lược.</p>
                                                <p><strong className="text-[#c084fc]">🧪 Bình cứu (1 lần):</strong> Biết ai bị Sói cắn đêm nay. Có thể dùng <strong className="text-emerald-300">bình cứu</strong> để cứu sống nạn nhân.</p>
                                                <p><strong className="text-[#c084fc]">☠️ Bình độc (1 lần):</strong> Chọn <strong className="text-[#e8dcc8]">1 người để đầu độc</strong> — họ chết ngay trong đêm.</p>
                                                <p><strong className="text-[#c084fc]">⚠️ Hạn chế:</strong> Mỗi bình <strong className="text-[#e8dcc8]">chỉ dùng được 1 lần</strong> cả trận. Không thể vừa cứu vừa độc cùng đêm.</p>
                                                <p><strong className="text-[#c084fc]">💡 Chiến thuật:</strong> Giữ bình cứu cho tình huống quan trọng (cứu Tiên tri). Dùng bình độc khi chắc chắn ai là Sói.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Hunter */}
                                <div className="ww-panel rounded-xl p-4 border border-[#8b5c3a]/20">
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">🏹</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-bold text-[#e8dcc8] text-base">Thợ Săn</h5>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-800/30 text-emerald-300 font-bold">PHE DÂN</span>
                                            </div>
                                            <div className="space-y-1.5 text-[#b0a898]">
                                                <p><strong className="text-[#fb923c]">🎯 Mục tiêu:</strong> Tiêu diệt Sói khi bị giết.</p>
                                                <p><strong className="text-[#fb923c]">💀 Khi chết:</strong> Ngay lập tức được chọn <strong className="text-[#e8dcc8]">1 người để bắn hạ</strong> — kéo theo cùng chết.</p>
                                                <p><strong className="text-[#fb923c]">⚠️ Kích hoạt:</strong> Chỉ kích hoạt khi bị <strong>Sói cắn chết</strong> hoặc bị <strong>treo cổ ban ngày</strong>. Không kích hoạt nếu bị Phù thủy đầu độc.</p>
                                                <p><strong className="text-[#fb923c]">💡 Chiến thuật:</strong> Cố gắng biết ai là Sói trước khi chết. Khi chết, bắn người bạn nghi nhất. Nếu không chắc, bắn người biểu quyết bạn nhiều nhất.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tanner */}
                                <div className="ww-panel rounded-xl p-4 border border-[#fbbf24]/20">
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">😵</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-bold text-[#e8dcc8] text-base">Kẻ Chán Đời</h5>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#fbbf24]/20 text-[#fbbf24] font-bold">TRUNG LẬP</span>
                                            </div>
                                            <div className="space-y-1.5 text-[#b0a898]">
                                                <p><strong className="text-[#fbbf24]">🎯 Mục tiêu:</strong> Bị treo cổ ban ngày = <strong className="text-[#fbbf24]">THẮNG!</strong></p>
                                                <p><strong className="text-[#fbbf24]">🌙 Ban đêm:</strong> Không có khả năng đặc biệt.</p>
                                                <p><strong className="text-[#fbbf24]">☀️ Ban ngày:</strong> Cố tình hành động đáng ngờ để bị vote treo cổ.</p>
                                                <p><strong className="text-[#fbbf24]">💡 Chiến thuật:</strong> Giả vờ là Sói! Nói mâu thuẫn, tự bộc lộ "sơ hở". Đừng quá lộ liễu — nếu bị Sói cắn thì thua. Chỉ cần bị <strong>dân treo cổ</strong> là thắng.</p>
                                                <p><strong className="text-[#fbbf24]">⚠️ Lưu ý:</strong> Tiên tri soi thấy là "Dân" (không phải Sói). Bị Sói cắn = thua.</p>
                                                <p><strong className="text-[#fbbf24]">🏆 Thắng khi:</strong> Bị treo cổ ban ngày → Kẻ chán đời thắng một mình, cả Sói và Dân đều thua!</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Arsonist */}
                                <div className="ww-panel rounded-xl p-4 border border-[#ef4444]/20">
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">🔥</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h5 className="font-bold text-[#e8dcc8] text-base">Kẻ Tẩm Dầu</h5>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#ef4444]/20 text-[#f87171] font-bold">TRUNG LẬP</span>
                                            </div>
                                            <div className="space-y-1.5 text-[#b0a898]">
                                                <p><strong className="text-[#f87171]">🎯 Mục tiêu:</strong> Tẩm dầu rồi đốt cháy tất cả!</p>
                                                <p><strong className="text-[#f87171]">🛢️ Tẩm dầu:</strong> Mỗi đêm chọn <strong className="text-[#e8dcc8]">1 người để tẩm dầu</strong>. Nạn nhân <strong>không biết</strong> mình bị tẩm. Tích lũy qua nhiều đêm.</p>
                                                <p><strong className="text-[#f87171]">🔥 Đốt cháy:</strong> Thay vì tẩm, chọn <strong className="text-[#e8dcc8]">ĐỐT</strong> — <strong className="text-[#ef4444]">tất cả người đã bị tẩm dầu chết cùng lúc!</strong></p>
                                                <p><strong className="text-[#f87171]">💡 Chiến thuật:</strong> Kiên nhẫn tẩm nhiều người (3+ người) trước khi đốt. Giữ bí mật danh tính. Không tẩm Sói (nếu biết) để tránh gây chú ý.</p>
                                                <p><strong className="text-[#f87171]">⚠️ Lưu ý:</strong> Tiên tri soi thấy là "Dân". Bị Sói cắn/treo cổ = chết bình thường. Bảo vệ KHÔNG chặn được tẩm dầu.</p>
                                                <p><strong className="text-[#f87171]">🏆 Thắng khi:</strong> Là người cuối cùng sống sót.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Win Conditions Summary */}
                                <div className="ww-panel rounded-xl p-4 border border-[#8b5c3a]/20">
                                    <h4 className="text-base font-bold text-[#c9873a] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>🏆 Điều Kiện Thắng</h4>
                                    <div className="space-y-2 text-[#b0a898] text-[13px]">
                                        <p>🐺 <strong className="text-[#e8a0a0]">Phe Sói:</strong> Số Sói sống ≥ số Dân sống</p>
                                        <p>🏡 <strong className="text-emerald-300/80">Phe Dân:</strong> Tất cả Sói bị loại (treo cổ hoặc Phù thủy/Thợ săn giết)</p>
                                        <p>😵 <strong className="text-[#fbbf24]">Kẻ chán đời:</strong> Bị dân làng bỏ phiếu treo cổ</p>
                                        <p>🔥 <strong className="text-[#f87171]">Kẻ tẩm dầu:</strong> Là người sống sót cuối cùng</p>
                                    </div>
                                </div>

                                {/* Phase Order */}
                                <div className="ww-panel rounded-xl p-4 border border-[#8b5c3a]/20">
                                    <h4 className="text-base font-bold text-[#c9873a] mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>🔄 Thứ Tự Các Pha</h4>
                                    <div className="space-y-1 text-[#b0a898] text-[13px]">
                                        <p className="font-medium text-[#8b7acc]">🌙 Ban Đêm:</p>
                                        <ol className="list-decimal list-inside pl-2 space-y-0.5">
                                            <li>🐺 Ma Sói thức dậy → chọn mục tiêu cắn</li>
                                            <li>🔮 Tiên tri thức dậy → soi 1 người</li>
                                            <li>🛡️ Bảo vệ thức dậy → chọn người bảo vệ</li>
                                            <li>🧙 Phù thủy thức dậy → cứu/đầu độc</li>
                                            <li>🔥 Kẻ tẩm dầu thức dậy → tẩm dầu/đốt</li>
                                            <li>→ Công bố kết quả đêm</li>
                                        </ol>
                                        <p className="font-medium text-[#c9873a] mt-2">☀️ Ban Ngày:</p>
                                        <ol className="list-decimal list-inside pl-2 space-y-0.5">
                                            <li>📢 Công bố ai chết đêm qua</li>
                                            <li>💬 Thảo luận tự do</li>
                                            <li>🗳️ Bỏ phiếu treo cổ</li>
                                            <li>🔁 Nếu hòa → bỏ phiếu lại 1 lần</li>
                                        </ol>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )}

                {hasLeftColumn ? (
                    <div className="ww-game-layout">
                        {renderLeftColumn()}
                        <div className="ww-content-column">{children}</div>
                    </div>
                ) : (
                    <>{children}</>
                )}

                {/* Mobile-only: Player list below game content */}
                {hasLeftColumn && (
                    <div className="md:hidden mt-4 ww-glass rounded-xl p-3 w-full">
                        <p className="text-sm font-bold mb-2 ww-glow-gold" style={{ fontFamily: "'Playfair Display', serif", color: '#c9873a' }}>
                            <Users size={14} className="inline mr-1" /> Ngôi Làng ({alivePlayers.length}/{allPlayers.length})
                        </p>
                        <div className="space-y-1">
                            {allPlayers.map(p => {
                                const r = gs.roles?.[p.uid];
                                const isDead = r && !r.alive;
                                const isBotPlayer = isBot(p.uid);
                                const showBotLabel = isBotPlayer && !isStealthBot(p.uid);
                                return (
                                    <div key={p.uid} className={clsx("flex items-center gap-2 py-1 px-2 rounded-lg text-sm", isDead && "opacity-60")}>
                                        <div className={clsx("relative w-5 h-5 rounded-full shrink-0", isDead ? "ww-avatar-dead" : "ww-avatar-spooky")} style={{overflow:'visible'}}><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=24&background=2a1f3d&color=c9873a`} className="w-full h-full object-cover rounded-full" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[7px] rounded-full" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                        <span className={clsx("flex-1", isDead ? "line-through text-[#6b5f50]" : showBotLabel ? "text-[#8b9dc3]" : "text-[#e8dcc8]")}>{p.name}{showBotLabel && <span className="text-[9px] ml-1 text-[#6b8ab5]">(AI)</span>}</span>
                                        {isDead ? <Skull size={12} style={{ color: '#c62828' }} /> : <span className="w-2 h-2 rounded-full bg-emerald-500 ww-pulse-glow" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ---- GAME HISTORY & STATS ----
    const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
    useEffect(() => {
        const unsub = MinigameService.subscribeToGameHistory((h) => {
            setGameHistory(h.filter(g => g.gameType === 'werewolf'));
        });
        return unsub;
    }, []);

    const playerStats = useMemo(() => {
        const stats: Record<string, { name: string; avatar: string; wins: number; losses: number; games: number; roles: Record<string, number> }> = {};
        gameHistory.forEach(g => {
            Object.entries(g.players).forEach(([uid, p]) => {
                if (!stats[uid]) stats[uid] = { name: p.name, avatar: p.avatar, wins: 0, losses: 0, games: 0, roles: {} };
                stats[uid].games++;
                if (p.won) stats[uid].wins++; else stats[uid].losses++;
                const role = p.role || 'Unknown';
                stats[uid].roles[role] = (stats[uid].roles[role] || 0) + 1;
            });
        });
        return Object.entries(stats)
            .map(([uid, s]) => ({ uid, ...s, winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0 }))
            .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
    }, [gameHistory]);

    const renderStats = () => {
        if (gameHistory.length === 0) return null;
        const medals = ['🥇', '🥈', '🥉'];
        return (
            <div className="ww-stats-section mt-6">
                <h3 className="ww-title text-xl mb-4 text-center">
                    <Trophy size={20} className="inline mr-2" style={{ color: '#c9873a' }} />
                    Bảng Xếp Hạng Ma Sói
                </h3>

                {/* Leaderboard */}
                <div className="space-y-2 mb-6">
                    {playerStats.slice(0, 10).map((s, i) => (
                        <div key={s.uid} className={clsx("ww-leaderboard-row", i === 0 && "top-1", i === 1 && "top-2", i === 2 && "top-3")}>
                            <span className="text-lg w-8 text-center">{medals[i] || `#${i + 1}`}</span>
                            <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0"><img src={s.avatar || `https://ui-avatars.com/api/?name=${s.name}&size=32`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[9px]" style={{display:'none'}}>{(s.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate" style={{ color: '#e8dcc8' }}>{s.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="ww-stat-bar flex-1">
                                        <div className="ww-stat-bar-fill win" style={{ width: `${s.winRate}%` }} />
                                    </div>
                                    <span className="text-xs font-bold whitespace-nowrap" style={{ color: '#c9873a' }}>{s.winRate}%</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold" style={{ color: '#c9873a' }}>{s.wins}W</p>
                                <p className="text-xs" style={{ color: '#6b5f50' }}>{s.losses}L / {s.games}G</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Role stats for top players */}
                {playerStats.length > 0 && (
                    <div className="ww-panel rounded-xl p-4">
                        <p className="text-sm font-bold mb-3 ww-glow-gold" style={{ fontFamily: "'Playfair Display', serif", color: '#c9873a' }}>
                            <BarChart3 size={14} className="inline mr-1" /> Thống Kê Vai Trò
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {playerStats.slice(0, 6).map(s => (
                                <div key={s.uid} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(26,24,37,0.6)' }}>
                                    <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0"><img src={s.avatar || `https://ui-avatars.com/api/?name=${s.name}&size=24`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[8px]" style={{display:'none'}}>{(s.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold truncate" style={{ color: '#e8dcc8' }}>{s.name}</p>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                            {Object.entries(s.roles).map(([role, count]) => {
                                                const ri = WOLF_ROLES.find(r => r.role === role);
                                                return <span key={role} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,58,0.15)', color: '#a89b85' }}>{ri?.icon || '❓'}{count}</span>;
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <p className="text-xs text-center mt-3" style={{ color: '#6b5f50' }}>Tổng: {gameHistory.length} trận đã chơi</p>
            </div>
        );
    };

    // ---- GAME HISTORY PANEL ----
    const [showHistory, setShowHistory] = useState(false);
    const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

    const renderHistory = () => {
        if (!showHistory) return null;
        const formatDuration = (s: number) => {
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return m > 0 ? `${m} phút ${sec}s` : `${sec}s`;
        };
        const formatTime = (ts: number) => {
            const d = new Date(ts);
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const h = d.getHours().toString().padStart(2, '0');
            const min = d.getMinutes().toString().padStart(2, '0');
            return `${day}/${month} ${h}:${min}`;
        };

        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(10,8,18,0.92)' }} onClick={() => setShowHistory(false)}>
                <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-[#8b5c3a]/40 overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #1a1825 0%, #0f0e1a 100%)' }} onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#8b5c3a]/30"
                        style={{ background: 'linear-gradient(135deg, #1e1a2e 0%, #16141f 100%)' }}>
                        <h3 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif", color: '#c9873a' }}>
                            📜 Lịch sử trận đấu
                        </h3>
                        <button onClick={() => setShowHistory(false)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6b5f50] hover:text-[#c9873a] hover:bg-[#8b5c3a]/20 transition-all text-lg font-bold">✕</button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {gameHistory.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-4xl mb-3">🐺</p>
                                <p className="text-[#6b5f50] text-base">Chưa có trận đấu nào.</p>
                                <p className="text-[#6b5f50]/60 text-sm mt-1">Hãy bắt đầu ván chơi đầu tiên!</p>
                            </div>
                        ) : gameHistory.map((g) => {
                            const isExpanded = expandedMatch === g.id;
                            const isVillageWin = g.winnerTeam === 'village';
                            const playerEntries = Object.entries(g.players);
                            const wolves = playerEntries.filter(([, p]) => p.role === 'Ma Sói');
                            const villagers = playerEntries.filter(([, p]) => p.role !== 'Ma Sói');

                            return (
                                <div key={g.id} className="rounded-xl border border-[#8b5c3a]/25 overflow-hidden transition-all hover:border-[#c9873a]/40"
                                    style={{ background: 'rgba(26,24,37,0.7)' }}>
                                    {/* Match summary row */}
                                    <button onClick={() => setExpandedMatch(isExpanded ? null : g.id)}
                                        className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-[#8b5c3a]/10 transition-all">
                                        <span className="text-2xl shrink-0">{isVillageWin ? '🏡' : '🐺'}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm truncate" style={{ color: isVillageWin ? '#7ab87a' : '#c62828', fontFamily: "'Playfair Display', serif" }}>
                                                {g.result}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-[#6b5f50] mt-0.5">
                                                <span>🌙 {g.nightCount || '?'} đêm</span>
                                                <span>•</span>
                                                <span>👥 {playerEntries.length} người</span>
                                                {g.duration != null && <><span>•</span><span>⏱ {formatDuration(g.duration)}</span></>}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] text-[#6b5f50]">{formatTime(g.finishedAt)}</p>
                                            <span className={clsx("text-xs transition-transform inline-block", isExpanded && "rotate-180")}>▼</span>
                                        </div>
                                    </button>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div className="px-3 pb-3 border-t border-[#8b5c3a]/15 pt-2 space-y-2">
                                            {/* Wolves */}
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#c62828] mb-1">🐺 Phe Sói</p>
                                                <div className="space-y-1">
                                                    {wolves.map(([uid, p]) => (
                                                        <div key={uid} className="flex items-center gap-2 text-sm">
                                                            <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0">
                                                                <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=24`} className="w-full h-full object-cover" alt="" />
                                                            </div>
                                                            <span className={clsx("flex-1 truncate", !p.alive && "line-through text-[#6b5f50]")} style={{ color: p.alive ? '#e8dcc8' : undefined }}>
                                                                {p.name}
                                                            </span>
                                                            {p.won ? <span className="text-emerald-400 text-xs font-bold">✓ Thắng</span> : <span className="text-[#c62828] text-xs">✗ Thua</span>}
                                                            {!p.alive && <Skull size={10} className="text-[#c62828] shrink-0" />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Villagers */}
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7ab87a] mb-1">🏡 Phe Dân</p>
                                                <div className="space-y-1">
                                                    {villagers.map(([uid, p]) => (
                                                        <div key={uid} className="flex items-center gap-2 text-sm">
                                                            <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0">
                                                                <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=24`} className="w-full h-full object-cover" alt="" />
                                                            </div>
                                                            <span className={clsx("flex-1 truncate", !p.alive && "line-through text-[#6b5f50]")} style={{ color: p.alive ? '#e8dcc8' : undefined }}>
                                                                {p.name}
                                                            </span>
                                                            <span className="text-xs text-[#6b5f50]">{getRoleIconByName(p.role || '')} {p.role}</span>
                                                            {p.won ? <span className="text-emerald-400 text-xs font-bold">✓ Thắng</span> : <span className="text-[#c62828] text-xs">✗ Thua</span>}
                                                            {!p.alive && <Skull size={10} className="text-[#c62828] shrink-0" />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-[#8b5c3a]/20 text-center"
                        style={{ background: 'rgba(26,24,37,0.5)' }}>
                        <p className="text-xs text-[#6b5f50]">Tổng: {gameHistory.length} trận đã chơi</p>
                    </div>
                </div>
            </div>
        );
    };

    // ============ RENDER PHASES ============

    // WAITING
    if (phase === 'waiting') return (
        renderPhaseLayout(<>
            {/* Header */}
            <div className="ww-moon-halo mb-6 mx-auto">
                <WolfIcon size={64} className="text-[#c9873a] drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 20px rgba(201,135,58,0.4))' }} />
            </div>
            <h3 className="ww-title ww-ghostly-reveal text-4xl md:text-5xl mb-2">Ma Sói</h3>
            <p className="ww-body ww-ghostly-reveal text-lg mb-8 tracking-wider" style={{ fontFamily: "'Playfair Display', serif", color: '#a89b85', animationDelay: '0.3s', opacity: 0 }}>— Phòng Chờ —</p>

            {/* Player Circle */}
            {(() => {
                const host = allPlayers.find(p => p.uid === room.hostId);
                const others = allPlayers.filter(p => p.uid !== room.hostId);
                const count = others.length;
                // All coordinates in a fixed viewBox coordinate system (0-500)
                const VB = 500;
                const vcx = VB / 2;
                const vcy = VB / 2;
                const vRadius = count <= 4 ? 160 : count <= 6 ? 175 : count <= 8 ? 190 : 200;

                return (
                    <div className="ww-panel rounded-2xl p-3 md:p-6 mb-6 border border-[#8b5c3a]/20">
                        {/* Container: responsive width, square aspect ratio */}
                        <div className="relative mx-auto w-full" style={{ maxWidth: 520, aspectRatio: '1' }}>
                            {/* SVG decorative lines */}
                            <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="xMidYMid meet" style={{ zIndex: 0 }}>
                                {others.map((p, i) => {
                                    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
                                    return <line key={p.uid} x1={vcx} y1={vcy} x2={vcx + Math.cos(angle) * vRadius} y2={vcy + Math.sin(angle) * vRadius} stroke="rgba(139,92,58,0.12)" strokeWidth="1" strokeDasharray="4 4" />;
                                })}
                                <circle cx={vcx} cy={vcy} r={vRadius} fill="none" stroke="rgba(201,135,58,0.08)" strokeWidth="1" strokeDasharray="6 6" />
                            </svg>

                            {/* Center - Host */}
                            {host && (
                                <div className="absolute" style={{
                                    left: '50%', top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: 10,
                                }}>
                                    <div className="ww-avatar-entrance" style={{ opacity: 0 }}>
                                        <div className="flex flex-col items-center gap-1" style={{ width: 80 }}>
                                            <div className="ww-avatar-spooky relative w-12 h-12 md:w-16 md:h-16 rounded-full overflow-visible"
                                                style={{ boxShadow: '0 0 20px rgba(201,135,58,0.4), 0 0 40px rgba(201,135,58,0.2)' }}>
                                                <img src={host.avatar || `https://ui-avatars.com/api/?name=${host.name}&size=56&background=2a1f3d&color=c9873a&bold=true`} className="w-full h-full object-cover rounded-full" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} />
                                                <div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-xs rounded-full" style={{display:'none'}}>{(host.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div>
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#c9873a] rounded-full flex items-center justify-center shadow-lg"><Crown size={10} className="text-white" /></div>
                                            </div>
                                            <span className="text-[10px] md:text-xs font-semibold text-[#c9873a] text-center leading-tight truncate w-full">{host.name?.split(' ').slice(-2).join(' ')}</span>
                                            <span className="text-[7px] md:text-[9px] font-bold uppercase tracking-wider text-[#c9873a]/70">Trưởng làng</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Orbiting players - positioned by percentage */}
                            {others.map((p, i) => {
                                const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
                                const pctX = ((vcx + Math.cos(angle) * vRadius) / VB) * 100;
                                const pctY = ((vcy + Math.sin(angle) * vRadius) / VB) * 100;
                                return (
                                    <div key={p.uid} className="absolute" style={{
                                        left: `${pctX}%`, top: `${pctY}%`,
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: 5,
                                    }}>
                                        <div className="ww-avatar-entrance" style={{ opacity: 0, animationDelay: `${i * 0.1}s` }}>
                                            <div className="flex flex-col items-center gap-0.5" style={{ width: 64 }}>
                                                <div className="ww-avatar-spooky relative w-8 h-8 md:w-11 md:h-11 rounded-full overflow-visible">
                                                    <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=44&background=2a1f3d&color=c9873a&bold=true`} className="w-full h-full object-cover rounded-full" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} />
                                                    <div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[9px] rounded-full" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div>
                                                </div>
                                                <span className="text-[8px] md:text-[11px] font-semibold text-[#e8dcc8] text-center leading-tight truncate w-full">{p.name?.split(' ').slice(-2).join(' ')}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Player count + Bot selector */}
            <div className="mb-6 space-y-3">
                <p className="text-base text-[#a89b85] font-medium">
                    <span className="text-[#c9873a] font-bold">{allPlayers.length}</span> linh hồn đã tập trung {allPlayers.length < 5 ? <span className="text-[#8b5c3a]">(cần tối thiểu 5)</span> : <span className="text-emerald-400">✓</span>}
                    {botCount > 0 && <span className="text-[#6b5f50] text-sm ml-1">({playerList.length} người + {botCount} máy)</span>}
                </p>
                {isHost && (
                    <div className="flex items-center justify-center gap-3">
                        <span className="text-xs text-[#8b7b6b] font-medium">🤖 Máy tính:</span>
                        <button
                            onClick={() => setBotCount(prev => Math.max(0, prev - 1))}
                            disabled={botCount <= 0}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1a0f04] border border-[#8b5c3a]/30 text-[#c9873a] text-sm font-bold hover:bg-[#8b5c3a]/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        >−</button>
                        <span className="text-lg font-bold text-[#c9873a] min-w-[28px] text-center">{botCount}</span>
                        <button
                            onClick={() => setBotCount(prev => Math.min(12, prev + 1))}
                            disabled={botCount >= 12}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1a0f04] border border-[#8b5c3a]/30 text-[#c9873a] text-sm font-bold hover:bg-[#8b5c3a]/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        >+</button>
                    </div>
                )}
            </div>

            {/* Role Picker / Showcase */}
            {(() => {
                const n = allPlayers.length;
                // Auto-calculated defaults
                const autoWolfCount = n <= 6 ? 2 : n <= 9 ? 2 : 3;
                const autoHasWitch = n >= 6;
                const autoHasHunter = n >= 7;
                const autoHasTanner = n >= 8;
                const autoHasArsonist = n >= 9;
                const autoSpecial = 2 + (autoHasWitch ? 1 : 0) + (autoHasHunter ? 1 : 0) + (autoHasTanner ? 1 : 0) + (autoHasArsonist ? 1 : 0);
                const autoVillager = Math.max(0, n - autoWolfCount - autoSpecial);

                const autoCounts: Record<string, number> = {
                    'Ma Sói': autoWolfCount, 'Tiên tri': 1, 'Bảo vệ': 1,
                    ...(autoHasWitch ? { 'Phù thủy': 1 } : {}),
                    ...(autoHasHunter ? { 'Thợ săn': 1 } : {}),
                    ...(autoHasTanner ? { 'Kẻ chán đời': 1 } : {}),
                    ...(autoHasArsonist ? { 'Kẻ tẩm dầu': 1 } : {}),
                    'Dân làng': autoVillager,
                };

                const isManual = customRoleCounts !== null;
                const counts = isManual ? customRoleCounts : autoCounts;
                const totalRoles = Object.values(counts).reduce((s, c) => s + c, 0);
                const isBalanced = totalRoles === n;
                const hasWolf = (counts['Ma Sói'] || 0) >= 1;

                const allSelectableRoles = WOLF_ROLES; // All defined roles

                const toggleManualMode = () => {
                    if (isManual) {
                        setCustomRoleCounts(null);
                    } else {
                        setCustomRoleCounts({ ...autoCounts });
                    }
                };

                const adjustCount = (roleName: string, delta: number) => {
                    if (!isManual) return;
                    setCustomRoleCounts(prev => {
                        if (!prev) return prev;
                        const cur = prev[roleName] || 0;
                        const next = Math.max(0, cur + delta);
                        const newCounts = { ...prev };
                        if (next === 0) {
                            delete newCounts[roleName];
                        } else {
                            newCounts[roleName] = next;
                        }
                        return newCounts;
                    });
                };

                return (
                    <div className="ww-panel rounded-2xl p-4 md:p-6 mb-6 border border-[#8b5c3a]/20">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-bold text-[#c9873a] flex items-center gap-1.5" style={{ fontFamily: "'Playfair Display', serif" }}>
                                <Users size={14} /> Nhân vật trong ván ({n} người chơi)
                            </p>
                            {isHost && n >= 5 && (
                                <button
                                    onClick={toggleManualMode}
                                    className={`text-[10px] md:text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${isManual
                                        ? 'bg-[#c9873a]/20 text-[#c9873a] border border-[#c9873a]/40'
                                        : 'bg-[#1a1825]/60 text-[#6b5f50] border border-[#8b5c3a]/20 hover:border-[#c9873a]/30'
                                    }`}
                                >
                                    {isManual ? '🔧 Thủ công' : '⚡ Tự động'}
                                </button>
                            )}
                        </div>

                        {/* Validation bar (manual mode) */}
                        {isManual && (
                            <div className={`flex items-center justify-center gap-2 text-xs font-bold mb-3 px-3 py-1.5 rounded-lg transition-all ${
                                isBalanced && hasWolf
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                                {isBalanced && hasWolf ? (
                                    <span>✅ Đã chọn {totalRoles}/{n} vai — Sẵn sàng!</span>
                                ) : !hasWolf ? (
                                    <span>⚠️ Cần ít nhất 1 Ma Sói! ({totalRoles}/{n} vai)</span>
                                ) : totalRoles < n ? (
                                    <span>⚠️ Thiếu {n - totalRoles} vai — cần thêm ({totalRoles}/{n})</span>
                                ) : (
                                    <span>⚠️ Thừa {totalRoles - n} vai — cần bớt ({totalRoles}/{n})</span>
                                )}
                            </div>
                        )}

                        {/* Role Cards Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                            {allSelectableRoles.map(r => {
                                const count = counts[r.role] || 0;
                                const isActive = count > 0;
                                return (
                                    <div key={r.role} className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all group ${
                                        isActive
                                            ? 'bg-gradient-to-b from-[#1a1825]/80 to-[#0f0e1a]/60 border border-[#8b5c3a]/30 hover:border-[#c9873a]/50'
                                            : 'bg-gradient-to-b from-[#0f0e1a]/40 to-[#0a0915]/30 border border-[#333]/20 opacity-40'
                                    } ${isManual && isHost ? 'hover:scale-[1.03]' : 'hover:scale-[1.05]'}`}>
                                        {/* Card image */}
                                        <div className={`relative w-12 h-18 md:w-14 md:h-20 rounded-lg overflow-hidden shadow-lg transition-shadow ${isActive ? 'group-hover:shadow-[#c9873a]/20' : ''}`}>
                                            <img src={r.cardImage} alt={r.role} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} />
                                            <div className="av-fb absolute inset-0 bg-gradient-to-br from-[#2a1f3d] to-[#1a0f2d] items-center justify-center text-2xl" style={{display:'none'}}>{r.icon}</div>
                                        </div>
                                        {/* Role name */}
                                        <span className="text-[10px] md:text-xs font-bold text-[#e8dcc8] text-center leading-tight">{r.icon} {r.role}</span>
                                        {/* Count display/control */}
                                        {isManual && isHost ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => adjustCount(r.role, -1)}
                                                    disabled={count <= 0}
                                                    className="w-6 h-6 flex items-center justify-center rounded-md bg-[#1a0f04] border border-[#8b5c3a]/30 text-[#c9873a] text-sm font-bold hover:bg-[#8b5c3a]/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                                >−</button>
                                                <span className={`text-sm font-bold min-w-[20px] text-center ${isActive ? 'text-[#c9873a]' : 'text-[#6b5f50]'}`}>{count}</span>
                                                <button
                                                    onClick={() => adjustCount(r.role, 1)}
                                                    className="w-6 h-6 flex items-center justify-center rounded-md bg-[#1a0f04] border border-[#8b5c3a]/30 text-[#c9873a] text-sm font-bold hover:bg-[#8b5c3a]/20 transition-all"
                                                >+</button>
                                            </div>
                                        ) : isActive ? (
                                            <span className="text-[10px] font-bold text-[#c9873a] bg-[#c9873a]/10 px-1.5 py-0.5 rounded-full">×{count}</span>
                                        ) : null}
                                        {/* Description */}
                                        <p className="text-[8px] md:text-[9px] text-[#8b7b6b] text-center leading-tight line-clamp-2 hidden sm:block">{r.desc}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Reset to auto button */}
                        {isManual && isHost && (
                            <button onClick={() => setCustomRoleCounts({ ...autoCounts })}
                                className="mt-3 w-full py-1.5 text-xs text-[#6b5f50] hover:text-[#c9873a] transition-colors font-medium">
                                ↩ Đặt lại theo gợi ý tự động
                            </button>
                        )}
                    </div>
                );
            })()}

            {/* Action buttons */}
            {isHost && allPlayers.length >= 5 && (
                <button
                    onClick={assignRoles}
                    disabled={customRoleCounts !== null && Object.values(customRoleCounts).reduce((s, c) => s + c, 0) !== allPlayers.length}
                    className="w-full max-w-sm mx-auto block px-8 py-4 ww-btn-primary text-xl shadow-xl hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    🐺 Chia Vai & Bắt Đầu
                </button>
            )}
            {!isHost && <p className="text-base text-[#6b5f50] italic animate-pulse">Chờ trưởng làng bắt đầu...</p>}

            {/* History button */}
            {gameHistory.length > 0 && (
                <button onClick={() => setShowHistory(true)}
                    className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold transition-all border border-[#8b5c3a]/40 hover:border-[#c9873a]/60 hover:bg-[#8b5c3a]/15"
                    style={{ color: '#c9873a', background: 'rgba(26,24,37,0.6)' }}>
                    📜 Lịch sử trận đấu ({gameHistory.length})
                </button>
            )}
            {renderHistory()}

            {renderStats()}
        </>, false, "text-center")
    );

    // ---- HELPER: get wolf teammates ----
    const getWolfTeammates = () => {
        if (myRole?.role !== 'Ma Sói') return [];
        return Object.entries(gs.roles || {})
            .filter(([uid, r]: [string, any]) => r.role === 'Ma Sói' && uid !== myUid)
            .map(([uid]) => ({ uid, ...playerNames[uid] }));
    };

    // ROLES ASSIGNED — Single scratch-to-reveal card only
    if (phase === 'roles-assigned') {
        const wolfTeammates = getWolfTeammates();
        const roleInfo = myRole ? WOLF_ROLES.find(r => r.role === myRole.role) : null;
        
        // Scratch card logic
        const botUidsList = gs.botUids || [];
        const humanUids = Object.keys(gs.roles || {}).filter(uid => !botUidsList.includes(uid));
        const scratchedCount = humanUids.filter(uid => gs.scratchedCards?.[uid]).length;
        const allScratched = scratchedCount === humanUids.length;

        return (
            renderPhaseLayout(<>
                <div className="flex flex-col items-center justify-center w-full" style={{ minHeight: 'min(70vh, 600px)' }}>
                    {myRole && (
                        <>
                            <ScratchRevealCard
                                cardImage={roleInfo?.cardImage}
                                roleName={myRole.role}
                                roleIcon={myRole.icon}
                                onRevealed={() => {
                                    setShowMyRole(true);
                                    if (!gs.scratchedCards?.[myUid] && !botUidsList.includes(myUid)) {
                                        MinigameService.updateGameState(room.id, {
                                            ...gs,
                                            scratchedCards: { ...(gs.scratchedCards || {}), [myUid]: true }
                                        });
                                    }
                                }}
                            />
                            <motion.p
                                className="mt-2 text-base text-[#8b5c3a] font-medium"
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                {showMyRole === true ? '✨ Vai trò đã được tiết lộ!' : '👆 Cào thẻ để xem vai trò'}
                            </motion.p>
                            <AnimatePresence>
                                {showMyRole === true && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 20 }}
                                        transition={{ delay: 0.3 }}
                                        className="mt-4 text-center"
                                    >
                                        <p className="font-bold text-[#c9873a] text-2xl" style={{ fontFamily: "'Playfair Display', serif" }}>{myRole.icon} {myRole.role}</p>
                                        <p className="text-sm text-[#a89b85] mt-1 italic max-w-xs mx-auto">{getRoleDesc(myRole.role)}</p>
                                        <p className="text-xs text-[#6b5f50] mt-2 flex items-center justify-center gap-1"><Shield size={12} /> Giữ bí mật vai trò của bạn!</p>
                                        {myRole.role === 'Ma Sói' && wolfTeammates.length > 0 && (
                                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                                                className="mt-4 p-3 ww-panel-blood rounded-xl">
                                                <p className="text-sm font-bold text-[#c62828] mb-2 flex items-center justify-center gap-1">
                                                    <Users size={12} /> 🐺 Đồng đội Ma Sói:
                                                </p>
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    {wolfTeammates.map(w => (
                                                        <span key={w.uid} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#2a0a0a] rounded-lg text-sm font-medium text-[#c9873a]">
                                                            <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0"><img src={w.avatar || `https://ui-avatars.com/api/?name=${w.name}&size=24`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[7px]" style={{display:'none'}}>{(w.name||'?').split(' ').map((w2: string)=>w2[0]).join('').slice(0,2)}</div></div>
                                                            {w.name} 🐺
                                                        </span>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    )}
                </div>

                <div className="flex flex-col items-center mt-4 p-4 ww-panel rounded-xl border border-[#8b5c3a]/20 w-full max-w-sm mx-auto">
                    <p className="text-sm font-bold text-[#c9873a] mb-2 flex items-center justify-center gap-1">
                        💳 Trạng thái cào thẻ {scratchedCount}/{humanUids.length}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mb-3">
                        {humanUids.map(uid => {
                            const hasScratched = gs.scratchedCards?.[uid];
                            return (
                                <span key={uid} className={clsx(
                                    "px-2 py-0.5 rounded-md text-xs font-medium border",
                                    hasScratched ? "bg-[#1a2e1a] text-[#7ab87a] border-[#7ab87a]/30" : "bg-[#2a0a0a] text-[#c62828] border-[#c62828]/30"
                                )}>
                                    {playerNames[uid]?.name?.split(' ').pop()} {hasScratched ? '✓' : '...'}
                                </span>
                            );
                        })}
                    </div>
                    {isHost ? (
                        <button 
                            onClick={startNight} 
                            disabled={!allScratched}
                            className={clsx(
                                "px-6 py-3 w-full font-bold transition-all",
                                allScratched ? "ww-btn-night" : "bg-[#1a1a2e]/50 text-[#8b7acc]/50 border border-[#8b7acc]/20 rounded-xl cursor-not-allowed"
                            )}
                        >
                            🌙 {allScratched && startNightCountdown !== null ? `Tự động vào Đêm trong ${startNightCountdown}s... (Bấm để gọi luôn)` : 'Bắt đầu Đêm 1 (Đợi mọi người cào)'}
                        </button>
                    ) : (
                        <p className={clsx("text-sm font-bold text-center", allScratched && startNightCountdown !== null ? "text-[#c9873a] animate-pulse" : "text-[#8b5c3a] italic")}>
                            {allScratched && startNightCountdown !== null ? `Tự động vào Đêm 1 trong ${startNightCountdown}s...` : 'Đợi mọi người cào thẻ để bắt đầu...'}
                        </p>
                    )}
                </div>

                <GameEventLog roomId={room.id} />
                <SeparatedChats roomId={room.id} myUid={myUid} myName={myName} myAvatar={myAvatar} channel={getChatChannel()} visibleChannels={getVisibleChannels()} title="💬 Chat trước khi vào đêm" canSwitchToWolf={isWolf && showMyRole === true} />
            </>, false, "text-center")
        );
    }

    // NIGHT - WOLVES
    if (phase === 'night-wolf') {
        const isWolf = myRole?.role === 'Ma Sói' && myRole.alive;
        const myVote = gs.wolfVotes?.[myUid];
        const wolfTeammates = getWolfTeammates();
        return (
            renderPhaseLayout(<>

                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-[#6b5f50] text-base mt-1">🐺 Ma Sói thức dậy...</p>
                </div>
                {isWolf ? (
                    <div>
                        {/* Show wolf teammates */}
                        {wolfTeammates.length > 0 && (
                            <div className="mb-3 p-2.5 ww-panel-blood rounded-xl">
                                <p className="text-xs font-bold text-[#8b1a1a] mb-1.5 flex items-center gap-1"><Users size={10} /> Đồng đội 🐺:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {wolfTeammates.map(w => (
                                        <span key={w.uid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#2a0a0a] rounded-md text-sm font-medium text-[#c9873a]">
                                            <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0"><img src={w.avatar || `https://ui-avatars.com/api/?name=${w.name}&size=20`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[6px]" style={{display:'none'}}>{(w.name||'?').split(' ').map((w2: string)=>w2[0]).join('').slice(0,2)}</div></div>
                                            {w.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="text-base font-bold text-[#8b1a1a] mb-2">🐺 Chọn nạn nhân:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-3">
                            {alivePlayers.map(p => {
                                const isSelf = p.uid === myUid;
                                return (
                                    <PlayerCard key={p.uid} p={p} onClick={() => wolfVote(p.uid)} selected={myVote === p.uid}
                                        extra={<span className="text-sm text-[#8b1a1a] font-bold">{isSelf ? '(bạn)' : ''}{myVote === p.uid ? ' 🎯' : ''}</span>} />
                                );
                            })}
                        </div>
                        {myVote && <p className="text-sm text-[#7ab87a] font-bold text-center">✓ Đã chọn, đợi đồng đội...</p>}
                        {/* Wolf chat during night */}
                        <GameEventLog roomId={room.id} />
                        <ChatBox roomId={room.id} myUid={myUid} myName={myName} myAvatar={myAvatar} channel="wolf" visibleChannels={['wolf', 'system']} title="🐺 Chat Ma Sói (bí mật)" maxHeight={200} isWolf />
                    </div>
                ) : (
                    <div className="text-center p-4">
                        {myRole?.alive ? (
                            <p className="text-base text-[#6b5f50]">Hãy chờ Ma Sói hành động...</p>
                        ) : (
                            <p className="text-base text-[#6b5f50]">💀 Bạn đã bị loại. Quan sát trò chơi.</p>
                        )}
                    </div>
                )}
            </>)
        );
    }

    // NIGHT - SEER PEEK (choose 1 person to peek at)
    if (phase === 'night-seer') {
        const isSeer = myRole?.role === 'Tiên tri' && myRole.alive;
        if (!hasSeerAlive) {
            return renderPhaseLayout(<>
                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-[#a3c9a8] text-base mt-1">🔮 Tiên tri đã ngã xuống...</p>
                </div>
                <Loader2 size={20} className="animate-spin mx-auto text-[#a3c9a8]" />
                <p className="text-base text-[#6b5f50] text-center mt-2">Đang xử lý...</p>
            </>, false, "text-center");
        }
        return (
            renderPhaseLayout(<>
                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-[#a3c9a8] text-base mt-1">🔮 Tiên tri thức dậy...</p>
                </div>
                {isSeer ? (
                    <div>
                        {/* Show seer result if already peeked */}
                        {gs.seerTarget && gs.seerResult ? (
                            <div className="text-center p-4">
                                <p className="text-lg font-bold text-[#c9873a] mb-3">🔮 Kết quả soi:</p>
                                <p className="text-xl font-bold text-[#e8dcc8] mb-2">{playerNames[gs.seerTarget]?.name || '???'}</p>
                                {gs.seerResult === 'wolf' ? (
                                    <div className="bg-[#2a0a0a]/60 border border-[#c62828]/30 rounded-xl p-4 mb-4">
                                        <p className="text-2xl font-bold text-[#c62828]">🐺 Là MA SÓI!</p>
                                    </div>
                                ) : (
                                    <div className="bg-[#0a2a1a]/60 border border-emerald-500/30 rounded-xl p-4 mb-4">
                                        <p className="text-2xl font-bold text-emerald-400">✅ Không phải Ma Sói</p>
                                    </div>
                                )}
                                <button onClick={confirmSeerResult} className="px-6 py-2.5 bg-[#8b5c3a] hover:bg-[#a06a3a] text-white rounded-xl font-bold text-base transition-colors">Đã hiểu → Tiếp tục</button>
                            </div>
                        ) : (
                            <>
                                <p className="text-base font-bold text-[#a3c9a8] mb-2">🔮 Chọn 1 người để soi:</p>
                                <p className="text-sm text-[#6b5f50] mb-3 italic">Bạn sẽ biết người đó có phải Ma Sói hay không.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-3">
                                    {aliveOthers.map(p => (
                                        <PlayerCard key={p.uid} p={p} onClick={() => seerPeek(p.uid)} />
                                    ))}
                                </div>
                                <button onClick={skipSeer} className="w-full py-2 text-base text-[#6b5f50] hover:text-slate-600">Bỏ qua (không soi)</button>
                            </>
                        )}
                    </div>
                ) : (
                    <p className="text-base text-[#6b5f50] text-center p-4">{myRole?.alive ? `${getRoleIconByName(myRole?.role || '')} Chờ Tiên tri hành động...` : '💀 Quan sát...'}</p>
                )}
            </>)
        );
    }

    // NIGHT - GUARD (auto-skip if dead — no reveal)
    if (phase === 'night-guard') {
        const isGuard = myRole?.role === 'Bảo vệ' && myRole.alive;
        if (!hasGuardAlive) {
            return renderPhaseLayout(<>
                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-emerald-300 text-base mt-1">🛡️ Bảo vệ thức dậy...</p>
                </div>
                <Loader2 size={20} className="animate-spin mx-auto text-emerald-400" />
                <p className="text-base text-[#6b5f50] text-center mt-2">Đang xử lý...</p>
            </>, false, "text-center");
        }
        return (
            renderPhaseLayout(<>
                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-emerald-300 text-base mt-1">🛡️ Bảo vệ thức dậy...</p>
                </div>
                {isGuard ? (
                    <div>
                        <p className="text-base font-bold text-[#7ab87a] mb-2">🛡️ Chọn người muốn bảo vệ:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-3">
                            {alivePlayers.map(p => (
                                <PlayerCard key={p.uid} p={p} onClick={() => guardProtect(p.uid)} disabled={p.uid === gs.guardLastTarget}
                                    extra={p.uid === gs.guardLastTarget ? <span className="text-xs text-[#6b5f50]">(đêm trước)</span> : undefined} />
                            ))}
                        </div>
                        <button onClick={skipGuard} className="w-full py-2 text-base text-[#6b5f50] hover:text-slate-600">Không bảo vệ ai</button>
                    </div>
                ) : (
                    <p className="text-base text-[#6b5f50] text-center p-4">{myRole?.alive ? `${getRoleIconByName(myRole?.role || '')} Chờ Bảo vệ hành động...` : '💀 Quan sát...'}</p>
                )}
            </>)
        );
    }

    // NIGHT - WITCH (auto-skip if dead — no reveal)
    if (phase === 'night-witch') {
        const isWitch = myRole?.role === 'Phù thủy' && myRole.alive;
        const wolfTarget = gs.wolfTarget;
        const targetName = wolfTarget ? playerNames[wolfTarget]?.name || '???' : null;
        const usedAbilityThisNight = gs.witchSaveThisNight || !!gs.witchKillTarget;
        const canSave = !gs.witchSaveUsed && wolfTarget && wolfTarget !== gs.guardTarget && !gs.witchKillTarget;
        const canKill = !gs.witchKillUsed && !gs.witchSaveThisNight;
        if (!hasWitchAlive) {
            return renderPhaseLayout(<>
                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-cyan-300 text-base mt-1">🧙 Phù thủy thức dậy...</p>
                </div>
                <Loader2 size={20} className="animate-spin mx-auto text-cyan-400" />
                <p className="text-base text-[#6b5f50] text-center mt-2">Đang xử lý...</p>
            </>, false, "text-center");
        }
        return (
            renderPhaseLayout(<>
                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-cyan-300 text-base mt-1">🧙 Phù thủy thức dậy...</p>
                </div>
                {isWitch ? (
                    <div className="space-y-3">
                        {wolfTarget && (
                            <div className="p-3 bg-[#1a0808] rounded-xl border border-[#8b1a1a]/30">
                                <p className="text-base text-[#c62828] font-bold">💀 Ma Sói đã cắn: {targetName}</p>
                                {canSave && !gs.witchSaveThisNight && (
                                    <button onClick={witchSave} className="mt-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-bold">💊 Dùng thuốc cứu</button>
                                )}
                                {gs.witchSaveThisNight && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <p className="text-sm text-[#7ab87a] font-bold">✓ Đã cứu</p>
                                        <button onClick={witchUndoSave} className="px-2 py-0.5 bg-[#2a1a1a] hover:bg-[#3a2020] text-[#c62828] rounded-md text-xs font-bold border border-[#8b1a1a]/30 transition-colors">↩ Hủy cứu</button>
                                    </div>
                                )}
                                {gs.witchSaveUsed && !gs.witchSaveThisNight && <p className="text-sm text-[#6b5f50] mt-1">Đã dùng thuốc cứu rồi</p>}
                            </div>
                        )}
                        {canKill && !gs.witchKillTarget && !usedAbilityThisNight && (
                            <div className="p-3 bg-[#201020]/80 rounded-xl border border-[#6b3a8b]/30">
                                <p className="text-base text-[#c9a3e8] font-bold mb-2">☠️ Thuốc độc (chọn hoặc bỏ qua):</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                    {aliveOthers.map(p => <PlayerCard key={p.uid} p={p} onClick={() => witchKill(p.uid)} />)}
                                </div>
                            </div>
                        )}
                        {gs.witchKillTarget && (
                            <div className="p-3 bg-[#201020]/80 rounded-xl border border-[#6b3a8b]/30">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-[#9b6bc4] font-bold">☠️ Mục tiêu thuốc độc: <span className="text-[#c9a3e8]">{playerNames[gs.witchKillTarget]?.name || '???'}</span></p>
                                    <button onClick={witchUndoKill} className="px-2 py-0.5 bg-[#2a1a2a] hover:bg-[#3a2040] text-[#9b6bc4] rounded-md text-xs font-bold border border-[#6b3a8b]/30 transition-colors">↩ Đổi ý</button>
                                </div>
                            </div>
                        )}
                        {usedAbilityThisNight && !gs.witchKillTarget && <p className="text-xs text-[#c9873a] italic mt-1">⚠️ Mỗi đêm chỉ được dùng 1 chức năng</p>}
                        {gs.witchKillUsed && !gs.witchKillTarget && !usedAbilityThisNight && <p className="text-sm text-[#6b5f50] mt-1">Đã dùng thuốc độc ở đêm trước</p>}
                        <button onClick={witchDone} className="w-full py-2.5 bg-cyan-600 text-white rounded-xl font-bold text-base mt-2">✓ Xong, kết thúc đêm</button>
                    </div>
                ) : (
                    <p className="text-base text-[#6b5f50] text-center p-4">{myRole?.alive ? `${getRoleIconByName(myRole?.role || '')} Chờ Phù thủy hành động...` : '💀 Quan sát...'}</p>
                )}
            </>)
        );
    }

    // NIGHT - HUNTER
    if (phase === 'night-hunter') {
        const isHunter = myRole?.role === 'Thợ săn' && myRole.alive;
        if (!hasHunterAlive) {
            return renderPhaseLayout(<>
                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-red-300 text-base mt-1">🏹 Thợ săn thức dậy...</p>
                </div>
                <Loader2 size={20} className="animate-spin mx-auto text-red-400" />
                <p className="text-base text-[#6b5f50] text-center mt-2">Đang xử lý...</p>
            </>, false, "text-center");
        }
        return (
            renderPhaseLayout(<>
                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-red-300 text-base mt-1">🏹 Thợ săn thức dậy...</p>
                </div>
                {isHunter ? (
                    <div>
                        <p className="text-base font-bold text-[#c62828] mb-2">🏹 Chọn một người để ghim:</p>
                        <p className="text-sm text-[#8b5c3a] mb-3 italic">Bạn không thể ghim người mà bạn đã ghim ở đêm trước.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-3">
                            {aliveOthers.map(p => (
                                <PlayerCard key={p.uid} p={p} onClick={() => hunterPin(p.uid)} 
                                    selected={p.uid === gs.hunterPinned}
                                    disabled={p.uid === gs.hunterLastPinned}
                                    extra={
                                        p.uid === gs.hunterPinned ? <span className="text-sm text-[#c62828] font-bold">🎯 Đang ghim</span> : 
                                        p.uid === gs.hunterLastPinned ? <span className="text-xs text-[#6b5f50]">(đã ghim đêm trước)</span> : undefined
                                    } />
                            ))}
                        </div>
                        <button onClick={hunterDone} disabled={!gs.hunterPinned} className={clsx("w-full py-2.5 rounded-xl font-bold text-base mt-2 transition-all", gs.hunterPinned ? "bg-red-600 text-white" : "bg-red-900/40 text-red-500/50 cursor-not-allowed")}>✓ Xong, kết thúc lượt</button>
                    </div>
                ) : (
                    <p className="text-base text-[#6b5f50] text-center p-4">{myRole?.alive ? `${getRoleIconByName(myRole?.role || '')} Chờ Thợ săn hành động...` : '💀 Quan sát...'}</p>
                )}
            </>)
        );
    }

    // (night-resolve useEffect moved to top-level hooks area)

    // NIGHT - ARSONIST
    if (phase === 'night-arsonist') {
        const isArsonist = myRole?.role === 'Kẻ tẩm dầu' && myRole.alive;
        if (!hasArsonistAlive) {
            return renderPhaseLayout(<>
                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-orange-300 text-base mt-1">🔥 Kẻ tẩm dầu thức dậy...</p>
                </div>
                <Loader2 size={20} className="animate-spin mx-auto text-orange-400" />
                <p className="text-base text-[#6b5f50] text-center mt-2">Đang xử lý...</p>
            </>, false, "text-center");
        }
        const oiledPlayers = gs.arsonistOiled || [];
        const canIgnite = oiledPlayers.filter(uid => gs.roles?.[uid]?.alive).length > 0;
        return (
            renderPhaseLayout(<>
                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <WolfIcon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-orange-300 text-base mt-1">🔥 Kẻ tẩm dầu thức dậy...</p>
                </div>
                {isArsonist ? (
                    <div className="space-y-3">
                        {/* Oiled players list */}
                        {oiledPlayers.length > 0 && (
                            <div className="p-3 bg-[#2a1a08]/60 rounded-xl border border-orange-500/30">
                                <p className="text-xs font-bold text-orange-400 mb-1.5">🛢️ Đã tẩm dầu ({oiledPlayers.filter(uid => gs.roles?.[uid]?.alive).length}):</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {oiledPlayers.filter(uid => gs.roles?.[uid]?.alive).map(uid => (
                                        <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1a0f04] rounded-md text-sm font-medium text-orange-300">
                                            🛢️ {playerNames[uid]?.name || '???'}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action choice */}
                        {gs.arsonistActionThisNight === 'ignite' ? (
                            <div className="p-4 bg-[#2a0a00]/80 rounded-xl border-2 border-orange-500/50 text-center">
                                <p className="text-lg font-bold text-orange-400 mb-2">🔥 Đã chọn CHÂM LỬA!</p>
                                <p className="text-sm text-[#a89b85]">Tất cả {oiledPlayers.filter(uid => gs.roles?.[uid]?.alive).length} người đã tẩm dầu sẽ bị thiêu rụi.</p>
                                <button onClick={() => MinigameService.mergeGameState(room.id, { arsonistActionThisNight: null, arsonistOilTarget: null })}
                                    className="mt-2 px-3 py-1 bg-[#333] hover:bg-[#444] text-[#aaa] rounded-lg text-xs">↩ Đổi ý</button>
                            </div>
                        ) : gs.arsonistOilTarget ? (
                            <div className="p-4 bg-[#1a1008]/80 rounded-xl border border-[#8b5c3a]/30 text-center">
                                <p className="text-base font-bold text-orange-300 mb-1">🛢️ Đã chọn tẩm dầu:</p>
                                <p className="text-lg text-[#e8dcc8] font-bold">{playerNames[gs.arsonistOilTarget]?.name || '???'}</p>
                                <button onClick={() => MinigameService.mergeGameState(room.id, { arsonistActionThisNight: null, arsonistOilTarget: null })}
                                    className="mt-2 px-3 py-1 bg-[#333] hover:bg-[#444] text-[#aaa] rounded-lg text-xs">↩ Đổi ý</button>
                            </div>
                        ) : (
                            <>
                                <p className="text-base font-bold text-orange-300 mb-2">🛢️ Chọn 1 người để tẩm dầu:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-3">
                                    {aliveOthers.filter(p => !oiledPlayers.includes(p.uid)).map(p => (
                                        <PlayerCard key={p.uid} p={p} onClick={() => arsonistOil(p.uid)}
                                            extra={oiledPlayers.includes(p.uid) ? <span className="text-xs text-orange-400">🛢️</span> : undefined} />
                                    ))}
                                </div>
                                {canIgnite && (
                                    <button onClick={arsonistIgnite}
                                        className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl font-bold text-base transition-all shadow-lg shadow-orange-500/30">
                                        🔥 CHÂM LỬA — Đốt tất cả {oiledPlayers.filter(uid => gs.roles?.[uid]?.alive).length} người!
                                    </button>
                                )}
                            </>
                        )}
                        <button onClick={arsonistDone} className="w-full py-2.5 bg-orange-700 text-white rounded-xl font-bold text-base mt-2">✓ Xong</button>
                        <button onClick={skipArsonist} className="w-full py-2 text-base text-[#6b5f50] hover:text-slate-600">Bỏ qua (không làm gì)</button>
                    </div>
                ) : (
                    <p className="text-base text-[#6b5f50] text-center p-4">{myRole?.alive ? `${getRoleIconByName(myRole?.role || '')} Chờ hành động ban đêm...` : '💀 Quan sát...'}</p>
                )}
            </>)
        );
    }

    if (phase === 'night-resolve') {
        return renderPhaseLayout(<>
            <Loader2 size={24} className="animate-spin mx-auto text-[#c9873a]" />
            <p className="text-base text-[#6b5f50] mt-2">Đang tổng hợp kết quả đêm...</p>
            <p className="text-xs text-[#6b5f50]/60 mt-1">Tự động bỏ qua sau 15 giây nếu gặp lỗi</p>
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                {isHost && (
                    <button 
                        onClick={() => { resolvingRef.current = false; resolveNight(); }}
                        className="px-4 py-2 ww-btn-primary text-sm"
                    >
                        🔄 Thử lại
                    </button>
                )}
                <button 
                    onClick={() => MinigameService.mergeGameState(room.id, { phase: 'day-discussion', nightLog: '☀️ Đêm bình yên (bỏ qua).', nightKilled: null })}
                    className="px-4 py-2 bg-[#333] hover:bg-[#444] text-[#aaa] rounded-xl text-sm font-medium transition-colors"
                >
                    ⏭️ Bỏ qua đêm
                </button>
            </div>
        </>, false, "text-center");
    }
    // DAY - DISCUSSION
    if (phase === 'day-discussion') return (
        renderPhaseLayout(<>

            <div className="text-center mb-4">
                <Sun size={32} className="mx-auto mb-2 text-[#c9873a]" />
                <h3 className="ww-heading text-xl">☀️ Ban ngày — Đêm {gs.night}</h3>
                {gs.nightLog && <p className="text-base mt-2 p-3 ww-panel-parchment rounded-xl">{gs.nightLog}</p>}
                {gs.nightKilled && <p className="text-sm text-[#c62828] mt-1 italic">Người chết chỉ thấy trên lá bài của chính mình.</p>}
            </div>
            <div className="mb-3">
                <p className="text-sm font-bold text-[#6b5f50] mb-2">NGƯỜI CHƠI ({allPlayers.length})</p>
                {allPlayers.map(p => {
                    const isBotPlayer = isBot(p.uid);
                    const showBotLabel = isBotPlayer && !isStealthBot(p.uid);
                    return (
                        <div key={p.uid} className="flex items-center gap-2 py-1.5 text-base">
                            <div className={clsx("relative w-6 h-6 rounded-full shrink-0", !gs.roles?.[p.uid]?.alive ? "ww-avatar-dead" : "ww-avatar-spooky")} style={{overflow:'visible'}}><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=32&background=2a1f3d&color=c9873a`} className="w-full h-full object-cover rounded-full" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[8px] rounded-full" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                            👤 {p.name}{showBotLabel && <span className="text-[9px] ml-1 text-[#6b8ab5]">(AI)</span>}
                            {p.uid === myUid && !gs.roles?.[p.uid]?.alive && <span className="text-xs text-[#c62828] ml-1">(💀 bạn)</span>}
                        </div>
                    );
                })}
            </div>
            <p className="text-sm text-[#c9873a] font-medium text-center mb-3 animate-pulse">💬 Hãy thảo luận và đưa ra ý kiến trước khi bỏ phiếu!</p>
            {isHost ? (
                <button onClick={() => { if (!resolvingRef.current) { resolvingRef.current = true; startDayVote().finally(() => resolvingRef.current = false); } }} className="w-full py-2.5 ww-btn-primary text-base mb-2">
                    🗳️ Bắt đầu Bỏ phiếu {discussionCountdown !== null ? `(${discussionCountdown}s)` : ''}
                </button>
            ) : (
                <div className="text-center font-bold text-[#e8dcc8] mb-2 px-3 py-2 bg-[#1a0f04]/60 rounded-xl border border-[#c9873a]/40 shadow-lg shadow-[#c9873a]/10">
                    🗳️ Tự động Bỏ phiếu sau <span className="text-[#c9873a] text-lg animate-pulse">{discussionCountdown !== null ? discussionCountdown : 20}</span> giây...
                </div>
            )}
            <GameEventLog roomId={room.id} />
            <SeparatedChats roomId={room.id} myUid={myUid} myName={myName} myAvatar={myAvatar} channel={getChatChannel()} visibleChannels={getVisibleChannels()} title="💬 Thảo luận ban ngày" maxHeight={300} canSwitchToWolf={isWolf} />
        </>)
    );

    // DAY - VOTE
    if (phase === 'day-vote') {
        const myVote = gs.votes?.[myUid];
        const skipped = (gs.skipVotes || []).includes(myUid);
        const totalAlive = alivePlayers.length;
        const totalVoted = Object.keys(gs.votes || {}).length + (gs.skipVotes || []).length;
        return (
            renderPhaseLayout(<>

                <div className="text-center mb-3">
                    <h3 className="ww-heading text-xl">🗳️ Bỏ phiếu — Đêm {gs.night}</h3>
                    <p className="text-sm text-[#6b5f50]">{totalVoted}/{totalAlive} đã vote</p>
                    {voteCountdown !== null && <p className="text-sm text-[#c9873a] font-bold mt-1 animate-pulse">⏳ Chuyển sang phản biện trong {voteCountdown} giây...</p>}
                </div>
                {/* Vote Status Tracker */}
                <div className="mb-3 p-2.5 bg-[#16141f]/80 rounded-xl border border-[#8b5c3a]/30">
                    <p className="text-xs font-semibold text-[#a89b85] uppercase tracking-wider mb-2 text-center">Trạng thái bỏ phiếu</p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                        {alivePlayers.map(p => {
                            const hasVoted = !!(gs.votes || {})[p.uid];
                            const hasSkipped = (gs.skipVotes || []).includes(p.uid);
                            const isDone = hasVoted || hasSkipped;
                            return (
                                <div key={p.uid} className={clsx(
                                    'flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium transition-all',
                                    isDone
                                        ? 'bg-[#0f1a10] text-[#7ab87a] border border-[#2a4a1a]/40'
                                        : 'bg-[#1a1510]/80 text-[#c9873a] border border-[#8b6914]/40'
                                )}>
                                    <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0"><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=20`}
                                        className={clsx('w-full h-full object-cover rounded-full', isDone ? 'ring-1 ring-emerald-400' : 'ring-1 ring-amber-300')} alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 rounded-full items-center justify-center text-amber-100 font-bold text-[6px]" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                    <span className="max-w-[60px] truncate">{p.name.split(' ').pop()}</span>
                                    {hasVoted && <span className="text-[#7ab87a]">✓</span>}
                                    {hasSkipped && <span className="text-[#6b8db5]">⏭</span>}
                                    {!isDone && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
                {myRole?.alive ? (
                    <div className="mb-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 p-3 rounded-xl border border-[#8b5c3a]/30 bg-[#16141f]/60">
                            {alivePlayers.map(p => {
                                const voteCount = Object.values(gs.votes || {}).filter(v => v === p.uid).length;
                                const isSelf = p.uid === myUid;
                                return (
                                    <PlayerCard key={p.uid} p={p} onClick={isSelf ? undefined : () => dayVote(p.uid)} selected={myVote === p.uid} disabled={isSelf}
                                        extra={<span className="text-sm text-[#6b5f50]">{isSelf ? '(bạn)' : ''}{voteCount > 0 ? ` ${voteCount} phiếu` : ''}</span>} />
                                );
                            })}
                        </div>
                        <button onClick={daySkip} className={clsx("w-full py-3 rounded-xl text-base font-bold transition-all border-2",
                            skipped ? "bg-gradient-to-r from-[#8b5c3a] to-[#c9873a] text-white border-[#c9873a] shadow-lg shadow-[#8b5c3a]/30" : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border-amber-500/60 hover:border-amber-400 shadow-md shadow-amber-500/10 hover:shadow-amber-500/20")}>
                            <ThumbsUp size={16} className="inline mr-1.5" /> Bỏ qua {skipped && '✓'}
                        </button>
                    </div>
                ) : (
                    <div className="mb-3 space-y-3">
                        <div className="text-center p-3 rounded-xl bg-[#1a0808]/60 border border-[#8b1a1a]/30">
                            <p className="text-base text-[#c62828] font-bold">💀 Bạn đã bị loại.</p>
                            <p className="text-sm text-[#6b5f50] mt-1">Bạn không thể bỏ phiếu, nhưng vẫn có thể theo dõi diễn biến.</p>
                        </div>
                        {/* Show vote results for dead players (read-only) */}
                        <div className="p-3 rounded-xl border border-[#8b5c3a]/20 bg-[#16141f]/40">
                            <p className="text-xs font-bold text-[#a89b85] uppercase tracking-wider mb-2">📊 Diễn biến bỏ phiếu</p>
                            <div className="space-y-1">
                                {alivePlayers.map(p => {
                                    const voteCount = Object.values(gs.votes || {}).filter(v => v === p.uid).length;
                                    const isSelf = p.uid === myUid;
                                    return (
                                        <div key={p.uid} className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-base">
                                            <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0"><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=20`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[6px]" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                            <span className="flex-1 font-medium text-[#e8dcc8]">{p.name}{isSelf ? ' (bạn)' : ''}</span>
                                            {voteCount > 0 && (
                                                <span className="text-sm font-bold text-[#c62828] bg-[#2a0a0a] px-2 py-0.5 rounded-full">
                                                    {voteCount} phiếu
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                {isHost && totalVoted >= totalAlive && <button onClick={resolveVote} className="w-full py-2.5 ww-btn-primary text-base">⚔️ Công bố kết quả</button>}
                <GameEventLog roomId={room.id} />
                <SeparatedChats roomId={room.id} myUid={myUid} myName={myName} myAvatar={myAvatar} channel={getChatChannel()} visibleChannels={getVisibleChannels()} title="💬 Thảo luận khi bỏ phiếu" maxHeight={250} canSwitchToWolf={isWolf} />
            </>)
        );
    }

    // DAY - DEFENSE (30s for the accused to defend themselves)
    if (phase === 'day-defense') {
        const defensePlayer = playerList.find(p => p.uid === gs.defenseTarget);

        const isDefender = myUid === gs.defenseTarget;
        return (
            renderPhaseLayout(<>

                <div className="text-center mb-4">
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="mb-3">
                        <Shield size={36} className="mx-auto text-[#c9873a] mb-2" />
                        <h3 className="text-xl font-bold text-[#c9873a]">🛡️ Biện hộ</h3>
                        <p className="text-base text-[#6b5f50] mt-1">
                            <span className="font-bold text-[#8b1a1a]">{defensePlayer?.name}</span> nhận {gs.defenseVoteCount} phiếu bầu
                        </p>
                    </motion.div>

                    {/* Countdown timer */}
                    <div className="relative w-20 h-20 mx-auto mb-3">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
                            <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeWidth="4" className="text-[#221f30]" />
                            <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeWidth="4"
                                className={defenseTimeLeft <= 10 ? "text-[#8b1a1a]" : "text-[#c9873a]"}
                                strokeDasharray={`${(defenseTimeLeft / DEFENSE_DURATION) * 188.5} 188.5`}
                                strokeLinecap="round" />
                        </svg>
                        <span className={clsx("absolute inset-0 flex items-center justify-center font-black text-2xl",
                            defenseTimeLeft <= 10 ? "text-[#8b1a1a] animate-pulse" : "text-[#c9873a]")}>
                            {defenseTimeLeft}
                        </span>
                    </div>

                    {isDefender ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-[#1a1510] rounded-xl border-2 border-[#c9873a]/50 mb-3">
                            <p className="text-[#c9873a] font-bold text-base mb-1">🎤 Đây là lúc của bạn!</p>
                            <p className="text-sm text-[#6b5f50]">Hãy thuyết phục mọi người rằng bạn vô tội. Sử dụng chat để biện hộ.</p>
                        </motion.div>
                    ) : (
                        <div className="p-3 bg-[#16141f]/80 rounded-xl border border-[#8b5c3a]/30 mb-3">
                            <p className="text-base text-[#6b5f50]">👂 Lắng nghe <span className="font-bold">{defensePlayer?.name}</span> biện hộ...</p>
                            <p className="text-sm text-[#6b5f50] mt-1">Sau khi biện hộ xong, bạn sẽ có 10 giây để thay đổi phiếu.</p>
                        </div>
                    )}

                    {/* Player list with votes */}
                    <div className="mb-3 text-left">
                        <p className="text-sm font-bold text-[#6b5f50] mb-2">PHIẾU BẦU HIỆN TẠI</p>
                        {alivePlayers.map(p => {
                            const currentVotes = Object.values(gs.preDefenseVotes || {}).filter(v => v === p.uid).length;
                            const isTarget = p.uid === gs.defenseTarget;
                            return (
                                <div key={p.uid} className={clsx("flex items-center gap-2 py-1.5 text-base rounded-lg px-2 mb-0.5",
                                    isTarget && "bg-[#1a0808] border border-[#8b1a1a]/30")}>
                                    <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0"><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=32`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-700 to-amber-900 items-center justify-center text-amber-100 font-bold text-[8px]" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                    <span className={clsx("flex-1 font-medium", isTarget && "text-[#c62828]")}>{p.name}</span>
                                    {isTarget && <Shield size={14} className="text-[#c9873a]" />}
                                    {currentVotes > 0 && (
                                        <span className="text-sm font-bold text-[#c62828] bg-[#2a0a0a] px-2 py-0.5 rounded-full">
                                            {currentVotes} phiếu
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {isHost && (
                        <button onClick={startRevote}
                            className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-bold text-base">
                            ⏩ Kết thúc biện hộ sớm → Bỏ phiếu lại
                        </button>
                    )}
                </div>
                <GameEventLog roomId={room.id} />
                <SeparatedChats roomId={room.id} myUid={myUid} myName={myName} myAvatar={myAvatar} channel={getChatChannel()} visibleChannels={getVisibleChannels()} title="🛡️ Biện hộ" maxHeight={250} canSwitchToWolf={isWolf} />
            </>)
        );
    }

    // DAY - REVOTE (10s for others to change their vote)
    if (phase === 'day-revote') {
        const myVote = gs.votes?.[myUid];
        const skipped = (gs.skipVotes || []).includes(myUid);
        const defensePlayer = playerList.find(p => p.uid === gs.defenseTarget);

        return (
            renderPhaseLayout(<>

                <div className="text-center mb-3">
                    <Clock size={28} className="mx-auto text-orange-500 mb-2" />
                    <h3 className="ww-heading text-xl">🗳️ Thay đổi phiếu bầu</h3>
                    <p className="text-sm text-[#6b5f50] mt-1">
                        <span className="font-bold">{defensePlayer?.name}</span> đã biện hộ xong. Bạn có thể thay đổi phiếu!
                    </p>
                </div>

                {/* Countdown */}
                <div className="flex items-center justify-center gap-2 mb-3">
                    <div className={clsx("text-4xl font-black tabular-nums",
                        revoteTimeLeft <= 5 ? "text-[#8b1a1a] animate-pulse" : "text-orange-500")}>
                        {revoteTimeLeft}s
                    </div>
                    <div className="flex-1 h-2 bg-[#221f30] rounded-full overflow-hidden">
                        <motion.div
                            className={clsx("h-full rounded-full", revoteTimeLeft <= 5 ? "bg-red-500" : "bg-orange-500")}
                            initial={{ width: '100%' }}
                            animate={{ width: `${(revoteTimeLeft / REVOTE_DURATION) * 100}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>

                {myRole?.alive && myUid !== gs.defenseTarget ? (
                    <div className="mb-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 p-3 rounded-xl border border-[#8b5c3a]/30 bg-[#16141f]/60">
                            {alivePlayers.map(p => {
                                const voteCount = Object.values(gs.votes || {}).filter(v => v === p.uid).length;
                                const isTarget = p.uid === gs.defenseTarget;
                                const isSelf = p.uid === myUid;
                                return (
                                    <PlayerCard key={p.uid} p={p} onClick={isSelf ? undefined : () => dayVote(p.uid)} selected={myVote === p.uid} disabled={isSelf}
                                        extra={<span className="text-sm text-[#6b5f50]">
                                            {isTarget && <Shield size={12} className="inline text-[#c9873a] mr-1" />}
                                            {isSelf ? '(bạn)' : ''}{voteCount > 0 ? ` ${voteCount} phiếu` : ''}
                                        </span>} />
                                );
                            })}
                        </div>
                        <button onClick={daySkip} className={clsx("w-full py-3 rounded-xl text-base font-bold transition-all border-2",
                            skipped ? "bg-gradient-to-r from-[#8b5c3a] to-[#c9873a] text-white border-[#c9873a] shadow-lg shadow-[#8b5c3a]/30" : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border-amber-500/60 hover:border-amber-400 shadow-md shadow-amber-500/10 hover:shadow-amber-500/20")}>
                            <ThumbsUp size={16} className="inline mr-1.5" /> Bỏ qua {skipped && '✓'}
                        </button>
                    </div>
                ) : myUid === gs.defenseTarget ? (
                    <div className="p-4 bg-[#1a1510] rounded-xl border border-[#8b5c3a]/30 mb-3 text-center">
                        <p className="text-base text-[#c9873a] font-medium">⏳ Chờ mọi người thay đổi phiếu...</p>
                    </div>
                ) : (
                    <p className="text-base text-[#6b5f50] text-center p-4">💀 Bạn đã bị loại.</p>
                )}

                {isHost && revoteTimeLeft <= 0 && (
                    <button onClick={finalResolveVote} className="w-full py-2.5 ww-btn-primary text-base">
                        ⚔️ Công bố kết quả cuối cùng
                    </button>
                )}
            </>)
        );
    }

    // DAY - RESULT
    if (phase === 'day-result') return (
        renderPhaseLayout(<>
            <h3 className="ww-title text-xl mb-3">⚔️ Kết Quả Phán Xử</h3>
            {gs.voteResult ? (
                <div className="p-4 ww-panel-blood rounded-xl mb-3">
                    <p className="text-[#c62828] font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{playerNames[gs.voteResult]?.name} bị treo cổ!</p>
                    <p className="text-sm text-[#6b5f50] mt-1 italic">Vai trò bị ẩn cho đến khi kết thúc trò chơi</p>
                </div>
            ) : <p className="text-base text-[#6b5f50] mb-3">Không ai bị treo cổ.</p>}
            {isHost ? (
                <button onClick={() => { if (!resolvingRef.current) { resolvingRef.current = true; startNight().finally(() => resolvingRef.current = false); } }} className="px-6 py-2.5 ww-btn-night text-base mx-auto flex items-center gap-2">
                    🌙 Đêm tiếp theo {resultCountdown !== null && <span className="text-[#e8dcc8]/70">({resultCountdown}s)</span>}
                </button>
            ) : (
                <div className="text-center font-bold text-[#8b9dc3] mt-3 animate-pulse">
                    🌙 Đêm tiếp theo bắt đầu sau {resultCountdown !== null ? resultCountdown : 10} giây...
                </div>
            )}
        </>, true, "text-center")
    );

    // GAMEOVER
    if (phase === 'gameover') {
        const gameLog = gs.gameLog || [];
        const getName = (uid: string) => playerNames[uid]?.name || '???';
        const getRole = (uid: string) => gs.roles?.[uid]?.role || '???';
        const getRoleIcon = (uid: string) => gs.roles?.[uid]?.icon || '❓';

        return renderPhaseLayout(<>
            <div className="text-7xl mb-4 ww-flicker">{gs.gameResult?.includes('chán đời') ? '😵' : gs.gameResult?.includes('tẩm dầu') ? '🔥' : gs.gameResult?.includes('dân') ? '🏡' : '🐺'}</div>
            <h3 className="ww-title text-2xl mb-3">{gs.gameResult}</h3>
            <div className="p-3 ww-panel rounded-xl text-left mb-4">
                <h4 className="text-sm font-bold text-[#c9873a] uppercase tracking-wider mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>📋 Danh sách nhân vật</h4>
                {allPlayers.map(p => { const r = gs.roles?.[p.uid]; const showBotLabel = isBot(p.uid) && !isStealthBot(p.uid); return <div key={p.uid} className="flex items-center gap-2 py-1 text-base"><span>{r?.icon}</span><span className={clsx(!r?.alive && "line-through text-[#6b5f50]")}>{p.name}{showBotLabel && <span className="text-[9px] ml-1 text-[#6b8ab5]">(AI)</span>}</span><span className="text-sm text-[#6b5f50]">({r?.role})</span>{!r?.alive && <Skull size={12} className="text-[#c62828]" />}</div>; })}
            </div>
            {gameLog.length > 0 && (<div className="ww-panel rounded-xl text-left mb-4 overflow-hidden">
                <h4 className="text-sm font-bold text-[#c9873a] uppercase tracking-wider p-3 pb-2" style={{ fontFamily: "'Playfair Display', serif" }}>📜 Diễn biến trận đấu</h4>
                <div className="px-3 pb-3 space-y-1">
                    {gameLog.map((ev: any, idx: number) => (<div key={idx} className={clsx("rounded-lg p-2.5 text-sm border", ev.type === 'night' ? "bg-[#0a0a1a]/60 border-[#1a1040]/40" : "bg-[#1a1510]/60 border-[#2a2518]/40")}>
                        <div className="flex items-center gap-1.5 mb-1.5 font-bold text-[13px]">
                            {ev.type === 'night' ? (<><span>🌙</span><span className="text-[#8b7acc]">Đêm {ev.night}</span></>) : (<><span>☀️</span><span className="text-[#c9873a]">Ngày {ev.night}</span></>)}
                        </div>
                        {ev.type === 'night' ? (<div className="space-y-1 text-[12px] text-[#b0a898]">
                            {ev.wolfTarget ? (<div className="flex items-start gap-1.5"><span className="shrink-0">🐺</span><span>Ma Sói tấn công <strong className="text-[#e8dcc8]">{getName(ev.wolfTarget)}</strong>{ev.saved ? <span className="text-emerald-400 ml-1">→ Được {ev.savedBy === 'guard' ? '🛡️ Bảo vệ' : ev.savedBy === 'witch' ? '🧙 Phù thủy' : ''} cứu!</span> : ''}</span></div>) : (<div className="flex items-start gap-1.5"><span className="shrink-0">🐺</span><span className="italic">Ma Sói không tấn công</span></div>)}
                            {ev.seerTarget && (<div className="flex items-start gap-1.5"><span className="shrink-0">🔮</span><span>Tiên tri soi <strong className="text-[#e8dcc8]">{getName(ev.seerTarget)}</strong></span></div>)}
                            {ev.guardTarget && (<div className="flex items-start gap-1.5"><span className="shrink-0">🛡️</span><span>Bảo vệ che chở <strong className="text-[#e8dcc8]">{getName(ev.guardTarget)}</strong></span></div>)}
                            {ev.witchSave && (<div className="flex items-start gap-1.5"><span className="shrink-0">🧪</span><span className="text-emerald-400">Phù thủy dùng bình cứu</span></div>)}
                            {ev.witchKill && (<div className="flex items-start gap-1.5"><span className="shrink-0">☠️</span><span>Phù thủy đầu độc <strong className="text-[#c62828]">{getName(ev.witchKill)}</strong></span></div>)}
                            {ev.arsonistAction === 'oil' && ev.arsonistTarget && (<div className="flex items-start gap-1.5"><span className="shrink-0">🛢️</span><span>Kẻ tẩm dầu tẩm dầu <strong className="text-[#e8dcc8]">{getName(ev.arsonistTarget)}</strong></span></div>)}
                            {ev.arsonistAction === 'ignite' && ev.arsonistBurned?.length > 0 && (<div className="flex items-start gap-1.5"><span className="shrink-0">🔥</span><span className="text-orange-400">Kẻ tẩm dầu châm lửa! Thiêu rụi: {ev.arsonistBurned.map((uid: string) => getName(uid)).join(', ')}</span></div>)}
                            {ev.hunterPinned && (<div className="flex items-start gap-1.5"><span className="shrink-0">🎯</span><span>Thợ săn ghim mục tiêu <strong className="text-[#e8dcc8]">{getName(ev.hunterPinned)}</strong></span></div>)}
                            {ev.hunterTarget && (<div className="flex items-start gap-1.5"><span className="shrink-0">🏹</span><span>Thợ săn tử nạn, kéo theo <strong className="text-[#c62828]">{getName(ev.hunterTarget)}</strong></span></div>)}
                            {ev.killed?.length > 0 ? (<div className="flex items-start gap-1.5 pt-0.5 border-t border-white/5"><span className="shrink-0">💀</span><span className="text-[#c62828]">{ev.killed.map((uid: string) => `${getName(uid)} (${getRoleIcon(uid)} ${getRole(uid)})`).join(', ')} đã chết</span></div>) : (<div className="flex items-start gap-1.5 pt-0.5 border-t border-white/5"><span className="shrink-0">✨</span><span className="text-emerald-400">Không ai chết</span></div>)}
                        </div>) : (<div className="space-y-1 text-[12px] text-[#b0a898]">
                            {ev.votes && Object.keys(ev.votes).length > 0 && (<div className="flex items-start gap-1.5"><span className="shrink-0">🗳️</span><span>{Object.entries(ev.votes as Record<string, string>).map(([voter, target]) => (<span key={voter} className="inline-block mr-2"><span className="text-[#e8dcc8]">{getName(voter)}</span><span className="text-[#6b5f50]"> → </span><span className="text-[#e8dcc8]">{getName(target)}</span></span>))}</span></div>)}
                            {ev.skipVotes?.length > 0 && (<div className="flex items-start gap-1.5"><span className="shrink-0">⏭️</span><span className="text-[#6b5f50]">Bỏ qua: {ev.skipVotes.map((uid: string) => getName(uid)).join(', ')}</span></div>)}
                            {ev.voteResult ? (<div className="flex items-start gap-1.5 pt-0.5 border-t border-white/5"><span className="shrink-0">⚔️</span><span className="text-[#c62828]"><strong>{getName(ev.voteResult)}</strong> ({getRoleIcon(ev.voteResult)} {getRole(ev.voteResult)}) bị treo cổ</span></div>) : (<div className="flex items-start gap-1.5 pt-0.5 border-t border-white/5"><span className="shrink-0">⚖️</span><span className="text-[#6b5f50] italic">Không ai bị treo cổ</span></div>)}
                        </div>)}
                    </div>))}
                </div>
            </div>)}
            {autoResetTimeLeft !== null && (
                <div className="mb-4">
                    <p className="text-sm font-medium text-[#c9873a] animate-pulse">Tự động bắt đầu ván mới sau {autoResetTimeLeft}s...</p>
                </div>
            )}
            {isHost && <button onClick={resetGame} className="px-6 py-3 ww-btn-primary flex items-center gap-2 mx-auto"><RotateCcw size={16} /> Chơi lại ngay ({autoResetTimeLeft}s)</button>}
            {!isHost && <p className="text-sm text-[#6b5f50] mt-2">Đợi chủ phòng bắt đầu ván mới...</p>}
            <GameChat roomId={room.id} myUid={myUid} myName={myName} myAvatar={myAvatar} channel={getChatChannel()} visibleChannels={getVisibleChannels()} canSwitchToWolf={isWolf} />
            {renderStats()}
        </>, false, "text-center");
    }

    // FALLBACK — unknown phase or legacy data: show reset option
    return (
        renderPhaseLayout(<>
            <WolfIcon size={40} className="mx-auto mb-3 text-[#c9873a]" />
            <p className="text-base text-[#6b5f50] mb-3">Phiên chơi không hợp lệ hoặc đã hết hạn.</p>
            {isHost && (
                <button onClick={resetGame} className="px-5 py-2.5 ww-btn-primary text-base">
                    <RotateCcw size={14} className="inline mr-1" /> Bắt đầu lại
                </button>
            )}
            {!isHost && <p className="text-sm text-[#6b5f50]">Đợi chủ phòng khởi động lại game.</p>}
        </>, false, "text-center")
    );
});

// Wrapped export with Error Boundary
const OnlineWerewolfWrapped: React.FC<{ room: GameRoom; myUid: string; myName: string; myAvatar: string }> = (props) => (
    <WerewolfErrorBoundary roomId={props.room.id} isHost={props.myUid === props.room.hostId}>
        <OnlineWerewolf {...props} />
    </WerewolfErrorBoundary>
);

export default OnlineWerewolfWrapped;
export { WOLF_ROLES };

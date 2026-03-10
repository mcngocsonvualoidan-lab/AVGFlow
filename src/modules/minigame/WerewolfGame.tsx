import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Moon, Sun, Skull, Eye, Crown, RotateCcw, Send, ThumbsUp, Loader2, MessageCircle, Users, Shield, Clock, Trophy, BarChart3 } from 'lucide-react';
import { MinigameService, GameRoom, WerewolfState, WerewolfChatMessage, GameHistory } from '../../services/minigameService';
import './werewolf-gothic.css';

const WOLF_ROLES = [
    { role: 'Ma Sói', icon: '🐺', team: 'wolf', desc: 'Kẻ săn mồi trong đêm. Mỗi đêm chọn 1 người để cắn.', cardImage: '/cards/werewolf.png' },
    { role: 'Dân làng', icon: '�️', team: 'village', desc: 'Linh hồn của ngôi làng. Tìm và treo cổ Ma Sói.', cardImage: '/cards/villager.png' },
    { role: 'Tiên tri', icon: '🔮', team: 'village', desc: 'Kẻ thấy rõ bóng tối. Mỗi đêm soi vai trò 1 người.', cardImage: '/cards/seer.png' },
    { role: 'Bảo vệ', icon: '⚔️', team: 'village', desc: 'Hiệp sĩ canh giữ. Mỗi đêm bảo vệ 1 người.', cardImage: '/cards/guard.png' },
    { role: 'Phù thủy', icon: '�', team: 'village', desc: 'Bà phù thủy bí ẩn. Có 1 bình cứu và 1 bình độc.', cardImage: '/cards/witch.png' },
];
const CARD_BACK_IMAGE = '/cards/card_back.png';

// Role gradient map for fallback cards — gothic dark palette
const ROLE_GRADIENTS: Record<string, string> = {
    'Ma Sói': 'from-[#2a0a0a] via-[#4a1010] to-[#1a0505]',
    'Dân làng': 'from-[#1a1510] via-[#2a2518] to-[#0f0d08]',
    'Tiên tri': 'from-[#1a1030] via-[#2a1848] to-[#0f0820]',
    'Bảo vệ': 'from-[#0a1520] via-[#142838] to-[#081018]',
    'Phù thủy': 'from-[#201020] via-[#381838] to-[#100810]',
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
const RoleAssignCard = ({ cardImage, roleName, roleIcon, isBack }: {
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

    // Filter messages by active tab
    const filteredMessages = messages.filter(m =>
        m.channel === 'system' || m.channel === activeChannel
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
                                        <img src={m.senderAvatar || `https://ui-avatars.com/api/?name=${m.senderName}&size=32`} className="w-6 h-6 rounded-full shrink-0 mt-0.5" alt="" />
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

// ==================== SINGLE CHANNEL CHAT BOX ====================
const ChatBox: React.FC<{
    roomId: string; myUid: string; myName: string; myAvatar: string;
    channel: 'day' | 'wolf' | 'dead'; visibleChannels: string[];
    title: string; maxHeight?: number; isWolf?: boolean;
}> = ({ roomId, myUid, myName, myAvatar, channel, title, maxHeight = 250, isWolf = false }) => {
    const [messages, setMessages] = useState<WerewolfChatMessage[]>([]);
    const [text, setText] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        return MinigameService.subscribeToChat(roomId, (msgs) => {
            setMessages(msgs.filter(m => m.channel === channel || m.channel === 'system'));
        });
    }, [roomId, channel]);

    useEffect(() => {
        if (chatEndRef.current) {
            const container = chatEndRef.current.parentElement;
            if (container) container.scrollTop = container.scrollHeight;
        }
    }, [messages]);

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
                                <img src={m.senderAvatar || `https://ui-avatars.com/api/?name=${m.senderName}&size=32`} className="w-6 h-6 rounded-full shrink-0 mt-0.5" alt="" />
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

// ==================== NORMALIZE PHASE ====================
// Backward compat: old phases 'night', 'day' => new phases
const normalizePhase = (phase: string | undefined): string => {
    if (!phase) return 'waiting';
    // Old phases mapping
    if (phase === 'night') return 'night-wolf';
    if (phase === 'day') return 'day-discussion';
    return phase;
};

// ==================== MAIN WEREWOLF COMPONENT ====================
const OnlineWerewolf: React.FC<{ room: GameRoom; myUid: string; myName: string; myAvatar: string }> = ({ room, myUid, myName, myAvatar }) => {
    const gs = (room.gameState || {}) as WerewolfState;
    const phase = normalizePhase(gs.phase);
    const isHost = myUid === room.hostId;
    const playerList = Object.entries(room.players || {}).map(([uid, data]: [string, any]) => ({ uid, name: data.name, avatar: data.avatar }));
    const myRole = gs.roles?.[myUid];
    const isWolf = myRole?.role === 'Ma Sói' && myRole?.alive;
    const [showMyRole, setShowMyRole] = useState(false);
    const resolvingRef = useRef(false);

    const alivePlayers = playerList.filter(p => gs.roles?.[p.uid]?.alive);
    const aliveOthers = alivePlayers.filter(p => p.uid !== myUid);
    const playerNames: Record<string, { name: string; avatar: string }> = {};
    playerList.forEach(p => { playerNames[p.uid] = { name: p.name, avatar: p.avatar }; });

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

    // ---- ROLE ASSIGNMENT ----
    const assignRoles = async () => {
        const uids = playerList.map(p => p.uid);
        const n = uids.length; if (n < 5) return;
        const roles: string[] = [];
        const wolfCount = n <= 6 ? 1 : n <= 9 ? 2 : 3;
        for (let i = 0; i < wolfCount; i++) roles.push('Ma Sói');
        roles.push('Tiên tri', 'Bảo vệ');
        if (n >= 7) roles.push('Phù thủy');
        while (roles.length < n) roles.push('Dân làng');
        for (let i = roles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[roles[i], roles[j]] = [roles[j], roles[i]]; }
        const roleMap: any = {};
        uids.forEach((uid, i) => {
            const r = WOLF_ROLES.find(x => x.role === roles[i])!;
            roleMap[uid] = { role: r.role, icon: r.icon, alive: true };
        });
        await MinigameService.clearChat(room.id);
        await MinigameService.updateGameState(room.id, {
            phase: 'roles-assigned', roles: roleMap, night: 0,
            wolfVotes: {}, seerResults: {}, guardLastTarget: null,
            witchSaveUsed: false, witchKillUsed: false,
            nightActionsComplete: {}, votes: {}, skipVotes: [],
        });
    };

    // ---- START NIGHT ----
    const startNight = async () => {
        const nightNum = (gs.night || 0) + 1;
        await MinigameService.mergeGameState(room.id, {
            phase: 'night-wolf', night: nightNum,
            wolfVotes: {}, wolfTarget: null, seerTarget: null,
            guardTarget: null, witchSaveThisNight: false, witchKillTarget: null,
            nightKilled: null, nightLog: '',
            nightActionsComplete: { wolves: false, seer: false, guard: false, witch: false },
        });
        await MinigameService.sendChat(room.id, {
            sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: `🌙 Đêm ${nightNum} bắt đầu. Mọi người nhắm mắt...`,
            timestamp: Date.now(), channel: 'system',
        });
    };

    // ---- WOLF VOTE ----
    const wolfVote = async (targetUid: string) => {
        const newVotes = { ...(gs.wolfVotes || {}), [myUid]: targetUid };
        await MinigameService.mergeGameState(room.id, { wolfVotes: newVotes });
        // Check if all alive wolves voted
        const aliveWolves = Object.entries(gs.roles || {}).filter(([, r]) => (r as any).role === 'Ma Sói' && (r as any).alive).map(([uid]) => uid);
        const allVoted = aliveWolves.every(w => newVotes[w]);
        if (allVoted) {
            // Find most voted target
            const voteCounts: Record<string, number> = {};
            Object.values(newVotes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
            const maxVotes = Math.max(...Object.values(voteCounts));
            const target = Object.entries(voteCounts).find(([, c]) => c === maxVotes)?.[0] || null;
            await MinigameService.mergeGameState(room.id, {
                wolfTarget: target, 'nightActionsComplete/wolves': true, phase: 'night-seer',
            });
        }
    };

    // ---- SEER CHECK ----
    const seerCheck = async (targetUid: string) => {
        const targetRole = gs.roles?.[targetUid]?.role || '???';
        const newResults = { ...(gs.seerResults || {}), [targetUid]: targetRole };
        await MinigameService.mergeGameState(room.id, {
            seerTarget: targetUid, seerResults: newResults,
            'nightActionsComplete/seer': true, phase: 'night-guard',
        });
    };

    const skipSeer = async () => {
        await MinigameService.mergeGameState(room.id, { 'nightActionsComplete/seer': true, phase: 'night-guard' });
    };

    // ---- GUARD PROTECT ----
    const guardProtect = async (targetUid: string) => {
        await MinigameService.mergeGameState(room.id, {
            guardTarget: targetUid, 'nightActionsComplete/guard': true, phase: 'night-witch',
        });
    };

    const skipGuard = async () => {
        await MinigameService.mergeGameState(room.id, { guardTarget: null, 'nightActionsComplete/guard': true, phase: 'night-witch' });
    };

    // ---- WITCH ACTIONS (reversible until witchDone) ----
    const witchSave = async () => {
        await MinigameService.mergeGameState(room.id, { witchSaveThisNight: true });
    };
    const witchUndoSave = async () => {
        await MinigameService.mergeGameState(room.id, { witchSaveThisNight: false });
    };

    const witchKill = async (targetUid: string) => {
        await MinigameService.mergeGameState(room.id, { witchKillTarget: targetUid });
    };
    const witchUndoKill = async () => {
        await MinigameService.mergeGameState(room.id, { witchKillTarget: null });
    };

    const witchDone = async () => {
        // Permanently mark abilities as used only when witch finalizes
        const updates: Record<string, any> = { 'nightActionsComplete/witch': true, phase: 'night-resolve' };
        if (gs.witchSaveThisNight) updates.witchSaveUsed = true;
        if (gs.witchKillTarget) updates.witchKillUsed = true;
        await MinigameService.mergeGameState(room.id, updates);
    };

    // ---- RESOLVE NIGHT ----
    const resolveNight = async () => {
        const wolfTarget = gs.wolfTarget;
        const guardTarget = gs.guardTarget;
        const witchSaved = gs.witchSaveThisNight;
        const witchKillTarget = gs.witchKillTarget;
        let killed: string | null = null;
        let nightLog = '';

        // Wolf kill (blocked by guard or witch save)
        if (wolfTarget) {
            if (wolfTarget === guardTarget) {
                nightLog += `🛡️ Bảo vệ đã cứu 1 người! `;
            } else if (witchSaved) {
                nightLog += `🧙 Phù thủy đã dùng thuốc cứu! `;
            } else {
                killed = wolfTarget;
            }
        }

        // Witch poison
        if (witchKillTarget && witchKillTarget !== killed) {
            if (killed) {
                // Two people die
                nightLog += `💀 ${playerNames[killed]?.name || '???'} và ${playerNames[witchKillTarget]?.name || '???'} đã chết trong đêm.`;
                const updatedRoles = { ...gs.roles };
                updatedRoles[killed] = { ...updatedRoles[killed], alive: false };
                updatedRoles[witchKillTarget] = { ...updatedRoles[witchKillTarget], alive: false };
                const result = checkGameEnd(updatedRoles);
                await MinigameService.mergeGameState(room.id, {
                    roles: updatedRoles, nightLog, nightKilled: killed,
                    guardLastTarget: guardTarget,
                    phase: result ? 'gameover' : 'day-discussion',
                    ...(result ? { gameResult: result } : {}),
                });
                await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: nightLog, timestamp: Date.now(), channel: 'system' });
                if (result) await saveGameHistory(result, updatedRoles);
                return;
            } else {
                killed = witchKillTarget;
                nightLog += `🧙 Phù thủy đã dùng thuốc độc! `;
            }
        }

        if (killed) {
            nightLog += `💀 ${playerNames[killed]?.name || '???'} đã chết trong đêm.`;
            const updatedRoles = { ...gs.roles };
            updatedRoles[killed] = { ...updatedRoles[killed], alive: false };
            const result = checkGameEnd(updatedRoles);
            await MinigameService.mergeGameState(room.id, {
                roles: updatedRoles, nightLog, nightKilled: killed,
                guardLastTarget: guardTarget,
                phase: result ? 'gameover' : 'day-discussion',
                ...(result ? { gameResult: result } : {}),
            });
            if (result) await saveGameHistory(result, updatedRoles);
        } else {
            nightLog += '☀️ Đêm bình yên, không ai bị hại.';
            await MinigameService.mergeGameState(room.id, {
                nightLog, nightKilled: null, guardLastTarget: guardTarget,
                phase: 'day-discussion',
            });
        }
        await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: nightLog, timestamp: Date.now(), channel: 'system' });
    };

    // ---- DAY VOTE ----
    const dayVote = async (targetUid: string) => {
        const newVotes = { ...(gs.votes || {}), [myUid]: targetUid };
        const newSkip = (gs.skipVotes || []).filter(u => u !== myUid);
        await MinigameService.mergeGameState(room.id, { votes: newVotes, skipVotes: newSkip });
    };

    const daySkip = async () => {
        const newSkip = [...(gs.skipVotes || []).filter(u => u !== myUid), myUid];
        const newVotes = { ...(gs.votes || {}) };
        delete newVotes[myUid];
        await MinigameService.mergeGameState(room.id, { votes: newVotes, skipVotes: newSkip });
    };

    const resolveVote = async () => {
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
            // Enter defense phase — the most voted player gets 60s to defend themselves
            const defenseTarget = topTargets[0][0];
            const dName = playerNames[defenseTarget]?.name || '???';
            const msg = `⚠️ ${dName} nhận nhiều phiếu nhất (${maxVotes} phiếu). Hãy biện hộ trong 60 giây!`;
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
    };

    // After defense, start revote period (10s)
    const startRevote = async () => {
        const dName = playerNames[gs.defenseTarget || '']?.name || '???';
        const msg = `🗳️ ${dName} đã biện hộ xong. Bạn có 10 giây để thay đổi quyết định!`;
        await MinigameService.mergeGameState(room.id, {
            phase: 'day-revote',
            revoteStartedAt: Date.now(),
        });
        await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: msg, timestamp: Date.now(), channel: 'system' });
    };

    // Final vote resolution after revote period
    const finalResolveVote = async () => {
        const votes = gs.votes || {};
        const skipCount = (gs.skipVotes || []).length;
        const voteCounts: Record<string, number> = {};
        Object.values(votes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
        const maxVotes = Math.max(0, ...Object.values(voteCounts));
        const topTargets = Object.entries(voteCounts).filter(([, c]) => c === maxVotes);
        let msg = '';

        if (maxVotes === 0 || skipCount > maxVotes || topTargets.length > 1) {
            msg = '⚖️ Sau khi thay đổi phiếu, không đủ phiếu hoặc hòa — không ai bị treo cổ.';
            await MinigameService.mergeGameState(room.id, { voteResult: null, phase: 'day-result', defenseTarget: null, defenseVoteCount: null, defenseStartedAt: null, revoteStartedAt: null, preDefenseVotes: null, preDefenseSkipVotes: null });
        } else {
            const eliminated = topTargets[0][0];
            const updatedRoles = { ...gs.roles };
            updatedRoles[eliminated] = { ...updatedRoles[eliminated], alive: false };
            const eName = playerNames[eliminated]?.name || '???';
            msg = `⚔️ ${eName} bị treo cổ!`;
            const result = checkGameEnd(updatedRoles);
            await MinigameService.mergeGameState(room.id, {
                roles: updatedRoles, voteResult: eliminated,
                phase: result ? 'gameover' : 'day-result',
                ...(result ? { gameResult: result } : {}),
                defenseTarget: null, defenseVoteCount: null, defenseStartedAt: null, revoteStartedAt: null, preDefenseVotes: null, preDefenseSkipVotes: null,
            });
            if (result) await saveGameHistory(result, updatedRoles);
        }
        await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: msg, timestamp: Date.now(), channel: 'system' });
    };

    const checkGameEnd = (roles: any): string | null => {
        const aliveWolves = Object.values(roles).filter((r: any) => r.role === 'Ma Sói' && r.alive).length;
        const aliveVillagers = Object.values(roles).filter((r: any) => r.role !== 'Ma Sói' && r.alive).length;
        if (aliveWolves === 0) return '🎉 Phe dân thắng!';
        if (aliveWolves >= aliveVillagers) return '🐺 Ma Sói thắng!';
        return null;
    };
    // ---- SAVE GAME HISTORY ----
    const saveGameHistory = async (result: string, finalRoles: any) => {
        try {
            const winnerTeam = result.includes('dân') ? 'village' : 'wolf';
            const now = Date.now();
            const startedAt = room.createdAt || now;
            const duration = Math.round((now - startedAt) / 1000);
            const players: Record<string, { name: string; avatar: string; role: string; alive: boolean; won: boolean; score: number }> = {};
            playerList.forEach(p => {
                const r = finalRoles[p.uid];
                if (r) {
                    const team = r.role === 'Ma Sói' ? 'wolf' : 'village';
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
        await MinigameService.mergeGameState(room.id, { phase: 'day-vote', votes: {}, skipVotes: [] });
        await MinigameService.sendChat(room.id, { sender: 'system', senderName: 'Hệ thống', senderAvatar: '', text: '🗳️ Bỏ phiếu bắt đầu! Chọn người nghi ngờ hoặc bỏ qua.', timestamp: Date.now(), channel: 'system' });
    };

    const resetGame = async () => {
        await MinigameService.clearChat(room.id);
        await MinigameService.updateGameState(room.id, { phase: 'waiting' });
    };

    // ---- HELPER: Player Card ----
    const PlayerCard: React.FC<{ p: typeof playerList[0]; onClick?: () => void; selected?: boolean; disabled?: boolean; extra?: React.ReactNode }> = ({ p, onClick, selected, disabled, extra }) => {
        const r = gs.roles?.[p.uid];
        return (
            <button onClick={onClick} disabled={disabled || !onClick}
                className={clsx("w-full flex items-center gap-2 p-2 rounded-xl text-left text-base transition-all",
                    selected ? "bg-[#2a0a0a] ring-2 ring-[#8b1a1a]" : "hover:bg-[#221f30] border border-transparent hover:border-[#8b5c3a]/20",
                    disabled && "opacity-40 cursor-not-allowed",
                    !r?.alive && "opacity-30 line-through")}>
                <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=32`} className="w-7 h-7 rounded-full" alt="" />
                <span className="font-medium flex-1 text-[#e8dcc8]">{p.name}</span>
                {!r?.alive && <Skull size={14} className="text-[#c62828]" />}
                {p.uid === room.hostId && <Crown size={12} className="text-[#c9873a]" />}
                {extra}
            </button>
        );
    };

    // ---- HELPER: Left Column (role card + info) ----
    const [roleCardFlipped, setRoleCardFlipped] = useState(false);

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




                {/* Player status (desktop only) — always visible */}
                <div className="hidden md:block ww-glass rounded-xl p-3 w-full">
                    <p className="text-sm font-bold mb-2 ww-glow-gold" style={{ fontFamily: "'Playfair Display', serif", color: '#c9873a' }}>
                        <Users size={14} className="inline mr-1" /> Ngôi Làng ({alivePlayers.length}/{playerList.length})
                    </p>
                    <div className="space-y-1">
                        {playerList.map(p => {
                            const r = gs.roles?.[p.uid];
                            return (
                                <div key={p.uid} className={clsx("flex items-center gap-2 py-1 px-2 rounded-lg text-sm", !r?.alive && "opacity-40")}>
                                    <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=24`} className="w-5 h-5 rounded-full" alt="" />
                                    <span className={clsx("flex-1", !r?.alive && "line-through")} style={{ color: '#e8dcc8' }}>{p.name}</span>
                                    {!r?.alive && <Skull size={12} style={{ color: '#c62828' }} />}
                                    {r?.alive && <span className="w-2 h-2 rounded-full bg-emerald-500 ww-pulse-glow" />}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        );
    };

    // ---- GAME PHASE LAYOUT: Two-column on PC ----
    const GamePhaseLayout: React.FC<{ children: React.ReactNode; showCard?: boolean; className?: string }> = ({ children, showCard = true, className }) => {
        const hasLeftColumn = showCard && myRole && phase !== 'waiting' && phase !== 'gameover';
        return (
            <div className={clsx("werewolf-gothic ww-texture max-w-5xl mx-auto p-4 rounded-2xl", className)}>
                {hasLeftColumn ? (
                    <div className="ww-game-layout">
                        {renderLeftColumn()}
                        <div className="ww-content-column">{children}</div>
                    </div>
                ) : (
                    <>{children}</>
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
                            <img src={s.avatar || `https://ui-avatars.com/api/?name=${s.name}&size=32`} className="w-8 h-8 rounded-full" alt="" />
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
                                    <img src={s.avatar || `https://ui-avatars.com/api/?name=${s.name}&size=24`} className="w-6 h-6 rounded-full" alt="" />
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

    // ============ RENDER PHASES ============

    // WAITING
    if (phase === 'waiting') return (
        <GamePhaseLayout showCard={false} className="text-center">
            <div className="ww-flicker mb-4">
                <Moon size={48} className="text-[#c9873a] mx-auto" />
            </div>
            <h3 className="ww-title text-3xl mb-1">Ma Sói</h3>
            <p className="ww-body text-base mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>— Phòng Chờ —</p>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
                {playerList.map(p => <span key={p.uid} className="px-3 py-1.5 ww-panel rounded-lg text-base font-medium flex items-center gap-2">
                    <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=32`} className="w-5 h-5 rounded-full border border-[#8b5c3a]/30" alt="" />{p.name}
                    {p.uid === room.hostId && <Crown size={12} className="text-[#c9873a]" />}
                </span>)}
            </div>
            <p className="text-sm text-[#6b5f50] mb-4">{playerList.length} linh hồn đã tập trung {playerList.length < 5 ? '(cần tối thiểu 5)' : '✓'}</p>
            {isHost && playerList.length >= 5 && <button onClick={assignRoles} className="px-8 py-3 ww-btn-primary text-xl shadow-lg">🐺 Chia Vai & Bắt Đầu</button>}
            {!isHost && <p className="text-sm text-[#6b5f50] italic">Chờ trưởng làng bắt đầu...</p>}
        </GamePhaseLayout>
    );

    // ---- HELPER: get wolf teammates ----
    const getWolfTeammates = () => {
        if (myRole?.role !== 'Ma Sói') return [];
        return Object.entries(gs.roles || {})
            .filter(([uid, r]: [string, any]) => r.role === 'Ma Sói' && uid !== myUid)
            .map(([uid]) => ({ uid, ...playerNames[uid] }));
    };

    // ROLES ASSIGNED
    if (phase === 'roles-assigned') {
        const wolfTeammates = getWolfTeammates();
        return (
            <GamePhaseLayout className="text-center">
                <h3 className="ww-title text-xl mb-4">🃏 Số Phận Đã Được Quyết Định</h3>
                {myRole && (() => {
                    const roleInfo = WOLF_ROLES.find(r => r.role === myRole.role);
                    return (
                        <div className="ww-panel rounded-2xl p-6 mb-4">
                            {showMyRole ? (
                                <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} className="flex flex-col items-center">
                                    <RoleAssignCard cardImage={roleInfo?.cardImage} roleName={myRole.role} roleIcon={myRole.icon} />
                                    <p className="font-bold text-[#c9873a] text-xl">{myRole.icon} {myRole.role}</p>
                                    <p className="text-sm text-[#6b5f50] mt-1 italic">{getRoleDesc(myRole.role)}</p>
                                    <p className="text-sm text-[#6b5f50] mt-2">Giữ bí mật vai trò của bạn!</p>
                                    {/* Wolf teammate recognition */}
                                    {myRole.role === 'Ma Sói' && wolfTeammates.length > 0 && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                                            className="mt-4 p-3 ww-panel-blood rounded-xl w-full">
                                            <p className="text-sm font-bold text-[#c62828] mb-2 flex items-center justify-center gap-1">
                                                <Users size={12} /> 🐺 Đồng đội Ma Sói của bạn:
                                            </p>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {wolfTeammates.map(w => (
                                                    <span key={w.uid} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#2a0a0a] rounded-lg text-sm font-medium text-[#c9873a]">
                                                        <img src={w.avatar || `https://ui-avatars.com/api/?name=${w.name}&size=24`} className="w-5 h-5 rounded-full" alt="" />
                                                        {w.name} 🐺
                                                    </span>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <RoleAssignCard isBack />
                                    <button onClick={() => setShowMyRole(true)} className="px-6 py-3 ww-btn-primary shadow-md"><Eye size={18} className="inline mr-2" /> Lật bài xem vai trò</button>
                                </div>
                            )}
                        </div>
                    );
                })()}
                {isHost && <button onClick={startNight} className="px-6 py-3 ww-btn-night">🌙 Bắt đầu Đêm 1</button>}
                <GameEventLog roomId={room.id} />
                <SeparatedChats roomId={room.id} myUid={myUid} myName={myName} myAvatar={myAvatar} channel={getChatChannel()} visibleChannels={getVisibleChannels()} title="💬 Chat trước khi vào đêm" canSwitchToWolf={isWolf} />
            </GamePhaseLayout>
        );
    }

    // NIGHT - WOLVES
    if (phase === 'night-wolf') {
        const isWolf = myRole?.role === 'Ma Sói' && myRole.alive;
        const myVote = gs.wolfVotes?.[myUid];
        const wolfTeammates = getWolfTeammates();
        return (
            <GamePhaseLayout>

                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <Moon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
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
                                            <img src={w.avatar || `https://ui-avatars.com/api/?name=${w.name}&size=20`} className="w-4 h-4 rounded-full" alt="" />
                                            {w.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="text-base font-bold text-[#8b1a1a] mb-2">🐺 Chọn nạn nhân:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-3">
                            {aliveOthers.filter(p => gs.roles?.[p.uid]?.role !== 'Ma Sói').map(p => (
                                <PlayerCard key={p.uid} p={p} onClick={() => wolfVote(p.uid)} selected={myVote === p.uid}
                                    extra={myVote === p.uid ? <span className="text-sm text-[#8b1a1a] font-bold">🎯</span> : undefined} />
                            ))}
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
            </GamePhaseLayout>
        );
    }

    // NIGHT - SEER
    if (phase === 'night-seer') {
        const isSeer = myRole?.role === 'Tiên tri' && myRole.alive;
        const hasSeerAlive = Object.entries(gs.roles || {}).some(([, r]) => (r as any).role === 'Tiên tri' && (r as any).alive);
        return (
            <GamePhaseLayout>

                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <Moon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
                    <h3 className="ww-heading text-2xl">Đêm {gs.night}</h3>
                    <p className="text-[#c9a3e8] text-base mt-1">🔮 Tiên tri thức dậy...</p>
                </div>
                {isSeer ? (
                    <div>
                        <p className="text-base font-bold text-[#9b6bc4] mb-2">🔮 Chọn người muốn soi:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-3">
                            {aliveOthers.map(p => {
                                const known = gs.seerResults?.[p.uid];
                                return (
                                    <PlayerCard key={p.uid} p={p} onClick={() => seerCheck(p.uid)} disabled={!!known}
                                        extra={known ? <span className="text-sm text-[#c9873a] font-bold">{gs.roles?.[p.uid]?.icon} {known}</span> : undefined} />
                                );
                            })}
                        </div>
                        <button onClick={skipSeer} className="w-full py-2 text-base text-[#6b5f50] hover:text-slate-600">Bỏ qua</button>
                    </div>
                ) : isHost && !hasSeerAlive ? (
                    <div className="text-center"><p className="text-base text-[#6b5f50] mb-2">Tiên tri đã chết.</p>
                        <button onClick={skipSeer} className="px-4 py-2 bg-purple-500 text-white rounded-xl font-bold text-base">Tiếp tục →</button></div>
                ) : (
                    <p className="text-base text-[#6b5f50] text-center p-4">{myRole?.alive ? `${myRole?.icon} Chờ Tiên tri hành động...` : '💀 Quan sát...'}</p>
                )}
            </GamePhaseLayout>
        );
    }

    // NIGHT - GUARD
    if (phase === 'night-guard') {
        const isGuard = myRole?.role === 'Bảo vệ' && myRole.alive;
        const hasGuardAlive = Object.entries(gs.roles || {}).some(([, r]) => (r as any).role === 'Bảo vệ' && (r as any).alive);
        return (
            <GamePhaseLayout>

                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <Moon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
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
                ) : isHost && !hasGuardAlive ? (
                    <div className="text-center"><p className="text-base text-[#6b5f50] mb-2">Bảo vệ đã chết.</p>
                        <button onClick={skipGuard} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-base">Tiếp tục →</button></div>
                ) : (
                    <p className="text-base text-[#6b5f50] text-center p-4">{myRole?.alive ? `${myRole?.icon} Chờ Bảo vệ hành động...` : '💀 Quan sát...'}</p>
                )}
            </GamePhaseLayout>
        );
    }

    // NIGHT - WITCH
    if (phase === 'night-witch') {
        const isWitch = myRole?.role === 'Phù thủy' && myRole.alive;
        const hasWitchAlive = Object.entries(gs.roles || {}).some(([, r]) => (r as any).role === 'Phù thủy' && (r as any).alive);
        const wolfTarget = gs.wolfTarget;
        const targetName = wolfTarget ? playerNames[wolfTarget]?.name || '???' : null;
        // Witch can only use ONE ability per night: save OR kill, not both
        const usedAbilityThisNight = gs.witchSaveThisNight || !!gs.witchKillTarget;
        const canSave = !gs.witchSaveUsed && wolfTarget && wolfTarget !== gs.guardTarget && !gs.witchKillTarget;
        const canKill = !gs.witchKillUsed && !gs.witchSaveThisNight;
        return (
            <GamePhaseLayout>

                <div className="ww-panel rounded-2xl p-6 mb-3 text-center">
                    <Moon size={36} className="mx-auto mb-2 text-[#e8d5a3] ww-moon-glow" />
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
                ) : isHost && !hasWitchAlive ? (
                    <div className="text-center"><p className="text-base text-[#6b5f50] mb-2">Phù thủy đã chết.</p>
                        <button onClick={witchDone} className="px-4 py-2 bg-cyan-500 text-white rounded-xl font-bold text-base">Tiếp tục →</button></div>
                ) : (
                    <p className="text-base text-[#6b5f50] text-center p-4">{myRole?.alive ? `${myRole?.icon} Chờ Phù thủy hành động...` : '💀 Quan sát...'}</p>
                )}
            </GamePhaseLayout>
        );
    }

    // NIGHT - RESOLVE — use useEffect to prevent duplicate calls on re-render
    useEffect(() => {
        if (phase === 'night-resolve' && isHost && !resolvingRef.current) {
            resolvingRef.current = true;
            resolveNight().finally(() => { resolvingRef.current = false; });
        }
    }, [phase, isHost]);

    if (phase === 'night-resolve') {
        return <GamePhaseLayout showCard={false} className="text-center"><Loader2 size={24} className="animate-spin mx-auto text-[#c9873a]" /><p className="text-base text-[#6b5f50] mt-2">Đang tổng hợp kết quả đêm...</p></GamePhaseLayout>;
    }

    // DAY - DISCUSSION
    if (phase === 'day-discussion') return (
        <GamePhaseLayout>

            <div className="text-center mb-4">
                <Sun size={32} className="mx-auto mb-2 text-[#c9873a]" />
                <h3 className="ww-heading text-xl">☀️ Ban ngày — Đêm {gs.night}</h3>
                {gs.nightLog && <p className="text-base mt-2 p-3 ww-panel-parchment rounded-xl">{gs.nightLog}</p>}
            </div>
            <div className="mb-3">
                <p className="text-sm font-bold text-[#6b5f50] mb-2">NGƯỜI CHƠI CÒN SỐNG ({alivePlayers.length})</p>
                {playerList.map(p => {
                    const r = gs.roles?.[p.uid];
                    return (
                        <div key={p.uid} className={clsx("flex items-center gap-2 py-1.5 text-base", !r?.alive && "opacity-30 line-through")}>
                            <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=32`} className="w-6 h-6 rounded-full" alt="" />
                            {r?.alive ? '👤' : '💀'} {p.name}
                        </div>
                    );
                })}
            </div>
            <p className="text-sm text-[#c9873a] font-medium text-center mb-3 animate-pulse">💬 Hãy thảo luận và đưa ra ý kiến trước khi bỏ phiếu!</p>
            {isHost && <button onClick={startDayVote} className="w-full py-2.5 ww-btn-primary text-base mb-2">🗳️ Bắt đầu Bỏ phiếu</button>}
            <GameEventLog roomId={room.id} />
            <SeparatedChats roomId={room.id} myUid={myUid} myName={myName} myAvatar={myAvatar} channel={getChatChannel()} visibleChannels={getVisibleChannels()} title="💬 Thảo luận ban ngày" maxHeight={300} canSwitchToWolf={isWolf} />
        </GamePhaseLayout>
    );

    // DAY - VOTE
    if (phase === 'day-vote') {
        const myVote = gs.votes?.[myUid];
        const skipped = (gs.skipVotes || []).includes(myUid);
        const totalAlive = alivePlayers.length;
        const totalVoted = Object.keys(gs.votes || {}).length + (gs.skipVotes || []).length;
        return (
            <GamePhaseLayout>

                <div className="text-center mb-3">
                    <h3 className="ww-heading text-xl">🗳️ Bỏ phiếu — Đêm {gs.night}</h3>
                    <p className="text-sm text-[#6b5f50]">{totalVoted}/{totalAlive} đã vote</p>
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
                                    <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=20`}
                                        className={clsx('w-4 h-4 rounded-full', isDone ? 'ring-1 ring-emerald-400' : 'ring-1 ring-amber-300')} alt="" />
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
                            {aliveOthers.map(p => {
                                const voteCount = Object.values(gs.votes || {}).filter(v => v === p.uid).length;
                                return (
                                    <PlayerCard key={p.uid} p={p} onClick={() => dayVote(p.uid)} selected={myVote === p.uid}
                                        extra={<span className="text-sm text-[#6b5f50]">{voteCount > 0 && `${voteCount} phiếu`}</span>} />
                                );
                            })}
                        </div>
                        <button onClick={daySkip} className={clsx("w-full py-3 rounded-xl text-base font-bold transition-all border-2",
                            skipped ? "bg-gradient-to-r from-[#8b5c3a] to-[#c9873a] text-white border-[#c9873a] shadow-lg shadow-[#8b5c3a]/30" : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border-amber-500/60 hover:border-amber-400 shadow-md shadow-amber-500/10 hover:shadow-amber-500/20")}>
                            <ThumbsUp size={16} className="inline mr-1.5" /> Bỏ qua {skipped && '✓'}
                        </button>
                    </div>
                ) : <p className="text-base text-[#6b5f50] text-center p-4">💀 Bạn đã bị loại.</p>}
                {isHost && totalVoted >= totalAlive && <button onClick={resolveVote} className="w-full py-2.5 ww-btn-primary text-base">⚔️ Công bố kết quả</button>}
                <GameEventLog roomId={room.id} />
                <SeparatedChats roomId={room.id} myUid={myUid} myName={myName} myAvatar={myAvatar} channel={getChatChannel()} visibleChannels={getVisibleChannels()} title="💬 Thảo luận khi bỏ phiếu" maxHeight={250} canSwitchToWolf={isWolf} />
            </GamePhaseLayout>
        );
    }

    // DAY - DEFENSE (60s for the accused to defend themselves)
    if (phase === 'day-defense') {
        const defensePlayer = playerList.find(p => p.uid === gs.defenseTarget);
        const defenseStarted = gs.defenseStartedAt || Date.now();
        const DEFENSE_DURATION = 60; // seconds
        const [defenseTimeLeft, setDefenseTimeLeft] = useState(DEFENSE_DURATION);

        useEffect(() => {
            const interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - defenseStarted) / 1000);
                const remaining = Math.max(0, DEFENSE_DURATION - elapsed);
                setDefenseTimeLeft(remaining);
                if (remaining <= 0 && isHost) {
                    clearInterval(interval);
                    startRevote();
                }
            }, 1000);
            return () => clearInterval(interval);
        }, [defenseStarted, isHost]);

        const isDefender = myUid === gs.defenseTarget;
        return (
            <GamePhaseLayout>

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
                                    <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=32`} className="w-6 h-6 rounded-full" alt="" />
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
            </GamePhaseLayout>
        );
    }

    // DAY - REVOTE (10s for others to change their vote)
    if (phase === 'day-revote') {
        const revoteStarted = gs.revoteStartedAt || Date.now();
        const REVOTE_DURATION = 10; // seconds
        const [revoteTimeLeft, setRevoteTimeLeft] = useState(REVOTE_DURATION);
        const myVote = gs.votes?.[myUid];
        const skipped = (gs.skipVotes || []).includes(myUid);
        const defensePlayer = playerList.find(p => p.uid === gs.defenseTarget);

        useEffect(() => {
            const interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - revoteStarted) / 1000);
                const remaining = Math.max(0, REVOTE_DURATION - elapsed);
                setRevoteTimeLeft(remaining);
                if (remaining <= 0 && isHost) {
                    clearInterval(interval);
                    finalResolveVote();
                }
            }, 1000);
            return () => clearInterval(interval);
        }, [revoteStarted, isHost]);

        return (
            <GamePhaseLayout>

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
                            {aliveOthers.map(p => {
                                const voteCount = Object.values(gs.votes || {}).filter(v => v === p.uid).length;
                                const isTarget = p.uid === gs.defenseTarget;
                                return (
                                    <PlayerCard key={p.uid} p={p} onClick={() => dayVote(p.uid)} selected={myVote === p.uid}
                                        extra={<span className="text-sm text-[#6b5f50]">
                                            {isTarget && <Shield size={12} className="inline text-[#c9873a] mr-1" />}
                                            {voteCount > 0 && `${voteCount} phiếu`}
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
            </GamePhaseLayout>
        );
    }

    // DAY - RESULT
    if (phase === 'day-result') return (
        <GamePhaseLayout className="text-center">

            <h3 className="ww-title text-xl mb-3">⚔️ Kết Quả Phán Xử</h3>
            {gs.voteResult ? (
                <div className="p-4 ww-panel-blood rounded-xl mb-3">
                    <p className="text-[#c62828] font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{playerNames[gs.voteResult]?.name} bị treo cổ!</p>
                    <p className="text-sm text-[#6b5f50] mt-1 italic">Vai trò bị ẩn cho đến khi kết thúc trò chơi</p>
                </div>
            ) : <p className="text-base text-[#6b5f50] mb-3">Không ai bị treo cổ.</p>}
            {isHost && <button onClick={startNight} className="px-6 py-2.5 ww-btn-night text-base">🌙 Đêm tiếp theo</button>}
        </GamePhaseLayout>
    );

    // GAMEOVER
    if (phase === 'gameover') return (
        <GamePhaseLayout showCard={false} className="text-center">
            <div className="text-7xl mb-4 ww-flicker">{gs.gameResult?.includes('dân') ? '�' : '🐺'}</div>
            <h3 className="ww-title text-2xl mb-3">{gs.gameResult}</h3>
            <div className="p-3 ww-panel rounded-xl text-left mb-4">
                {playerList.map(p => { const r = gs.roles?.[p.uid]; return <div key={p.uid} className="flex items-center gap-2 py-1 text-base"><span>{r?.icon}</span><span className={clsx(!r?.alive && "line-through text-[#6b5f50]")}>{p.name}</span><span className="text-sm text-[#6b5f50]">({r?.role})</span>{!r?.alive && <Skull size={12} className="text-[#c62828]" />}</div>; })}
            </div>
            {isHost && <button onClick={resetGame} className="px-6 py-3 ww-btn-primary flex items-center gap-2 mx-auto"><RotateCcw size={16} /> Chơi lại</button>}
            {!isHost && <p className="text-sm text-[#6b5f50] mt-2">Đợi chủ phòng bắt đầu ván mới...</p>}
            <GameChat roomId={room.id} myUid={myUid} myName={myName} myAvatar={myAvatar} channel={getChatChannel()} visibleChannels={getVisibleChannels()} canSwitchToWolf={isWolf} />
            {renderStats()}
        </GamePhaseLayout>
    );

    // FALLBACK — unknown phase or legacy data: show reset option
    return (
        <GamePhaseLayout showCard={false} className="text-center">
            <Moon size={40} className="mx-auto mb-3 text-[#c9873a]" />
            <p className="text-base text-[#6b5f50] mb-3">Phiên chơi không hợp lệ hoặc đã hết hạn.</p>
            {isHost && (
                <button onClick={resetGame} className="px-5 py-2.5 ww-btn-primary text-base">
                    <RotateCcw size={14} className="inline mr-1" /> Bắt đầu lại
                </button>
            )}
            {!isHost && <p className="text-sm text-[#6b5f50]">Đợi chủ phòng khởi động lại game.</p>}
        </GamePhaseLayout>
    );
};

export default OnlineWerewolf;
export { WOLF_ROLES };


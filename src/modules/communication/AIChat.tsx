import React, { useState, useEffect, useRef } from 'react';
import {
    Send, Plus, MessageSquare, Key, Bot, User as UserIcon,
    Trash2, Sparkles, AlertTriangle, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { streamGeminiResponse, saveGeminiKey, getGeminiKey, initializeGemini } from '../../lib/gemini';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { clsx } from 'clsx';

// --- TYPES ---
interface ChatSession {
    id: string;
    userId: string;
    title: string;
    updatedAt: any;
}

interface Message {
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

const AIChat: React.FC = () => {
    const { currentUser } = useAuth();
    const { users } = useData();
    const appUser = users.find(u => u.email === currentUser?.email);
    const isAdmin = appUser?.isAdmin || ['mcngocsonvualoidan@gmail.com', 'ccmartech.com@gmail.com'].includes(currentUser?.email || '');

    // State
    const [apiKey, setApiKey] = useState('');
    const [hasKey, setHasKey] = useState<boolean | null>(null); // null = loading
    const [chats, setChats] = useState<ChatSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamBuffer, setStreamBuffer] = useState(''); // For live typing effect

    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. Check API Key
    useEffect(() => {
        checkKey();
    }, []);

    const checkKey = async () => {
        const key = await getGeminiKey();
        setHasKey(!!key);
    };

    const handleSaveKey = async () => {
        if (!apiKey.trim()) return;
        await saveGeminiKey(apiKey);
        setHasKey(true);
        alert("API Key Saved!");
    };

    // 2. Load Chat Sessions
    useEffect(() => {
        if (!currentUser) return;
        const q = query(
            collection(db, 'ai_conversations'),
            where('userId', '==', currentUser.uid),
            orderBy('updatedAt', 'desc')
        );
        const unsub = onSnapshot(q, (snapshot) => {
            setChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession)));
        });
        return () => unsub();
    }, [currentUser]);

    // 3. Load Messages for Active Chat
    useEffect(() => {
        if (!activeChatId) {
            setMessages([]);
            return;
        }
        const unsub = onSnapshot(doc(db, 'ai_conversations', activeChatId), (d) => {
            if (d.exists()) {
                const data = d.data();
                setMessages(data.messages || []);
            }
        });
        return () => unsub();
    }, [activeChatId]);

    // Auto Scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, streamBuffer]);

    // Handlers
    const startNewChat = () => {
        setActiveChatId(null);
        setMessages([]);
        setInput('');
    };

    const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Delete this chat?")) {
            await deleteDoc(doc(db, 'ai_conversations', id));
            if (activeChatId === id) setActiveChatId(null);
        }
    };

    // --- UI HELPERS ---
    // Calculate chat container height to fit within the main layout without double scrollbars
    // Layout typically has top padding + header (64px). 

    // Auto-Title Logic
    const generateSmartTitle = async (chatId: string, firstMessage: string) => {
        try {
            const model = await initializeGemini();
            if (model) {
                const result = await model.generateContent(`Hãy trả về một tiêu đề ngắn gọn (tối đa 6 từ, tiếng Việt) tóm tắt câu này: "${firstMessage}". Không dùng dấu câu.`);
                const aiTitle = result.response.text().trim();
                if (aiTitle) {
                    await updateDoc(doc(db, 'ai_conversations', chatId), { title: aiTitle });
                    return;
                }
            }
        } catch (e) {
            console.error("Auto-title error", e);
        }

        // Fallback
        const fallbackTitle = firstMessage.split(' ').slice(0, 5).join(' ') + '...';
        await updateDoc(doc(db, 'ai_conversations', chatId), { title: fallbackTitle });
    };

    const handleSend = async () => {
        if (!input.trim() || !hasKey || isStreaming) return;

        const currentInput = input;
        setInput('');

        let targetId = activeChatId;
        let isFirstMessage = false;

        if (!targetId) {
            if (!currentUser) return;
            isFirstMessage = true;

            const docRef = await addDoc(collection(db, 'ai_conversations'), {
                userId: currentUser.uid,
                title: 'Cuộc trò chuyện mới',
                messages: [],
                updatedAt: serverTimestamp()
            });
            targetId = docRef.id;
            setActiveChatId(targetId);
        }

        const newMessage: Message = { role: 'user', text: currentInput, timestamp: Date.now() };
        const updatedMessages = [...messages, newMessage];
        setMessages(updatedMessages);

        await updateDoc(doc(db, 'ai_conversations', targetId!), {
            messages: updatedMessages,
            updatedAt: serverTimestamp()
        });

        if (isFirstMessage) {
            generateSmartTitle(targetId!, currentInput);
        }

        setIsStreaming(true);
        setStreamBuffer('');

        try {
            const apiHistory = updatedMessages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            let fullResponse = "";
            await streamGeminiResponse(currentInput, apiHistory, (token) => {
                fullResponse += token;
                setStreamBuffer(prev => prev + token);
            });

            const aiMsg: Message = { role: 'model', text: fullResponse, timestamp: Date.now() };
            await updateDoc(doc(db, 'ai_conversations', targetId!), {
                messages: [...updatedMessages, aiMsg],
                updatedAt: serverTimestamp()
            });

        } catch (error: any) {
            console.error("Chat Error", error);
        } finally {
            setIsStreaming(false);
            setStreamBuffer('');
        }
    };

    return (
        <div className="flex bg-[#0b1120] text-gray-100 font-sans rounded-3xl overflow-hidden border border-white/5 shadow-2xl h-[calc(100vh-8rem)]">
            {/* SIDEBAR */}
            <div className="w-64 bg-slate-900/50 border-r border-white/5 flex flex-col shrink-0 z-20 backdrop-blur-md">
                <div className="p-4 border-b border-white/5">
                    <button
                        onClick={startNewChat}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                    >
                        <Plus size={18} /> New Chat
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                    {chats.map(chat => (
                        <div
                            key={chat.id}
                            onClick={() => setActiveChatId(chat.id)}
                            className={clsx(
                                "group flex flex-col gap-1 p-3 rounded-xl cursor-pointer transition-all relative overflow-hidden",
                                activeChatId === chat.id
                                    ? "bg-white/10 text-white shadow-inner"
                                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                            )}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <MessageSquare size={16} className={activeChatId === chat.id ? "text-indigo-400" : "text-slate-500"} />
                                <span className="flex-1 truncate text-xs font-medium">{chat.title}</span>
                            </div>
                            <div className="pl-7 text-[10px] text-slate-600 font-mono">
                                {chat.updatedAt?.seconds
                                    ? new Date(chat.updatedAt.seconds * 1000).toLocaleString('vi-VN', {
                                        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
                                    })
                                    : 'Vừa xong'}
                            </div>

                            <button
                                onClick={(e) => handleDeleteChat(chat.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all absolute right-2 top-2 bg-slate-900/80 backdrop-blur"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                    {chats.length === 0 && (
                        <div className="text-center text-xs text-slate-600 mt-10">
                            Chưa có cuộc hội thoại nào.
                        </div>
                    )}
                </div>

                {/* API Key Config (Admin Only) */}
                {isAdmin && (
                    <div className="p-4 border-t border-white/5 bg-slate-950/30">
                        <button
                            onClick={() => setHasKey(false)}
                            className="flex items-center gap-2 text-[10px] text-slate-500 hover:text-indigo-400 transition-colors w-full justify-center uppercase tracking-wider font-bold"
                        >
                            <Key size={10} /> Configure API Key
                        </button>
                    </div>
                )}
            </div>

            {/* MAIN CHAT */}
            <div className="flex-1 flex flex-col relative bg-slate-950/50">
                {/* Background Decor */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 pointer-events-none" />

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 pb-24" ref={scrollRef}>
                    {!hasKey && (
                        <div className="max-w-md mx-auto mt-20 p-8 glass-panel rounded-2xl border border-indigo-500/30 text-center space-y-4">
                            <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-400 animate-pulse">
                                <Key size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Cấu hình Gemini AI</h2>
                            <p className="text-slate-400 text-sm">Vui lòng nhập Google Gemini API Key để kích hoạt tính năng chat cho toàn bộ nhân sự.</p>

                            {isAdmin ? (
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={e => setApiKey(e.target.value)}
                                        placeholder="AIzaSy..."
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                    />
                                    <button onClick={handleSaveKey} className="px-4 py-2 bg-indigo-600 rounded-lg font-bold text-sm">Lưu</button>
                                </div>
                            ) : (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-sm flex items-center gap-2 justify-center">
                                    <AlertTriangle size={16} /> Liên hệ Admin để cài đặt.
                                </div>
                            )}
                            <p className="text-xs text-slate-600 mt-4">
                                Key sẽ được lưu an toàn vào hệ thống và dùng chung cho mọi user.
                            </p>
                        </div>
                    )}

                    {hasKey && messages.length === 0 && !activeChatId && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-6 opacity-60">
                            <div className="relative">
                                <Bot size={64} className="text-indigo-500/50" />
                                <Sparkles className="absolute -top-2 -right-2 text-indigo-400 animate-pulse" size={24} />
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-bold text-white">AVG Assistant</p>
                                <p className="text-sm">Trợ lý AI thông minh sẵn sàng hỗ trợ công việc.</p>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={clsx(
                            "flex flex-col max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300",
                            msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                        )}>
                            <div className="flex gap-4">
                                {msg.role === 'model' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 mt-1">
                                        <Sparkles size={16} className="text-white" />
                                    </div>
                                )}
                                <div className={clsx(
                                    "p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap font-sans relative group",
                                    msg.role === 'user'
                                        ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/20"
                                        : "bg-[#1e293b] border border-white/5 text-slate-200 rounded-tl-none shadow-xl"
                                )}>
                                    {msg.text}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 mt-1">
                                        {users.find(u => u.id === currentUser?.uid)?.avatar ? (
                                            <img src={users.find(u => u.id === currentUser?.uid)?.avatar} className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon size={16} className="text-slate-400" />
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Timestamp for message */}
                            <div className={clsx(
                                "text-[10px] text-slate-500 mt-1.5 font-mono px-1",
                                msg.role === 'user' ? "mr-12" : "ml-12"
                            )}>
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleString('vi-VN', {
                                    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                                }) : ''}
                            </div>
                        </div>
                    ))}

                    {/* LIVE STREAMING BUBBLE */}
                    {isStreaming && (
                        <div className="flex gap-4 max-w-3xl mr-auto animate-in fade-in">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 shadow-lg animate-pulse mt-1">
                                <Sparkles size={16} className="text-white" />
                            </div>
                            <div className="p-4 rounded-2xl rounded-tl-none bg-[#1e293b] border border-white/10 text-slate-200 shadow-xl text-sm leading-relaxed whitespace-pre-wrap">
                                {streamBuffer}
                                <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-1 animate-pulse align-middle" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area - Fixed Bottom of Container */}
                <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent pt-12 z-20">
                    <div className="max-w-3xl mx-auto relative group">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            disabled={!hasKey || isStreaming}
                            placeholder={hasKey ? "Nhập tin nhắn... (Shift+Enter xuống dòng)" : "Cần cấu hình Key..."}
                            className="w-full bg-[#1e293b] border border-slate-700/50 rounded-2xl pl-5 pr-14 py-4 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all resize-none shadow-xl h-[60px] max-h-[200px] placeholder-slate-500"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || !hasKey || isStreaming}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-700 transition-all active:scale-95 group-hover:scale-105"
                        >
                            {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                    <div className="text-center mt-2 text-[10px] text-slate-600 font-mono">
                        AVG Genius có thể mắc lỗi. Vui lòng kiểm tra lại thông tin quan trọng.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIChat;

import React, { useState, useEffect, useRef } from 'react';
import {
    MessageCircle, X, Send, Paperclip,
    Trash2, Users, Search, ChevronLeft,
    CheckCheck, Circle, Plus, Minimize2, Check, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ChatService, ChatRoom, ChatMessage } from '../services/chatService';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

// --- TYPES (Now imported from Service) ---

// Types imported from service


const ChatWidget: React.FC = () => {
    const { currentUser } = useAuth();
    const { users, addNotification } = useData();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
    const [view, setView] = useState<'list' | 'chat' | 'create_group'>('list');

    // Data State
    const [chats, setChats] = useState<ChatRoom[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // Filter/Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsersForGroup, setSelectedUsersForGroup] = useState<string[]>([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);



    // Notification Logic Ref
    const previousChatsRef = useRef<ChatRoom[]>([]);

    // Restoring State
    useEffect(() => {
        const savedIsOpen = localStorage.getItem('avg_chat_is_open');
        if (savedIsOpen === 'true') setIsOpen(true);

        const savedIsMinimized = localStorage.getItem('avg_chat_is_minimized');
        if (savedIsMinimized === 'true') setIsMinimized(true);

        // Restore view and group draft
        const savedView = localStorage.getItem('avg_chat_view');
        if (savedView === 'create_group') {
            setView('create_group');
            const savedName = localStorage.getItem('avg_new_group_name');
            if (savedName) setNewGroupName(savedName);
            try {
                const savedUsers = JSON.parse(localStorage.getItem('avg_new_group_users') || '[]');
                if (Array.isArray(savedUsers)) setSelectedUsersForGroup(savedUsers);
            } catch (e) {
                console.error("Failed to parse saved group users", e);
            }
        } else if (savedView === 'chat') {
            // Active chat will be restored once chats are loaded
            setView('chat');
        }
    }, []);

    // Persist widget state
    useEffect(() => {
        localStorage.setItem('avg_chat_is_open', isOpen ? 'true' : 'false');
        localStorage.setItem('avg_chat_is_minimized', isMinimized ? 'true' : 'false');
    }, [isOpen, isMinimized]);

    // Persist active chat and view
    useEffect(() => {
        if (activeChat) {
            localStorage.setItem('avg_active_chat_id', activeChat.id);
            localStorage.setItem('avg_chat_view', 'chat');
        } else {
            localStorage.removeItem('avg_active_chat_id');
            if (view !== 'chat') { // Only save view if not in chat mode (to avoid overwriting 'chat' if activeChat is null temporarily)
                localStorage.setItem('avg_chat_view', view);
            }
        }
    }, [activeChat, view]);

    // Persist Group Draft
    useEffect(() => {
        if (view === 'create_group') {
            localStorage.setItem('avg_new_group_name', newGroupName);
            localStorage.setItem('avg_new_group_users', JSON.stringify(selectedUsersForGroup));
        } else {
            localStorage.removeItem('avg_new_group_name');
            localStorage.removeItem('avg_new_group_users');
        }
    }, [view, newGroupName, selectedUsersForGroup]);

    // Restore Active Chat once Chats are loaded
    useEffect(() => {
        const savedChatId = localStorage.getItem('avg_active_chat_id');
        if (savedChatId && chats.length > 0 && !activeChat) {
            const found = chats.find(c => c.id === savedChatId);
            if (found) {
                setActiveChat(found);
                setView('chat');
            } else {
                // If saved chat not found, clear it from storage and revert to list view
                localStorage.removeItem('avg_active_chat_id');
                localStorage.setItem('avg_chat_view', 'list');
                setView('list');
            }
        }
    }, [chats, activeChat]);

    // --- 1. LOAD CHATS & NOTIFICATIONS ---
    useEffect(() => {
        if (!currentUser) return;

        const unsub = ChatService.subscribeToRooms(currentUser.uid, (rooms) => {
            // Local Notification Logic
            if (previousChatsRef.current.length > 0) {
                const newUnreadChat = rooms.find(newRoom => {
                    const oldRoom = previousChatsRef.current.find(r => r.id === newRoom.id);
                    if (!oldRoom) return false;

                    return newRoom.updatedAt?.seconds > oldRoom.updatedAt?.seconds &&
                        newRoom.lastMessage?.senderId !== currentUser.uid &&
                        (!newRoom.lastMessage?.readBy || !newRoom.lastMessage?.readBy.includes(currentUser.uid));
                });

                if (newUnreadChat && !isOpen) {
                    addNotification({
                        id: `chat-${Date.now()}`,
                        title: newUnreadChat.groupName || 'Tin nhắn mới',
                        message: newUnreadChat.lastMessage?.text || 'Bạn có tin nhắn mới',
                        time: new Date().toISOString(),
                        read: false,
                        type: 'message'
                    });

                    if (Notification.permission === 'granted' && document.hidden) {
                        new Notification(newUnreadChat.groupName || 'Tin nhắn mới', {
                            body: newUnreadChat.lastMessage?.text || 'Bạn có tin nhắn mới',
                            icon: '/pwa-192x192.png'
                        });
                    }
                }
            }
            previousChatsRef.current = rooms;
            setChats(rooms);
        });

        return () => unsub();
    }, [currentUser, isOpen, addNotification]);

    useEffect(() => {
        if (!activeChat || !currentUser) {
            setMessages([]);
            return;
        }

        const unsub = ChatService.subscribeToMessages(activeChat.id, 500, (msgs) => {
            setMessages(msgs);

            // Mark unread messages as read
            const unreadIds = msgs
                .filter(m => m.senderId !== currentUser.uid && (!m.readBy || !m.readBy.includes(currentUser.uid)))
                .map(m => m.id);

            if (unreadIds.length > 0) {
                unreadIds.forEach(msgId => {
                    ChatService.markMessageRead(activeChat.id, msgId, currentUser.uid);
                });

                // Update room read status if needed
                if (activeChat.lastMessage && (!activeChat.lastMessage.readBy || !activeChat.lastMessage.readBy.includes(currentUser.uid))) {
                    ChatService.markRoomRead(activeChat.id, currentUser.uid);
                }
            }

            scrollToBottom();
        });

        return () => unsub();
    }, [activeChat, currentUser]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    // --- ACTIONS ---

    const handleSendMessage = async (text: string, file?: File) => {
        if ((!text.trim() && !file) || !activeChat || !currentUser) return;

        try {
            const replyToData = replyingTo ? {
                id: replyingTo.id,
                text: (replyingTo.type === 'text' ? (replyingTo.text || '') : (replyingTo.type === 'image' ? '[Hình ảnh]' : '[Tập tin]')),
                senderId: replyingTo.senderId
            } : undefined;

            await ChatService.sendMessage(activeChat.id, currentUser.uid, text, file, replyToData);
            setReplyingTo(null);
        } catch (error: any) {
            console.error("Send failed", error);
            addNotification({
                id: `error-${Date.now()}`,
                title: 'Lỗi gửi tin nhắn',
                message: error.message || 'Không thể lưu tin nhắn.',
                time: new Date().toISOString(),
                read: false,
                type: 'info'
            });
        }
    };

    const handleReaction = async (msgId: string, emoji: string) => {
        if (!activeChat || !currentUser) return;
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;

        await ChatService.toggleReaction(activeChat.id, msgId, currentUser.uid, emoji, msg.reactions);
    };

    const handleCreateDirectChat = async (targetUserId: string) => {
        if (!currentUser) return;

        const existing = chats.find(c =>
            c.type === 'direct' && c.participants.includes(targetUserId) && c.participants.includes(currentUser.uid)
        );

        if (existing) {
            setActiveChat(existing);
            setView('chat');
            return;
        }

        const newChat = await ChatService.createDirectChat(currentUser.uid, targetUserId);
        setActiveChat(newChat as any);
        setView('chat');
    };

    const handleCreateGroup = async () => {
        if (!currentUser || !newGroupName.trim() || selectedUsersForGroup.length === 0) return;

        const newChat = await ChatService.createGroupChat(currentUser.uid, newGroupName, selectedUsersForGroup);
        setActiveChat(newChat as any);
        setView('chat');
        setNewGroupName('');
        setSelectedUsersForGroup([]);
        localStorage.removeItem('avg_new_group_name');
        localStorage.removeItem('avg_new_group_users');
        localStorage.setItem('avg_chat_view', 'chat');
    };

    const handleDeleteChat = async () => {
        if (!activeChat || !confirm('Xóa đoạn chat này?')) return;
        await ChatService.deleteChat(activeChat.id);
        setActiveChat(null);
        setView('list');
    };

    // --- HELPERS ---
    const getChatName = (chat: ChatRoom) => {
        if (chat.type === 'group') return chat.groupName;
        const otherId = chat.participants.find(id => id !== currentUser?.uid);
        const otherUser = users.find(u => u.id === otherId);
        return otherUser?.name || 'Người dùng';
    };

    const getChatAvatar = (chat: ChatRoom) => {
        if (chat.type === 'group') return null;
        const otherId = chat.participants.find(id => id !== currentUser?.uid);
        const otherUser = users.find(u => u.id === otherId);
        return otherUser?.avatar;
    };

    const isUserOnline = (userId: string) => {
        const u = users.find(user => user.id === userId);
        if (!u?.lastSeen) return false;
        const diff = new Date().getTime() - new Date(u.lastSeen).getTime();
        return diff < 5 * 60 * 1000;
    };

    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return '...';
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // --- SUB COMPONENTS ---

    const ChatListItem = ({ chat }: { chat: ChatRoom }) => {
        const name = getChatName(chat);
        const avatar = getChatAvatar(chat);
        const isGroup = chat.type === 'group';

        return (
            <div
                onClick={() => { setActiveChat(chat); setView('chat'); }}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors relative"
            >
                <div className="relative shrink-0">
                    {isGroup ? (
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Users size={20} />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-700">
                            <img src={avatar || `https://ui-avatars.com/api/?name=${name}`} className="w-full h-full object-cover" />
                        </div>
                    )}
                    {!isGroup && isUserOnline(chat.participants.find(id => id !== currentUser?.uid)!) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-white text-sm font-bold truncate">{name}</h4>
                    <p className={clsx(
                        "text-xs truncate",
                        chat.lastMessage?.senderId !== currentUser?.uid && (!chat.lastMessage?.readBy || !chat.lastMessage?.readBy.includes(currentUser?.uid || ''))
                            ? "text-white font-bold"
                            : "text-slate-400"
                    )}>
                        {chat.lastMessage?.senderId === currentUser?.uid && "Bạn: "}
                        {chat.typingUsers && Object.entries(chat.typingUsers).some(([uid, isTyping]) => uid !== currentUser?.uid && isTyping)
                            ? <span className="text-indigo-400 italic font-normal">Đang soạn tin...</span>
                            : (chat.lastMessage?.text || 'Bắt đầu trò chuyện')
                        }
                    </p>
                </div>
                <div className="text-[10px] text-slate-500 whitespace-nowrap">
                    {chat.updatedAt ? new Date(chat.updatedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
            </div>
        );
    };

    const filteredUsers = users.filter(u =>
        (u.id !== currentUser?.uid && u.email !== currentUser?.email) &&
        (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.dept.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // --- RENDER ---
    if (!currentUser) return null;

    if (!isOpen) {
        return (
            <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="fixed bottom-6 right-6 z-[60]"
            >
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full shadow-2xl flex items-center justify-center text-white transition-transform active:scale-95 group relative"
                >
                    <MessageCircle size={28} />
                    <span className="absolute right-full mr-3 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Chat nội bộ
                    </span>
                    {/* Unread Badge */}
                    {chats.filter(c => c.lastMessage?.senderId !== currentUser.uid && (!c.lastMessage?.readBy || !c.lastMessage?.readBy.includes(currentUser.uid))).length > 0 && (
                        <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#0f172a]" />
                    )}
                </button>
            </motion.div>
        );
    }

    return (
        <div className={clsx(
            "fixed bottom-6 right-6 z-[60] bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300",
            isMinimized ? "w-72 h-14" : "w-[380px] h-[600px] md:h-[650px]"
        )}>
            {/* HEADER */}
            <div className="h-14 bg-slate-900 border-b border-white/5 flex items-center justify-between px-4 shrink-0 cursor-pointer" onClick={() => !isMinimized && setIsMinimized(true)}>
                <div className="flex items-center gap-2" onClick={(e) => { e.stopPropagation(); if (isMinimized) setIsMinimized(false); }}>
                    {view !== 'list' && !isMinimized && (
                        <button onClick={() => setView('list')} className="p-1 hover:bg-white/10 rounded-full mr-1">
                            <ChevronLeft size={18} className="text-slate-400" />
                        </button>
                    )}
                    <h3 className="text-white font-bold flex items-center gap-2">
                        {view === 'list' ? 'Chat Nội bộ' : view === 'create_group' ? 'Tạo nhóm mới' : getChatName(activeChat!)}
                        {view === 'chat' && activeChat?.type === 'group' && <span className="text-xs font-normal text-slate-400 px-1 border border-slate-600 rounded bg-slate-800">Group</span>}
                    </h3>
                </div>
                <div className="flex items-center gap-1">
                    {isMinimized ? (
                        <button onClick={() => setIsMinimized(false)} className="p-2 text-slate-400 hover:text-white"><Minimize2 size={16} /></button>
                    ) : (
                        <>
                            {view === 'create_group' && (
                                <button
                                    onClick={handleCreateGroup}
                                    disabled={!newGroupName.trim() || selectedUsersForGroup.length === 0}
                                    className="p-2 text-indigo-400 hover:text-indigo-300 disabled:opacity-30" title="Tạo nhóm"
                                >
                                    <CheckCheck size={18} />
                                </button>
                            )}
                            {view === 'chat' && activeChat && (
                                (activeChat.type === 'direct' || activeChat.createdBy === currentUser.uid) && (
                                    <button
                                        onClick={handleDeleteChat}
                                        className="p-2 text-slate-400 hover:text-red-400"
                                        title={activeChat.type === 'group' ? "Giải tán nhóm" : "Xóa đoạn chat"}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )
                            )}
                            <button onClick={() => setIsMinimized(true)} className="p-2 text-slate-400 hover:text-white"><Minimize2 size={18} /></button>
                            <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-white"><X size={18} /></button>
                        </>
                    )}
                </div>
            </div>

            {/* CONTENT */}
            {!isMinimized && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#0f172a]">

                    {view === 'list' && (
                        <>
                            <div className="p-3 border-b border-white/5">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Tìm đồng nghiệp..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                                    />
                                </div>
                                <button
                                    onClick={() => setView('create_group')}
                                    className="w-full mt-2 flex items-center justify-center gap-2 text-xs font-medium text-indigo-400 hover:bg-indigo-500/10 p-2 rounded-lg transition-colors border border-dashed border-indigo-500/30"
                                >
                                    <Plus size={14} /> Tạo nhóm mới
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                {!searchQuery && chats.length > 0 && (
                                    <div className="mb-4">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase px-2 mb-1">Gần đây</div>
                                        {chats.map(chat => (
                                            <ChatListItem key={chat.id} chat={chat} />
                                        ))}
                                    </div>
                                )}
                                <div className="text-[10px] font-bold text-slate-500 uppercase px-2 mb-1">
                                    {searchQuery ? 'Kết quả tìm kiếm' : 'Đồng nghiệp'}
                                </div>
                                {filteredUsers.map(u => (
                                    <div
                                        key={u.id}
                                        onClick={() => handleCreateDirectChat(u.id)}
                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors group"
                                    >
                                        <div className="relative shrink-0">
                                            <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-700">
                                                <img src={u.avatar} className="w-full h-full object-cover" />
                                            </div>
                                            {isUserOnline(u.id) && (
                                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-slate-200 text-sm font-medium truncate group-hover:text-white">{u.name}</h4>
                                            <p className="text-[10px] text-slate-500 truncate">{u.role}</p>
                                        </div>
                                        <div className="px-2 py-1 rounded bg-slate-800 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Nhắn tin
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {view === 'create_group' && (
                        <div className="flex-1 flex flex-col p-4 min-h-0">
                            <div className="shrink-0">
                                <input
                                    type="text"
                                    placeholder="Tên nhóm..."
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 mb-4"
                                />
                                <div className="text-xs text-slate-500 mb-2 font-bold uppercase">Chọn thành viên:</div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 rounded-lg bg-slate-900/50 p-2 min-h-0">
                                {users.filter(u => u.id !== currentUser.uid && u.email !== currentUser.email).map(u => {
                                    const isSelected = selectedUsersForGroup.includes(u.id);
                                    return (
                                        <div
                                            key={u.id}
                                            onClick={() => {
                                                if (isSelected) setSelectedUsersForGroup(prev => prev.filter(id => id !== u.id));
                                                else setSelectedUsersForGroup(prev => [...prev, u.id]);
                                            }}
                                            className={clsx(
                                                "flex items-center gap-3 p-2 rounded-lg cursor-pointer mb-1 transition-all",
                                                isSelected ? "bg-indigo-600/20 border border-indigo-500/50" : "hover:bg-slate-800 border border-transparent"
                                            )}
                                        >
                                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                                                <img src={u.avatar} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 truncate text-sm text-slate-300">{u.name}</div>
                                            {isSelected ? <CheckCheck size={16} className="text-indigo-400" /> : <Circle size={16} className="text-slate-600" />}
                                        </div>
                                    )
                                })}
                            </div>

                            <button
                                onClick={handleCreateGroup}
                                disabled={!newGroupName.trim() || selectedUsersForGroup.length === 0}
                                className="mt-4 shrink-0 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Tạo nhóm
                            </button>
                        </div>
                    )}

                    {view === 'chat' && activeChat && (
                        <>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 bg-[#0b1120]">
                                {activeChat.type === 'group' && (
                                    <div className="text-center py-4">
                                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-2 text-indigo-400">
                                            <Users size={32} />
                                        </div>
                                        <h3 className="text-white font-bold">{activeChat.groupName}</h3>
                                        <p className="text-xs text-slate-500">
                                            {activeChat.participants.length} thành viên • {new Date(activeChat.updatedAt?.seconds * 1000).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}

                                {messages.map(msg => {
                                    const isMe = msg.senderId === currentUser.uid;
                                    const sender = users.find(u => u.id === msg.senderId);
                                    const seenByAll = activeChat.participants.every(p => msg.readBy?.includes(p));

                                    return (
                                        <div key={msg.id} className={clsx("flex gap-2 max-w-[85%] group relative", isMe ? "ml-auto" : "mr-auto")}>
                                            {/* Reactions Display (Left for Me, Right for Others) */}
                                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                <div className={clsx(
                                                    "absolute -bottom-2 z-10 flex -space-x-1",
                                                    isMe ? "right-0" : "left-10"
                                                )}>
                                                    {Object.entries(msg.reactions).map(([uid, emoji], idx) => (
                                                        <span key={`${uid}-${idx}`} className="bg-slate-700 border border-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm">
                                                            {emoji}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {!isMe && (
                                                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1" title={sender?.name}>
                                                    <img src={sender?.avatar || `https://ui-avatars.com/api/?name=User`} className="w-full h-full object-cover" />
                                                </div>
                                            )}

                                            <div id={`msg-${msg.id}`} className={clsx(
                                                "p-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm relative group/bubble min-w-[120px] transition-colors duration-500",
                                                isMe ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-800 text-slate-200 rounded-tl-none border border-white/5"
                                            )}>
                                                {/* Referenced Reply */}
                                                {msg.replyTo && (
                                                    <div className="mb-2 p-2 rounded bg-black/20 border-l-2 border-white/30 text-xs flex flex-col cursor-pointer opacity-80 hover:opacity-100"
                                                        onClick={() => {
                                                            const el = document.getElementById(`msg-${msg.replyTo?.id}`);
                                                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            el?.classList.add('bg-white/10');
                                                            setTimeout(() => el?.classList.remove('bg-white/10'), 2000);
                                                        }}
                                                    >
                                                        <span className="font-bold mb-0.5">
                                                            {users.find(u => u.id === msg.replyTo?.senderId)?.name || 'Người dùng'}
                                                        </span>
                                                        <span className="truncate line-clamp-1 italic">{msg.replyTo.text}</span>
                                                    </div>
                                                )}

                                                {/* Image */}
                                                {msg.type === 'image' && (
                                                    <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                                                        <img src={msg.fileUrl} alt="sent" className="w-full h-auto max-h-48 object-cover cursor-pointer" onClick={() => window.open(msg.fileUrl, '_blank')} />
                                                    </div>
                                                )}
                                                {/* File */}
                                                {msg.type === 'file' && (
                                                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/20 p-2 rounded mb-1 hover:bg-black/30 transition-colors">
                                                        <Paperclip size={14} />
                                                        <span className="truncate text-xs underline">{msg.fileName}</span>
                                                    </a>
                                                )}

                                                {/* Text */}
                                                {msg.text}

                                                {/* Time & Status */}
                                                <div className={clsx("flex items-center justify-end gap-1 text-[10px] mt-1 opacity-70", isMe ? "text-indigo-200" : "text-slate-400")}>
                                                    <span>{formatTimestamp(msg.timestamp)}</span>
                                                    {isMe && (
                                                        <span>
                                                            {msg.status === 'sending' ? <Loader2 size={12} className="animate-spin" /> : seenByAll ? <CheckCheck size={12} className="text-white" /> : <Check size={12} />}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Reaction Picker & Reply Button on Hover */}
                                                <div className={clsx(
                                                    "absolute -top-8 hidden group-hover/bubble:flex items-center gap-1 bg-slate-900 border border-white/10 rounded-full px-2 py-1 shadow-xl z-20",
                                                    isMe ? "right-0" : "left-0"
                                                )}>
                                                    <button
                                                        onClick={() => setReplyingTo(msg)}
                                                        className="hover:bg-white/10 p-1 rounded-full text-slate-400 hover:text-white mr-1 border-r border-white/10 pr-2"
                                                        title="Trả lời"
                                                    >
                                                        <MessageCircle size={14} style={{ transform: 'scaleX(-1)' }} />
                                                    </button>
                                                    {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => handleReaction(msg.id, emoji)}
                                                            className={clsx(
                                                                "hover:scale-125 transition-transform text-xs",
                                                                msg.reactions?.[currentUser.uid] === emoji && "bg-white/10 rounded-full"
                                                            )}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={messagesEndRef} />
                                {/* Typing Indicator inside Chat */}
                                {activeChat.typingUsers && Object.entries(activeChat.typingUsers).some(([uid, isTyping]) => uid !== currentUser.uid && isTyping) && (
                                    <div className="px-4 py-2 text-xs text-slate-500 italic flex items-center gap-1 animate-pulse">
                                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        <span>Đang soạn tin...</span>
                                    </div>
                                )}
                            </div>

                            {/* Reply Quote Bar */}
                            {replyingTo && (
                                <div className="px-3 py-2 bg-slate-800 border-t border-white/5 flex items-center justify-between animate-slide-up">
                                    <div className="flex flex-col text-xs border-l-2 border-indigo-500 pl-2">
                                        <span className="text-indigo-400 font-bold">
                                            Đang trả lời {users.find(u => u.id === replyingTo.senderId)?.name || 'Người dùng'}
                                        </span>
                                        <span className="text-slate-400 truncate max-w-[250px]">
                                            {replyingTo.type === 'text' ? replyingTo.text : (replyingTo.type === 'image' ? '[Hình ảnh]' : '[Tập tin]')}
                                        </span>
                                    </div>
                                    <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 rounded text-slate-400">
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            <div className={clsx("p-3 bg-slate-900 border-t border-white/5", replyingTo ? "pt-1" : "")}>
                                <ChatInput
                                    onSend={handleSendMessage}
                                    onTyping={(isTyping) => ChatService.setTyping(activeChat.id, currentUser.uid, isTyping)}
                                />
                            </div>


                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const ChatInput = ({ onSend, onTyping }: { onSend: (text: string, file?: File) => void, onTyping?: (isTyping: boolean) => void }) => {
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<any>(null);

    const handleSend = () => {
        if (!text.trim() && !file) return;
        onSend(text, file || undefined);
        setText('');
        setFile(null);
        if (onTyping) {
            onTyping(false);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        }
    };

    // Typing Handler
    const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
        if (onTyping) {
            onTyping(true);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
                onTyping(false);
                typingTimeoutRef.current = null;
            }, 2000);
        }
    };

    return (
        <div className="relative">
            {file && (
                <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 rounded-lg border border-white/10 flex items-center gap-2">
                    <span className="text-xs text-indigo-400 truncate max-w-[200px]">{file.name}</span>
                    <button onClick={() => setFile(null)} className="text-slate-400 hover:text-white"><X size={14} /></button>
                </div>
            )}
            <div className="flex items-center gap-2 bg-slate-800 rounded-2xl p-1 border border-white/5 focus-within:border-indigo-500/50 transition-colors">
                <button
                    onClick={() => fileRef.current?.click()}
                    className="p-2 text-slate-400 hover:text-indigo-400 transition-colors rounded-full hover:bg-white/5"
                >
                    <Paperclip size={18} />
                </button>
                <input
                    type="file" ref={fileRef} className="hidden"
                    onChange={(e) => e.target.files && setFile(e.target.files[0])}
                />

                <textarea
                    value={text}
                    onChange={handleTyping}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 bg-transparent border-none px-2 py-2 text-sm text-white focus:ring-0 outline-none resize-none max-h-24 custom-scrollbar"
                    rows={1}
                />
                <button
                    onClick={handleSend}
                    disabled={!text.trim() && !file}
                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-700 transition-all shrink-0 m-1"
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
};

export default ChatWidget;

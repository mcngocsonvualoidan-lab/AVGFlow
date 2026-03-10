import React, { useState, useEffect, useRef } from 'react';
import {
    MessageCircle, X, Send, Paperclip,
    Trash2, Users, Search, ChevronLeft,
    CheckCheck, Circle, Plus, Minimize2, Check,
    Smile, CornerUpLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { RealtimeChatService, RTChatRoom, RTChatMessage } from '../services/realtimeChatService';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

const RealtimeChatWidget: React.FC = () => {
    const { currentUser } = useAuth();
    const { users, addNotification } = useData();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeChat, setActiveChat] = useState<RTChatRoom | null>(null);
    const [view, setView] = useState<'list' | 'chat' | 'create_group'>('list');

    // Data State
    const [chats, setChats] = useState<RTChatRoom[]>([]);
    const [messages, setMessages] = useState<RTChatMessage[]>([]);
    const [roomMeta, setRoomMeta] = useState<RTChatRoom | null>(null); // For typing indicator

    // Filter/Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsersForGroup, setSelectedUsersForGroup] = useState<string[]>([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [replyingTo, setReplyingTo] = useState<RTChatMessage | null>(null);
    const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null); // For mobile/click interaction


    const messagesEndRef = useRef<HTMLDivElement>(null);
    const previousChatsRef = useRef<RTChatRoom[]>([]);

    // --- RESTORE STATE FROM LOCAL STORAGE ---
    useEffect(() => {
        const savedIsOpen = localStorage.getItem('avg_rtchat_is_open');
        if (savedIsOpen === 'true') setIsOpen(true);

        const savedIsMinimized = localStorage.getItem('avg_rtchat_is_minimized');
        if (savedIsMinimized === 'true') setIsMinimized(true);

        const savedView = localStorage.getItem('avg_rtchat_view');
        if (savedView === 'create_group') {
            setView('create_group');
            const savedName = localStorage.getItem('avg_rtchat_group_name');
            if (savedName) setNewGroupName(savedName);
            try {
                const savedUsers = JSON.parse(localStorage.getItem('avg_rtchat_group_users') || '[]');
                if (Array.isArray(savedUsers)) setSelectedUsersForGroup(savedUsers);
            } catch (e) { /* ignore */ }
        } else if (savedView === 'chat') {
            setView('chat');
        }
    }, []);

    // Persist widget state
    useEffect(() => {
        localStorage.setItem('avg_rtchat_is_open', isOpen ? 'true' : 'false');
        localStorage.setItem('avg_rtchat_is_minimized', isMinimized ? 'true' : 'false');
    }, [isOpen, isMinimized]);

    useEffect(() => {
        if (activeChat) {
            localStorage.setItem('avg_rtchat_active_id', activeChat.id);
            localStorage.setItem('avg_rtchat_view', 'chat');
        } else {
            localStorage.removeItem('avg_rtchat_active_id');
            if (view !== 'chat') localStorage.setItem('avg_rtchat_view', view);
        }
    }, [activeChat, view]);

    useEffect(() => {
        if (view === 'create_group') {
            localStorage.setItem('avg_rtchat_group_name', newGroupName);
            localStorage.setItem('avg_rtchat_group_users', JSON.stringify(selectedUsersForGroup));
        } else {
            localStorage.removeItem('avg_rtchat_group_name');
            localStorage.removeItem('avg_rtchat_group_users');
        }
    }, [view, newGroupName, selectedUsersForGroup]);

    // Restore active chat after rooms load
    useEffect(() => {
        const savedChatId = localStorage.getItem('avg_rtchat_active_id');
        if (savedChatId && chats.length > 0 && !activeChat) {
            const found = chats.find(c => c.id === savedChatId);
            if (found) {
                setActiveChat(found);
                setView('chat');
            } else {
                localStorage.removeItem('avg_rtchat_active_id');
                setView('list');
            }
        }
    }, [chats, activeChat]);

    // --- SUBSCRIBE TO ROOMS ---
    useEffect(() => {
        if (!currentUser) return;

        const unsub = RealtimeChatService.subscribeToUserRooms(currentUser.uid, (rooms) => {
            // Local notification for new messages
            if (previousChatsRef.current.length > 0) {
                const newUnread = rooms.find(newRoom => {
                    const oldRoom = previousChatsRef.current.find(r => r.id === newRoom.id);
                    if (!oldRoom) return false;
                    return (newRoom.updatedAt || 0) > (oldRoom.updatedAt || 0) &&
                        newRoom.lastMessage?.senderId !== currentUser.uid;
                });

                if (newUnread && !isOpen) {
                    addNotification({
                        id: `rtchat-${Date.now()}`,
                        title: newUnread.groupName || 'Tin nhắn mới',
                        message: newUnread.lastMessage?.text || 'Bạn có tin nhắn mới',
                        time: new Date().toISOString(),
                        read: false,
                        type: 'message'
                    });

                    if (Notification.permission === 'granted' && document.hidden) {
                        new Notification(newUnread.groupName || 'Tin nhắn mới', {
                            body: newUnread.lastMessage?.text || 'Bạn có tin nhắn mới',
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

    // --- SUBSCRIBE TO MESSAGES & ROOM META ---
    useEffect(() => {
        if (!activeChat || !currentUser) {
            setMessages([]);
            setRoomMeta(null);
            return;
        }

        // Messages
        const unsubMsgs = RealtimeChatService.subscribeToMessages(activeChat.id, 200, (msgs) => {
            setMessages(msgs);

            // Mark unread as read
            msgs.forEach(msg => {
                if (msg.senderId !== currentUser.uid && (!msg.readBy || !msg.readBy[currentUser.uid])) {
                    RealtimeChatService.markMessageRead(activeChat.id, msg.id, currentUser.uid);
                }
            });

            scrollToBottom();
        });

        // Room Meta (for typing)
        const unsubRoom = RealtimeChatService.subscribeToRoom(activeChat.id, (room) => {
            setRoomMeta(room);
        });

        return () => {
            unsubMsgs();
            unsubRoom();
            // Clear typing when leaving
            RealtimeChatService.clearTyping(activeChat.id, currentUser.uid);
        };
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
                text: replyingTo.type === 'text' ? (replyingTo.text || '') : (replyingTo.type === 'image' ? '[Hình ảnh]' : '[Tập tin]'),
                senderId: replyingTo.senderId
            } : undefined;

            await RealtimeChatService.sendMessage(activeChat.id, currentUser.uid, text, file, replyToData);
            setReplyingTo(null);
        } catch (error: any) {
            console.error("Send failed", error);
            addNotification({
                id: `error-${Date.now()}`,
                title: 'Lỗi gửi tin nhắn',
                message: error.message || 'Không thể gửi tin nhắn.',
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
        await RealtimeChatService.toggleReaction(activeChat.id, msgId, currentUser.uid, emoji, msg.reactions);
    };

    const handleCreateDirectChat = async (targetUserId: string) => {
        if (!currentUser) return;

        // Check if already in chats list
        const existing = chats.find(c =>
            c.type === 'direct' && c.participantsList.includes(targetUserId) && c.participantsList.includes(currentUser.uid)
        );

        if (existing) {
            setActiveChat(existing);
            setView('chat');
            return;
        }

        const newChat = await RealtimeChatService.createOrGetDirectChat(currentUser.uid, targetUserId);
        setActiveChat(newChat);
        setView('chat');
    };

    const handleCreateGroup = async () => {
        if (!currentUser || !newGroupName.trim() || selectedUsersForGroup.length === 0) return;

        const newChat = await RealtimeChatService.createGroupChat(currentUser.uid, newGroupName, selectedUsersForGroup);
        setActiveChat(newChat);
        setView('chat');
        setNewGroupName('');
        setSelectedUsersForGroup([]);
    };

    const handleDeleteChat = async () => {
        if (!activeChat || !confirm('Xóa đoạn chat này?')) return;
        await RealtimeChatService.deleteChat(activeChat.id, activeChat.participantsList);
        setActiveChat(null);
        setView('list');
    };

    // --- HELPERS ---
    const getGroupedReactions = (reactions?: { [uid: string]: string }) => {
        if (!reactions) return [];
        const groups: { emoji: string, count: number, users: string[] }[] = [];
        
        Object.entries(reactions).forEach(([uid, emoji]) => {
            const userName = users.find(u => u.id === uid)?.name || 'Người dùng';
            const group = groups.find(g => g.emoji === emoji);
            if (group) {
                group.count++;
                group.users.push(userName);
            } else {
                groups.push({ emoji, count: 1, users: [userName] });
            }
        });
        return groups;
    };

    const getChatName = (chat: RTChatRoom) => {
        if (chat.type === 'group') return chat.groupName;
        const otherId = chat.participantsList.find(id => id !== currentUser?.uid);
        const otherUser = users.find(u => u.id === otherId);
        return otherUser?.name || 'Người dùng';
    };

    const getChatAvatar = (chat: RTChatRoom) => {
        if (chat.type === 'group') return null;
        const otherId = chat.participantsList.find(id => id !== currentUser?.uid);
        const otherUser = users.find(u => u.id === otherId);
        return otherUser?.avatar;
    };

    const isUserOnline = (userId: string) => {
        const u = users.find(user => user.id === userId);
        if (!u?.lastSeen) return false;
        const diff = new Date().getTime() - new Date(u.lastSeen).getTime();
        return diff < 5 * 60 * 1000;
    };

    const formatTimestamp = (timestamp: number) => {
        if (!timestamp) return '...';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Check if someone is typing
    const isSomeoneTyping = () => {
        if (!roomMeta?.typingUsers || !currentUser) return false;
        return Object.entries(roomMeta.typingUsers).some(([uid, isTyping]) => uid !== currentUser.uid && isTyping);
    };

    // --- COMPONENTS ---
    const ChatListItem = ({ chat }: { chat: RTChatRoom }) => {
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
                    {!isGroup && isUserOnline(chat.participantsList.find(id => id !== currentUser?.uid)!) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-white text-sm font-bold truncate">{name}</h4>
                    <p className="text-xs truncate text-slate-400">
                        {chat.lastMessage?.senderId === currentUser?.uid && "Bạn: "}
                        {chat.lastMessage?.text || 'Bắt đầu trò chuyện'}
                    </p>
                </div>
                <div className="text-[10px] text-slate-500 whitespace-nowrap">
                    {chat.updatedAt ? new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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
                className="fixed bottom-24 md:bottom-6 right-6 z-[60]"
            >
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full shadow-[0_8px_25px_rgba(79,70,229,0.5)] hover:shadow-[0_8px_35px_rgba(79,70,229,0.6)] flex items-center justify-center text-white transition-all active:scale-95 group relative"
                >
                    <MessageCircle size={28} />
                    <span className="absolute right-full mr-3 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Chat nội bộ
                    </span>
                    {chats.some(c => c.lastMessage?.senderId !== currentUser.uid) && (
                        <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#0f172a]" />
                    )}
                </button>
            </motion.div>
        );
    }

    return (
        <div className={clsx(
            "fixed bottom-24 md:bottom-6 right-6 z-[60] bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300",
            isMinimized ? "w-72 h-14" : "w-[380px] h-[600px] md:h-[650px]"
        )}>
            {/* HEADER */}
            <div className="h-14 bg-slate-900 border-b border-white/5 flex items-center justify-between px-4 shrink-0 cursor-pointer" onClick={() => !isMinimized && setIsMinimized(true)}>
                <div className="flex items-center gap-2" onClick={(e) => { e.stopPropagation(); if (isMinimized) setIsMinimized(false); }}>
                    {view !== 'list' && !isMinimized && (
                        <button onClick={() => { setActiveChat(null); setView('list'); }} className="p-1 hover:bg-white/10 rounded-full mr-1">
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
                                            {activeChat.participantsList.length} thành viên • {new Date(activeChat.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}

                                {messages.map(msg => {
                                    const isMe = msg.senderId === currentUser.uid;
                                    const sender = users.find(u => u.id === msg.senderId);
                                    const seenByAll = activeChat.participantsList.every(p => msg.readBy?.[p]);

                                    return (

                                        <div key={msg.id} className={clsx("flex w-full mb-4", isMe ? "justify-end" : "justify-start")}>
                                            <div className={clsx("flex gap-2 max-w-[85%] group relative", isMe ? "flex-row-reverse" : "flex-row")}>
                                                {!isMe && (
                                                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1" title={sender?.name}>
                                                        <img src={sender?.avatar || `https://ui-avatars.com/api/?name=User`} className="w-full h-full object-cover" />
                                                    </div>
                                                )}

                                                <div id={`msg-${msg.id}`} 
                                                    className={clsx(
                                                        "p-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm relative group/bubble min-w-[120px] transition-colors duration-500 cursor-pointer",
                                                        isMe ? "bg-indigo-600 text-white rounded-tr-none text-right" : "bg-slate-800 text-slate-200 rounded-tl-none border border-white/5 text-left"
                                                    )}
                                                    onClick={() => setSelectedMsgId(selectedMsgId === msg.id ? null : msg.id)}
                                                >
                                                    {msg.replyTo && (
                                                        <div className={clsx(
                                                            "mb-2 p-2 rounded bg-black/20 border-l-2 border-white/30 text-xs flex flex-col cursor-pointer opacity-80 hover:opacity-100",
                                                            isMe ? "text-right" : "text-left"
                                                        )}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
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

                                                    {msg.type === 'image' && (
                                                        <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                                                            <img src={msg.fileUrl} alt="sent" className="w-full h-auto max-h-48 object-cover cursor-pointer" onClick={() => window.open(msg.fileUrl, '_blank')} />
                                                        </div>
                                                    )}
                                                    {msg.type === 'file' && (
                                                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/20 p-2 rounded mb-1 hover:bg-black/30 transition-colors">
                                                            <Paperclip size={14} />
                                                            <span className="truncate text-xs underline">{msg.fileName}</span>
                                                        </a>
                                                    )}

                                                    {msg.text}

                                                    <div className={clsx("flex items-center gap-1 text-[10px] mt-1 opacity-70", isMe ? "justify-end text-indigo-200" : "justify-start text-slate-400")}>
                                                        <span>{formatTimestamp(msg.timestamp)}</span>
                                                        {isMe && (
                                                            <span>
                                                                {seenByAll ? <CheckCheck size={12} className="text-white" /> : <Check size={12} />}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Floating Action Menu */}
                                                    <div className={clsx(
                                                        "absolute flex items-center gap-1 bg-slate-900 border border-white/10 rounded-full px-2 py-1 shadow-xl z-20 transition-all duration-200",
                                                        "-top-9",
                                                        isMe ? "right-0" : "left-0",
                                                        selectedMsgId === msg.id ? "opacity-100 translate-y-0 visible" : "opacity-0 translate-y-1 invisible md:group-hover:opacity-100 md:group-hover:translate-y-0 md:group-hover:visible"
                                                    )}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); setSelectedMsgId(null); }}
                                                            className="hover:bg-white/10 p-1 rounded-full text-slate-400 hover:text-white mr-1 border-r border-white/10 pr-2"
                                                            title="Trả lời"
                                                        >
                                                            <CornerUpLeft size={14} />
                                                        </button>
                                                        {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); setSelectedMsgId(null); }}
                                                                className={clsx(
                                                                    "hover:scale-125 transition-transform text-xs p-1 rounded-full",
                                                                    msg.reactions?.[currentUser.uid] === emoji && "bg-indigo-500/30"
                                                                )}
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                    <div className={clsx(
                                                        "absolute -bottom-3 z-10 flex flex-wrap gap-1",
                                                        isMe ? "right-0 justify-end" : "left-10 justify-start"
                                                    )}>
                                                        {getGroupedReactions(msg.reactions).map((group, idx) => (
                                                            <div 
                                                                key={`${group.emoji}-${idx}`} 
                                                                className="group/rxn relative bg-slate-700/80 border border-white/10 rounded-full py-0.5 px-1.5 flex items-center gap-1 shadow-sm hover:bg-slate-600 cursor-pointer transition-colors"
                                                                onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, group.emoji); }}
                                                            >
                                                                <span className="text-xs">{group.emoji}</span>
                                                                <span className="text-[10px] text-slate-300 font-bold">{group.count}</span>
                                                                
                                                                {/* Tooltip */}
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden md:group-hover/rxn:block bg-slate-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-50 shadow-2xl border border-white/10">
                                                                    {group.users.join(', ')}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={messagesEndRef} />
                                {isSomeoneTyping() && (
                                    <div className="px-4 py-2 text-xs text-slate-500 italic flex items-center gap-1 animate-pulse">
                                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        <span>Đang soạn tin...</span>
                                    </div>
                                )}
                            </div>

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
                                    onTyping={(isTyping) => RealtimeChatService.setTyping(activeChat.id, currentUser.uid, isTyping)}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// --- CHAT INPUT COMPONENT ---
const ChatInput = ({ onSend, onTyping }: { onSend: (text: string, file?: File) => void, onTyping?: (isTyping: boolean) => void }) => {
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<any>(null);

    const COMMON_EMOJIS = ['😊', '😂', '❤️', '👍', '🔥', '😮', '😢', '😍', '👏', '🙏', '✨', '🎉', '💡', '🚀', '✅', '❌'];

    const handleSend = () => {
        if (!text.trim() && !file) return;
        onSend(text, file || undefined);
        setText('');
        setFile(null);
        setShowEmojiPicker(false);
        if (onTyping) {
            onTyping(false);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        }
    };

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

    const addEmoji = (emoji: string) => {
        setText(prev => prev + emoji);
        // setShowEmojiPicker(false); // keep it open for multiple emojis
    };

    return (
        <div className="relative">
            {file && (
                <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-800 rounded-lg border border-white/10 flex items-center gap-2">
                    <span className="text-xs text-indigo-400 truncate max-w-[200px]">{file.name}</span>
                    <button onClick={() => setFile(null)} className="text-slate-400 hover:text-white"><X size={14} /></button>
                </div>
            )}

            {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 p-3 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl grid grid-cols-8 gap-2 z-50 animate-slide-up">
                    {COMMON_EMOJIS.map(emoji => (
                        <button
                            key={emoji}
                            onClick={() => addEmoji(emoji)}
                            className="text-xl hover:scale-125 transition-transform p-1"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-2 bg-slate-800 rounded-2xl p-1 border border-white/5 focus-within:border-indigo-500/50 transition-colors">
                <div className="flex items-center">
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="p-2 text-slate-400 hover:text-indigo-400 transition-colors rounded-full hover:bg-white/5"
                        title="Đính kèm"
                    >
                        <Paperclip size={18} />
                    </button>
                    <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={clsx("p-2 transition-colors rounded-full hover:bg-white/5", showEmojiPicker ? "text-indigo-400" : "text-slate-400")}
                        title="Emoji"
                    >
                        <Smile size={18} />
                    </button>
                </div>
                
                <input
                    type="file" ref={fileRef} className="hidden"
                    onChange={(e) => e.target.files && setFile(e.target.files[0])}
                />

                <textarea
                    value={text}
                    onChange={handleTyping}
                    onFocus={() => setShowEmojiPicker(false)}
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
                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-700 transition-all shrink-0 m-1 shadow-lg shadow-indigo-600/20"
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
};

export default RealtimeChatWidget;

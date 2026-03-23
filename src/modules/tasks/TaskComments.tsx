import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Task, TaskComment, User } from '../../context/DataContext';
import { Send, Paperclip, ImageIcon, X, Loader2 } from 'lucide-react';
import { uploadToDrive } from '../../services/driveUploadService';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskCommentsProps {
    task: Task;
}

export const TaskComments: React.FC<TaskCommentsProps> = ({ task }) => {
    const { currentUser } = useAuth();
    const { updateTask, users } = useData();
    const [text, setText] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<{ file: File; type: 'image' | 'file' }[]>([]);
    
    // Auto-scroll referenced container
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [task.comments]);

    const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files).map(file => ({ file, type }));
            setPendingAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const removePendingAttachment = (index: number) => {
        setPendingAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async () => {
        if (!text.trim() && pendingAttachments.length === 0) return;
        if (!currentUser) return;

        let finalAttachments: { type: 'image' | 'file'; url: string; name: string }[] = [];

        try {
            if (pendingAttachments.length > 0) {
                setIsUploading(true);
                // Upload files sequentially or with Promise.all
                const uploaded = await Promise.all(pendingAttachments.map(async (att) => {
                    const result = await uploadToDrive(att.file, 'task_comments');
                    if (result.success) {
                        return { type: att.type, url: result.url || result.viewUrl || result.downloadUrl || '', name: result.fileName || att.file.name };
                    }
                    return null;
                }));
                // Filter out null results if any
                finalAttachments = uploaded.filter(a => a && a.url) as { type: 'image' | 'file'; url: string; name: string }[];
            }

            const newComment: TaskComment = {
                id: `cmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId: currentUser.uid,
                text: text.trim(),
                attachments: finalAttachments,
                timestamp: new Date().toISOString()
            };

            const updatedComments = [...(task.comments || []), newComment];
            
            await updateTask({ ...task, comments: updatedComments });
            
            setText('');
            setPendingAttachments([]);
            
        } catch (error) {
            console.error("Error sending comment:", error);
            alert("Lỗi khi gửi bình luận. Vui lòng thử lại.");
        } finally {
            setIsUploading(false);
        }
    };

    const getUserDetails = (userId: string): User | undefined => {
        return users.find(u => u.id === userId);
    };

    return (
        <div className="flex flex-col md:flex-row gap-4 bg-slate-900/40 p-3 md:p-4 rounded-xl border border-white/5 mt-4">
            {/* Left Box: Chat History */}
            <div className="flex-1 flex flex-col h-[350px] md:h-[450px]">
                 <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex-shrink-0">
                    NỘI DUNG TRAO ĐỔI / CHAT ({task.comments?.length || 0})
                 </div>
                 
                 <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 flex flex-col">
                    {task.comments && task.comments.length > 0 ? (
                        task.comments.map(comment => {
                            const isMine = comment.userId === currentUser?.uid;
                            const commentUser = getUserDetails(comment.userId);
                            return (
                                <div key={comment.id} className={clsx("flex flex-col max-w-[85%]", isMine ? "self-end items-end" : "self-start items-start")}>
                                    {!isMine && (
                                        <div className="text-[10px] text-slate-400 mb-1 ml-1 font-medium flex items-center gap-2">
                                            {commentUser?.avatar ? (
                                                <img src={commentUser.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-white">
                                                    {commentUser?.name?.charAt(0) || '?'}
                                                </div>
                                            )}
                                            {commentUser?.name || 'Unknown'}
                                        </div>
                                    )}
                                    
                                    <div className={clsx(
                                        "px-3 py-2 rounded-2xl whitespace-pre-wrap break-words text-sm",
                                        isMine ? "bg-indigo-600/90 text-white rounded-br-sm shadow-md shadow-indigo-900/20" : "bg-slate-800 border border-white/5 text-slate-200 rounded-bl-sm"
                                    )}>
                                        {comment.text}
                                        
                                        {/* Display attachments */}
                                        {comment.attachments && comment.attachments.length > 0 && (
                                            <div className="mt-2 flex flex-col gap-1">
                                                {comment.attachments.map((att, i) => (
                                                    att.type === 'image' ? (
                                                        <a key={i} href={att.url} target="_blank" rel="noreferrer" className="block mt-1">
                                                            <img src={att.url} alt="attachment" className="max-w-full rounded-lg border border-white/10 max-h-48 object-cover cursor-zoom-in" />
                                                        </a>
                                                    ) : (
                                                        <a key={i} href={att.url} target="_blank" rel="noreferrer" className={clsx("flex items-center gap-2 text-xs p-2 rounded truncate max-w-full transition-colors", isMine ? "bg-indigo-950/40 hover:bg-indigo-950/60" : "bg-black/20 hover:bg-black/40")}>
                                                            <Paperclip size={12} className="flex-shrink-0"/> 
                                                            <span className="truncate">{att.name}</span>
                                                        </a>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className={clsx("text-[9px] text-slate-500 mt-1", isMine ? "mr-1" : "ml-1")}>
                                        {new Date(comment.timestamp).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex-1 flex items-center justify-center flex-col text-slate-500 italic text-sm">
                            <span className="mb-2 text-3xl opacity-50">💬</span>
                            Chưa có bình luận nào
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                 </div>
            </div>

            {/* Right Box: Chat Input Form */}
            <div className="w-full md:w-[320px] flex-shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex-shrink-0">
                    FORM NHẬP NỘI DUNG (CủA BẠN)
                </div>
                
                <div className="flex-1 flex flex-col bg-slate-950/60 rounded-xl border border-white/5 overflow-hidden shadow-inner flex flex-col min-h-[150px]">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Nhập nội dung trao đổi..."
                        className="flex-1 w-full bg-transparent p-3 md:p-4 text-sm text-slate-200 focus:outline-none resize-none custom-scrollbar min-h-[100px]"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    
                    {/* Pending Attachments */}
                    {pendingAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 bg-slate-900 border-t border-white/5 max-h-32 overflow-y-auto">
                            <AnimatePresence>
                            {pendingAttachments.map((att, i) => (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0 }}
                                    key={i} 
                                    className="flex items-center gap-1 bg-slate-800 border border-white/10 rounded px-2 py-1 relative group"
                                >
                                    <span className="text-[10px] text-slate-300 truncate max-w-[120px]">{att.file.name}</span>
                                    <button 
                                        onClick={() => removePendingAttachment(i)}
                                        className="text-red-400 hover:text-red-300 ml-1 p-0.5 rounded-full hover:bg-black/20"
                                    >
                                        <X size={10} />
                                    </button>
                                </motion.div>
                            ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="flex items-center justify-between p-2 border-t border-white/5 bg-slate-900/40">
                        <div className="flex items-center gap-1">
                            <label className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg cursor-pointer transition-colors relative group">
                                <ImageIcon size={18} />
                                <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleAttachFiles(e, 'image')} disabled={isUploading} />
                                <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[10px] bg-slate-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">Gửi ảnh</span>
                            </label>
                            
                            <label className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg cursor-pointer transition-colors relative group">
                                <Paperclip size={18} />
                                <input type="file" multiple className="hidden" onChange={(e) => handleAttachFiles(e, 'file')} disabled={isUploading} />
                                <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[10px] bg-slate-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">Đính kèm file</span>
                            </label>
                        </div>

                        <button 
                            onClick={handleSend}
                            disabled={isUploading || (!text.trim() && pendingAttachments.length === 0)}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-2 rounded-lg transition-colors shadow-lg shadow-indigo-900/20 disabled:shadow-none flex items-center justify-center min-w-[40px]"
                        >
                            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
                <div className="text-[10px] text-slate-500 text-center mt-3">
                    Nhấn <kbd className="bg-slate-800 px-1 py-0.5 rounded text-slate-400 font-mono text-[9px]">Enter</kbd> để gửi, <kbd className="bg-slate-800 px-1 py-0.5 rounded text-slate-400 font-mono text-[9px]">Shift+Enter</kbd> xuống dòng
                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy, where, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    Loader2, Upload, FileText, BarChart2, Clock, Trophy,
    User as UserIcon, Search, Download, Award, Eye, X
} from 'lucide-react';
import { clsx } from 'clsx';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
interface ConclusionDoc {
    id: string;
    name: string;
    url: string;
    size: number;
    type: string;
    userId: string;
    userName: string;
    uploadedAt: string; // ISO
}

interface Vote {
    id: string;
    voterId: string;
    voterName: string;
    candidateId: string; // Who received the vote
    candidateName: string;
    documentId: string;
    reason: string;
    timestamp: string;
    month: string; // YYYY-MM
}

const ConclusionDocs = () => {
    const { currentUser } = useAuth();
    const { users, addNotification } = useData();
    const [docs, setDocs] = useState<ConclusionDoc[]>([]);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [filterTime, setFilterTime] = useState<'all' | 'day' | 'week' | 'month'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Voting State
    const [showVoteModal, setShowVoteModal] = useState(false);
    const [voteCandidateId, setVoteCandidateId] = useState('');
    const [voteDocId, setVoteDocId] = useState('');
    const [voteReason, setVoteReason] = useState('');

    // Preview State
    const [previewDoc, setPreviewDoc] = useState<ConclusionDoc | null>(null);

    // --- Time Logic for Countdown (End of Month) ---
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const diff = endOfMonth.getTime() - now.getTime();

            if (diff > 0) {
                setTimeLeft({
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((diff / 1000 / 60) % 60),
                    seconds: Math.floor((diff / 1000) % 60)
                });
            }
        };
        const timer = setInterval(calculateTimeLeft, 1000);
        calculateTimeLeft();
        return () => clearInterval(timer);
    }, []);

    // --- Data Fetching ---
    useEffect(() => {
        const qDocs = query(collection(db, 'conclusion_docs'), orderBy('uploadedAt', 'desc'));
        const unsubDocs = onSnapshot(qDocs, (snapshot) => {
            setDocs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConclusionDoc)));
        });

        const currentMonth = new Date().toISOString().slice(0, 7);
        const qVotes = query(collection(db, 'conclusion_votes'), where('month', '==', currentMonth));
        const unsubVotes = onSnapshot(qVotes, (snapshot) => {
            setVotes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vote)));
            setLoading(false);
        });

        return () => { unsubDocs(); unsubVotes(); };
    }, []);

    // --- Derived Stats ---
    const userDocStats = useMemo(() => {
        const stats: Record<string, { count: number, name: string }> = {};
        docs.forEach(d => {
            if (!stats[d.userId]) stats[d.userId] = { count: 0, name: d.userName };
            stats[d.userId].count++;
        });
        return Object.values(stats).sort((a, b) => b.count - a.count);
    }, [docs]);

    const voteStats = useMemo(() => {
        const stats: Record<string, { count: number, name: string }> = {};
        votes.forEach(v => {
            if (!stats[v.candidateId]) stats[v.candidateId] = { count: 0, name: v.candidateName };
            stats[v.candidateId].count++;
        });
        return Object.values(stats).sort((a, b) => b.count - a.count);
    }, [votes]);

    // --- Filtering Docs ---
    const filteredDocs = useMemo(() => {
        let filtered = docs;

        // Search
        if (searchQuery) {
            filtered = filtered.filter(d =>
                d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.userName.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Time Filter
        const now = new Date();
        if (filterTime === 'day') {
            filtered = filtered.filter(d => new Date(d.uploadedAt).toDateString() === now.toDateString());
        } else if (filterTime === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filtered = filtered.filter(d => new Date(d.uploadedAt) > weekAgo);
        } else if (filterTime === 'month') {
            filtered = filtered.filter(d => d.uploadedAt.startsWith(new Date().toISOString().slice(0, 7)));
        }

        return filtered;
    }, [docs, searchQuery, filterTime]);

    // Group by User
    const docsByUser = useMemo(() => {
        const grouped: Record<string, ConclusionDoc[]> = {};
        filteredDocs.forEach(d => {
            if (!grouped[d.userId]) grouped[d.userId] = [];
            grouped[d.userId].push(d);
        });
        return grouped;
    }, [filteredDocs]);

    // --- Handlers ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !currentUser) return;

        const file = e.target.files[0];
        if (!file.name.match(/\.(doc|docx|pdf)$/i)) {
            alert("Chỉ chấp nhận file văn bản (.doc, .docx, .pdf)");
            // Clear input
            e.target.value = '';
            return;
        }

        setUploading(true);
        try {
            const user = users.find(u => u.email === currentUser.email);
            if (!user) throw new Error("User not identified");

            const storageRef = ref(storage, `conclusion-docs/${user.id}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            await addDoc(collection(db, 'conclusion_docs'), {
                name: file.name,
                url: downloadURL,
                size: file.size,
                type: file.type,
                userId: user.id,
                userName: user.name,
                uploadedAt: new Date().toISOString()
            });

            addNotification({
                id: Date.now().toString(),
                title: 'Upload thành công',
                message: `Đã tải lên văn bản: ${file.name}`,
                type: 'success',
                time: 'Vừa xong',
                read: false
            });

        } catch (error) {
            console.error(error);
            alert("Lỗi khi upload file. Vui lòng kiểm tra lại Storage.");
        } finally {
            setUploading(false);
            e.target.value = ''; // Reset input to allow re-upload same file
        }
    };

    const handleVote = async () => {
        if (!currentUser || !voteCandidateId || !voteDocId || !voteReason) {
            alert("Vui lòng nhập đầy đủ thông tin bình chọn!");
            return;
        }

        const user = users.find(u => u.email === currentUser.email);
        const candidate = users.find(u => u.id === voteCandidateId);

        if (!user || !candidate) return;

        const currentMonth = new Date().toISOString().slice(0, 7);
        const existingVote = votes.find(v => v.voterId === user.id);

        if (existingVote) {
            if (!confirm("Bạn đã bình chọn tháng này. Bạn có muốn thay đổi bình chọn không?")) return;
            await deleteDoc(doc(db, 'conclusion_votes', existingVote.id));
        }

        await addDoc(collection(db, 'conclusion_votes'), {
            voterId: user.id,
            voterName: user.name,
            candidateId: candidate.id,
            candidateName: candidate.name,
            documentId: voteDocId,
            reason: voteReason,
            timestamp: new Date().toISOString(),
            month: currentMonth
        });

        setShowVoteModal(false);
        setVoteCandidateId('');
        setVoteDocId('');
        setVoteReason('');

        addNotification({
            id: Date.now().toString(),
            title: 'Bình chọn thành công',
            message: `Bạn đã bình chọn cho ${candidate.name}`,
            type: 'success',
            time: 'Vừa xong',
            read: false
        });
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 size={40} className="text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-6 p-6 overflow-hidden relative">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                        <FileText className="text-indigo-400" /> Văn bản kết luận
                    </h1>
                    <p className="text-slate-400 text-sm">Kho lưu trữ và bình chọn văn bản nhân sự</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowVoteModal(true)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-lg shadow-amber-500/20 font-bold flex items-center gap-2 transition-all"
                    >
                        <Award size={18} /> Bình chọn tháng
                    </button>
                    <label className={clsx("px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 font-bold flex items-center gap-2 transition-all cursor-pointer", uploading && "opacity-50 cursor-not-allowed")}>
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        <span>Upload Văn bản</span>
                        <input type="file" onChange={handleFileUpload} accept=".doc,.docx,.pdf" disabled={uploading} className="hidden" />
                    </label>
                </div>
            </div>

            {/* Top Section: Countdown & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Countdown */}
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Clock size={100} />
                    </div>
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Công bố kết quả sau</h3>
                    <div className="flex items-end gap-4 text-white">
                        <div>
                            <span className="text-4xl font-mono font-bold text-indigo-400">{timeLeft.days}</span>
                            <span className="text-xs text-slate-500 block">Ngày</span>
                        </div>
                        <div className="text-2xl font-bold pb-2">:</div>
                        <div>
                            <span className="text-4xl font-mono font-bold text-indigo-400">{timeLeft.hours.toString().padStart(2, '0')}</span>
                            <span className="text-xs text-slate-500 block">Giờ</span>
                        </div>
                        <div className="text-2xl font-bold pb-2">:</div>
                        <div>
                            <span className="text-4xl font-mono font-bold text-indigo-400">{timeLeft.minutes.toString().padStart(2, '0')}</span>
                            <span className="text-xs text-slate-500 block">Phút</span>
                        </div>
                    </div>
                </div>

                {/* Upload Stats */}
                <div className="glass-panel p-6 rounded-2xl flex flex-col">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                        <BarChart2 size={14} /> Thống kê Upload
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                        {userDocStats.map((stat, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", i === 0 ? "bg-yellow-500 text-black" : "bg-slate-700 text-slate-300")}>
                                        {i + 1}
                                    </div>
                                    <span className="text-slate-200">{stat.name}</span>
                                </div>
                                <span className="font-mono font-bold text-indigo-400">{stat.count} file(s)</span>
                            </div>
                        ))}
                        {userDocStats.length === 0 && <span className="text-slate-500 italic text-xs">Chưa có dữ liệu</span>}
                    </div>
                </div>

                {/* Vote Leaderboard Preview & Chart */}
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Trophy size={14} className="text-amber-500" /> Dẫn đầu bình chọn
                    </h3>

                    <div className="flex-1 h-32 w-full">
                        {voteStats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={voteStats.slice(0, 5)} layout="vertical" margin={{ left: 10, right: 10 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#cbd5e1', fontSize: 10 }} interval={0} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: 'white', fontSize: '12px' }} />
                                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16}>
                                        {voteStats.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#6366f1'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm italic">
                                Chưa có phiếu bầu nào
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Document Browser */}
            <div className="flex-1 glass-panel rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm văn bản..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-900 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:border-indigo-500 outline-none w-64"
                            />
                        </div>
                        <div className="h-6 w-[1px] bg-white/10 mx-2" />
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-white/10">
                            {(['all', 'day', 'week', 'month'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFilterTime(t)}
                                    className={clsx("px-3 py-1 rounded text-xs font-medium capitalize", filterTime === t ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white")}
                                >
                                    {t === 'all' ? 'Tất cả' : t === 'day' ? 'Hôm nay' : t === 'week' ? 'Tuần này' : 'Tháng này'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content Area: Grouped by User */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {Object.keys(docsByUser).length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {Object.entries(docsByUser).map(([userId, userDocs]) => (
                                <div key={userId} className="bg-white/5 border border-white/5 rounded-xl p-4 transition-all hover:bg-white/10 relative group">
                                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
                                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold">
                                            {userDocs[0]?.userName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold">{userDocs[0]?.userName}</h3>
                                            <span className="text-xs text-slate-500">{userDocs.length} tài liệu</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                        {userDocs.map(doc => (
                                            <div
                                                key={doc.id}
                                                className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/30 transition-all group/doc"
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                                                    <FileText size={20} className="text-blue-400 shrink-0" />
                                                    <div className="truncate">
                                                        <div className="text-sm text-slate-200 truncate pr-2 font-medium">{doc.name}</div>
                                                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                            <span>{(doc.size / 1024).toFixed(1)} KB</span>
                                                            <span>•</span>
                                                            <span>{new Date(doc.uploadedAt).toLocaleString('vi-VN')}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 opacity-0 group-hover/doc:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setPreviewDoc(doc)}
                                                        className="p-1.5 hover:bg-white/10 rounded-lg text-indigo-400 hover:text-white"
                                                        title="Xem trước"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <a
                                                        href={doc.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                                                        title="Tải xuống"
                                                    >
                                                        <Download size={16} />
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p>Không tìm thấy văn bản nào</p>
                        </div>
                    )}
                </div>
            </div>

            {/* VOTE MODAL */}
            <AnimatePresence>
                {showVoteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#1e293b] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-amber-900/20 to-orange-900/20">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Award className="text-amber-500" /> Bình chọn Văn bản hay nhất
                                </h2>
                                <p className="text-slate-400 text-sm mt-1">Vinh danh đóng góp của đồng nghiệp tháng {new Date().getMonth() + 1}</p>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-300">Bạn là ai? <span className="text-slate-500">(Tự động)</span></label>
                                    <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-slate-300 flex items-center gap-2">
                                        <UserIcon size={16} /> {users.find(u => u.email === currentUser?.email)?.name || 'Unknown'}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-indigo-300 font-semibold">Bạn bình chọn cho ai?</label>
                                    <select
                                        value={voteCandidateId}
                                        onChange={(e) => {
                                            setVoteCandidateId(e.target.value);
                                            setVoteDocId(''); // Reset doc when user changes
                                        }}
                                        className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"
                                    >
                                        <option value="">-- Chọn Nhân sự --</option>
                                        {users.filter(u => u.email !== currentUser?.email).map(u => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.dept})</option>
                                        ))}
                                    </select>
                                </div>

                                {voteCandidateId && (
                                    <div className="space-y-2">
                                        <label className="text-sm text-indigo-300 font-semibold">Đâu là văn bản hay nhất?</label>
                                        <select
                                            value={voteDocId}
                                            onChange={(e) => setVoteDocId(e.target.value)}
                                            className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500"
                                        >
                                            <option value="">-- Chọn Văn bản --</option>
                                            {(docsByUser[voteCandidateId] || []).map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                        {(docsByUser[voteCandidateId] || []).length === 0 && (
                                            <p className="text-xs text-red-400 italic">User này chưa có văn bản nào.</p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm text-indigo-300 font-semibold">Lý do bình chọn</label>
                                    <textarea
                                        value={voteReason}
                                        onChange={(e) => setVoteReason(e.target.value)}
                                        className="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-white outline-none focus:border-indigo-500 h-24 resize-none"
                                        placeholder="Nhập lý do bình chọn của bạn..."
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t border-white/10 bg-black/20 flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowVoteModal(false)}
                                    className="px-4 py-2 hover:bg-white/10 rounded-lg text-slate-300 text-sm font-medium transition-colors"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    onClick={handleVote}
                                    className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-lg shadow-amber-500/20 font-bold text-sm transition-all"
                                >
                                    Gửi bình chọn
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PREVIEW MODAL */}
            <AnimatePresence>
                {previewDoc && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-0 md:p-8"
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setPreviewDoc(null)}
                            className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            className="w-full h-full bg-[#1e293b] rounded-xl overflow-hidden shadow-2xl relative"
                        >
                            {/* Toolbar in Preview */}
                            <div className="h-12 bg-slate-900 border-b border-white/10 flex items-center justify-between px-4">
                                <span className="text-white font-medium truncate max-w-sm">{previewDoc.name}</span>
                                <a
                                    href={previewDoc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-400 hover:text-white text-sm flex items-center gap-1"
                                >
                                    <Download size={14} /> Tải xuống gốc
                                </a>
                            </div>

                            {/* Viewer */}
                            <div className="h-[calc(100%-48px)] w-full bg-slate-100">
                                {previewDoc.name.toLowerCase().endsWith('.pdf') ? (
                                    <iframe
                                        src={previewDoc.url}
                                        className="w-full h-full"
                                        title="PDF Viewer"
                                    />
                                ) : (
                                    <iframe
                                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewDoc.url)}&embedded=true`}
                                        className="w-full h-full"
                                        title="Document Viewer"
                                    />
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ConclusionDocs;

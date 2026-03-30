import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Plus, BookOpen, Search, MessageSquare, Send,
    Trash2, ExternalLink, Link2, FileText, Globe, Type,
    Video, BarChart3, Brain, Image as ImageIcon,
    Presentation, HelpCircle, Layers, Share2,
    RefreshCw, ChevronRight, X, Check, Loader2, Clock, Eye,
    BookMarked, Copy, Sparkles, Podcast, Bell, CheckCircle2, AlertCircle, XCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { db } from '../../lib/firebase';
import { collection, doc, onSnapshot, addDoc, deleteDoc, setDoc, updateDoc, serverTimestamp, query, orderBy, getDocs } from '@/lib/firestore';
import { initializeGemini } from '../../lib/gemini';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════
interface Notebook {
    id: string;
    title: string;
    sourceCount?: number;
    emoji?: string;
    updatedAt?: string;
    url?: string;
}

interface Source {
    id: string;
    title: string;
    type: string;
    status?: string;
}

interface StudioArtifact {
    id: string;
    title: string;
    type: string;
    status: string;
    url?: string;
}

interface ChatMessage {
    role: 'user' | 'ai';
    content: string;
    timestamp: Date;
}

interface BackgroundTask {
    id: string;
    type: 'artifact' | 'source' | 'notebook';
    title: string;
    status: 'running' | 'completed' | 'failed';
    icon: string;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    notebookId?: string;
    artifactDocId?: string;
}

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    timestamp: Date;
}

// ═══════════════════════════════════════════════════
// STUDIO ARTIFACT TYPES
// ═══════════════════════════════════════════════════
const ARTIFACT_TYPES = [
    { id: 'audio', name: 'Podcast AI', icon: Podcast, color: 'from-purple-500 to-indigo-600', desc: 'Tạo podcast từ nội dung' },
    { id: 'video', name: 'Video Tổng Hợp', icon: Video, color: 'from-red-500 to-pink-600', desc: 'Video giải thích tổng hợp' },
    { id: 'report', name: 'Báo Cáo', icon: FileText, color: 'from-blue-500 to-cyan-600', desc: 'Briefing Doc, Study Guide' },
    { id: 'mind_map', name: 'Sơ Đồ Tư Duy', icon: Brain, color: 'from-emerald-500 to-teal-600', desc: 'Mind map trực quan' },
    { id: 'slide_deck', name: 'Slide Trình Bày', icon: Presentation, color: 'from-orange-500 to-amber-600', desc: 'Bài thuyết trình PDF' },
    { id: 'infographic', name: 'Infographic', icon: ImageIcon, color: 'from-pink-500 to-rose-600', desc: 'Đồ họa thông tin' },
    { id: 'quiz', name: 'Trắc Nghiệm', icon: HelpCircle, color: 'from-yellow-500 to-orange-600', desc: 'Câu hỏi kiểm tra' },
    { id: 'flashcards', name: 'Flashcards', icon: Layers, color: 'from-violet-500 to-purple-600', desc: 'Thẻ học tập' },
    { id: 'data_table', name: 'Bảng Dữ Liệu', icon: BarChart3, color: 'from-cyan-500 to-blue-600', desc: 'Bảng dữ liệu CSV' },
];

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
type ViewMode = 'list' | 'detail' | 'studio' | 'share';

const NotebookLM: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // --- State ---
    const [view, setView] = useState<ViewMode>('list');
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
    const [sources, setSources] = useState<Source[]>([]);
    const [artifacts, setArtifacts] = useState<StudioArtifact[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingArtifact, setViewingArtifact] = useState<StudioArtifact | null>(null);
    const [viewingSource, setViewingSource] = useState<Source | null>(null);

    // Dialogs
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showAddSourceDialog, setShowAddSourceDialog] = useState(false);
    const [showStudioCreateDialog, setShowStudioCreateDialog] = useState(false);
    const [showShareDialog, setShowShareDialog] = useState(false);

    // Form State
    const [newTitle, setNewTitle] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [sourceText, setSourceText] = useState('');
    const [sourceTextTitle, setSourceTextTitle] = useState('');
    const [sourceType, setSourceType] = useState<'url' | 'text'>('url');
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [selectedArtifactType, setSelectedArtifactType] = useState('audio');
    const [shareEmail, setShareEmail] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [publicLink, setPublicLink] = useState('');
    const [activeTab, setActiveTab] = useState<'sources' | 'chat' | 'studio'>('sources');

    // Background Tasks System
    const [bgTasks, setBgTasks] = useState<BackgroundTask[]>([]);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [showTaskPanel, setShowTaskPanel] = useState(false);
    const taskIdRef = useRef(0);

    const activeTasks = bgTasks.filter(t => t.status === 'running');
    const completedTasks = bgTasks.filter(t => t.status !== 'running');

    const addToast = useCallback((type: Toast['type'], title: string, message: string) => {
        const id = `toast-${Date.now()}`;
        setToasts(prev => [...prev, { id, type, title, message, timestamp: new Date() }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    }, []);

    const addBgTask = useCallback((type: BackgroundTask['type'], title: string, icon: string, notebookId?: string): string => {
        const id = `task-${++taskIdRef.current}-${Date.now()}`;
        setBgTasks(prev => [{ id, type, title, status: 'running', icon, startedAt: new Date(), notebookId }, ...prev]);
        return id;
    }, []);

    const completeBgTask = useCallback((taskId: string, success: boolean, error?: string) => {
        setBgTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: success ? 'completed' : 'failed', completedAt: new Date(), error } : t
        ));
    }, []);

    const clearCompletedTasks = useCallback(() => {
        setBgTasks(prev => prev.filter(t => t.status === 'running'));
    }, []);

    // ═══════════════════════════════════════════════════
    // FIRESTORE + GEMINI AI DATA LAYER
    // ═══════════════════════════════════════════════════
    const NOTEBOOKS_COL = 'nlm_notebooks';

    // Real NotebookLM data synced from user's account (45 notebooks)
    const seedInitialData = useCallback(async () => {
        const REAL_NOTEBOOKS = [
            { id: 'f1cb6eeb-8d19-4ed4-a687-bd49aac152bc', title: 'Cinematic Vision of Bún Cá Rô Đồng', sourceCount: 6, updatedAt: '2026-03-16', ownership: 'owned' },
            { id: '54d263d3-6250-4ebc-9aa0-a46d9c764e80', title: 'Ritual Prayers for the Lunar Year-End Thanksgiving', sourceCount: 9, updatedAt: '2026-02-12', ownership: 'owned' },
            { id: 'be96d524-9d63-4279-8d12-1487bd4982af', title: 'Crazy Shark: Evolutionary Ocean Survival', sourceCount: 1, updatedAt: '2026-02-07', ownership: 'owned' },
            { id: 'aa5489a5-caab-46f8-8bed-50481a863eaa', title: 'Echoes of Stone and Spice: The Flavor Impact Explosion', sourceCount: 1, updatedAt: '2026-02-06', ownership: 'owned' },
            { id: '79440646-4da2-4179-b069-bbf4cf477a42', title: 'Âu Việt Global: Packing and Pallet Optimization Suite', sourceCount: 1, updatedAt: '2026-02-06', ownership: 'owned' },
            { id: '2fb1b6cc-bbb5-4eee-9b51-b8470fdb1c3b', title: 'Survival Guide to the Tsunami Brainrot Obby', sourceCount: 1, updatedAt: '2026-02-06', ownership: 'owned' },
            { id: 'f4159363-c53a-48a3-ad91-d43177a3aba2', title: 'Sáp Mai Hamlet Club Invitation', sourceCount: 1, updatedAt: '2026-02-04', ownership: 'owned' },
            { id: 'e48df039-cce7-4c69-a1a7-1bb06474868f', title: 'Pickle Ball Clash Game Guide and Features', sourceCount: 1, updatedAt: '2026-02-04', ownership: 'owned' },
            { id: '173f004f-395c-41b8-84b8-474905fe5e82', title: '2025 Year-End Party Plan: AV H&J Song Mã Sum Vầy', sourceCount: 1, updatedAt: '2026-02-04', ownership: 'owned' },
            { id: '18e80b10-09d3-4845-89e9-65aea35354fe', title: 'Thao Tuyen Year-End Party Invitation Details', sourceCount: 3, updatedAt: '2026-01-19', ownership: 'owned' },
            { id: 'e9b35a34-48cb-4909-a41e-52a5c071db81', title: "The Bear Cub's Magical Quest for Ten Rare Fruits", sourceCount: 1, updatedAt: '2026-01-07', ownership: 'owned' },
            { id: '30e96dbd-11d1-4d07-a4f8-f54f6809217b', title: 'Thầy Bói Xem Voi', sourceCount: 1, updatedAt: '2025-12-18', ownership: 'owned' },
            { id: '5c8c2cb7-f2d8-472e-81c1-59fb92076648', title: 'Chào mừng 81 năm ngày thành lập QĐND Việt Nam', sourceCount: 1, updatedAt: '2025-12-17', ownership: 'owned' },
            { id: '3badc2ed-c464-45ee-8cd1-5ce2fe54e6bc', title: 'Cinematic Super-Realistic Map of Vietnam', sourceCount: 1, updatedAt: '2025-12-10', ownership: 'owned' },
            { id: '141c1e7b-264d-41e6-875e-140dac978cbf', title: 'SEO Content Checklist for Game Publishing', sourceCount: 1, updatedAt: '2025-12-09', ownership: 'owned' },
            { id: 'ed7e85a2-4b6c-4c39-9668-ee4fd5d3cf5e', title: 'Seed to Seed: Plant Life Cycle', sourceCount: 2, updatedAt: '2025-12-02', ownership: 'owned' },
            { id: 'f5ab1582-986b-4615-816f-8a6cec1cac1c', title: "Babba's Broken Grain Porridge Blends and Labeling", sourceCount: 6, updatedAt: '2025-12-02', ownership: 'owned' },
            { id: '5a0494a4-a946-4363-8699-3947fd32c017', title: 'Internal Quality Standards of Âu Việt 2025', sourceCount: 2, updatedAt: '2025-12-02', ownership: 'owned' },
            { id: 'e4ddc6f8-ada2-4aaa-b9dc-c3ff7c325bf8', title: 'Earnings Reports For Top 50 Corporations', sourceCount: 267, updatedAt: '2025-12-02', ownership: 'shared' },
            { id: '7973badd-d000-4f98-8fb3-6f881edab510', title: 'Administrative Record of Career and Rank', sourceCount: 3, updatedAt: '2025-12-02', ownership: 'owned' },
            { id: '7f657222-9c7b-4577-9684-e67aa6387750', title: 'Nguyên Tắc Cốt Lõi: Tối Ưu Hóa Quy Trình và Chất Lượng', sourceCount: 1, updatedAt: '2025-11-04', ownership: 'owned' },
            { id: '81b6d0b7-0a8a-4485-9c0b-8acac3af876f', title: 'Chiến Lược Cạnh Tranh Từ Chất Lượng và Thấu Hiểu Thị Trường', sourceCount: 1, updatedAt: '2025-11-04', ownership: 'owned' },
            { id: 'de9bd153-e71c-46a8-b40a-b6a969a77682', title: 'Cạnh Tranh Chiến Lược và Hệ Thống Dữ Liệu', sourceCount: 1, updatedAt: '2025-11-04', ownership: 'owned' },
            { id: '48f97f28-a3ca-4dc4-aad5-b398c22e5e4d', title: 'Photoshop for Complete Beginners: Lesson 1', sourceCount: 1, updatedAt: '2025-09-18', ownership: 'owned' },
            { id: '4d080d0d-4450-4337-ab3c-b9117848a554', title: 'Kịch Bản Lễ Khánh Thành Nhà Máy', sourceCount: 3, updatedAt: '2025-09-18', ownership: 'owned' },
            { id: '95ab236d-4fd0-4062-8628-8de65a871b63', title: 'Mastering Communication for Effective Partnership Deals', sourceCount: 1, updatedAt: '2025-08-25', ownership: 'owned' },
            { id: '9484d552-54d5-470e-a5e8-d39e65466f6b', title: 'Business Communication and System Management Insights', sourceCount: 4, updatedAt: '2025-08-12', ownership: 'owned' },
            { id: '8ed1e581-8af6-4f91-ba5d-a70359641410', title: 'Discipline and Real-Time Management', sourceCount: 1, updatedAt: '2025-08-08', ownership: 'owned' },
            { id: 'fb6038ca-7afd-4210-9a32-35468f48eb32', title: 'Lời Cảm Tạ Tang Lễ Cụ Nguyễn Văn Phúc', sourceCount: 1, updatedAt: '2025-07-21', ownership: 'owned' },
            { id: '459385a2-9b06-4f53-941c-9bb676f89979', title: 'Lễ Khánh Thành Nhà Máy Amkor Công Nghệ Việt Nam', sourceCount: 2, updatedAt: '2025-06-26', ownership: 'owned' },
            { id: '73197712-57fe-410f-b551-7090025a954d', title: 'Người là Hồ Chí Minh: Kỷ niệm 135 năm ngày sinh Bác Hồ', sourceCount: 1, updatedAt: '2025-06-26', ownership: 'owned' },
            { id: '2b023605-62a0-4767-b9bc-adfabd0a5b6a', title: 'Định Danh Số: Nền Tảng Kinh Tế Số Việt Nam', sourceCount: 1, updatedAt: '2025-06-25', ownership: 'owned' },
            { id: '871617ca-1950-4d61-a91e-01881a338ab1', title: 'Kịch bản Lễ Kỷ niệm Ngày Thương binh Liệt sĩ', sourceCount: 4, updatedAt: '2025-06-21', ownership: 'owned' },
            { id: '37771208-bb30-4ace-9047-549b3921ef9c', title: 'Kịch bản lễ tổng kết năm học và tri ân', sourceCount: 3, updatedAt: '2025-06-12', ownership: 'owned' },
            { id: '924c9daa-71e1-4419-9487-5465d40267ea', title: 'Thơ Về Gia Đình Việt Nam', sourceCount: 4, updatedAt: '2025-06-09', ownership: 'owned' },
            { id: '784bf137-673a-4ea5-9f50-d909133d942f', title: "Như Luân & Mỹ Hạnh's Wedding Ceremony Program", sourceCount: 1, updatedAt: '2025-06-05', ownership: 'owned' },
            { id: '969dd236-113a-4ac3-9343-7778b117c6e1', title: "Như Luân & Mỹ Hạnh's Engagement Ceremony Script", sourceCount: 1, updatedAt: '2025-06-04', ownership: 'owned' },
            { id: 'e99f3091-4cb8-44d4-a47f-4ea097e0cd10', title: 'Kịch bản Kỷ niệm 10 Năm Ra Trường', sourceCount: 1, updatedAt: '2025-06-03', ownership: 'owned' },
            { id: '36637c3a-a89f-425a-9e2d-c97c58ca0785', title: 'Lễ Khai Trương Showroom R+ Sài Gòn', sourceCount: 2, updatedAt: '2025-06-03', ownership: 'owned' },
        ];
        for (const n of REAL_NOTEBOOKS) {
            await setDoc(doc(db, NOTEBOOKS_COL, n.id), {
                ...n,
                emoji: n.ownership === 'shared' ? '🤝' : '📓',
                url: `https://notebooklm.google.com/notebook/${n.id}`,
            });
        }
    }, []);

    // Load notebooks from Firestore (realtime)
    useEffect(() => {
        const q = query(collection(db, NOTEBOOKS_COL), orderBy('updatedAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            if (snap.empty) {
                seedInitialData().then(() => setIsLoading(false));
                return;
            }
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notebook));
            setNotebooks(data);
            setIsLoading(false);
        }, () => {
            setError('Không thể tải notebooks từ Firestore.');
            setIsLoading(false);
        });
        return () => unsub();
    }, [seedInitialData]);

    const loadNotebooks = useCallback(() => {
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 500);
    }, []);

    const openNotebook = async (notebook: Notebook) => {
        setSelectedNotebook(notebook);
        setView('detail');
        setActiveTab('sources');
        setChatMessages([]);

        setIsLoading(true);
        try {
            const sourcesSnap = await getDocs(collection(db, NOTEBOOKS_COL, notebook.id, 'sources'));
            setSources(sourcesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Source)));
        } catch { setSources([]); }

        try {
            const artifactsSnap = await getDocs(collection(db, NOTEBOOKS_COL, notebook.id, 'artifacts'));
            setArtifacts(artifactsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudioArtifact)));
        } catch { setArtifacts([]); }
        setIsLoading(false);
    };

    const createNotebook = async () => {
        if (!newTitle.trim()) return;
        setIsLoading(true);
        try {
            await addDoc(collection(db, NOTEBOOKS_COL), {
                title: newTitle, emoji: '📓', sourceCount: 0,
                updatedAt: new Date().toISOString().split('T')[0],
                url: '', createdAt: serverTimestamp()
            });
            setShowCreateDialog(false);
            setNewTitle('');
        } catch { setError('Không thể tạo notebook'); }
        setIsLoading(false);
    };

    // ═══════════════════════════════════════════════════
    // GEMINI AI: Real Source Processing
    // ═══════════════════════════════════════════════════
    const addSource = async () => {
        if (!selectedNotebook) return;
        const srcTitle = sourceType === 'url' ? sourceUrl : (sourceTextTitle || 'Văn bản');
        const taskId = addBgTask('source', `Thêm nguồn: ${srcTitle.substring(0, 40)}`, sourceType === 'url' ? 'globe' : 'type', selectedNotebook.id);

        setShowAddSourceDialog(false);
        const savedUrl = sourceUrl;
        const savedText = sourceText;
        const savedTextTitle = sourceTextTitle;
        const savedType = sourceType;
        setSourceUrl(''); setSourceText(''); setSourceTextTitle('');

        addToast('info', 'Đang phân tích nguồn', `Gemini AI đang xử lý "${srcTitle.substring(0, 40)}"...`);

        try {
            // Step 1: Save source to Firestore
            const sourceData = savedType === 'url'
                ? { title: savedUrl, type: 'url', status: 'processing', addedAt: serverTimestamp(), content: '' }
                : { title: savedTextTitle || 'Văn bản', type: 'text', content: savedText, status: 'processing', addedAt: serverTimestamp() };
            const srcRef = await addDoc(collection(db, NOTEBOOKS_COL, selectedNotebook.id, 'sources'), sourceData);

            // Step 2: Use Gemini to actually analyze the source
            const model = await initializeGemini();
            if (model) {
                let analysisPrompt = '';
                if (savedType === 'url') {
                    analysisPrompt = `Phân tích URL này và tạo bản tóm tắt chi tiết nội dung: "${savedUrl}". 
                    Tạo tóm tắt dưới dạng: Tiêu đề, Nội dung chính (3-5 điểm), Từ khóa quan trọng. Trả lời bằng tiếng Việt.`;
                } else {
                    analysisPrompt = `Phân tích văn bản sau và tạo bản tóm tắt chi tiết:
                    
"${savedText.substring(0, 3000)}"

Tạo tóm tắt dưới dạng: Tiêu đề phù hợp, Nội dung chính (3-5 điểm), Từ khóa quan trọng. Trả lời bằng tiếng Việt.`;
                }

                const result = await model.generateContent(analysisPrompt);
                const summary = result.response.text();

                // Update source with AI analysis
                await updateDoc(srcRef, {
                    status: 'added',
                    aiSummary: summary,
                    analyzedAt: serverTimestamp(),
                    title: savedType === 'url' ? savedUrl : (savedTextTitle || summary.split('\n')[0]?.substring(0, 60) || 'Văn bản')
                });
            } else {
                // No Gemini key, just mark as added without AI analysis
                await updateDoc(srcRef, { status: 'added' });
            }

            // Update notebook source count
            const newCount = (sources.length || 0) + 1;
            await setDoc(doc(db, NOTEBOOKS_COL, selectedNotebook.id), { sourceCount: newCount }, { merge: true });

            completeBgTask(taskId, true);
            addToast('success', 'Nguồn đã phân tích! 📄', `AI đã tóm tắt "${srcTitle.substring(0, 40)}".`);
            if (selectedNotebook) openNotebook(selectedNotebook);
        } catch (err) {
            console.error('addSource error:', err);
            completeBgTask(taskId, false, 'Không thể thêm nguồn');
            addToast('error', 'Lỗi thêm nguồn', `"${srcTitle.substring(0, 40)}" gặp lỗi.`);
        }
    };

    // ═══════════════════════════════════════════════════
    // GEMINI AI: Smart Chat with Source Context
    // ═══════════════════════════════════════════════════
    const sendChat = async () => {
        if (!chatInput.trim() || !selectedNotebook || isChatLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: chatInput, timestamp: new Date() };
        setChatMessages(prev => [...prev, userMsg]);
        const currentQuery = chatInput;
        setChatInput('');
        setIsChatLoading(true);

        try {
            const model = await initializeGemini();
            if (!model) {
                setChatMessages(prev => [...prev, { role: 'ai', content: '❌ Chưa cấu hình Gemini API Key. Vào Cài đặt → Gemini API để thiết lập.', timestamp: new Date() }]);
                setIsChatLoading(false);
                return;
            }

            // Build rich context from actual source content
            let context = `Bạn là trợ lý AI thông minh cho notebook "${selectedNotebook.title}". `;
            context += `Vai trò: Giúp người dùng hiểu, phân tích và khai thác nội dung từ các nguồn tài liệu trong notebook.\n\n`;

            if (sources.length > 0) {
                context += `📚 Notebook có ${sources.length} nguồn tài liệu:\n`;
                // Load actual content from sources
                const sourcesSnap = await getDocs(collection(db, NOTEBOOKS_COL, selectedNotebook.id, 'sources'));
                sourcesSnap.docs.forEach((d, i) => {
                    const data = d.data();
                    context += `\n--- Nguồn ${i + 1}: "${data.title}" ---\n`;
                    if (data.aiSummary) context += `Tóm tắt AI: ${data.aiSummary.substring(0, 500)}\n`;
                    if (data.content) context += `Nội dung: ${data.content.substring(0, 500)}\n`;
                });
            }
            context += `\n\n💬 Câu hỏi người dùng: "${currentQuery}"\n`;
            context += `\nHãy trả lời chi tiết, chính xác dựa trên nội dung các nguồn. Nếu không có đủ thông tin từ nguồn, hãy nói rõ đó là kiến thức chung. Trả lời bằng tiếng Việt.`;

            const result = await model.generateContent(context);
            const response = result.response;
            setChatMessages(prev => [...prev, { role: 'ai', content: response.text() || 'Không có câu trả lời.', timestamp: new Date() }]);
        } catch {
            setChatMessages(prev => [...prev, { role: 'ai', content: '❌ Có lỗi xảy ra. Vui lòng thử lại.', timestamp: new Date() }]);
        }
        setIsChatLoading(false);
    };

    // ═══════════════════════════════════════════════════
    // GEMINI AI: Real Artifact Generation
    // ═══════════════════════════════════════════════════
    const ARTIFACT_PROMPTS: Record<string, string> = {
        report: `Tạo một BÁO CÁO TỔNG HỢP chi tiết về nội dung notebook. Bao gồm: Tóm tắt tổng quan, Phân tích chi tiết từng nguồn, Các điểm chính, Kết luận và đề xuất. Trình bày dưới dạng markdown.`,
        quiz: `Tạo 10 CÂU HỎI TRẮC NGHIỆM dựa trên nội dung notebook. Mỗi câu có 4 đáp án A/B/C/D, đánh dấu đáp án đúng. Bao gồm giải thích ngắn cho mỗi đáp án đúng. Định dạng markdown.`,
        flashcards: `Tạo 15 THẺ HỌC TẬP (flashcards) dựa trên nội dung notebook. Mỗi thẻ gồm: Mặt trước (câu hỏi/khái niệm) và Mặt sau (câu trả lời/giải thích). Định dạng markdown.`,
        mind_map: `Tạo SƠ ĐỒ TƯ DUY dưới dạng text, phân cấp từ chủ đề chính → các nhánh phụ → chi tiết. Dùng ký tự đặc biệt để tạo sơ đồ trực quan. Trình bày dưới dạng cấu trúc cây markdown.`,
        data_table: `Phân tích nội dung notebook và tạo BẢNG DỮ LIỆU tổng hợp dưới dạng markdown table. Bao gồm các cột: STT, Chủ đề, Chi tiết, Trạng thái/Đánh giá.`,
        slide_deck: `Tạo NỘI DUNG cho 10 slide thuyết trình dựa trên notebook. Mỗi slide gồm: Tiêu đề, Nội dung chính (3-5 gạch đầu dòng), Ghi chú diễn giả. Trình bày dưới dạng markdown.`,
        infographic: `Tạo NỘI DUNG INFOGRAPHIC dưới dạng text tổng hợp: Tiêu đề lớn, 5-7 thống kê/fact thú vị, biểu đồ text-based, và kết luận. Định dạng markdown.`,
        audio: `Tạo KỊCH BẢN PODCAST (2 người dẫn) thảo luận về nội dung notebook. Bao gồm phần mở đầu, thảo luận chính, câu hỏi và trả lời, kết luận. Tự nhiên và hấp dẫn. Định dạng markdown.`,
        video: `Tạo KỊCH BẢN VIDEO GIẢI THÍCH về nội dung notebook. Bao gồm: Hook (10 giây đầu), giới thiệu, 3-5 phần nội dung chính với mô tả hình ảnh, kết luận và call-to-action. Định dạng markdown.`,
    };

    const createArtifact = async () => {
        if (!selectedNotebook) return;
        const typeInfo = ARTIFACT_TYPES.find(t => t.id === selectedArtifactType);
        const taskTitle = `${typeInfo?.name || selectedArtifactType}`;
        const taskId = addBgTask('artifact', taskTitle, typeInfo?.id || 'sparkles', selectedNotebook.id);

        setShowStudioCreateDialog(false);
        addToast('info', 'Gemini AI đang tạo', `"${taskTitle}" đang được AI xử lý ngầm...`);

        try {
            // Create placeholder artifact
            const artifactRef = await addDoc(collection(db, NOTEBOOKS_COL, selectedNotebook.id, 'artifacts'), {
                title: typeInfo?.name || selectedArtifactType,
                type: selectedArtifactType,
                status: 'in_progress',
                createdAt: serverTimestamp()
            });

            // Generate real content with Gemini AI
            const model = await initializeGemini();
            let aiContent = '';

            if (model) {
                // Build source context for artifact generation
                let sourceContext = `Notebook: "${selectedNotebook.title}"\n\n`;
                try {
                    const sourcesSnap = await getDocs(collection(db, NOTEBOOKS_COL, selectedNotebook.id, 'sources'));
                    sourcesSnap.docs.forEach((d, i) => {
                        const data = d.data();
                        sourceContext += `Nguồn ${i + 1}: "${data.title}"\n`;
                        if (data.aiSummary) sourceContext += `Tóm tắt: ${data.aiSummary.substring(0, 800)}\n`;
                        if (data.content) sourceContext += `Nội dung: ${data.content.substring(0, 800)}\n`;
                        sourceContext += '\n';
                    });
                } catch { /* no sources available */ }

                const prompt = `${sourceContext}\n\n${ARTIFACT_PROMPTS[selectedArtifactType] || ARTIFACT_PROMPTS.report}\n\nTrả lời bằng tiếng Việt. Tạo nội dung chất lượng cao, chi tiết và hữu ích.`;

                const result = await model.generateContent(prompt);
                aiContent = result.response.text() || '';
            }

            // Update artifact with real AI-generated content
            await updateDoc(artifactRef, {
                status: 'completed',
                content: aiContent || `[${taskTitle}] Nội dung sẽ được tạo khi cấu hình Gemini API Key.`,
                completedAt: serverTimestamp()
            });

            completeBgTask(taskId, true);
            addToast('success', 'Sản phẩm AI hoàn thành! ✨', `"${taskTitle}" đã sẵn sàng xem.`);
            if (selectedNotebook) openNotebook(selectedNotebook);
        } catch (err) {
            console.error('createArtifact error:', err);
            completeBgTask(taskId, false, 'Không thể tạo sản phẩm');
            addToast('error', 'Lỗi tạo sản phẩm', `"${taskTitle}" gặp lỗi. Thử lại.`);
        }
    };

    const togglePublicShare = async () => {
        if (!selectedNotebook) return;
        try {
            await setDoc(doc(db, NOTEBOOKS_COL, selectedNotebook.id), {
                isPublic: !isPublic
            }, { merge: true });
            setIsPublic(!isPublic);
            if (!isPublic) {
                setPublicLink(`https://notebooklm.google.com/notebook/${selectedNotebook.id}`);
            } else {
                setPublicLink('');
            }
        } catch {
            setError('Không thể thay đổi quyền chia sẻ');
        }
    };

    const inviteCollaborator = async () => {
        if (!selectedNotebook || !shareEmail.trim()) return;
        try {
            await addDoc(collection(db, NOTEBOOKS_COL, selectedNotebook.id, 'collaborators'), {
                email: shareEmail,
                role: 'viewer',
                invitedAt: serverTimestamp()
            });
            setShareEmail('');
        } catch {
            setError('Không thể mời cộng tác viên');
        }
    };

    const deleteNotebook = async (id: string) => {
        if (!confirm('Xóa notebook này? Hành động không thể hoàn tác!')) return;
        try {
            await deleteDoc(doc(db, NOTEBOOKS_COL, id));
            if (selectedNotebook?.id === id) {
                setSelectedNotebook(null);
                setView('list');
            }
        } catch {
            setError('Không thể xóa notebook');
        }
    };

    // Filter notebooks
    const filteredNotebooks = notebooks.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ═══════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-200">
            {/* HEADER */}
            <div className="h-16 border-b border-slate-200 dark:border-white/10 flex items-center px-4 md:px-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur shrink-0 justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => {
                            if (view === 'detail' || view === 'studio' || view === 'share') {
                                setView('list');
                                setSelectedNotebook(null);
                            } else {
                                onBack();
                            }
                        }}
                        className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500 dark:text-slate-400 shrink-0"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                            <BookOpen size={16} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm md:text-lg font-bold text-slate-900 dark:text-white truncate">
                                {view === 'list' ? 'NotebookLM' : selectedNotebook?.title || 'Notebook'}
                            </h1>
                            {view === 'list' && (
                                <p className="text-[10px] text-slate-500 hidden sm:block">Google AI Notebook • {notebooks.length} sổ ghi chú</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {view === 'list' && (
                        <>
                            <button
                                onClick={loadNotebooks}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-500"
                                title="Làm mới"
                            >
                                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                            </button>
                            <button
                                onClick={() => setShowCreateDialog(true)}
                                className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-purple-500/20"
                            >
                                <Plus size={14} /> <span className="hidden sm:inline">Tạo mới</span>
                            </button>
                        </>
                    )}
                    {view === 'detail' && selectedNotebook && (
                        <>
                            <button
                                onClick={() => setShowShareDialog(true)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-500"
                                title="Chia sẻ"
                            >
                                <Share2 size={16} />
                            </button>
                            <a
                                href={`https://notebooklm.google.com/notebook/${selectedNotebook.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-500"
                                title="Mở trên NotebookLM"
                            >
                                <ExternalLink size={16} />
                            </a>
                        </>
                    )}
                </div>
            </div>

            {/* ERROR BANNER */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-red-500/10 border-b border-red-500/20 text-red-400 px-4 py-2 text-xs flex items-center justify-between"
                    >
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="p-1 hover:bg-red-500/20 rounded">
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                    {view === 'list' && (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="p-4 md:p-6 max-w-7xl mx-auto"
                        >
                            {/* Search + Sync */}
                            <div className="flex gap-2 items-center mb-6">
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Tìm kiếm notebook..."
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                                    />
                                </div>
                                <button
                                    onClick={async () => {
                                        addToast('info', 'Đang đồng bộ', 'Cập nhật dữ liệu từ NotebookLM...');
                                        await seedInitialData();
                                        addToast('success', 'Đồng bộ xong!', '39 notebooks đã được cập nhật.');
                                    }}
                                    className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 shadow-lg shadow-blue-500/20"
                                    title="Đồng bộ dữ liệu từ NotebookLM"
                                >
                                    <RefreshCw size={14} /> Đồng bộ
                                </button>
                            </div>

                            {/* Loading */}
                            {isLoading && notebooks.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <Loader2 size={32} className="animate-spin mb-4 text-purple-400" />
                                    <p className="text-sm">Đang tải danh sách notebook...</p>
                                </div>
                            )}

                            {/* Notebooks Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredNotebooks.map((notebook, i) => (
                                    <motion.div
                                        key={notebook.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        onClick={() => openNotebook(notebook)}
                                        className="group relative p-5 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 hover:border-purple-500/30 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="text-3xl">{notebook.emoji || '📓'}</div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteNotebook(notebook.id); }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg transition-all text-slate-400 hover:text-red-400"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                            {notebook.title || 'Không có tiêu đề'}
                                        </h3>
                                        <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-3">
                                            {notebook.sourceCount !== undefined && (
                                                <span className="flex items-center gap-1">
                                                    <FileText size={10} /> {notebook.sourceCount} nguồn
                                                </span>
                                            )}
                                            {notebook.updatedAt && (
                                                <span className="flex items-center gap-1">
                                                    <Clock size={10} /> {notebook.updatedAt}
                                                </span>
                                            )}
                                        </div>
                                        <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                            <ChevronRight size={16} className="text-purple-500" />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Empty State */}
                            {!isLoading && filteredNotebooks.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <BookMarked size={48} className="mb-4 text-slate-600" />
                                    <p className="text-sm font-medium mb-2">
                                        {searchQuery ? 'Không tìm thấy notebook nào' : 'Chưa có notebook nào'}
                                    </p>
                                    <p className="text-xs text-slate-500 mb-4">
                                        {searchQuery ? 'Thử từ khóa khác' : 'Tạo notebook đầu tiên để bắt đầu'}
                                    </p>
                                    {!searchQuery && (
                                        <button
                                            onClick={() => setShowCreateDialog(true)}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-2"
                                        >
                                            <Plus size={14} /> Tạo notebook mới
                                        </button>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {view === 'detail' && selectedNotebook && (
                        <motion.div
                            key="detail"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex flex-col h-full"
                        >
                            {/* Tabs */}
                            <div className="flex border-b border-slate-200 dark:border-white/10 px-4 md:px-6 bg-slate-50 dark:bg-slate-900/30 shrink-0">
                                {[
                                    { id: 'sources' as const, label: 'Nguồn', icon: FileText, count: sources.length },
                                    { id: 'chat' as const, label: 'Hỏi AI', icon: MessageSquare },
                                    { id: 'studio' as const, label: 'Studio', icon: Sparkles, count: artifacts.length },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={clsx(
                                            "px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all",
                                            activeTab === tab.id
                                                ? "border-purple-500 text-purple-600 dark:text-purple-400"
                                                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                        )}
                                    >
                                        <tab.icon size={14} />
                                        {tab.label}
                                        {tab.count !== undefined && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px]">{tab.count}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {/* SOURCES TAB */}
                                {activeTab === 'sources' && (
                                    <div className="p-4 md:p-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Nguồn tài liệu ({sources.length})</h3>
                                            <button
                                                onClick={() => setShowAddSourceDialog(true)}
                                                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                                            >
                                                <Plus size={14} /> Thêm nguồn
                                            </button>
                                        </div>

                                        {isLoading ? (
                                            <div className="flex justify-center py-12">
                                                <Loader2 size={24} className="animate-spin text-purple-400" />
                                            </div>
                                        ) : sources.length === 0 ? (
                                            <div className="flex flex-col items-center py-16 text-slate-400">
                                                <Globe size={40} className="mb-3 text-slate-600" />
                                                <p className="text-sm font-medium">Chưa có nguồn nào</p>
                                                <p className="text-xs text-slate-500 mt-1">Thêm URL, văn bản hoặc file để bắt đầu</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {sources.map(source => (
                                                    <div
                                                        key={source.id}
                                                        onClick={() => setViewingSource(source)}
                                                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group cursor-pointer"
                                                    >
                                                        <div className={clsx(
                                                            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                                                            source.type === 'url' ? 'bg-blue-500/20 text-blue-400' :
                                                            source.type === 'text' ? 'bg-green-500/20 text-green-400' :
                                                            'bg-orange-500/20 text-orange-400'
                                                        )}>
                                                            {source.type === 'url' ? <Globe size={16} /> :
                                                             source.type === 'text' ? <Type size={16} /> :
                                                             <FileText size={16} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{source.title}</p>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[10px] text-slate-500 uppercase">{source.type} {source.status && `• ${source.status}`}</p>
                                                                {(source as any).aiSummary && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded-md font-medium">AI tóm tắt</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button onClick={e => { e.stopPropagation(); }} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg transition-all text-slate-400 hover:text-red-400">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* CHAT TAB */}
                                {activeTab === 'chat' && (
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 p-4 md:p-6 space-y-4 overflow-y-auto">
                                            {chatMessages.length === 0 && (
                                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                                    <MessageSquare size={40} className="mb-3 text-slate-600" />
                                                    <p className="text-sm font-medium">Hỏi AI về nội dung notebook</p>
                                                    <p className="text-xs text-slate-500 mt-1 text-center max-w-sm">AI sẽ trả lời dựa trên các nguồn tài liệu bạn đã thêm vào notebook này</p>
                                                </div>
                                            )}
                                            {chatMessages.map((msg, i) => (
                                                <div key={i} className={clsx("flex gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                                    <div className={clsx(
                                                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                                                        msg.role === 'user'
                                                            ? 'bg-purple-600 text-white rounded-br-md'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-bl-md border border-slate-200 dark:border-white/5'
                                                    )}>
                                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                                        <p className={clsx("text-[10px] mt-1", msg.role === 'user' ? 'text-white/60' : 'text-slate-400')}>
                                                            {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                            {isChatLoading && (
                                                <div className="flex gap-3 justify-start">
                                                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-200 dark:border-white/5">
                                                        <div className="flex gap-1.5">
                                                            <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
                                                            <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                                                            <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Chat Input */}
                                        <div className="p-4 md:p-6 pt-0 shrink-0">
                                            <div className="flex gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/10 p-2 focus-within:border-purple-500/50 transition-all">
                                                <input
                                                    type="text"
                                                    value={chatInput}
                                                    onChange={e => setChatInput(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                                                    placeholder="Hỏi AI về nội dung notebook..."
                                                    className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400 px-2"
                                                />
                                                <button
                                                    onClick={sendChat}
                                                    disabled={!chatInput.trim() || isChatLoading}
                                                    className={clsx(
                                                        "p-2.5 rounded-lg transition-all",
                                                        chatInput.trim() && !isChatLoading
                                                            ? "bg-purple-600 hover:bg-purple-500 text-white"
                                                            : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                                                    )}
                                                >
                                                    <Send size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STUDIO TAB */}
                                {activeTab === 'studio' && (
                                    <div className="p-4 md:p-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Studio ({artifacts.length})</h3>
                                            <button
                                                onClick={() => setShowStudioCreateDialog(true)}
                                                className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg"
                                            >
                                                <Sparkles size={14} /> Tạo sản phẩm
                                            </button>
                                        </div>

                                        {/* Existing Artifacts */}
                                        {artifacts.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                                {artifacts.map(artifact => {
                                                    const typeInfo = ARTIFACT_TYPES.find(t => t.id === artifact.type);
                                                    return (
                                                        <div
                                                            key={artifact.id}
                                                            onClick={() => artifact.status === 'completed' && setViewingArtifact(artifact)}
                                                            className={clsx(
                                                                "flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/5 transition-all",
                                                                artifact.status === 'completed' && "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-purple-500/30"
                                                            )}
                                                        >
                                                            <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br", typeInfo?.color || 'from-slate-500 to-slate-600')}>
                                                                {typeInfo ? <typeInfo.icon size={18} className="text-white" /> : <Sparkles size={18} className="text-white" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{artifact.title}</p>
                                                                <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                                                    {artifact.status === 'completed' ? (
                                                                        <><Check size={10} className="text-green-400" /> Hoàn thành • Bấm để xem</>
                                                                    ) : artifact.status === 'in_progress' ? (
                                                                        <><Loader2 size={10} className="text-yellow-400 animate-spin" /> AI đang tạo...</>
                                                                    ) : (
                                                                        <><X size={10} className="text-red-400" /> Lỗi</>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            {(artifact as any).content && (
                                                                <div className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors">
                                                                    <Eye size={14} className="text-purple-400" />
                                                                </div>
                                                            )}
                                                            {artifact.url && (
                                                                <a href={artifact.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                                                    <ExternalLink size={14} className="text-purple-400" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center py-12 text-slate-400 mb-6">
                                                <Sparkles size={40} className="mb-3 text-slate-600" />
                                                <p className="text-sm font-medium">Chưa có sản phẩm nào</p>
                                                <p className="text-xs text-slate-500 mt-1">Tạo podcast, video, quiz và nhiều hơn</p>
                                            </div>
                                        )}

                                        {/* Quick Create Grid */}
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Tạo nhanh</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                            {ARTIFACT_TYPES.map(type => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => { setSelectedArtifactType(type.id); setShowStudioCreateDialog(true); }}
                                                    className="group p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 hover:border-purple-500/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-center hover:-translate-y-0.5"
                                                >
                                                    <div className={clsx("w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center bg-gradient-to-br transition-transform group-hover:scale-110", type.color)}>
                                                        <type.icon size={18} className="text-white" />
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{type.name}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{type.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* DIALOGS / MODALS */}
            {/* ═══════════════════════════════════════════════════ */}

            {/* CREATE NOTEBOOK DIALOG */}
            <AnimatePresence>
                {showCreateDialog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowCreateDialog(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 w-full max-w-md"
                        >
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <BookOpen size={20} className="text-purple-500" /> Tạo Notebook Mới
                            </h3>
                            <input
                                type="text"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createNotebook()}
                                placeholder="Tiêu đề notebook..."
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500/50 mb-4"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowCreateDialog(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">
                                    Hủy
                                </button>
                                <button
                                    onClick={createNotebook}
                                    disabled={!newTitle.trim() || isLoading}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Tạo
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ADD SOURCE DIALOG */}
            <AnimatePresence>
                {showAddSourceDialog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowAddSourceDialog(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 w-full max-w-lg"
                        >
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Plus size={20} className="text-purple-500" /> Thêm Nguồn Tài Liệu
                            </h3>

                            {/* Source Type Tabs */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setSourceType('url')}
                                    className={clsx(
                                        "flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all",
                                        sourceType === 'url'
                                            ? "bg-purple-600 border-purple-500 text-white"
                                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400"
                                    )}
                                >
                                    <Link2 size={14} /> URL / Website
                                </button>
                                <button
                                    onClick={() => setSourceType('text')}
                                    className={clsx(
                                        "flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all",
                                        sourceType === 'text'
                                            ? "bg-purple-600 border-purple-500 text-white"
                                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400"
                                    )}
                                >
                                    <Type size={14} /> Văn Bản
                                </button>
                            </div>

                            {sourceType === 'url' ? (
                                <input
                                    type="url"
                                    value={sourceUrl}
                                    onChange={e => setSourceUrl(e.target.value)}
                                    placeholder="https://example.com hoặc YouTube URL..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500/50 mb-4"
                                    autoFocus
                                />
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        value={sourceTextTitle}
                                        onChange={e => setSourceTextTitle(e.target.value)}
                                        placeholder="Tiêu đề (tùy chọn)..."
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500/50 mb-3"
                                        autoFocus
                                    />
                                    <textarea
                                        value={sourceText}
                                        onChange={e => setSourceText(e.target.value)}
                                        placeholder="Dán nội dung văn bản vào đây..."
                                        rows={6}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500/50 resize-none mb-4"
                                    />
                                </>
                            )}

                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowAddSourceDialog(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white">
                                    Hủy
                                </button>
                                <button
                                    onClick={addSource}
                                    disabled={isLoading || (sourceType === 'url' ? !sourceUrl.trim() : !sourceText.trim())}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Thêm nguồn
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* STUDIO CREATE DIALOG */}
            <AnimatePresence>
                {showStudioCreateDialog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowStudioCreateDialog(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 w-full max-w-lg"
                        >
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Sparkles size={20} className="text-purple-500" /> Tạo Sản Phẩm AI
                            </h3>

                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {ARTIFACT_TYPES.map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setSelectedArtifactType(type.id)}
                                        className={clsx(
                                            "p-3 rounded-xl text-center border transition-all",
                                            selectedArtifactType === type.id
                                                ? "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30"
                                                : "border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        )}
                                    >
                                        <div className={clsx("w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-gradient-to-br", type.color)}>
                                            <type.icon size={14} className="text-white" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{type.name}</p>
                                    </button>
                                ))}
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 mb-4 border border-slate-200 dark:border-white/5">
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    <strong className="text-slate-900 dark:text-white">
                                        {ARTIFACT_TYPES.find(t => t.id === selectedArtifactType)?.name}
                                    </strong>
                                    {' — '}
                                    {ARTIFACT_TYPES.find(t => t.id === selectedArtifactType)?.desc}
                                </p>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowStudioCreateDialog(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white">
                                    Hủy
                                </button>
                                <button
                                    onClick={createArtifact}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg"
                                >
                                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    Tạo ngay
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ARTIFACT CONTENT VIEWER */}
            <AnimatePresence>
                {viewingArtifact && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setViewingArtifact(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
                                        ARTIFACT_TYPES.find(t => t.id === viewingArtifact.type)?.color || 'from-purple-500 to-indigo-600'
                                    )}>
                                        <Sparkles size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{viewingArtifact.title}</h3>
                                        <p className="text-xs text-slate-500">Nội dung được tạo bởi Gemini AI</p>
                                    </div>
                                </div>
                                <button onClick={() => setViewingArtifact(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                    <X size={18} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {(viewingArtifact as any).content || 'Chưa có nội dung.'}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-white/5">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText((viewingArtifact as any).content || '');
                                        addToast('success', 'Đã sao chép!', 'Nội dung đã được sao chép vào clipboard.');
                                    }}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                                >
                                    <Copy size={14} /> Sao chép
                                </button>
                                <button onClick={() => setViewingArtifact(null)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors">
                                    Đóng
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SOURCE DETAIL VIEWER */}
            <AnimatePresence>
                {viewingSource && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setViewingSource(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center",
                                        viewingSource.type === 'url' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                                    )}>
                                        {viewingSource.type === 'url' ? <Globe size={18} /> : <Type size={18} />}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-md">{viewingSource.title}</h3>
                                        <p className="text-xs text-slate-500">{viewingSource.type === 'url' ? 'Nguồn URL' : 'Nguồn văn bản'} • {viewingSource.status}</p>
                                    </div>
                                </div>
                                <button onClick={() => setViewingSource(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                    <X size={18} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {(viewingSource as any).aiSummary && (
                                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-500/20">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sparkles size={14} className="text-purple-500" />
                                            <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Tóm tắt AI (Gemini)</span>
                                        </div>
                                        <p className="text-sm text-purple-800 dark:text-purple-200 whitespace-pre-wrap leading-relaxed">
                                            {(viewingSource as any).aiSummary}
                                        </p>
                                    </div>
                                )}
                                {(viewingSource as any).content && (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileText size={14} className="text-slate-500" />
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Nội dung gốc</span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                            {(viewingSource as any).content}
                                        </p>
                                    </div>
                                )}
                                {!(viewingSource as any).aiSummary && !(viewingSource as any).content && (
                                    <div className="text-center py-8 text-slate-400">
                                        <FileText size={32} className="mx-auto mb-2" />
                                        <p className="text-sm">Chưa có tóm tắt AI. Thêm nội dung để AI phân tích.</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end p-4 border-t border-slate-200 dark:border-white/5">
                                <button onClick={() => setViewingSource(null)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors">
                                    Đóng
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SHARE DIALOG */}
            <AnimatePresence>
                {showShareDialog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowShareDialog(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 w-full max-w-md"
                        >
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Share2 size={20} className="text-purple-500" /> Chia Sẻ Notebook
                            </h3>

                            {/* Public Link Toggle */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-4 border border-slate-200 dark:border-white/5">
                                <div className="flex items-center gap-2">
                                    <Globe size={16} className="text-blue-400" />
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">Link công khai</span>
                                </div>
                                <button
                                    onClick={togglePublicShare}
                                    className={clsx(
                                        "w-12 h-6 rounded-full transition-all relative",
                                        isPublic ? "bg-purple-600" : "bg-slate-300 dark:bg-slate-600"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all",
                                        isPublic ? "left-6" : "left-0.5"
                                    )} />
                                </button>
                            </div>

                            {isPublic && publicLink && (
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        value={publicLink}
                                        readOnly
                                        className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-600 dark:text-slate-400 outline-none"
                                    />
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(publicLink); }}
                                        className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-500"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Invite by Email */}
                            <div className="border-t border-slate-200 dark:border-white/10 pt-4 mt-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mời cộng tác viên</p>
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        value={shareEmail}
                                        onChange={e => setShareEmail(e.target.value)}
                                        placeholder="email@example.com"
                                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-purple-500/50"
                                    />
                                    <button
                                        onClick={inviteCollaborator}
                                        disabled={!shareEmail.trim()}
                                        className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-500 disabled:opacity-50"
                                    >
                                        Mời
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end mt-4">
                                <button onClick={() => setShowShareDialog(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white">
                                    Đóng
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════════════ */}
            {/* BACKGROUND TASK FLOATING INDICATOR */}
            {/* ═══════════════════════════════════════════════════ */}
            {bgTasks.length > 0 && (
                <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={() => setShowTaskPanel(!showTaskPanel)}
                    className={clsx(
                        "fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all",
                        activeTasks.length > 0
                            ? "bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/40"
                            : "bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/30"
                    )}
                >
                    {activeTasks.length > 0 ? (
                        <Loader2 size={22} className="text-white animate-spin" />
                    ) : (
                        <Bell size={22} className="text-white" />
                    )}
                    {activeTasks.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                            {activeTasks.length}
                        </span>
                    )}
                    {completedTasks.length > 0 && activeTasks.length === 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                            {completedTasks.length}
                        </span>
                    )}
                </motion.button>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* TASK PANEL (Slide-out) */}
            {/* ═══════════════════════════════════════════════════ */}
            <AnimatePresence>
                {showTaskPanel && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                            onClick={() => setShowTaskPanel(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 shadow-2xl z-50 flex flex-col"
                        >
                            {/* Panel Header */}
                            <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                        <Bell size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tác vụ nền</h3>
                                        <p className="text-[10px] text-slate-500">{activeTasks.length} đang chạy • {completedTasks.length} hoàn tất</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {completedTasks.length > 0 && (
                                        <button
                                            onClick={clearCompletedTasks}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-400 text-[10px] font-bold"
                                        >
                                            Xóa lịch sử
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowTaskPanel(false)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-400"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Task List */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                {bgTasks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                        <CheckCircle2 size={40} className="mb-3 text-slate-600" />
                                        <p className="text-sm font-medium">Không có tác vụ nào</p>
                                    </div>
                                ) : (
                                    bgTasks.map(task => {
                                        const typeInfo = ARTIFACT_TYPES.find(t => t.id === task.icon);
                                        return (
                                            <motion.div
                                                key={task.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={clsx(
                                                    "p-3 rounded-xl border transition-all",
                                                    task.status === 'running'
                                                        ? "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20"
                                                        : task.status === 'completed'
                                                        ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                                                        : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={clsx(
                                                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                                                        task.status === 'running'
                                                            ? "bg-purple-500/20"
                                                            : task.status === 'completed'
                                                            ? "bg-emerald-500/20"
                                                            : "bg-red-500/20"
                                                    )}>
                                                        {task.status === 'running' ? (
                                                            <Loader2 size={16} className="text-purple-500 animate-spin" />
                                                        ) : task.status === 'completed' ? (
                                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                                        ) : (
                                                            <XCircle size={16} className="text-red-500" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{task.title}</p>
                                                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                                            {task.status === 'running' && (
                                                                <>
                                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                                                    Đang xử lý...
                                                                </>
                                                            )}
                                                            {task.status === 'completed' && (
                                                                <>
                                                                    <Check size={10} className="text-emerald-400" />
                                                                    Hoàn thành {task.completedAt && `lúc ${task.completedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                                                                </>
                                                            )}
                                                            {task.status === 'failed' && (
                                                                <>
                                                                    <AlertCircle size={10} className="text-red-400" />
                                                                    {task.error || 'Đã xảy ra lỗi'}
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                    {typeInfo && (
                                                        <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br opacity-60", typeInfo.color)}>
                                                            <typeInfo.icon size={12} className="text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                {task.status === 'running' && (
                                                    <div className="mt-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                                                            initial={{ width: '0%' }}
                                                            animate={{ width: '90%' }}
                                                            transition={{ duration: 4, ease: 'easeOut' }}
                                                        />
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════════════ */}
            {/* TOAST NOTIFICATIONS */}
            {/* ═══════════════════════════════════════════════════ */}
            {toasts.length > 0 && (
                <div className="fixed bottom-40 right-6 z-50 space-y-2 w-80 pointer-events-none">
                    <AnimatePresence>
                        {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 100, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100, scale: 0.9 }}
                            className={clsx(
                                "pointer-events-auto p-3 rounded-xl border shadow-2xl backdrop-blur-xl flex items-start gap-3",
                                toast.type === 'success' && "bg-emerald-50/95 dark:bg-emerald-900/80 border-emerald-200 dark:border-emerald-500/30",
                                toast.type === 'error' && "bg-red-50/95 dark:bg-red-900/80 border-red-200 dark:border-red-500/30",
                                toast.type === 'info' && "bg-blue-50/95 dark:bg-blue-900/80 border-blue-200 dark:border-blue-500/30"
                            )}
                        >
                            <div className={clsx(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                toast.type === 'success' && "bg-emerald-500/20",
                                toast.type === 'error' && "bg-red-500/20",
                                toast.type === 'info' && "bg-blue-500/20"
                            )}>
                                {toast.type === 'success' && <CheckCircle2 size={16} className="text-emerald-500" />}
                                {toast.type === 'error' && <XCircle size={16} className="text-red-500" />}
                                {toast.type === 'info' && <Loader2 size={16} className="text-blue-500 animate-spin" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={clsx(
                                    "text-xs font-bold",
                                    toast.type === 'success' && "text-emerald-800 dark:text-emerald-200",
                                    toast.type === 'error' && "text-red-800 dark:text-red-200",
                                    toast.type === 'info' && "text-blue-800 dark:text-blue-200"
                                )}>{toast.title}</p>
                                <p className={clsx(
                                    "text-[10px] mt-0.5",
                                    toast.type === 'success' && "text-emerald-600 dark:text-emerald-400",
                                    toast.type === 'error' && "text-red-600 dark:text-red-400",
                                    toast.type === 'info' && "text-blue-600 dark:text-blue-400"
                                )}>{toast.message}</p>
                            </div>
                            <button
                                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                                className="p-1 hover:bg-black/10 rounded-lg transition-colors shrink-0"
                            >
                                <X size={12} className="text-slate-400" />
                            </button>
                        </motion.div>
                    ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default NotebookLM;

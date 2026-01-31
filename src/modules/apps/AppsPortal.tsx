import React, { useState, useEffect } from 'react';
import {
    Mail, FileText, Globe, Lightbulb,
    ArrowLeft, Send, Copy, Eraser, Sparkles,
    Calculator, MessageSquare, Check, X, Lock,
    History, Trash2, Clock, Package, ExternalLink
} from 'lucide-react';
import { clsx } from 'clsx';
import ReactMarkdown from 'react-markdown';
import { getGeminiKey, initializeGemini } from '../../lib/gemini';
import { useAuth } from '../../context/AuthContext';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ExternalApp {
    id: string;
    name: string;
    desc: string;
    icon: React.ElementType;
    color: string;
    url: string;
}

const EXTERNAL_APPS: ExternalApp[] = [
    {
        id: 'avg-packaging',
        name: 'AVG Packaging',
        desc: 'Công cụ tính toán đóng gói hàng hóa chuyên dụng.',
        icon: Package,
        color: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
        url: 'https://packaging.auvietglobal.com/'
    }
];

interface ToolInfo {
    id: string;
    name: string;
    desc: string;
    icon: React.ElementType;
    color: string;
    promptTemplate: (input: string, options?: any) => string;
    placeholder: string;
}

const TOOLS: ToolInfo[] = [
    {
        id: 'email-writer',
        name: 'Soạn Email Chuyên Nghiệp',
        desc: 'Viết email công việc, thư mời, báo cáo với văn phong trang trọng.',
        icon: Mail,
        color: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
        placeholder: 'Ví dụ: Viết email xin nghỉ phép 2 ngày vì lý do gia đình, hứa sẽ bàn giao việc cho anh Tâm...',
        promptTemplate: (input) => `Đóng vai là một thư ký chuyên nghiệp. Hãy soạn thảo một email công việc dựa trên yêu cầu sau: "${input}". 
        Yêu cầu:
        1. Tiêu đề email rõ ràng, chuyên nghiệp.
        2. Văn phong lịch sự, phù hợp môi trường doanh nghiệp Việt Nam.
        3. Có phần chào đầu và kết thư trang trọng.
        4. Nếu thông tin thiếu, hãy tự điền thông tin giả định trong ngoặc vuông [ ].`
    },
    {
        id: 'grammar-fix',
        name: 'Chỉnh Sửa & Viết Lại',
        desc: 'Kiểm tra lỗi chính tả, cải thiện câu từ cho văn bản.',
        icon: FileText,
        color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
        placeholder: 'Dán đoạn văn bản cần chỉnh sửa vào đây...',
        promptTemplate: (input, options) => `Hãy đóng vai là một biên tập viên cao cấp. Nhiệm vụ của bạn là chỉnh sửa và viết lại đoạn văn bản sau theo phong cách "${options?.tone || 'Chuyên nghiệp'}": "${input}".
        Yêu cầu:
        1. Sửa toàn bộ lỗi chính tả và ngữ pháp.
        2. Điều chỉnh văn phong sao cho "${options?.tone || 'Chuyên nghiệp'}".
        3. Cải thiện cấu trúc câu cho gãy gọn, súc tích.
        4. Giữ nguyên ý nghĩa gốc.
        5. Sau khi viết lại, hãy liệt kê ngắn gọn các lỗi chính đã sửa.`
    },
    {
        id: 'translator',
        name: 'Dịch Thuật Đa Ngữ',
        desc: 'Dịch thuật tài liệu đa ngôn ngữ chuẩn xác (Anh, Việt, Trung, Nhật, Hàn...).',
        icon: Globe,
        color: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30',
        placeholder: 'Nhập văn bản cần dịch...',
        promptTemplate: (input, options) => `Hãy đóng vai là một phiên dịch viên cao cấp. Dịch văn bản sau sang ${options?.targetLanguage || 'Tiếng Anh'}:
        "${input}"
        Yêu cầu:
        1. Dịch chuẩn xác về ngữ nghĩa và ngữ cảnh kinh doanh.
        2. Giữ nguyên các thuật ngữ chuyên ngành (nếu có thể thì mở ngoặc giải thích).
        3. Trình bày rõ ràng.
        4. Chỉ đưa ra bản dịch, không cần giải thích thêm.`
    },
    {
        id: 'excel-helper',
        name: 'Trợ Lý Excel & Google Sheets',
        desc: 'Tạo công thức, giải thích hàm hoặc viết VBA/Script.',
        icon: Calculator,
        color: 'text-green-400 bg-green-500/20 border-green-500/30',
        placeholder: 'Ví dụ: Tính tổng cột A nếu cột B là "Đã duyệt", hoặc viết hàm VLOOKUP lấy dữ liệu từ sheet khác...',
        promptTemplate: (input) => `Bạn là chuyên gia Excel. Hãy giải quyết yêu cầu: "${input}".
        Yêu cầu:
        1. Cung cấp công thức chính xác.
        2. Giải thích ngắn gọn cách hoạt động.
        3. Nếu cần VBA/Macro, hãy viết code rõ ràng.`
    },
    {
        id: 'idea-gen',
        name: 'Ý Tưởng Sáng Tạo',
        desc: 'Gợi ý slogan, ý tưởng marketing, kế hoạch sự kiện.',
        icon: Lightbulb,
        color: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
        placeholder: 'Ví dụ: Gợi ý 5 slogan cho sản phẩm nước uống mới, hoặc ý tưởng tổ chức tiệc tất niên...',
        promptTemplate: (input) => `Bạn là chuyên gia Marketing và Sáng tạo. Hãy gợi ý cho yêu cầu: "${input}".
        Yêu cầu:
        1. Đưa ra ít nhất 5 phương án khác nhau.
        2. Phân tích ngắn gọn ưu điểm của từng phương án.
        3. Văn phong hào hứng, sáng tạo.`
    },
    {
        id: 'summarizer',
        name: 'Tóm Tắt Văn Bản',
        desc: 'Rút gọn nội dung dài thành các ý chính quan trọng.',
        icon: MessageSquare,
        color: 'text-pink-400 bg-pink-500/20 border-pink-500/30',
        placeholder: 'Dán báo cáo hoặc văn bản dài cần tóm tắt vào đây...',
        promptTemplate: (input) => `Hãy tóm tắt văn bản sau: "${input}".
        Yêu cầu:
        1. Trích xuất các ý chính quan trọng nhất dưới dạng gạch đầu dòng.
        2. Nếu có các hành động cần làm (Action Items), hãy liệt kê riêng.
        3. Tóm tắt ngắn gọn, dễ hiểu.`
    }
];

interface HistoryItem {
    id: string;
    toolId: string;
    input: string;
    output: string;
    timestamp: any;
}

const AppsPortal: React.FC = () => {
    const { currentUser } = useAuth();
    const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasKey, setHasKey] = useState<boolean | null>(null);

    // History State
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [selectedTone, setSelectedTone] = useState('Chuyên nghiệp');
    const [selectedLanguage, setSelectedLanguage] = useState('Tiếng Anh');

    const TONES = [
        'Chuyên nghiệp',
        'Thân thiện',
        'Hài hước',
        'Trang trọng',
        'Ngắn gọn',
        'Thuyết phục',
        'Đồng cảm'
    ];

    const LANGUAGES = [
        'Tiếng Việt',
        'Tiếng Anh',
        'Tiếng Trung',
        'Tiếng Nhật',
        'Tiếng Hàn',
        'Tiếng Pháp',
        'Tiếng Đức'
    ];

    const activeTool = TOOLS.find(t => t.id === selectedToolId);

    // Reset tone when tool changes
    // Reset tone when tool changes
    useEffect(() => {
        if (selectedToolId === 'grammar-fix') setSelectedTone('Chuyên nghiệp');
        if (selectedToolId === 'translator') setSelectedLanguage('Tiếng Anh');
    }, [selectedToolId]);

    // Initial Checks
    useEffect(() => {
        getGeminiKey().then(key => setHasKey(!!key));
    }, []);

    // Load History
    useEffect(() => {
        if (!currentUser) return;
        const q = query(
            collection(db, 'ai_app_history'),
            where('userId', '==', currentUser.uid),
            orderBy('timestamp', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
            setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoryItem)));
        });
        return () => unsub();
    }, [currentUser]);

    const handleGenerate = async () => {
        if (!input.trim() || !activeTool || !currentUser) return;

        setIsLoading(true);
        setError(null);
        setOutput('');

        try {
            const model = await initializeGemini();
            if (!model) {
                setError("Hệ thống chưa cấu hình Gemini API Key. Vui lòng liên hệ Admin.");
                setHasKey(false);
                return;
            }

            const prompt = activeTool.promptTemplate(input, { tone: selectedTone, targetLanguage: selectedLanguage });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            setOutput(text);

            // Save to History
            await addDoc(collection(db, 'ai_app_history'), {
                userId: currentUser.uid,
                toolId: activeTool.id,
                input: input,
                output: text,
                timestamp: serverTimestamp()
            });

        } catch (err: any) {
            console.error("AI Error:", err);
            setError("Có lỗi xảy ra khi xử lý yêu cầu. " + (err.message || ''));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Xóa mục lịch sử này?')) {
            await deleteDoc(doc(db, 'ai_app_history', id));
        }
    };

    const handleRestoreHistory = (item: HistoryItem) => {
        setSelectedToolId(item.toolId);
        setInput(item.input);
        setOutput(item.output);
        setError(null);
        setShowHistory(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(output);
        alert("Đã sao chép kết quả!");
    };

    return (
        <div className="flex bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-200 md:h-[calc(100vh-8rem)] min-h-[calc(100vh-8rem)] rounded-3xl md:overflow-hidden border border-slate-200 dark:border-white/5 shadow-2xl relative">

            {/* --- HISTORY SIDEBAR OVERLAY --- */}
            <div className={clsx(
                "absolute inset-y-0 right-0 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-slate-200 dark:border-white/10 transform transition-transform duration-300 z-50 flex flex-col shadow-2xl",
                showHistory ? "translate-x-0" : "translate-x-full"
            )}>
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <History size={18} className="text-indigo-400" /> Lịch sử hoạt động
                    </h3>
                    <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-white/10 rounded-full">
                        <X size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                    {history.length === 0 && (
                        <div className="text-center text-slate-500 text-xs mt-10">Chưa có lịch sử nào.</div>
                    )}
                    {history.map(item => {
                        const tool = TOOLS.find(t => t.id === item.toolId);
                        return (
                            <div key={item.id} onClick={() => handleRestoreHistory(item)} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer group transition-all text-xs">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={clsx("font-bold", tool?.color?.split(' ')[0])}>{tool?.name}</span>
                                    <button onClick={(e) => handleDeleteHistory(item.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="line-clamp-2 text-slate-400 mb-2 font-mono bg-black/20 p-1.5 rounded">"{item.input}"</div>
                                <div className="text-[10px] text-slate-600 flex items-center gap-1">
                                    <Clock size={10} />
                                    {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString('vi-VN') : 'Vừa xong'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- MAIN CONTENT WRAPPER --- */}
            <div className="flex-1 flex flex-col min-w-0 transition-transform duration-300">
                {/* HERO BANNER - APP STORE */}
                {!selectedToolId && (
                    <div className="relative rounded-3xl overflow-hidden m-6 mb-2 shadow-2xl shrink-0 group">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 mix-blend-overlay"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl -ml-10 -mb-10 mix-blend-overlay"></div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none mix-blend-overlay"></div>
                        </div>

                        <div className="relative z-10 p-6 md:p-8 text-white">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-widest border border-white/10 shadow-sm">
                                            AI Intelligence
                                        </span>
                                    </div>
                                    <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-sm flex items-center gap-3">
                                        Kho Ứng Dụng AI
                                    </h1>
                                    <p className="text-blue-100 font-medium max-w-xl text-lg opacity-90 leading-relaxed">
                                        Bộ công cụ AI chuyên dụng giúp tối ưu hóa hiệu suất công việc
                                    </p>
                                </div>

                                <button
                                    onClick={() => setShowHistory(true)}
                                    className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl transition-all font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 backdrop-blur-md"
                                >
                                    <History size={18} />
                                    Lịch sử hoạt động
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUB HEADER - TOOL DETAIL */}
                {selectedToolId && (
                    <div className="h-16 border-b border-slate-200 dark:border-white/10 flex items-center px-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur shrink-0 justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => { setSelectedToolId(null); setInput(''); setOutput(''); setError(null); }}
                                className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500 dark:text-slate-400"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide truncate flex items-center gap-2">
                                <span className={clsx("w-2 h-2 rounded-full", activeTool?.color?.split(' ')[0].replace('text-', 'bg-'))}></span>
                                {activeTool?.name}
                            </h1>
                        </div>

                        <button
                            onClick={() => setShowHistory(true)}
                            className={clsx("p-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all", showHistory ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white")}
                        >
                            <History size={16} /> <span className="hidden sm:inline">Lịch sử</span>
                        </button>
                    </div>
                )}

                {/* CONTENT AREA */}
                <div className="flex-1 md:overflow-y-auto custom-scrollbar p-6 bg-slate-50 dark:bg-slate-950/50 relative">

                    {/* CHECK KEY WARNING */}
                    {hasKey === false && (
                        <div className="max-w-4xl mx-auto mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 text-amber-500">
                            <Lock size={20} />
                            <div>
                                <p className="font-bold">Chưa cấu hình API Key</p>
                                <p className="text-xs opacity-80">Các tính năng AI sẽ không hoạt động. Vui lòng liên hệ Admin để cài đặt Key trong hệ thống.</p>
                            </div>
                        </div>
                    )}

                    {/* VIEW 1: GRID MENU */}
                    {!selectedToolId ? (
                        <div className="max-w-7xl mx-auto">
                            {/* HIDDEN HEADER */}
                            {/* <div className="mb-8 text-center space-y-2">
                                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                                    AVG Intelligence Suite
                                </h2>
                                <p className="text-slate-400 max-w-2xl mx-auto text-sm">
                                    Bộ công cụ AI chuyên dụng giúp tối ưu hóa hiệu suất làm việc. Kết quả được lưu trữ riêng tư.
                                </p>
                            </div> */}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                                {/* External Apps */}
                                {EXTERNAL_APPS.map(app => (
                                    <a
                                        key={app.id}
                                        href={app.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative p-6 rounded-2xl bg-white dark:bg-[#1e293b]/50 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#1e293b] hover:border-orange-500/50 transition-all duration-300 text-left hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-500/10 flex flex-col gap-4 overflow-hidden"
                                    >
                                        <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", app.color)}>
                                            <app.icon size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-orange-500 dark:group-hover:text-orange-300 transition-colors">{app.name}</h3>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-light">{app.desc}</p>
                                        </div>
                                        <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                            <ExternalLink size={20} className="text-orange-500" />
                                        </div>
                                    </a>
                                ))}

                                {TOOLS.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => setSelectedToolId(tool.id)}
                                        className="group relative p-6 rounded-2xl bg-white dark:bg-[#1e293b]/50 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#1e293b] hover:border-indigo-500/50 transition-all duration-300 text-left hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col gap-4 overflow-hidden"
                                    >
                                        <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", tool.color)}>
                                            <tool.icon size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors">{tool.name}</h3>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-light">{tool.desc}</p>
                                        </div>
                                        <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                            <ArrowLeft size={20} className="rotate-180 text-indigo-500" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* VIEW 2: ACTIVE TOOL INTEFACE */
                        activeTool && (
                            <div className="max-w-7xl mx-auto h-full flex flex-col gap-6 pb-6">
                                <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                                    {/* LEFT: INPUT */}
                                    <div className="flex-1 flex flex-col gap-4">
                                        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-white/10 p-5 flex flex-col shadow-xl h-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-2 text-indigo-400 text-sm font-bold">
                                                    <Sparkles size={16} /> Đầu vào
                                                </div>
                                                {input && (
                                                    <button onClick={() => setInput('')} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
                                                        <Eraser size={12} /> Xóa
                                                    </button>
                                                )}
                                            </div>

                                            {/* --- TONE SELECTOR (ONLY FOR GRAMMAR FIX) --- */}
                                            {selectedToolId === 'grammar-fix' && (
                                                <div className="mb-4 flex flex-wrap gap-2">
                                                    {TONES.map(tone => (
                                                        <button
                                                            key={tone}
                                                            onClick={() => setSelectedTone(tone)}
                                                            className={clsx(
                                                                "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                                                selectedTone === tone
                                                                    ? "bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20"
                                                                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                                                            )}
                                                        >
                                                            {tone}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* --- LANGUAGE SELECTOR (ONLY FOR TRANSLATOR) --- */}
                                            {selectedToolId === 'translator' && (
                                                <div className="mb-4">
                                                    <p className="text-xs text-slate-400 mb-2 font-bold">Chọn ngôn ngữ đích:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {LANGUAGES.map(lang => (
                                                            <button
                                                                key={lang}
                                                                onClick={() => setSelectedLanguage(lang)}
                                                                className={clsx(
                                                                    "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                                                    selectedLanguage === lang
                                                                        ? "bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20"
                                                                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                                                                )}
                                                            >
                                                                {lang}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <textarea
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                placeholder={activeTool.placeholder}
                                                className="flex-1 w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 resize-none transition-all text-sm leading-relaxed"
                                            />
                                            <div className="mt-4 flex justify-end">
                                                <button
                                                    onClick={handleGenerate}
                                                    disabled={isLoading || !input.trim() || hasKey === false}
                                                    className={clsx(
                                                        "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg text-sm",
                                                        isLoading || !input.trim() || hasKey === false
                                                            ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                                                            : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 transform active:scale-95"
                                                    )}
                                                >
                                                    {isLoading ? (
                                                        <>Đang xử lý...</>
                                                    ) : (
                                                        <> <Send size={18} /> Xử lý ngay </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT: OUTPUT */}
                                    <div className="flex-1 flex flex-col gap-4">
                                        <div className={clsx(
                                            "bg-white dark:bg-[#1e293b] rounded-2xl border p-5 flex flex-col shadow-xl transition-colors relative overflow-hidden h-full",
                                            output ? "border-emerald-500/30" : "border-slate-200 dark:border-white/10"
                                        )}>
                                            <div className="flex justify-between items-center mb-4">
                                                <div className={clsx("flex items-center gap-2 text-sm font-bold", output ? "text-emerald-400" : "text-slate-500")}>
                                                    <Check size={16} /> Kết quả
                                                </div>
                                                {output && (
                                                    <button onClick={handleCopy} className="text-xs bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-white px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 flex items-center gap-2 transition-all">
                                                        <Copy size={12} /> Sao chép
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-white/5 relative">
                                                {output ? (
                                                    <div className="prose dark:prose-invert prose-sm max-w-none text-slate-900 dark:text-slate-300">
                                                        <ReactMarkdown>{output}</ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 opacity-50">
                                                        <activeTool.icon size={48} className="mb-4 text-slate-300 dark:text-slate-700" />
                                                        <p className="text-sm">Kết quả sẽ hiển thị tại đây</p>
                                                    </div>
                                                )}
                                            </div>

                                            {error && (
                                                <div className="absolute inset-x-4 bottom-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                                                    <X size={16} /> {error}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div >
    );
};

export default AppsPortal;

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { db, storage } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';
import { collection, onSnapshot, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    Users, CheckSquare, FileText, Bell,
    Gift, Calendar, DollarSign, Database, Trash2, Edit2,
    Save, X, LogOut, ChevronRight, Search, ArrowUpDown, Loader2, Upload,
    Image as ImageIcon, Megaphone, Mail, MessageSquare, Newspaper, Bot
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

// --- HELPER: Detect Field Type for Form ---
const getInputType = (key: string, value: any): string => {
    if (key.toLowerCase() === 'avatar') return 'avatar'; // New explicit type
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    // Only use date input if value matches YYYY-MM-DD format, otherwise fallback to text
    if ((key.toLowerCase().includes('date') || key.toLowerCase().includes('dob')) &&
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return 'date';
    }
    if (key.toLowerCase().includes('email')) return 'email';
    if (typeof value === 'string' && value.length > 50) return 'textarea';
    return 'text';
};

const sanitize = (obj: any) => JSON.parse(JSON.stringify(obj));

// Helper to crop and resize image to square max 1000x1000
const processImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const size = Math.min(img.width, img.height);
            const canvas = document.createElement('canvas');

            // Resize rule: Square, Max 1000px
            const finalSize = Math.min(size, 1000);
            canvas.width = finalSize;
            canvas.height = finalSize;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas ctx error')); return; }

            // Center Crop Calculation
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;

            // Draw cropped and resized
            ctx.drawImage(img, sx, sy, size, size, 0, 0, finalSize, finalSize);

            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('Blob conversion failed'));
            }, 'image/jpeg', 0.9); // 90% quality JPEG
        };
        img.onerror = reject;
    });
};

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'warning', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgClass = type === 'success' ? "bg-emerald-500" : type === 'error' ? "bg-red-500" : "bg-amber-500";
    const Icon = type === 'success' ? CheckSquare : type === 'error' ? X : Bell;

    return (
        <div className={clsx(
            "fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[100] animate-slide-up bg-opacity-90 backdrop-blur text-white",
            bgClass
        )}>
            <Icon size={18} />
            <span className="font-bold text-sm">{message}</span>
        </div>
    );
};

// --- COMPONENT: Dynamic Edit Form ---
const EditForm = ({ data, onSave, onSilentSave, onCancel }: {
    data: any,
    onSave: (newData: any) => Promise<void>,
    onSilentSave?: (newData: any) => Promise<void>,
    onCancel: () => void
}) => {
    const [formData, setFormData] = useState<any>(data);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingField, setUploadingField] = useState<string | null>(null);

    const handleChange = (key: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleJsonChange = (key: string, jsonString: string) => {
        try {
            const parsed = JSON.parse(jsonString);
            setFormData((prev: any) => ({ ...prev, [key]: parsed }));
        } catch (e) {
            // Allow typing invalid JSON temporarily
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingField(key);
        try {
            // Process Image (Crop Square + Max 1000px)
            const processedBlob = await processImage(file);
            const processedFile = new File([processedBlob], "avatar.jpg", { type: "image/jpeg" });

            // Upload to Firebase
            // Path: avatars/{ID}_{timestamp}.jpg to avoid caching issues
            const storagePath = `avatars/${data.id}_${Date.now()}.jpg`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, processedFile);
            const url = await getDownloadURL(storageRef);

            // Auto Update Form
            handleChange(key, url);

            // Auto-save to Firestore immediately
            if (onSilentSave) {
                onSilentSave({ ...formData, [key]: url });
            }
        } catch (err: any) {
            console.error("Upload Error:", err);
            alert("Lỗi tải ảnh: " + err.message);
        } finally {
            setUploadingField(null);
        }
    };

    const handleSaveClick = async () => {
        setIsSaving(true);
        try {
            const cleanData = sanitize(formData);
            await onSave(cleanData);
        } catch (e) {
            console.error("Save failed in Form", e);
        } finally {
            setIsSaving(false);
        }
    };

    // Fields to ignore in generic form
    const ignoredFields = ['id', 'created_at', 'updated_at'];
    let fields = Object.keys(data).filter(k => !ignoredFields.includes(k));

    // Force 'permissions' to appear even if not in data (for legacy users)
    if (!fields.includes('permissions')) {
        fields.push('permissions');
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900 sticky top-0 z-10 w-full">
                <h3 className="font-bold text-lg flex items-center gap-2 text-indigo-400">
                    <Edit2 size={18} />
                    Chỉnh sửa <span className="text-white text-sm font-mono bg-white/10 px-2 py-0.5 rounded">{data.id}</span>
                </h3>
                <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto w-full">
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    {fields.map(key => {
                        const val = formData[key];
                        const type = getInputType(key, val);
                        const isObject = typeof val === 'object' && val !== null;

                        if (isObject) {
                            return (
                                <div key={key} className="col-span-2">
                                    <label className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2 block">{key} (JSON Object)</label>
                                    <textarea
                                        defaultValue={JSON.stringify(val, null, 2)}
                                        onChange={e => handleJsonChange(key, e.target.value)}
                                        className="w-full h-32 bg-slate-950 border border-amber-500/30 rounded-lg p-3 font-mono text-xs text-amber-200 focus:border-amber-500 outline-none"
                                    />
                                </div>
                            );
                        }

                        if (type === 'textarea') {
                            return (
                                <div key={key} className="col-span-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{key}</label>
                                    <textarea
                                        value={val || ''}
                                        onChange={e => handleChange(key, e.target.value)}
                                        className="w-full h-24 bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            );
                        }

                        if (type === 'avatar') {
                            return (
                                <div key={key} className="col-span-2 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                                    <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4 block flex items-center gap-2">
                                        <ImageIcon size={14} /> {key} (Auto-Crop Square 1000px)
                                    </label>
                                    <div className="flex items-start gap-6">
                                        <div className="relative shrink-0 group">
                                            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-700 shadow-xl bg-slate-800">
                                                {val ? (
                                                    <img src={val} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                        <Users size={32} />
                                                    </div>
                                                )}
                                            </div>
                                            {uploadingField === key && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                                    <Loader2 size={24} className="text-white animate-spin" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <label className={clsx(
                                                    "px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95",
                                                    uploadingField === key && "opacity-50 pointer-events-none"
                                                )}>
                                                    <Upload size={14} />
                                                    {uploadingField === key ? 'Đang tải...' : 'Tải ảnh mới'}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => handleFileUpload(e, key)}
                                                    />
                                                </label>
                                                {val && (
                                                    <button
                                                        onClick={() => handleChange(key, '')}
                                                        className="text-slate-500 hover:text-red-400 text-xs underline"
                                                    >
                                                        Xóa ảnh
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                type="text"
                                                value={val || ''}
                                                onChange={e => handleChange(key, e.target.value)}
                                                placeholder="Hoặc nhập URL ảnh..."
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        if (type === 'checkbox') {
                            return (
                                <div key={key} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:border-indigo-500/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={!!val}
                                        onChange={e => handleChange(key, e.target.checked)}
                                        className="w-5 h-5 text-indigo-600 rounded bg-slate-700 border-slate-600 focus:ring-indigo-500"
                                    />
                                    <label className="text-sm font-medium text-slate-300 uppercase tracking-wide cursor-pointer">{key}</label>
                                </div>
                            );
                        }

                        if (key === 'permissions') {
                            const MODULES = [
                                { id: 'dashboard', label: 'Tổng quan' },
                                { id: 'tasks', label: 'Nhiệm vụ' },
                                { id: 'workflow', label: 'Quy trình' },
                                { id: 'reports', label: 'Báo cáo' },
                                { id: 'users', label: 'Nhân sự' },
                                { id: 'finance', label: 'Thu nhập' },
                                { id: 'schedule', label: 'Lịch trao đổi' },
                                { id: 'documents', label: 'Văn bản' },
                                { id: 'timekeep', label: 'Chấm công' },
                                { id: 'ai_chat', label: 'AI Chatbot' }
                            ];
                            const currentPerms = val || {};

                            return (
                                <div key={key} className="col-span-2 bg-slate-800/30 p-4 rounded-xl border border-dashed border-slate-700">
                                    <label className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-4 block flex items-center gap-2">
                                        <Database size={14} /> Phân Quyền (RBAC)
                                    </label>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr>
                                                    <th className="p-2 text-[10px] text-slate-500 uppercase">Module</th>
                                                    <th className="p-2 text-[10px] text-slate-500 uppercase text-center">Xem</th>
                                                    <th className="p-2 text-[10px] text-slate-500 uppercase text-center">Sửa</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800">
                                                {MODULES.map(mod => (
                                                    <tr key={mod.id} className="hover:bg-white/5">
                                                        <td className="p-2 text-sm text-slate-300 font-medium">{mod.label}</td>
                                                        <td className="p-2 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={currentPerms[mod.id]?.view !== false}
                                                                onChange={e => {
                                                                    const newPerms = { ...currentPerms };
                                                                    if (!newPerms[mod.id]) newPerms[mod.id] = { view: true, edit: true }; // Init as true
                                                                    newPerms[mod.id].view = e.target.checked;
                                                                    handleChange(key, newPerms);
                                                                }}
                                                                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-teal-500 focus:ring-teal-500 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={currentPerms[mod.id]?.edit !== false}
                                                                onChange={e => {
                                                                    const newPerms = { ...currentPerms };
                                                                    if (!newPerms[mod.id]) newPerms[mod.id] = { view: true, edit: true }; // Init as true
                                                                    newPerms[mod.id].edit = e.target.checked;
                                                                    handleChange(key, newPerms);
                                                                }}
                                                                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={key}>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{key}</label>
                                <input
                                    type={type}
                                    value={val || ''}
                                    onChange={e => handleChange(key, e.target.value)}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none transition-all h-[42px]"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-slate-900 sticky bottom-0 z-10 w-full">
                <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
                    Hủy bỏ
                </button>
                <button
                    onClick={handleSaveClick}
                    disabled={isSaving}
                    className={clsx(
                        "px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all transform active:scale-95",
                        isSaving && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
            </div>
        </div>
    );
};

// --- COMPONENT: Data Table View ---
const CollectionView = ({ name, data, onDelete, onUpdate }: {
    name: string,
    data: any[],
    onDelete: (id: string) => void,
    onUpdate: (id: string, newData: any) => Promise<void>
}) => {
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' | 'warning' } | null>(null);

    // Dynamically derive columns
    const columns = useMemo(() => {
        if (data.length === 0) return [];
        const keys = new Set<string>();
        data.forEach(item => Object.keys(item).forEach(k => keys.add(k)));
        const allKeys = Array.from(keys);

        const priority = ['id', 'name', 'title', 'email', 'status', 'role'];
        return allKeys.sort((a, b) => {
            const idxA = priority.indexOf(a);
            const idxB = priority.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [data]);

    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const lower = searchTerm.toLowerCase();
        return data.filter(item =>
            columns.some(col => String(item[col]).toLowerCase().includes(lower))
        );
    }, [data, searchTerm, columns]);

    const handleSave = async (newData: any) => {
        if (!editingItem) return;

        const docId = editingItem.id;

        // Definition of the actual update task with late monitoring
        const updateTask = onUpdate(docId, newData)
            .then(() => {
                console.log("Save confirmed for", docId);
            })
            .catch((e) => {
                console.error("Background Save FAILED:", e);
                setToast({ msg: 'LƯU THẤT BẠI (Sau khi đã đóng): ' + e.message, type: 'error' });
            });

        // UI Timeout
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000));

        try {
            await Promise.race([updateTask, timeoutPromise]);
            // Fast Path
            setEditingItem(null);
            setToast({ msg: 'Đã lưu thay đổi!', type: 'success' });
        } catch (e: any) {
            if (e.message === "Timeout") {
                // Slow Path (Optimistic)
                setEditingItem(null);
                setToast({ msg: 'Mạng chậm. Đang tiếp tục lưu ngầm...', type: 'warning' });
            } else {
                // Immediate Error
                console.error("Update failed", e);
                setToast({ msg: 'Lỗi: ' + e.message, type: 'error' });
                // Do NOT close form on immediate error
            }
        }
    };

    const handleSilentSave = async (newData: any) => {
        if (!editingItem) return;
        // Optimistic update logic if needed, but here we just push to DB
        try {
            await onUpdate(editingItem.id, newData);
            setToast({ msg: 'Đã lưu ảnh mới!', type: 'success' });
        } catch (e: any) {
            console.error("Silent save error", e);
            setToast({ msg: 'Lỗi lưu tự động: ' + e.message, type: 'error' });
        }
    };

    return (
        <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden flex flex-col h-full shadow-xl relative">
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, x: 20 }}
                        animate={{ opacity: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, y: 20, x: 20 }}
                        className="fixed bottom-6 right-6 z-[100]"
                    >
                        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toolbar */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900/80 sticky top-0 z-20 backdrop-blur gap-4">
                <div className="flex items-center gap-3">
                    <Database size={20} className="text-indigo-400" />
                    <h3 className="font-bold text-white text-lg capitalize">{name}</h3>
                    <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-300 text-xs font-bold rounded-full border border-indigo-500/20">{filteredData.length} records</span>
                </div>

                <div className="flex items-center gap-3 flex-1 justify-end max-w-md">
                    <div className="relative w-full">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar relative bg-[#0f172a]">
                {filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                        <Database size={32} className="mb-2 opacity-50" />
                        <p>Không có dữ liệu</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-900 shadow-sm">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-16 text-center">
                                    Actions
                                </th>
                                {columns.map(col => (
                                    <th key={col} className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap min-w-[150px]">
                                        <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                                            {col} <ArrowUpDown size={10} className="opacity-50" />
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredData.map((item, idx) => (
                                <tr key={item.id || idx} className="hover:bg-slate-800/50 transition-colors group">
                                    <td className="p-3 border-r border-slate-800/50 bg-slate-900/30 sticky left-0 z-10 text-center">
                                        <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setEditingItem(item)}
                                                className="p-1.5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => { if (confirm('Xóa bản ghi này?')) onDelete(item.id); }}
                                                className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                    {columns.map(col => {
                                        const val = item[col];
                                        const isComplex = typeof val === 'object' && val !== null;
                                        return (
                                            <td key={col} className="p-3 text-sm text-slate-300 border-r border-slate-800/50 whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis">
                                                {isComplex ? (
                                                    <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                        {Array.isArray(val) ? `Array[${val.length}]` : '{Object}'}
                                                    </span>
                                                ) : (
                                                    <span className={clsx("truncate block", col === 'id' && "font-mono text-xs text-slate-500")}>
                                                        {val && col.toLowerCase() === 'avatar' && typeof val === 'string' ? (
                                                            <div className="flex items-center gap-2">
                                                                <img src={val} className="w-6 h-6 rounded-full border border-slate-600" />
                                                                <span>{val}</span>
                                                            </div>
                                                        ) : (
                                                            String(val ?? '-')
                                                        )}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit Modal (Form) */}
            <AnimatePresence>
                {editingItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-slate-900 w-full max-w-4xl h-[90vh] rounded-2xl border border-indigo-500/30 flex flex-col shadow-2xl overflow-hidden"
                        >
                            <EditForm
                                data={editingItem}
                                onSave={handleSave}
                                onSilentSave={handleSilentSave}
                                onCancel={() => setEditingItem(null)}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

import { useAuth } from '../../context/AuthContext';

// ... (existing imports)

const AdminPanel: React.FC = () => {
    const navigate = useNavigate();
    const contextData = useData();
    const { currentUser, loading } = useAuth();

    // Additional Collections fetch
    const [conclusionDocs, setConclusionDocs] = useState<any[]>([]);
    const [conclusionVotes, setConclusionVotes] = useState<any[]>([]);
    const [mailQueue, setMailQueue] = useState<any[]>([]);
    const [aiAppHistory, setAiAppHistory] = useState<any[]>([]);
    const [aiConversations, setAiConversations] = useState<any[]>([]);
    const [internalNews, setInternalNews] = useState<any[]>([]);
    const [chatRooms, setChatRooms] = useState<any[]>([]);

    useEffect(() => {
        if (loading) return; // Wait for auth check

        const token = localStorage.getItem('avg_admin_token');
        const allowedEmails = ['mcngocsonvualoidan@gmail.com', 'ccmartech.com@gmail.com'];
        const isSuperAdmin = currentUser?.email && allowedEmails.includes(currentUser.email.toLowerCase());

        if (token !== 'valid' && !isSuperAdmin) {
            navigate('/admin-login');
        }
    }, [navigate, currentUser, loading]);

    // Fetch extra collections
    useEffect(() => {
        const unsubs: (() => void)[] = [];
        unsubs.push(onSnapshot(collection(db, 'conclusion_docs'), s => setConclusionDocs(s.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubs.push(onSnapshot(collection(db, 'conclusion_votes'), s => setConclusionVotes(s.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubs.push(onSnapshot(collection(db, 'mail'), s => setMailQueue(s.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubs.push(onSnapshot(collection(db, 'ai_app_history'), s => setAiAppHistory(s.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubs.push(onSnapshot(collection(db, 'ai_conversations'), s => setAiConversations(s.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubs.push(onSnapshot(collection(db, 'internal_news'), s => setInternalNews(s.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubs.push(onSnapshot(collection(db, 'chat_rooms'), s => setChatRooms(s.docs.map(d => ({ id: d.id, ...d.data() })))));
        return () => unsubs.forEach(u => u());
    }, []);

    // URL Params for Routing
    const { section } = useParams();
    const activeTab = section || 'users';

    // Redirect to default if no section
    useEffect(() => {
        if (!section) {
            navigate('/admin-panel/users', { replace: true });
        }
    }, [section, navigate]);

    const collections = [
        { id: 'users', label: 'Nhân sự', icon: Users, data: contextData.users },
        { id: 'tasks', label: 'Nhiệm vụ', icon: CheckSquare, data: contextData.tasks },
        { id: 'logs', label: 'Nhật ký đơn', icon: FileText, data: contextData.logs },
        { id: 'notifications', label: 'Thông báo', icon: Bell, data: contextData.notifications },
        { id: 'wishes', label: 'Lời chúc', icon: Gift, data: contextData.birthdayWishes },
        { id: 'events', label: 'Sự kiện', icon: Calendar, data: contextData.activeEvents },
        { id: 'payroll', label: 'Lương', icon: DollarSign, data: contextData.payrollRecords },
        { id: 'meetings', label: 'Lịch họp', icon: Calendar, data: contextData.meetings },
        { id: 'conclusion_docs', label: 'Văn bản KL', icon: Database, data: conclusionDocs },
        { id: 'conclusion_votes', label: 'Bình chọn VB', icon: Database, data: conclusionVotes },
        { id: 'mail', label: 'Hàng đợi Email', icon: Mail, data: mailQueue },
        { id: 'ai_app_history', label: 'Lịch sử AI Apps', icon: Bot, data: aiAppHistory },
        { id: 'ai_conversations', label: 'Hội thoại AI', icon: Bot, data: aiConversations },
        { id: 'internal_news', label: 'Bản tin nội bộ', icon: Newspaper, data: internalNews },
        { id: 'chat_rooms', label: 'Phòng Chat', icon: MessageSquare, data: chatRooms },
    ];

    const activeCollection = collections.find(c => c.id === activeTab) || collections[0];

    // Generic Handlers
    const handleDelete = async (collectionName: string, id: string) => {
        if (collectionName === 'users_v2') {
            try {
                const { error } = await supabase.from('users').delete().eq('id', id);
                if (error) throw error;
                // UI update via realtime listener
            } catch (e: any) {
                alert('Supabase Delete Failed: ' + e.message);
            }
            return;
        }

        // Map collection name to firestore collection name
        let firestoreName = collectionName;
        try {
            await deleteDoc(doc(db, firestoreName, id));
        } catch (e: any) {
            alert('Delete failed: ' + e.message);
        }
    };

    const handleUpdate = async (collectionName: string, id: string, data: any) => {
        if (collectionName === 'users_v2') {
            // Map camelCase back to snake_case
            const snakeData = {
                name: data.name,
                alias: data.alias,
                role: data.role,
                dept: data.dept,
                email: data.email,
                phone: data.phone,
                avatar: data.avatar,
                bank_acc: data.bankAcc,
                bank_name: data.bankName,
                is_admin: data.isAdmin,
                verified: data.verified,
                dob: data.dob,
                start_date: data.startDate,
                employee_code: data.employeeCode,
                contract_no: data.contractNo,
                leaves: data.leaves,
                custom_qr_url: data.customQrUrl,
                // last_seen: data.lastSeen // Usually not editable manually, but nice to preserve
            };

            const { error } = await supabase.from('users').update(snakeData).eq('id', id);
            if (error) throw error;
            return;
        }

        // Force cleanup of undefined fields which break Firestore
        const cleanData = JSON.parse(JSON.stringify(data));
        await setDoc(doc(db, collectionName, id), cleanData, { merge: true });
    };

    const handleLogout = () => {
        localStorage.removeItem('avg_admin_token');
        navigate('/admin-login');
    };

    return (
        <div className="flex h-screen bg-[#0f172a] text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-slate-900 border-r border-white/10 flex flex-col shrink-0 z-20">
                <div className="h-16 flex items-center justify-center border-b border-white/10 bg-slate-900">
                    <h1 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                        ADMIN<span className="font-light text-white">CP</span>
                    </h1>
                </div>

                <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1 custom-scrollbar">
                    {collections.map(item => (
                        <button
                            key={item.id}
                            onClick={() => navigate(`/admin-panel/${item.id}`)}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm",
                                activeTab === item.id
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <item.icon size={18} />
                            {item.label}
                            <span className="ml-auto text-[10px] bg-black/20 px-2 py-0.5 rounded-full text-slate-400">{item.data.length}</span>
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider"
                    >
                        <LogOut size={16} /> Đăng Xuất
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0b1120]">
                {/* Topbar */}
                <div className="h-16 border-b border-white/10 flex items-center px-6 justify-between bg-slate-900/50 backdrop-blur sticky top-0 z-30">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <span className="opacity-50">Hệ thống</span>
                        <ChevronRight size={14} className="opacity-50" />
                        <span className="text-white font-bold tracking-wide">{activeCollection.label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono border border-indigo-500/30 font-bold">
                            ROOT ACCESS
                        </span>
                        <button
                            onClick={async () => {
                                const msg = prompt("Nhập nội dung thông báo toàn hệ thống (Push & In-App):");
                                if (msg) {
                                    const id = Date.now().toString();
                                    await setDoc(doc(db, 'notifications', id), {
                                        id,
                                        title: '📢 THÔNG BÁO TỪ ADMIN',
                                        message: msg,
                                        type: 'info',
                                        time: new Date().toISOString(),
                                        read: false
                                    });
                                    alert("✅ Đã gửi thông báo đến toàn bộ nhân sự!");
                                }
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg text-indigo-400 hover:text-white transition-colors"
                            title="Gửi thông báo toàn hệ thống"
                        >
                            <Megaphone size={18} />
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    const id = Date.now().toString();
                                    const timeStr = new Date().toLocaleString('vi-VN');

                                    // 1. Send In-App Notification
                                    await setDoc(doc(db, 'notifications', id), {
                                        id,
                                        title: '🔐 Cảnh báo Đăng nhập (Realtime)',
                                        message: `Phát hiện đăng nhập mới tài khoản: cambridgeorg.209@gmail.com (Lê Trần Thiện Tâm) lúc ${timeStr}`,
                                        type: 'alert',
                                        time: new Date().toISOString(),
                                        read: false
                                    });

                                    // 2. Queue Real Email (Requires 'Trigger Email' Extension)
                                    await setDoc(doc(db, 'mail', id), {
                                        to: 'cambridgeorg.209@gmail.com', // Thiện Tâm's Email
                                        message: {
                                            subject: '⚠️ CẢNH BÁO BẢO MẬT: Đăng nhập mới',
                                            html: `
                                                <div style="font-family: Arial, sans-serif; color: #333;">
                                                    <h2 style="color: #d9534f;">Cảnh báo đăng nhập mới</h2>
                                                    <p>Hệ thống AVGFlow phát hiện một phiên đăng nhập mới vào tài khoản của bạn.</p>
                                                    <ul>
                                                        <li><strong>Tài khoản:</strong> cambridgeorg.209@gmail.com</li>
                                                        <li><strong>Thời gian:</strong> ${timeStr}</li>
                                                        <li><strong>Thiết bị:</strong> Không xác định (Admin Trigger)</li>
                                                    </ul>
                                                    <p>Nếu đây không phải là bạn, vui lòng liên hệ Admin ngay lập tức.</p>
                                                    <hr />
                                                    <p style="font-size: 12px; color: #777;">Email này được gửi tự động từ hệ thống AVGFlow.</p>
                                                </div>
                                            `
                                        }
                                    });

                                    alert("Đã gửi thông báo In-app và đang xếp hàng gửi Email (nếu đã cài Extension)!");
                                } catch (e: any) {
                                    alert("Lỗi: " + e.message);
                                }
                            }}
                            className="p-2 bg-amber-500/20 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-white transition-colors"
                            title="Gửi thông báo Login cho Tâm"
                        >
                            <Bell size={16} />
                        </button>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs shadow-lg shadow-indigo-500/30">
                            A
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 overflow-hidden relative">
                    <CollectionView
                        key={activeTab}
                        name={activeTab}
                        data={activeCollection.data}
                        onDelete={(id) => handleDelete(activeTab, id)}
                        onUpdate={(id, data) => handleUpdate(activeTab, id, data)}
                    />
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;

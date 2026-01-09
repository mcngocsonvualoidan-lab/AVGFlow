import React, { useState, useEffect } from 'react';
import {
    Sun, Bell, Shield, Database,
    Smartphone, Mail, Lock,
    HardDrive, RefreshCw, Save,
    User, Loader2, Camera
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { askPermission, registerServiceWorker, subscribeToPush } from '../utils/pushManager';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Language } from '../i18n/translations';
import { db, storage } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const processImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const size = Math.min(img.width, img.height);
            const canvas = document.createElement('canvas');
            const finalSize = Math.min(size, 1000);
            canvas.width = finalSize;
            canvas.height = finalSize;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas ctx error')); return; }
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, finalSize, finalSize);
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('Blob conversion failed'));
            }, 'image/jpeg', 0.9);
        };
        img.onerror = reject;
    });
};

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
        onClick={onChange}
        className={clsx(
            "w-12 h-6 rounded-full p-1 transition-colors duration-300",
            checked ? "bg-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.5)]" : "bg-slate-700"
        )}
    >
        <motion.div
            layout
            className="w-4 h-4 bg-white rounded-full shadow-md"
            animate={{ x: checked ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
    </button>
);

const SettingSection = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="glass-panel-dark p-6 rounded-2xl border border-white/5 mb-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <Icon size={20} />
            </div>
            {title}
        </h3>
        <div className="space-y-6">
            {children}
        </div>
    </div>
);

const SettingsPage: React.FC = () => {
    const { language, setLanguage, t } = useLanguage();
    const { restoreDefaults, users } = useData();
    const { currentUser } = useAuth();
    const [darkMode, setDarkMode] = useState(true);
    const [notifications, setNotifications] = useState({ email: true, push: false });
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Get current App User details from Firestore data
    const currentAppUser = users.find(u => u.email === currentUser?.email);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentAppUser) return;

        setUploadingAvatar(true);
        try {
            // Process Image (Crop Square + Max 1000px)
            const processedBlob = await processImage(file);
            const processedFile = new File([processedBlob], "avatar.jpg", { type: "image/jpeg" });

            // Upload to Firebase
            // Path: avatars/{ID}_{timestamp}.jpg
            const storagePath = `avatars/${currentAppUser.id}_${Date.now()}.jpg`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, processedFile);
            const url = await getDownloadURL(storageRef);

            // Update Firestore directly
            await updateDoc(doc(db, 'users', currentAppUser.id), {
                avatar: url
            });

            alert("Cập nhật ảnh đại diện thành công!");

        } catch (err: any) {
            console.error("Upload Error:", err);
            alert("Lỗi tải ảnh: " + err.message);
        } finally {
            setUploadingAvatar(false);
            e.target.value = ''; // Reset input
        }
    };

    useEffect(() => {
        // Check initial permission state
        if ('Notification' in window && Notification.permission === 'granted') {
            setNotifications(prev => ({ ...prev, push: true }));
        }
    }, []);

    const handlePushToggle = async () => {
        if (!notifications.push) {
            // Turning ON
            const permission = await askPermission();
            if (permission === 'granted') {
                const swReg = await registerServiceWorker();
                if (swReg) {
                    await subscribeToPush(swReg);
                    setNotifications(prev => ({ ...prev, push: true }));
                    alert(t.settings.pushSuccess);
                }
            } else {
                alert(t.settings.pushBlocked);
            }
        } else {
            // Turning OFF
            setNotifications(prev => ({ ...prev, push: false }));
        }
    };

    const [showToast, setShowToast] = useState(false);

    useEffect(() => {
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('avg_settings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            setDarkMode(parsed.darkMode ?? true);
            setNotifications(parsed.notifications ?? { email: true, push: false });
        }
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        // Simulate network request and save to local storage
        setTimeout(() => {
            const settingsToSave = {
                darkMode,
                notifications
            };
            localStorage.setItem('avg_settings', JSON.stringify(settingsToSave));

            setIsSaving(false);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        }, 800);
    };

    return (
        <div className="h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar flex flex-col p-2 pb-20 max-w-5xl mx-auto w-full relative">

            {/* Success Toast */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm backdrop-blur-md bg-emerald-500/90 border border-emerald-400/50"
                    >
                        <div className="bg-white/20 p-1 rounded-full">
                            <Save size={14} />
                        </div>
                        {t.settings.saveSuccess}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-1">{t.settings.title}</h1>
                <p className="text-slate-400 text-sm">{t.settings.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 0. Hồ sơ cá nhân (New Section) */}
                <div className="md:col-span-2">
                    <SettingSection title="Hồ sơ cá nhân" icon={User}>
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            {/* Avatar */}
                            <div className="relative group shrink-0">
                                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-700 shadow-2xl bg-slate-800 relative">
                                    {currentAppUser?.avatar ? (
                                        <img src={currentAppUser.avatar} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-800">
                                            <User size={48} />
                                        </div>
                                    )}
                                    {/* Loading Overlay */}
                                    {uploadingAvatar && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                                            <Loader2 size={32} className="text-white animate-spin" />
                                        </div>
                                    )}
                                </div>

                                {/* Edit Button */}
                                <label className={clsx(
                                    "absolute bottom-0 right-0 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg border-4 border-[#1e293b] cursor-pointer transition-transform hover:scale-110 active:scale-95 group-hover:bottom-1 group-hover:right-1",
                                    uploadingAvatar && "opacity-50 cursor-not-allowed hidden"
                                )}>
                                    <Camera size={18} />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleAvatarUpload}
                                        disabled={uploadingAvatar}
                                    />
                                </label>
                            </div>

                            {/* Info */}
                            <div className="space-y-4 flex-1 w-full text-center md:text-left">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">{currentAppUser?.name || 'Đang tải...'}</h2>
                                    <p className="text-indigo-400 font-medium">{currentAppUser?.role || '---'} • {currentAppUser?.dept || '---'}</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                        <label className="text-xs text-slate-500 block mb-1">Email</label>
                                        <div className="text-sm text-slate-200 font-mono truncate">{currentAppUser?.email || currentUser?.email}</div>
                                    </div>
                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                        <label className="text-xs text-slate-500 block mb-1">Số điện thoại</label>
                                        <div className="text-sm text-slate-200 font-mono">{currentAppUser?.phone || '---'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SettingSection>
                </div>

                {/* 1. Giao diện & Hiển thị */}
                <SettingSection title={t.settings.interface} icon={Sun}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-slate-200">{t.settings.darkMode}</div>
                            <div className="text-xs text-slate-500">{t.settings.darkModeDesc}</div>
                        </div>
                        <Toggle checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-slate-200">{t.settings.language}</div>
                            <div className="text-xs text-slate-500">{t.settings.languageDesc}</div>
                        </div>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            className="bg-slate-900 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:border-indigo-500 outline-none"
                        >
                            <option value="vi">Tiếng Việt</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </SettingSection>

                {/* 2. Thông báo */}
                <SettingSection title={t.settings.notifications} icon={Bell}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Mail size={16} className="text-slate-400" />
                            <div>
                                <div className="text-sm font-bold text-slate-200">{t.settings.emailDigest}</div>
                                <div className="text-xs text-slate-500">{t.settings.emailDigestDesc}</div>
                            </div>
                        </div>
                        <Toggle checked={notifications.email} onChange={() => setNotifications({ ...notifications, email: !notifications.email })} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Smartphone size={16} className="text-slate-400" />
                            <div>
                                <div className="text-sm font-bold text-slate-200">{t.settings.pushNotif}</div>
                                <div className="text-xs text-slate-500">{t.settings.pushNotifDesc}</div>
                            </div>
                        </div>
                        <Toggle checked={notifications.push} onChange={handlePushToggle} />
                    </div>
                </SettingSection>

                {/* 3. Bảo mật */}
                <SettingSection title={t.settings.security} icon={Shield}>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                        <div className="flex items-center gap-3">
                            <Lock size={18} className="text-indigo-400" />
                            <div>
                                <div className="text-sm font-bold text-indigo-200">{t.settings.changePass}</div>
                                <div className="text-xs text-indigo-400/70">{t.settings.lastChanged}</div>
                            </div>
                        </div>
                        <button className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors font-bold">
                            {t.settings.update}
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-slate-200">{t.settings.twoFactor}</div>
                            <div className="text-xs text-slate-500">{t.settings.twoFactorDesc}</div>
                        </div>
                        <Toggle checked={true} onChange={() => { }} />
                    </div>
                </SettingSection>

                {/* 4. Dữ liệu Hệ thống */}
                <SettingSection title={t.settings.data} icon={Database}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-slate-200">{t.settings.autoBackup}</div>
                            <div className="text-xs text-slate-500">{t.settings.backupDesc}</div>
                        </div>
                        <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">{t.settings.active}</div>
                    </div>

                    <button
                        onClick={async () => {
                            if (confirm('Cập nhật thông tin nhân sự về dữ liệu gốc? (Sẽ cập nhật ngày sinh mới)')) {
                                await restoreDefaults();
                                alert('Đã cập nhật dữ liệu thành công!');
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 mt-4 border border-indigo-500/20 bg-indigo-500/10 rounded-xl text-indigo-400 hover:bg-indigo-500/20 transition-all font-bold"
                    >
                        <RefreshCw size={16} />
                        <span className="text-sm">Cập nhật Dữ liệu Gốc</span>
                    </button>

                    <button
                        onClick={() => {
                            if (confirm('Bạn có chắc chắn muốn xóa Cache Local Storage và tải lại trang?')) {
                                localStorage.clear();
                                window.location.reload();
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 mt-2 border border-white/10 rounded-xl text-slate-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all"
                    >
                        <HardDrive size={16} />
                        <span className="text-sm">Reset Local Storage</span>
                    </button>
                </SettingSection>

            </div>

            {/* Bottom Actions */}
            <div className="mt-6 flex justify-end gap-4 border-t border-white/10 pt-6">
                <button className="px-6 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors font-bold text-sm">
                    {t.settings.cancel}
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all font-bold text-sm flex items-center gap-2"
                >
                    {isSaving ? (
                        <><RefreshCw className="animate-spin" size={16} /> {t.settings.saving}</>
                    ) : (
                        <><Save size={16} /> {t.settings.save}</>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SettingsPage;

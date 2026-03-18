import React, { useState, useEffect } from 'react';
import {
    Sun, Bell, Shield, Database,
    Smartphone, Mail, Lock,
    HardDrive, RefreshCw, Save,
    User, Loader2, Camera, Fingerprint, UploadCloud
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { askPermission, registerServiceWorker, subscribeToPush } from '../../utils/pushManager';
import { fullBackupToDrive, parseBackupFile, restoreFromBackup } from '../../services/backupService';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Language } from '../../i18n/translations';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { uploadToDrive } from '../../services/driveUploadService';
import {
    isWebAuthnSupported,
    isPlatformAuthenticatorAvailable,
    isBiometricEnabled,
    registerBiometric,
    disableBiometric,
    getBiometricTypeName
} from '../../utils/biometricAuth';

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
            checked ? "bg-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.5)]" : "bg-bg-elevated border border-border"
        )}
    >
        <motion.div
            layout
            className={clsx(
                "w-4 h-4 rounded-full shadow-md",
                checked ? "bg-white" : "bg-text-muted"
            )}
            animate={{ x: checked ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
    </button>
);

const SettingSection = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="glass-panel p-6 rounded-2xl mb-6">
        <h3 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                <Icon size={20} />
            </div>
            {title}
        </h3>
        <div className="space-y-6">
            {children}
        </div>
    </div>
);

// Biometric Setting Row Component
const BiometricSettingRow: React.FC = () => {
    const [biometricAvailable, setBiometricAvailable] = React.useState(false);
    const [biometricEnabled, setBiometricEnabled] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [biometricTypeName, setBiometricTypeName] = React.useState('');
    const { currentUser } = useAuth();

    React.useEffect(() => {
        const checkBiometric = async () => {
            const supported = isWebAuthnSupported();
            const available = await isPlatformAuthenticatorAvailable();
            const enabled = isBiometricEnabled();

            setBiometricAvailable(supported && available);
            setBiometricEnabled(enabled);
            setBiometricTypeName(getBiometricTypeName());
        };

        checkBiometric();
    }, []);

    const handleBiometricToggle = async () => {
        if (biometricEnabled) {
            // Disable biometric
            if (window.confirm('Bạn có chắc muốn tắt đăng nhập sinh trắc học?')) {
                disableBiometric();
                setBiometricEnabled(false);
                alert('Đã tắt đăng nhập sinh trắc học.');
            }
        } else {
            // Enable biometric
            if (!currentUser?.email) {
                alert('Vui lòng đăng nhập trước khi thiết lập sinh trắc học.');
                return;
            }

            setIsLoading(true);
            try {
                await registerBiometric(currentUser.email, currentUser.displayName || currentUser.email);
                setBiometricEnabled(true);
                alert(`Đã kích hoạt ${biometricTypeName}! Lần đăng nhập tiếp theo bạn có thể sử dụng sinh trắc học.`);
            } catch (err: any) {
                alert(err.message || 'Lỗi thiết lập sinh trắc học.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    if (!biometricAvailable) {
        return (
            <div className="flex items-center justify-between p-3 rounded-xl bg-bg-main border border-border opacity-60">
                <div className="flex items-center gap-3">
                    <Fingerprint size={18} className="text-text-muted" />
                    <div>
                        <div className="text-sm font-bold text-text-muted">Đăng nhập sinh trắc học</div>
                        <div className="text-xs text-text-muted">Thiết bị không hỗ trợ</div>
                    </div>
                </div>
                <span className="text-xs text-text-muted bg-bg-elevated px-2 py-1 rounded">N/A</span>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center gap-3">
                <Fingerprint size={18} className={biometricEnabled ? "text-emerald-500" : "text-text-muted"} />
                <div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Đăng nhập bằng {biometricTypeName}</div>
                    <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                        {biometricEnabled ? 'Đã kích hoạt trên thiết bị này' : 'Bảo mật tối đa với sinh trắc học'}
                    </div>
                </div>
            </div>
            {isLoading ? (
                <Loader2 size={20} className="animate-spin text-emerald-500" />
            ) : (
                <Toggle checked={biometricEnabled} onChange={handleBiometricToggle} />
            )}
        </div>
    );
};


const SettingsPage: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const { language, setLanguage, t } = useLanguage();
    const { restoreDefaults, users } = useData();
    const { currentUser, isAdminView } = useAuth();

    // We remove local darkMode state since we use global theme context now
    const [notifications, setNotifications] = useState({
        email: true,
        // Default to TRUE if permission is already granted, otherwise match localStorage or false
        push: 'Notification' in window && Notification.permission === 'granted'
    });
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Get current App User details from Firestore data
    const currentAppUser = users.find(u => u.email === currentUser?.email);

    // Mobile Detection
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentAppUser) return;

        setUploadingAvatar(true);
        try {
            // Process Image (Crop Square + Max 1000px)
            const processedBlob = await processImage(file);

            // Upload to Google Drive
            const fileName = `${currentAppUser.id}_${Date.now()}.jpg`;
            const result = await uploadToDrive(
                new File([processedBlob], fileName, { type: 'image/jpeg' }),
                'avatars',
                fileName
            );

            if (!result.success || !result.url) {
                throw new Error(result.error || 'Upload failed');
            }

            // Update Firestore with Drive URL
            await updateDoc(doc(db, 'users', currentAppUser.id), {
                avatar: result.url
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
        // Sync state with actual permission status on mount
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                setNotifications(prev => ({ ...prev, push: true }));
            }
        }
    }, []);

    const handlePushToggle = async () => {
        if (!notifications.push) {
            // Turning ON
            try {
                const permission = await askPermission();
                if (permission === 'granted') {
                    const swReg = await registerServiceWorker();
                    if (swReg) {
                        const token = await subscribeToPush(swReg);

                        if (token && currentAppUser) {
                            // Save Token to Firestore for targeting
                            await updateDoc(doc(db, 'users', currentAppUser.id), {
                                fcmToken: token,
                                lastTokenUpdate: new Date().toISOString()
                            });
                        }

                        setNotifications(prev => ({ ...prev, push: true }));
                        alert(isMobile ? "✅ Đã bật thông báo trên thiết bị di động!" : t.settings.pushSuccess);
                    } else {
                        throw new Error("Service Worker not active");
                    }
                } else {
                    alert("QUYỀN BỊ CHẶN 🚫\n\nVui lòng vào Cài đặt -> Thông báo -> Bật thông báo cho trình duyệt này.");
                }
            } catch (err: any) {
                console.error("Push Error:", err);
                alert("Lỗi kích hoạt thông báo: " + (err.message || "Không xác định"));
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
            setNotifications(prev => ({
                ...prev,
                email: parsed.notifications?.email ?? true,
                // FORCE push to true if permission granted, otherwise trust storage
                push: ('Notification' in window && Notification.permission === 'granted') ? true : (parsed.notifications?.push ?? false)
            }));
        }
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        // Simulate network request and save to local storage
        setTimeout(() => {
            const settingsToSave = {
                // darkMode, // No longer saving here, managed by Context
                notifications
            };
            localStorage.setItem('avg_settings', JSON.stringify(settingsToSave));

            setIsSaving(false);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        }, 800);
    };

    return (
        <div className="flex flex-col p-2 pb-20 max-w-5xl mx-auto w-full relative">

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
                <h1 className="text-3xl font-bold text-text-main mb-1">{t.settings.title}</h1>
                <p className="text-text-muted text-sm">{t.settings.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 0. Hồ sơ cá nhân */}
                <div className="md:col-span-2">
                    <SettingSection title="Hồ sơ cá nhân" icon={User}>
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            {/* Avatar */}
                            <div className="relative group shrink-0">
                                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-bg-elevated shadow-2xl bg-bg-main relative">
                                    {currentAppUser?.avatar ? (
                                        <>
                                        <img src={currentAppUser.avatar} alt="Profile" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} />
                                        <div className="avatar-fallback absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-500 items-center justify-center text-white font-bold text-2xl" style={{display:'none'}}>{(currentAppUser.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-text-muted bg-bg-main">
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
                                    "absolute bottom-0 right-0 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg border-4 border-bg-card cursor-pointer transition-transform hover:scale-110 active:scale-95 group-hover:bottom-1 group-hover:right-1",
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
                                    <h2 className="text-2xl font-bold text-text-main mb-1">{currentAppUser?.name || 'Đang tải...'}</h2>
                                    <p className="text-indigo-500 font-medium">{currentAppUser?.role || '---'} • {currentAppUser?.dept || '---'}</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-3 bg-bg-main rounded-xl border border-border">
                                        <label className="text-xs text-text-muted block mb-1">Email</label>
                                        <div className="text-sm text-text-secondary font-mono truncate">{currentAppUser?.email || currentUser?.email}</div>
                                    </div>
                                    <div className="p-3 bg-bg-main rounded-xl border border-border">
                                        <label className="text-xs text-text-muted block mb-1">Số điện thoại</label>
                                        <div className="text-sm text-text-secondary font-mono">{currentAppUser?.phone || '---'}</div>
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
                            <div className="text-sm font-bold text-text-main flex items-center gap-2">
                                {t.settings.darkMode}
                                <span className={clsx("text-xs px-2 py-0.5 rounded-full border", theme === 'dark' ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-yellow-100 border-yellow-200 text-yellow-700")}>
                                    {theme === 'dark' ? 'Dark' : 'Light'}
                                </span>
                            </div>
                            <div className="text-xs text-text-muted">{t.settings.darkModeDesc}</div>
                        </div>
                        <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-text-main">{t.settings.language}</div>
                            <div className="text-xs text-text-muted">{t.settings.languageDesc}</div>
                        </div>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            className="bg-bg-main border border-border text-text-main text-sm rounded-lg px-3 py-1.5 focus:border-indigo-500 outline-none"
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
                            <Mail size={16} className="text-text-muted" />
                            <div>
                                <div className="text-sm font-bold text-text-main">{t.settings.emailDigest}</div>
                                <div className="text-xs text-text-muted">{t.settings.emailDigestDesc}</div>
                            </div>
                        </div>
                        <Toggle checked={notifications.email} onChange={() => setNotifications({ ...notifications, email: !notifications.email })} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Smartphone size={16} className="text-text-muted" />
                            <div>
                                <div className="text-sm font-bold text-text-main">{t.settings.pushNotif}</div>
                                <div className="text-xs text-text-muted">{t.settings.pushNotifDesc}</div>
                            </div>
                        </div>
                        {(currentAppUser?.isAdmin || currentAppUser?.email === 'mcngocsonvualoidan@gmail.com') && notifications.push && (
                            <div className="flex gap-2 ml-2">
                                <button
                                    onClick={async () => {
                                        const token = (currentAppUser as any)?.fcmToken;
                                        if (token) {
                                            navigator.clipboard.writeText(token);
                                            alert('Đã copy FCM Token vào clipboard!');
                                        } else {
                                            // Auto-fix: Try to get token now
                                            try {
                                                alert("Đang thử lấy lại Token...");
                                                const { registerServiceWorker, subscribeToPush } = await import('../../utils/pushManager');
                                                const swReg = await registerServiceWorker();
                                                if (swReg) {
                                                    const newToken = await subscribeToPush(swReg);
                                                    if (newToken && currentAppUser) {
                                                        await updateDoc(doc(db, 'users', currentAppUser.id), { fcmToken: newToken });
                                                        navigator.clipboard.writeText(newToken);
                                                        alert('✅ Đã khôi phục và copy Token thành công!');
                                                    } else {
                                                        alert('⚠️ Không thể lấy Token. Vui lòng cấp quyền thông báo lại hoặc Restart App.');
                                                    }
                                                }
                                            } catch (e) {
                                                console.error(e);
                                                alert('Chưa có Token. Hãy thử tắt và bật lại thông báo.');
                                            }
                                        }
                                    }}
                                    className="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors"
                                >
                                    Copy Token
                                </button>
                                <button
                                    onClick={async () => {
                                        if (Notification.permission === 'granted') {
                                            try {
                                                const reg = await navigator.serviceWorker.ready;
                                                await reg.showNotification("🔔 Kiểm tra Hệ thống", {
                                                    body: "Xin chào ngày mới! 🌞\nĐây là thông báo kiểm tra từ AVGFlow.",
                                                    icon: '/pwa-192x192.png',
                                                    badge: '/pwa-192x192.png'
                                                });
                                                alert("✅ Đã gửi tín hiệu thông báo!\n\nHãy kiểm tra thanh trạng thái (Status Bar) trên điện thoại.\nNếu không thấy: Kiểm tra chế độ 'Không làm phiền'.");
                                            } catch (e) {
                                                console.error(e);
                                                // Fallback
                                                new Notification("🔔 Kiểm tra (Fallback)", {
                                                    body: "Xin chào ngày mới! (Fallback Mode)"
                                                });
                                            }
                                        } else {
                                            alert("Chưa cấp quyền thông báo! Vui lòng bật Toggle bên cạnh.");
                                        }
                                    }}
                                    className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors animate-pulse"
                                >
                                    Test Notif
                                </button>
                            </div>
                        )}
                        <Toggle checked={notifications.push} onChange={handlePushToggle} />
                    </div>
                </SettingSection>

                {/* 3. Bảo mật */}
                <SettingSection title={t.settings.security} icon={Shield}>
                    {/* Biometric Authentication */}
                    <BiometricSettingRow />

                    <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                        <div className="flex items-center gap-3">
                            <Lock size={18} className="text-indigo-400" />
                            <div>
                                <div className="text-sm font-bold text-indigo-500 dark:text-indigo-300">{t.settings.changePass}</div>
                                <div className="text-xs text-indigo-400/70">{t.settings.lastChanged}</div>
                            </div>
                        </div>
                        <button className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors font-bold">
                            {t.settings.update}
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-text-main">{t.settings.twoFactor}</div>
                            <div className="text-xs text-text-muted">{t.settings.twoFactorDesc}</div>
                        </div>
                        <Toggle checked={true} onChange={() => { }} />
                    </div>
                </SettingSection>

                {/* 4. Dữ liệu Hệ thống — Admin Only */}
                {isAdminView && (currentAppUser?.isAdmin || currentAppUser?.email === 'mcngocsonvualoidan@gmail.com') && (
                    <SettingSection title={t.settings.data} icon={Database}>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold text-text-main">{t.settings.autoBackup}</div>
                                <div className="text-xs text-text-muted">{t.settings.backupDesc}</div>
                            </div>
                            <div className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">{t.settings.active}</div>
                        </div>

                        <button
                            onClick={async () => {
                                if (confirm('Sao lưu toàn bộ dữ liệu lên Google Drive ngay lập tức?')) {
                                    setIsSaving(true);
                                    try {
                                        const res = await fullBackupToDrive();
                                        if (res.success) {
                                            alert(`✅ Sao lưu thành công!\nFile: ${res.fileName}\nSố collection: ${res.collections}\nTổng documents: ${res.totalDocuments}`);
                                        } else {
                                            alert('❌ Sao lưu thất bại: ' + (res.error || 'Unknown error'));
                                        }
                                    } catch (e) {
                                        alert('Lỗi: ' + e);
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 mt-4 border border-blue-500/20 bg-blue-500/10 rounded-xl text-blue-500 hover:bg-blue-500/20 transition-all font-bold"
                        >
                            <Database size={16} />
                            <span className="text-sm">Sao lưu ngay (Google Drive)</span>
                        </button>

                        <button
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.json';
                                input.onchange = async (e: any) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    setIsSaving(true);
                                    try {
                                        const text = await file.text();
                                        const parsed = parseBackupFile(text);

                                        if (!parsed.valid || !parsed.data) {
                                            alert('❌ ' + (parsed.error || 'File không hợp lệ'));
                                            return;
                                        }

                                        const s = parsed.summary!;
                                        const confirmMsg = `📋 Thông tin backup:\n` +
                                            `• Ngày backup: ${new Date(s.date).toLocaleString('vi-VN')}\n` +
                                            `• Số collection: ${s.collections}\n` +
                                            `• Tổng documents: ${s.documents}\n` +
                                            `• Realtime paths: ${s.realtimePaths}\n\n` +
                                            `⚠️ Dữ liệu hiện tại sẽ được GHI ĐÈ bởi backup.\n` +
                                            `Bạn có chắc chắn muốn khôi phục?`;

                                        if (!confirm(confirmMsg)) return;

                                        const result = await restoreFromBackup(parsed.data);

                                        if (result.success) {
                                            alert(
                                                `✅ Khôi phục thành công!\n` +
                                                `• Collections: ${result.collectionsRestored}\n` +
                                                `• Documents: ${result.documentsRestored}\n` +
                                                `• Realtime paths: ${result.realtimePathsRestored}`
                                            );
                                        } else {
                                            alert('❌ Khôi phục thất bại: ' + (result.error || 'Unknown'));
                                        }
                                    } catch (err) {
                                        alert('Lỗi: ' + err);
                                    } finally {
                                        setIsSaving(false);
                                    }
                                };
                                input.click();
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 mt-2 border border-amber-500/20 bg-amber-500/10 rounded-xl text-amber-500 hover:bg-amber-500/20 transition-all font-bold"
                        >
                            <UploadCloud size={16} />
                            <span className="text-sm">Khôi phục từ Backup (.json)</span>
                        </button>

                        <button
                            onClick={async () => {
                                if (confirm('Cập nhật thông tin nhân sự về dữ liệu gốc? (Sẽ cập nhật ngày sinh mới)')) {
                                    await restoreDefaults();
                                    alert('Đã cập nhật dữ liệu thành công!');
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 mt-4 border border-indigo-500/20 bg-indigo-500/10 rounded-xl text-indigo-500 hover:bg-indigo-500/20 transition-all font-bold"
                        >
                            <RefreshCw size={16} />
                            <span className="text-sm">Cập nhật Dữ liệu Gốc</span>
                        </button>

                        <button
                            onClick={async () => {
                                if (confirm('⚠️ HÀNH ĐỘNG MẠNH:\n- Xóa toàn bộ Cache & Assets\n- Gỡ bỏ Service Worker cũ\n- Đăng xuất & Reset App\n\nBạn có chắc chắn muốn làm sạch triệt để?')) {
                                    try {
                                        // 1. Clear Storage
                                        localStorage.clear();
                                        sessionStorage.clear();

                                        // 2. Unregister Service Workers
                                        if ('serviceWorker' in navigator) {
                                            const registrations = await navigator.serviceWorker.getRegistrations();
                                            for (const registration of registrations) {
                                                await registration.unregister();
                                            }
                                        }

                                        // 3. Clear Cache Storage (Files)
                                        if ('caches' in window) {
                                            const cacheNames = await caches.keys();
                                            await Promise.all(cacheNames.map(name => caches.delete(name)));
                                        }

                                        alert('✅ Đã dọn dẹp sạch sẽ! Ứng dụng sẽ tự tải lại phiên bản mới nhất.');
                                        window.location.href = '/';
                                    } catch (e) {
                                        console.error(e);
                                        window.location.reload();
                                    }
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3 mt-2 border border-red-500/30 bg-red-500/5 rounded-xl text-red-500 hover:bg-red-500/10 transition-all font-bold"
                        >
                            <HardDrive size={16} />
                            <span className="text-sm">Factory Reset (Xóa sạch Cache & Lỗi)</span>
                        </button>

                        <button
                            onClick={() => {
                                if (confirm('Xóa cài đặt sinh trắc học để test lại từ đầu?')) {
                                    localStorage.removeItem('avgflow_first_login_done');
                                    localStorage.removeItem('avgflow_biometric_prompt_shown');
                                    localStorage.removeItem('avgflow_biometric_enabled');
                                    localStorage.removeItem('avgflow_biometric_credential');
                                    localStorage.removeItem('avgflow_biometric_user');
                                    alert('✅ Đã xóa! Đăng xuất để test lại.');
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 mt-2 border border-amber-500/20 rounded-xl text-amber-500/70 hover:text-amber-500 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all"
                        >
                            <Fingerprint size={16} />
                            <span className="text-sm">Reset Sinh trắc học (Test)</span>
                        </button>
                    </SettingSection>
                )}

            </div>

            {/* Bottom Actions */}
            <div className="mt-6 flex justify-end gap-4 border-t border-border pt-6">
                <button className="px-6 py-2.5 rounded-xl text-text-muted hover:text-text-main hover:bg-bg-elevated transition-colors font-bold text-sm">
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

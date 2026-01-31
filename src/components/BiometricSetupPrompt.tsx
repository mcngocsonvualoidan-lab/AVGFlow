import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Settings, X, Shield, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getBiometricTypeName, isPlatformAuthenticatorAvailable, isWebAuthnSupported } from '../utils/biometricAuth';

interface BiometricSetupPromptProps {
    isOpen: boolean;
    onClose: () => void;
    onSkip: () => void;
}

const BiometricSetupPrompt: React.FC<BiometricSetupPromptProps> = ({ isOpen, onClose, onSkip }) => {
    const navigate = useNavigate();
    const [biometricType, setBiometricType] = React.useState('');
    const [isSupported, setIsSupported] = React.useState(false);

    React.useEffect(() => {
        const checkSupport = async () => {
            const supported = isWebAuthnSupported();
            const available = await isPlatformAuthenticatorAvailable();
            setIsSupported(supported && available);
            setBiometricType(getBiometricTypeName());
        };
        checkSupport();
    }, []);

    const handleGoToSettings = () => {
        // Mark that user wants to set up biometric
        localStorage.setItem('avgflow_pending_biometric_setup', 'true');
        onClose();
        navigate('/settings');
    };

    const handleSkip = () => {
        // Mark that user has been asked and declined
        localStorage.setItem('avgflow_biometric_prompt_shown', 'true');
        onSkip();
    };

    if (!isSupported) {
        return null;
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl border border-white/10 shadow-2xl max-w-md w-full overflow-hidden"
                    >
                        {/* Header */}
                        <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 p-6 pb-16">
                            <button
                                onClick={handleSkip}
                                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={20} className="text-white/80" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <Shield size={28} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Bảo mật tối ưu</h2>
                                    <p className="text-emerald-100 text-sm">Đăng nhập nhanh & an toàn</p>
                                </div>
                            </div>
                        </div>

                        {/* Icon Float */}
                        <div className="flex justify-center -mt-10 mb-4">
                            <div className="p-5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/30 border-4 border-[#0f172a]">
                                <Fingerprint size={40} className="text-white" />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 pb-6 text-center">
                            <h3 className="text-lg font-bold text-white mb-2">
                                Bật đăng nhập bằng {biometricType}?
                            </h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Lần sau bạn chỉ cần xác thực sinh trắc học để đăng nhập nhanh chóng và an toàn hơn.
                            </p>

                            {/* Benefits */}
                            <div className="space-y-3 mb-6 text-left">
                                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                                    <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
                                    <span className="text-sm text-slate-300">Đăng nhập chỉ trong 1 giây</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                                    <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
                                    <span className="text-sm text-slate-300">Không cần nhập mật khẩu</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                                    <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
                                    <span className="text-sm text-slate-300">Bảo mật cao với sinh trắc học</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-3">
                                <button
                                    onClick={handleGoToSettings}
                                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                                >
                                    <Settings size={18} />
                                    Mở Cài đặt để bật
                                </button>
                                <button
                                    onClick={handleSkip}
                                    className="w-full py-3 text-slate-400 hover:text-white transition-colors text-sm"
                                >
                                    Để sau
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BiometricSetupPrompt;

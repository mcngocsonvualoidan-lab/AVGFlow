import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, ArrowRight, Chrome, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { clsx } from 'clsx';
import TetDecorations from '../components/TetDecorations';

const Login: React.FC = () => {
    const { loginGoogle, loginEmail, resetPassword } = useAuth();
    const { t, language, setLanguage } = useLanguage();
    const [mode, setMode] = useState<'login' | 'forgot' | 'email'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const getFriendlyErrorMessage = (err: any) => {
        const msg = err.message || JSON.stringify(err);
        if (msg.includes('auth/configuration-not-found')) {
            return "Google Sign-In is not enabled. Please enable it in Firebase Console -> Authentication -> Sign-in method.";
        }
        if (msg.includes('auth/popup-closed-by-user')) {
            return "Sign-in popup closed before completion.";
        }
        if (msg.includes('auth/invalid-email')) {
            return "Invalid email address.";
        }
        if (msg.includes('auth/user-not-found') || msg.includes('auth/wrong-password')) {
            return "Incorrect email or password.";
        }
        return t.auth.error + ": " + msg;
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            await loginGoogle();
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
            setIsLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await loginEmail(email, password);
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            await resetPassword(email);
            setMessage(t.auth.resetSent);
            setTimeout(() => setMode('login'), 3000);
        } catch (err: any) {
            setError(t.auth.error + ": " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Language Switcher */}
            <div className="absolute top-6 right-6 z-20 flex gap-2">
                <button
                    onClick={() => setLanguage('vi')}
                    className={clsx("px-3 py-1 rounded-full text-xs font-bold transition-all border", language === 'vi' ? "bg-indigo-500 text-white border-indigo-500" : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10")}
                >
                    VN
                </button>
                <button
                    onClick={() => setLanguage('en')}
                    className={clsx("px-3 py-1 rounded-full text-xs font-bold transition-all border", language === 'en' ? "bg-indigo-500 text-white border-indigo-500" : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10")}
                >
                    EN
                </button>
            </div>

            {/* Ambient Background */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[150px] animate-pulse-slow" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-cyan-600/10 rounded-full blur-[150px] animate-pulse-slow delay-1000" />

            <div className="w-full max-w-md relative z-10">
                {/* Brand */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
                        AVG<span className="font-light text-white">Flow</span>
                    </h1>
                    <p className="text-slate-400 text-sm">{t.auth.subtitle}</p>
                </div>

                <AnimatePresence mode="wait">
                    {mode === 'login' ? (
                        <motion.div
                            key="login"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500" />

                            <h2 className="text-2xl font-bold text-white mb-6 text-center">{t.auth.title}</h2>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-4 text-center">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <button
                                    onClick={handleGoogleLogin}
                                    disabled={isLoading}
                                    className="w-full bg-white text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isLoading && !password ? (
                                        <RefreshCw size={20} className="animate-spin text-slate-500" />
                                    ) : (
                                        <>
                                            <Chrome size={20} className="text-indigo-600" />
                                            {t.auth.googleLogin}
                                        </>
                                    )}
                                </button>

                                <div className="relative flex py-2 items-center">
                                    <div className="flex-grow border-t border-white/10"></div>
                                    <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase tracking-wider">or</span>
                                    <div className="flex-grow border-t border-white/10"></div>
                                </div>

                                <button
                                    onClick={() => setMode('email')}
                                    className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-white/10"
                                >
                                    <Mail size={18} /> Login with Email
                                </button>

                                <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
                                    <ShieldCheck size={14} className="text-emerald-500" />
                                    <span>2-Factor Auth Enabled via Google</span>
                                </div>
                            </div>
                        </motion.div>
                    ) : mode === 'email' ? (
                        <motion.div
                            key="email"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative"
                        >
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500" />
                            <h2 className="text-2xl font-bold text-white mb-6 text-center">{t.auth.login}</h2>

                            {error && <div className="text-red-400 text-sm mb-4 text-center">{error}</div>}

                            <form onSubmit={handleEmailLogin} className="space-y-4">
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={t.auth.email}
                                        required
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={t.auth.password}
                                        required
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                                >
                                    {isLoading ? <RefreshCw size={18} className="animate-spin" /> : t.auth.login}
                                </button>
                            </form>
                            <div className="mt-4 flex flex-col gap-2 text-center text-sm">
                                <button onClick={() => setMode('forgot')} className="text-slate-400 hover:text-indigo-400 transition-colors">
                                    {t.auth.forgotPass}
                                </button>
                                <button onClick={() => setMode('login')} className="text-slate-400 hover:text-white transition-colors">
                                    {t.auth.backToLogin}
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="forgot"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative"
                        >
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500" />

                            <h2 className="text-2xl font-bold text-white mb-2 text-center">{t.auth.resetPass}</h2>
                            <p className="text-slate-400 text-center text-sm mb-6">{t.auth.resetDesc}</p>

                            {message && <div className="text-emerald-400 text-sm mb-4 text-center">{message}</div>}
                            {error && <div className="text-red-400 text-sm mb-4 text-center">{error}</div>}

                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={t.auth.email}
                                        required
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
                                >
                                    {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <>{t.auth.sendLink} <ArrowRight size={18} /></>}
                                </button>
                            </form>

                            <button
                                onClick={() => setMode('login')}
                                className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors mt-6"
                            >
                                {t.auth.backToLogin}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="absolute bottom-4 text-slate-600 text-xs text-center px-4">
                © 2026 AVGFlow System. Secured by Firebase. <br />
                🧧 Chúc Mừng Năm Mới - Tết Bính Ngọ 2026 🧧
            </div>

            {/* TẾT 2026 DECORATIONS */}
            <TetDecorations />
        </div>
    );
};

export default Login;

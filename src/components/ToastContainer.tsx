import { useData } from '../context/DataContext';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContainer = () => {
    const { toasts, removeToast } = useData();

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, x: 100, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.9 }}
                        layout
                        className="pointer-events-auto"
                    >
                        <div className={clsx(
                            "min-w-[300px] max-w-sm p-4 rounded-xl shadow-2xl border backdrop-blur-md flex items-start gap-3 relative overflow-hidden",
                            toast.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200" :
                                toast.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-200" :
                                    toast.type === 'alert' ? "bg-amber-500/10 border-amber-500/20 text-amber-200" :
                                        "bg-blue-500/10 border-blue-500/20 text-blue-200"
                        )}>
                            {/* Icon */}
                            <div className="mt-0.5">
                                {toast.type === 'success' && <CheckCircle size={20} className="text-emerald-400" />}
                                {toast.type === 'error' && <AlertCircle size={20} className="text-red-400" />}
                                {toast.type === 'alert' && <AlertTriangle size={20} className="text-amber-400" />}
                                {(toast.type === 'info' || !toast.type) && <Info size={20} className="text-blue-400" />}
                            </div>

                            <div className="flex-1">
                                <h4 className={clsx("font-bold text-sm mb-1",
                                    toast.type === 'success' ? "text-emerald-400" :
                                        toast.type === 'error' ? "text-red-400" :
                                            toast.type === 'alert' ? "text-amber-400" : "text-blue-400"
                                )}>
                                    {toast.title}
                                </h4>
                                <p className="text-xs opacity-90 leading-relaxed">
                                    {toast.message}
                                </p>
                            </div>

                            <button
                                onClick={() => removeToast(toast.id)}
                                className="p-1 hover:bg-white/10 rounded-lg transition-colors -mr-2 -mt-2 opacity-60 hover:opacity-100"
                            >
                                <X size={16} />
                            </button>

                            {/* Progress Bar */}
                            <motion.div
                                initial={{ width: "100%" }}
                                animate={{ width: "0%" }}
                                transition={{ duration: 5, ease: "linear" }}
                                className={clsx("absolute bottom-0 left-0 h-0.5",
                                    toast.type === 'success' ? "bg-emerald-500/50" :
                                        toast.type === 'error' ? "bg-red-500/50" :
                                            toast.type === 'alert' ? "bg-amber-500/50" : "bg-blue-500/50"
                                )}
                            />
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default ToastContainer;

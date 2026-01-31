import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Download } from 'lucide-react';

const UpdateNotification: React.FC = () => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const handleUpdateAvailable = () => {
            setShow(true);
        };

        window.addEventListener('sw-update-available', handleUpdateAvailable);

        return () => {
            window.removeEventListener('sw-update-available', handleUpdateAvailable);
        };
    }, []);

    const handleUpdate = () => {
        // @ts-ignore
        if (window.updateApp) {
            // @ts-ignore
            window.updateApp();
        } else {
            window.location.reload();
        }
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-6 right-6 z-[99999] flex flex-col md:flex-row items-end md:items-center gap-4"
                >
                    <div className="bg-slate-900/90 backdrop-blur-md border border-indigo-500/50 p-4 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.3)] flex items-center gap-4 max-w-sm md:max-w-md">
                        <div className="bg-indigo-600 p-3 rounded-xl animate-pulse">
                            <Download className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-white font-bold text-sm">Cập nhật khả dụng!</h3>
                            <p className="text-slate-300 text-xs mt-1">
                                Phiên bản mới của ứng dụng đã sẵn sàng. Tải lại để áp dụng thay đổi.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleUpdate}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 whitespace-nowrap"
                            >
                                <RefreshCw size={14} />
                                Cập nhật ngay
                            </button>
                            <button
                                onClick={() => setShow(false)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold rounded-lg transition-all"
                            >
                                Để sau
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default UpdateNotification;

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, Calendar, MapPin, Star } from 'lucide-react';
import ReactConfetti from 'react-confetti';
import { useData } from '../context/DataContext';

const InvitationModal: React.FC = () => {
    const { invitation, setInvitation } = useData();

    if (!invitation) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setInvitation(null)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                {/* Confetti */}
                <ReactConfetti
                    width={window.innerWidth}
                    height={window.innerHeight}
                    numberOfPieces={200}
                    recycle={false}
                    colors={['#FFD700', '#FF0000', '#FFFFFF']}
                />

                {/* Card */}
                <motion.div
                    initial={{ scale: 0.5, opacity: 0, rotateX: 90 }}
                    animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border-4 border-amber-500/50"
                >
                    {/* Header Image / Pattern */}
                    <div className="h-32 bg-gradient-to-r from-red-600 to-amber-600 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                        <Gift size={64} className="text-white drop-shadow-lg animate-bounce" />
                    </div>

                    {/* Content */}
                    <div className="p-8 text-center">
                        <h2 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">
                            {invitation.title}
                        </h2>

                        <div className="w-16 h-1 bg-amber-500 mx-auto mb-6 rounded-full" />

                        <p className="text-text-main text-lg leading-relaxed mb-6 font-medium">
                            {invitation.body}
                        </p>

                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/50 mb-6 space-y-2">
                            <div className="flex items-center gap-3 text-sm text-text-secondary justify-center">
                                <Calendar size={16} className="text-amber-500" />
                                <span>Thời gian: <strong>18:00 - 21/01/2026</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-text-secondary justify-center">
                                <MapPin size={16} className="text-amber-500" />
                                <span>Địa điểm: <strong>Grand Ball Room</strong></span>
                            </div>
                        </div>

                        <button
                            onClick={() => setInvitation(null)}
                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-red-500 text-white rounded-xl font-bold shadow-lg shadow-amber-500/30 hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                        >
                            <Star size={18} fill="currentColor" />
                            XÁC NHẬN THAM GIA
                        </button>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={() => setInvitation(null)}
                        className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default InvitationModal;

import React, { useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Gift, Clock, Heart, MessageCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

const MyBirthdayWishes: React.FC = () => {
    const { currentUser } = useAuth();
    const { users, birthdayWishes, markWishAsRead } = useData();

    const appUser = users.find(u => u.email === currentUser?.email);
    const myWishes = birthdayWishes.filter(w => w.toUserId === appUser?.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Mark all visible as read
    useEffect(() => {
        if (myWishes.length > 0) {
            myWishes.forEach(w => {
                if (!w.isRead) markWishAsRead(w.id);
            });
        }
    }, [myWishes.length, markWishAsRead]);

    if (!appUser) return <div>Loading...</div>;

    const getWishStyle = (type?: string) => {
        switch (type) {
            case 'wedding': return {
                icon: <Sparkles size={48} className="text-yellow-500 fill-yellow-500" />,
                border: 'hover:border-yellow-500/30',
                avatarBg: 'bg-gradient-to-tr from-yellow-500 to-amber-600',
                iconSmall: <Sparkles size={32} />
            };
            case 'funeral': return {
                icon: <Heart size={48} className="text-slate-500 fill-slate-500" />,
                border: 'hover:border-slate-500/30',
                avatarBg: 'bg-gradient-to-tr from-slate-500 to-gray-600',
                iconSmall: <Heart size={32} />
            };
            default: return {
                icon: <Heart size={48} className="text-pink-500 fill-pink-500" />,
                border: 'hover:border-pink-500/30',
                avatarBg: 'bg-gradient-to-tr from-indigo-500 to-purple-500',
                iconSmall: <Gift size={32} />
            };
        }
    };

    return (
        <div className="min-h-[80vh] relative p-6">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-10 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl shadow-lg shadow-pink-500/20 text-white animate-bounce-slow">
                        <Gift size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Hộp thư yêu thương 💌</h1>
                        <p className="text-slate-400">Những lời nhắn gửi ấm áp từ đồng nghiệp tại AVGFlow</p>
                    </div>
                </div>

                {myWishes.length === 0 ? (
                    <div className="bg-[#1e293b]/50 border border-white/5 rounded-2xl p-12 text-center backdrop-blur-sm">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                            <MessageCircle size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Chưa có lời nhắn nào</h3>
                        <p className="text-slate-400">Hãy chờ đợi những bất ngờ từ đồng nghiệp nhé! ✨</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {myWishes.map((wish, index) => {
                            const style = getWishStyle(wish.type);
                            return (
                                <motion.div
                                    key={wish.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={clsx(
                                        "bg-[#1e293b] border border-white/10 rounded-2xl p-5 transition-all group relative overflow-hidden",
                                        style.border
                                    )}
                                >
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        {style.icon}
                                    </div>

                                    <div className="flex items-start gap-3 relative z-10">
                                        <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg", style.avatarBg)}>
                                            {wish.fromUserName.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-white">{wish.fromUserName}</h3>
                                                <span className="text-[10px] text-slate-500 flex items-center gap-1 bg-slate-800/50 px-2 py-0.5 rounded-full">
                                                    <Clock size={10} />
                                                    {new Date(wish.timestamp).toLocaleDateString('vi-VN')}
                                                </span>
                                            </div>
                                            <div className="bg-[#0f172a]/50 rounded-xl p-3 border border-white/5 text-slate-300 text-sm italic leading-relaxed">
                                                "{wish.message}"
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyBirthdayWishes;

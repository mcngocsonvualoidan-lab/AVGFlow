import React, { useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Gift, Clock, Heart, MessageCircle, Sparkles, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import HeroBanner from '../../components/HeroBanner';

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

    const uniqueSenders = new Set(myWishes.map(w => w.fromUserName)).size;
    const latestWish = myWishes[0];

    return (
        <div className="min-h-screen relative pb-10 bg-slate-50 dark:bg-[#0f172a] transition-colors duration-300">
            {/* Background Decoration */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-20 left-[10%] w-[500px] h-[500px] bg-pink-500/10 dark:bg-pink-500/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-normal" />
                <div className="absolute bottom-20 right-[10%] w-[500px] h-[500px] bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-normal" />
            </div>

            <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
                <HeroBanner
                    icon={Heart}
                    title="Thông điệp yêu thương"
                    subtitle="LOVE & APPRECIATION"
                    description="Gửi và nhận những lời chúc, lời cảm ơn ấm áp từ đồng nghiệp. Một lời động viên nhỏ có thể tạo nên niềm vui lớn mỗi ngày."
                    gradientFrom="from-pink-500"
                    gradientVia="via-rose-500"
                    gradientTo="to-red-500"
                    accentColor="rose"
                    badge="AVG Culture"
                    stats={[
                        {
                            icon: MessageCircle,
                            label: "Tổng tin nhắn",
                            value: myWishes.length,
                            color: "from-pink-400 to-rose-500"
                        },
                        {
                            icon: Users,
                            label: "Người gửi",
                            value: uniqueSenders,
                            color: "from-indigo-400 to-blue-500"
                        },
                        {
                            icon: Clock,
                            label: "Mới nhất",
                            value: latestWish ? new Date(latestWish.timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : "--/--",
                            color: "from-amber-400 to-orange-500"
                        }
                    ]}
                />

                <div className="mt-8">
                    {myWishes.length === 0 ? (
                        <div className="mt-8 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 rounded-[2rem] p-12 text-center backdrop-blur-md shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10">
                            {/* Empty State Decoration */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-all duration-700 group-hover:bg-indigo-500/10" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

                            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400 dark:text-slate-500 shadow-inner relative z-10 ring-4 ring-white dark:ring-slate-800">
                                <MessageCircle size={40} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 relative z-10">
                                Chưa có lời nhắn nào
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto relative z-10 leading-relaxed font-medium">
                                Hãy chờ đợi những bất ngờ từ đồng nghiệp nhé! <br />
                                Một lời chúc chân thành có thể làm bừng sáng cả ngày của bạn. ✨
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {myWishes.map((wish, index) => {
                                const style = getWishStyle(wish.type);
                                return (
                                    <motion.div
                                        key={wish.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className={clsx(
                                            "rounded-[1.5rem] p-6 transition-all group relative overflow-hidden backdrop-blur-sm border shadow-sm hover:shadow-md",
                                            "bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 hover:border-indigo-500/30 dark:hover:border-indigo-500/30",
                                            style.border
                                        )}
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                                            {style.icon}
                                        </div>

                                        <div className="flex items-start gap-4 relative z-10">
                                            <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0", style.avatarBg)}>
                                                {wish.fromUserName.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{wish.fromUserName}</h3>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Đồng nghiệp</p>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/50 px-2.5 py-1 rounded-full border border-slate-200 dark:border-white/5">
                                                        <Clock size={11} className="text-indigo-500" />
                                                        {new Date(wish.timestamp).toLocaleDateString('vi-VN')}
                                                    </span>
                                                </div>

                                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-white/5 relative group-hover:bg-indigo-50/50 dark:group-hover:bg-slate-900/80 transition-colors">
                                                    {/* Quote Icon */}
                                                    <div className="absolute -top-2 -left-1 text-slate-300 dark:text-slate-700 text-2xl font-serif leading-none">“</div>
                                                    <p className="text-slate-700 dark:text-slate-300 text-sm italic leading-relaxed relative z-10">
                                                        {wish.message}
                                                    </p>
                                                    <div className="absolute -bottom-4 -right-1 text-slate-300 dark:text-slate-700 text-2xl font-serif leading-none rotate-180">“</div>
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
        </div>
    );
};

export default MyBirthdayWishes;

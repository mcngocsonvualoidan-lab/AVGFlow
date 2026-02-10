import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

export interface HeroBannerStat {
    icon: LucideIcon;
    label: string;
    value: number | string;
    color: string; // e.g., 'from-emerald-400 to-green-500'
}

export interface HeroBannerProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    description: string;
    badge?: string;
    badgeIcon?: LucideIcon;
    secondBadge?: string;
    stats?: HeroBannerStat[];
    gradientFrom?: string;
    gradientVia?: string;
    gradientTo?: string;
    accentColor?: string;
}

const HeroBanner: React.FC<HeroBannerProps> = ({
    icon: MainIcon,
    title,
    subtitle,
    description,
    badge,
    badgeIcon: BadgeIcon = Sparkles,
    secondBadge,
    stats = [],
    gradientFrom = 'from-indigo-600',
    gradientVia = 'via-violet-600',
    gradientTo = 'to-purple-700',
    accentColor = 'cyan',
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx(
                "relative overflow-hidden rounded-3xl shadow-2xl",
                `bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo}`,
                `dark:${gradientFrom.replace('600', '900')} dark:${gradientVia.replace('600', '900')} dark:${gradientTo.replace('700', '950')}`,
                "shadow-indigo-500/30"
            )}
        >
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className={`absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-${accentColor}-400/30 to-transparent rounded-full blur-3xl animate-pulse`} />
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-gradient-to-tr from-pink-500/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full" />

                {/* Floating particles */}
                <motion.div
                    animate={{ y: [-10, 10, -10], rotate: [0, 180, 360] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className={`absolute top-10 right-20 w-3 h-3 bg-${accentColor}-400/60 rounded-full`}
                />
                <motion.div
                    animate={{ y: [10, -10, 10], rotate: [360, 180, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-16 right-40 w-2 h-2 bg-pink-400/60 rounded-full"
                />
                <motion.div
                    animate={{ x: [-10, 10, -10] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    className="absolute top-20 left-1/3 w-2 h-2 bg-yellow-400/60 rounded-full"
                />
            </div>

            {/* Content */}
            <div className="relative z-10 p-8 md:p-10">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    {/* Left Content */}
                    <div className="flex-1 max-w-2xl">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex items-center gap-2 mb-4 flex-wrap"
                        >
                            {badge && (
                                <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <BadgeIcon size={12} className="text-yellow-300" />
                                    {badge}
                                </span>
                            )}
                            {secondBadge && (
                                <span className="px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                                    <Zap size={12} />
                                    {secondBadge}
                                </span>
                            )}
                        </motion.div>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2"
                        >
                            {subtitle}
                        </motion.p>

                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight"
                        >
                            {title}
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-white/70 text-sm md:text-base leading-relaxed mb-6"
                        >
                            {description}
                        </motion.p>

                        {/* Quick Stats */}
                        {stats.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="flex flex-wrap gap-2 sm:gap-3"
                            >
                                {stats.map((stat, i) => (
                                    <div key={i} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors cursor-default">
                                        <div className={`p-1 sm:p-1.5 rounded-lg bg-gradient-to-br ${stat.color}`}>
                                            <stat.icon size={12} className="sm:w-3.5 sm:h-3.5 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-lg sm:text-2xl font-black text-white leading-none">{stat.value}</div>
                                            <div className="text-[9px] sm:text-[10px] text-white/60 font-medium uppercase tracking-wider">{stat.label}</div>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </div>

                    {/* Right Decorative Element */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6, type: "spring" }}
                        className="hidden lg:flex items-center justify-center"
                    >
                        <div className="relative">
                            <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
                                <MainIcon size={64} className="text-white/90" />
                            </div>
                            <div className={`absolute -top-3 -right-3 w-12 h-12 rounded-xl bg-gradient-to-br from-${accentColor}-400 to-blue-500 flex items-center justify-center shadow-lg animate-bounce`}>
                                <Sparkles size={20} className="text-white" />
                            </div>
                            <div className="absolute -bottom-2 -left-2 w-10 h-10 rounded-lg bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-lg">
                                <Zap size={16} className="text-white" />
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Bottom Wave Effect */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </motion.div>
    );
};

export default HeroBanner;

import React, { useEffect, useState } from 'react';
import { CURRENT_EVENT } from '../constants/eventConfig';

// --- FALLING PARTICLES (driven by eventConfig) ---
interface Particle {
    id: number;
    x: number;
    delay: number;
    duration: number;
    size: number;
    type: 'star' | 'sparkle' | 'dot' | 'petal' | 'heart';
    rotation: number;
    opacity: number;
}

const FallingParticles: React.FC = () => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const config = CURRENT_EVENT.particles;

    useEffect(() => {
        const items: Particle[] = [];
        for (let i = 0; i < config.count; i++) {
            // Pick type based on weights
            const rand = Math.random();
            let cumulative = 0;
            let selectedType = config.types[0];
            for (let t = 0; t < config.types.length; t++) {
                cumulative += config.weights[t];
                if (rand <= cumulative) {
                    selectedType = config.types[t];
                    break;
                }
            }

            items.push({
                id: i,
                x: Math.random() * 100,
                delay: Math.random() * 15,
                duration: 10 + Math.random() * 12,
                size: 8 + Math.random() * 12,
                type: selectedType,
                rotation: Math.random() * 360,
                opacity: 0.25 + Math.random() * 0.35,
            });
        }
        setParticles(items);
    }, []);

    const renderParticle = (p: Particle) => {
        switch (p.type) {
            case 'star':
                return (
                    <svg viewBox="0 0 24 24" className="w-full h-full">
                        <defs>
                            <linearGradient id={`starGrad${p.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={config.primaryColor} />
                                <stop offset="100%" stopColor={config.primaryColor} stopOpacity="0.8" />
                            </linearGradient>
                        </defs>
                        <path
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                            fill={`url(#starGrad${p.id})`}
                        />
                    </svg>
                );
            case 'sparkle':
                return (
                    <svg viewBox="0 0 24 24" className="w-full h-full">
                        <defs>
                            <radialGradient id={`sparkleGrad${p.id}`} cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={config.primaryColor} />
                                <stop offset="100%" stopColor={config.secondaryColor} stopOpacity="0.6" />
                            </radialGradient>
                        </defs>
                        <path
                            d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41L12 0Z"
                            fill={`url(#sparkleGrad${p.id})`}
                            transform="scale(0.9) translate(1.3, 1.3)"
                        />
                    </svg>
                );
            case 'petal':
                return (
                    <svg viewBox="0 0 24 24" className="w-full h-full">
                        <defs>
                            <radialGradient id={`petalGrad${p.id}`} cx="30%" cy="30%" r="70%">
                                <stop offset="0%" stopColor={config.primaryColor} />
                                <stop offset="100%" stopColor={config.secondaryColor} />
                            </radialGradient>
                        </defs>
                        <ellipse cx="12" cy="10" rx="5" ry="8" fill={`url(#petalGrad${p.id})`} transform="rotate(15 12 10)" />
                    </svg>
                );
            case 'heart':
                return (
                    <svg viewBox="0 0 24 24" className="w-full h-full">
                        <defs>
                            <linearGradient id={`heartGrad${p.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={config.primaryColor} />
                                <stop offset="100%" stopColor={config.secondaryColor} />
                            </linearGradient>
                        </defs>
                        <path
                            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                            fill={`url(#heartGrad${p.id})`}
                        />
                    </svg>
                );
            case 'dot':
            default:
                return (
                    <svg viewBox="0 0 24 24" className="w-full h-full">
                        <circle cx="12" cy="12" r="4" fill={config.dotColor} opacity="0.7" />
                    </svg>
                );
        }
    };

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[100]">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute animate-fall"
                    style={{
                        left: `${p.x}%`,
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                        opacity: p.opacity,
                    }}
                >
                    <div
                        className="animate-sway"
                        style={{
                            width: p.size,
                            height: p.size,
                            transform: `rotate(${p.rotation}deg)`,
                        }}
                    >
                        {renderParticle(p)}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- EVENT BANNER (driven by eventConfig) ---
const EventBanner: React.FC = () => {
    const { bannerTitle, bannerSubtitle, bannerEmojiLeft, bannerEmojiRight, theme } = CURRENT_EVENT;

    return (
        <div className="hidden md:block fixed top-3 left-1/2 -translate-x-1/2 z-[101] animate-bounce-slow">
            <div className={`relative bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl px-6 py-2.5 rounded-full shadow-lg ${theme.bannerShadow} border ${theme.bannerBorder} ${theme.bannerBorderDark}`}>
                <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${theme.bannerBgGradient} dark:from-transparent dark:via-transparent dark:to-transparent`} />
                <div className="relative flex items-center gap-2.5">
                    <span className="text-base">{bannerEmojiLeft}</span>
                    <div className="text-center">
                        <div className={`text-sm font-bold bg-gradient-to-r ${theme.bannerGradient} bg-clip-text text-transparent tracking-wide`}>
                            {bannerTitle}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium -mt-0.5">
                            {bannerSubtitle}
                        </div>
                    </div>
                    <span className="text-base">{bannerEmojiRight}</span>
                </div>
            </div>
        </div>
    );
};

// --- SIDE DECORATIONS ---
const CornerDecorations: React.FC = () => {
    return (
        <div className="hidden md:block">
            <div className="fixed bottom-20 left-3 z-[50] opacity-50 hover:opacity-80 transition-opacity">
                <div className="text-2xl animate-[sway_3s_ease-in-out_infinite]">{CURRENT_EVENT.cornerEmoji}</div>
            </div>
        </div>
    );
};

// --- MAIN EXPORT ---
const TetDecorations: React.FC = () => {
    return (
        <>
            <FallingParticles />
            <EventBanner />
            <CornerDecorations />
        </>
    );
};

export default TetDecorations;

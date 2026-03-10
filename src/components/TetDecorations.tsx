import React, { useEffect, useState } from 'react';

// --- FALLING PETALS (light & subtle) ---
interface Petal {
    id: number;
    x: number;
    delay: number;
    duration: number;
    size: number;
    type: 'petal' | 'heart';
    rotation: number;
    opacity: number;
}

const FallingPetals: React.FC = () => {
    const [petals, setPetals] = useState<Petal[]>([]);

    useEffect(() => {
        const items: Petal[] = [];
        // Only 15 particles — much lighter
        for (let i = 0; i < 15; i++) {
            items.push({
                id: i,
                x: Math.random() * 100,
                delay: Math.random() * 15,
                duration: 12 + Math.random() * 10,
                size: 10 + Math.random() * 10,
                type: Math.random() > 0.25 ? 'petal' : 'heart',
                rotation: Math.random() * 360,
                opacity: 0.3 + Math.random() * 0.3,
            });
        }
        setPetals(items);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[100]">
            {petals.map((p) => (
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
                        {p.type === 'petal' ? (
                            <svg viewBox="0 0 24 24" className="w-full h-full">
                                <defs>
                                    <radialGradient id="petalGrad" cx="30%" cy="30%" r="70%">
                                        <stop offset="0%" stopColor="#fce7f3" />
                                        <stop offset="100%" stopColor="#f9a8d4" />
                                    </radialGradient>
                                </defs>
                                <ellipse cx="12" cy="10" rx="5" ry="8" fill="url(#petalGrad)" transform="rotate(15 12 10)" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" className="w-full h-full">
                                <defs>
                                    <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#fda4af" />
                                        <stop offset="100%" stopColor="#f472b6" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                                    fill="url(#heartGrad)"
                                />
                            </svg>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- WOMEN'S DAY BANNER (subtle glassmorphism) ---
const WomensDayBanner: React.FC = () => {
    return (
        <div className="hidden md:block fixed top-3 left-1/2 -translate-x-1/2 z-[101] animate-bounce-slow">
            <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl px-6 py-2.5 rounded-full shadow-lg shadow-pink-500/10 border border-pink-200/60 dark:border-pink-500/20">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-100/40 via-rose-100/30 to-fuchsia-100/40 dark:from-pink-500/5 dark:via-rose-500/5 dark:to-fuchsia-500/5" />
                <div className="relative flex items-center gap-2.5">
                    <span className="text-base">🌸</span>
                    <div className="text-center">
                        <div className="text-sm font-bold bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 bg-clip-text text-transparent tracking-wide">
                            Chào mừng ngày 8/3
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium -mt-0.5">
                            Ngày Quốc tế Phụ nữ 💐
                        </div>
                    </div>
                    <span className="text-base">🌷</span>
                </div>
            </div>
        </div>
    );
};

// --- SIDE FLOWER DECORATIONS ---
const FlowerCorners: React.FC = () => {
    return (
        <div className="hidden md:block">
            <div className="fixed bottom-20 left-3 z-[50] opacity-50 hover:opacity-80 transition-opacity">
                <div className="text-2xl animate-[sway_3s_ease-in-out_infinite]">💐</div>
            </div>
            {/* <div className="fixed bottom-20 right-3 z-[50] opacity-50 hover:opacity-80 transition-opacity">
                <div className="text-2xl animate-[sway_3.5s_ease-in-out_infinite]">🌹</div>
            </div> */}
        </div>
    );
};

// --- MAIN EXPORT ---
const TetDecorations: React.FC = () => {
    return (
        <>
            <FallingPetals />
            <WomensDayBanner />
            <FlowerCorners />
        </>
    );
};

export default TetDecorations;

import React, { useEffect, useState } from 'react';

// --- FALLING PETALS (Hoa Đào & Hoa Mai) ---
interface Petal {
    id: number;
    x: number;
    delay: number;
    duration: number;
    size: number;
    type: 'dao' | 'mai';
    rotation: number;
}

const FallingPetals: React.FC = () => {
    const [petals, setPetals] = useState<Petal[]>([]);

    useEffect(() => {
        const newPetals: Petal[] = [];
        for (let i = 0; i < 40; i++) {
            newPetals.push({
                id: i,
                x: Math.random() * 100,
                delay: Math.random() * 10,
                duration: 8 + Math.random() * 8,
                size: 10 + Math.random() * 15,
                type: Math.random() > 0.5 ? 'dao' : 'mai',
                rotation: Math.random() * 360
            });
        }
        setPetals(newPetals);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[100]">
            {petals.map((petal) => (
                <div
                    key={petal.id}
                    className="absolute animate-fall"
                    style={{
                        left: `${petal.x}%`,
                        animationDelay: `${petal.delay}s`,
                        animationDuration: `${petal.duration}s`,
                    }}
                >
                    <div
                        className="animate-sway"
                        style={{
                            width: petal.size,
                            height: petal.size,
                            transform: `rotate(${petal.rotation}deg)`,
                        }}
                    >
                        {petal.type === 'dao' ? (
                            // Hoa Đào (Pink cherry blossom)
                            <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-lg">
                                <defs>
                                    <radialGradient id="pinkGrad" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#fce7f3" />
                                        <stop offset="100%" stopColor="#ec4899" />
                                    </radialGradient>
                                </defs>
                                <path
                                    d="M12 2C12 2 14 6 12 8C10 6 12 2 12 2Z M12 2C12 2 16 4 14 7C11 6 12 2 12 2Z M12 2C12 2 8 4 10 7C13 6 12 2 12 2Z M12 2C12 2 6 6 9 8C11 7 12 2 12 2Z M12 2C12 2 18 6 15 8C13 7 12 2 12 2Z"
                                    fill="url(#pinkGrad)"
                                    transform="translate(0, 8) scale(1.2)"
                                />
                                <circle cx="12" cy="12" r="2" fill="#fbbf24" />
                            </svg>
                        ) : (
                            // Hoa Mai (Yellow apricot blossom)
                            <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-lg">
                                <defs>
                                    <radialGradient id="yellowGrad" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#fef3c7" />
                                        <stop offset="100%" stopColor="#f59e0b" />
                                    </radialGradient>
                                </defs>
                                <path
                                    d="M12 4L13.5 9H18.5L14.5 12L16 17L12 14L8 17L9.5 12L5.5 9H10.5L12 4Z"
                                    fill="url(#yellowGrad)"
                                />
                                <circle cx="12" cy="11" r="2.5" fill="#dc2626" />
                            </svg>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- FIREWORKS ---
interface Firework {
    id: number;
    x: number;
    y: number;
    color: string;
    size: number;
}

const Fireworks: React.FC = () => {
    const [fireworks, setFireworks] = useState<Firework[]>([]);

    useEffect(() => {
        const colors = ['#ef4444', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#22c55e'];

        const createFirework = () => {
            const newFirework: Firework = {
                id: Date.now() + Math.random(),
                x: 10 + Math.random() * 80,
                y: 10 + Math.random() * 40,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 80 + Math.random() * 60
            };

            setFireworks(prev => [...prev, newFirework]);

            // Remove firework after animation
            setTimeout(() => {
                setFireworks(prev => prev.filter(f => f.id !== newFirework.id));
            }, 1500);
        };

        // Create fireworks periodically
        const interval = setInterval(createFirework, 2000 + Math.random() * 2000);
        createFirework(); // Initial firework

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[99]">
            {fireworks.map((fw) => (
                <div
                    key={fw.id}
                    className="absolute animate-firework"
                    style={{
                        left: `${fw.x}%`,
                        top: `${fw.y}%`,
                        width: fw.size,
                        height: fw.size,
                    }}
                >
                    {/* Firework particles */}
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-2 h-2 rounded-full animate-particle"
                            style={{
                                background: fw.color,
                                boxShadow: `0 0 6px ${fw.color}, 0 0 12px ${fw.color}`,
                                transform: `rotate(${i * 30}deg) translateY(-${fw.size / 2}px)`,
                                left: '50%',
                                top: '50%',
                                animationDelay: `${i * 0.05}s`
                            }}
                        />
                    ))}
                    {/* Center burst */}
                    <div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full animate-burst"
                        style={{
                            background: fw.color,
                            boxShadow: `0 0 20px ${fw.color}, 0 0 40px ${fw.color}`
                        }}
                    />
                </div>
            ))}
        </div>
    );
};

// --- TET BANNER ---
const TetBanner: React.FC = () => {
    return (
        <div className="hidden md:block fixed top-4 left-1/2 -translate-x-1/2 z-[101] animate-bounce-slow">
            <div className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 px-8 py-3 rounded-full shadow-2xl shadow-red-500/30 border-2 border-yellow-400">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🧧</span>
                    <div className="text-center">
                        <div className="text-yellow-300 font-bold text-lg tracking-wide">CHÚC MỪNG NĂM MỚI 2026</div>
                        <div className="text-yellow-100 text-xs">Năm Bính Ngọ - An Khang Thịnh Vượng</div>
                    </div>
                    <span className="text-2xl">🧧</span>
                </div>
            </div>
        </div>
    );
};

// --- CÂU ĐỐI TẾT (Vietnamese Tet Couplets) ---
const CauDoi: React.FC = () => {
    // Couplet texts (shorter for compact display)
    const leftText = "PHÚC";
    const rightText = "LỘC";

    return (
        <div className="hidden md:block">
            {/* Left Couplet - Bottom Left */}
            <div className="fixed bottom-20 left-2 z-[50] opacity-80 hover:opacity-100 transition-opacity">
                <div className="relative scale-75 origin-bottom-left">
                    {/* Decorative top */}
                    <div className="w-8 h-4 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-t-md mx-auto shadow-md border border-yellow-400" />

                    {/* Main banner */}
                    <div className="w-8 bg-gradient-to-b from-red-600 via-red-700 to-red-800 py-3 shadow-lg border-x border-yellow-500/50 flex flex-col items-center">
                        <div
                            className="text-yellow-300 font-bold text-xs"
                            style={{ textShadow: '0 0 8px rgba(250, 204, 21, 0.6)' }}
                        >
                            {leftText.split('').map((char, i) => (
                                <div key={i} className="mb-1">{char}</div>
                            ))}
                        </div>
                    </div>

                    {/* Decorative bottom */}
                    <div className="w-8 h-3 bg-gradient-to-b from-yellow-600 to-yellow-500 rounded-b-md mx-auto shadow-md border border-yellow-400" />

                    {/* Tassel */}
                    <div className="flex justify-center gap-0.5 mt-0.5">
                        <div className="w-0.5 h-3 bg-red-400 rounded-full" />
                        <div className="w-0.5 h-4 bg-red-400 rounded-full" />
                        <div className="w-0.5 h-3 bg-red-400 rounded-full" />
                    </div>
                </div>
            </div>

            {/* Right Couplet - Bottom Right */}
            <div className="fixed bottom-20 right-2 z-[50] opacity-80 hover:opacity-100 transition-opacity">
                <div className="relative scale-75 origin-bottom-right">
                    {/* Decorative top */}
                    <div className="w-8 h-4 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-t-md mx-auto shadow-md border border-yellow-400" />

                    {/* Main banner */}
                    <div className="w-8 bg-gradient-to-b from-red-600 via-red-700 to-red-800 py-3 shadow-lg border-x border-yellow-500/50 flex flex-col items-center">
                        <div
                            className="text-yellow-300 font-bold text-xs"
                            style={{ textShadow: '0 0 8px rgba(250, 204, 21, 0.6)' }}
                        >
                            {rightText.split('').map((char, i) => (
                                <div key={i} className="mb-1">{char}</div>
                            ))}
                        </div>
                    </div>

                    {/* Decorative bottom */}
                    <div className="w-8 h-3 bg-gradient-to-b from-yellow-600 to-yellow-500 rounded-b-md mx-auto shadow-md border border-yellow-400" />

                    {/* Tassel */}
                    <div className="flex justify-center gap-0.5 mt-0.5">
                        <div className="w-0.5 h-3 bg-red-400 rounded-full" />
                        <div className="w-0.5 h-4 bg-red-400 rounded-full" />
                        <div className="w-0.5 h-3 bg-red-400 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN EXPORT ---
const TetDecorations: React.FC = () => {
    return (
        <>
            <FallingPetals />
            <Fireworks />
            <TetBanner />
            <CauDoi />
        </>
    );
};

export default TetDecorations;

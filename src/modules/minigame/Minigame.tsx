import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
    Gamepad2, RotateCcw, X, Circle, ArrowLeft, Target, Sparkles, Moon,
    ZoomIn, ZoomOut, Trash2, ArrowRightLeft,
    Plus, Users, Wifi, Crown, Check, Loader2, LogOut, Search, Monitor
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { MinigameService, GameRoom, TicTacToeState, GomokuState, encodeEmail, decodeEmail } from '../../services/minigameService';
import OnlineWerewolfNew from './WerewolfGame';
import GameStats from './GameStats';
import AvatarImg from '../../components/AvatarImg';

type GameId = 'tic-tac-toe' | 'gomoku' | 'werewolf';
interface GameInfo { id: GameId; name: string; desc: string; icon: React.ReactNode; gradient: string; category: string; players: string; thumbnail: string; }

const GAMES: GameInfo[] = [
    { id: 'tic-tac-toe', name: 'Tic Tac Toe', desc: 'Cờ caro 3x3 kinh điển.', icon: <Target size={28} />, gradient: 'from-blue-500 to-cyan-500', category: 'Đối kháng', players: '2 người', thumbnail: '/game-tictactoe.png' },
    { id: 'gomoku', name: 'Cờ Caro', desc: 'Cờ caro 5 quân liên tiếp, bàn cờ không giới hạn!', icon: <Circle size={28} />, gradient: 'from-emerald-500 to-teal-500', category: 'Đối kháng', players: '2 người', thumbnail: '/game-caro.png' },
    { id: 'werewolf', name: 'Ma Sói', desc: 'Game tập thể. App làm quản trò!', icon: <Moon size={28} />, gradient: 'from-violet-600 to-purple-700', category: 'Tập thể', players: '5-15 người', thumbnail: '/game-werewolf.png' },
];

// ==================== HANDWRITTEN X & O SVG ====================
const HandX: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 36, color = '#3b82f6', className }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <motion.path d="M8 8 C12 14, 20 22, 32 32" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ filter: 'url(#roughen)' }} />
        <motion.path d="M32 8 C28 14, 20 22, 8 32" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.15, ease: 'easeOut' }}
            style={{ filter: 'url(#roughen)' }} />
        <defs><filter id="roughen"><feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" /></filter></defs>
    </svg>
);
const HandO: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 32, color = '#f43f5e', className }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <motion.ellipse cx="20" cy="20" rx="14" ry="15" stroke={color} strokeWidth={3.5} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ filter: 'url(#roughenO)' }} />
        <defs><filter id="roughenO"><feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" /></filter></defs>
    </svg>
);

// ==================== OFFLINE TIC TAC TOE (vs AI) ====================
const OfflineTicTacToe: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
    const [isXNext, setIsXNext] = useState(true);
    const [scores, setScores] = useState({ x: 0, o: 0, draw: 0 });
    const [thinking, setThinking] = useState(false);

    const calcWinner = (sq: (string | null)[]) => {
        for (const [a, b, c] of [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]])
            if (sq[a] && sq[a] === sq[b] && sq[a] === sq[c]) return { winner: sq[a], line: [a, b, c] };
        return null;
    };

    const minimax = (sq: (string | null)[], isMax: boolean, depth: number): number => {
        const r = calcWinner(sq);
        if (r?.winner === 'O') return 10 - depth;
        if (r?.winner === 'X') return depth - 10;
        if (sq.every(s => s !== null)) return 0;
        let best = isMax ? -Infinity : Infinity;
        for (let i = 0; i < 9; i++) {
            if (sq[i]) continue;
            sq[i] = isMax ? 'O' : 'X';
            const score = minimax(sq, !isMax, depth + 1);
            sq[i] = null;
            best = isMax ? Math.max(best, score) : Math.min(best, score);
        }
        return best;
    };

    const aiMove = (sq: (string | null)[]) => {
        let bestScore = -Infinity, bestIdx = -1;
        for (let i = 0; i < 9; i++) {
            if (sq[i]) continue;
            sq[i] = 'O'; const score = minimax(sq, false, 0); sq[i] = null;
            if (score > bestScore) { bestScore = score; bestIdx = i; }
        }
        return bestIdx;
    };

    const res = calcWinner(board); const winner = res?.winner; const winLine = res?.line || [];
    const isDraw = !winner && board.every(s => s !== null);

    useEffect(() => {
        if (!isXNext && !winner && !isDraw) {
            setThinking(true);
            const t = setTimeout(() => {
                const idx = aiMove([...board]);
                if (idx >= 0) {
                    const nb = [...board]; nb[idx] = 'O'; setBoard(nb); setIsXNext(true);
                    const w = calcWinner(nb);
                    if (w?.winner === 'O') setScores(s => ({ ...s, o: s.o + 1 }));
                    if (!w && nb.every(s => s !== null)) setScores(s => ({ ...s, draw: s.draw + 1 }));
                }
                setThinking(false);
            }, 400);
            return () => clearTimeout(t);
        }
    }, [isXNext, board, winner, isDraw]);

    const click = (i: number) => {
        if (!isXNext || board[i] || winner || isDraw || thinking) return;
        const nb = [...board]; nb[i] = 'X'; setBoard(nb); setIsXNext(false);
        const w = calcWinner(nb);
        if (w?.winner === 'X') setScores(s => ({ ...s, x: s.x + 1 }));
        if (!w && nb.every(s => s !== null)) setScores(s => ({ ...s, draw: s.draw + 1 }));
    };

    const reset = () => { setBoard(Array(9).fill(null)); setIsXNext(true); };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20 p-4 sm:p-6">
            <div className="max-w-md mx-auto">
                <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-500 mb-4 font-medium"><ArrowLeft size={16} /> Quay lại</button>
                <div className="text-center mb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-500 mb-2"><Monitor size={12} /> Chơi với Máy</div>
                    <h2 className="text-xl font-bold">Tic Tac Toe</h2>
                </div>
                <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-center gap-4 text-sm font-bold mb-4">
                        <span className={clsx("px-2 py-1 rounded-lg", isXNext && !winner && !isDraw ? "ring-2 ring-blue-400" : "")}>
                            <span className="text-blue-500">✕ Bạn</span> <span className="text-slate-400">({scores.x})</span>
                        </span>
                        <span className="text-slate-300">vs</span>
                        <span className={clsx("px-2 py-1 rounded-lg", !isXNext && !winner && !isDraw ? "ring-2 ring-rose-400" : "")}>
                            <span className="text-rose-500">○ Máy</span> <span className="text-slate-400">({scores.o})</span>
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-w-[300px] mx-auto">
                        {board.map((cell, i) => (
                            <motion.button key={i} whileTap={{ scale: 0.95 }} onClick={() => click(i)}
                                className={clsx("w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 flex items-center justify-center",
                                    winLine.includes(i) ? "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 shadow-lg" :
                                        isXNext && !cell && !winner && !isDraw ? "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300 cursor-pointer" :
                                            "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700")}>
                                {cell === 'X' && <HandX size={36} />}
                                {cell === 'O' && <HandO size={32} />}
                            </motion.button>
                        ))}
                    </div>
                    {(winner || isDraw) && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mt-4">
                        <p className="text-lg font-bold mb-2">{winner ? <span className={winner === 'X' ? 'text-blue-500' : 'text-rose-500'}>🎉 {winner === 'X' ? 'Bạn' : 'Máy'} thắng!</span> : '🤝 Hòa!'}</p>
                        <button onClick={reset} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 mx-auto"><RotateCcw size={16} /> Ván mới</button>
                    </motion.div>}
                    {!winner && !isDraw && <p className="text-sm text-center mt-3 text-slate-500">
                        {isXNext && !thinking ? <span className="text-emerald-500 font-bold animate-pulse">🎯 Lượt của bạn!</span> : <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Máy đang suy nghĩ...</span>}
                    </p>}
                </div>
            </div>
        </div>
    );
};

// ==================== OFFLINE GOMOKU (vs AI) ====================
const OfflineGomoku: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [stones, setStones] = useState<Record<string, 'X' | 'O'>>({});
    const [isXNext, setIsXNext] = useState(true);
    const [winner, setWinner] = useState<{ player: string; line: string[] } | null>(null);
    const [moveCount, setMoveCount] = useState(0);
    const [thinking, setThinking] = useState(false);
    const [viewport, setViewport] = useState({ x: 0, y: 0 });
    const [cellSize, setCellSize] = useState(36);
    const [lastMove, setLastMove] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [boardDim, setBoardDim] = useState({ w: 540, h: 540 });
    const dragRef = useRef<{ startX: number; startY: number; vpX: number; vpY: number; moved: boolean } | null>(null);
    const pinchRef = useRef<{ dist: number; cellSize: number } | null>(null);

    // Dynamically measure container
    useEffect(() => {
        const measure = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const w = Math.floor(rect.width);
                // Available height: viewport height minus position and some padding
                const availH = Math.floor(window.innerHeight - rect.top - 60);
                const h = Math.max(280, Math.min(availH, 700));
                setBoardDim({ w, h });
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    const visibleCols = Math.floor(boardDim.w / cellSize);
    const visibleRows = Math.floor(boardDim.h / cellSize);
    const halfCols = Math.floor(visibleCols / 2);
    const halfRows = Math.floor(visibleRows / 2);

    const checkWin = (map: Record<string, string>, cx: number, cy: number, player: string) => {
        const dirs: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];
        const opponent = player === 'X' ? 'O' : 'X';
        for (const [dx, dy] of dirs) {
            let countPositive = 0;
            for (let d = 1; d <= 4; d++) { if (map[`${cx + dx * d},${cy + dy * d}`] === player) countPositive++; else break; }
            let countNegative = 0;
            for (let d = 1; d <= 4; d++) { if (map[`${cx - dx * d},${cy - dy * d}`] === player) countNegative++; else break; }

            const total = 1 + countPositive + countNegative;
            if (total >= 5) {
                const line: string[] = [`${cx},${cy}`];
                for (let d = 1; d <= countPositive; d++) line.push(`${cx + dx * d},${cy + dy * d}`);
                for (let d = 1; d <= countNegative; d++) line.push(`${cx - dx * d},${cy - dy * d}`);

                if (total === 5) {
                    const endPositive = `${cx + dx * (countPositive + 1)},${cy + dy * (countPositive + 1)}`;
                    const endNegative = `${cx - dx * (countNegative + 1)},${cy - dy * (countNegative + 1)}`;
                    if (map[endPositive] === opponent && map[endNegative] === opponent) continue;
                }

                return { player, line: line.slice(0, 5) };
            }
        }
        return null;
    };

    const gomokuAI = (sts: Record<string, 'X' | 'O'>): [number, number] => {
        const occupied = Object.keys(sts).map(k => k.split(',').map(Number) as [number, number]);
        if (occupied.length === 0) return [0, 0];

        // Wider candidate search for better play
        const candidates = new Set<string>();
        occupied.forEach(([x, y]) => {
            for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
                const k = `${x + dx},${y + dy}`;
                if (!sts[k]) candidates.add(k);
            }
        });

        const dirs: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];

        // Evaluate a single line through a point for a player
        const evalLine = (map: Record<string, string>, cx: number, cy: number, dx: number, dy: number, p: string) => {
            let cnt = 1;
            let openEnds = 0;
            // Forward
            for (let d = 1; d <= 5; d++) {
                const v = map[`${cx + dx * d},${cy + dy * d}`];
                if (v === p) { cnt++; } else { if (!v) openEnds++; break; }
            }
            // Backward
            for (let d = 1; d <= 5; d++) {
                const v = map[`${cx - dx * d},${cy - dy * d}`];
                if (v === p) { cnt++; } else { if (!v) openEnds++; break; }
            }
            return { cnt, openEnds };
        };

        // Score for placing a stone at a position for a player
        const evalPosition = (map: Record<string, string>, cx: number, cy: number, p: string): number => {
            let total = 0;
            for (const [dx, dy] of dirs) {
                const { cnt, openEnds } = evalLine(map, cx, cy, dx, dy, p);
                if (cnt >= 5) total += 1000000;            // Win
                else if (cnt === 4 && openEnds === 2) total += 50000;   // Open 4 (unstoppable)
                else if (cnt === 4 && openEnds === 1) total += 8000;    // Closed 4
                else if (cnt === 3 && openEnds === 2) total += 5000;    // Open 3 (strong)
                else if (cnt === 3 && openEnds === 1) total += 800;     // Closed 3
                else if (cnt === 2 && openEnds === 2) total += 500;     // Open 2
                else if (cnt === 2 && openEnds === 1) total += 80;      // Closed 2
                else if (cnt === 1 && openEnds === 2) total += 30;      // Open 1
                else if (cnt === 1 && openEnds === 1) total += 5;       // Closed 1
            }
            return total;
        };

        let bestScore = -Infinity;
        let bestMove: [number, number] = [0, 0];

        for (const c of candidates) {
            const [x, y] = c.split(',').map(Number);

            // Attack: score for AI placing here
            const nextO = { ...sts, [c]: 'O' as const };
            const atkScore = evalPosition(nextO, x, y, 'O');

            // Immediate win — take it
            if (atkScore >= 1000000) return [x, y];

            // Defense: score for opponent placing here
            const nextX = { ...sts, [c]: 'X' as const };
            const defScore = evalPosition(nextX, x, y, 'X');

            // Must block opponent's winning move
            if (defScore >= 1000000) {
                bestScore = 999999;
                bestMove = [x, y];
                continue;
            }

            // Weighted total: prioritize attack slightly over defense
            const total = atkScore * 1.15 + defScore;

            // Bonus for center proximity (prefer central play)
            const centerBonus = Math.max(0, 10 - Math.abs(x) - Math.abs(y)) * 2;

            const finalScore = total + centerBonus;
            if (finalScore > bestScore) { bestScore = finalScore; bestMove = [x, y]; }
        }
        return bestMove;
    };

    useEffect(() => {
        if (!isXNext && !winner) {
            setThinking(true);
            const t = setTimeout(() => {
                const [ax, ay] = gomokuAI(stones);
                const key = `${ax},${ay}`;
                const next: Record<string, 'X' | 'O'> = { ...stones, [key]: 'O' };
                const w = checkWin(next, ax, ay, 'O');
                setStones(next); setMoveCount(m => m + 1); setIsXNext(true); setLastMove(key);
                if (w) setWinner(w);
                setThinking(false);
            }, 300);
            return () => clearTimeout(t);
        }
    }, [isXNext, stones, winner]);

    const place = (x: number, y: number) => {
        if (!isXNext || winner || thinking) return;
        const key = `${x},${y}`; if (stones[key]) return;
        const next: Record<string, 'X' | 'O'> = { ...stones, [key]: 'X' };
        const w = checkWin(next, x, y, 'X');
        setStones(next); setMoveCount(m => m + 1); setIsXNext(false); setLastMove(key);
        if (w) setWinner(w);
    };

    const reset = () => { setStones({}); setIsXNext(true); setWinner(null); setMoveCount(0); setViewport({ x: 0, y: 0 }); setLastMove(null); };
    const focusLastMove = () => { if (lastMove) { const [x, y] = lastMove.split(',').map(Number); setViewport({ x, y }); } };

    const handleZoom = (delta: number) => setCellSize(s => Math.max(16, Math.min(60, s + delta)));

    // Pointer drag
    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === 'touch' && e.isPrimary === false) return; // ignore multi-touch for drag
        dragRef.current = { startX: e.clientX, startY: e.clientY, vpX: viewport.x, vpY: viewport.y, moved: false };
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current) return;
        const dx = (e.clientX - dragRef.current.startX) / cellSize;
        const dy = (e.clientY - dragRef.current.startY) / cellSize;
        if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
            dragRef.current.moved = true;
            setViewport({ x: Math.round(dragRef.current.vpX - dx), y: Math.round(dragRef.current.vpY - dy) });
        }
    };
    const handlePointerUp = () => { dragRef.current = null; };

    // Pinch-to-zoom
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            pinchRef.current = { dist, cellSize };
        }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchRef.current) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const scale = dist / pinchRef.current.dist;
            const newSize = Math.max(16, Math.min(60, Math.round(pinchRef.current.cellSize * scale)));
            setCellSize(newSize);
        }
    };
    const handleTouchEnd = () => { pinchRef.current = null; };

    // Wheel zoom
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoom(e.deltaY < 0 ? 2 : -2);
        }
    };

    const rows: number[] = []; for (let y = viewport.y - halfRows; y <= viewport.y + halfRows; y++) rows.push(y);
    const cols: number[] = []; for (let x = viewport.x - halfCols; x <= viewport.x + halfCols; x++) cols.push(x);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 p-3 sm:p-6">
            <div className="max-w-3xl mx-auto">
                <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-500 mb-3 font-medium"><ArrowLeft size={16} /> Quay lại</button>
                <div className="text-center mb-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-500 mb-1"><Monitor size={12} /> Chơi với Máy</div>
                    <h2 className="text-xl font-bold">Cờ Caro</h2>
                </div>
                <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col items-center gap-2">
                    <div className="flex items-center gap-4 text-sm font-bold">
                        <span className={clsx(isXNext && !winner ? "ring-2 ring-blue-400 rounded-lg px-2 py-1" : "px-2 py-1", "text-blue-500")}>✕ Bạn</span>
                        <span className="text-slate-300">vs</span>
                        <span className={clsx(!isXNext && !winner ? "ring-2 ring-rose-400 rounded-lg px-2 py-1" : "px-2 py-1", "text-rose-500")}>○ Máy</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                        <button onClick={() => handleZoom(4)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700/50 transition-all text-xs font-medium shadow-sm" title="Phóng to"><ZoomIn size={16} /><span className="hidden sm:inline">Phóng to</span></button>
                        <button onClick={() => handleZoom(-4)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700/50 transition-all text-xs font-medium shadow-sm" title="Thu nhỏ"><ZoomOut size={16} /><span className="hidden sm:inline">Thu nhỏ</span></button>
                        <button onClick={() => setViewport({ x: 0, y: 0 })} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-800/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 transition-all text-xs font-medium shadow-sm" title="Về trung tâm">⌂<span className="hidden sm:inline">Trung tâm</span></button>
                        {lastMove && <button onClick={focusLastMove} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50 transition-all text-xs font-medium shadow-sm" title="Đến nước đi cuối"><Target size={16} /><span className="hidden sm:inline">Nước cuối</span></button>}
                    </div>
                    <div ref={containerRef} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden select-none touch-none bg-amber-50 dark:bg-slate-900/50"
                        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
                        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                        onWheel={handleWheel}
                        style={{ height: boardDim.h }}>
                        <div className="relative w-full h-full">
                            {rows.map((y, ri) => cols.map((x, ci) => {
                                const key = `${x},${y}`; const stone = stones[key]; const isWin = winner?.line?.includes(key); const isCenter = x === 0 && y === 0; const isLast = key === lastMove;
                                return (
                                    <div key={key} onClick={() => { if (!dragRef.current?.moved) place(x, y); }}
                                        className={clsx("absolute border border-slate-300/40 dark:border-slate-600/30 flex items-center justify-center cursor-pointer transition-colors duration-75",
                                            isWin && "bg-yellow-200/60 dark:bg-yellow-800/30 z-10", isLast && !isWin && "bg-emerald-100/50 dark:bg-emerald-900/20",
                                            !stone && isXNext && !winner && "hover:bg-blue-100/40 dark:hover:bg-blue-800/20")}
                                        style={{ left: ci * cellSize, top: ri * cellSize, width: cellSize, height: cellSize }}>
                                        {isCenter && !stone && <div className="w-1.5 h-1.5 rounded-full bg-slate-400/50 absolute" />}
                                        {stone === 'X' && <div className="relative flex items-center justify-center">
                                            <HandX size={Math.round(cellSize * 0.75)} />
                                            {isLast && !isWin && <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-40" style={{ width: cellSize * 0.6, height: cellSize * 0.6, margin: 'auto' }} />}
                                        </div>}
                                        {stone === 'O' && <div className="relative flex items-center justify-center">
                                            <HandO size={Math.round(cellSize * 0.7)} />
                                            {isLast && !isWin && <div className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-40" style={{ width: cellSize * 0.6, height: cellSize * 0.6, margin: 'auto' }} />}
                                        </div>}
                                    </div>
                                );
                            }))}
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center">Kéo để di chuyển · Ctrl+Scroll hoặc chụm ngón để zoom · Bàn cờ không giới hạn</p>
                    {winner && <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
                        <p className="text-lg font-bold mb-2"><span className={winner.player === 'X' ? 'text-blue-500' : 'text-rose-500'}>🎉 {winner.player === 'X' ? 'Bạn' : 'Máy'} thắng!</span></p>
                        <button onClick={reset} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 mx-auto"><RotateCcw size={16} /> Ván mới</button>
                    </motion.div>}
                    {!winner && <p className="text-xs text-slate-400">
                        {isXNext && !thinking ? <span className="text-emerald-500 font-bold animate-pulse">🎯 Lượt của bạn!</span> : thinking ? <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Máy đang suy nghĩ...</span> : ''} · {moveCount} nước
                    </p>}
                </div>
            </div>
        </div>
    );
};

// ==================== PLAYER PICKER MODAL ====================
const PlayerPicker: React.FC<{ selected: string[]; onToggle: (uid: string) => void; onClose: () => void }> = ({ selected, onToggle, onClose }) => {
    const { users } = useData();
    const { currentUser } = useAuth();
    const [search, setSearch] = useState('');
    const filtered = users.filter(u =>
        (u.email || '').toLowerCase() !== (currentUser?.email || '').toLowerCase() &&
        (u.name.toLowerCase().includes(search.toLowerCase()) || u.dept.toLowerCase().includes(search.toLowerCase()))
    );
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-lg mb-2">Chọn người chơi</h3>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên hoặc phòng ban..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm outline-none focus:border-indigo-400" />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Đã chọn: {selected.length} người</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {filtered.map(u => {
                        const uEmail = (u.email || '').toLowerCase();
                        const isSel = selected.includes(uEmail);
                        return (
                            <button key={u.id} onClick={() => onToggle(uEmail)}
                                className={clsx("w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-sm transition-all mb-1",
                                    isSel ? "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700" : "hover:bg-slate-50 dark:hover:bg-slate-700/50")}>
                                <AvatarImg src={u.avatar} name={u.name} className="w-8 h-8 rounded-full shrink-0" size={32} />
                                <div className="flex-1 min-w-0"><p className="font-medium truncate">{u.name}</p><p className="text-xs text-slate-400">{u.dept} · {u.role}</p></div>
                                {isSel && <Check size={18} className="text-indigo-500 shrink-0" />}
                            </button>
                        );
                    })}
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={onClose} className="w-full py-2.5 bg-indigo-500 text-white rounded-xl font-bold text-sm">Xong ({selected.length} người)</button>
                </div>
            </motion.div>
        </div>
    );
};

// ==================== ONLINE TIC TAC TOE ====================
const OnlineTicTacToe: React.FC<{ room: GameRoom; myUid: string }> = ({ room, myUid }) => {
    const gs = (room.gameState || {}) as TicTacToeState;
    const rawBoard = gs.board || Array(9).fill(null);
    const board = rawBoard.map((v: any) => v || null);
    const playerX = gs.playerX;
    const playerO = gs.playerO;
    const mySymbol = myUid === playerX ? 'X' : myUid === playerO ? 'O' : null;
    const isMyTurn = (gs.isXNext && myUid === playerX) || (!gs.isXNext && myUid === playerO);

    const calcWinner = (sq: (string | null)[]) => {
        for (const [a, b, c] of [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]) {
            if (sq[a] && sq[a] === sq[b] && sq[a] === sq[c]) return { winner: sq[a], line: [a, b, c] };
        } return null;
    };
    const res = calcWinner(board); const winner = res?.winner; const winLine = res?.line || [];
    const isDraw = !winner && board.every((s: string | null) => s !== null);

    const playerNames = room.players || {};
    const xName = playerNames[playerX]?.name || 'X';
    const oName = playerNames[playerO]?.name || 'O';

    const click = async (i: number) => {
        if (!isMyTurn || board[i] || winner || isDraw) return;
        const nb = [...board]; nb[i] = mySymbol;
        const newState: TicTacToeState = { ...gs, board: nb, isXNext: !gs.isXNext };
        const w = calcWinner(nb);
        const nowDraw = !w && nb.every((s: string | null) => s !== null);
        const now = Date.now();
        const startedAt = room.createdAt || now;
        const duration = Math.round((now - startedAt) / 1000);

        if (w) {
            newState.winner = w.winner;
            if (w.winner === 'X') newState.scoreX = (gs.scoreX || 0) + 1; else newState.scoreO = (gs.scoreO || 0) + 1;
            // Save win history
            try {
                const winnerUid = w.winner === 'X' ? playerX : playerO;
                const loserUid = w.winner === 'X' ? playerO : playerX;
                await MinigameService.saveGameHistory({
                    gameType: 'tic-tac-toe', roomId: room.id,
                    result: `🎉 ${playerNames[winnerUid]?.name || w.winner} thắng!`,
                    winner: winnerUid, winnerName: playerNames[winnerUid]?.name, loserName: playerNames[loserUid]?.name,
                    players: {
                        [playerX]: { name: xName, avatar: playerNames[playerX]?.avatar || '', won: w.winner === 'X', score: w.winner === 'X' ? 1 : 0 },
                        [playerO]: { name: oName, avatar: playerNames[playerO]?.avatar || '', won: w.winner === 'O', score: w.winner === 'O' ? 1 : 0 },
                    },
                    startedAt, finishedAt: now, duration,
                });
            } catch (e) { console.error('Save TTT history error:', e); }
        }
        if (nowDraw) {
            newState.isDraw = true; newState.scoreDraw = (gs.scoreDraw || 0) + 1;
            // Save draw history
            try {
                await MinigameService.saveGameHistory({
                    gameType: 'tic-tac-toe', roomId: room.id,
                    result: '🤝 Hòa!', isDraw: true,
                    players: {
                        [playerX]: { name: xName, avatar: playerNames[playerX]?.avatar || '', won: false, score: 0 },
                        [playerO]: { name: oName, avatar: playerNames[playerO]?.avatar || '', won: false, score: 0 },
                    },
                    startedAt, finishedAt: now, duration,
                });
            } catch (e) { console.error('Save TTT draw history error:', e); }
        }
        await MinigameService.updateGameState(room.id, newState);
    };

    const reset = async () => {
        const cleanState: any = {
            playerX: gs.playerX,
            playerO: gs.playerO,
            board: Array(9).fill(''),
            isXNext: true,
            isDraw: false,
            scoreX: gs.scoreX || 0,
            scoreO: gs.scoreO || 0,
            scoreDraw: gs.scoreDraw || 0,
        };
        await MinigameService.updateGameState(room.id, cleanState);
    };

    return (
        <div className="flex flex-col items-center gap-5 max-w-2xl mx-auto">
            {/* Player cards with glassmorphism */}
            <div className="w-full flex items-center justify-between gap-3 px-2">
                <div className={clsx("flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300",
                    "backdrop-blur-xl border",
                    gs.isXNext && !winner && !isDraw
                        ? "bg-blue-500/10 border-blue-400/50 shadow-lg shadow-blue-500/10"
                        : "bg-white/60 dark:bg-slate-800/60 border-white/30 dark:border-slate-700/50")}>
                    <AvatarImg src={playerNames[playerX]?.avatar} name={xName} className="w-10 h-10 rounded-xl border-2 border-blue-400/50 shrink-0" size={40} gradientFrom="from-blue-400" gradientTo="to-blue-600" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate">{xName}</p>
                        <p className="text-xs text-slate-400">✕ Quân X</p>
                    </div>
                    <span className="text-2xl font-black text-blue-500">{gs.scoreX || 0}</span>
                </div>
                <div className="flex flex-col items-center px-2 shrink-0">
                    <span className="text-xs font-bold text-slate-400 tracking-widest">VS</span>
                    <span className="text-[10px] text-slate-300">Hòa {gs.scoreDraw || 0}</span>
                </div>
                <div className={clsx("flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300",
                    "backdrop-blur-xl border",
                    !gs.isXNext && !winner && !isDraw
                        ? "bg-rose-500/10 border-rose-400/50 shadow-lg shadow-rose-500/10"
                        : "bg-white/60 dark:bg-slate-800/60 border-white/30 dark:border-slate-700/50")}>
                    <span className="text-2xl font-black text-rose-500">{gs.scoreO || 0}</span>
                    <div className="min-w-0 flex-1 text-right">
                        <p className="text-sm font-bold text-rose-600 dark:text-rose-400 truncate">{oName}</p>
                        <p className="text-xs text-slate-400">○ Quân O</p>
                    </div>
                    <AvatarImg src={playerNames[playerO]?.avatar} name={oName} className="w-10 h-10 rounded-xl border-2 border-rose-400/50 shrink-0" size={40} gradientFrom="from-rose-400" gradientTo="to-rose-600" />
                </div>
            </div>
            {/* Board with glassmorphism */}
            <div className="p-3 sm:p-4 rounded-3xl backdrop-blur-xl bg-white/40 dark:bg-slate-800/40 border border-white/40 dark:border-slate-700/40 shadow-2xl">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {board.map((cell: string | null, i: number) => (
                        <motion.button key={i} whileTap={{ scale: 0.92 }} whileHover={isMyTurn && !cell && !winner && !isDraw ? { scale: 1.05 } : {}}
                            onClick={() => click(i)}
                            className={clsx("w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl flex items-center justify-center text-4xl sm:text-5xl font-black transition-all duration-200",
                                winLine.includes(i) ? "bg-gradient-to-br from-yellow-200/80 to-amber-300/80 dark:from-yellow-800/40 dark:to-amber-700/40 border-2 border-yellow-400 shadow-lg shadow-yellow-400/30" :
                                    isMyTurn && !cell && !winner && !isDraw ? "bg-white/70 dark:bg-slate-700/50 border-2 border-white/60 dark:border-slate-600/50 hover:border-indigo-300 dark:hover:border-indigo-500 cursor-pointer hover:shadow-lg hover:shadow-indigo-500/10" :
                                        "bg-white/50 dark:bg-slate-700/30 border-2 border-white/40 dark:border-slate-600/30")}>
                            {cell === 'X' && <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200 }}>
                                <HandX size={44} />
                            </motion.div>}
                            {cell === 'O' && <motion.div initial={{ scale: 0, rotate: 180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200 }}>
                                <HandO size={40} />
                            </motion.div>}
                        </motion.button>
                    ))}
                </div>
            </div>
            {/* Result / Status */}
            {(winner || isDraw) && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="text-center backdrop-blur-xl bg-white/60 dark:bg-slate-800/60 border border-white/40 dark:border-slate-700/40 rounded-2xl px-8 py-5 shadow-xl">
                <p className="text-xl font-black mb-3">{winner ? <span className={winner === 'X' ? 'text-blue-500' : 'text-rose-500'}>🎉 {winner === 'X' ? xName : oName} thắng!</span> : '🤝 Hòa!'}</p>
                <button onClick={reset} className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-bold text-sm flex items-center gap-2 mx-auto transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50"><RotateCcw size={16} /> Chơi tiếp</button>
            </motion.div>}
            {!winner && !isDraw && <div className="backdrop-blur-xl bg-white/50 dark:bg-slate-800/50 border border-white/30 dark:border-slate-700/30 rounded-full px-5 py-2">
                {isMyTurn ? <span className="text-emerald-500 font-bold animate-pulse text-sm">🎯 Lượt của bạn!</span> : <span className="text-sm text-slate-400">⏳ Đợi đối thủ...</span>}
            </div>}
        </div>
    );
};

// ==================== ONLINE GOMOKU ====================
type Coord = `${number},${number}`;
const OnlineGomoku: React.FC<{ room: GameRoom; myUid: string }> = ({ room, myUid }) => {
    const gs = (room.gameState || {}) as GomokuState;
    const rawStones = gs.stones || {};
    const stones: Record<string, 'X' | 'O'> = Object.fromEntries(Object.entries(rawStones).filter(([k]) => k !== '_init'));
    const mySymbol = myUid === gs.playerX ? 'X' : myUid === gs.playerO ? 'O' : null;
    const isMyTurn = (gs.isXNext && myUid === gs.playerX) || (!gs.isXNext && myUid === gs.playerO);
    const winner = gs.winner;

    // Smooth viewport: fractional grid coordinates
    const [vpX, setVpX] = useState(0);
    const [vpY, setVpY] = useState(0);
    const [cellSize, setCellSize] = useState(36);
    const [targetCellSize, setTargetCellSize] = useState(36);
    const containerRef = useRef<HTMLDivElement>(null);
    const [boardDim, setBoardDim] = useState({ w: 540, h: 540 });

    // Drag state
    const dragRef = useRef<{ startX: number; startY: number; vpX: number; vpY: number; moved: boolean; lastT: number; velX: number; velY: number } | null>(null);
    const pinchRef = useRef<{ dist: number; cellSize: number; midX: number; midY: number } | null>(null);
    const animRef = useRef<number>(0);

    const playerNames = room.players || {};
    const xName = playerNames[gs.playerX]?.name || 'X';
    const oName = playerNames[gs.playerO]?.name || 'O';

    // Dynamically measure container
    useEffect(() => {
        const measure = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const w = Math.floor(rect.width);
                const availH = Math.floor(window.innerHeight - rect.top - 80);
                const h = Math.max(280, Math.min(availH, 700));
                setBoardDim({ w, h });
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    // Smooth zoom animation
    useEffect(() => {
        if (Math.abs(cellSize - targetCellSize) < 0.5) {
            setCellSize(targetCellSize);
            return;
        }
        const id = requestAnimationFrame(() => {
            setCellSize(prev => prev + (targetCellSize - prev) * 0.25);
        });
        return () => cancelAnimationFrame(id);
    }, [cellSize, targetCellSize]);

    const visibleCols = Math.ceil(boardDim.w / cellSize) + 2;
    const visibleRows = Math.ceil(boardDim.h / cellSize) + 2;

    const checkWin = (map: Record<string, string>, cx: number, cy: number, player: string) => {
        const dirs: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];
        const opponent = player === 'X' ? 'O' : 'X';
        for (const [dx, dy] of dirs) {
            // Count consecutive stones in both directions
            let countPositive = 0;
            for (let d = 1; d <= 4; d++) { if (map[`${cx + dx * d},${cy + dy * d}`] === player) countPositive++; else break; }
            let countNegative = 0;
            for (let d = 1; d <= 4; d++) { if (map[`${cx - dx * d},${cy - dy * d}`] === player) countNegative++; else break; }

            const total = 1 + countPositive + countNegative;
            if (total >= 5) {
                // Build the winning line
                const line: string[] = [`${cx},${cy}`];
                for (let d = 1; d <= countPositive; d++) line.push(`${cx + dx * d},${cy + dy * d}`);
                for (let d = 1; d <= countNegative; d++) line.push(`${cx - dx * d},${cy - dy * d}`);

                // Check if both ends are blocked by opponent (Caro rule: blocked both ends = no win)
                if (total === 5) {
                    const endPositive = `${cx + dx * (countPositive + 1)},${cy + dy * (countPositive + 1)}`;
                    const endNegative = `${cx - dx * (countNegative + 1)},${cy - dy * (countNegative + 1)}`;
                    const blockedPositive = map[endPositive] === opponent;
                    const blockedNegative = map[endNegative] === opponent;
                    if (blockedPositive && blockedNegative) continue; // Blocked both ends, not a win
                }

                return { player, line: line.slice(0, 5) };
            }
        }
        return null;
    };

    const place = async (x: number, y: number) => {
        if (!isMyTurn || winner) return;
        const key: Coord = `${x},${y}`;
        if (stones[key]) return;
        const next: Record<string, 'X' | 'O'> = { ...stones, [key]: mySymbol! };
        const w = checkWin(next, x, y, mySymbol!);
        const newState: GomokuState = { ...gs, stones: next, isXNext: !gs.isXNext, moveCount: (gs.moveCount || 0) + 1, lastMove: key };
        if (w) {
            newState.winner = w as any;
            if (w.player === 'X') newState.scoreX = (gs.scoreX || 0) + 1; else newState.scoreO = (gs.scoreO || 0) + 1;
            const now = Date.now();
            const startedAt = room.createdAt || now;
            const duration = Math.round((now - startedAt) / 1000);
            try {
                const winnerUid = w.player === 'X' ? gs.playerX : gs.playerO;
                const loserUid = w.player === 'X' ? gs.playerO : gs.playerX;
                const pNames = room.players || {};
                await MinigameService.saveGameHistory({
                    gameType: 'gomoku', roomId: room.id,
                    result: `🎉 ${pNames[winnerUid]?.name || w.player} thắng!`,
                    winner: winnerUid, winnerName: pNames[winnerUid]?.name, loserName: pNames[loserUid]?.name,
                    players: {
                        [gs.playerX]: { name: pNames[gs.playerX]?.name || 'X', avatar: pNames[gs.playerX]?.avatar || '', won: w.player === 'X', score: w.player === 'X' ? 1 : 0 },
                        [gs.playerO]: { name: pNames[gs.playerO]?.name || 'O', avatar: pNames[gs.playerO]?.avatar || '', won: w.player === 'O', score: w.player === 'O' ? 1 : 0 },
                    },
                    startedAt, finishedAt: now, duration,
                });
            } catch (e) { console.error('Save Gomoku history error:', e); }
        }
        await MinigameService.updateGameState(room.id, newState);
    };

    const reset = async () => {
        const cleanState: any = {
            playerX: gs.playerX,
            playerO: gs.playerO,
            isXNext: true,
            moveCount: 0,
            scoreX: gs.scoreX || 0,
            scoreO: gs.scoreO || 0,
            scoreDraw: gs.scoreDraw || 0,
            stones: { _init: true },
        };
        await MinigameService.updateGameState(room.id, cleanState);
        setVpX(0); setVpY(0);
        setTargetCellSize(36);
    };

    const focusLastMove = () => {
        if (gs.lastMove) {
            const [x, y] = gs.lastMove.split(',').map(Number);
            setVpX(x); setVpY(y);
        }
    };

    const smoothZoom = (delta: number) => {
        setTargetCellSize(t => Math.max(14, Math.min(72, t + delta)));
    };

    // ---- POINTER DRAG (smooth fractional pan + momentum) ----
    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === 'touch' && e.isPrimary === false) return;
        cancelAnimationFrame(animRef.current);
        dragRef.current = { startX: e.clientX, startY: e.clientY, vpX, vpY, moved: false, lastT: Date.now(), velX: 0, velY: 0 };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current) return;
        const dx = (e.clientX - dragRef.current.startX) / cellSize;
        const dy = (e.clientY - dragRef.current.startY) / cellSize;
        if (Math.abs(dx) > 0.15 || Math.abs(dy) > 0.15) {
            dragRef.current.moved = true;
            const now = Date.now();
            const dt = Math.max(1, now - dragRef.current.lastT);
            const newX = dragRef.current.vpX - dx;
            const newY = dragRef.current.vpY - dy;
            // Track velocity for momentum
            dragRef.current.velX = (newX - vpX) / dt * 16;
            dragRef.current.velY = (newY - vpY) / dt * 16;
            dragRef.current.lastT = now;
            setVpX(newX);
            setVpY(newY);
        }
    };

    const handlePointerUp = () => {
        if (dragRef.current?.moved) {
            // Apply momentum
            const { velX, velY } = dragRef.current;
            if (Math.abs(velX) > 0.02 || Math.abs(velY) > 0.02) {
                let vx = velX, vy = velY;
                const friction = 0.92;
                const animate = () => {
                    vx *= friction; vy *= friction;
                    if (Math.abs(vx) < 0.005 && Math.abs(vy) < 0.005) return;
                    setVpX(p => p + vx);
                    setVpY(p => p + vy);
                    animRef.current = requestAnimationFrame(animate);
                };
                animRef.current = requestAnimationFrame(animate);
            }
        }
        dragRef.current = null;
    };

    // ---- PINCH TO ZOOM (centered) ----
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            pinchRef.current = { dist, cellSize: targetCellSize, midX, midY };
        }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchRef.current) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const scale = dist / pinchRef.current.dist;
            const newSize = Math.max(14, Math.min(72, Math.round(pinchRef.current.cellSize * scale)));
            setTargetCellSize(newSize);
            setCellSize(prev => prev + (newSize - prev) * 0.3);
        }
    };
    const handleTouchEnd = () => { pinchRef.current = null; };

    // ---- WHEEL ZOOM (centered on cursor) ----
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 3 : -3;
            smoothZoom(delta);
        } else {
            // Scroll without ctrl = pan
            setVpX(p => p + e.deltaX / cellSize * 0.5);
            setVpY(p => p + e.deltaY / cellSize * 0.5);
        }
    };

    // Cleanup momentum animation on unmount
    useEffect(() => () => cancelAnimationFrame(animRef.current), []);

    // Grid rendering with fractional offset for smooth panning
    const startCol = Math.floor(vpX - visibleCols / 2);
    const startRow = Math.floor(vpY - visibleRows / 2);
    const offsetX = -(vpX - startCol - visibleCols / 2) * cellSize;
    const offsetY = -(vpY - startRow - visibleRows / 2) * cellSize;

    const rows: number[] = [];
    for (let y = startRow; y <= startRow + visibleRows; y++) rows.push(y);
    const cols: number[] = [];
    for (let x = startCol; x <= startCol + visibleCols; x++) cols.push(x);

    return (
        <div className="flex flex-col items-center gap-3 w-full max-w-3xl mx-auto">
            {/* Player cards with glassmorphism */}
            <div className="w-full flex items-center justify-between gap-3 px-2">
                <div className={clsx("flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300",
                    "backdrop-blur-xl border",
                    gs.isXNext && !winner
                        ? "bg-blue-500/10 border-blue-400/50 shadow-lg shadow-blue-500/10"
                        : "bg-white/60 dark:bg-slate-800/60 border-white/30 dark:border-slate-700/50")}>
                    <AvatarImg src={playerNames[gs.playerX]?.avatar} name={xName} className="w-10 h-10 rounded-xl border-2 border-blue-400/50 shrink-0" size={40} gradientFrom="from-blue-400" gradientTo="to-blue-600" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate">{xName}</p>
                        <p className="text-xs text-slate-400">✕ Quân X</p>
                    </div>
                    <span className="text-2xl font-black text-blue-500">{gs.scoreX || 0}</span>
                </div>
                <div className="flex flex-col items-center px-2 shrink-0">
                    <span className="text-xs font-bold text-slate-400 tracking-widest">VS</span>
                    <span className="text-[10px] text-slate-300">Hòa {gs.scoreDraw || 0}</span>
                </div>
                <div className={clsx("flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300",
                    "backdrop-blur-xl border",
                    !gs.isXNext && !winner
                        ? "bg-rose-500/10 border-rose-400/50 shadow-lg shadow-rose-500/10"
                        : "bg-white/60 dark:bg-slate-800/60 border-white/30 dark:border-slate-700/50")}>
                    <span className="text-2xl font-black text-rose-500">{gs.scoreO || 0}</span>
                    <div className="min-w-0 flex-1 text-right">
                        <p className="text-sm font-bold text-rose-600 dark:text-rose-400 truncate">{oName}</p>
                        <p className="text-xs text-slate-400">○ Quân O</p>
                    </div>
                    <AvatarImg src={playerNames[gs.playerO]?.avatar} name={oName} className="w-10 h-10 rounded-xl border-2 border-rose-400/50 shrink-0" size={40} gradientFrom="from-rose-400" gradientTo="to-rose-600" />
                </div>
            </div>
            {/* Toolbar with glassmorphism */}
            <div className="flex items-center gap-2 flex-wrap justify-center backdrop-blur-xl bg-white/60 dark:bg-slate-800/60 border border-white/30 dark:border-slate-700/30 rounded-2xl px-3 py-2 shadow-sm">
                <button onClick={() => smoothZoom(5)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-700/50 transition-all text-xs font-medium shadow-sm" title="Phóng to"><ZoomIn size={16} /><span className="hidden sm:inline">Phóng to</span></button>
                <button onClick={() => smoothZoom(-5)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-700/50 transition-all text-xs font-medium shadow-sm" title="Thu nhỏ"><ZoomOut size={16} /><span className="hidden sm:inline">Thu nhỏ</span></button>
                <button onClick={() => { setVpX(0); setVpY(0); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-800/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-700/50 transition-all text-xs font-medium shadow-sm" title="Về trung tâm">⌂<span className="hidden sm:inline">Trung tâm</span></button>
                {gs.lastMove && <button onClick={focusLastMove} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-700/50 transition-all text-xs font-medium shadow-sm" title="Đến nước đi cuối"><Target size={16} /><span className="hidden sm:inline">Nước cuối</span></button>}
                <span className="text-[10px] text-slate-400 font-medium ml-1">{Math.round(cellSize)}px · {gs.moveCount || 0} nước</span>
            </div>
            {/* Board with glassmorphism */}
            <div ref={containerRef} className="w-full rounded-2xl overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing backdrop-blur-xl bg-amber-50/60 dark:bg-slate-900/50 border-2 border-white/40 dark:border-slate-700/40 shadow-2xl"
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
                style={{ height: boardDim.h }}>
                <div className="relative w-full h-full" style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}>
                    {rows.map((y, ri) => cols.map((x, ci) => {
                        const key = `${x},${y}`;
                        const stone = stones[key];
                        const isWinCell = winner?.line?.includes(key);
                        const isCenter = x === 0 && y === 0;
                        const isLast = key === gs.lastMove;
                        const cs = cellSize;
                        return (
                            <div key={key} onClick={() => { if (!dragRef.current?.moved) place(x, y); }}
                                className={clsx("absolute border flex items-center justify-center cursor-pointer",
                                    "border-slate-300/25 dark:border-slate-600/20",
                                    isWinCell && "bg-gradient-to-br from-yellow-200/70 to-amber-300/60 dark:from-yellow-800/30 dark:to-amber-700/30 z-10",
                                    isLast && !isWinCell && "bg-emerald-100/50 dark:bg-emerald-900/20",
                                    !stone && isMyTurn && "hover:bg-blue-100/40 dark:hover:bg-blue-800/20")}
                                style={{ left: ci * cs, top: ri * cs, width: cs, height: cs }}>
                                {isCenter && !stone && <div className="w-1.5 h-1.5 rounded-full bg-slate-400/50 absolute" />}
                                {stone === 'X' && <div className="relative flex items-center justify-center">
                                    <HandX size={Math.round(cs * 0.72)} />
                                    {isLast && !isWinCell && <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-40" style={{ width: cs * 0.55, height: cs * 0.55, margin: 'auto' }} />}
                                </div>}
                                {stone === 'O' && <div className="relative flex items-center justify-center">
                                    <HandO size={Math.round(cs * 0.66)} />
                                    {isLast && !isWinCell && <div className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-40" style={{ width: cs * 0.55, height: cs * 0.55, margin: 'auto' }} />}
                                </div>}
                            </div>
                        );
                    }))}
                </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center">Kéo để di chuyển · Ctrl+Scroll hoặc chụm ngón để zoom · Bàn cờ không giới hạn</p>
            {/* Result / Status */}
            {winner && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="text-center backdrop-blur-xl bg-white/60 dark:bg-slate-800/60 border border-white/40 dark:border-slate-700/40 rounded-2xl px-8 py-5 shadow-xl">
                <p className="text-xl font-black mb-3"><span className={winner.player === 'X' ? 'text-blue-500' : 'text-rose-500'}>🎉 {winner.player === 'X' ? xName : oName} thắng!</span></p>
                <button onClick={reset} className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-bold text-sm flex items-center gap-2 mx-auto transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50"><RotateCcw size={16} /> Chơi tiếp</button>
            </motion.div>}
            {!winner && <div className="backdrop-blur-xl bg-white/50 dark:bg-slate-800/50 border border-white/30 dark:border-slate-700/30 rounded-full px-5 py-2">
                {isMyTurn ? <span className="text-emerald-500 font-bold animate-pulse text-sm">🎯 Lượt của bạn!</span> : <span className="text-sm text-slate-400">⏳ Đợi đối thủ...</span>}
            </div>}
        </div>
    );
};

// ==================== ONLINE WEREWOLF (imported from WerewolfGame.tsx) ====================



// ==================== ROOM LOBBY (waiting room) ====================
const RoomLobby: React.FC<{ room: GameRoom; myUid: string; onStart: () => void; onLeave: () => void }> = ({ room, myUid, onStart, onLeave }) => {
    const { users } = useData();
    const isHost = myUid === room.hostId;
    const playerList = Object.entries(room.players || {});
    const game = GAMES.find(g => g.id === room.gameType)!;
    const minPlayers = room.gameType === 'werewolf' ? 5 : 2;
    const canStart = playerList.length >= minPlayers;

    return (
        <div className="max-w-md mx-auto text-center">
            <div className={clsx("w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg mx-auto mb-3", game.gradient)}>{game.icon}</div>
            <h3 className="text-xl font-bold mb-1">{game.name}</h3>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-full text-xs text-emerald-600 font-bold mb-4">
                <Wifi size={12} /> Trực tuyến
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-slate-400 mb-3">NGƯỜI CHƠI ({playerList.length})</p>
                <div className="space-y-2">
                    {playerList.map(([uid, data]: [string, any]) => (
                        <div key={uid} className="flex items-center gap-2 text-sm">
                            <AvatarImg src={data.avatar} name={data.name} className="w-7 h-7 rounded-full shrink-0" size={28} />
                            <span className="font-medium">{data.name}</span>
                            {uid === room.hostId && <Crown size={14} className="text-amber-500" />}
                            {isHost && uid !== myUid && (
                                <button onClick={() => { if (confirm(`Chuyển quyền trưởng phòng cho ${data.name}?`)) MinigameService.transferHost(room.id, uid); }} className="p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors ml-auto" title={`Chuyển quyền cho ${data.name}`}>
                                    <ArrowRightLeft size={13} />
                                </button>
                            )}
                            {(!isHost || uid === myUid) && <Check size={14} className="text-emerald-500 ml-auto" />}
                        </div>
                    ))}
                </div>
                {(room.invitedPlayers || []).filter((uid: string) => !room.players?.[uid]).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-400 mb-2">Đang chờ:</p>
                        {room.invitedPlayers.filter((key: string) => !room.players?.[key]).map((key: string) => {
                            const rawEmail = decodeEmail(key);
                            const u = users.find(u => (u.email || '').toLowerCase() === rawEmail.toLowerCase());
                            return <p key={key} className="text-xs text-slate-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> {u?.name || rawEmail}</p>;
                        })}
                    </div>
                )}
            </div>
            <div className="flex gap-2">
                <button onClick={onLeave} className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300">
                    <LogOut size={16} /> Rời phòng
                </button>
                {isHost && <button onClick={onStart} disabled={!canStart}
                    className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                    <Gamepad2 size={16} /> Bắt đầu
                </button>}
            </div>
        </div>
    );
};

// ==================== MAIN COMPONENT ====================
const Minigame: React.FC = () => {
    const { currentUser } = useAuth();
    const { users } = useData();
    const myEmail = (currentUser?.email || '').toLowerCase();
    const myUser = users.find(u => (u.email || '').toLowerCase() === myEmail);
    const myName = myUser?.name || currentUser?.displayName || 'Unknown';
    const myAvatar = myUser?.avatar || '';
    // Use encoded email as universal ID for RTDB (. and @ are not allowed in keys)
    const myUid = encodeEmail(myEmail);

    const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
    const [myRooms, setMyRooms] = useState<GameRoom[]>([]);
    const [showCreate, setShowCreate] = useState<GameId | null>(null);
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
    const [showPicker, setShowPicker] = useState(false);
    const [creating, setCreating] = useState(false);
    const [offlineGame, setOfflineGame] = useState<GameId | null>(null);


    useEffect(() => {
        if (!myEmail) return;
        return MinigameService.subscribeToMyRooms(myEmail, setMyRooms);
    }, [myEmail]);

    // Subscribe to active room
    useEffect(() => {
        if (!activeRoom?.id) return;
        return MinigameService.subscribeToRoom(activeRoom.id, (room) => {
            if (room) setActiveRoom(room);
            else setActiveRoom(null);
        });
    }, [activeRoom?.id]);

    const createRoom = async (gameType: GameId) => {
        if (creating || !myEmail) return;
        setCreating(true);
        try {
            const roomId = await MinigameService.createRoom(myEmail, myName, myAvatar, gameType, selectedPlayers);
            const room = await MinigameService.getRoom(roomId);
            setActiveRoom(room);
            setShowCreate(null);
            setSelectedPlayers([]);
        } catch (err) {
            console.error('Create room error:', err);
            alert('Không thể tạo phòng. Vui lòng thử lại!');
        } finally { setCreating(false); }
    };

    const joinRoom = async (room: GameRoom) => {
        await MinigameService.joinRoom(room.id, myEmail, myName, myAvatar);
        setActiveRoom(room);
    };

    const leaveRoom = async () => {
        if (!activeRoom) return;
        if (myUid === activeRoom.hostId) { await MinigameService.deleteRoom(activeRoom.id); }
        else { await MinigameService.leaveRoom(activeRoom.id, myEmail); }
        setActiveRoom(null);
    };

    const startGame = async () => {
        if (!activeRoom) return;
        const playerUids = Object.keys(activeRoom.players || {});
        const g = activeRoom.gameType;
        let initState: any = {};
        if (g === 'tic-tac-toe') {
            initState = { board: Array(9).fill(null), playerX: playerUids[0], playerO: playerUids[1], isXNext: true, scoreX: 0, scoreO: 0, scoreDraw: 0 } as TicTacToeState;
        } else if (g === 'gomoku') {
            initState = { stones: {}, playerX: playerUids[0], playerO: playerUids[1], isXNext: true, moveCount: 0 } as GomokuState;
        } else if (g === 'werewolf') {
            initState = { phase: 'waiting' };
        }
        await MinigameService.updateGameState(activeRoom.id, initState);
        await MinigameService.updateRoomStatus(activeRoom.id, 'playing');
    };

    const togglePlayer = (uid: string) => {
        setSelectedPlayers(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]);
    };

    const pendingInvites = myRooms.filter(r => r.status === 'waiting' && r.hostId !== myUid && !r.players?.[myUid]);
    const activeRooms = myRooms.filter(r => r.status !== 'finished' && (r.players?.[myUid] || r.hostId === myUid));



    // RENDER — Offline Games
    if (offlineGame === 'tic-tac-toe') return <OfflineTicTacToe onBack={() => setOfflineGame(null)} />;
    if (offlineGame === 'gomoku') return <OfflineGomoku onBack={() => setOfflineGame(null)} />;

    // RENDER — Active Game
    if (activeRoom && activeRoom.status === 'playing') {
        const game = GAMES.find(g => g.id === activeRoom.gameType)!;
        const isWerewolf = activeRoom.gameType === 'werewolf';
        return (
            <div className={clsx("min-h-screen p-4 sm:p-6", isWerewolf
                ? "bg-[#0a0a0f]"
                : "bg-gradient-to-br from-indigo-50 via-white to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30"
            )} style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                <div className={isWerewolf ? "max-w-5xl mx-auto" : "max-w-2xl mx-auto"}>
                    <button onClick={() => setActiveRoom(null)} className={clsx("flex items-center gap-2 text-sm mb-4 font-semibold", isWerewolf ? "text-[#a89b85] hover:text-[#c9873a]" : "text-slate-500 hover:text-indigo-500 transition-colors")}>
                        <ArrowLeft size={16} /> Quay lại
                    </button>
                    <div className="flex items-center gap-3 mb-5">
                        <div className={clsx("w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg", game.gradient)}>{game.icon}</div>
                        <div><h2 className={clsx("font-bold text-xl", isWerewolf ? "text-[#e8dcc8]" : "text-slate-800 dark:text-white")}>{game.name}</h2>
                            <div className="flex items-center gap-2 text-xs"><Wifi size={10} className="text-emerald-500" /><span className="text-emerald-500 font-bold">Trực tuyến</span></div>
                        </div>
                    </div>
                    {isWerewolf ? (
                        <OnlineWerewolfNew room={activeRoom} myUid={myUid} myName={myName} myAvatar={myAvatar} />
                    ) : (
                        <div>
                            {activeRoom.gameType === 'tic-tac-toe' && <OnlineTicTacToe room={activeRoom} myUid={myUid} />}
                            {activeRoom.gameType === 'gomoku' && <OnlineGomoku room={activeRoom} myUid={myUid} />}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // RENDER — Lobby
    if (activeRoom && activeRoom.status === 'waiting') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 p-4 sm:p-6" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                <div className="max-w-2xl mx-auto">
                    <button onClick={() => setActiveRoom(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-500 mb-4 font-semibold transition-colors"><ArrowLeft size={16} /> Quay lại</button>
                    <div className="backdrop-blur-xl bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-slate-700/40 rounded-3xl p-6 shadow-2xl">
                        <RoomLobby room={activeRoom} myUid={myUid} onStart={startGame} onLeave={leaveRoom} />
                    </div>
                </div>
            </div>
        );
    }

    // RENDER — Main Hub
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 p-4 sm:p-6" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
            <AnimatePresence>{showPicker && <PlayerPicker selected={selectedPlayers} onToggle={togglePlayer} onClose={() => setShowPicker(false)} />}</AnimatePresence>

            {/* Hero Banner */}
            <div className="max-w-4xl mx-auto mb-8">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                    {/* Animated gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxLjUiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
                    <div className="relative px-6 sm:px-8 py-8 sm:py-10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-lg">
                                <Gamepad2 size={32} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur rounded-full text-[10px] font-bold text-white/90 tracking-wider uppercase">🎮 Entertainment</span>
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1">Minigame Hub</h1>
                                <p className="text-white/70 text-sm font-medium">Chơi trực tuyến cùng đồng nghiệp · Realtime multiplayer</p>
                            </div>
                        </div>
                        {/* Stats row */}
                        <div className="mt-6 flex flex-wrap gap-3">
                            <div className="backdrop-blur-xl bg-white/15 border border-white/20 rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center"><Gamepad2 size={16} className="text-white" /></div>
                                <div><p className="text-[10px] text-white/60 font-medium">Trò chơi</p><p className="text-lg font-bold text-white">{GAMES.length}</p></div>
                            </div>
                            <div className="backdrop-blur-xl bg-white/15 border border-white/20 rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center"><Wifi size={16} className="text-white" /></div>
                                <div><p className="text-[10px] text-white/60 font-medium">Phòng hoạt động</p><p className="text-lg font-bold text-white">{activeRooms.length}</p></div>
                            </div>
                            {pendingInvites.length > 0 && (
                                <div className="backdrop-blur-xl bg-amber-500/20 border border-amber-400/30 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 animate-pulse">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">📩</div>
                                    <div><p className="text-[10px] text-white/60 font-medium">Lời mời</p><p className="text-lg font-bold text-white">{pendingInvites.length}</p></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
                <div className="max-w-4xl mx-auto mb-6">
                    <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2 tracking-wide">📩 Lời mời chơi ({pendingInvites.length})</h3>
                    <div className="space-y-2">
                        {pendingInvites.map(r => {
                            const game = GAMES.find(g => g.id === r.gameType)!;
                            return (
                                <div key={r.id} className="backdrop-blur-xl bg-amber-50/70 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 rounded-2xl p-4 flex items-center gap-3 shadow-md">
                                    <div className={clsx("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0 shadow-md", game.gradient)}>{game.icon}</div>
                                    <div className="flex-1"><p className="font-bold text-sm text-slate-800 dark:text-white">{r.hostName} mời bạn chơi {game.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{Object.keys(r.players || {}).length} người đã vào</p></div>
                                    <button onClick={() => joinRoom(r)} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 transition-all">Vào</button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Active Rooms */}
            {activeRooms.length > 0 && (
                <div className="max-w-4xl mx-auto mb-8">
                    <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-2 tracking-wide uppercase"><Wifi size={14} /> Phòng đang chơi</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeRooms.map(r => {
                            const game = GAMES.find(g => g.id === r.gameType)!;
                            const playerEntries = Object.entries(r.players || {}) as [string, any][];
                            const sortedPlayers = [...playerEntries].sort(([a], [b]) => {
                                if (a === r.hostId) return -1;
                                if (b === r.hostId) return 1;
                                return 0;
                            });
                            const gs = r.gameState;
                            let isMyTurnInRoom = false;
                            if (gs && r.status === 'playing' && (r.gameType === 'tic-tac-toe' || r.gameType === 'gomoku')) {
                                const mySymbol = gs.playerX === myUid ? 'X' : gs.playerO === myUid ? 'O' : null;
                                if (mySymbol && !gs.winner && !gs.isDraw) {
                                    isMyTurnInRoom = (gs.isXNext && mySymbol === 'X') || (!gs.isXNext && mySymbol === 'O');
                                }
                            }
                            return (
                                <motion.button key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    onClick={() => setActiveRoom(r)}
                                    className={clsx("w-full text-left rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl group relative",
                                        isMyTurnInRoom ? "shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30" : "shadow-lg")}>
                                    {/* Gradient accent top bar */}
                                    <div className={clsx("h-1 bg-gradient-to-r w-full", game.gradient)} />
                                    {/* Card body */}
                                    <div className={clsx("backdrop-blur-xl p-4 border border-t-0",
                                        isMyTurnInRoom
                                            ? "bg-gradient-to-br from-emerald-50/80 via-white/70 to-teal-50/60 dark:from-emerald-900/20 dark:via-slate-800/60 dark:to-teal-900/20 border-emerald-300/40 dark:border-emerald-600/30"
                                            : "bg-gradient-to-br from-white/80 via-white/60 to-slate-50/70 dark:from-slate-800/60 dark:via-slate-800/50 dark:to-slate-900/60 border-white/40 dark:border-slate-700/40")}>
                                        {/* Row 1: Game info + actions */}
                                        <div className="flex items-start gap-3">
                                            {/* Game icon with glow */}
                                            <div className="relative shrink-0">
                                                <div className={clsx("w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300", game.gradient)}>{game.icon}</div>
                                                {isMyTurnInRoom && <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-ping" />}
                                                {isMyTurnInRoom && <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800" />}
                                            </div>
                                            {/* Title + status */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="font-bold text-base text-slate-800 dark:text-white truncate">{game.name}</p>
                                                    {r.hostId === myUid && <Crown size={13} className="text-amber-500 shrink-0" />}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                                                        r.status === 'playing'
                                                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                                                            : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400")}>
                                                        <span className={clsx("w-1.5 h-1.5 rounded-full", r.status === 'playing' ? "bg-emerald-500" : "bg-amber-500")} />
                                                        {r.status === 'playing' ? 'Đang chơi' : 'Chờ'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{playerEntries.length} người</span>
                                                </div>
                                            </div>
                                            {/* Actions */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                {isMyTurnInRoom && (
                                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/40 px-2.5 py-1 rounded-full animate-pulse shadow-sm">🎯 Lượt bạn</span>
                                                )}
                                                {r.hostId === myUid && (
                                                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Xóa phòng này?')) MinigameService.deleteRoom(r.id); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50/80 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Xóa phòng">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Row 2: Score (for competitive games) */}
                                        {(r.gameType === 'tic-tac-toe' || r.gameType === 'gomoku') && gs && (() => {
                                            const pX = r.players?.[gs.playerX];
                                            const pO = r.players?.[gs.playerO];
                                            return (
                                                <div className="mt-3 flex items-center justify-center gap-3 backdrop-blur bg-gradient-to-r from-blue-50/60 via-white/40 to-rose-50/60 dark:from-blue-900/20 dark:via-slate-800/30 dark:to-rose-900/20 rounded-xl px-4 py-2 border border-white/30 dark:border-slate-700/30">
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative">
                                                            <AvatarImg src={pX?.avatar} name={pX?.name || 'X'} className="w-7 h-7 rounded-full border-2 border-blue-300/50" size={28} gradientFrom="from-blue-400" gradientTo="to-blue-600" />
                                                            {gs.playerX === r.hostId && <Crown size={10} className="absolute -top-1.5 -right-1 text-amber-500 drop-shadow" />}
                                                        </div>
                                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{pX?.name?.split(' ').pop() || 'X'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xl font-black bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">{gs.scoreX || 0}</span>
                                                        <span className="text-xs text-slate-300 font-bold">-</span>
                                                        <span className="text-xl font-black bg-gradient-to-r from-rose-500 to-rose-600 bg-clip-text text-transparent">{gs.scoreO || 0}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{pO?.name?.split(' ').pop() || 'O'}</span>
                                                        <div className="relative">
                                                            <AvatarImg src={pO?.avatar} name={pO?.name || 'O'} className="w-7 h-7 rounded-full border-2 border-rose-300/50" size={28} gradientFrom="from-rose-400" gradientTo="to-rose-600" />
                                                            {gs.playerO === r.hostId && <Crown size={10} className="absolute -top-1.5 -right-1 text-amber-500 drop-shadow" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {/* Row 3: Player avatars (stacked) — only for non-competitive or games without score display */}
                                        {sortedPlayers.length > 0 && !(((r.gameType === 'tic-tac-toe' || r.gameType === 'gomoku') && gs)) && (
                                            <div className="mt-3 flex items-center">
                                                {/* Stacked avatars */}
                                                <div className="flex -space-x-2">
                                                    {sortedPlayers.slice(0, 6).map(([uid, data]: [string, any]) => (
                                                        <div key={uid} className="relative">
                                                            <AvatarImg
                                                                src={data.avatar}
                                                                name={data.name}
                                                                className={clsx("w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 hover:z-10",
                                                                    isMyTurnInRoom && uid === myUid ? "border-emerald-400 ring-2 ring-emerald-300/50" : "border-white dark:border-slate-700")}
                                                                size={28}
                                                                title={data.name}
                                                            />
                                                            {uid === r.hostId && <Crown size={10} className="absolute -top-1.5 -right-0.5 text-amber-500 drop-shadow" />}
                                                        </div>
                                                    ))}
                                                    {sortedPlayers.length > 6 && (
                                                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 border-2 border-white dark:border-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-300">+{sortedPlayers.length - 6}</div>
                                                    )}
                                                </div>
                                                {/* Host name */}
                                                <span className="ml-2 text-[10px] text-slate-400 font-medium">Host: <span className="text-slate-600 dark:text-slate-300 font-semibold">{sortedPlayers[0]?.[1]?.name}</span></span>
                                            </div>
                                        )}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Create New Game */}
            {showCreate ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto backdrop-blur-xl bg-white/60 dark:bg-slate-800/60 rounded-3xl p-6 border border-white/40 dark:border-slate-700/40 shadow-2xl mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-base text-slate-800 dark:text-white">Tạo phòng: {GAMES.find(g => g.id === showCreate)?.name}</h3>
                        <button onClick={() => { setShowCreate(null); setSelectedPlayers([]); }} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
                    </div>
                    <button onClick={() => setShowPicker(true)} className="w-full py-3 border-2 border-dashed border-indigo-300/60 dark:border-indigo-600/50 rounded-2xl text-sm font-semibold text-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 flex items-center justify-center gap-2 mb-3 transition-colors backdrop-blur">
                        <Users size={16} /> Chọn người chơi từ Nhân sự
                    </button>
                    {selectedPlayers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {selectedPlayers.map(email => {
                                const u = users.find(u => (u.email || '').toLowerCase() === email);
                                return <span key={email} className="px-2.5 py-1 bg-indigo-50/70 dark:bg-indigo-900/30 rounded-xl text-xs font-semibold flex items-center gap-1 border border-indigo-200/50 dark:border-indigo-700/30">
                                    {u?.name || email} <button onClick={() => togglePlayer(email)} className="text-slate-400 hover:text-red-500 transition-colors">×</button>
                                </span>;
                            })}
                        </div>
                    )}
                    <button onClick={() => createRoom(showCreate)} disabled={selectedPlayers.length < 1 || creating}
                        className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl font-bold disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all">
                        {creating ? <Loader2 size={16} className="animate-spin" /> : <Gamepad2 size={16} />} Tạo phòng
                    </button>
                </motion.div>
            ) : null}

            {/* Game Grid */}
            <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {GAMES.map((g, i) => (
                    <motion.div key={g.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="group backdrop-blur-xl bg-white/50 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/50 rounded-3xl relative overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                        {/* Thumbnail */}
                        <div className="relative overflow-hidden rounded-t-3xl">
                            <img src={g.thumbnail} alt={g.name} className="w-full h-auto block group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                                <h3 className="font-bold text-white text-lg drop-shadow-lg tracking-tight">{g.name}</h3>
                                <p className="text-xs text-white/80 leading-relaxed drop-shadow font-medium">{g.desc}</p>
                            </div>
                        </div>
                        {/* Info & Actions */}
                        <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 px-2.5 py-0.5 rounded-full shadow-sm">{g.category}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">👥 {g.players}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowCreate(g.id)} className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30">
                                    <Plus size={16} /> Tạo phòng
                                </button>
                                {(g.id === 'tic-tac-toe' || g.id === 'gomoku') && (
                                    <button onClick={() => setOfflineGame(g.id)} className="py-2.5 px-4 backdrop-blur bg-white/60 dark:bg-slate-700/60 hover:bg-white/80 dark:hover:bg-slate-600/60 border border-white/50 dark:border-slate-600/50 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all text-slate-600 dark:text-slate-300" title="Chơi với máy">
                                        <Monitor size={14} /> Máy
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Stats & Leaderboard */}
            <div className="max-w-4xl mx-auto mt-8">
                <GameStats />
            </div>

            <div className="max-w-4xl mx-auto mt-5 p-4 backdrop-blur-xl bg-white/40 dark:bg-slate-800/30 rounded-2xl border border-white/40 dark:border-slate-700/30 text-center shadow-md">
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 font-medium"><Sparkles size={14} className="text-amber-400" /> Chơi trực tuyến realtime · Chọn người chơi từ Nhân sự <Sparkles size={14} className="text-amber-400" /></p>
            </div>
        </div>
    );
};

export default Minigame;

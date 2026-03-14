import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Trophy, History, BarChart3, Crown, Medal, ArrowLeft, Flame, Target, Moon, Circle, Gamepad2, Clock } from 'lucide-react';
import { MinigameService, GameHistory } from '../../services/minigameService';

// ==================== GAME STATS COMPONENT ====================
const GameStats: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [history, setHistory] = useState<GameHistory[]>([]);
    const [tab, setTab] = useState<'leaderboard' | 'history' | 'stats'>('leaderboard');
    const [filterGame, setFilterGame] = useState<string>('all');

    useEffect(() => {
        return MinigameService.subscribeToGameHistory(setHistory);
    }, []);

    const filteredHistory = useMemo(() => {
        if (filterGame === 'all') return history;
        return history.filter(h => h.gameType === filterGame);
    }, [history, filterGame]);

    // ---- COMPUTE PLAYER STATS ----
    const playerStats = useMemo(() => {
        const stats: Record<string, {
            uid: string; name: string; avatar: string;
            totalGames: number; wins: number; losses: number; draws: number;
            werewolfGames: number; werewolfWins: number;
            tttGames: number; tttWins: number;
            gomokuGames: number; gomokuWins: number;
            streak: number; bestStreak: number;
            lastPlayed: number; totalDuration: number;
        }> = {};

        // Process all history (oldest first for streak calculation)
        const sorted = [...history].sort((a, b) => a.finishedAt - b.finishedAt);

        sorted.forEach(game => {
            Object.entries(game.players || {}).forEach(([uid, p]) => {
                if (!stats[uid]) {
                    stats[uid] = {
                        uid, name: p.name, avatar: p.avatar,
                        totalGames: 0, wins: 0, losses: 0, draws: 0,
                        werewolfGames: 0, werewolfWins: 0,
                        tttGames: 0, tttWins: 0,
                        gomokuGames: 0, gomokuWins: 0,
                        streak: 0, bestStreak: 0,
                        lastPlayed: 0, totalDuration: 0,
                    };
                }
                const s = stats[uid];
                // Update name/avatar to latest
                s.name = p.name;
                s.avatar = p.avatar;
                s.totalGames++;
                s.lastPlayed = Math.max(s.lastPlayed, game.finishedAt);
                if (game.duration) s.totalDuration += game.duration;

                if (game.isDraw) {
                    s.draws++;
                } else if (p.won) {
                    s.wins++;
                    s.streak++;
                    s.bestStreak = Math.max(s.bestStreak, s.streak);
                } else {
                    s.losses++;
                    s.streak = 0;
                }

                // per-game tracking
                if (game.gameType === 'werewolf') { s.werewolfGames++; if (p.won) s.werewolfWins++; }
                if (game.gameType === 'tic-tac-toe') { s.tttGames++; if (p.won) s.tttWins++; }
                if (game.gameType === 'gomoku') { s.gomokuGames++; if (p.won) s.gomokuWins++; }
            });
        });

        return Object.values(stats).sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.totalGames - a.totalGames);
    }, [history]);

    // ---- GAME TYPE STATS ----
    const gameTypeStats = useMemo(() => {
        const ttt = history.filter(h => h.gameType === 'tic-tac-toe').length;
        const gomoku = history.filter(h => h.gameType === 'gomoku').length;
        const werewolf = history.filter(h => h.gameType === 'werewolf').length;
        return { ttt, gomoku, werewolf, total: ttt + gomoku + werewolf };
    }, [history]);

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    const formatDuration = (sec: number | undefined) => {
        if (!sec) return '';
        if (sec < 60) return `${sec}s`;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        if (m < 60) return `${m}p${s > 0 ? s + 's' : ''}`;
        const h = Math.floor(m / 60);
        return `${h}g${m % 60}p`;
    };

    const gameIcons: Record<string, React.ReactNode> = {
        'tic-tac-toe': <Target size={14} className="text-blue-500" />,
        'gomoku': <Circle size={14} className="text-emerald-500" />,
        'werewolf': <Moon size={14} className="text-violet-500" />,
    };

    const gameNames: Record<string, string> = {
        'tic-tac-toe': 'Tic Tac Toe',
        'gomoku': 'Cờ Caro',
        'werewolf': 'Ma Sói',
    };

    const tabs = [
        { id: 'leaderboard' as const, label: 'Bảng xếp hạng', icon: <Trophy size={14} /> },
        { id: 'history' as const, label: 'Lịch sử', icon: <History size={14} /> },
        { id: 'stats' as const, label: 'Thống kê', icon: <BarChart3 size={14} /> },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 p-4 sm:p-6" style={{ fontFamily: '"Be Vietnam Pro", sans-serif' }}>
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                {onBack && (
                    <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-500 mb-4 font-semibold backdrop-blur bg-white/40 dark:bg-slate-800/40 px-3 py-1.5 rounded-xl border border-white/50 dark:border-slate-700/40 transition-all hover:bg-white/60">
                        <ArrowLeft size={16} /> Quay lại Minigame
                    </button>
                )}
                {/* Hero Banner */}
                <div className="relative overflow-hidden rounded-3xl mb-6 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 sm:p-8">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                    <div className="relative flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl backdrop-blur-xl bg-white/20 border border-white/30 flex items-center justify-center shadow-lg">
                            <Trophy size={28} className="text-white" />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white/90 mb-1">🏆 Analytics</div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Game Stats</h1>
                            <p className="text-white/70 text-xs font-medium">Thống kê & Bảng xếp hạng</p>
                        </div>
                    </div>
                </div>

                {/* Quick Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {[
                        { icon: <Gamepad2 size={18} />, value: gameTypeStats.total, label: 'Tổng ván', gradient: 'from-indigo-500 to-purple-500', glow: 'shadow-indigo-200/50 dark:shadow-indigo-900/30' },
                        { icon: <Target size={18} />, value: gameTypeStats.ttt, label: 'Tic Tac Toe', gradient: 'from-blue-500 to-cyan-500', glow: 'shadow-blue-200/50 dark:shadow-blue-900/30' },
                        { icon: <Circle size={18} />, value: gameTypeStats.gomoku, label: 'Cờ Caro', gradient: 'from-emerald-500 to-teal-500', glow: 'shadow-emerald-200/50 dark:shadow-emerald-900/30' },
                        { icon: <Moon size={18} />, value: gameTypeStats.werewolf, label: 'Ma Sói', gradient: 'from-violet-500 to-purple-600', glow: 'shadow-violet-200/50 dark:shadow-violet-900/30' },
                    ].map((card, i) => (
                        <div key={i} className={clsx("backdrop-blur-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/40 rounded-2xl p-3.5 text-center shadow-lg hover:-translate-y-0.5 transition-all duration-300", card.glow)}>
                            <div className={clsx("w-9 h-9 rounded-xl bg-gradient-to-br mx-auto mb-2 flex items-center justify-center text-white shadow-md", card.gradient)}>{card.icon}</div>
                            <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{card.value}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{card.label}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 backdrop-blur-xl bg-white/40 dark:bg-slate-800/40 border border-white/50 dark:border-slate-700/40 rounded-2xl p-1.5 mb-5 shadow-sm">
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={clsx("flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all",
                                tab === t.id ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-300/30" : "text-slate-400 hover:text-slate-600 hover:bg-white/40 dark:hover:bg-slate-700/30")}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* ==================== LEADERBOARD ==================== */}
                <AnimatePresence mode="wait">
                    {tab === 'leaderboard' && (
                        <motion.div key="leaderboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            {playerStats.length === 0 ? (
                                <div className="text-center py-12">
                                    <Trophy size={48} className="mx-auto mb-3 text-slate-300" />
                                    <p className="text-slate-400">Chưa có dữ liệu. Hãy chơi game để có thống kê!</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Top 3 podium */}
                                    {playerStats.length >= 3 && (
                                        <div className="flex items-end justify-center gap-3 mb-6 pt-4">
                                            {/* 2nd place */}
                                            <div className="text-center flex-1 max-w-[120px]">
                                                <div className="relative w-14 h-14 rounded-full overflow-hidden mx-auto mb-1 border-2 border-slate-300"><img src={playerStats[1].avatar || `https://ui-avatars.com/api/?name=${playerStats[1].name}&size=64`}
                                                    className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-slate-400 to-slate-500 items-center justify-center text-white font-bold text-sm" style={{display:'none'}}>{(playerStats[1].name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                                <Medal size={16} className="mx-auto text-slate-400 mb-0.5" />
                                                <p className="text-xs font-bold truncate">{playerStats[1].name}</p>
                                                <p className="text-[10px] text-slate-400">{playerStats[1].wins} thắng</p>
                                                <div className="h-16 bg-gradient-to-t from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-t-xl mt-1" />
                                            </div>
                                            {/* 1st place */}
                                            <div className="text-center flex-1 max-w-[130px]">
                                                <div className="relative w-16 h-16 rounded-full overflow-hidden mx-auto mb-1 border-3 border-amber-400 shadow-lg shadow-amber-200/50"><img src={playerStats[0].avatar || `https://ui-avatars.com/api/?name=${playerStats[0].name}&size=64`}
                                                    className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 items-center justify-center text-white font-bold text-sm" style={{display:'none'}}>{(playerStats[0].name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                                <Crown size={18} className="mx-auto text-amber-500 mb-0.5" />
                                                <p className="text-sm font-black truncate">{playerStats[0].name}</p>
                                                <p className="text-xs text-amber-500 font-bold">{playerStats[0].wins} thắng</p>
                                                <div className="h-24 bg-gradient-to-t from-amber-200 to-amber-50 dark:from-amber-900/30 dark:to-amber-900/10 rounded-t-xl mt-1" />
                                            </div>
                                            {/* 3rd place */}
                                            <div className="text-center flex-1 max-w-[120px]">
                                                <div className="relative w-12 h-12 rounded-full overflow-hidden mx-auto mb-1 border-2 border-orange-300"><img src={playerStats[2].avatar || `https://ui-avatars.com/api/?name=${playerStats[2].name}&size=64`}
                                                    className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-500 items-center justify-center text-white font-bold text-xs" style={{display:'none'}}>{(playerStats[2].name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                                <Medal size={14} className="mx-auto text-orange-400 mb-0.5" />
                                                <p className="text-xs font-bold truncate">{playerStats[2].name}</p>
                                                <p className="text-[10px] text-slate-400">{playerStats[2].wins} thắng</p>
                                                <div className="h-10 bg-gradient-to-t from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/10 rounded-t-xl mt-1" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Full rankings list */}
                                    <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/40 rounded-2xl overflow-hidden shadow-lg">
                                        <div className="grid grid-cols-[32px_1fr_44px_44px_44px_36px_48px] gap-1 px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase border-b border-white/30 dark:border-slate-700/50 bg-white/30 dark:bg-slate-700/20">
                                            <span>#</span>
                                            <span>Người chơi</span>
                                            <span className="text-center">Ván</span>
                                            <span className="text-center text-emerald-500">Thắng</span>
                                            <span className="text-center text-red-400">Thua</span>
                                            <span className="text-center text-slate-400">Hòa</span>
                                            <span className="text-center">Tỉ lệ</span>
                                        </div>
                                        {playerStats.map((p, i) => {
                                            const winRate = p.totalGames > 0 ? Math.round((p.wins / p.totalGames) * 100) : 0;
                                            return (
                                                <div key={p.uid} className={clsx("grid grid-cols-[32px_1fr_44px_44px_44px_36px_48px] gap-1 px-3 py-2.5 items-center border-b border-white/20 dark:border-slate-700/30 last:border-0 hover:bg-white/40 dark:hover:bg-slate-700/20 transition-colors",
                                                    i === 0 && "bg-gradient-to-r from-amber-50/60 to-transparent dark:from-amber-900/10")}>
                                                    <span className={clsx("text-sm font-black", i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-400" : "text-slate-300")}>
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0"><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=32`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-500 items-center justify-center text-white font-bold text-[8px]" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold truncate">{p.name}</p>
                                                            {p.streak >= 2 && <p className="text-[9px] text-orange-500 flex items-center gap-0.5"><Flame size={9} /> {p.streak} streak</p>}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-center font-medium">{p.totalGames}</span>
                                                    <span className="text-xs text-center font-bold text-emerald-500">{p.wins}</span>
                                                    <span className="text-xs text-center text-red-400">{p.losses}</span>
                                                    <span className="text-xs text-center text-slate-400">{p.draws || 0}</span>
                                                    <span className={clsx("text-xs text-center font-bold",
                                                        winRate >= 60 ? "text-emerald-500" : winRate >= 40 ? "text-amber-500" : "text-red-400")}>
                                                        {winRate}%
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ==================== HISTORY ==================== */}
                    {tab === 'history' && (
                        <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            {/* Filter */}
                            <div className="flex gap-1.5 mb-4 flex-wrap">
                                {['all', 'tic-tac-toe', 'gomoku', 'werewolf'].map(g => (
                                    <button key={g} onClick={() => setFilterGame(g)}
                                        className={clsx("px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border",
                                            filterGame === g ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-transparent shadow-lg shadow-indigo-300/20" : "backdrop-blur bg-white/50 dark:bg-slate-800/40 border-white/50 dark:border-slate-700/40 text-slate-500 hover:text-indigo-500 hover:bg-white/70")}>
                                        {g === 'all' ? <Gamepad2 size={12} /> : gameIcons[g]} {g === 'all' ? 'Tất cả' : gameNames[g]}
                                    </button>
                                ))}
                            </div>

                            {filteredHistory.length === 0 ? (
                                <div className="text-center py-12">
                                    <History size={48} className="mx-auto mb-3 text-slate-300" />
                                    <p className="text-slate-400">Chưa có lịch sử trận đấu.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredHistory.slice(0, 50).map(game => (
                                        <motion.div key={game.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                            className="backdrop-blur-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/40 rounded-2xl p-3.5 shadow-md hover:shadow-lg transition-all">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={clsx("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0 shadow-md",
                                                    game.gameType === 'tic-tac-toe' ? "from-blue-500 to-cyan-500" : game.gameType === 'gomoku' ? "from-emerald-500 to-teal-500" : "from-violet-500 to-purple-600")}>
                                                    {gameIcons[game.gameType]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold">{gameNames[game.gameType]}</p>
                                                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Clock size={9} /> {formatDate(game.finishedAt)}
                                                        {game.duration ? <span className="text-slate-300">· {formatDuration(game.duration)}</span> : ''}
                                                    </p>
                                                </div>
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500">
                                                    {game.gameType === 'werewolf' && game.nightCount ? `${game.nightCount} đêm` : ''}
                                                    {game.isDraw ? '🤝 Hòa' : ''}
                                                </span>
                                            </div>
                                            {/* Result */}
                                            <p className="text-sm font-bold mb-2">{game.result}</p>
                                            {/* Players */}
                                            <div className="flex flex-wrap gap-1">
                                                {Object.entries(game.players || {}).map(([uid, p]) => (
                                                    <span key={uid} className={clsx("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border",
                                                        p.won ? "bg-emerald-50/70 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-700/30" : "bg-red-50/70 dark:bg-red-900/10 text-red-500 border-red-200/50 dark:border-red-700/30")}>
                                                        <div className="relative w-4 h-4 rounded-full overflow-hidden shrink-0"><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=20`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-500 items-center justify-center text-white font-bold text-[6px]" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                                        {p.name}
                                                        {p.role && <span className="opacity-60">({p.role})</span>}
                                                        {p.won ? ' ✓' : ' ✗'}
                                                    </span>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ==================== STATS CHARTS ==================== */}
                    {tab === 'stats' && (
                        <motion.div key="stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            {history.length === 0 ? (
                                <div className="text-center py-12">
                                    <BarChart3 size={48} className="mx-auto mb-3 text-slate-300" />
                                    <p className="text-slate-400">Chưa có dữ liệu thống kê.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Games Distribution Bar */}
                                    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><BarChart3 size={14} /> Phân bố trò chơi</h3>
                                        {gameTypeStats.total > 0 && (
                                            <div className="space-y-3">
                                                {[
                                                    { type: 'tic-tac-toe', count: gameTypeStats.ttt, color: 'bg-blue-500', label: 'Tic Tac Toe' },
                                                    { type: 'gomoku', count: gameTypeStats.gomoku, color: 'bg-emerald-500', label: 'Cờ Caro' },
                                                    { type: 'werewolf', count: gameTypeStats.werewolf, color: 'bg-violet-500', label: 'Ma Sói' },
                                                ].map(g => (
                                                    <div key={g.type}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs font-medium flex items-center gap-1">{gameIcons[g.type]} {g.label}</span>
                                                            <span className="text-xs text-slate-400">{g.count} ván ({gameTypeStats.total > 0 ? Math.round((g.count / gameTypeStats.total) * 100) : 0}%)</span>
                                                        </div>
                                                        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <motion.div initial={{ width: 0 }} animate={{ width: `${gameTypeStats.total > 0 ? (g.count / gameTypeStats.total) * 100 : 0}%` }}
                                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                                                className={clsx("h-full rounded-full", g.color)} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Win Rate per Player (visual chart) */}
                                    <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/40 rounded-2xl p-4 shadow-lg">
                                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Trophy size={14} /> Tỉ lệ thắng theo người chơi</h3>
                                        <div className="space-y-2.5">
                                            {playerStats.slice(0, 10).map(p => {
                                                const winRate = p.totalGames > 0 ? Math.round((p.wins / p.totalGames) * 100) : 0;
                                                return (
                                                    <div key={p.uid}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs font-medium flex items-center gap-1.5">
                                                                <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0"><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=20`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-500 items-center justify-center text-white font-bold text-[7px]" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                                                {p.name}
                                                            </span>
                                                            <span className={clsx("text-xs font-bold", winRate >= 60 ? "text-emerald-500" : winRate >= 40 ? "text-amber-500" : "text-red-400")}>
                                                                {winRate}% ({p.wins}/{p.totalGames})
                                                            </span>
                                                        </div>
                                                        <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                                            <motion.div initial={{ width: 0 }} animate={{ width: `${winRate}%` }}
                                                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Per-game breakdown for each player */}
                                    <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/40 rounded-2xl p-4 shadow-lg">
                                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Flame size={14} /> Chi tiết theo trò chơi</h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-[10px] text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700">
                                                        <th className="py-2 text-left">Người chơi</th>
                                                        <th className="py-2 text-center">🎯 TTT</th>
                                                        <th className="py-2 text-center">⭕ Caro</th>
                                                        <th className="py-2 text-center">🐺 Ma Sói</th>
                                                        <th className="py-2 text-center">🔥 Streak</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {playerStats.slice(0, 15).map(p => (
                                                        <tr key={p.uid} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                                                            <td className="py-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0"><img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}&size=20`} className="w-full h-full object-cover" alt="" onError={e => { e.currentTarget.style.display='none'; const fb = e.currentTarget.nextElementSibling as HTMLElement; if(fb) fb.style.display='flex'; }} /><div className="av-fb absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-500 items-center justify-center text-white font-bold text-[7px]" style={{display:'none'}}>{(p.name||'?').split(' ').map((w: string)=>w[0]).join('').slice(0,2)}</div></div>
                                                                    <span className="font-medium">{p.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 text-center">
                                                                {p.tttGames > 0 ? <span className="text-emerald-500 font-bold">{p.tttWins}/{p.tttGames}</span> : <span className="text-slate-300">-</span>}
                                                            </td>
                                                            <td className="py-2 text-center">
                                                                {p.gomokuGames > 0 ? <span className="text-emerald-500 font-bold">{p.gomokuWins}/{p.gomokuGames}</span> : <span className="text-slate-300">-</span>}
                                                            </td>
                                                            <td className="py-2 text-center">
                                                                {p.werewolfGames > 0 ? <span className="text-emerald-500 font-bold">{p.werewolfWins}/{p.werewolfGames}</span> : <span className="text-slate-300">-</span>}
                                                            </td>
                                                            <td className="py-2 text-center">
                                                                {p.bestStreak >= 2 ? <span className="text-orange-500 font-bold flex items-center justify-center gap-0.5"><Flame size={10} />{p.bestStreak}</span> : <span className="text-slate-300">-</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Recent activity timeline */}
                                    <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-800/50 border border-white/50 dark:border-slate-700/40 rounded-2xl p-4 shadow-lg">
                                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><History size={14} /> Hoạt động gần đây</h3>
                                        <div className="space-y-2">
                                            {history.slice(0, 5).map(game => (
                                                <div key={game.id} className="flex items-center gap-2 text-xs">
                                                    <div className={clsx("w-6 h-6 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shrink-0 shadow-sm",
                                                        game.gameType === 'tic-tac-toe' ? "from-blue-500 to-cyan-500" : game.gameType === 'gomoku' ? "from-emerald-500 to-teal-500" : "from-violet-500 to-purple-600")}>
                                                        {gameIcons[game.gameType]}
                                                    </div>
                                                    <span className="flex-1 truncate">{game.result}</span>
                                                    <span className="text-slate-400 shrink-0">{formatDate(game.finishedAt)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default GameStats;

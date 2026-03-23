import { ref, push, set, update, onValue, off, remove, get } from 'firebase/database';
import { realtimeDb } from '../lib/firebase';

// --- EMAIL ENCODING for RTDB keys ---
// Firebase RTDB keys cannot contain: . $ # [ ] /
// Email has . and @ which must be encoded
export const encodeEmail = (email: string): string => email.replace(/\./g, ',').replace(/@/g, '_at_');
export const decodeEmail = (key: string): string => key.replace(/,/g, '.').replace(/_at_/g, '@');

// --- TYPES ---
export interface GameRoom {
    id: string;
    gameType: 'tic-tac-toe' | 'gomoku' | 'werewolf';
    hostId: string; // encoded email
    hostName: string;
    players: { [encodedEmail: string]: { name: string; avatar: string; ready: boolean; joinedAt: number } };
    invitedPlayers: string[]; // encoded emails
    status: 'waiting' | 'playing' | 'finished';
    createdAt: number;
    gameState?: any;
    winner?: string;
    currentTurn?: string;
}

export interface TicTacToeState {
    board: (string | null)[];
    playerX: string; // encoded email
    playerO: string;
    isXNext: boolean;
    winner?: string | null;
    isDraw?: boolean;
    scoreX: number;
    scoreO: number;
    scoreDraw: number;
}

export interface GomokuState {
    stones: { [coord: string]: 'X' | 'O' };
    playerX: string;
    playerO: string;
    isXNext: boolean;
    winner?: { player: string; line: string[] } | null;
    moveCount: number;
    lastMove?: string;
    scoreX?: number;
    scoreO?: number;
    scoreDraw?: number;
}

export interface WerewolfChatMessage {
    id: string;
    sender: string; // encoded email
    senderName: string;
    senderAvatar: string;
    text: string;
    timestamp: number;
    channel: 'day' | 'wolf' | 'dead' | 'system'; // chat channels
}

export interface WerewolfState {
    phase: string; // 'waiting' | 'roles-assigned' | 'night-wolf' | 'night-seer' | 'night-guard' | 'night-witch' | 'night-resolve' | 'day-discussion' | 'day-vote' | 'day-defense' | 'day-revote' | 'day-result' | 'gameover'
    night: number;
    originalHostId?: string | null; // who started the game (to restore host at gameover)
    roles: { [encodedEmail: string]: { role: string; icon: string; alive: boolean } };
    previousRoles?: { [encodedEmail: string]: { role: string; icon: string; alive: boolean } } | null;
    // Night actions
    wolfVotes?: { [wolfUid: string]: string }; // wolf uid -> target uid
    wolfTarget?: string | null; // resolved wolf target
    guardTarget?: string | null; // who guard is protecting this night
    guardLastTarget?: string | null; // who guard protected last night (can't repeat)
    witchSaveUsed?: boolean;
    witchKillUsed?: boolean;
    witchSaveThisNight?: boolean; // did witch use save this night
    witchKillTarget?: string | null; // witch poison target this night
    // Seer (Tiên tri)
    seerTarget?: string | null; // who the seer peeked at this night
    seerResult?: 'wolf' | 'village' | null; // result of seer peek
    // Night resolution
    nightKilled?: string | null; // who died this night (after resolving guard/witch)
    nightLog?: string;
    // Day voting
    votes?: { [voter: string]: string }; // voter uid -> target uid
    voteResult?: string | null; // who was voted out
    skipVotes?: string[]; // who voted to skip
    // Defense phase
    defenseTarget?: string | null; // who is defending (most voted)
    defenseVoteCount?: number; // how many votes the defender had
    defenseStartedAt?: number; // timestamp when defense started
    revoteStartedAt?: number; // timestamp when revote started
    preDefenseVotes?: { [voter: string]: string }; // votes snapshot before defense
    preDefenseSkipVotes?: string[]; // skip votes snapshot before defense
    // Game end
    gameResult?: string;
    revealedRoles?: { [encodedEmail: string]: boolean };
    // Night action completion flags
    nightActionsComplete?: {
        wolves?: boolean;
        seer?: boolean;
        guard?: boolean;
        witch?: boolean;
    };
    // Accumulated game event log for end-game summary
    gameLog?: Array<{
        night: number;
        type: 'night' | 'day';
        wolfTarget?: string | null;
        hunterTarget?: string | null;
        guardTarget?: string | null;
        witchSave?: boolean;
        witchKill?: string | null;
        killed?: string[];
        saved?: boolean;
        votes?: { [voter: string]: string };
        voteResult?: string | null;
        skipVotes?: string[];
    }>;
}

// ==================== GAME HISTORY ====================
export interface GameHistory {
    id: string;
    gameType: 'tic-tac-toe' | 'gomoku' | 'werewolf';
    roomId: string;
    result: string; // e.g., '🎉 Phe dân thắng!' or winner name
    winnerTeam?: string; // 'village' | 'wolf' for werewolf
    winner?: string; // uid for tic-tac-toe / gomoku
    winnerName?: string;
    loserName?: string;
    isDraw?: boolean; // for tic-tac-toe draws
    players: { [uid: string]: { name: string; avatar: string; role?: string; alive?: boolean; won: boolean; score?: number } };
    nightCount?: number; // for werewolf
    startedAt: number; // when game started
    finishedAt: number; // when game ended
    duration?: number; // in seconds
}

const ROOMS_PATH = 'minigame_rooms';
const HISTORY_PATH = 'minigame_history';

export const MinigameService = {
    // Create a new game room
    async createRoom(email: string, hostName: string, hostAvatar: string, gameType: GameRoom['gameType'], invitedEmails: string[]): Promise<string> {
        const hostKey = encodeEmail(email);
        const roomRef = push(ref(realtimeDb, ROOMS_PATH));
        const roomId = roomRef.key!;
        const room: Omit<GameRoom, 'id'> = {
            gameType,
            hostId: hostKey,
            hostName,
            players: { [hostKey]: { name: hostName, avatar: hostAvatar, ready: true, joinedAt: Date.now() } },
            invitedPlayers: invitedEmails.map(encodeEmail),
            status: 'waiting',
            createdAt: Date.now(),
        };
        await set(roomRef, room);
        return roomId;
    },

    // Join a room
    async joinRoom(roomId: string, email: string, name: string, avatar: string): Promise<void> {
        const key = encodeEmail(email);
        await update(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/players/${key}`), { name, avatar, ready: true, joinedAt: Date.now() });
    },

    // Leave a room
    async leaveRoom(roomId: string, email: string): Promise<void> {
        const key = encodeEmail(email);
        await remove(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/players/${key}`));
    },

    // Delete a room
    async deleteRoom(roomId: string): Promise<void> {
        await remove(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`));
    },

    // Transfer host to another player
    async transferHost(roomId: string, newHostUid: string): Promise<void> {
        await update(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`), { hostId: newHostUid });
    },

    // Update room status
    async updateRoomStatus(roomId: string, status: GameRoom['status']): Promise<void> {
        await update(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`), { status });
    },

    // Update game state
    async updateGameState(roomId: string, gameState: any): Promise<void> {
        await update(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`), { gameState });
    },

    // Set winner
    async setWinner(roomId: string, winner: string): Promise<void> {
        await update(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`), { winner, status: 'finished' });
    },

    // Update current turn
    async setCurrentTurn(roomId: string, uid: string): Promise<void> {
        await update(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`), { currentTurn: uid });
    },

    // Subscribe to a room
    subscribeToRoom(roomId: string, callback: (room: GameRoom | null) => void): () => void {
        const roomRef = ref(realtimeDb, `${ROOMS_PATH}/${roomId}`);
        const handler = onValue(roomRef, (snap) => {
            if (snap.exists()) {
                callback({ id: roomId, ...snap.val() } as GameRoom);
            } else {
                callback(null);
            }
        });
        return () => off(roomRef, 'value', handler);
    },

    // Subscribe to all rooms for a user (invited or hosting)
    subscribeToMyRooms(email: string, callback: (rooms: GameRoom[]) => void): () => void {
        const myKey = encodeEmail(email);
        const roomsRef = ref(realtimeDb, ROOMS_PATH);
        const handler = onValue(roomsRef, (snap) => {
            const rooms: GameRoom[] = [];
            if (snap.exists()) {
                snap.forEach((child) => {
                    const data = child.val();
                    const room: GameRoom = { id: child.key!, ...data };
                    const isInvited = (data.invitedPlayers || []).includes(myKey);
                    const isPlayer = data.players?.[myKey];
                    const isHost = data.hostId === myKey;
                    if (isHost || isPlayer || isInvited) {
                        rooms.push(room);
                    }
                });
            }
            callback(rooms.sort((a, b) => b.createdAt - a.createdAt));
        });
        return () => off(roomsRef, 'value', handler);
    },

    // Get room once
    async getRoom(roomId: string): Promise<GameRoom | null> {
        const snap = await get(ref(realtimeDb, `${ROOMS_PATH}/${roomId}`));
        if (snap.exists()) return { id: roomId, ...snap.val() };
        return null;
    },

    // Partial update game state (merge)
    async mergeGameState(roomId: string, partial: any): Promise<void> {
        await update(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/gameState`), partial);
    },

    // Send a chat message
    async sendChat(roomId: string, message: Omit<WerewolfChatMessage, 'id'>): Promise<void> {
        const chatRef = push(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/chat`));
        await set(chatRef, { ...message, id: chatRef.key });
    },

    // Subscribe to chat messages
    subscribeToChat(roomId: string, callback: (messages: WerewolfChatMessage[]) => void): () => void {
        const chatRef = ref(realtimeDb, `${ROOMS_PATH}/${roomId}/chat`);
        const handler = onValue(chatRef, (snap) => {
            const msgs: WerewolfChatMessage[] = [];
            if (snap.exists()) {
                snap.forEach((child) => {
                    msgs.push(child.val() as WerewolfChatMessage);
                });
            }
            callback(msgs.sort((a, b) => a.timestamp - b.timestamp));
        });
        return () => off(chatRef, 'value', handler);
    },

    // Clear chat
    async clearChat(roomId: string): Promise<void> {
        await remove(ref(realtimeDb, `${ROOMS_PATH}/${roomId}/chat`));
    },

    // ==================== GAME HISTORY ====================

    // Save a completed game to history
    async saveGameHistory(history: Omit<GameHistory, 'id'>): Promise<string> {
        const histRef = push(ref(realtimeDb, HISTORY_PATH));
        const id = histRef.key!;
        await set(histRef, { ...history, id });
        return id;
    },

    // Subscribe to game history (realtime)
    subscribeToGameHistory(callback: (history: GameHistory[]) => void): () => void {
        const histRef = ref(realtimeDb, HISTORY_PATH);
        const handler = onValue(histRef, (snap) => {
            const items: GameHistory[] = [];
            if (snap.exists()) {
                snap.forEach((child) => {
                    items.push(child.val() as GameHistory);
                });
            }
            callback(items.sort((a, b) => b.finishedAt - a.finishedAt));
        });
        return () => off(histRef, 'value', handler);
    },

    // Get game history once
    async getGameHistory(): Promise<GameHistory[]> {
        const snap = await get(ref(realtimeDb, HISTORY_PATH));
        const items: GameHistory[] = [];
        if (snap.exists()) {
            snap.forEach((child) => {
                items.push(child.val() as GameHistory);
            });
        }
        return items.sort((a, b) => b.finishedAt - a.finishedAt);
    },
};

import {
    ref, push, set, update, onValue, off, query, orderByChild, limitToLast,
    remove, get
} from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { realtimeDb, storage } from '../lib/firebase';

// --- TYPES ---
export interface RTChatRoom {
    id: string;
    participants: { [userId: string]: boolean }; // Use object for efficient querying
    participantsList: string[]; // Array for UI
    type: 'direct' | 'group';
    groupName?: string;
    createdBy?: string;
    createdAt: number;
    updatedAt: number;
    lastMessage?: {
        text: string;
        senderId: string;
        timestamp: number;
        type: 'text' | 'image' | 'file';
    };
    typingUsers?: { [userId: string]: boolean };
}

export interface RTChatMessage {
    id: string;
    senderId: string;
    text: string;
    type: 'text' | 'image' | 'file';
    fileUrl?: string;
    fileName?: string;
    timestamp: number;
    reactions?: { [userId: string]: string };
    readBy?: { [userId: string]: boolean };
    replyTo?: {
        id: string;
        text: string;
        senderId: string;
    };
}

// --- HELPER: Generate Chat Room ID for Direct Chats ---
const getDirectChatId = (userId1: string, userId2: string): string => {
    return [userId1, userId2].sort().join('_');
};

// --- SERVICE ---
export const RealtimeChatService = {

    // ==================== ROOMS ====================

    /**
     * Subscribe to all chat rooms for a user
     */
    subscribeToUserRooms: (userId: string, callback: (rooms: RTChatRoom[]) => void) => {
        const userChatsRef = ref(realtimeDb, `userChats/${userId}`);

        onValue(userChatsRef, async (snapshot) => {
            if (!snapshot.exists()) {
                callback([]);
                return;
            }

            const chatIds = Object.keys(snapshot.val());
            const rooms: RTChatRoom[] = [];

            // Fetch each room's details
            for (const chatId of chatIds) {
                const roomRef = ref(realtimeDb, `chatRooms/${chatId}`);
                const roomSnap = await get(roomRef);
                if (roomSnap.exists()) {
                    const roomData = roomSnap.val();
                    rooms.push({
                        id: chatId,
                        ...roomData,
                        participantsList: Object.keys(roomData.participants || {})
                    });
                }
            }

            // Sort by updatedAt descending
            rooms.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            callback(rooms);
        });

        return () => off(userChatsRef);
    },

    /**
     * Subscribe to a single room's metadata (for typing indicators, etc.)
     */
    subscribeToRoom: (roomId: string, callback: (room: RTChatRoom | null) => void) => {
        const roomRef = ref(realtimeDb, `chatRooms/${roomId}`);

        onValue(roomRef, (snapshot) => {
            if (!snapshot.exists()) {
                callback(null);
                return;
            }
            const data = snapshot.val();
            callback({
                id: roomId,
                ...data,
                participantsList: Object.keys(data.participants || {})
            });
        });

        return () => off(roomRef);
    },

    /**
     * Create or get existing direct chat
     */
    createOrGetDirectChat: async (currentUserId: string, targetUserId: string): Promise<RTChatRoom> => {
        const chatId = getDirectChatId(currentUserId, targetUserId);
        const roomRef = ref(realtimeDb, `chatRooms/${chatId}`);

        try {
            const existing = await get(roomRef);
            if (existing.exists()) {
                const data = existing.val();
                return {
                    id: chatId,
                    ...data,
                    participantsList: Object.keys(data.participants || {})
                };
            }
        } catch (error) {
            // Permission denied usually means room doesn't exist (due to security rules preventing read of non-existent/non-participant rooms)
            // We proceed to create it.
            console.log("Room lookup failed (likely new room), creating...", error);
        }

        // Create new
        const now = Date.now();
        const newRoom: Omit<RTChatRoom, 'id'> = {
            participants: { [currentUserId]: true, [targetUserId]: true },
            participantsList: [currentUserId, targetUserId],
            type: 'direct',
            createdAt: now,
            updatedAt: now
        };

        // Use update to avoid overwriting if it exists and we just couldn't read (though unlikely given rules)
        // But 'set' is safer for initial creation structure. 
        // With our rules, we can only write if !data.exists || we are participant.
        // If it strictly doesn't exist, 'set' work.
        await set(roomRef, newRoom);

        // Add to user's chat list with timestamp for sorting/updates
        await update(ref(realtimeDb, `userChats/${currentUserId}`), { [chatId]: now });
        await update(ref(realtimeDb, `userChats/${targetUserId}`), { [chatId]: now });

        return { id: chatId, ...newRoom };
    },

    /**
     * Create a group chat
     */
    createGroupChat: async (creatorId: string, groupName: string, memberIds: string[]): Promise<RTChatRoom> => {
        const chatRoomsRef = ref(realtimeDb, 'chatRooms');
        const newRoomRef = push(chatRoomsRef);
        const chatId = newRoomRef.key!;

        const allParticipants = [creatorId, ...memberIds];
        const participantsObj: { [key: string]: boolean } = {};
        allParticipants.forEach(id => participantsObj[id] = true);

        const now = Date.now();
        const newRoom: Omit<RTChatRoom, 'id'> = {
            participants: participantsObj,
            participantsList: allParticipants,
            type: 'group',
            groupName,
            createdBy: creatorId,
            createdAt: now,
            updatedAt: now,
            lastMessage: {
                text: 'Nhóm được tạo',
                senderId: 'system',
                timestamp: now,
                type: 'text'
            }
        };

        await set(newRoomRef, newRoom);

        // Add to each user's chat list with timestamp
        for (const uid of allParticipants) {
            await update(ref(realtimeDb, `userChats/${uid}`), { [chatId]: now });
        }

        return { id: chatId, ...newRoom };
    },

    /**
     * Delete a chat room
     */
    deleteChat: async (roomId: string, participantIds: string[]) => {
        // Remove from each user's list
        for (const uid of participantIds) {
            await update(ref(realtimeDb, `userChats/${uid}`), { [roomId]: null });
        }
        // Remove room and messages
        await remove(ref(realtimeDb, `chatRooms/${roomId}`));
        await remove(ref(realtimeDb, `chatMessages/${roomId}`));
    },

    // ==================== MESSAGES ====================

    /**
     * Subscribe to messages in a room
     */
    subscribeToMessages: (roomId: string, limitCount: number = 100, callback: (msgs: RTChatMessage[]) => void) => {
        const msgsRef = query(
            ref(realtimeDb, `chatMessages/${roomId}`),
            orderByChild('timestamp'),
            limitToLast(limitCount)
        );

        onValue(msgsRef, (snapshot) => {
            const msgs: RTChatMessage[] = [];
            snapshot.forEach((child) => {
                msgs.push({ id: child.key!, ...child.val() });
            });
            callback(msgs);
        }, (error) => {
            console.error("Error subscribing to messages:", error);
        });

        return () => off(msgsRef);
    },

    /**
     * Send a message
     */
    sendMessage: async (
        roomId: string,
        senderId: string,
        text: string,
        file?: File,
        replyTo?: { id: string; text: string; senderId: string }
    ) => {
        let fileUrl = '';
        let fileName = '';
        let msgType: 'text' | 'image' | 'file' = 'text';

        if (file) {
            const fileRef = storageRef(storage, `internal_chat/${roomId}/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            fileUrl = await getDownloadURL(fileRef);
            fileName = file.name;
            msgType = file.type.startsWith('image/') ? 'image' : 'file';
        }

        const now = Date.now();

        // Remove undefined fields
        const newMessage: any = {
            senderId,
            text,
            type: msgType,
            fileUrl,
            fileName,
            timestamp: now,
            readBy: { [senderId]: true },
            reactions: {}
        };

        if (replyTo) {
            newMessage.replyTo = replyTo;
        }

        // Push message
        const msgsRef = ref(realtimeDb, `chatMessages/${roomId}`);
        await push(msgsRef, newMessage);

        // Update room's lastMessage and updatedAt
        await update(ref(realtimeDb, `chatRooms/${roomId}`), {
            lastMessage: {
                text: msgType === 'text' ? text : (msgType === 'image' ? '[Hình ảnh]' : '[Tập tin]'),
                senderId,
                timestamp: now,
                type: msgType
            },
            updatedAt: now
        });

        // Notify all participants by updating their userChats timestamp
        // We need to fetch participants first
        const pSnap = await get(ref(realtimeDb, `chatRooms/${roomId}/participants`));
        if (pSnap.exists()) {
            const participants = Object.keys(pSnap.val());
            for (const uid of participants) {
                await update(ref(realtimeDb, `userChats/${uid}`), { [roomId]: now });
            }
        }
    },

    /**
     * Mark message as read
     */
    markMessageRead: async (roomId: string, messageId: string, userId: string) => {
        await update(ref(realtimeDb, `chatMessages/${roomId}/${messageId}/readBy`), {
            [userId]: true
        });
    },

    /**
     * Set typing status
     */
    setTyping: async (roomId: string, userId: string, isTyping: boolean) => {
        await update(ref(realtimeDb, `chatRooms/${roomId}/typingUsers`), {
            [userId]: isTyping
        });
    },

    /**
     * Toggle reaction on a message
     */
    toggleReaction: async (roomId: string, messageId: string, userId: string, emoji: string, currentReactions?: { [key: string]: string }) => {
        const reactions = { ...(currentReactions || {}) };
        if (reactions[userId] === emoji) {
            delete reactions[userId];
        } else {
            reactions[userId] = emoji;
        }
        await update(ref(realtimeDb, `chatMessages/${roomId}/${messageId}`), { reactions });
    },

    /**
     * Clear typing status when user leaves
     */
    clearTyping: async (roomId: string, userId: string) => {
        await update(ref(realtimeDb, `chatRooms/${roomId}/typingUsers`), {
            [userId]: null
        });
    }
};

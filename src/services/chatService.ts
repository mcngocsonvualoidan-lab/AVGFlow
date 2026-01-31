import {
    collection, query, where, orderBy, onSnapshot,
    addDoc, doc, updateDoc, serverTimestamp,
    limit, deleteDoc, arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

// Database Collections
const CHATS_COLLECTION = 'chats';
const MSGS_SUBCOLLECTION = 'messages';

export interface ChatRoom {
    id: string;
    participants: string[];
    type: 'direct' | 'group';
    groupName?: string;
    lastMessage?: {
        text: string;
        senderId: string;
        timestamp: any;
        readBy?: string[];
        type?: 'text' | 'image' | 'file';
    };
    updatedAt: any;
    createdBy?: string;
    typingUsers?: { [userId: string]: boolean };
}

export interface ChatMessage {
    id: string;
    senderId: string;
    text: string;
    type: 'text' | 'image' | 'file';
    fileUrl?: string;
    fileName?: string;
    timestamp: any;
    reactions?: { [userId: string]: string };
    readBy?: string[];
    replyTo?: {
        id: string;
        text: string;
        senderId: string;
    };
    status?: 'sending' | 'sent' | 'error';
}

export const ChatService = {
    // --- QUERY ---

    // Subscribe to User's Chat Rooms
    subscribeToRooms: (userId: string, callback: (rooms: ChatRoom[]) => void) => {
        if (!userId) return () => { };

        const q = query(
            collection(db, CHATS_COLLECTION),
            where('participants', 'array-contains', userId),
            orderBy('updatedAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const rooms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatRoom));
            callback(rooms);
        }, (error) => {
            console.error("Error subscribing to chat rooms:", error);
        });
    },

    // Subscribe to Messages in a Room
    subscribeToMessages: (roomId: string, limitCount: number = 500, callback: (msgs: ChatMessage[]) => void) => {
        if (!roomId) return () => { };

        const q = query(
            collection(db, CHATS_COLLECTION, roomId, MSGS_SUBCOLLECTION),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        return onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data(), status: 'sent' } as ChatMessage)).reverse();
            callback(msgs);
        }, (error) => {
            console.error("Error subscribing to messages:", error);
        });
    },

    // --- ACTIONS ---

    // Create Direct Chat
    createDirectChat: async (currentUserId: string, targetUserId: string) => {
        // UI should check for existing chat before calling this to avoid duplicates
        const newChatData = {
            participants: [currentUserId, targetUserId],
            type: 'direct',
            updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, CHATS_COLLECTION), newChatData);
        return { id: docRef.id, ...newChatData };
    },

    // Create Group Chat
    createGroupChat: async (creatorId: string, name: string, participantIds: string[]) => {
        const newGroupData = {
            participants: [creatorId, ...participantIds],
            type: 'group',
            groupName: name,
            updatedAt: serverTimestamp(),
            createdBy: creatorId,
            lastMessage: {
                text: 'Nhóm được tạo',
                senderId: 'system',
                timestamp: serverTimestamp(),
                readBy: [creatorId, ...participantIds]
            }
        };
        const docRef = await addDoc(collection(db, CHATS_COLLECTION), newGroupData);
        return { id: docRef.id, ...newGroupData };
    },

    // Send Message
    sendMessage: async (roomId: string, senderId: string, text: string, file?: File, replyToObj?: any) => {
        let fileUrl = '';
        let fileName = '';
        let msgType: 'text' | 'image' | 'file' = 'text';

        if (file) {
            const storageRef = ref(storage, `internal_chat/${roomId}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            fileUrl = await getDownloadURL(storageRef);
            fileName = file.name;
            msgType = file.type.startsWith('image/') ? 'image' : 'file';
        }

        const newMessage = {
            senderId,
            text,
            type: msgType,
            fileUrl,
            fileName,
            timestamp: serverTimestamp(),
            readBy: [senderId],
            reactions: {},
            replyTo: replyToObj || null
        };

        await addDoc(collection(db, CHATS_COLLECTION, roomId, MSGS_SUBCOLLECTION), newMessage);

        // Update Room Last Message
        await updateDoc(doc(db, CHATS_COLLECTION, roomId), {
            lastMessage: {
                text: msgType === 'text' ? text : (msgType === 'image' ? '[Hình ảnh]' : '[Tập tin]'),
                senderId,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                type: msgType
            },
            updatedAt: serverTimestamp()
        });
    },

    // Mark Read
    markMessageRead: async (roomId: string, messageId: string, userId: string) => {
        await updateDoc(doc(db, CHATS_COLLECTION, roomId, MSGS_SUBCOLLECTION, messageId), {
            readBy: arrayUnion(userId)
        });
    },

    // Mark Room Read (Last Msg)
    markRoomRead: async (roomId: string, userId: string) => {
        await updateDoc(doc(db, CHATS_COLLECTION, roomId), {
            'lastMessage.readBy': arrayUnion(userId)
        });
    },

    // Set Typing Status
    setTyping: async (roomId: string, userId: string, isTyping: boolean) => {
        // We use a map: typingUsers.userId = true/false
        await updateDoc(doc(db, CHATS_COLLECTION, roomId), {
            [`typingUsers.${userId}`]: isTyping
        });
    },

    // React
    toggleReaction: async (roomId: string, messageId: string, userId: string, emoji: string, currentReactions: any) => {
        const newReactions = { ...currentReactions };
        if (newReactions[userId] === emoji) {
            delete newReactions[userId];
        } else {
            newReactions[userId] = emoji;
        }
        await updateDoc(doc(db, CHATS_COLLECTION, roomId, MSGS_SUBCOLLECTION, messageId), {
            reactions: newReactions
        });
    },

    // Delete Chat
    deleteChat: async (roomId: string) => {
        await deleteDoc(doc(db, CHATS_COLLECTION, roomId));
    }
};

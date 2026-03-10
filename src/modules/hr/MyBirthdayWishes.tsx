import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useData, ConfessionMessage } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Heart, MessageCircle, Sparkles, Users, Send, ThumbsUp, Clock, Gift, Trash2, MessageSquareHeart, Smile, CornerUpLeft, X, Search, ImagePlus, Loader2, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import HeroBanner from '../../components/HeroBanner';
import { storage } from '../../lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

// 🎨 Emoji categories for the picker
const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
    {
        label: 'Mặt cười',
        icon: '😊',
        emojis: ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '🤗', '🤩', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤔', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '🤪', '😝', '🤑', '😲', '🙃', '😇', '🤭', '🤫', '🤥', '😬', '😈', '👿', '🤡', '💩', '👻', '💀', '☠️', '👽', '🤖']
    },
    {
        label: 'Trái tim',
        icon: '❤️',
        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💋', '💌', '💐', '🌹', '🥀', '🌺', '🌸', '🌷', '🌻', '🏵️']
    },
    {
        label: 'Bàn tay',
        icon: '👋',
        emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🦾']
    },
    {
        label: 'Động vật',
        icon: '🐱',
        emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🪱', '🐙', '🐬', '🐳', '🦈', '🐊', '🦕', '🦖']
    },
    {
        label: 'Đồ ăn',
        icon: '🍕',
        emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🍖', '🍗', '🥩', '🍞', '🥐', '🥯', '🧁', '🎂', '🍰', '🍩', '🍪', '🍫', '🍬', '🍭', '☕', '🍵', '🧃', '🥤', '🧋', '🍺', '🍷', '🥂', '🍾']
    },
    {
        label: 'Thiên nhiên',
        icon: '🌈',
        emojis: ['🌍', '🌎', '🌏', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '⭐', '🌟', '✨', '💫', '☀️', '🌤️', '⛅', '🌥️', '🌦️', '🌧️', '⛈️', '🌩️', '🌈', '☁️', '🌪️', '🌫️', '🌊', '💧', '💦', '🔥', '🌸', '🌺', '🌻', '🌷', '🌹', '🪻', '🌿', '🍀', '🍃', '🍂', '🍁', '🌲', '🌳', '🪴']
    },
    {
        label: 'Vật thể',
        icon: '🎁',
        emojis: ['🎁', '🎈', '🎉', '🎊', '🎀', '🎗️', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '⚽', '🏀', '🎾', '🎮', '🎯', '🎲', '🎧', '🎤', '🎵', '🎶', '🎸', '🎹', '🥁', '🎺', '🎻', '📱', '💻', '⌨️', '📷', '📸', '📹', '💡', '🔦', '🕯️', '📚', '📖', '✏️', '🖊️', '💰', '💎', '🔑', '🗝️', '💊', '🧲']
    },
    {
        label: 'Biểu tượng',
        icon: '⚡',
        emojis: ['💯', '✅', '❌', '⭕', '❗', '❓', '‼️', '⁉️', '💢', '💥', '💦', '💨', '🕊️', '🦴', '🔔', '🔕', '🎵', '🎶', '💤', '💭', '💬', '👁️‍🗨️', '🗨️', '🗯️', '♠️', '♣️', '♥️', '♦️', '🔮', '🧿', '🪬', '🎴', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔺', '🔻', '⚡', '🌀', '♾️', '🆗', '🆕', '🆙']
    },
];

// 🎭 Character Categories - organized by theme
const CHARACTER_CATEGORIES: { label: string; icon: string; characters: { name: string; emoji: string }[] }[] = [
    {
        label: '🐾 Động vật',
        icon: '🐾',
        characters: [
            { name: 'Mèo Con', emoji: '🐱' }, { name: 'Cáo Nhỏ', emoji: '🦊' }, { name: 'Gấu Trúc', emoji: '🐼' },
            { name: 'Thỏ Trắng', emoji: '🐰' }, { name: 'Sóc Nâu', emoji: '🐿️' }, { name: 'Cú Mèo', emoji: '🦉' },
            { name: 'Hươu Sao', emoji: '🦌' }, { name: 'Chim Sẻ', emoji: '🐦' }, { name: 'Bướm Vàng', emoji: '🦋' },
            { name: 'Cá Heo', emoji: '🐬' }, { name: 'Voi Con', emoji: '🐘' }, { name: 'Sư Tử', emoji: '🦁' },
            { name: 'Đại Bàng', emoji: '🦅' }, { name: 'Chim Cánh Cụt', emoji: '🐧' }, { name: 'Gấu Bông', emoji: '🧸' },
            { name: 'Rái Cá', emoji: '🦦' }, { name: 'Lạc Đà', emoji: '🐫' }, { name: 'Flamingo', emoji: '🦩' },
            { name: 'Kỳ Lân', emoji: '🦄' }, { name: 'Phượng Hoàng', emoji: '🔥' }, { name: 'Tuần Lộc', emoji: '🦌' },
            { name: 'Báo Đốm', emoji: '🐆' }, { name: 'Cá Voi', emoji: '🐳' }, { name: 'Ốc Sên', emoji: '🐌' },
            { name: 'Ong Vàng', emoji: '🐝' }, { name: 'Bọ Rùa', emoji: '🐞' }, { name: 'Ngựa Hoang', emoji: '🐎' },
            { name: 'Thiên Nga', emoji: '🦢' }, { name: 'Vẹt Xanh', emoji: '🦜' }, { name: 'Sói Bạc', emoji: '🐺' },
        ]
    },
    {
        label: '🐱 Doraemon & Friends',
        icon: '🐱',
        characters: [
            { name: 'Doraemon', emoji: '🐱' }, { name: 'Nobita', emoji: '👦' }, { name: 'Shizuka', emoji: '👧' },
            { name: 'Chaien', emoji: '🎤' }, { name: 'Xêkô', emoji: '🦊' },
        ]
    },
    {
        label: '🏰 Disney',
        icon: '🏰',
        characters: [
            { name: 'Mickey', emoji: '🖱️' }, { name: 'Minnie', emoji: '🎀' }, { name: 'Donald', emoji: '🦆' },
            { name: 'Daisy', emoji: '🌼' }, { name: 'Goofy', emoji: '🐕' }, { name: 'Elsa', emoji: '❄️' },
            { name: 'Anna', emoji: '🌻' }, { name: 'Olaf', emoji: '☃️' }, { name: 'Cinderella', emoji: '👠' },
            { name: 'Belle', emoji: '🌹' }, { name: 'Simba', emoji: '🦁' }, { name: 'Timon', emoji: '🦦' },
            { name: 'Pumbaa', emoji: '🐗' }, { name: 'Stitch', emoji: '👽' },
        ]
    },
    {
        label: '📺 Phim hoạt hình',
        icon: '📺',
        characters: [
            { name: 'Tom', emoji: '🐱' }, { name: 'Jerry', emoji: '🐭' }, { name: 'Scooby-Doo', emoji: '🐕' },
            { name: 'Bugs Bunny', emoji: '🐰' }, { name: 'Tweety', emoji: '🐤' }, { name: 'Pikachu', emoji: '⚡' },
            { name: 'Doremi', emoji: '🎵' }, { name: 'Hello Kitty', emoji: '🐱' }, { name: 'Totoro', emoji: '🐨' },
            { name: 'SpongeBob', emoji: '🧽' }, { name: 'Patrick', emoji: '⭐' }, { name: 'Garfield', emoji: '😼' },
            { name: 'Odie', emoji: '🐕' }, { name: 'Snoopy', emoji: '🏠' }, { name: 'Charlie Brown', emoji: '🪁' },
            { name: 'Shin-chan', emoji: '🍑' }, { name: 'Himawari', emoji: '🌻' }, { name: 'Shiro', emoji: '🐕' },
            { name: 'Dexter', emoji: '🧪' }, { name: 'Dee Dee', emoji: '🎀' },
        ]
    },
    {
        label: '🦸 Siêu anh hùng',
        icon: '🦸',
        characters: [
            { name: 'Spider-Man', emoji: '🕷️' }, { name: 'Iron Man', emoji: '🦾' }, { name: 'Batman', emoji: '🦇' },
            { name: 'Superman', emoji: '🦸' }, { name: 'Wonder Woman', emoji: '👸' }, { name: 'Groot', emoji: '🌳' },
            { name: 'Minion', emoji: '🍌' }, { name: 'Shrek', emoji: '👹' },
        ]
    },
    {
        label: '🎬 Pixar & DreamWorks',
        icon: '🎬',
        characters: [
            { name: 'Woody', emoji: '🤠' }, { name: 'Buzz Lightyear', emoji: '🚀' }, { name: 'Nemo', emoji: '🐠' },
            { name: 'Dory', emoji: '🐟' }, { name: 'Wall-E', emoji: '🤖' }, { name: 'Po (Kung Fu Panda)', emoji: '🐼' },
        ]
    },
    {
        label: '🏴‍☠️ One Piece',
        icon: '🏴‍☠️',
        characters: [
            { name: 'Luffy', emoji: '👒' }, { name: 'Zoro', emoji: '⚔️' }, { name: 'Nami', emoji: '🍊' },
            { name: 'Sanji', emoji: '🚬' }, { name: 'Chopper', emoji: '🦌' },
        ]
    },
    {
        label: '🐉 Dragon Ball & Naruto',
        icon: '🐉',
        characters: [
            { name: 'Son Goku', emoji: '🐉' }, { name: 'Vegeta', emoji: '⚡' }, { name: 'Naruto', emoji: '🍥' },
            { name: 'Sasuke', emoji: '👁️' }, { name: 'Sakura', emoji: '🌸' }, { name: 'Kakashi', emoji: '📖' },
        ]
    },
    {
        label: '⚔️ Anime',
        icon: '⚔️',
        characters: [
            { name: 'Ichigo', emoji: '⚔️' }, { name: 'Rukia', emoji: '❄️' }, { name: 'Tanjiro', emoji: '🌊' },
            { name: 'Nezuko', emoji: '🎋' }, { name: 'Zenitsu', emoji: '⚡' }, { name: 'Inosuke', emoji: '🐗' },
            { name: 'Deku', emoji: '🥦' }, { name: 'Bakugo', emoji: '💣' }, { name: 'Todoroki', emoji: '🔥' },
            { name: 'All Might', emoji: '💪' }, { name: 'Saitama', emoji: '👊' }, { name: 'Genos', emoji: '🤖' },
            { name: 'Gon', emoji: '🎣' }, { name: 'Killua', emoji: '⚡' }, { name: 'Kurapika', emoji: '⛓️' },
            { name: 'Hisoka', emoji: '🃏' }, { name: 'Gintoki', emoji: '🍓' }, { name: 'Kagura', emoji: '🌂' },
        ]
    },
    {
        label: '🔍 Thám tử & Hài',
        icon: '🔍',
        characters: [
            { name: 'Conan', emoji: '👓' }, { name: 'Ran Mouri', emoji: '🥋' }, { name: 'Kogoro', emoji: '🍻' },
            { name: 'Kaitou Kid', emoji: '🎩' }, { name: 'Lupin III', emoji: '🔫' }, { name: 'Jigen', emoji: '🥃' },
            { name: 'Goemon', emoji: '🔪' }, { name: 'Fujiko', emoji: '💋' },
        ]
    },
    {
        label: '🧢 Hoạt hình kinh điển',
        icon: '🧢',
        characters: [
            { name: 'Ash Ketchum', emoji: '🧢' }, { name: 'Misty', emoji: '💧' }, { name: 'Brock', emoji: '⛰️' },
            { name: 'Team Rocket', emoji: '🚀' }, { name: 'Meowth', emoji: '😼' }, { name: 'Popeye', emoji: '⚓' },
            { name: 'Olive Oyl', emoji: '💃' }, { name: 'Bluto', emoji: '💪' }, { name: 'Woodstock', emoji: '🐣' },
        ]
    },
    {
        label: '⚔️ Liên Quân Mobile',
        icon: '🎮',
        characters: [
            { name: 'Yorn', emoji: '☀️' }, { name: 'Valhein', emoji: '⚡' }, { name: 'Violet', emoji: '🔫' },
            { name: 'Butterfly', emoji: '🦋' }, { name: 'Murad', emoji: '⏳' }, { name: 'Nakroth', emoji: '👊' },
            { name: 'Zephys', emoji: '😈' }, { name: 'Lauriel', emoji: '👼' }, { name: 'Tulen', emoji: '🌩️' },
            { name: 'Liliana', emoji: '🦊' }, { name: 'Krixi', emoji: '🧚' }, { name: 'Diaochan', emoji: '❄️' },
            { name: 'Kahlii', emoji: '👻' }, { name: 'Natalya', emoji: '🔮' }, { name: 'Ignis', emoji: '🔥' },
            { name: 'Zata', emoji: '🌀' }, { name: 'Raz', emoji: '🥊' }, { name: 'Arum', emoji: '🐅' },
            { name: 'Grakk', emoji: '🪝' }, { name: 'Thane', emoji: '🛡️' }, { name: 'Arthur', emoji: '⚔️' },
            { name: 'Maloch', emoji: '😈' }, { name: 'Ryoma', emoji: '🗡️' }, { name: 'Florentino', emoji: '🌹' },
            { name: 'Allain', emoji: '🔱' }, { name: 'Qi', emoji: '💨' }, { name: 'Amily', emoji: '🎯' },
            { name: 'Airi', emoji: '🌸' }, { name: 'Wukong', emoji: '🐵' }, { name: 'Zuka', emoji: '🐼' },
            { name: 'Ata', emoji: '🦂' }, { name: 'Hayate', emoji: '🌪️' }, { name: 'Elsu', emoji: '🏹' },
            { name: 'Laville', emoji: '💎' }, { name: 'Capheny', emoji: '🤖' }, { name: 'Tel\'Annas', emoji: '🏹' },
            { name: 'Brunhilda', emoji: '🐉' }, { name: 'Ishar', emoji: '🧸' }, { name: 'Keera', emoji: '🦇' },
            { name: 'Paine', emoji: '⚡' }, { name: 'Enzo', emoji: '⛓️' }, { name: 'Volkath', emoji: '💀' },
            { name: 'Mina', emoji: '🖤' }, { name: 'Zip', emoji: '🟢' }, { name: 'Teemee', emoji: '💰' },
            { name: 'Alice', emoji: '🏥' }, { name: 'Annette', emoji: '🌬️' }, { name: 'Lumburr', emoji: '🪨' },
            { name: 'Toro', emoji: '🐂' }, { name: 'Chaugnar', emoji: '🐘' }, { name: 'Y\'bneth', emoji: '🌲' },
        ]
    },
];

// Derived flat arrays for backward compatibility
const ANIMAL_NAMES = CHARACTER_CATEGORIES.flatMap(cat => cat.characters.map(c => c.name));
const ANIMAL_EMOJIS = CHARACTER_CATEGORIES.flatMap(cat => cat.characters.map(c => c.emoji));

export const getAnonymousIdentity = (email: string): { name: string; emoji: string } => {
    // Create a simple hash from email
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        const char = email.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Use date to rotate daily so names change each day for fun
    const dayHash = new Date().toISOString().slice(0, 10).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const index = Math.abs(hash + dayHash) % ANIMAL_NAMES.length;
    return { name: ANIMAL_NAMES[index], emoji: ANIMAL_EMOJIS[index] };
}

/**
 * Create a hashed user ID for anonymous likes (not reversible to email)
 */
export const hashUserId = (email: string): string => {
    let hash = 5381;
    for (let i = 0; i < email.length; i++) {
        hash = ((hash << 5) + hash) + email.charCodeAt(i);
        hash = hash & hash;
    }
    return `anon_${Math.abs(hash).toString(36)}`;
}

interface MyBirthdayWishesProps {
    asWidget?: boolean;
}

const MyBirthdayWishes: React.FC<MyBirthdayWishesProps> = ({ asWidget }) => {
    const { currentUser } = useAuth();
    const { users, birthdayWishes, markWishAsRead, confessionMessages, addConfession, deleteConfession, likeConfession, reactToConfession } = useData();
    const [activeTab, setActiveTab] = useState<'confessions' | 'wishes'>('confessions');
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showIdentityPicker, setShowIdentityPicker] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ConfessionMessage | null>(null);
    const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeEmojiCategory, setActiveEmojiCategory] = useState(0);
    const [activeCharCategory, setActiveCharCategory] = useState(-1); // -1 = all
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [showScrollDown, setShowScrollDown] = useState(false);

    // Detect scroll position to show/hide scroll-to-bottom button
    const handleChatScroll = useCallback(() => {
        const container = chatScrollContainerRef.current;
        if (!container) return;
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        setShowScrollDown(distFromBottom > 150);
    }, []);

    const scrollToBottom = useCallback(() => {
        chatScrollContainerRef.current?.scrollTo({ top: chatScrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, []);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const inputRefDesktop = useRef<HTMLTextAreaElement>(null);
    const focusInput = useCallback(() => {
        // Focus whichever textarea is currently visible
        if (window.innerWidth < 768) inputRef.current?.focus();
        else inputRefDesktop.current?.focus();
    }, []);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const identityPickerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    const appUser = users.find(u => u.email === currentUser?.email);
    const myWishes = birthdayWishes.filter(w => w.toUserId === appUser?.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const myIdentity = useMemo(() => {
        if (!currentUser?.email) return { name: 'Ẩn danh', emoji: '🎭' };
        return getAnonymousIdentity(currentUser.email);
    }, [currentUser?.email]);

    const [customIdentity, setCustomIdentity] = useState<{ name: string, emoji: string } | null>(() => {
        try {
            const saved = localStorage.getItem(`confession_identity_${currentUser?.email}`);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
    const activeIdentity = customIdentity || myIdentity;

    // Persist custom identity to localStorage whenever it changes
    useEffect(() => {
        if (!currentUser?.email) return;
        const key = `confession_identity_${currentUser.email}`;
        if (customIdentity) {
            localStorage.setItem(key, JSON.stringify(customIdentity));
        } else {
            localStorage.removeItem(key);
        }
    }, [customIdentity, currentUser?.email]);

    // Build dynamic staff category from users list + extra names
    const staffCategory = useMemo(() => {
        const nameEmojis = ['👤', '🙋', '🧑‍💼', '👨‍💻', '👩‍💻', '🧑‍🏭', '👷', '👨‍🚀', '👩‍🎨', '🧑‍🔬'];
        const extraNames = ['Nguyễn Công Thoại', 'Lê Trần Thiện Tâm', 'Đinh Hoàng Ngọc Hân'];
        const userNames = users.filter(u => u.name && u.name.trim()).map(u => u.name);
        const allNames = [...new Set([...userNames, ...extraNames])].sort((a, b) => a.localeCompare(b, 'vi'));
        const staffChars = allNames.map((name, i) => ({ name, emoji: nameEmojis[i % nameEmojis.length] }));
        return {
            label: '💼 Nhân sự AVG',
            icon: '💼',
            characters: staffChars
        };
    }, [users]);

    const allCategories = useMemo(() => [staffCategory, ...CHARACTER_CATEGORIES], [staffCategory]);

    const myHashedId = useMemo(() => {
        if (!currentUser?.email) return '';
        return hashUserId(currentUser.email);
    }, [currentUser?.email]);

    // Mark wishes as read
    useEffect(() => {
        if (myWishes.length > 0) {
            myWishes.forEach(w => {
                if (!w.isRead) markWishAsRead(w.id);
            });
        }
    }, [myWishes.length, markWishAsRead]);

    // Ref for the scrollable chat container
    const chatScrollContainerRef = useRef<HTMLDivElement>(null);
    const hasInitialScrolled = useRef(false);

    // Scroll to bottom: instant on first open, smooth on new messages
    useEffect(() => {
        if (activeTab !== 'confessions' || confessionMessages.length === 0) {
            hasInitialScrolled.current = false;
            return;
        }

        const doScroll = () => {
            const container = chatScrollContainerRef.current;
            if (container) {
                // First open: instant scroll (no animation delay)
                if (!hasInitialScrolled.current) {
                    container.scrollTop = container.scrollHeight;
                    hasInitialScrolled.current = true;
                } else {
                    // New message: smooth scroll
                    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                }
            }
        };

        // Small delay to ensure DOM has rendered
        const timer = setTimeout(doScroll, 150);
        return () => clearTimeout(timer);
    }, [confessionMessages.length, activeTab]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Vui lòng chọn file hình ảnh!'); return; }
        if (file.size > 5 * 1024 * 1024) { alert('Hình ảnh không được vượt quá 5MB!'); return; }
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target?.result as string);
        reader.readAsDataURL(file);
        e.target.value = ''; // reset input
    };

    const clearImage = () => { setImageFile(null); setImagePreview(null); };

    const handleSend = async () => {
        const text = newMessage.trim();
        if (!text && !imageFile) return;
        if (isSending) return;

        setIsSending(true);
        try {
            const confessionId = `conf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            // Upload image if attached
            let imageUrl: string | undefined;
            if (imageFile) {
                const imgRef = storageRef(storage, `confessions/${confessionId}_${imageFile.name}`);
                await uploadBytes(imgRef, imageFile);
                imageUrl = await getDownloadURL(imgRef);
            }

            // Build message object conditionally to avoid undefined keys
            const msg: ConfessionMessage = {
                id: confessionId,
                anonymousName: activeIdentity.name || 'Ẩn danh',
                anonymousEmoji: activeIdentity.emoji || '🎭',
                message: text || (imageUrl ? '📷 Hình ảnh' : ''),
                timestamp: new Date().toISOString(),
                likes: [],
                reactions: {}
            };

            if (imageUrl) msg.imageUrl = imageUrl;

            if (replyingTo) {
                msg.replyTo = {
                    id: replyingTo.id,
                    text: replyingTo.message,
                    anonymousName: replyingTo.anonymousName
                };
            }

            console.log('📤 Sending confession:', msg);
            await addConfession(msg);

            // Success cleanup
            setNewMessage('');
            setReplyingTo(null);
            setShowEmojiPicker(false);
            clearImage();

            // Reset textarea height & focus
            if (inputRef.current) inputRef.current.style.height = 'auto';
            if (inputRefDesktop.current) inputRefDesktop.current.style.height = 'auto';
            focusInput();
        } catch (e) {
            console.error('❌ Send confession error:', e);
        } finally {
            setIsSending(false);
        }
    };


    const handleLike = useCallback(async (id: string) => {
        if (!myHashedId) return;
        await likeConfession(id, myHashedId);
    }, [myHashedId, likeConfession]);

    const handleReaction = useCallback(async (id: string, emoji: string) => {
        if (!myHashedId) return;
        await reactToConfession(id, emoji, myHashedId);
    }, [myHashedId, reactToConfession]);

    const getGroupedReactions = useCallback((reactions?: { [emoji: string]: string[] }) => {
        if (!reactions) return [];
        return Object.entries(reactions).map(([emoji, uids]) => ({
            emoji,
            count: uids.length,
            isMe: uids.includes(myHashedId)
        })).filter(r => r.count > 0);
    }, [myHashedId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            handleSend();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { alert('Hình ảnh không được vượt quá 5MB!'); return; }
                setImageFile(file);
                const reader = new FileReader();
                reader.onload = (ev) => setImagePreview(ev.target?.result as string);
                reader.readAsDataURL(file);
                return;
            }
        }
    };

    const insertEmoji = useCallback((emoji: string) => {
        setNewMessage(prev => prev + emoji);
        focusInput();
    }, []);

    // Close pickers when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
            if (identityPickerRef.current && !identityPickerRef.current.contains(e.target as Node)) {
                setShowIdentityPicker(false);
            }
        };
        if (showEmojiPicker || showIdentityPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker, showIdentityPicker]);

    const formatTime = (ts: string) => {
        const d = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - d.getTime();

        if (diff < 60000) return 'Vừa xong';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
        if (diff < 86400000) return `Hôm nay, ${Math.floor(diff / 3600000)} giờ trước`;
        if (diff < 172800000) return 'Hôm qua'; // 24h - 48h

        const days = Math.floor(diff / 86400000);
        if (days < 7) return `${days} ngày trước`;

        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    if (!appUser) return <div>Loading...</div>;

    const latestWish = myWishes[0];

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

    // Sort confessions chronologically for chat view (oldest first)
    const sortedConfessions = useMemo(() => [...confessionMessages].reverse(), [confessionMessages]);

    const filteredConfessions = useMemo(() => {
        if (!searchTerm.trim()) return sortedConfessions;
        const term = searchTerm.toLowerCase();
        return sortedConfessions.filter(msg =>
            msg.message.toLowerCase().includes(term) ||
            msg.anonymousName.toLowerCase().includes(term)
        );
    }, [sortedConfessions, searchTerm]);

    const filteredWishes = useMemo(() => {
        if (!searchTerm.trim()) return myWishes;
        const term = searchTerm.toLowerCase();
        return myWishes.filter(wish =>
            wish.message.toLowerCase().includes(term) ||
            wish.fromUserName.toLowerCase().includes(term)
        );
    }, [myWishes, searchTerm]);

    return (
        <>
            <div className={clsx(
                "relative transition-colors duration-300",
                asWidget ? "min-h-full pb-4 bg-transparent" : "min-h-screen pb-10 bg-slate-50 dark:bg-[#0f172a]"
            )}>
                {/* Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-20 left-[10%] w-[500px] h-[500px] bg-pink-500/10 dark:bg-pink-500/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-normal" />
                    <div className="absolute bottom-20 right-[10%] w-[500px] h-[500px] bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-normal" />
                </div>

                <div className={clsx(
                    "mx-auto relative z-10",
                    asWidget ? "w-full px-4 sm:px-8 py-8 md:py-12 max-w-5xl" : "max-w-6xl px-4 py-8"
                )}>
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
                                icon: MessageSquareHeart,
                                label: "Confession",
                                value: confessionMessages.length,
                                color: "from-pink-400 to-rose-500"
                            },
                            {
                                icon: Users,
                                label: "Lời chúc",
                                value: myWishes.length,
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

                    {/* Tab Switcher */}
                    <div className="mt-8 flex gap-2">
                        <button
                            onClick={() => setActiveTab('confessions')}
                            className={clsx(
                                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 border",
                                activeTab === 'confessions'
                                    ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white border-transparent shadow-lg shadow-pink-500/25"
                                    : "bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-pink-300 dark:hover:border-pink-500/30"
                            )}
                        >
                            <MessageSquareHeart size={16} />
                            Confession ẩn danh
                            {confessionMessages.length > 0 && (
                                <span className={clsx(
                                    "px-2 py-0.5 rounded-full text-[10px] font-black",
                                    activeTab === 'confessions' ? "bg-white/20" : "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400"
                                )}>{confessionMessages.length}</span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('wishes')}
                            className={clsx(
                                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 border",
                                activeTab === 'wishes'
                                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-transparent shadow-lg shadow-indigo-500/25"
                                    : "bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/30"
                            )}
                        >
                            <Gift size={16} />
                            Lời chúc của tôi
                            {myWishes.length > 0 && (
                                <span className={clsx(
                                    "px-2 py-0.5 rounded-full text-[10px] font-black",
                                    activeTab === 'wishes' ? "bg-white/20" : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                                )}>{myWishes.length}</span>
                            )}
                        </button>
                    </div>

                    {/* =================== CONFESSION TAB =================== */}
                    {activeTab === 'confessions' && (
                        <div className="mt-6">
                            {/* Anonymous identity banner */}
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-4 flex items-center justify-between px-4 py-3 rounded-2xl bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 border border-pink-200/50 dark:border-pink-800/30"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{activeIdentity.emoji}</span>
                                    <div>
                                        <p className="text-sm font-bold text-pink-700 dark:text-pink-300">
                                            Bạn đang xuất hiện với tên: <span className="text-pink-500">{activeIdentity.name}</span>
                                        </p>
                                        <p className="text-[11px] text-pink-500/70 dark:text-pink-400/60 font-medium hidden sm:block">
                                            Danh tính được tự động ẩn — mọi tin nhắn đều ẩn danh hoàn toàn 🎭
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowIdentityPicker(p => !p)}
                                    className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold rounded-lg shadow-sm shadow-pink-500/30 transition-all shrink-0 whitespace-nowrap"
                                >
                                    Đổi nhân vật
                                </button>
                            </motion.div>

                            {/* Search Bar */}
                            <div className="mb-4 relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-pink-500">
                                    <Search size={18} className="text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Tìm kiếm lời nhắn, nhân vật..."
                                    className="w-full pl-11 pr-12 py-3 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500/50 backdrop-blur-md transition-all shadow-sm"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-pink-500 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Chat Messages Area */}
                            <div className="bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 rounded-[2rem] backdrop-blur-md shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                                {/* Chat messages scrollable area */}
                                <div className="relative">
                                    <div ref={chatScrollContainerRef} onScroll={handleChatScroll} className="h-[60vh] overflow-y-auto p-6 space-y-4 scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
                                        {filteredConfessions.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                                <div className="w-20 h-20 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center mb-4">
                                                    {searchTerm ? <Search size={36} className="text-pink-400" /> : <MessageSquareHeart size={36} className="text-pink-400" />}
                                                </div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                                                    {searchTerm ? 'Không tìm thấy kết quả' : 'Hãy là người đầu tiên! 🎉'}
                                                </h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                                                    {searchTerm
                                                        ? `Không có tin nhắn nào khớp với từ khóa "${searchTerm}". Hãy thử từ khóa khác!`
                                                        : 'Gửi một lời confession ẩn danh để chia sẻ tình cảm, lời cảm ơn, hay lời động viên tới mọi người.'}
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {filteredConfessions.map((msg, index) => {
                                                    const isOwn = msg.anonymousName === activeIdentity.name && msg.anonymousEmoji === activeIdentity.emoji;
                                                    const likeCount = (msg.likes || []).length;
                                                    const isLiked = (msg.likes || []).includes(myHashedId);

                                                    return (
                                                        <motion.div
                                                            key={msg.id}
                                                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            transition={{ delay: Math.min(index * 0.03, 0.5) }}
                                                            className={clsx("flex gap-3 group", isOwn && "flex-row-reverse")}
                                                        >
                                                            {/* Avatar */}
                                                            <div className={clsx(
                                                                "w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 shadow-md ring-2 ring-white dark:ring-slate-800",
                                                                isOwn
                                                                    ? "bg-gradient-to-tr from-pink-500 to-rose-500"
                                                                    : "bg-gradient-to-tr from-indigo-500 to-purple-500"
                                                            )}>
                                                                {msg.anonymousEmoji}
                                                            </div>

                                                            {/* Message Bubble */}
                                                            <div className={clsx("max-w-[75%] min-w-[200px]", isOwn && "text-right")}>
                                                                <div className={clsx("flex items-center gap-2 mb-1", isOwn && "flex-row-reverse")}>
                                                                    <span className={clsx(
                                                                        "text-xs font-bold",
                                                                        isOwn ? "text-pink-500" : "text-indigo-500 dark:text-indigo-400"
                                                                    )}>
                                                                        {msg.anonymousName}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-medium">{formatTime(msg.timestamp)}</span>
                                                                </div>
                                                                <div id={`conf-${msg.id}`}
                                                                    className={clsx(
                                                                        "rounded-2xl px-4 py-3 relative group/bubble transition-all cursor-pointer",
                                                                        isOwn
                                                                            ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-tr-md shadow-md shadow-pink-500/20"
                                                                            : "bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 rounded-tl-md shadow-sm"
                                                                    )}
                                                                    onClick={() => setSelectedMsgId(selectedMsgId === msg.id ? null : msg.id)}
                                                                >
                                                                    {msg.replyTo && (
                                                                        <div
                                                                            className={clsx(
                                                                                "mb-2 p-2 rounded bg-black/10 border-l-2 border-current text-xs flex flex-col opacity-80 hover:opacity-100 truncate",
                                                                                isOwn ? "text-white" : "text-pink-500"
                                                                            )}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const el = document.getElementById(`conf-${msg.replyTo?.id}`);
                                                                                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                                el?.classList.add(isOwn ? 'ring-2' : 'bg-pink-100');
                                                                                setTimeout(() => el?.classList.remove(isOwn ? 'ring-2' : 'bg-pink-100'), 2000);
                                                                            }}
                                                                        >
                                                                            <span className="font-bold mb-0.5">{msg.replyTo.anonymousName}</span>
                                                                            <span className="truncate italic">"{msg.replyTo.text}"</span>
                                                                        </div>
                                                                    )}
                                                                    {msg.imageUrl && (
                                                                        <div className="mb-2 -mx-1">
                                                                            <img src={msg.imageUrl} alt="" onClick={(e) => { e.stopPropagation(); setLightboxUrl(msg.imageUrl!); }}
                                                                                className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity border border-black/5" />
                                                                        </div>
                                                                    )}
                                                                    {msg.message && msg.message !== '📷 Hình ảnh' && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>}
                                                                    {msg.message === '📷 Hình ảnh' && !msg.imageUrl && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>}

                                                                    {/* Actions Row */}
                                                                    <div className={clsx(
                                                                        "flex items-center gap-2 mt-2 pt-2 border-t",
                                                                        isOwn ? "border-white/20 justify-end" : "border-slate-200/50 dark:border-white/10"
                                                                    )}>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleLike(msg.id); }}
                                                                            className={clsx(
                                                                                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold transition-all",
                                                                                isLiked
                                                                                    ? (isOwn ? "bg-white/30 text-white" : "bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400")
                                                                                    : (isOwn ? "bg-white/10 text-white/70 hover:bg-white/20" : "bg-slate-200/50 dark:bg-slate-600/50 text-slate-500 dark:text-slate-400 hover:bg-pink-100 dark:hover:bg-pink-900/30 hover:text-pink-500")
                                                                            )}
                                                                        >
                                                                            <ThumbsUp size={11} className={isLiked ? "fill-current" : ""} />
                                                                            {likeCount > 0 && <span>{likeCount}</span>}
                                                                        </button>

                                                                        {isOwn && (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); deleteConfession(msg.id); }}
                                                                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-white/60 hover:bg-red-500/30 hover:text-white transition-all"
                                                                            >
                                                                                <Trash2 size={11} />
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Floating Reaction/Reply Menu */}
                                                                    <div className={clsx(
                                                                        "absolute -top-9 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full px-2 py-1 shadow-xl z-20 transition-all duration-200",
                                                                        isOwn ? "right-0" : "left-0",
                                                                        selectedMsgId === msg.id ? "opacity-100 translate-y-0 visible" : "opacity-0 translate-y-1 invisible md:group-hover:opacity-100 md:group-hover:translate-y-0 md:group-hover:visible"
                                                                    )}>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); setSelectedMsgId(null); focusInput(); }}
                                                                            className="hover:bg-slate-100 dark:hover:bg-white/10 p-1 rounded-full text-slate-400 hover:text-pink-500 mr-1 border-r border-slate-200 dark:border-white/10 pr-2"
                                                                            title="Trả lời"
                                                                        >
                                                                            <CornerUpLeft size={14} />
                                                                        </button>
                                                                        {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                                                                            <button
                                                                                key={emoji}
                                                                                onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); setSelectedMsgId(null); }}
                                                                                className={clsx(
                                                                                    "hover:scale-125 transition-transform text-xs p-1 rounded-full",
                                                                                    msg.reactions?.[emoji]?.includes(myHashedId) && "bg-pink-500/20"
                                                                                )}
                                                                            >
                                                                                {emoji}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Grouped Reactions Display */}
                                                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                                    <div className={clsx(
                                                                        "flex flex-wrap gap-1 mt-1",
                                                                        isOwn ? "justify-end" : "justify-start"
                                                                    )}>
                                                                        {getGroupedReactions(msg.reactions).map((group, idx) => (
                                                                            <button
                                                                                key={`${group.emoji}-${idx}`}
                                                                                className={clsx(
                                                                                    "relative bg-white/80 dark:bg-slate-700/80 border rounded-full py-0.5 px-2 flex items-center gap-1 shadow-sm hover:scale-110 transition-all",
                                                                                    group.isMe ? "border-pink-300 dark:border-pink-500/50" : "border-slate-200 dark:border-white/10"
                                                                                )}
                                                                                onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, group.emoji); }}
                                                                            >
                                                                                <span className="text-xs">{group.emoji}</span>
                                                                                <span className="text-[10px] text-slate-500 dark:text-slate-300 font-bold">{group.count}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                                <div ref={chatEndRef} />
                                            </>
                                        )}
                                    </div>
                                    {/* Scroll to bottom button */}
                                    <AnimatePresence>
                                        {showScrollDown && (
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                                onClick={scrollToBottom}
                                                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold rounded-full shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 transition-all active:scale-95 cursor-pointer"
                                            >
                                                <ArrowDown size={14} />
                                                Tin nhắn mới
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Input Bar */}
                                <div className="border-t border-slate-200 dark:border-white/5 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg relative">
                                    {/* Reply Preview */}
                                    <AnimatePresence>
                                        {replyingTo && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-pink-50 dark:bg-pink-950/20 border-l-4 border-pink-500 p-2 mb-2 flex items-center justify-between rounded-r-lg"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-bold text-pink-500 uppercase tracking-tighter">Đang trả lời {replyingTo.anonymousName}</p>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{replyingTo.message}</p>
                                                </div>
                                                <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-pink-100 dark:hover:bg-pink-900/30 rounded-full text-slate-400">
                                                    <X size={14} />
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    {/* Emoji Picker */}
                                    <AnimatePresence>
                                        {showEmojiPicker && (
                                            <motion.div
                                                ref={emojiPickerRef}
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                transition={{ duration: 0.2 }}
                                                className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl shadow-slate-300/50 dark:shadow-black/50 overflow-hidden z-50"
                                            >
                                                {/* Category Tabs */}
                                                <div className="flex items-center gap-0.5 px-2 py-2 border-b border-slate-100 dark:border-white/5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                                    {EMOJI_CATEGORIES.map((cat, i) => (
                                                        <button
                                                            key={cat.label}
                                                            onClick={() => setActiveEmojiCategory(i)}
                                                            className={clsx(
                                                                "px-2.5 py-1.5 rounded-lg text-sm transition-all shrink-0",
                                                                activeEmojiCategory === i
                                                                    ? "bg-pink-100 dark:bg-pink-900/40 scale-110"
                                                                    : "hover:bg-slate-100 dark:hover:bg-slate-700"
                                                            )}
                                                            title={cat.label}
                                                        >
                                                            {cat.icon}
                                                        </button>
                                                    ))}
                                                </div>
                                                {/* Category Label */}
                                                <div className="px-3 pt-2 pb-1">
                                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                        {EMOJI_CATEGORIES[activeEmojiCategory].label}
                                                    </p>
                                                </div>
                                                {/* Emoji Grid */}
                                                <div className="h-48 overflow-y-auto px-2 pb-2" style={{ scrollbarWidth: 'thin' }}>
                                                    <div className="grid grid-cols-8 sm:grid-cols-10 gap-0.5">
                                                        {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji, i) => (
                                                            <button
                                                                key={`${emoji}-${i}`}
                                                                onClick={() => insertEmoji(emoji)}
                                                                className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-pink-50 dark:hover:bg-pink-900/30 hover:scale-125 active:scale-95 transition-all duration-150"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Identity Picker Popover */}
                                    <AnimatePresence>
                                        {showIdentityPicker && (
                                            <motion.div
                                                ref={identityPickerRef}
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                transition={{ duration: 0.2 }}
                                                className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl shadow-slate-300/50 dark:shadow-black/50 overflow-hidden z-50 p-4"
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">🎭 Chọn vỏ bọc của bạn</h4>
                                                    <button onClick={() => setCustomIdentity(null)} className="text-xs text-indigo-500 hover:underline">
                                                        Reset
                                                    </button>
                                                </div>
                                                {/* Category Selection Grid - wraps to show all */}
                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                    <button
                                                        onClick={() => setActiveCharCategory(-1)}
                                                        className={clsx(
                                                            "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
                                                            activeCharCategory === -1
                                                                ? "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-500/50 text-pink-600 dark:text-pink-300 shadow-sm"
                                                                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:border-pink-300 hover:text-pink-500"
                                                        )}
                                                    >
                                                        🌟 Tất cả
                                                    </button>
                                                    {allCategories.map((cat, i) => (
                                                        <button
                                                            key={cat.label}
                                                            onClick={() => setActiveCharCategory(i)}
                                                            className={clsx(
                                                                "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
                                                                activeCharCategory === i
                                                                    ? "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-500/50 text-pink-600 dark:text-pink-300 shadow-sm"
                                                                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:border-pink-300 hover:text-pink-500"
                                                            )}
                                                        >
                                                            {cat.icon} {cat.label.replace(/^[^\s]+\s/, '')}
                                                        </button>
                                                    ))}
                                                </div>
                                                {/* Character Grid */}
                                                <div className="h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                                                    {(activeCharCategory === -1 ? allCategories : [allCategories[activeCharCategory]]).map((cat) => (
                                                        <div key={cat.label} className="mb-3">
                                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 px-0.5 flex items-center gap-1 sticky top-0 bg-white dark:bg-slate-800 py-1 z-10">
                                                                <span>{cat.icon}</span> {cat.label.replace(/^[^\s]+\s/, '')}
                                                                <span className="text-[9px] font-normal opacity-70">({cat.characters.length})</span>
                                                            </p>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                                                {cat.characters.map(({ name, emoji }) => {
                                                                    const isActive = activeIdentity.name === name;
                                                                    return (
                                                                        <button
                                                                            key={`${cat.label}-${name}`}
                                                                            onClick={() => {
                                                                                setCustomIdentity({ name, emoji });
                                                                                setShowIdentityPicker(false);
                                                                            }}
                                                                            className={clsx(
                                                                                "flex items-center gap-2 p-2 rounded-xl border text-sm transition-all text-left",
                                                                                isActive
                                                                                    ? "bg-pink-50 dark:bg-pink-900/30 border-pink-300 dark:border-pink-500/50 text-pink-600 dark:text-pink-300 shadow-sm"
                                                                                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-pink-300 dark:hover:border-pink-500/50"
                                                                            )}
                                                                        >
                                                                            <span className="text-xl">{emoji}</span>
                                                                            <span className="font-medium truncate">{name}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />

                                    {/* ===== MOBILE LAYOUT: 2 rows ===== */}
                                    <div className="md:hidden">
                                        {/* Top row: action buttons */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <button
                                                onClick={() => setShowIdentityPicker(p => !p)}
                                                title="Đổi nhân vật khác"
                                                className={clsx('h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold shrink-0 shadow-sm border transition-all cursor-pointer active:scale-95',
                                                    showIdentityPicker ? 'bg-gradient-to-tr from-indigo-500 to-purple-500 border-indigo-400 text-white' : 'bg-gradient-to-tr from-pink-500 to-rose-500 border-pink-400/50 text-white')}
                                            >
                                                <span className="text-base">{activeIdentity.emoji}</span>
                                                <span className="hidden xs:inline">Nhân vật</span>
                                            </button>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all duration-200 shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-pink-500 active:scale-95"
                                                title="Đính kèm hình ảnh"
                                            >
                                                <ImagePlus size={16} />
                                                <span>Ảnh</span>
                                            </button>
                                            <button
                                                onClick={() => setShowEmojiPicker(p => !p)}
                                                className={clsx(
                                                    "h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all duration-200 shrink-0 border active:scale-95",
                                                    showEmojiPicker
                                                        ? "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700 text-pink-500"
                                                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-pink-500"
                                                )}
                                            >
                                                <Smile size={16} />
                                                <span>Emoji</span>
                                            </button>
                                        </div>
                                        {/* Image Preview - mobile */}
                                        {imagePreview && (
                                            <div className="mb-2 relative inline-block">
                                                <img src={imagePreview} alt="Preview" className="max-h-24 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" />
                                                <button onClick={clearImage} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                        {/* Bottom row: textarea + send */}
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1 relative">
                                                <textarea
                                                    ref={inputRef}
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    onPaste={handlePaste}
                                                    placeholder="Soạn tin nhắn..."
                                                    rows={1}
                                                    className="w-full px-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/50 transition-all resize-none block"
                                                    style={{ minHeight: '42px', paddingTop: '10px', paddingBottom: '10px', maxHeight: '120px' }}
                                                    onInput={(e) => {
                                                        const target = e.target as HTMLTextAreaElement;
                                                        target.style.height = 'auto';
                                                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={handleSend}
                                                disabled={(!newMessage.trim() && !imageFile) || isSending}
                                                className={clsx(
                                                    "w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all duration-300 shrink-0",
                                                    (newMessage.trim() || imageFile)
                                                        ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/40"
                                                        : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                                                )}
                                            >
                                                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className={(newMessage.trim() || imageFile) ? "translate-x-0.5 -translate-y-0.5" : ""} />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 font-medium opacity-80">
                                            Nhấn Enter để gửi • Shift+Enter xuống dòng • 🎭 Ẩn danh
                                        </p>
                                    </div>

                                    {/* ===== DESKTOP LAYOUT: single row (hidden on mobile) ===== */}
                                    <div className="hidden md:block">
                                        <div className="flex items-end gap-2">
                                            <button
                                                onClick={() => setShowIdentityPicker(p => !p)}
                                                title="Đổi nhân vật khác"
                                                className={clsx('w-[42px] h-[42px] rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm border transition-all cursor-pointer hover:scale-105 active:scale-95',
                                                    showIdentityPicker ? 'bg-gradient-to-tr from-indigo-500 to-purple-500 border-indigo-400' : 'bg-gradient-to-tr from-pink-500 to-rose-500 border-pink-400/50')}
                                            >
                                                {activeIdentity.emoji}
                                            </button>
                                            <button
                                                onClick={() => setShowEmojiPicker(p => !p)}
                                                className={clsx(
                                                    "w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 border",
                                                    showEmojiPicker
                                                        ? "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700 text-pink-500"
                                                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-pink-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                                                )}
                                            >
                                                <Smile size={20} />
                                            </button>
                                            <div className="flex-1 relative">
                                                <textarea
                                                    ref={inputRefDesktop}
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    onPaste={handlePaste}
                                                    placeholder="Viết confession... (Ctrl+V để dán ảnh)"
                                                    rows={1}
                                                    className="w-full px-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/50 transition-all resize-none block"
                                                    style={{ minHeight: '42px', paddingTop: '10px', paddingBottom: '10px', maxHeight: '120px' }}
                                                    onInput={(e) => {
                                                        const target = e.target as HTMLTextAreaElement;
                                                        target.style.height = 'auto';
                                                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-pink-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                                                title="Đính kèm hình ảnh"
                                            >
                                                <ImagePlus size={20} />
                                            </button>
                                            <button
                                                onClick={handleSend}
                                                disabled={(!newMessage.trim() && !imageFile) || isSending}
                                                className={clsx(
                                                    "w-[42px] h-[42px] rounded-xl flex items-center justify-center transition-all duration-300 shrink-0",
                                                    (newMessage.trim() || imageFile)
                                                        ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/40 hover:-translate-y-0.5"
                                                        : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                                                )}
                                            >
                                                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className={(newMessage.trim() || imageFile) ? "translate-x-0.5 -translate-y-0.5" : ""} />}
                                            </button>
                                        </div>
                                        {/* Image Preview - desktop */}
                                        {imagePreview && (
                                            <div className="ml-[100px] mt-2 relative inline-block">
                                                <img src={imagePreview} alt="Preview" className="max-h-28 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" />
                                                <button onClick={clearImage} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 ml-[100px] font-medium opacity-80">
                                            Nhấn Enter để gửi • Shift+Enter xuống dòng • Ctrl+V dán ảnh • 🎭 Ẩn danh
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* =================== WISHES TAB =================== */}
                    {activeTab === 'wishes' && (
                        <div className="mt-6">
                            {/* Search Bar for Wishes */}
                            <div className="mb-6 relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-500">
                                    <Search size={18} className="text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Tìm kiếm lời chúc, đồng nghiệp..."
                                    className="w-full pl-11 pr-12 py-3 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 backdrop-blur-md transition-all shadow-sm"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-500 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {filteredWishes.length === 0 ? (
                                <div className="bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 rounded-[2rem] p-12 text-center backdrop-blur-md shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-all duration-700 group-hover:bg-indigo-500/10" />
                                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

                                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400 dark:text-slate-500 shadow-inner relative z-10 ring-4 ring-white dark:ring-slate-800">
                                        {searchTerm ? <Search size={40} className="text-indigo-400" /> : <MessageCircle size={40} strokeWidth={1.5} />}
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 relative z-10">
                                        {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có lời nhắn nào'}
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto relative z-10 leading-relaxed font-medium">
                                        {searchTerm
                                            ? `Không có lời chúc nào khớp với từ khóa "${searchTerm}". Hãy thử từ khóa khác!`
                                            : 'Hãy chờ đợi những bất ngờ từ đồng nghiệp nhé! Một lời chúc chân thành có thể làm bừng sáng cả ngày của bạn. ✨'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {filteredWishes.map((wish, index) => {
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
                                                            <div className="absolute -top-2 -left-1 text-slate-300 dark:text-slate-700 text-2xl font-serif leading-none">"</div>
                                                            <p className="text-slate-700 dark:text-slate-300 text-sm italic leading-relaxed relative z-10">
                                                                {wish.message}
                                                            </p>
                                                            <div className="absolute -bottom-4 -right-1 text-slate-300 dark:text-slate-700 text-2xl font-serif leading-none rotate-180">"</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox Modal */}
            <AnimatePresence>
                {lightboxUrl && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 cursor-pointer"
                        onClick={() => setLightboxUrl(null)}
                    >
                        <motion.img
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                            src={lightboxUrl} alt="" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors">
                            <X size={24} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default MyBirthdayWishes;

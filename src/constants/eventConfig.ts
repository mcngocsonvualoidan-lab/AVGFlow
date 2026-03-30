/**
 * ========================================================================
 * 🎉 CẤU HÌNH SỰ KIỆN TRANG TRÍ - EVENT DECORATION CONFIG
 * ========================================================================
 * 
 * Đây là NGUỒN DUY NHẤT cho mọi thông tin sự kiện trang trí trên app.
 * Khi cần thay đổi sự kiện, CHỈ CẦN SỬA FILE NÀY.
 * 
 * Các nơi sử dụng:
 * - TetDecorations.tsx  (Banner + Falling particles)
 * - Sidebar.tsx          (Toggle label + colors)
 * - Login.tsx            (Footer text)
 * ========================================================================
 */

export interface EventConfig {
    /** Tên ngắn gọn cho sidebar toggle ("Chào mừng 26/3") */
    shortLabel: string;
    /** Tooltip khi sidebar collapsed */
    toggleTooltip: string;
    /** Tiêu đề banner chính trên decoration */
    bannerTitle: string;
    /** Phụ đề banner */
    bannerSubtitle: string;
    /** Text footer trên trang Login */
    loginFooterText: string;
    /** Emoji bên trái banner */
    bannerEmojiLeft: string;
    /** Emoji bên phải banner */
    bannerEmojiRight: string;
    /** Emoji trang trí góc */
    cornerEmoji: string;
    /** Theme màu chính (dùng cho Tailwind gradient classes) */
    theme: {
        /** Gradient cho text banner: "from-xxx via-xxx to-xxx" */
        bannerGradient: string;
        /** Gradient cho text sidebar khi ON */
        sidebarGradient: string;
        /** Background banner overlay gradient */
        bannerBgGradient: string;
        /** Shadow color cho banner */
        bannerShadow: string;
        /** Border color cho banner */
        bannerBorder: string;
        /** Dark mode border */
        bannerBorderDark: string;
    };
    /** CSS classes cho sidebar toggle — viết đầy đủ, không interpolation */
    sidebarClasses: {
        /** Classes khi toggle ON (button wrapper) */
        onButton: string;
        /** Classes khi toggle ON (text/icon) */
        onText: string;
        /** Classes khi toggle ON (switch bg) */
        onSwitch: string;
    };
    /** Loại particle rơi */
    particles: {
        /** Các loại particle: 'star' | 'sparkle' | 'dot' | 'petal' | 'heart' */
        types: Array<'star' | 'sparkle' | 'dot' | 'petal' | 'heart'>;
        /** Xác suất cho mỗi loại (tổng = 1.0) */
        weights: number[];
        /** Màu chính cho particle (SVG fill) */
        primaryColor: string;
        /** Màu phụ cho particle */
        secondaryColor: string;
        /** Màu dot */
        dotColor: string;
        /** Số lượng particles */
        count: number;
    };
}

// ========================================================================
// 🔧 SỰA Ở ĐÂY ĐỂ THAY ĐỔI SỰ KIỆN
// ========================================================================

export const CURRENT_EVENT: EventConfig = {
    // --- Nội dung ---
    shortLabel: 'Chào mừng 26/3',
    toggleTooltip: 'Bật/Tắt trang trí sự kiện',
    bannerTitle: 'Chào mừng ngày 26/3',
    bannerSubtitle: '95 năm Đoàn TNCS Hồ Chí Minh 🇻🇳',
    loginFooterText: '⭐ Chào mừng 95 năm thành lập Đoàn TNCS Hồ Chí Minh (26/3/1931 - 26/3/2026) ⭐',
    bannerEmojiLeft: '⭐',
    bannerEmojiRight: '🌟',
    cornerEmoji: '⭐',

    // --- Theme màu ---
    theme: {
        bannerGradient: 'from-red-600 via-red-500 to-yellow-500',
        sidebarGradient: 'from-red-500 to-yellow-500',
        bannerBgGradient: 'from-red-100/40 via-yellow-100/30 to-red-100/40',
        bannerShadow: 'shadow-red-500/15',
        bannerBorder: 'border-red-200/60',
        bannerBorderDark: 'dark:border-red-500/20',
    },

    // --- Sidebar toggle classes (full strings cho Tailwind JIT) ---
    sidebarClasses: {
        onButton: 'text-red-500 bg-red-500/5 border border-red-500/20',
        onText: 'text-red-500',
        onSwitch: 'bg-red-500 shadow-sm border-red-500',
    },

    // --- Particle effects ---
    particles: {
        types: ['star', 'sparkle', 'dot'],
        weights: [0.4, 0.3, 0.3],
        primaryColor: '#fbbf24',    // Vàng (ngôi sao)
        secondaryColor: '#dc2626', // Đỏ (sparkle)
        dotColor: '#ef4444',       // Đỏ nhạt (dot)
        count: 18,
    },
};

// ========================================================================
// 📋 SỰ KIỆN MẪU — Copy & paste khi cần đổi sự kiện
// ========================================================================

/*
// === MẪU: Ngày 8/3 - Quốc tế Phụ nữ ===
export const CURRENT_EVENT: EventConfig = {
    shortLabel: 'Chào mừng 8/3',
    toggleTooltip: 'Bật/Tắt trang trí sự kiện',
    bannerTitle: 'Chào mừng ngày 8/3',
    bannerSubtitle: 'Ngày Quốc tế Phụ nữ 💐',
    loginFooterText: '🌸 Chúc mừng Ngày Quốc tế Phụ nữ 8/3 🌸',
    bannerEmojiLeft: '🌸',
    bannerEmojiRight: '🌷',
    cornerEmoji: '💐',
    theme: {
        bannerGradient: 'from-pink-500 via-rose-500 to-fuchsia-500',
        sidebarGradient: 'from-pink-500 to-rose-500',
        bannerBgGradient: 'from-pink-100/40 via-rose-100/30 to-fuchsia-100/40',
        bannerShadow: 'shadow-pink-500/10',
        bannerBorder: 'border-pink-200/60',
        bannerBorderDark: 'dark:border-pink-500/20',
    },
    sidebarClasses: {
        onButton: 'text-pink-500 bg-pink-500/5 border border-pink-500/20',
        onText: 'text-pink-500',
        onSwitch: 'bg-pink-500 shadow-sm border-pink-500',
    },
    particles: {
        types: ['petal', 'heart', 'dot'],
        weights: [0.5, 0.25, 0.25],
        primaryColor: '#f9a8d4',
        secondaryColor: '#f472b6',
        dotColor: '#fda4af',
        count: 15,
    },
};

// === MẪU: Tết Nguyên Đán ===
export const CURRENT_EVENT: EventConfig = {
    shortLabel: 'Chúc Mừng Năm Mới',
    toggleTooltip: 'Bật/Tắt trang trí Tết',
    bannerTitle: 'Chúc Mừng Năm Mới',
    bannerSubtitle: 'Tết Bính Ngọ 2026 🧧',
    loginFooterText: '🧧 Chúc Mừng Năm Mới - Tết Bính Ngọ 2026 🧧',
    bannerEmojiLeft: '🧧',
    bannerEmojiRight: '🎊',
    cornerEmoji: '🏮',
    theme: {
        bannerGradient: 'from-red-600 via-orange-500 to-yellow-500',
        sidebarGradient: 'from-red-500 to-orange-500',
        bannerBgGradient: 'from-red-100/40 via-orange-100/30 to-yellow-100/40',
        bannerShadow: 'shadow-red-500/15',
        bannerBorder: 'border-red-200/60',
        bannerBorderDark: 'dark:border-red-500/20',
    },
    sidebarClasses: {
        onButton: 'text-red-500 bg-red-500/5 border border-red-500/20',
        onText: 'text-red-500',
        onSwitch: 'bg-red-500 shadow-sm border-red-500',
    },
    particles: {
        types: ['star', 'sparkle', 'dot'],
        weights: [0.4, 0.3, 0.3],
        primaryColor: '#fbbf24',
        secondaryColor: '#ef4444',
        dotColor: '#fb923c',
        count: 20,
    },
};
*/

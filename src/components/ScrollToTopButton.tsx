import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface ScrollToTopButtonProps {
    /** Ref to the scroll container (e.g. <main>) */
    scrollRef: React.RefObject<HTMLElement | null>;
}

/**
 * Global "Scroll to Top" floating button.
 * Appears when the user scrolls down > 300px in the main content area.
 * 
 * Positioning:
 * - Mobile: bottom-left (bottom-[92px] left-4) — above bottom nav (80px), avoids heart button on right
 * - Desktop: bottom-right (bottom-8 right-24) — left of heart button at right-8
 */
const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({ scrollRef }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const handleScroll = () => {
            setVisible(container.scrollTop > 300);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [scrollRef]);

    const scrollToTop = useCallback(() => {
        const container = scrollRef.current;
        if (container) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [scrollRef]);

    return (
        <AnimatePresence>
            {visible && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    onClick={scrollToTop}
                    title="Lên đầu trang"
                    aria-label="Lên đầu trang"
                    className={clsx(
                        "fixed z-30 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 group cursor-pointer",
                        // Mobile: bottom-left, above bottom nav bar (80px) + gap
                        "bottom-[92px] left-4 w-10 h-10",
                        // Desktop: bottom-right, left of ConfessionWidget heart button (right-8)
                        "md:bottom-8 md:left-auto md:right-24 md:w-11 md:h-11",
                        // Gradient & hover
                        "bg-gradient-to-br from-indigo-500 to-violet-600 text-white",
                        "hover:from-indigo-600 hover:to-violet-700 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:scale-90"
                    )}
                >
                    <ArrowUp size={18} className="group-hover:-translate-y-0.5 transition-transform" />
                </motion.button>
            )}
        </AnimatePresence>
    );
};

export default ScrollToTopButton;

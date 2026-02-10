
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { generateMockPortfolio } from './mockData';
import ThemeCosmic from './themes/ThemeCosmic';
import ThemeExecutive from './themes/ThemeExecutive';
import ThemeCreative from './themes/ThemeCreative';
import ThemeMinimal from './themes/ThemeMinimal';

interface UserProfilePortalProps {
    user: any;
    onClose: () => void;
}

const UserProfilePortal: React.FC<UserProfilePortalProps> = ({ user, onClose }) => {

    // Generate data on mount (deterministic based on user ID)
    const data = React.useMemo(() => generateMockPortfolio(user), [user.id]);

    // PREVENT BODY SCROLL
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    // Theme Selector
    const renderTheme = () => {
        switch (data.theme) {
            case 'cosmic': return <ThemeCosmic user={user} data={data} onClose={onClose} />;
            case 'executive': return <ThemeExecutive user={user} data={data} onClose={onClose} />;
            case 'creative': return <ThemeCreative user={user} data={data} onClose={onClose} />;
            case 'minimal': return <ThemeMinimal user={user} data={data} onClose={onClose} />;
            default: return <ThemeCosmic user={user} data={data} onClose={onClose} />;
        }
    };

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black"
        >
            {renderTheme()}
        </motion.div>,
        document.body
    );
};

export default UserProfilePortal;

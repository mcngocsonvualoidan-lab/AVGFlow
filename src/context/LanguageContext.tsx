import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { translations, Language } from '../i18n/translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: typeof translations['vi'];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [language, setLanguage] = useState<Language>('vi');

    // Load persisted language on mount
    useEffect(() => {
        const saved = localStorage.getItem('avg_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.language) {
                    setLanguage(parsed.language);
                }
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
    }, []);

    const value = {
        language,
        setLanguage: (lang: Language) => {
            setLanguage(lang);
            // We update state here, persistence happens in Settings page save or we could do it here.
            // For now, let's keep persistence logic centralized or duplicate it safely.
            // Let's also save immediately to be safe.
            const saved = localStorage.getItem('avg_settings');
            const parsed = saved ? JSON.parse(saved) : {};
            localStorage.setItem('avg_settings', JSON.stringify({ ...parsed, language: lang }));
        },
        t: translations[language]
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

import React, { useState, useCallback } from 'react';

interface AvatarImgProps {
    src?: string;
    name?: string;
    /** Size of the avatar container (used for initials fallback font size calculation) */
    size?: number;
    className?: string;
    style?: React.CSSProperties;
    /** Additional class for the img element */
    imgClassName?: string;
    /** Gradient colors for fallback (from, to) */
    gradientFrom?: string;
    gradientTo?: string;
    alt?: string;
    title?: string;
}

/**
 * AvatarImg — a reliable avatar component with built-in error handling.
 * Shows initials fallback FIRST, then overlays the image ONLY on successful load.
 * This prevents broken image icons from ever appearing.
 * 
 * Usage:
 *   <AvatarImg src={user.avatar} name={user.name} className="w-8 h-8 rounded-full" />
 */
const AvatarImg: React.FC<AvatarImgProps> = ({
    src,
    name,
    size,
    className = '',
    style,
    imgClassName = '',
    gradientFrom = 'from-indigo-400',
    gradientTo = 'to-purple-500',
    alt = '',
    title,
}) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);

    const initials = (name || '?')
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    // Compute font size: roughly 38% of the explicit size, or use CSS em
    const fontSize = size ? Math.max(8, Math.round(size * 0.38)) : undefined;

    const handleLoad = useCallback(() => {
        setImgLoaded(true);
        setImgError(false);
    }, []);

    const handleError = useCallback(() => {
        setImgError(true);
        setImgLoaded(false);
    }, []);

    // Build fallback src from ui-avatars.com
    const fallbackSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&size=${(size || 32) * 2}&background=6366f1&color=fff`;
    const imgSrc = src || fallbackSrc;
    const showImg = imgLoaded && !imgError;

    return (
        <div className={className} style={{ overflow: 'hidden', position: 'relative', ...style }} title={title}>
            {/* Always-visible initials fallback */}
            <div
                className={`w-full h-full bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center text-white font-bold`}
                style={{
                    fontSize: fontSize ? `${fontSize}px` : '0.65em',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    opacity: showImg ? 0 : 1,
                    transition: 'opacity 0.2s ease',
                }}
            >
                {initials}
            </div>
            {/* Image overlay - only visible when loaded successfully */}
            {!imgError && (
                <img
                    src={imgSrc}
                    alt={alt}
                    className={`w-full h-full object-cover ${imgClassName}`}
                    style={{
                        position: 'relative',
                        zIndex: 1,
                        opacity: showImg ? 1 : 0,
                        transition: 'opacity 0.2s ease',
                    }}
                    referrerPolicy="no-referrer"
                    onLoad={handleLoad}
                    onError={handleError}
                />
            )}
        </div>
    );
};

export default AvatarImg;

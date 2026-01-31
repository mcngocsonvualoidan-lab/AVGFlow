/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // Enable class-based dark mode
    theme: {
        fontFamily: {
            sans: ['"Be Vietnam Pro"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        },
        extend: {
            colors: {
                // Semantic Colors (Mapped to CSS Variables)
                bg: {
                    main: 'var(--bg-main)',
                    card: 'var(--bg-card)',
                    elevated: 'var(--bg-elevated)',
                    glass: 'var(--glass-bg)',
                },
                text: {
                    main: 'var(--text-main)',
                    secondary: 'var(--text-secondary)',
                    muted: 'var(--text-muted)',
                },
                border: {
                    DEFAULT: 'var(--border-color)',
                    glass: 'var(--glass-border)',
                },

                // Preserved Original Palettes
                slate: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    400: '#94a3b8',
                    500: '#64748b',
                    800: '#1e293b',
                    900: '#0f172a',
                    950: '#020617',
                },
                indigo: {
                    400: '#60A5FA', // Blue 400
                    500: '#3B82F6', // Blue 500
                    600: '#0061FE', // Vibrant Primary Blue (Dropbox-like)
                    900: '#1E3A8A', // Blue 900
                    950: '#172554', // Blue 950
                },
                emerald: {
                    400: '#34d399',
                    500: '#10b981',
                },
                blue: {
                    500: '#3b82f6',
                },
                amber: {
                    500: '#f59e0b',
                },
                red: {
                    500: '#ef4444',
                }
            },
            animation: {
                'light-sweep': 'lightSweep 4s ease-in-out infinite',
                'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                lightSweep: {
                    '0%': { transform: 'translateX(-100%) skewX(-45deg)', opacity: '0' },
                    '10%': { opacity: '0.4' },
                    '50%': { opacity: '0.4' },
                    '70%': { opacity: '0' },
                    '100%': { transform: 'translateX(200%) skewX(-45deg)', opacity: '0' },
                },
                pulseGlow: {
                    '0%, 100%': { opacity: '1', boxShadow: '0 0 10px #6366f1' },
                    '50%': { opacity: '.5', boxShadow: '0 0 20px #6366f1' },
                }
            }
        },
    },
    plugins: [],
}

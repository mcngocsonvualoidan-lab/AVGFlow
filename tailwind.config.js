/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        fontFamily: {
            sans: ['"Be Vietnam Pro"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        },
        extend: {
            colors: {
                slate: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    900: '#0f172a',
                    950: '#020617',
                },
                indigo: {
                    400: '#818cf8', // Adding for gradients/light text
                    500: '#6366f1', // Electric Indigo
                    600: '#4f46e5', // Deep Indigo
                    900: '#312e81',
                    950: '#1e1b4b',
                },
                emerald: {
                    500: '#10b981', // Success
                },
                blue: {
                    500: '#3b82f6', // Processing/Info
                },
                amber: {
                    500: '#f59e0b', // Warning
                },
                red: {
                    500: '#ef4444', // Error/Rework
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
                    '100%': { transform: 'translateX(200%) skewX(-45deg)', opacity: '0' }, // Adjusted distance
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

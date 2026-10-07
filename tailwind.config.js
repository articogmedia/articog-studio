/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./packages/studio/src/**/*.{js,jsx}",
        "./packages/Open-AI-Design-Agent/packages/design-agent/src/**/*.{js,jsx}",
        "./packages/Open-Poe-AI/packages/agents/src/**/*.{js,jsx,ts,tsx}",
        "./packages/Vibe-Workflow/packages/workflow-builder/src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#ffffff',
                    hover: '#e4e4e4',
                },
                'app-bg': '#000000',
                'panel-bg': '#000000',
                'card-bg': 'rgba(255, 255, 255, 0.03)',
                secondary: 'rgba(255, 255, 255, 0.55)',
                muted: 'rgba(255, 255, 255, 0.38)',
                border: 'rgba(255, 255, 255, 0.08)',
                surface: 'rgba(255, 255, 255, 0.03)',
                'surface-hover': 'rgba(255, 255, 255, 0.05)',
            },
            fontFamily: {
                sans: ['var(--font-sora)', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'sm': '0.5rem',
                'md': '0.75rem',
                'lg': '1rem',
                'xl': '1.25rem',
                'pill': '999px',
            },
            boxShadow: {
                'glow': '0 8px 30px rgba(255, 255, 255, 0.06)',
                'glow-accent': '0 8px 30px rgba(255, 255, 255, 0.06)',
                'soft': '0 8px 30px rgba(255, 255, 255, 0.06)',
                '3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.8)',
            }
        },
    },
    plugins: [],
}

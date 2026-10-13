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
                    DEFAULT: 'var(--color-accent)',
                    hover: 'var(--color-accent-hover)',
                },
                background: 'var(--color-background)',
                foreground: 'var(--color-foreground)',
                accent: 'var(--color-accent)',
                'accent-hover': 'var(--color-accent-hover)',
                surface: 'var(--color-surface)',
                'surface-hover': 'var(--color-surface-hover)',
                'app-bg': 'var(--color-background)',
                'panel-bg': '#0a0a0a',
                'card-bg': '#111111',
                secondary: 'var(--color-muted)',
                muted: 'var(--color-muted-foreground)',
            },
            fontFamily: {
                sans: ['var(--font-sora)', 'Sora', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: '0.5rem',
                sm: '0.5rem',
                md: '0.75rem',
                lg: '1rem',
                xl: '1.25rem',
                '2xl': '1.25rem',
                '3xl': '1.25rem',
                full: '999px',
            },
            boxShadow: {
                'glow': 'none',
                'glow-accent': 'none',
                '3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.8)',
            }
        },
    },
    plugins: [],
}

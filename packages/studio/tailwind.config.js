/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Several studio empty states use these compact card sizes. Keep the
      // utilities explicit so the image boxes reserve their intended space
      // before remote thumbnails finish loading.
      width: {
        18: "4.5rem",
      },
      height: {
        18: "4.5rem",
        22: "5.5rem",
      },
      fontFamily: {
        sans: ["var(--font-sora)", "Sora", "sans-serif"],
      },
      colors: {
        'app-bg': 'var(--color-background)',
        'panel-bg': '#0a0a0a',
        'card-bg': '#111111',
        primary: 'var(--color-accent)',
        secondary: 'var(--color-muted)',
        muted: 'var(--color-muted-foreground)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        'studio-bg-base': 'var(--bg-base)',
        'studio-bg-surface': 'var(--bg-surface)',
        'studio-bg-raised': 'var(--bg-raised)',
        'studio-border-subtle': 'var(--border-subtle)',
        'studio-border-strong': 'var(--border-strong)',
        'studio-text-primary': 'var(--text-primary)',
        'studio-text-secondary': 'var(--text-secondary)',
        'studio-text-muted': 'var(--text-muted)',
        'studio-accent': 'var(--accent)',
        'studio-danger': 'var(--danger)',
        'studio-success': 'var(--success)',
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.25rem",
        "3xl": "1.25rem",
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        modal: "var(--radius-modal)",
        full: "999px",
      },
      spacing: {
        "grid-1": "var(--space-1)",
        "grid-2": "var(--space-2)",
        "grid-3": "var(--space-3)",
        "grid-4": "var(--space-4)",
        "grid-5": "var(--space-5)",
        "grid-6": "var(--space-6)",
      },
    },
  },
  plugins: [],
}

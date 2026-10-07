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
        sans: ["var(--font-sora)", "system-ui", "sans-serif"],
      },
      colors: {
        'app-bg': '#000000',
        'panel-bg': '#000000',
        'card-bg': 'rgba(255, 255, 255, 0.03)',
        primary: {
          DEFAULT: '#ffffff',
          hover: '#e4e4e4',
        },
        secondary: 'rgba(255, 255, 255, 0.55)',
        muted: 'rgba(255, 255, 255, 0.38)',
        border: 'rgba(255, 255, 255, 0.08)',
        surface: 'rgba(255, 255, 255, 0.03)',
        'surface-hover': 'rgba(255, 255, 255, 0.05)',
      },
      borderRadius: {
        sm: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        pill: '999px',
      },
      boxShadow: {
        glow: '0 8px 30px rgba(255, 255, 255, 0.06)',
        'glow-accent': '0 8px 30px rgba(255, 255, 255, 0.06)',
        soft: '0 8px 30px rgba(255, 255, 255, 0.06)',
      },
    },
  },
  plugins: [],
}

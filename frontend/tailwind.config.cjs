/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{html,js,jsx}"],
  mode: "jit",
  theme: {
    extend: {
      colors: {
        body: '#080A16',
        surface: '#0A0F1F',
        card: '#141827',
        cardHover: '#1c2033',
        primary: '#8B5CF6',
        secondary: '#06B6D4',
        accent: '#EC4899',
        muted: '#94a3b8',
        link: '#D1D5DB',
        textMajor: '#ededed',
        dimWhite: '#cecece',
        dimBlue: "rgba(139, 92, 246, 0.1)",
        badgeTv: '#359fed',
        badgeSub: '#2a2a2a',
        badgeTotal: '#232323',
        gray: '#6c6c6c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        outfit: ['Outfit', 'system-ui', 'sans-serif'],
        pathway: ['"Pathway Extreme"', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '18px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
        glow: '0 0 20px rgba(139, 92, 246, 0.3)',
        card: '0 4px 20px rgba(0, 0, 0, 0.4)',
        'glow-lg': '0 0 40px rgba(139, 92, 246, 0.2)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
    screens: {
      xs: "480px",
      ss: "620px",
      sm: "768px",
      md: "992px",
      lg: "1200px",
      xl: "1400px",
    },
  },
  plugins: [],
};

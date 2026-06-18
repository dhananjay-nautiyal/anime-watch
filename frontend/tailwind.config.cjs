/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{html,js,jsx}"],
  mode: "jit",
  theme: {
    extend: {
      colors: {
        body: '#09090B',
        surface: '#111827',
        primary: '#8B5CF6',
        secondary: '#06B6D4',
        accent: '#EC4899',
        muted: '#6B7280',
        link: '#D1D5DB',
        card: 'rgba(17, 24, 39, 0.6)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '20px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
        glow: '0 0 20px rgba(139, 92, 246, 0.3)',
        card: '0 4px 20px rgba(0, 0, 0, 0.4)',
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

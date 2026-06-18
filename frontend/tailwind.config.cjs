/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{html,js,jsx}"],
  mode: "jit",
  theme: {
    extend: {
      colors: {
        body: '#161616',
        card: '#1b1b1b',
        cardHover: '#202020',
        secondary: '#2d2d2d',
        secondary1: '#464646',
        primary: '#7c3aed',
        primary1: '#8b5cf6',
        primary2: '#6d28d9',
        textMajor: '#ededed',
        light: '#ececec',
        dark: '#343434',
        gray: '#6c6c6c',
        muted: '#545454',
        link: '#d3d3d3',
        badgeTv: '#359fed',
        badgeMovie: '#14864d',
        badgeOna: '#7c3aed',
        badgeTotal: '#232323',
        badgeSub: '#2a2a2a',
        dimBlue: "rgba(124, 58, 237, 0.1)",
      },
      fontFamily: {
        'pathway': ['"Pathway Extreme"', 'sans-serif'],
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

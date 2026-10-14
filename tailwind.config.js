/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        violet: { 500: '#7B55A8', 700: '#5B3A82', 900: '#3E2760' },
        leaf: { DEFAULT: '#7FA457', 700: '#4C7536', text: '#3F6A2D' },
        lav: { 300: '#B9A6D6' },
        mist: '#F3ECF9',
        ink: '#2A1F38',
        muted: '#6A5C7C',
        bg1: '#FFFFFF',
        bg2: '#F0E8F8',
        surface: 'rgba(255, 255, 255, 0.96)',
        field: '#FFFFFF',
        line: 'rgba(91, 58, 130, 0.22)',
        glass_sec_bg: 'rgba(255, 255, 255, 0.5)',
      },
      fontFamily: {
        nunito: ['Nunito', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
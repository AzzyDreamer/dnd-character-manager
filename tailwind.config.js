/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dnd: {
          primary: '#8B0000',
          secondary: '#DAA520',
          dark: '#1a1a1a',
          parchment: '#f4e8d0',
        }
      },
      fontFamily: {
        'medieval': ['Cinzel', 'serif'],
      }
    },
  },
  plugins: [],
}

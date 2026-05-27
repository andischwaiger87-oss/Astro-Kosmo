/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,営業}",
    "./src/**/*.jsx"
  ],
  theme: {
    extend: {
      colors: {
        spaceDark: "#05070a",
        panelDark: "#0b0e14",
        goldAccent: "#d4af37",
        cyanAccent: "#00f2ff"
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
      }
    },
  },
  plugins: [],
}
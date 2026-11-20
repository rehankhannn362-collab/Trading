/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0b0e14',
          800: '#111622',
          750: '#161c2a',
          700: '#1c2436',
          600: '#253046',
          500: '#32405d',
        },
        trade: {
          green: '#0ecb81',
          'green-dark': '#0b9a62',
          'green-subtle': 'rgba(14, 203, 129, 0.12)',
          red: '#f6465d',
          'red-dark': '#c93347',
          'red-subtle': 'rgba(246, 70, 93, 0.12)',
        },
        brand: {
          accent: '#3b82f6',
          purple: '#8b5cf6',
          gold: '#f59e0b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

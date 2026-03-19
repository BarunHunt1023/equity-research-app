/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        brand: {
          navy: '#1B3A8A',
          dark: '#0F172A',
          blue: '#2563EB',
        },
        sidebar: {
          bg: '#ffffff',
          border: '#E2E8F0',
          active: '#EFF6FF',
          activeText: '#1D4ED8',
          text: '#64748B',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          card: '#ffffff',
          border: '#E2E8F0',
        },
        success: {
          DEFAULT: '#10B981',
          light: '#D1FAE5',
          text: '#059669',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#FEE2E2',
          text: '#DC2626',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}

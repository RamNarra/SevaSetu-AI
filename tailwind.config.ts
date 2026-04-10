import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#D4622B',
          light: '#F0845C',
          pale: '#FEF3EC',
          dark: '#B8521F',
        },
        secondary: {
          DEFAULT: '#2D6A4F',
          light: '#40916C',
          pale: '#EDF5F0',
          dark: '#1B4332',
        },
        accent: '#F4A261',
        background: '#FAF9F6',
        surface: '#FFFFFF',
        sidebar: {
          DEFAULT: '#1B2E25',
          active: '#2D6A4F',
          text: '#E8E4DF',
        },
        border: '#E5E2DC',
        urgency: {
          critical: '#DC2626',
          high: '#EA580C',
          medium: '#D97706',
          low: '#65A30D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 10px 25px -5px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)',
        'elevated': '0 20px 40px -10px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.04)',
        'glow-primary': '0 0 20px rgba(212,98,43,0.15)',
        'glow-critical': '0 0 20px rgba(220,38,38,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        obsidian: {
          950: '#080a0f',
          900: '#0d1017',
          800: '#141820',
          700: '#1c2230',
          600: '#242d3d',
          500: '#2e3a4e',
        },
        gold: {
          400: '#f5c842',
          500: '#e8b820',
          600: '#c99a10',
        },
        ember: {
          400: '#ff6b35',
          500: '#e85520',
        },
        jade: {
          400: '#2dd4a0',
          500: '#1ab889',
        },
        sapphire: {
          400: '#60a5fa',
          500: '#3b82f6',
        },
      },
      backgroundImage: {
        'grid-obsidian': 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        glow: { from: { boxShadow: '0 0 5px rgba(245,200,66,0.2)' }, to: { boxShadow: '0 0 20px rgba(245,200,66,0.5)' } },
      },
      boxShadow: {
        'gold': '0 0 20px rgba(245,200,66,0.15)',
        'jade': '0 0 20px rgba(45,212,160,0.15)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
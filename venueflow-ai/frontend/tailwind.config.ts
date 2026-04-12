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
        // Dark mode palette
        'bg-primary': '#0A0B0F',
        'bg-secondary': '#111318',
        'bg-card': '#16181F',
        'accent': '#6366F1',
        'accent-light': '#818CF8',
        'accent2': '#22D3EE',
        'success': '#10B981',
        'warning': '#F59E0B',
        'danger': '#EF4444',
        'text-primary': '#F1F5F9',
        'text-secondary': '#94A3B8',
        'border-dark': 'rgba(255,255,255,0.07)',
        // Light mode palette (applied via CSS vars)
        'light-bg': '#FAFAFA',
        'light-secondary': '#F1F5F9',
        'light-card': '#FFFFFF',
        'light-accent': '#4F46E5',
        'light-accent2': '#0891B2',
        'light-text': '#0F172A',
        'light-text-secondary': '#475569',
        // Density colors
        'density-low': '#10B981',
        'density-medium': '#F59E0B',
        'density-high': '#F97316',
        'density-critical': '#EF4444',
        // Neon emergency green
        'emergency-green': '#00FF88',
        'emergency-red': '#FF0033',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'bounce-subtle': 'bounce-subtle 1s ease-in-out infinite',
        'emergency-pulse': 'emergency-pulse 1s ease-in-out infinite',
        'arrow-march': 'arrow-march 1.2s linear infinite',
        'count-up': 'count-up 0.6s ease-out',
        'spin-slow': 'spin 8s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.4)' },
          '50%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.8), 0 0 40px rgba(99, 102, 241, 0.3)' },
        },
        'slide-up': {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          'from': { opacity: '0', transform: 'translateY(-10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'emergency-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7), inset 0 0 0 3px rgba(239, 68, 68, 0.5)' },
          '50%': { boxShadow: '0 0 0 10px rgba(239, 68, 68, 0), inset 0 0 0 3px rgba(239, 68, 68, 1)' },
        },
        'arrow-march': {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glow-indigo': '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.3)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.5)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}

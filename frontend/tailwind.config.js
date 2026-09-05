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
        fintech: {
          dark: "#0a0f1d",
          card: "#111827",
          cardBorder: "#1f293d",
          accent: "#3b82f6",
          emerald: "#10b981",
          emeraldGlow: "rgba(16, 185, 129, 0.2)",
          amber: "#f59e0b",
          rose: "#f43f5e",
          purple: "#8b5cf6",
          muted: "#94a3b8"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      }
    },
  },
  plugins: [],
}

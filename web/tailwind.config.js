/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        space: { 900: '#05060f', 800: '#0a0e22', 700: '#10142e' },
        gold: '#f5c542',
        starcyan: '#3fd2ff',
        starviolet: '#8b6cff',
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'Microsoft YaHei', 'sans-serif'],
      },
      keyframes: {
        twinkle: { '0%,100%': { opacity: '0.3' }, '50%': { opacity: '1' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        twinkle: 'twinkle 3s ease-in-out infinite',
        floaty: 'floaty 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

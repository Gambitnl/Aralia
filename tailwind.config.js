/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          850: '#1a1d23',
        }
      },
      animation: {
        'bounce-subtle': 'bounce-subtle 0.3s ease-in-out infinite',
        'pulseInspectHighlight': 'pulseInspectHighlight 1s ease-in-out infinite',
      },
      keyframes: {
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        'pulseInspectHighlight': {
          '0%, 100%': { opacity: '0.7' },
          '50%': { opacity: '1' },
        },
      },
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

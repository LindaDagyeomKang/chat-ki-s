import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        kiwoom: {
          primary: '#E1007F',
          'primary-dark': '#B40064',
          navy: '#111547',
          'navy-light': '#1A237E',
          bg: '#F1F3F6',
          card: '#F8FAFC',
          border: '#F1F5F9',
          text: '#46464F',
          'text-light': '#94A3B8',
          'text-dark': '#191C1D',
          danger: '#BA1A1A',
        },
      },
      fontFamily: {
        pretendard: ['Pretendard', '-apple-system', 'Roboto', 'Helvetica', 'sans-serif'],
        manrope: ['Manrope', '-apple-system', 'Roboto', 'Helvetica', 'sans-serif'],
      },
      borderRadius: {
        'card': '32px',
        'pill': '9999px',
      },
      boxShadow: {
        'card': '0px 1px 2px rgba(0, 0, 0, 0.05)',
        'card-lg': '0px 32px 48px rgba(17, 21, 71, 0.04)',
        'pink': '0px 4px 6px -4px rgba(225, 0, 127, 0.20), 0px 10px 15px -3px rgba(225, 0, 127, 0.20)',
        'modal': '0px 32px 64px rgba(17, 21, 71, 0.12)',
      },
    },
  },
  plugins: [],
}

export default config

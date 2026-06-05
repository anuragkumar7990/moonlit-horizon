import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        mh: {
          bg:          '#0A0A0A',
          surface:     '#111111',
          surface2:    '#161616',
          border:      '#2A2A2A',
          text:        '#FFFFFF',
          muted:       '#999999',
          vermillion:  '#E8341C',
          gold:        '#FFD700',
          positive:    '#22C55E',
          negative:    '#FF4444',
        },
      },
      fontFamily: {
        poppins: ['var(--font-poppins)', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 12px #FFD70088',
        'gold-lg': '0 0 20px #FFD700AA',
      },
      borderRadius: {
        card: '12px',
      },
      spacing: {
        '18': '4.5rem',
      },
    },
  },
  plugins: [],
}

export default config

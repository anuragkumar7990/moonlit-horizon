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
          bg:          '#05050A',
          surface:     'rgba(255,255,255,0.028)',
          surface2:    'rgba(255,255,255,0.045)',
          border:      'rgba(255,255,255,0.07)',
          text:        '#FFFFFF',
          muted:       '#888899',
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
        gold:    '0 0 12px #FFD70088',
        'gold-lg': '0 0 20px #FFD700AA',
        glass:   '0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
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

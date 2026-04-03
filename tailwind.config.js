/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0D1B2A',
          800: '#1B2E42',
          700: '#243548',
          600: '#334155',
          400: '#64748B',
          200: '#CBD5E1',
          100: '#E2E8F0'
        },
        canvas: '#F7F6F3',
        card: '#FFFFFF',
        border: '#E8E5DE',
        divider: '#F0EDE6',
        muted: '#A8A29E',
        dim: '#F5F4F1',
        amber: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
          dark: '#92400E'
        },
        settle: {
          green: '#059669',
          greenLight: '#ECFDF5',
          red: '#DC2626',
          redLight: '#FEE2E2'
        }
      },
      borderRadius: {
        card: '12px',
        input: '8px',
        pill: '99px'
      },
      fontSize: {
        'page-title': ['20px', { fontWeight: '500', letterSpacing: '-0.3px' }],
        section: ['10px', { fontWeight: '500', letterSpacing: '0.9px', textTransform: 'uppercase' }]
      }
    }
  }
};

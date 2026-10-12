/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#EAF4F4',   // Mint Mist (canvas / soft light background)
          100: '#CCE3DE',  // Soft Sage (card surface / subtle borders)
          200: '#A4C3B2',  // Muted Sage (accents / active badges / borders)
          300: '#6B9080',  // Forest Sage (secondary buttons / focus rings / icons)
          400: '#3D6153',  // Intermediate Forest
          500: '#1A3C34',  // Deep Pine (primary text / dark buttons / deep containers)
        },
        agri: {
          mint: '#EAF4F4',
          lightSage: '#CCE3DE',
          mutedSage: '#A4C3B2',
          forestSage: '#6B9080',
          deepPine: '#1A3C34',
        }
      },
      fontFamily: {
        sans: ['"Inter"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"UnifrakturCook"', '"UnifrakturMaguntia"', 'serif'],
        fraktur: ['"UnifrakturCook"', '"UnifrakturMaguntia"', 'serif'],
        gothic: ['"UnifrakturCook"', '"UnifrakturMaguntia"', 'serif'],
        headline: ['"UnifrakturCook"', '"UnifrakturMaguntia"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      borderRadius: {
        none: '0px',
        sm: '15px',
        DEFAULT: '15px',
        md: '15px',
        lg: '15px',
        xl: '15px',
        '2xl': '15px',
        '3xl': '15px',
        full: '9999px',
        '15': '15px',
        'soft': '15px',
        'soft-lg': '15px',
        'soft-xl': '15px',
      }
    },
  },
  plugins: [],
}

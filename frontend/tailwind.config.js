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
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Fraunces"', '"Cormorant Garamond"', 'serif'],
        display: ['"Fraunces"', '"Cormorant Garamond"', 'serif'],
        editorial: ['"Cormorant Garamond"', '"Playfair Display"', 'serif'],
        fraunces: ['"Fraunces"', 'serif'],
        cormorant: ['"Cormorant Garamond"', 'serif'],
        playfair: ['"Playfair Display"', 'serif'],
        fraktur: ['"Fraunces"', '"Cormorant Garamond"', 'serif'],
        gothic: ['"Fraunces"', '"Cormorant Garamond"', 'serif'],
        headline: ['"Fraunces"', '"Cormorant Garamond"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },

    },
  },
  plugins: [],
}

import type { Config } from 'tailwindcss';

/**
 * Identité visuelle de Boutik : « vert et crème ».
 * - `slate` est redéfini en neutres CHAUDS (crème, sable) : tous les écrans qui utilisent bg-slate-50,
 *   border-slate-200, text-slate-600… en profitent sans être modifiés un par un.
 * - `brand` est le vert profond des actions ; `accent` est l'orange réservé aux offres et aux alertes.
 * Contrastes vérifiés : texte blanc sur brand-600 (≈ 6,6:1), slate-500 sur slate-50 (≈ 5,5:1).
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EAF5F0',
          100: '#DCEFE7',
          500: '#1F8A70',
          600: '#0E6B57',
          700: '#0A4D3E',
          800: '#083D32',
        },
        accent: {
          50: '#FCE9DC',
          600: '#C2410C',
          700: '#9A3412',
        },
        slate: {
          50: '#FAF6EF',
          100: '#F3ECDF',
          200: '#E8E0D3',
          300: '#DDD3C2',
          400: '#8C8F86',
          500: '#5A625D',
          600: '#454D48',
          700: '#333A36',
          800: '#252A27',
          900: '#1B1F1D',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

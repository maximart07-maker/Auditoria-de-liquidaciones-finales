import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        severidad: {
          alta: '#dc2626',
          media: '#d97706',
          baja: '#16a34a',
        },
      },
    },
  },
  plugins: [],
};

export default config;

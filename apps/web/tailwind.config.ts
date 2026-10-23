import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta institucional Crowe (tomada de la plantilla de marca).
        crowe: {
          indigo: '#011E41',
          ciruela: '#862D59',
          magenta: '#E4386A',
          naranja: '#D96C29',
          ambar: '#F5A800',
          'ambar-claro': '#FDB913',
        },
        severidad: {
          alta: '#dc2626',
          media: '#d97706',
          baja: '#16a34a',
        },
      },
      backgroundImage: {
        // Degradado de la plantilla: ámbar → naranja → magenta → ciruela.
        'crowe-franja': 'linear-gradient(90deg, #F5A800 0%, #D96C29 35%, #E4386A 65%, #862D59 100%)',
      },
    },
  },
  plugins: [],
};

export default config;

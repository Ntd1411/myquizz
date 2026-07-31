/** @type {import('tailwindcss').Config} */
// Design tokens are transcribed directly from the MyQuizz "Frontend style" spec.
// Rule of thumb: exactly ONE structural accent (primary blue). The sticker palette
// is decoration only and must never paint a CTA or a structural fill.
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        canvas: '#ffffff',
        'canvas-soft': '#f6f5f4',
        surface: '#ffffff',
        hairline: '#e6e6e6',
        primary: {
          DEFAULT: '#0075de',
          active: '#005bab',
        },
        // Deep indigo "night" band. Reserved for a single hero moment.
        secondary: '#213183',
        ink: {
          DEFAULT: 'rgba(0,0,0,0.95)',
          secondary: '#31302e',
          muted: '#615d59',
          faint: '#a39e98',
        },
        // Decoration only.
        sticker: {
          sky: '#62aef0',
          purple: '#d6b6f6',
          'purple-deep': '#391c57',
          pink: '#ff64c8',
          orange: '#dd5b00',
          'orange-deep': '#793400',
          teal: '#2a9d99',
          green: '#1aae39',
          brown: '#523410',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'system-ui', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing }] straight from the typography scale.
        'display-1': ['64px', { lineHeight: '1', letterSpacing: '-2.125px', fontWeight: '700' }],
        'display-2': ['54px', { lineHeight: '1.04', letterSpacing: '-1.875px', fontWeight: '700' }],
        'heading-1': ['40px', { lineHeight: '1.1', letterSpacing: '-1px', fontWeight: '700' }],
        'heading-2': ['26px', { lineHeight: '1.23', letterSpacing: '-0.625px', fontWeight: '700' }],
        'heading-3': ['22px', { lineHeight: '1.27', letterSpacing: '-0.25px', fontWeight: '700' }],
        title: ['20px', { lineHeight: '1.4', letterSpacing: '-0.125px', fontWeight: '600' }],
        'body-md': ['16px', { lineHeight: '1.5' }],
        'body-sm': ['15px', { lineHeight: '1.33' }],
        caption: ['14px', { lineHeight: '1.43' }],
        eyebrow: ['12px', { lineHeight: '1.33', letterSpacing: '0.125px', fontWeight: '600' }],
      },
      borderRadius: {
        xs: '4px',
        sm: '5px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      spacing: {
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '28px',
        xxl: '32px',
      },
      boxShadow: {
        // Level 1 - barely-there layered micro shadow.
        soft: '0 0.175px 1.041px rgba(0,0,0,0.01), 0 0.8px 2.925px rgba(0,0,0,0.02), 0 2.025px 7.847px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04)',
        // Level 2 - modals and popovers.
        elevated:
          '0 0.175px 1.041px rgba(0,0,0,0.01), 0 0.8px 2.925px rgba(0,0,0,0.02), 0 2.025px 7.847px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04), 0 23px 52px rgba(0,0,0,0.05)',
      },
      maxWidth: {
        container: '1200px',
      },
    },
  },
  plugins: [],
}

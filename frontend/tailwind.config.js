/** @type {import('tailwindcss').Config} */
// Design tokens are transcribed from the MyQuizz "Frontend style" spec, design v2.1
// "Daylight Studio" (design/styleguide-v2.html is the runnable reference).
//
// Three rules drive everything below:
// 1. No dark surface exists. `ink` is a text colour and must never paint a background.
// 2. Spotlight sits outside the answer quartet, so a button is never read as an answer.
// 3. The four answer colours are product material: solid on answer tiles, tinted on tags.
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // Surfaces.
        paper: '#ffffff',
        canvas: '#fafafc',
        wash: {
          DEFAULT: '#f4f1fe',
          alt: '#eef4ff',
        },
        hairline: '#e6e7ee',

        // Brand. One primary action per screen, always this violet.
        spotlight: {
          DEFAULT: '#6c4cf1',
          press: '#573ad4',
          soft: '#efeaff',
          line: '#cfc4fb',
        },

        // Text only.
        ink: {
          DEFAULT: '#23242b',
          2: '#565968',
          3: '#8e92a4',
          // Legacy v1 aliases, kept so older screens keep rendering during migration.
          secondary: '#565968',
          muted: '#565968',
          faint: '#8e92a4',
        },

        // The answer quartet. Solid paints answers, soft paints tags and badges.
        ans: {
          a: '#ef4b45',
          'a-soft': '#fdeceb',
          b: '#2f6be0',
          'b-soft': '#eaf1fe',
          c: '#f2b32e',
          'c-soft': '#fef5e3',
          d: '#1ba968',
          'd-soft': '#e7f7f0',
        },

        // Legacy v1 names still referenced by screens not yet reworked. They now point
        // at v2.1 values so nothing renders off-palette. Delete once unused.
        surface: '#ffffff',
        'canvas-soft': '#fafafc',
        primary: {
          DEFAULT: '#6c4cf1',
          active: '#573ad4',
        },

        // Legacy sticker palette from v1. Every entry now resolves to the nearest v2.1
        // colour, so screens that still reference it stay on-palette instead of losing
        // their colour outright. Remove each entry as its last usage disappears.
        sticker: {
          sky: '#2f6be0',
          teal: '#1ba968',
          green: '#1ba968',
          orange: '#ef4b45',
          'orange-deep': '#ef4b45',
          pink: '#ef4b45',
          'purple-deep': '#6c4cf1',
          brown: '#565968',
        },
      },
      fontFamily: {
        // One text family. Hierarchy comes from size, weight and tracking.
        sans: ['Instrument Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Every number: PIN, timer, score, counts. Never a sentence.
        numeric: ['Martian Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'display-1': [
          'clamp(34px, 5vw, 52px)',
          { lineHeight: '1.1', letterSpacing: '-0.022em', fontWeight: '700' },
        ],
        'display-2': [
          'clamp(30px, 4.2vw, 44px)',
          { lineHeight: '1.1', letterSpacing: '-0.022em', fontWeight: '700' },
        ],
        'heading-1': [
          'clamp(26px, 3.2vw, 34px)',
          { lineHeight: '1.1', letterSpacing: '-0.022em', fontWeight: '700' },
        ],
        'heading-2': ['26px', { lineHeight: '1.15', letterSpacing: '-0.022em', fontWeight: '700' }],
        'heading-3': ['22px', { lineHeight: '1.2', letterSpacing: '-0.022em', fontWeight: '700' }],
        title: ['17px', { lineHeight: '1.3', letterSpacing: '-0.012em', fontWeight: '700' }],
        'body-md': ['16px', { lineHeight: '1.55' }],
        'body-sm': ['15px', { lineHeight: '1.5' }],
        caption: ['14.5px', { lineHeight: '1.45' }],
        // Micro label: uppercase, numeric family, wide tracking.
        eyebrow: ['11px', { lineHeight: '1.3', letterSpacing: '0.12em', fontWeight: '500' }],
      },
      borderRadius: {
        // xs is a legacy alias; v2.1 starts the scale at 8px.
        xs: '8px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '22px',
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
        // Soft and layered. Hard offset blocks were dropped in v2.1.
        soft: '0 1px 2px rgba(35,36,43,0.04), 0 4px 12px rgba(35,36,43,0.05)',
        elevated: '0 2px 6px rgba(35,36,43,0.05), 0 14px 34px rgba(35,36,43,0.09)',
        brand: '0 2px 6px rgba(108,76,241,0.18), 0 10px 24px rgba(108,76,241,0.2)',
      },
      transitionTimingFunction: {
        // Calm for regular UI, gentle settle for the play surfaces.
        ui: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.42, 0.64, 1)',
      },
      transitionDuration: {
        fast: '140ms',
        ui: '220ms',
        slow: '420ms',
      },
      maxWidth: {
        container: '1200px',
      },
    },
  },
  plugins: [],
}

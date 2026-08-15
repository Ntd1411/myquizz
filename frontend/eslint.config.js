import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

/**
 * Flat ESLint config for the Vue 3 frontend.
 *
 * The rule set mirrors the backend config where it makes sense (no semicolons,
 * single quotes, 2-space indent) so both halves of the repo read the same way.
 * The deliberate differences:
 *   - comma-dangle is "always-multiline", because that is how this codebase is
 *     already written and it keeps diffs small.
 *   - "indent" is disabled inside .vue files: it fights vue/script-indent and
 *     vue/html-indent, which understand the SFC structure much better.
 *   - "max-len" is disabled inside .vue files. Tailwind utility strings are a
 *     single unbreakable attribute value, so the rule only produced noise on
 *     lines that cannot be shortened without hurting readability.
 */
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      '*.log',
    ],
  },

  js.configs.recommended,
  // Includes the vue-eslint-parser, so <template> blocks are actually linted.
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      // Correctness
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],

      // Style, aligned with the backend config
      semi: ['error', 'never'],
      quotes: ['error', 'single', { avoidEscape: true }],
      indent: ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': ['error', 'always-multiline'],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'comma-spacing': ['error', { before: false, after: true }],
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'arrow-spacing': ['error', { before: true, after: true }],
      'space-before-blocks': 'error',
      'keyword-spacing': ['error', { before: true, after: true }],
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
      'no-multi-spaces': 'error',
      'space-infix-ops': 'error',
      'brace-style': ['error', '1tbs'],
      'max-len': [
        'warn',
        {
          code: 120,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreUrls: true,
          ignoreRegExpLiterals: true,
          ignoreComments: false,
        },
      ],
    },
  },

  {
    files: ['**/*.vue'],
    rules: {
      // Let the Vue-aware indent rules own SFC indentation.
      indent: 'off',
      'vue/script-indent': ['error', 2, { baseIndent: 0, switchCase: 1 }],
      'vue/html-indent': ['error', 2],

      // Tailwind class attributes are long by nature and cannot be wrapped, so a
      // character budget here flags nothing actionable.
      'max-len': 'off',

      // Page components are intentionally named after their route, and several
      // route views are single-word by design.
      'vue/multi-word-component-names': 'off',

      // One attribute per line is the existing style, but short single-line tags
      // do not need to be split.
      'vue/max-attributes-per-line': ['warn', { singleline: 4, multiline: 1 }],

      'vue/attributes-order': 'warn',
      'vue/no-v-html': 'warn',
      'vue/require-default-prop': 'off',
      'vue/component-name-in-template-casing': ['error', 'PascalCase', { registeredComponentsOnly: true }],
    },
  },

  {
    // Test files. Vitest injects its API as globals (test.globals in vite.config.js),
    // so they are declared here instead of being imported in every spec.
    files: ['**/*.spec.js', 'vitest.setup.js', 'e2e/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
  },

  {
    // Config and tooling files run in Node, not the browser.
    files: ['*.config.js', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    // Developer scripts run in Node and are console programs: printing to stdout is
    // the whole point of them, so the browser globals and the console budget of the
    // app code do not apply.
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
]

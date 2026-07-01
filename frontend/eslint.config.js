import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import reactRefresh from "eslint-plugin-react-refresh"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    ignores: ["dist/**", "build/**", "node_modules/**", "*.config.js", "*.config.ts"]
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-refresh": reactRefresh,
      "react-hooks": reactHooks
    },
    languageOptions: {
      globals: {
        ...globals.browser
      }
    },
    rules: {
      // Kế thừa rules từ root config
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",

      // Code style rules từ root
      "semi": ["error", "never"],
      "quotes": ["error", "single"],
      "indent": ["error", 2],
      "comma-dangle": ["error", "never"],
      "no-trailing-spaces": "error",
      "eol-last": ["error", "always"],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],
      "comma-spacing": ["error", { "before": false, "after": true }],
      "key-spacing": ["error", { "beforeColon": false, "afterColon": true }],
      "arrow-spacing": ["error", { "before": true, "after": true }],
      "space-before-blocks": "error",
      "keyword-spacing": ["error", { "before": true, "after": true }],
      "no-multiple-empty-lines": ["error", { "max": 1, "maxEOF": 0 }],
      "no-multi-spaces": "error",
      "space-infix-ops": "error",
      "brace-style": ["error", "1tbs"],
      "max-len": ["warn", { "code": 120, "ignoreStrings": true, "ignoreTemplateLiterals": true }],

      // React specific rules
      "react-refresh/only-export-components": ["warn", {
        allowConstantExport: true
      }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
)

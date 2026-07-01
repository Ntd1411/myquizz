import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // TypeScript rules
      // Disallow unused vars but allow names prefixed with _
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Warn on explicit any
      "@typescript-eslint/no-explicit-any": "warn",
      // Do not require explicit return types for functions
      "@typescript-eslint/explicit-function-return-type": "off",
      // Do not require explicit types for module boundaries
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Warn on non-null assertions
      "@typescript-eslint/no-non-null-assertion": "warn",

      // Code style & formatting rules
      "semi": ["error", "never"], // Disallow semicolons
      "quotes": ["error", "single"], // Require single quotes
      "indent": ["error", 2], // Indent with 2 spaces
      "comma-dangle": ["error", "never"], // Disallow trailing commas in multiline objects/arrays
      "no-trailing-spaces": "error", // Disallow trailing whitespace
      "eol-last": ["error", "always"], // Require a newline at the end of the file
      "object-curly-spacing": ["error", "always"], // Require spaces inside { }
      "array-bracket-spacing": ["error", "never"], // Disallow spaces inside [ ]
      "comma-spacing": ["error", { "before": false, "after": true }], // Require space after commas
      "key-spacing": ["error", { "beforeColon": false, "afterColon": true }], // Require spacing in object literals: key: value
      "arrow-spacing": ["error", { "before": true, "after": true }], // Require spacing around arrow functions
      "space-before-blocks": "error", // Require space before blocks
      "keyword-spacing": ["error", { "before": true, "after": true }], // Require spacing around keywords (if, else, for...)
      "no-multiple-empty-lines": ["error", { "max": 1, "maxEOF": 0 }], // Max 1 empty line
      "no-multi-spaces": "error", // Disallow multiple spaces in a row
      "space-infix-ops": "error", // Require spacing around operators (+, -, *, /)
      "brace-style": ["error", "1tbs"], // Enforce one true brace style
      "max-len": ["warn", { "code": 120, "ignoreStrings": true, "ignoreTemplateLiterals": true }], // Max line length 120 characters
    },
  },
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "*.config.js",
      "*.config.mjs",
      ".env",
      ".env.*",
      "Dockerfile",
      "docker-compose.yml",
      ".dockerignore",
      ".git/**",
      ".gitignore",
      ".vscode/**",
      ".idea/**",
      "*.log",
      "logs/**",
    ],
  }
);

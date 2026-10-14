// noinspection ES6UnusedImports,JSUnresolvedVariable,JSUnresolvedFunction
import js from "@eslint/js";
import markdown from "@eslint/markdown";
import tsParser from "@typescript-eslint/parser";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import markdownSnippetsProcessor from "./eslint-processors/markdown-snippets.js";
import unicodePolicy from "./eslint-rules/unicode-policy.js";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "dev/**",
      "out/**",
      ".next/**",
      ".nuxt/**",
      ".svelte-kit/**",
      ".astro/**",
      ".output/**",
      ".vite/**",
      // File templates use ${NAME} placeholders, they are not valid source files.
      ".idea/**",
    ],
  },
  ...markdown.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}"],
    ...js.configs.recommended,
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.md"],
    processor: markdownSnippetsProcessor,
  },
  {
    files: ["**/*.md/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: { reportUnusedDisableDirectives: false },
    plugins: { "unicode-policy": unicodePolicy },
    rules: {
      "unicode-policy/emoji": "error",
      "unicode-policy/unicode-graphics": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      jsdoc,
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "unicode-policy": unicodePolicy,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "unicode-policy/emoji": "error",
      "unicode-policy/unicode-graphics": "error",
      "no-irregular-whitespace": "error",
      "no-var": "error",
      "prefer-const": "error",
      "jsdoc/require-jsdoc": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-returns": "error",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-redundant-roles": "error",
    },
  },
  {
    // Template's own tooling tests: vitest globals + intentional fixtures.
    // Must stay last: overrides the code rules above for tests/**.
    files: ["tests/**"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    rules: {
      "unicode-policy/emoji": "off",
      "unicode-policy/unicode-graphics": "off",
    },
  },
];

import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.config.js', '**/*.config.ts', 'server/**', 'shared/**', 'script/**'],
  },
  js.configs.recommended,
  {
    files: ['client/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        Promise: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        WebSocket: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        // React
        React: 'readonly',
        // DOM types
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSpanElement: 'readonly',
        HTMLParagraphElement: 'readonly',
        HTMLHeadingElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLUListElement: 'readonly',
        HTMLOListElement: 'readonly',
        HTMLLIElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTableElement: 'readonly',
        HTMLTableSectionElement: 'readonly',
        HTMLTableRowElement: 'readonly',
        HTMLTableCellElement: 'readonly',
        HTMLTableCaptionElement: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        // Audio API
        AudioContext: 'readonly',
        AudioBuffer: 'readonly',
        GainNode: 'readonly',
        ConvolverNode: 'readonly',
        AnalyserNode: 'readonly',
        MediaStreamAudioSourceNode: 'readonly',
        MediaStream: 'readonly',
        HTMLAudioElement: 'readonly',
        Response: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
      },
    },
    rules: {
      // Catch using variables before they're defined
      // Warning level - some UI component patterns intentionally use this
      // Key protection is react-hooks/rules-of-hooks for hook-related issues
      '@typescript-eslint/no-use-before-define': ['warn', {
        functions: false,     // Allow function hoisting
        classes: true,
        variables: true,      // This catches const/let before definition
        allowNamedExports: false,
        ignoreTypeReferences: true,
      }],

      // React hooks rules - catch dependency array issues (CRITICAL)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Prevent accidental unused variables
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // Disable base rules that conflict with typescript-eslint
      'no-use-before-define': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off', // TypeScript handles this better

      // Allow any for now
      '@typescript-eslint/no-explicit-any': 'off',

      // React refresh for Vite HMR
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];
